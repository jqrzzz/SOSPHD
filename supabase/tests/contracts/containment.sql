\set ON_ERROR_STOP on

\if :{?scenario}
\else
  \echo 'containment.sql requires -v scenario=fresh or -v scenario=upgrade'
  \quit 2
\endif

BEGIN;
SET TIME ZONE 'UTC';
SELECT pg_catalog.set_config('sosphd.test_scenario', :'scenario', true);

DO $validate_scenario$
BEGIN
  IF pg_catalog.current_setting('sosphd.test_scenario')
       NOT IN ('fresh', 'upgrade') THEN
    RAISE EXCEPTION
      'scenario must be fresh or upgrade, got %',
      pg_catalog.current_setting('sosphd.test_scenario');
  END IF;
END
$validate_scenario$;

CREATE SCHEMA IF NOT EXISTS contract_test;
CREATE OR REPLACE FUNCTION contract_test.assert_true(
  condition boolean,
  assertion_message text
) RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF condition IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'contract assertion failed: %', assertion_message;
  END IF;
END;
$function$;

-- Function identity and execution boundaries.
SELECT contract_test.assert_true(
  (
    SELECT count(*) = 1
    FROM pg_catalog.pg_proc AS proc
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = proc.pronamespace
    WHERE namespace.nspname = 'research'
      AND proc.proname = 'upsert_case_event'
  ),
  'research.upsert_case_event must have exactly one overload'
);

SELECT contract_test.assert_true(
  pg_catalog.to_regprocedure(
    'research.upsert_case_event(uuid,research.event_type,timestamptz,text,text,research.clock_resolution)'
  ) IS NOT NULL,
  'the sole upsert_case_event overload must have six identity arguments'
);

SELECT contract_test.assert_true(
  pg_catalog.to_regprocedure(
    'research.upsert_case_event(uuid,research.event_type,timestamptz,text,text)'
  ) IS NULL,
  'the obsolete five-argument upsert_case_event overload must not exist'
);

WITH expected(function_oid) AS (
  SELECT pg_catalog.unnest(ARRAY[
    'research.upsert_case_event(uuid,research.event_type,timestamptz,text,text,research.clock_resolution)'::regprocedure,
    'research.on_case_created()'::regprocedure,
    'research.on_case_triage_completed()'::regprocedure,
    'research.on_case_status_changed()'::regprocedure,
    'research.on_gop_approved()'::regprocedure,
    'research.on_episode_started()'::regprocedure
  ])::oid
)
SELECT contract_test.assert_true(
  NOT EXISTS (
    SELECT 1
    FROM expected
    JOIN pg_catalog.pg_proc AS proc ON proc.oid = expected.function_oid
    WHERE NOT proc.prosecdef
       OR NOT EXISTS (
         SELECT 1
         FROM pg_catalog.unnest(COALESCE(proc.proconfig, ARRAY[]::text[]))
           AS setting(config)
         WHERE pg_catalog.split_part(setting.config, '=', 1) = 'search_path'
           AND pg_catalog.translate(
             pg_catalog.split_part(setting.config, '=', 2), '" ', ''
           ) = ''
       )
  ),
  'all six internal writers must be SECURITY DEFINER with an empty search_path'
);

WITH expected(function_oid) AS (
  SELECT pg_catalog.unnest(ARRAY[
    'research.upsert_case_event(uuid,research.event_type,timestamptz,text,text,research.clock_resolution)'::regprocedure,
    'research.on_case_created()'::regprocedure,
    'research.on_case_triage_completed()'::regprocedure,
    'research.on_case_status_changed()'::regprocedure,
    'research.on_gop_approved()'::regprocedure,
    'research.on_episode_started()'::regprocedure
  ])::oid
)
SELECT contract_test.assert_true(
  NOT EXISTS (
    SELECT 1
    FROM expected
    JOIN pg_catalog.pg_proc AS proc ON proc.oid = expected.function_oid
    WHERE pg_catalog.has_function_privilege('anon', proc.oid, 'EXECUTE')
       OR pg_catalog.has_function_privilege(
            'authenticated', proc.oid, 'EXECUTE'
          )
       OR EXISTS (
         SELECT 1
         FROM pg_catalog.aclexplode(
           COALESCE(proc.proacl, pg_catalog.acldefault('f', proc.proowner))
         ) AS privilege
         WHERE privilege.grantee = 0
           AND privilege.privilege_type = 'EXECUTE'
       )
  ),
  'PUBLIC, anon, and authenticated must not execute internal writers'
);

SELECT contract_test.assert_true(
  pg_catalog.has_function_privilege(
    'authenticated', 'research.is_allowed_user()', 'EXECUTE'
  ),
  'authenticated must execute the allowlist self-check'
);
SELECT contract_test.assert_true(
  NOT pg_catalog.has_function_privilege(
    'anon', 'research.is_allowed_user()', 'EXECUTE'
  ),
  'anon must not execute the allowlist self-check'
);
SELECT contract_test.assert_true(
  NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS proc
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(proc.proacl, pg_catalog.acldefault('f', proc.proowner))
    ) AS privilege
    WHERE proc.oid = 'research.is_allowed_user()'::regprocedure
      AND privilege.grantee = 0
      AND privilege.privilege_type = 'EXECUTE'
  ),
  'PUBLIC must not execute the allowlist self-check'
);

SELECT contract_test.assert_true(
  (
    SELECT proc.prosecdef
       AND EXISTS (
         SELECT 1
         FROM pg_catalog.unnest(COALESCE(proc.proconfig, ARRAY[]::text[]))
           AS setting(config)
         WHERE pg_catalog.split_part(setting.config, '=', 1) = 'search_path'
           AND pg_catalog.translate(
             pg_catalog.split_part(setting.config, '=', 2), '" ', ''
           ) = ''
       )
    FROM pg_catalog.pg_proc AS proc
    WHERE proc.oid = 'research.is_allowed_user()'::regprocedure
  ),
  'allowlist self-check must remain SECURITY DEFINER with an empty search_path'
);

SELECT contract_test.assert_true(
  NOT pg_catalog.has_function_privilege(
    'anon', 'research.prevent_decision_mutation()', 'EXECUTE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'authenticated', 'research.prevent_decision_mutation()', 'EXECUTE'
  ),
  'app roles must not execute the recommendation trigger function directly'
);

SELECT contract_test.assert_true(
  NOT EXISTS (
    SELECT 1
    FROM (VALUES ('anon'::name), ('authenticated'::name))
      AS app_role(role_name)
    CROSS JOIN (VALUES
      ('SELECT'::text), ('INSERT'::text), ('UPDATE'::text),
      ('DELETE'::text), ('TRUNCATE'::text), ('REFERENCES'::text),
      ('TRIGGER'::text)
    ) AS operation(privilege_name)
    WHERE pg_catalog.has_table_privilege(
      app_role.role_name,
      'research.allowed_users',
      operation.privilege_name
    )
  ),
  'allowed_users must expose no table privilege to app roles'
);

SELECT contract_test.assert_true(
  COALESCE(
    (
      SELECT 'security_invoker=true' = ANY(
        COALESCE(class.reloptions, ARRAY[]::text[])
      )
      FROM pg_catalog.pg_class AS class
      JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'research'
        AND class.relname = 'case_intervals'
        AND class.relkind = 'v'
    ),
    false
  ),
  'case_intervals must remain a security_invoker view'
);

SELECT contract_test.assert_true(
  NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_default_acl AS defaults
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = defaults.defaclnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(defaults.defaclacl) AS privilege
    WHERE defaults.defaclrole = (
      SELECT role.oid
      FROM pg_catalog.pg_roles AS role
      WHERE role.rolname = current_user
    )
      AND defaults.defaclobjtype = 'f'
      AND namespace.nspname = 'research'
      AND privilege.grantee = 0
      AND privilege.privilege_type = 'EXECUTE'
  ),
  'future research functions must not default to PUBLIC EXECUTE'
);

-- Exercise denied calls, including the defaulted five-argument signature.
SET LOCAL ROLE anon;
DO $anon_calls$
BEGIN
  BEGIN
    PERFORM research.upsert_case_event(
      '40000000-0000-4000-8000-000000000001', 'NOTE',
      '2026-02-01 00:00:00+00', 'anon-contract', 'must not be inserted'
    );
    RAISE EXCEPTION 'anon unexpectedly executed five-argument helper call';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    PERFORM research.is_allowed_user();
    RAISE EXCEPTION 'anon unexpectedly executed is_allowed_user';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$anon_calls$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '30000000-0000-4000-8000-000000000001',
  true
);
DO $ordinary_calls$
BEGIN
  IF research.is_allowed_user() THEN
    RAISE EXCEPTION 'ordinary authenticated identity is unexpectedly allowlisted';
  END IF;

  BEGIN
    PERFORM research.upsert_case_event(
      '40000000-0000-4000-8000-000000000002', 'NOTE',
      '2026-02-01 00:01:00+00', 'ordinary-contract',
      'must not be inserted', 'measured'
    );
    RAISE EXCEPTION
      'ordinary identity unexpectedly executed six-argument helper call';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$ordinary_calls$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  'bb8a6e83-5f37-4e3d-9250-b96a6f4b3855',
  true
);
DO $allowlisted_calls$
BEGIN
  IF NOT research.is_allowed_user() THEN
    RAISE EXCEPTION 'seeded owner identity must be allowlisted';
  END IF;

  BEGIN
    PERFORM research.upsert_case_event(
      '40000000-0000-4000-8000-000000000003', 'NOTE',
      '2026-02-01 00:02:00+00', 'allowlisted-contract',
      'must not be inserted'
    );
    RAISE EXCEPTION
      'allowlisted identity unexpectedly executed five-argument helper call';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    PERFORM research.upsert_case_event(
      '40000000-0000-4000-8000-000000000004', 'NOTE',
      '2026-02-01 00:03:00+00', 'allowlisted-contract',
      'must not be inserted', 'measured'
    );
    RAISE EXCEPTION
      'allowlisted identity unexpectedly executed six-argument helper call';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$allowlisted_calls$;
RESET ROLE;

SELECT contract_test.assert_true(
  NOT EXISTS (
    SELECT 1 FROM research.case_events
    WHERE case_id IN (
      '40000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000002',
      '40000000-0000-4000-8000-000000000003',
      '40000000-0000-4000-8000-000000000004'
    )
  ),
  'denied helper calls must not insert events'
);

-- Ordinary authenticated RLS denial and allowlisted owner success.
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '30000000-0000-4000-8000-000000000001',
  true
);
DO $ordinary_rls$
DECLARE visible_count integer;
BEGIN
  SELECT count(*) INTO visible_count FROM research.cases;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'ordinary identity saw % research case(s)', visible_count;
  END IF;

  BEGIN
    INSERT INTO research.cases (id, source, patient_ref, status)
    VALUES (
      '40000000-0000-4000-8000-000000000101',
      'prospective', 'CONTRACT-NOT-ALLOWED', 'open'
    );
    RAISE EXCEPTION 'ordinary identity bypassed research.cases RLS';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$ordinary_rls$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  'bb8a6e83-5f37-4e3d-9250-b96a6f4b3855',
  true
);
INSERT INTO research.cases (id, source, patient_ref, status)
VALUES (
  '40000000-0000-4000-8000-000000000102',
  'prospective', 'CONTRACT-OWNER-ALLOWED', 'open'
);
DO $owner_rls$
DECLARE visible_count integer;
BEGIN
  SELECT count(*) INTO visible_count
  FROM research.cases
  WHERE id = '40000000-0000-4000-8000-000000000102';
  IF visible_count <> 1 THEN
    RAISE EXCEPTION
      'allowlisted owner expected one visible inserted case, found %',
      visible_count;
  END IF;
END
$owner_rls$;
RESET ROLE;

-- Trigger attachments must remain on the same sibling-owned tables and call
-- the same five functions. tgtype 5 is AFTER ROW INSERT; 17 is AFTER ROW
-- UPDATE (the triage trigger also retains its column filter in its definition,
-- checked by the upgrade snapshot below).
WITH expected(trigger_name, table_name, function_name, trigger_type) AS (
  VALUES
    ('trg_case_created_to_research', 'cases', 'on_case_created', 5::smallint),
    ('trg_case_triage_to_research', 'cases', 'on_case_triage_completed', 17::smallint),
    ('trg_case_status_to_research', 'cases', 'on_case_status_changed', 17::smallint),
    ('trg_gop_approved_to_research', 'guarantees_of_payment', 'on_gop_approved', 17::smallint),
    ('trg_episode_started_to_research', 'case_episodes', 'on_episode_started', 17::smallint)
), actual AS (
  SELECT
    trigger.tgname::text AS trigger_name,
    table_class.relname::text AS table_name,
    function_proc.proname::text AS function_name,
    trigger.tgtype
  FROM pg_catalog.pg_trigger AS trigger
  JOIN pg_catalog.pg_class AS table_class
    ON table_class.oid = trigger.tgrelid
  JOIN pg_catalog.pg_namespace AS table_namespace
    ON table_namespace.oid = table_class.relnamespace
  JOIN pg_catalog.pg_proc AS function_proc
    ON function_proc.oid = trigger.tgfoid
  JOIN pg_catalog.pg_namespace AS function_namespace
    ON function_namespace.oid = function_proc.pronamespace
  WHERE NOT trigger.tgisinternal
    AND table_namespace.nspname = 'public'
    AND function_namespace.nspname = 'research'
    AND trigger.tgname IN (
      'trg_case_created_to_research',
      'trg_case_triage_to_research',
      'trg_case_status_to_research',
      'trg_gop_approved_to_research',
      'trg_episode_started_to_research'
    )
)
SELECT contract_test.assert_true(
  NOT EXISTS (SELECT * FROM expected EXCEPT SELECT * FROM actual)
  AND NOT EXISTS (SELECT * FROM actual EXCEPT SELECT * FROM expected),
  'the five operational trigger attachments must match their original tables, functions, and events'
);

DO $upgrade_trigger_snapshot$
DECLARE differs boolean;
BEGIN
  IF pg_catalog.current_setting('sosphd.test_scenario') = 'upgrade' THEN
    IF pg_catalog.to_regclass(
      'contract_test.pre_containment_triggers'
    ) IS NULL THEN
      RAISE EXCEPTION 'upgrade scenario is missing the trigger snapshot';
    END IF;

    EXECUTE $query$
      WITH current_triggers AS (
        SELECT
          trigger.tgname::text AS trigger_name,
          table_namespace.nspname::text AS table_schema,
          table_class.relname::text AS table_name,
          function_namespace.nspname::text AS function_schema,
          function_proc.proname::text AS function_name,
          pg_catalog.pg_get_triggerdef(trigger.oid, true) AS trigger_definition
        FROM pg_catalog.pg_trigger AS trigger
        JOIN pg_catalog.pg_class AS table_class
          ON table_class.oid = trigger.tgrelid
        JOIN pg_catalog.pg_namespace AS table_namespace
          ON table_namespace.oid = table_class.relnamespace
        JOIN pg_catalog.pg_proc AS function_proc
          ON function_proc.oid = trigger.tgfoid
        JOIN pg_catalog.pg_namespace AS function_namespace
          ON function_namespace.oid = function_proc.pronamespace
        WHERE NOT trigger.tgisinternal
          AND trigger.tgname IN (
            'trg_case_created_to_research',
            'trg_case_triage_to_research',
            'trg_case_status_to_research',
            'trg_gop_approved_to_research',
            'trg_episode_started_to_research'
          )
      )
      SELECT EXISTS (
        (SELECT * FROM current_triggers
         EXCEPT SELECT * FROM contract_test.pre_containment_triggers)
        UNION ALL
        (SELECT * FROM contract_test.pre_containment_triggers
         EXCEPT SELECT * FROM current_triggers)
      )
    $query$ INTO differs;

    IF differs THEN
      RAISE EXCEPTION 'containment changed an existing trigger attachment';
    END IF;
  END IF;
END
$upgrade_trigger_snapshot$;

-- A non-allowlisted operational identity can write the synthetic public
-- fixtures; only the SECURITY DEFINER trigger chain writes research events.
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '30000000-0000-4000-8000-000000000002',
  true
);

INSERT INTO public.cases (
  id, case_number, status, intake_date, created_at, owner_user_id
) VALUES (
  '20000000-0000-4000-8000-000000000001',
  'CONTRACT-FRESH-001',
  'new',
  '2026-02-10 08:00:00+00',
  '2026-02-10 07:55:00+00',
  '30000000-0000-4000-8000-000000000002'
);

UPDATE public.cases
   SET notes = 'unrelated case edit before milestones'
 WHERE id = '20000000-0000-4000-8000-000000000001';
UPDATE public.cases
   SET triage_at = '2026-02-10 08:15:00+00'
 WHERE id = '20000000-0000-4000-8000-000000000001';
UPDATE public.cases
   SET status = 'transport_arranged'
 WHERE id = '20000000-0000-4000-8000-000000000001';
UPDATE public.cases
   SET status = 'in_treatment'
 WHERE id = '20000000-0000-4000-8000-000000000001';
UPDATE public.cases
   SET status = 'discharged',
       closed_date = '2026-02-10 10:30:00+00'
 WHERE id = '20000000-0000-4000-8000-000000000001';

INSERT INTO public.guarantees_of_payment (
  id, case_id, gop_number, status, issued_date,
  requested_by_user_id, amount_guaranteed, currency
) VALUES (
  '20000000-0000-4000-8000-000000000101',
  '20000000-0000-4000-8000-000000000001',
  'CONTRACT-FRESH-GOP-001',
  'pending',
  '2020-01-02',
  '30000000-0000-4000-8000-000000000002',
  2500,
  'THB'
);
UPDATE public.guarantees_of_payment
   SET status = 'approved'
 WHERE id = '20000000-0000-4000-8000-000000000101';

INSERT INTO public.case_episodes (
  id, case_id, status, episode_type, start_date
) VALUES (
  '20000000-0000-4000-8000-000000000201',
  '20000000-0000-4000-8000-000000000001',
  'planned',
  'hospitalization',
  '2026-02-10 09:00:00+00'
);
UPDATE public.case_episodes
   SET status = 'in_progress'
 WHERE id = '20000000-0000-4000-8000-000000000201';

UPDATE public.cases
   SET notes = 'second unrelated case edit'
 WHERE id = '20000000-0000-4000-8000-000000000001';
UPDATE public.guarantees_of_payment
   SET notes = 'unrelated GOP edit'
 WHERE id = '20000000-0000-4000-8000-000000000101';
UPDATE public.case_episodes
   SET notes = 'unrelated episode edit'
 WHERE id = '20000000-0000-4000-8000-000000000201';
RESET ROLE;

WITH expected(event_type, resolution, occurred_at) AS (
  VALUES
    ('FIRST_CONTACT', 'measured', '2026-02-10 08:00:00+00'::timestamptz),
    ('TRIAGE_COMPLETE', 'measured', '2026-02-10 08:15:00+00'::timestamptz),
    ('TRANSPORT_ACTIVATED', 'entry', pg_catalog.transaction_timestamp()),
    ('DEFINITIVE_CARE_START', 'entry', pg_catalog.transaction_timestamp()),
    ('DISCHARGE', 'measured', '2026-02-10 10:30:00+00'::timestamptz),
    ('GUARANTEED_PAYMENT', 'date', '2020-01-02 00:00:00+00'::timestamptz),
    ('FACILITY_ARRIVAL', 'measured', '2026-02-10 09:00:00+00'::timestamptz)
), actual AS (
  SELECT event_type::text, resolution::text, occurred_at
  FROM research.case_events
  WHERE case_id = '20000000-0000-4000-8000-000000000001'
)
SELECT contract_test.assert_true(
  NOT EXISTS (SELECT * FROM expected EXCEPT ALL SELECT * FROM actual)
  AND NOT EXISTS (SELECT * FROM actual EXCEPT ALL SELECT * FROM expected),
  'all five trigger functions must emit exactly seven expected events and resolutions'
);

SELECT contract_test.assert_true(
  (
    SELECT count(*) = 7
    FROM research.case_events
    WHERE case_id = '20000000-0000-4000-8000-000000000001'
  ),
  'unrelated operational updates must emit no event'
);

SELECT contract_test.assert_true(
  (
    SELECT payload =
      'Auto-synced from operational case creation: CONTRACT-FRESH-001'
    FROM research.case_events
    WHERE case_id = '20000000-0000-4000-8000-000000000001'
      AND event_type = 'FIRST_CONTACT'
  ),
  'case-created payload must remain stable'
);

SELECT contract_test.assert_true(
  (
    SELECT payload =
      'Auto-synced: GOP CONTRACT-FRESH-GOP-001 -> approved (2500 THB) [back-entered; issued_date 2020-01-02 is day-resolution]'
    FROM research.case_events
    WHERE case_id = '20000000-0000-4000-8000-000000000001'
      AND event_type = 'GUARANTEED_PAYMENT'
  ),
  'GOP payload must preserve its resolution warning'
);

-- Exact helper duplicates deduplicate, while a later event of the same type
-- remains a distinct observation.
SELECT research.upsert_case_event(
  '20000000-0000-4000-8000-000000000301', 'NOTE',
  '2026-02-11 08:00:00+00', 'contract-owner',
  'first payload wins', 'measured'
);
SELECT research.upsert_case_event(
  '20000000-0000-4000-8000-000000000301', 'NOTE',
  '2026-02-11 08:00:00+00', 'contract-owner',
  'duplicate payload must be ignored', 'entry'
);
SELECT research.upsert_case_event(
  '20000000-0000-4000-8000-000000000301', 'NOTE',
  '2026-02-11 08:05:00+00', 'contract-owner',
  'a distinct later note survives', 'measured'
);

SELECT contract_test.assert_true(
  (
    SELECT count(*) = 2
    FROM research.case_events
    WHERE case_id = '20000000-0000-4000-8000-000000000301'
      AND event_type = 'NOTE'
  ),
  'exact duplicate must deduplicate while later same-type event survives'
);
SELECT contract_test.assert_true(
  (
    SELECT payload = 'first payload wins' AND resolution = 'measured'
    FROM research.case_events
    WHERE case_id = '20000000-0000-4000-8000-000000000301'
      AND event_type = 'NOTE'
      AND occurred_at = '2026-02-11 08:00:00+00'
  ),
  'ON CONFLICT must leave the original exact event unchanged'
);

-- The Node harness separately runs two blocking psql sessions against this
-- exact key. This catalog assertion also pins the primitive that makes the
-- concurrent conflict resolve without failing the operational write.
SELECT contract_test.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = 'research.case_events'::regclass
      AND constraint_record.conname = 'case_events_dedup_unique'
      AND constraint_record.contype = 'u'
  ),
  'case_events exact-dedup unique constraint must exist'
);

SELECT contract_test.assert_true(
  COALESCE(
    (
      SELECT constraint_record.convalidated
        AND NOT constraint_record.condeferrable
        AND ARRAY(
          SELECT attribute.attname
          FROM pg_catalog.unnest(constraint_record.conkey)
            WITH ORDINALITY AS constraint_key(attnum, ordinality)
          JOIN pg_catalog.pg_attribute AS attribute
            ON attribute.attrelid = constraint_record.conrelid
           AND attribute.attnum = constraint_key.attnum
          ORDER BY constraint_key.ordinality
        ) = ARRAY[
          'case_id', 'event_type', 'occurred_at', 'actor_id'
        ]::name[]
      FROM pg_catalog.pg_constraint AS constraint_record
      WHERE constraint_record.conrelid = 'research.case_events'::regclass
        AND constraint_record.conname = 'case_events_dedup_unique'
        AND constraint_record.contype = 'u'
    ),
    false
  ),
  'case_events dedup constraint must be validated, immediate, and cover the exact ordered tuple'
);

-- First recommendation decision is immutable; unrelated fields stay editable.
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  'bb8a6e83-5f37-4e3d-9250-b96a6f4b3855',
  true
);
INSERT INTO research.recommendations (
  id, case_id, created_at, engine_type, engine_version,
  confidence_type, confidence_value, recommendation, explanation
) VALUES (
  '20000000-0000-4000-8000-000000000401',
  '20000000-0000-4000-8000-000000000001',
  '2026-02-12 08:00:00+00',
  'rule_based',
  'contract-v1',
  'probability',
  0.8,
  'Synthetic contract recommendation',
  'Synthetic contract explanation'
);
UPDATE research.recommendations
   SET accepted = true,
       decided_by = 'bb8a6e83-5f37-4e3d-9250-b96a6f4b3855',
       decided_at = '2026-02-12 08:05:00+00'
 WHERE id = '20000000-0000-4000-8000-000000000401';

DO $immutable_decision$
BEGIN
  BEGIN
    UPDATE research.recommendations
       SET accepted = false,
           override_reason = 'must not replace the first decision'
     WHERE id = '20000000-0000-4000-8000-000000000401';
    RAISE EXCEPTION 'decided recommendation unexpectedly mutated';
  EXCEPTION WHEN raise_exception THEN
    IF position('decision fields are immutable' IN SQLERRM) = 0 THEN
      RAISE;
    END IF;
  END;
END
$immutable_decision$;

UPDATE research.recommendations
   SET explanation = 'Non-decision fields remain editable'
 WHERE id = '20000000-0000-4000-8000-000000000401';

DO $assert_decision$
DECLARE decision_is_intact boolean;
BEGIN
  SELECT accepted = true
         AND override_reason IS NULL
         AND decided_by = 'bb8a6e83-5f37-4e3d-9250-b96a6f4b3855'
         AND decided_at = '2026-02-12 08:05:00+00'
         AND explanation = 'Non-decision fields remain editable'
    INTO decision_is_intact
    FROM research.recommendations
   WHERE id = '20000000-0000-4000-8000-000000000401';

  IF decision_is_intact IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'recommendation decision contract was not preserved';
  END IF;
END
$assert_decision$;
RESET ROLE;

-- A trigger side effect is in the same transaction as its public source row.
DO $source_rollback$
BEGIN
  BEGIN
    INSERT INTO public.cases (
      id, case_number, status, intake_date, created_at, owner_user_id
    ) VALUES (
      '20000000-0000-4000-8000-000000000501',
      'CONTRACT-ROLLBACK-001',
      'new',
      '2026-02-13 08:00:00+00',
      '2026-02-13 08:00:00+00',
      '30000000-0000-4000-8000-000000000002'
    );

    IF NOT EXISTS (
      SELECT 1 FROM research.case_events
      WHERE case_id = '20000000-0000-4000-8000-000000000501'
        AND event_type = 'FIRST_CONTACT'
    ) THEN
      RAISE EXCEPTION 'rollback probe did not emit its trigger event';
    END IF;

    RAISE EXCEPTION USING
      ERRCODE = 'P7777', MESSAGE = 'force rollback of source mutation';
  EXCEPTION WHEN SQLSTATE 'P7777' THEN NULL;
  END;

  IF EXISTS (
    SELECT 1 FROM public.cases
    WHERE id = '20000000-0000-4000-8000-000000000501'
  ) OR EXISTS (
    SELECT 1 FROM research.case_events
    WHERE case_id = '20000000-0000-4000-8000-000000000501'
  ) THEN
    RAISE EXCEPTION
      'source rollback must also roll back its research event';
  END IF;
END
$source_rollback$;

-- On upgrade, containment must not rewrite baseline event content or trigger
-- attachment definitions captured immediately before the migration.
DO $upgrade_rows$
DECLARE
  baseline_count integer;
  current_count integer;
  differs boolean;
BEGIN
  IF pg_catalog.current_setting('sosphd.test_scenario') = 'upgrade' THEN
    IF pg_catalog.to_regclass(
      'contract_test.pre_containment_case_events'
    ) IS NULL THEN
      RAISE EXCEPTION 'upgrade scenario is missing the event snapshot';
    END IF;

    EXECUTE
      'SELECT count(*) FROM contract_test.pre_containment_case_events'
      INTO baseline_count;
    SELECT count(*) INTO current_count
    FROM research.case_events
    WHERE case_id = '10000000-0000-4000-8000-000000000001';

    IF baseline_count <> 7 OR current_count <> baseline_count THEN
      RAISE EXCEPTION
        'upgrade baseline count changed (baseline %, current %)',
        baseline_count, current_count;
    END IF;

    EXECUTE $query$
      WITH current_events AS (
        SELECT
          id,
          case_id,
          event_type::text AS event_type,
          occurred_at,
          actor_id,
          payload,
          resolution::text AS resolution,
          inserted_at,
          ingest_batch_id
        FROM research.case_events
        WHERE case_id = '10000000-0000-4000-8000-000000000001'
      )
      SELECT EXISTS (
        (SELECT * FROM current_events
         EXCEPT SELECT * FROM contract_test.pre_containment_case_events)
        UNION ALL
        (SELECT * FROM contract_test.pre_containment_case_events
         EXCEPT SELECT * FROM current_events)
      )
    $query$ INTO differs;

    IF differs THEN
      RAISE EXCEPTION
        'upgrade changed a baseline timestamp, actor, payload, resolution, or ingestion field';
    END IF;
  END IF;
END
$upgrade_rows$;

ROLLBACK;
\echo 'containment contracts passed for scenario=' :scenario
