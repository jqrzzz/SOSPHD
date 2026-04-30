-- ═══════════════════════════════════════════════════════════════════════
-- SOSPHD Research Schema (DEPLOYED to jnbxkvlkqmwnqlmetknj)
-- Lives alongside public (operational) tables. References public.cases.
-- All research-specific types & tables are namespaced under "research".
-- ═══════════════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS research;

-- ── Enums ───────────────────────────────────────────────────────────────
CREATE TYPE research.event_type AS ENUM (
  'FIRST_CONTACT','TRIAGE_COMPLETE','TRANSPORT_ACTIVATED',
  'FACILITY_ARRIVAL','GUARANTEED_PAYMENT','DEFINITIVE_CARE_START',
  'DISCHARGE','NOTE'
);
CREATE TYPE research.engine_type AS ENUM ('rule_based', 'ml_model', 'llm');
CREATE TYPE research.confidence_type AS ENUM ('probability', 'categorical');
CREATE TYPE research.doc_status AS ENUM ('draft', 'active', 'archived');
CREATE TYPE research.research_task_status AS ENUM ('todo', 'doing', 'done');
CREATE TYPE research.upload_category AS ENUM ('transcript', 'pdf', 'image', 'video', 'document', 'other');
CREATE TYPE research.advisor_role AS ENUM ('user', 'assistant', 'system');

-- ── Tables ──────────────────────────────────────────────────────────────
-- case_events, recommendations, docs, doc_versions, notes, tasks,
-- advisor_sessions, advisor_messages, uploads, mind_maps
-- (see full DDL in apply_migration history)

-- ── RLS enabled on all tables ───────────────────────────────────────────
-- ── Grants: authenticated gets ALL, anon gets SELECT ────────────────────
