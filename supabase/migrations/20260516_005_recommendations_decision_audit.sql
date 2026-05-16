-- ─────────────────────────────────────────────────────────────────────
-- Paper 2 provenance hardening — first-class decision audit columns
--
-- Previously the audit trail for "who decided rec X, when" lived inside
-- a JSON payload on research.case_events rows of kind rec_decision.
-- That works but is fragile: every analyst has to parse JSON to answer
-- "who decided what". This migration adds decided_by + decided_at as
-- first-class columns on research.recommendations, and backfills them
-- from the existing NOTE events so historical data isn't lost.
--
-- The NOTE-event audit continues to be written by application code —
-- that's the immutable timeline record. The new columns are the
-- denormalized, queryable view of the same fact.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE research.recommendations
  ADD COLUMN IF NOT EXISTS decided_by text,
  ADD COLUMN IF NOT EXISTS decided_at timestamptz;

-- Backfill from existing rec_decision NOTE events.
-- Match: payload->>'recommendation_id' = recommendations.id::text
WITH decision_notes AS (
  SELECT
    (payload::jsonb ->> 'recommendation_id')::uuid AS rec_id,
    occurred_at AS decided_at,
    actor_id    AS decided_by,
    ROW_NUMBER() OVER (
      PARTITION BY (payload::jsonb ->> 'recommendation_id')
      ORDER BY occurred_at ASC
    ) AS rn
  FROM research.case_events
  WHERE event_type = 'NOTE'
    AND payload <> ''
    AND payload ~ '^\s*\{'
    AND (payload::jsonb ->> 'kind') = 'rec_decision'
    AND (payload::jsonb ->> 'recommendation_id') IS NOT NULL
)
UPDATE research.recommendations r
SET decided_at = dn.decided_at,
    decided_by = dn.decided_by
FROM decision_notes dn
WHERE dn.rec_id = r.id
  AND dn.rn = 1
  AND r.accepted IS NOT NULL
  AND r.decided_at IS NULL;

-- Speeds up Paper 2 dashboard queries that filter by decision presence.
CREATE INDEX IF NOT EXISTS recommendations_decided_at_idx
  ON research.recommendations (decided_at)
  WHERE decided_at IS NOT NULL;

-- Invariant: every decided rec must have both columns populated.
ALTER TABLE research.recommendations
  DROP CONSTRAINT IF EXISTS recommendations_decision_audit_check;
ALTER TABLE research.recommendations
  ADD CONSTRAINT recommendations_decision_audit_check
  CHECK (
    (accepted IS NULL AND decided_by IS NULL AND decided_at IS NULL)
    OR
    (accepted IS NOT NULL AND decided_by IS NOT NULL AND decided_at IS NOT NULL)
  );

COMMENT ON COLUMN research.recommendations.decided_by IS
  'Auth user id (uuid as text) of the operator who accepted or overrode this recommendation. Mirrors the actor_id on the rec_decision NOTE event.';
COMMENT ON COLUMN research.recommendations.decided_at IS
  'Timestamp the decision was recorded. Mirrors occurred_at on the rec_decision NOTE event. Time-to-decision = decided_at - created_at.';
