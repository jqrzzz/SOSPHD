-- ═══════════════════════════════════════════════════════════════════════════
-- Privileged research-function containment
--
-- The operational -> research trigger chain must be able to write through
-- RLS, but no Data API client should be able to invoke its SECURITY DEFINER
-- writers directly. Keep those two capabilities separate:
--
--   * trigger functions and their helper remain SECURITY DEFINER;
--   * their search paths are empty and all object references are qualified;
--   * PUBLIC/anon/authenticated cannot execute them directly;
--   * the authenticated self-check RPC remains available;
--   * research.allowed_users has no client-facing table privileges.
--
-- Migration 020 also accidentally replaced migration 006's atomic conflict
-- handling with a race-prone WHERE NOT EXISTS check on only case+event type.
-- Restore the declared unique-key semantics while replacing the helper.
-- This preserves distinct repeated legs/events and ignores only exact
-- duplicates covered by case_events_dedup_unique.
--
-- This migration deliberately does not alter, recreate, or disable any
-- trigger or table in public.*. Roll forward if a qualified reference ever
-- needs correction; never restore direct client execution as a rollback.
-- ═══════════════════════════════════════════════════════════════════════════

-- Fail closed if the live/current lineage contains an unexpected overload.
-- The sixth argument has a default, so five- and six-argument SQL calls both
-- resolve to this one six-argument function object.
DO $migration$
DECLARE
  expected_function regprocedure := to_regprocedure(
    'research.upsert_case_event(uuid,research.event_type,timestamptz,text,text,research.clock_resolution)'
  );
  overload_count integer;
BEGIN
  SELECT count(*)
    INTO overload_count
    FROM pg_catalog.pg_proc AS p
    JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
   WHERE n.nspname = 'research'
     AND p.proname = 'upsert_case_event';

  IF expected_function IS NULL OR overload_count <> 1 THEN
    RAISE EXCEPTION
      'Expected exactly one six-argument research.upsert_case_event; found % overload(s)',
      overload_count;
  END IF;
END
$migration$;

-- The replacement body names this constraint directly. Verify the hosted
-- schema has not drifted before installing a function that would otherwise
-- fail only when a later public-table trigger first executes it.
DO $migration$
DECLARE
  dedup_columns name[];
  dedup_is_deferrable boolean;
  dedup_is_valid boolean;
BEGIN
  SELECT
    constraint_record.condeferrable,
    constraint_record.convalidated,
    ARRAY(
      SELECT attribute.attname
      FROM pg_catalog.unnest(constraint_record.conkey)
        WITH ORDINALITY AS constraint_key(attnum, ordinality)
      JOIN pg_catalog.pg_attribute AS attribute
        ON attribute.attrelid = constraint_record.conrelid
       AND attribute.attnum = constraint_key.attnum
      ORDER BY constraint_key.ordinality
    )
  INTO dedup_is_deferrable, dedup_is_valid, dedup_columns
  FROM pg_catalog.pg_constraint AS constraint_record
  JOIN pg_catalog.pg_class AS table_record
    ON table_record.oid = constraint_record.conrelid
  JOIN pg_catalog.pg_namespace AS namespace_record
    ON namespace_record.oid = table_record.relnamespace
  WHERE namespace_record.nspname = 'research'
    AND table_record.relname = 'case_events'
    AND constraint_record.conname = 'case_events_dedup_unique'
    AND constraint_record.contype = 'u';

  IF NOT FOUND
     OR dedup_is_deferrable IS DISTINCT FROM false
     OR dedup_is_valid IS DISTINCT FROM true
     OR dedup_columns IS DISTINCT FROM ARRAY[
       'case_id', 'event_type', 'occurred_at', 'actor_id'
     ]::name[] THEN
    RAISE EXCEPTION
      'Expected validated, non-deferrable research.case_events dedup constraint on (case_id, event_type, occurred_at, actor_id)';
  END IF;
END
$migration$;

CREATE OR REPLACE FUNCTION research.upsert_case_event(
  p_case_id uuid,
  p_event_type research.event_type,
  p_occurred_at timestamptz,
  p_actor_id text,
  p_payload text,
  p_resolution research.clock_resolution DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO research.case_events
    (case_id, event_type, occurred_at, actor_id, payload, resolution)
  VALUES
    (p_case_id, p_event_type, p_occurred_at, p_actor_id, p_payload, p_resolution)
  ON CONFLICT ON CONSTRAINT case_events_dedup_unique DO NOTHING;
END;
$$;

-- Reassert both execution identity and the empty path for every internal
-- trigger writer. Their current bodies already qualify every non-pg_catalog
-- function and type they use.
ALTER FUNCTION research.on_case_created() SECURITY DEFINER;
ALTER FUNCTION research.on_case_created() SET search_path = '';

ALTER FUNCTION research.on_case_triage_completed() SECURITY DEFINER;
ALTER FUNCTION research.on_case_triage_completed() SET search_path = '';

ALTER FUNCTION research.on_case_status_changed() SECURITY DEFINER;
ALTER FUNCTION research.on_case_status_changed() SET search_path = '';

ALTER FUNCTION research.on_gop_approved() SECURITY DEFINER;
ALTER FUNCTION research.on_gop_approved() SET search_path = '';

ALTER FUNCTION research.on_episode_started() SECURITY DEFINER;
ALTER FUNCTION research.on_episode_started() SET search_path = '';

REVOKE EXECUTE ON FUNCTION
  research.upsert_case_event(
    uuid,
    research.event_type,
    timestamptz,
    text,
    text,
    research.clock_resolution
  ),
  research.on_case_created(),
  research.on_case_triage_completed(),
  research.on_case_status_changed(),
  research.on_gop_approved(),
  research.on_episode_started()
FROM PUBLIC, anon, authenticated;

-- This SECURITY DEFINER function discloses only whether the current JWT uid
-- is allowlisted. RLS and the app use it, so authenticated callers need it;
-- anonymous callers do not.
ALTER FUNCTION research.is_allowed_user() SECURITY DEFINER;
ALTER FUNCTION research.is_allowed_user() SET search_path = '';
REVOKE EXECUTE ON FUNCTION research.is_allowed_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION research.is_allowed_user() TO authenticated;

-- Preserve the earlier trigger-only posture even if historical privilege
-- state drifted outside the repository.
REVOKE EXECUTE ON FUNCTION research.prevent_decision_mutation()
  FROM PUBLIC, anon, authenticated;

-- A clean replay of migration 004's default table privileges can grant the
-- authenticated role DML on this later-created table. RLS still blocks rows,
-- but the allowlist's contract is stronger: clients receive no table grant.
REVOKE ALL ON TABLE research.allowed_users FROM PUBLIC, anon, authenticated;

-- PostgreSQL grants EXECUTE on newly created functions to PUBLIC unless the
-- creating role's defaults say otherwise. Prevent the same regression for
-- future research functions owned by this migration role.
ALTER DEFAULT PRIVILEGES IN SCHEMA research
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
