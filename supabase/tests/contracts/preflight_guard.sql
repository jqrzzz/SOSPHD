\set ON_ERROR_STOP on

-- The containment migration should have failed before changing any function
-- or ACL because the disposable fixture replaced the four-column constraint
-- with a same-named two-column constraint.
DO $guard$
DECLARE
  dedup_columns name[];
BEGIN
  IF NOT pg_catalog.has_function_privilege(
    'authenticated',
    'research.upsert_case_event(uuid,research.event_type,timestamptz,text,text,research.clock_resolution)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION
      'failed containment preflight partially changed helper execution privileges';
  END IF;

  SELECT ARRAY(
    SELECT attribute.attname
    FROM pg_catalog.unnest(constraint_record.conkey)
      WITH ORDINALITY AS constraint_key(attnum, ordinality)
    JOIN pg_catalog.pg_attribute AS attribute
      ON attribute.attrelid = constraint_record.conrelid
     AND attribute.attnum = constraint_key.attnum
    ORDER BY constraint_key.ordinality
  )
  INTO dedup_columns
  FROM pg_catalog.pg_constraint AS constraint_record
  WHERE constraint_record.conrelid = 'research.case_events'::regclass
    AND constraint_record.conname = 'case_events_dedup_unique';

  IF dedup_columns IS DISTINCT FROM ARRAY['case_id', 'event_type']::name[] THEN
    RAISE EXCEPTION
      'negative fixture was not preserved after failed containment migration';
  END IF;
END
$guard$;

\echo 'containment constraint preflight rejected drift and changed nothing'

