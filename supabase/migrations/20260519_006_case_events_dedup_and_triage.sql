-- ─────────────────────────────────────────────────────────────────────
-- Track A · Phase 1 — Dedup constraint + TRIAGE_COMPLETE trigger
--
-- Three things in one migration:
--   1. UNIQUE constraint on (case_id, event_type, occurred_at, actor_id)
--      so concurrent inserts (DB triggers + future app code) can't
--      produce duplicates.
--
--   2. Update the upsert_case_event helper to use ON CONFLICT DO NOTHING
--      instead of WHERE NOT EXISTS. The old pattern was race-vulnerable
--      and would fail UPSTREAM SOSCOMMAND writes if a race hit the
--      constraint. ON CONFLICT is atomic and lossless from the trigger
--      caller's perspective.
--
--   3. New trigger on public.cases.triage_at that emits TRIAGE_COMPLETE.
--      Previously no path emitted this event, so Paper 1 had zero data
--      on the triage milestone.
--
-- All statements are idempotent (DO blocks, OR REPLACE, DROP IF EXISTS)
-- so re-applying against the live project is safe.
-- ─────────────────────────────────────────────────────────────────────

-- ── 1. UNIQUE constraint (safe — research.case_events is empty live) ──
DO $$ BEGIN
  ALTER TABLE research.case_events
    ADD CONSTRAINT case_events_dedup_unique
    UNIQUE (case_id, event_type, occurred_at, actor_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. ON CONFLICT version of upsert helper ──────────────────────────
-- Replaces the prior WHERE NOT EXISTS pattern. Atomic; no race window.
CREATE OR REPLACE FUNCTION research.upsert_case_event(
  p_case_id uuid,
  p_event_type research.event_type,
  p_occurred_at timestamptz,
  p_actor_id text,
  p_payload text
) RETURNS void AS $$
BEGIN
  INSERT INTO research.case_events (case_id, event_type, occurred_at, actor_id, payload)
  VALUES (p_case_id, p_event_type, p_occurred_at, p_actor_id, p_payload)
  ON CONFLICT ON CONSTRAINT case_events_dedup_unique DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 3. TRIAGE_COMPLETE trigger ───────────────────────────────────────
-- Fires when public.cases.triage_at transitions from NULL → non-NULL
-- (or any value change). Without this, TRIAGE_COMPLETE had no
-- emission path and Paper 1 had zero triage-milestone data.
CREATE OR REPLACE FUNCTION research.on_case_triage_completed()
RETURNS trigger AS $$
BEGIN
  IF OLD.triage_at IS DISTINCT FROM NEW.triage_at
     AND NEW.triage_at IS NOT NULL THEN
    PERFORM research.upsert_case_event(
      NEW.id,
      'TRIAGE_COMPLETE',
      NEW.triage_at,
      COALESCE(NEW.owner_user_id::text, 'system'),
      'Auto-synced: cases.triage_at set'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_case_triage_to_research ON public.cases;
CREATE TRIGGER trg_case_triage_to_research
  AFTER UPDATE OF triage_at ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION research.on_case_triage_completed();

COMMENT ON CONSTRAINT case_events_dedup_unique ON research.case_events IS
  'Prevents duplicate events from concurrent triggers or backfill scripts. Use INSERT ... ON CONFLICT DO NOTHING in any new caller.';

COMMENT ON FUNCTION research.on_case_triage_completed() IS
  'Track A Phase 1: fills the gap where TRIAGE_COMPLETE had no emission path. Fires on triage_at transitions.';
