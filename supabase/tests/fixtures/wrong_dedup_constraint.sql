\set ON_ERROR_STOP on

-- Disposable negative fixture. Preserve the expected constraint name while
-- changing its shape so the containment migration must fail closed before it
-- replaces any function or privilege.
ALTER TABLE research.case_events
  DROP CONSTRAINT case_events_dedup_unique;

ALTER TABLE research.case_events
  ADD CONSTRAINT case_events_dedup_unique
  UNIQUE (case_id, event_type);

