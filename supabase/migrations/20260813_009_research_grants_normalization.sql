-- ═══════════════════════════════════════════════════════════════════════
-- 009 — Research grants normalization
-- Applied live 2026-08-13 (MCP migration `research_grants_normalization`).
--
-- Verified against the live project before applying:
--   1. Migrations 007/008 created journal_entries, contacts, protocols and
--      cases but never granted them to `authenticated` (the schema-level
--      ALTER DEFAULT PRIVILEGES from migration 004 did not apply to them).
--      Every fieldwork query had failed at the grant layer since May; the
--      app's seed-data fallback masked it.
--   2. Migration 004's GRANT ALL gave `authenticated` TRUNCATE on every
--      research table. TRUNCATE is NOT governed by RLS — any authenticated
--      user in the shared six-app project could wipe research tables in
--      one statement. The app needs only SELECT/INSERT/UPDATE/DELETE.
--   3. `anon` held SELECT on the 10 older research tables. Nothing reads
--      research anonymously; RLS blocks rows but the grant was a standing
--      footgun for any future table that misses ENABLE ROW LEVEL SECURITY.
--
-- research.allowed_users keeps zero app-facing grants (SD-001: service
-- role + SECURITY DEFINER only). Schema USAGE for anon is left in place —
-- USAGE alone exposes nothing without table grants, and revoking it in a
-- shared six-app database is a wider blast radius than this fix needs.
--
-- Convention going forward: every new research.* table gets its GRANTs
-- stated explicitly in its own migration. Do not rely on default
-- privileges — that reliance is exactly what caused (1).
-- ═══════════════════════════════════════════════════════════════════════

-- 1) The grants migrations 007/008 should have issued.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON research.journal_entries, research.contacts, research.protocols, research.cases
  TO authenticated;

-- 2) Remove the RLS-exempt table-wipe primitive and unused DDL-ish privileges.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA research FROM authenticated;

-- 3) anon needs nothing in research.
REVOKE ALL ON ALL TABLES IN SCHEMA research FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA research REVOKE SELECT ON TABLES FROM anon;

-- 4) Future tables default to the app-shaped grant, not ALL.
ALTER DEFAULT PRIVILEGES IN SCHEMA research REVOKE ALL ON TABLES FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA research GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
