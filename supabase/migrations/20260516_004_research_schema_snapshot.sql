-- ═══════════════════════════════════════════════════════════════════════
-- SOSPHD Research Schema — Authoritative Snapshot
--
-- Documents the live state of the `research` schema on the shared
-- Supabase project (jnbxkvlkqmwnqlmetknj) as of 2026-05-16.
--
-- The previous migration file (20260402_002_create_research_schema.sql)
-- was a placeholder that only declared the schema; the actual DDL was
-- applied incrementally via the Supabase MCP and never round-tripped
-- back into the repo. This file restores the bootstrap-from-zero
-- contract — a fresh project applying migrations in order ends up with
-- the same schema the live project has.
--
-- All statements are IF NOT EXISTS / OR REPLACE / CREATE POLICY guarded
-- so it's safe to re-apply against an existing project.
-- ═══════════════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS research;

-- ── Enums ───────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE research.event_type AS ENUM (
    'FIRST_CONTACT','TRIAGE_COMPLETE','TRANSPORT_ACTIVATED',
    'FACILITY_ARRIVAL','GUARANTEED_PAYMENT','DEFINITIVE_CARE_START',
    'DISCHARGE','NOTE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE research.engine_type AS ENUM ('rule_based', 'ml_model', 'llm');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE research.confidence_type AS ENUM ('probability', 'categorical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE research.doc_status AS ENUM ('draft', 'active', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE research.research_task_status AS ENUM ('todo', 'doing', 'done');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE research.upload_category AS ENUM (
    'transcript', 'pdf', 'image', 'video', 'document', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE research.advisor_role AS ENUM ('user', 'assistant', 'system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Tables ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS research.case_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     uuid NOT NULL,
  occurred_at timestamptz NOT NULL,
  event_type  research.event_type NOT NULL,
  actor_id    text NOT NULL,
  payload     text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS research.recommendations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id          uuid NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  engine_type      research.engine_type NOT NULL,
  engine_version   text NOT NULL,
  confidence_type  research.confidence_type NOT NULL,
  confidence_value double precision NOT NULL,
  recommendation   text NOT NULL,
  explanation      text NOT NULL,
  accepted         boolean,
  override_reason  text
);

CREATE TABLE IF NOT EXISTS research.docs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  user_id         uuid NOT NULL,
  title           text NOT NULL,
  slug            text,
  folder          text NOT NULL DEFAULT 'General',
  tags            text[] NOT NULL DEFAULT '{}',
  content_md      text NOT NULL DEFAULT '',
  status          research.doc_status NOT NULL DEFAULT 'draft',
  linked_case_id  uuid
);

CREATE TABLE IF NOT EXISTS research.doc_versions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  doc_id      uuid NOT NULL REFERENCES research.docs(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  content_md  text NOT NULL,
  note        text
);

CREATE TABLE IF NOT EXISTS research.notes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  user_id         uuid NOT NULL,
  title           text,
  content         text NOT NULL,
  tags            text[] NOT NULL DEFAULT '{}',
  linked_case_id  uuid
);

CREATE TABLE IF NOT EXISTS research.tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  user_id         uuid NOT NULL,
  status          research.research_task_status NOT NULL DEFAULT 'todo',
  priority        integer NOT NULL DEFAULT 2,
  due_date        date,
  title           text NOT NULL,
  description     text,
  linked_case_id  uuid
);

CREATE TABLE IF NOT EXISTS research.mind_maps (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  user_id     uuid NOT NULL,
  title       text NOT NULL,
  nodes       jsonb NOT NULL DEFAULT '[]',
  edges       jsonb NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS research.uploads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  user_id         uuid NOT NULL,
  filename        text NOT NULL,
  mime_type       text NOT NULL,
  size_bytes      bigint NOT NULL,
  category        research.upload_category NOT NULL DEFAULT 'other',
  url             text NOT NULL,
  tags            text[] NOT NULL DEFAULT '{}',
  notes           text NOT NULL DEFAULT '',
  linked_case_id  uuid,
  linked_doc_id   uuid REFERENCES research.docs(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS research.advisor_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  user_id     uuid NOT NULL,
  title       text NOT NULL
);

CREATE TABLE IF NOT EXISTS research.advisor_messages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  session_id        uuid NOT NULL REFERENCES research.advisor_sessions(id) ON DELETE CASCADE,
  role              research.advisor_role NOT NULL,
  content           text NOT NULL,
  context_snapshot  jsonb
);

-- ── Indexes for the hot read paths ──────────────────────────────────────

CREATE INDEX IF NOT EXISTS case_events_case_id_occurred_at_idx
  ON research.case_events (case_id, occurred_at);
CREATE INDEX IF NOT EXISTS recommendations_case_id_created_at_idx
  ON research.recommendations (case_id, created_at);
CREATE INDEX IF NOT EXISTS docs_user_id_idx ON research.docs (user_id);
CREATE INDEX IF NOT EXISTS notes_user_id_idx ON research.notes (user_id);
CREATE INDEX IF NOT EXISTS tasks_user_id_status_idx ON research.tasks (user_id, status);
CREATE INDEX IF NOT EXISTS uploads_user_id_idx ON research.uploads (user_id);
CREATE INDEX IF NOT EXISTS advisor_sessions_user_id_idx
  ON research.advisor_sessions (user_id);
CREATE INDEX IF NOT EXISTS advisor_messages_session_id_created_at_idx
  ON research.advisor_messages (session_id, created_at);

-- ── RLS ─────────────────────────────────────────────────────────────────

ALTER TABLE research.case_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE research.recommendations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE research.docs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE research.doc_versions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE research.notes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE research.tasks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE research.mind_maps         ENABLE ROW LEVEL SECURITY;
ALTER TABLE research.uploads           ENABLE ROW LEVEL SECURITY;
ALTER TABLE research.advisor_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE research.advisor_messages  ENABLE ROW LEVEL SECURITY;

-- case_events + recommendations are research-wide (any authenticated user
-- in the SOSPHD project may read/write); the rest are user-scoped to auth.uid().

DO $$ BEGIN
  CREATE POLICY "Authenticated read case_events" ON research.case_events
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated insert case_events" ON research.case_events
    FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated read recs" ON research.recommendations
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated insert recs" ON research.recommendations
    FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated update recs" ON research.recommendations
    FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owner manages docs" ON research.docs
    FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owner manages versions" ON research.doc_versions
    FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owner manages notes" ON research.notes
    FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owner manages tasks" ON research.tasks
    FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owner manages maps" ON research.mind_maps
    FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owner manages uploads" ON research.uploads
    FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owner manages sessions" ON research.advisor_sessions
    FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owner manages messages" ON research.advisor_messages
    FOR ALL USING (
      session_id IN (
        SELECT id FROM research.advisor_sessions
        WHERE user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Grants ──────────────────────────────────────────────────────────────

GRANT USAGE ON SCHEMA research TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA research TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA research TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA research
  GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA research
  GRANT SELECT ON TABLES TO anon;
