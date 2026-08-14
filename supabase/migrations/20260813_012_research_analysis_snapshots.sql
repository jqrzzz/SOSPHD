-- ═══════════════════════════════════════════════════════════════════════
-- 012 — Frozen analysis snapshots
-- Applied live 2026-08-13 (MCP migration `research_analysis_snapshots`).
--
-- Papers cite a named, frozen dataset — not a live dashboard that
-- recomputes differently every day. A snapshot row captures the full
-- analysis batch (summary, per-case metric rows, missingness report,
-- intervention classifications) as of one moment, labeled, so a methods
-- section can say "analysis dataset snapshot-2026-09-01" and mean
-- something immutable.
--
-- Append-only by construction: RLS grants SELECT + INSERT to allowlisted
-- users and defines no UPDATE/DELETE policy; table grants drop UPDATE/
-- DELETE too. A frozen dataset that can be edited is not frozen.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS research.analysis_snapshots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid NOT NULL,
  label       text NOT NULL,
  note        text,
  payload     jsonb NOT NULL,
  case_count  integer NOT NULL,
  event_count integer NOT NULL,
  rec_count   integer NOT NULL
);

CREATE INDEX IF NOT EXISTS analysis_snapshots_created_at_idx
  ON research.analysis_snapshots (created_at DESC);

ALTER TABLE research.analysis_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Allowed users read snapshots" ON research.analysis_snapshots
    FOR SELECT USING (research.is_allowed_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allowed users insert snapshots" ON research.analysis_snapshots
    FOR INSERT WITH CHECK (research.is_allowed_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Explicit grants per the 009 convention (do not rely on default
-- privileges), shaped append-only.
GRANT SELECT, INSERT ON research.analysis_snapshots TO authenticated;
REVOKE UPDATE, DELETE ON research.analysis_snapshots FROM authenticated;

COMMENT ON TABLE research.analysis_snapshots IS
  'Frozen, citable analysis datasets (append-only). payload = { summary, rows, missingness, interventions, generated_at } as computed by lib/data/snapshots.ts.';
