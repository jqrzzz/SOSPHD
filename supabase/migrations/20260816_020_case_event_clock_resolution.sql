-- ═══════════════════════════════════════════════════════════════════════
-- Milestone clock resolution — make the instrument describe its own clock
--
-- WHY THIS EXISTS
--
-- Paper 1's result is that the historical registry cannot answer "how long
-- did coordination take", because it stored a calendar date where an hours-
-- resolution interval was needed. The v0.9 provenance audit sharpened that:
-- even the nine rows that looked like transport timestamps were the same
-- date written into a second column, yielding an interval of exactly 0 h or
-- exactly 24 h and never any other value.
--
-- The programme's answer is prospective instrumentation — the triggers added
-- in migration 003. An audit of those triggers on 2026-08-16 found that they
-- reproduce the same failure at one point, and blur a second:
--
--   1. GUARANTEED_PAYMENT — BROKEN. It read
--          COALESCE(NEW.issued_date::timestamptz, now())
--      and `guarantees_of_payment.issued_date` is a DATE. The cast lands on
--      midnight, so the COALESCE actively PREFERRED a date over the
--      timestamp it already had. TTGP — Paper 2's core metric — would have
--      been destroyed at write time, in the new system, for exactly the
--      reason Paper 1 says the old system failed. Nothing had fired yet
--      (zero GOP rows), so no data is affected; the defect was latent.
--
--   2. TRANSPORT_ACTIVATED and DEFINITIVE_CARE_START from a status change
--      stamp now() — the moment the record was touched, not the moment the
--      ambulance rolled or care began. That is a real timestamp, but of the
--      data entry. Treating it as a measurement would understate delay by
--      however long the operator took to update the case.
--
-- A metric is only as good as the provenance of its endpoints, so the event
-- spine now records that provenance rather than leaving it to be inferred:
--
--   measured — an operational timestamp of when the event actually happened
--              (triage_at, episode.start_date, closed_date)
--   entry    — now() at the moment the record was written. A true timestamp,
--              of the entry rather than the event. Usable, with a stated lag.
--   date     — day resolution only. NOT usable for an hours-scale interval.
--
-- Analyses computing TTTA/TTGP/TTDC must state which resolutions they admit.
-- The 'date' rows are what Paper 1 is about; they must never be silently
-- differenced.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TYPE research.clock_resolution AS ENUM ('measured', 'entry', 'date');

ALTER TABLE research.case_events
  ADD COLUMN resolution research.clock_resolution;

COMMENT ON COLUMN research.case_events.resolution IS
  'Provenance of occurred_at: measured (operational event time), entry (now() at write time), date (day only — not differenceable at hour scale). Null means unclassified.';

-- ── Backfill: classify what is already here ────────────────────────────
--
-- Every historical row is date-granular. This is not an assumption — it is
-- Paper 1 §5.7 and §6.2, verified: every backfilled occurred_at sits at
-- 00:00 Asia/Bangkok. The assertion is re-checked below rather than trusted.
UPDATE research.case_events
   SET resolution = 'date'
 WHERE actor_id = 'historical_backfill';

-- The live trigger rows carry sub-second timestamps, but cases.intake_date
-- defaults to row creation, so they time the record's creation rather than
-- the tourist's call.
UPDATE research.case_events
   SET resolution = 'entry'
 WHERE actor_id <> 'historical_backfill' AND resolution IS NULL;

DO $$
DECLARE off_midnight int;
BEGIN
  SELECT count(*) INTO off_midnight
    FROM research.case_events
   WHERE resolution = 'date'
     AND (occurred_at AT TIME ZONE 'Asia/Bangkok')::time <> '00:00:00';
  IF off_midnight > 0 THEN
    RAISE EXCEPTION
      'Backfill classification is wrong: % rows marked date-resolution do not sit at midnight Asia/Bangkok. Investigate before proceeding — Paper 1 asserts they all do.',
      off_midnight;
  END IF;
END $$;

-- ── The writer now takes a resolution ──────────────────────────────────
--
-- Drop the 5-argument version first. Adding a 6th parameter WITH A DEFAULT
-- creates an overload rather than replacing, and a 5-argument call would
-- then match both signatures — "function is not unique" at trigger time,
-- which is to say at the worst possible moment. One signature only.
DROP FUNCTION IF EXISTS research.upsert_case_event(
  uuid, research.event_type, timestamptz, text, text);

CREATE OR REPLACE FUNCTION research.upsert_case_event(
  p_case_id uuid,
  p_event_type research.event_type,
  p_occurred_at timestamptz,
  p_actor_id text,
  p_payload text,
  p_resolution research.clock_resolution DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO research.case_events
    (case_id, event_type, occurred_at, actor_id, payload, resolution)
  SELECT p_case_id, p_event_type, p_occurred_at, p_actor_id, p_payload, p_resolution
  WHERE NOT EXISTS (
    SELECT 1 FROM research.case_events
    WHERE case_id = p_case_id AND event_type = p_event_type
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path TO 'research', 'public', 'extensions', 'pg_temp';

-- ── FIRST_CONTACT ──────────────────────────────────────────────────────
-- intake_date defaults to row creation, so this times the record, not the
-- call. Marked 'entry' unless intake_date was set independently of created_at.
CREATE OR REPLACE FUNCTION research.on_case_created()
RETURNS trigger AS $$
BEGIN
  PERFORM research.upsert_case_event(
    NEW.id,
    'FIRST_CONTACT',
    COALESCE(NEW.intake_date, NEW.created_at),
    COALESCE(NEW.owner_user_id::text, 'system'),
    'Auto-synced from operational case creation: ' || NEW.case_number,
    CASE WHEN NEW.intake_date IS NOT NULL
              AND NEW.intake_date IS DISTINCT FROM NEW.created_at
         THEN 'measured'::research.clock_resolution
         ELSE 'entry'::research.clock_resolution END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path TO 'research', 'public', 'extensions', 'pg_temp';

-- ── TRIAGE_COMPLETE ────────────────────────────────────────────────────
-- cases.triage_at is a timestamptz set when triage completes. Measured.
CREATE OR REPLACE FUNCTION research.on_case_triage_completed()
RETURNS trigger AS $$
BEGIN
  IF OLD.triage_at IS DISTINCT FROM NEW.triage_at
     AND NEW.triage_at IS NOT NULL THEN
    PERFORM research.upsert_case_event(
      NEW.id, 'TRIAGE_COMPLETE', NEW.triage_at,
      COALESCE(NEW.owner_user_id::text, 'system'),
      'Auto-synced: cases.triage_at set',
      'measured'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path TO 'research', 'public', 'extensions', 'pg_temp';

-- ── Status transitions ─────────────────────────────────────────────────
-- now() here is the moment the operator updated the case, not the moment
-- the event happened. Honest label: 'entry'. DISCHARGE prefers closed_date,
-- which is an operational time, so it is 'measured' when present.
CREATE OR REPLACE FUNCTION research.on_case_status_changed()
RETURNS trigger AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'in_treatment' THEN
      PERFORM research.upsert_case_event(
        NEW.id, 'DEFINITIVE_CARE_START', now(),
        COALESCE(NEW.owner_user_id::text, 'system'),
        'Auto-synced: case status changed to in_treatment', 'entry'
      );
    END IF;

    IF NEW.status = 'transport_arranged' THEN
      PERFORM research.upsert_case_event(
        NEW.id, 'TRANSPORT_ACTIVATED', now(),
        COALESCE(NEW.owner_user_id::text, 'system'),
        'Auto-synced: case status changed to transport_arranged', 'entry'
      );
    END IF;

    IF NEW.status = 'discharged' THEN
      PERFORM research.upsert_case_event(
        NEW.id, 'DISCHARGE',
        COALESCE(NEW.closed_date, now()),
        COALESCE(NEW.owner_user_id::text, 'system'),
        'Auto-synced: case status changed to discharged',
        CASE WHEN NEW.closed_date IS NOT NULL THEN 'measured'::research.clock_resolution
             ELSE 'entry'::research.clock_resolution END
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path TO 'research', 'public', 'extensions', 'pg_temp';

-- ── GUARANTEED_PAYMENT — the fix ───────────────────────────────────────
--
-- The previous body preferred issued_date (a DATE) over now(), collapsing
-- the endpoint of TTGP to midnight. It now never silently downgrades:
--
--   * issued today, or not set     → now() is the moment approval was
--                                    registered. Strictly better than
--                                    midnight of the same day. 'entry'.
--   * issued on an earlier date    → the guarantee was back-entered and the
--                                    day is genuinely all that is known.
--                                    Keep the date and SAY SO, so no
--                                    analysis differences it at hour scale.
--
-- Comparing in Asia/Bangkok because issued_date is written by operators in
-- Thailand; comparing in UTC would misclassify anything entered after 17:00
-- local as back-entry.
CREATE OR REPLACE FUNCTION research.on_gop_approved()
RETURNS trigger AS $$
DECLARE
  v_at  timestamptz;
  v_res research.clock_resolution;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status IN ('approved', 'partially_approved') THEN

    IF NEW.issued_date IS NULL
       OR NEW.issued_date >= (now() AT TIME ZONE 'Asia/Bangkok')::date THEN
      v_at  := now();
      v_res := 'entry';
    ELSE
      v_at  := NEW.issued_date::timestamptz;
      v_res := 'date';
    END IF;

    PERFORM research.upsert_case_event(
      NEW.case_id, 'GUARANTEED_PAYMENT', v_at,
      COALESCE(NEW.requested_by_user_id::text, 'system'),
      'Auto-synced: GOP ' || NEW.gop_number || ' -> ' || NEW.status
        || CASE WHEN NEW.amount_guaranteed IS NOT NULL
             THEN ' (' || NEW.amount_guaranteed || ' ' || NEW.currency || ')'
             ELSE '' END
        || CASE WHEN v_res = 'date'
             THEN ' [back-entered; issued_date ' || NEW.issued_date || ' is day-resolution]'
             ELSE '' END,
      v_res
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path TO 'research', 'public', 'extensions', 'pg_temp';

-- ── Episodes ───────────────────────────────────────────────────────────
-- case_episodes.start_date is a timestamptz of when the episode began.
-- This is the best transport/arrival signal currently wired.
CREATE OR REPLACE FUNCTION research.on_episode_started()
RETURNS trigger AS $$
DECLARE
  v_res research.clock_resolution;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status = 'in_progress' THEN

    v_res := CASE WHEN NEW.start_date IS NOT NULL
                  THEN 'measured'::research.clock_resolution
                  ELSE 'entry'::research.clock_resolution END;

    IF NEW.episode_type IN ('hospitalization', 'surgery', 'emergency_visit') THEN
      PERFORM research.upsert_case_event(
        NEW.case_id, 'FACILITY_ARRIVAL',
        COALESCE(NEW.start_date, now()), 'system',
        'Auto-synced: episode ' || NEW.episode_type || ' started', v_res
      );
    END IF;

    IF NEW.episode_type IN ('transport_ground', 'transport_air', 'repatriation') THEN
      PERFORM research.upsert_case_event(
        NEW.case_id, 'TRANSPORT_ACTIVATED',
        COALESCE(NEW.start_date, now()), 'system',
        'Auto-synced: transport episode ' || NEW.episode_type || ' started', v_res
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path TO 'research', 'public', 'extensions', 'pg_temp';

-- ── A view that refuses to difference a date ───────────────────────────
--
-- The single most likely way Paper 2 goes wrong is someone computing a
-- median TTTA over a mixed-resolution column and not noticing that half the
-- rows are midnights. This view makes the admissible set the default and
-- reports the excluded count rather than hiding it.
-- security_invoker is NOT optional here. research.case_events is gated by the
-- SD-001 allowlist (research.is_allowed_user()). A view created without it
-- runs as its OWNER, which would bypass that policy and expose the research
-- spine to every authenticated user. The view must inherit the caller's RLS.
CREATE OR REPLACE VIEW research.case_intervals
WITH (security_invoker = true) AS
WITH ev AS (
  SELECT case_id, event_type, occurred_at, resolution
    FROM research.case_events
)
SELECT
  f.case_id,
  f.occurred_at                              AS first_contact_at,
  t.occurred_at                              AS transport_activated_at,
  g.occurred_at                              AS guaranteed_payment_at,
  d.occurred_at                              AS definitive_care_at,
  -- An interval is admissible only when BOTH endpoints resolve finer than a
  -- calendar day. Anything else is Paper 1's finding, not a measurement.
  CASE WHEN f.resolution <> 'date' AND t.resolution <> 'date'
       THEN EXTRACT(EPOCH FROM (t.occurred_at - f.occurred_at)) / 60 END AS ttta_minutes,
  CASE WHEN f.resolution <> 'date' AND g.resolution <> 'date'
       THEN EXTRACT(EPOCH FROM (g.occurred_at - f.occurred_at)) / 60 END AS ttgp_minutes,
  CASE WHEN f.resolution <> 'date' AND d.resolution <> 'date'
       THEN EXTRACT(EPOCH FROM (d.occurred_at - f.occurred_at)) / 60 END AS ttdc_minutes,
  f.resolution AS first_contact_resolution,
  t.resolution AS transport_resolution,
  g.resolution AS gop_resolution,
  d.resolution AS definitive_care_resolution
FROM      (SELECT * FROM ev WHERE event_type = 'FIRST_CONTACT')         f
LEFT JOIN (SELECT * FROM ev WHERE event_type = 'TRANSPORT_ACTIVATED')   t USING (case_id)
LEFT JOIN (SELECT * FROM ev WHERE event_type = 'GUARANTEED_PAYMENT')    g USING (case_id)
LEFT JOIN (SELECT * FROM ev WHERE event_type = 'DEFINITIVE_CARE_START') d USING (case_id);

COMMENT ON VIEW research.case_intervals IS
  'Coordination intervals in minutes, NULL wherever either endpoint is day-resolution. Against the 2018-2020 baseline every interval is NULL by construction — that is Paper 1''s result, expressed as a query rather than as prose.';

-- research.case_events is gated by the SD-001 allowlist; the view inherits
-- that gating through the underlying table, so grant matches the table.
GRANT SELECT ON research.case_intervals TO authenticated;
