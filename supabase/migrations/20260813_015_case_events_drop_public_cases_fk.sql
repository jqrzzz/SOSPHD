-- ═══════════════════════════════════════════════════════════════════════
-- 015 — Drop research.case_events → public.cases FK
-- Applied live 2026-08-13 (MCP migration `case_events_drop_public_cases_fk`).
--
-- Discovered live during the first real backfill run: the ORIGINAL
-- create_research_schema migration (20260402151031) declared
--   FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE
-- but the repo's authoritative snapshot (20260516_004) omits it, and
-- docs/backfill-plan.md §3 asserted "no foreign key". The constraint was
-- never noticed because research.case_events had never held a
-- research-native case id until now.
--
-- It must go, for two independent reasons:
--  1. The Phase 9 design (backfill-plan Option C, the unified read
--     layer) stores events for BOTH public.cases ids and research.cases
--     ids in this table. A single-schema FK forecloses that by design.
--  2. ON DELETE CASCADE means operational pruning of public.cases would
--     silently destroy research provenance events. Research data must
--     survive operational lifecycle decisions.
--
-- Integrity after the drop: app write paths resolve case ids before
-- inserting; the backfill inserts JOIN on research.cases; analytics
-- explicitly skip orphaned events. Documented in ARCHITECTURE.md §6.1.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE research.case_events
  DROP CONSTRAINT IF EXISTS case_events_case_id_fkey;

COMMENT ON COLUMN research.case_events.case_id IS
  'Case id in public.cases (operational, trigger-synced) OR research.cases (historical/research-native). Deliberately NOT a foreign key — see migration 015.';
