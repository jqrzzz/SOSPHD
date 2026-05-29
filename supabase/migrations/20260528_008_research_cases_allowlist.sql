-- ═══════════════════════════════════════════════════════════════════════
-- Track A · Phase 9 — Backfill foundations
--
--   1. research.allowed_users + research.is_allowed_user()  (SD-001 Opt B)
--      Resolves the cross-project RLS exposure: research.* was readable by
--      ANY authenticated user in the shared Supabase project. Now gated to
--      an explicit allowlist, seeded with the owner.
--
--   2. research.cases — SOSPHD-owned case dimension. The backfill (843
--      historical cases) and any research-native case lands here, NOT in
--      public.cases (which is SOSCOMMAND-owned, requires a NOT NULL
--      patient_id FK to public.patients, and would force research PHI into
--      the operational DB). See docs/backfill-plan.md.
--
--   3. Ingestion provenance on research.case_events (inserted_at,
--      ingest_batch_id) so backfilled rows are auditable and
--      distinguishable from live trigger rows.
--
--   4. Tighten case_events / recommendations RLS from USING(true) to the
--      allowlist. Trigger sync path is unaffected — research.upsert_case_event
--      is SECURITY DEFINER and bypasses RLS.
--
-- All statements idempotent (IF NOT EXISTS / DROP+CREATE / DO-EXCEPTION).
-- Owner is seeded BEFORE policies flip, so there is never a lockout window.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Allowlist ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS research.allowed_users (
  user_id  uuid PRIMARY KEY,
  note     text,
  added_at timestamptz NOT NULL DEFAULT now()
);

-- Seed the owner FIRST so the policy flip below can't lock anyone out.
INSERT INTO research.allowed_users (user_id, note)
VALUES ('bb8a6e83-5f37-4e3d-9250-b96a6f4b3855', 'Owner — juanquirozjr@gmail.com')
ON CONFLICT (user_id) DO NOTHING;

-- Lock the allowlist itself down: RLS on, no app-facing policy. Only the
-- service role (migrations) and SECURITY DEFINER functions touch it.
ALTER TABLE research.allowed_users ENABLE ROW LEVEL SECURITY;

-- Membership check. SECURITY DEFINER + empty search_path so it bypasses
-- RLS on allowed_users (no policy recursion) and isn't search_path-hijackable.
-- (SELECT auth.uid()) is the Supabase-recommended cached form.
CREATE OR REPLACE FUNCTION research.is_allowed_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM research.allowed_users
    WHERE user_id = (SELECT auth.uid())
  );
$$;

-- ── 2. research.cases dimension ──────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE research.case_source AS ENUM ('backfill_2018_2023', 'prospective');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS research.cases (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source           research.case_source NOT NULL,
  external_ref     text,                       -- spreadsheet row id (audit trail)
  patient_ref      text NOT NULL,              -- pseudonym; NEVER raw PHI
  status           text NOT NULL DEFAULT 'closed'
                     CHECK (status IN ('open', 'active', 'closed')),
  severity         smallint CHECK (severity BETWEEN 1 AND 4),
  corridor         text,
  payer_entity     text,                       -- normalized insurer (448 strings -> ~30)
  diagnosis_bucket text,                       -- coarse diagnosis category
  country          text,
  incident_summary text,                       -- de-identified free text
  intake_date      timestamptz,
  closed_date      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  ingested_at      timestamptz NOT NULL DEFAULT now(),
  ingest_batch_id  uuid
);

CREATE INDEX IF NOT EXISTS cases_source_idx       ON research.cases (source);
CREATE INDEX IF NOT EXISTS cases_ingest_batch_idx ON research.cases (ingest_batch_id);
CREATE INDEX IF NOT EXISTS cases_created_at_idx   ON research.cases (created_at DESC);

ALTER TABLE research.cases ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Allowed users manage research cases" ON research.cases
    FOR ALL
    USING (research.is_allowed_user())
    WITH CHECK (research.is_allowed_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 3. Ingestion provenance on case_events ───────────────────────────────
ALTER TABLE research.case_events
  ADD COLUMN IF NOT EXISTS inserted_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE research.case_events
  ADD COLUMN IF NOT EXISTS ingest_batch_id uuid;

CREATE INDEX IF NOT EXISTS case_events_ingest_batch_idx
  ON research.case_events (ingest_batch_id);

COMMENT ON COLUMN research.case_events.inserted_at IS
  'When this row entered the research DB (vs occurred_at = when the event happened). Distinguishes backfilled rows from live trigger rows.';
COMMENT ON COLUMN research.case_events.ingest_batch_id IS
  'Non-null for rows written by a backfill batch (research.cases.ingest_batch_id). Null for live trigger / app rows.';

-- ── 4. SD-001: tighten case_events / recommendations RLS to the allowlist ─
-- Trigger sync (research.upsert_case_event, SECURITY DEFINER) bypasses RLS,
-- so the operational -> research materialization is unaffected.
DROP POLICY IF EXISTS "Authenticated read case_events"   ON research.case_events;
DROP POLICY IF EXISTS "Authenticated insert case_events" ON research.case_events;
CREATE POLICY "Allowed users read case_events" ON research.case_events
  FOR SELECT USING (research.is_allowed_user());
CREATE POLICY "Allowed users insert case_events" ON research.case_events
  FOR INSERT WITH CHECK (research.is_allowed_user());

DROP POLICY IF EXISTS "Authenticated read recs"   ON research.recommendations;
DROP POLICY IF EXISTS "Authenticated insert recs" ON research.recommendations;
DROP POLICY IF EXISTS "Authenticated update recs" ON research.recommendations;
CREATE POLICY "Allowed users read recs" ON research.recommendations
  FOR SELECT USING (research.is_allowed_user());
CREATE POLICY "Allowed users insert recs" ON research.recommendations
  FOR INSERT WITH CHECK (research.is_allowed_user());
CREATE POLICY "Allowed users update recs" ON research.recommendations
  FOR UPDATE USING (research.is_allowed_user());

COMMENT ON TABLE research.cases IS
  'SOSPHD-owned research case dimension. Holds the de-identified research projection of historical (backfill) and prospective cases. Pairs with public.cases (operational) via the unified read layer in lib/data/store.ts:getCases.';
COMMENT ON TABLE research.allowed_users IS
  'SD-001 allowlist. Membership grants read/write to research.{cases,case_events,recommendations}. Managed via service role; no app-facing RLS policy.';
