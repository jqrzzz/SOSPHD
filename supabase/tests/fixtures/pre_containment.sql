\set ON_ERROR_STOP on

-- Synthetic upgrade fixture: run after migrations through 020 and before the
-- containment migration. It exercises every operational trigger path and
-- snapshots rows/attachments that containment must not mutate.

SET TIME ZONE 'UTC';
CREATE SCHEMA IF NOT EXISTS contract_test;

SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '30000000-0000-4000-8000-000000000099',
  false
);

INSERT INTO public.cases (
  id, case_number, status, intake_date, created_at, owner_user_id
) VALUES (
  '10000000-0000-4000-8000-000000000001',
  'CONTRACT-UPGRADE-001',
  'new',
  '2026-01-01 08:00:00+00',
  '2026-01-01 07:55:00+00',
  '30000000-0000-4000-8000-000000000099'
);

UPDATE public.cases
   SET triage_at = '2026-01-01 08:15:00+00'
 WHERE id = '10000000-0000-4000-8000-000000000001';
UPDATE public.cases
   SET status = 'transport_arranged'
 WHERE id = '10000000-0000-4000-8000-000000000001';
UPDATE public.cases
   SET status = 'in_treatment'
 WHERE id = '10000000-0000-4000-8000-000000000001';
UPDATE public.cases
   SET status = 'discharged',
       closed_date = '2026-01-01 10:30:00+00'
 WHERE id = '10000000-0000-4000-8000-000000000001';

INSERT INTO public.guarantees_of_payment (
  id, case_id, gop_number, status, issued_date,
  requested_by_user_id, amount_guaranteed, currency
) VALUES (
  '10000000-0000-4000-8000-000000000101',
  '10000000-0000-4000-8000-000000000001',
  'CONTRACT-UPGRADE-GOP-001',
  'pending',
  '2025-12-31',
  '30000000-0000-4000-8000-000000000099',
  2500,
  'THB'
);
UPDATE public.guarantees_of_payment
   SET status = 'approved'
 WHERE id = '10000000-0000-4000-8000-000000000101';

INSERT INTO public.case_episodes (
  id, case_id, status, episode_type, start_date
) VALUES (
  '10000000-0000-4000-8000-000000000201',
  '10000000-0000-4000-8000-000000000001',
  'planned',
  'hospitalization',
  '2026-01-01 09:00:00+00'
);
UPDATE public.case_episodes
   SET status = 'in_progress'
 WHERE id = '10000000-0000-4000-8000-000000000201';

RESET ROLE;

DO $assert_seed$
DECLARE
  event_count integer;
  wrong_resolution_count integer;
BEGIN
  SELECT count(*) INTO event_count
  FROM research.case_events
  WHERE case_id = '10000000-0000-4000-8000-000000000001';

  IF event_count <> 7 THEN
    RAISE EXCEPTION
      'pre-containment fixture expected 7 trigger events, found %', event_count;
  END IF;

  SELECT count(*) INTO wrong_resolution_count
  FROM research.case_events
  WHERE case_id = '10000000-0000-4000-8000-000000000001'
    AND (
      (event_type IN (
        'FIRST_CONTACT', 'TRIAGE_COMPLETE', 'DISCHARGE', 'FACILITY_ARRIVAL'
      ) AND resolution IS DISTINCT FROM 'measured')
      OR
      (event_type IN (
        'TRANSPORT_ACTIVATED', 'DEFINITIVE_CARE_START'
      ) AND resolution IS DISTINCT FROM 'entry')
      OR
      (event_type = 'GUARANTEED_PAYMENT'
       AND resolution IS DISTINCT FROM 'date')
    );

  IF wrong_resolution_count <> 0 THEN
    RAISE EXCEPTION
      'pre-containment fixture has % event(s) with unexpected resolution',
      wrong_resolution_count;
  END IF;
END
$assert_seed$;

CREATE TABLE contract_test.pre_containment_case_events AS
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
WHERE case_id = '10000000-0000-4000-8000-000000000001';

ALTER TABLE contract_test.pre_containment_case_events ADD PRIMARY KEY (id);

CREATE TABLE contract_test.pre_containment_triggers AS
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
  );

DO $assert_snapshot$
DECLARE
  trigger_count integer;
BEGIN
  SELECT count(*) INTO trigger_count
  FROM contract_test.pre_containment_triggers;

  IF trigger_count <> 5 THEN
    RAISE EXCEPTION
      'pre-containment fixture expected 5 trigger attachments, found %',
      trigger_count;
  END IF;
END
$assert_snapshot$;
