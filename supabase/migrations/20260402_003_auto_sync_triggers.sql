-- ═══════════════════════════════════════════════════════════════════════
-- Auto-Sync Triggers: Operational -> Research Events
-- When operational tables change, auto-populate research.case_events.
-- This ensures the research provenance spine stays in sync with ops.
-- ═══════════════════════════════════════════════════════════════════════

-- ── Helper: insert a research event (idempotent) ────────────────────────
CREATE OR REPLACE FUNCTION research.upsert_case_event(
  p_case_id uuid,
  p_event_type research.event_type,
  p_occurred_at timestamptz,
  p_actor_id text,
  p_payload text
) RETURNS void AS $$
BEGIN
  -- Only insert if no event of this type exists for this case
  INSERT INTO research.case_events (case_id, event_type, occurred_at, actor_id, payload)
  SELECT p_case_id, p_event_type, p_occurred_at, p_actor_id, p_payload
  WHERE NOT EXISTS (
    SELECT 1 FROM research.case_events
    WHERE case_id = p_case_id AND event_type = p_event_type
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════════
-- Trigger 1: Case intake -> FIRST_CONTACT
-- When a new case is created in public.cases, log FIRST_CONTACT.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION research.on_case_created()
RETURNS trigger AS $$
BEGIN
  PERFORM research.upsert_case_event(
    NEW.id,
    'FIRST_CONTACT',
    COALESCE(NEW.intake_date, NEW.created_at),
    COALESCE(NEW.owner_user_id::text, 'system'),
    'Auto-synced from operational case creation: ' || NEW.case_number
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_case_created_to_research
  AFTER INSERT ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION research.on_case_created();

-- ═══════════════════════════════════════════════════════════════════════
-- Trigger 2: Case status changes -> research events
-- Maps operational status transitions to research event types.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION research.on_case_status_changed()
RETURNS trigger AS $$
BEGIN
  -- Only fire when status actually changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN

    -- in_treatment -> DEFINITIVE_CARE_START
    IF NEW.status = 'in_treatment' THEN
      PERFORM research.upsert_case_event(
        NEW.id,
        'DEFINITIVE_CARE_START',
        now(),
        COALESCE(NEW.owner_user_id::text, 'system'),
        'Auto-synced: case status changed to in_treatment'
      );
    END IF;

    -- transport_arranged -> TRANSPORT_ACTIVATED
    IF NEW.status = 'transport_arranged' THEN
      PERFORM research.upsert_case_event(
        NEW.id,
        'TRANSPORT_ACTIVATED',
        now(),
        COALESCE(NEW.owner_user_id::text, 'system'),
        'Auto-synced: case status changed to transport_arranged'
      );
    END IF;

    -- discharged -> DISCHARGE
    IF NEW.status = 'discharged' THEN
      PERFORM research.upsert_case_event(
        NEW.id,
        'DISCHARGE',
        COALESCE(NEW.closed_date, now()),
        COALESCE(NEW.owner_user_id::text, 'system'),
        'Auto-synced: case status changed to discharged'
      );
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_case_status_to_research
  AFTER UPDATE ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION research.on_case_status_changed();

-- ═══════════════════════════════════════════════════════════════════════
-- Trigger 3: GOP approved -> GUARANTEED_PAYMENT
-- When a guarantee of payment is approved, log the research event.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION research.on_gop_approved()
RETURNS trigger AS $$
BEGIN
  -- Only fire when status changes to approved or partially_approved
  IF OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status IN ('approved', 'partially_approved') THEN

    PERFORM research.upsert_case_event(
      NEW.case_id,
      'GUARANTEED_PAYMENT',
      COALESCE(NEW.issued_date::timestamptz, now()),
      COALESCE(NEW.requested_by_user_id::text, 'system'),
      'Auto-synced: GOP ' || NEW.gop_number || ' status changed to ' || NEW.status
        || CASE WHEN NEW.amount_guaranteed IS NOT NULL
             THEN ' (amount: ' || NEW.amount_guaranteed || ' ' || NEW.currency || ')'
             ELSE '' END
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_gop_approved_to_research
  AFTER UPDATE ON public.guarantees_of_payment
  FOR EACH ROW
  EXECUTE FUNCTION research.on_gop_approved();

-- ═══════════════════════════════════════════════════════════════════════
-- Trigger 4: Case episode starts -> FACILITY_ARRIVAL / DEFINITIVE_CARE
-- When a case_episode status changes to in_progress, map to research.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION research.on_episode_started()
RETURNS trigger AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status = 'in_progress' THEN

    -- Hospitalization/surgery/emergency -> FACILITY_ARRIVAL
    IF NEW.type IN ('hospitalization', 'surgery', 'emergency_visit') THEN
      PERFORM research.upsert_case_event(
        NEW.case_id,
        'FACILITY_ARRIVAL',
        COALESCE(NEW.actual_start, now()),
        'system',
        'Auto-synced: episode ' || NEW.type || ' started'
      );
    END IF;

    -- Transport -> TRANSPORT_ACTIVATED
    IF NEW.type IN ('transport_ground', 'transport_air', 'repatriation') THEN
      PERFORM research.upsert_case_event(
        NEW.id,  -- use case_id from episode
        'TRANSPORT_ACTIVATED',
        COALESCE(NEW.actual_start, now()),
        'system',
        'Auto-synced: transport episode ' || NEW.type || ' started'
      );
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_episode_started_to_research
  AFTER UPDATE ON public.case_episodes
  FOR EACH ROW
  EXECUTE FUNCTION research.on_episode_started();
