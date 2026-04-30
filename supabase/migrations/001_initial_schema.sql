-- ============================================================
-- SOS PHD — Initial Schema Migration
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
--
-- This creates all tables needed by the SOSPHD research app.
-- It uses the SHARED Supabase instance (jnbxkvlkqmwnqlmetknj)
-- alongside SOSWEBSITE, SOSTRAVEL, SOSCOMMAND, SOSPRO, SOSSAFE.
--
-- All tables are prefixed with `phd_` to avoid collisions with
-- other projects sharing this database.
-- ============================================================

-- ── Enable RLS on all tables ────────────────────────────────────

-- Helper: get the current authenticated user's ID
-- (works with Supabase auth.uid())

-- ============================================================
-- 1. FIELD JOURNAL
-- ============================================================

CREATE TABLE IF NOT EXISTS phd_journal_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_type    TEXT NOT NULL CHECK (entry_type IN ('observation','conversation','interview','site_visit','event','idea','media')),
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,
  location      TEXT,
  corridor      TEXT,
  tags          TEXT[] DEFAULT '{}',
  contact_ids   UUID[] DEFAULT '{}',
  linked_case_id UUID,
  attachments   JSONB DEFAULT '[]',
  is_pinned     BOOLEAN DEFAULT FALSE
);

ALTER TABLE phd_journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own journal entries"
  ON phd_journal_entries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_journal_user ON phd_journal_entries(user_id);
CREATE INDEX idx_journal_type ON phd_journal_entries(entry_type);
CREATE INDEX idx_journal_created ON phd_journal_entries(created_at DESC);

-- ============================================================
-- 2. CONTACTS (Research Network)
-- ============================================================

CREATE TABLE IF NOT EXISTS phd_contacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('doctor','nurse','hospital_admin','insurance','embassy','transport','government','academic','ngo','fixer','other')),
  organization    TEXT,
  title           TEXT,
  email           TEXT,
  phone           TEXT,
  whatsapp        TEXT,
  location        TEXT,
  corridor        TEXT,
  tags            TEXT[] DEFAULT '{}',
  notes           TEXT DEFAULT '',
  linked_journal_ids UUID[] DEFAULT '{}',
  business_card_url  TEXT
);

ALTER TABLE phd_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own contacts"
  ON phd_contacts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_contacts_user ON phd_contacts(user_id);
CREATE INDEX idx_contacts_role ON phd_contacts(role);

-- ============================================================
-- 3. FIELD PROTOCOLS (Checklists)
-- ============================================================

CREATE TABLE IF NOT EXISTS phd_protocols (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id       UUID,
  status            TEXT NOT NULL DEFAULT 'template' CHECK (status IN ('template','in_progress','completed')),
  title             TEXT NOT NULL,
  description       TEXT DEFAULT '',
  sections          JSONB NOT NULL DEFAULT '[]',
  location          TEXT,
  corridor          TEXT,
  linked_journal_id UUID,
  linked_contact_ids UUID[] DEFAULT '{}'
);

ALTER TABLE phd_protocols ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own protocols"
  ON phd_protocols FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 4. MIND MAPS
-- ============================================================

CREATE TABLE IF NOT EXISTS phd_mind_maps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  nodes       JSONB NOT NULL DEFAULT '[]',
  edges       JSONB NOT NULL DEFAULT '[]'
);

ALTER TABLE phd_mind_maps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own mind maps"
  ON phd_mind_maps FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 5. UPLOADS (File metadata)
-- ============================================================

CREATE TABLE IF NOT EXISTS phd_uploads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename        TEXT NOT NULL,
  mime_type       TEXT NOT NULL,
  size_bytes      BIGINT NOT NULL,
  category        TEXT NOT NULL CHECK (category IN ('transcript','pdf','image','video','document','other')),
  url             TEXT NOT NULL,
  tags            TEXT[] DEFAULT '{}',
  notes           TEXT DEFAULT '',
  linked_case_id  UUID,
  linked_doc_id   UUID
);

ALTER TABLE phd_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own uploads"
  ON phd_uploads FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 6. RESEARCH NOTES
-- ============================================================

CREATE TABLE IF NOT EXISTS phd_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_id         TEXT,
  title           TEXT,
  content         TEXT NOT NULL,
  tags            TEXT[] DEFAULT '{}',
  linked_case_id  UUID
);

ALTER TABLE phd_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own notes"
  ON phd_notes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_notes_user ON phd_notes(user_id);

-- ============================================================
-- 7. RESEARCH TASKS
-- ============================================================

CREATE TABLE IF NOT EXISTS phd_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_id         TEXT,
  status          TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','doing','done')),
  priority        INT NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  due_date        DATE,
  title           TEXT NOT NULL,
  description     TEXT,
  linked_case_id  UUID
);

ALTER TABLE phd_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own tasks"
  ON phd_tasks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_tasks_user ON phd_tasks(user_id);
CREATE INDEX idx_tasks_status ON phd_tasks(status);

-- ============================================================
-- 8. ADVISOR SESSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS phd_advisor_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'New Session'
);

ALTER TABLE phd_advisor_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own sessions"
  ON phd_advisor_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 9. ADVISOR MESSAGES
-- ============================================================

CREATE TABLE IF NOT EXISTS phd_advisor_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_id       UUID NOT NULL REFERENCES phd_advisor_sessions(id) ON DELETE CASCADE,
  role             TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content          TEXT NOT NULL,
  context_snapshot JSONB
);

ALTER TABLE phd_advisor_messages ENABLE ROW LEVEL SECURITY;
-- Messages inherit access through their session
CREATE POLICY "Users can manage messages in their sessions"
  ON phd_advisor_messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM phd_advisor_sessions s
      WHERE s.id = phd_advisor_messages.session_id
      AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM phd_advisor_sessions s
      WHERE s.id = phd_advisor_messages.session_id
      AND s.user_id = auth.uid()
    )
  );

CREATE INDEX idx_messages_session ON phd_advisor_messages(session_id);

-- ============================================================
-- 10. DOCUMENTS (Papers, Field Logs, Methods)
-- ============================================================

CREATE TABLE IF NOT EXISTS phd_docs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  slug            TEXT NOT NULL,
  folder          TEXT NOT NULL DEFAULT 'General',
  tags            TEXT[] DEFAULT '{}',
  content_md      TEXT DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  linked_case_id  UUID
);

ALTER TABLE phd_docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own docs"
  ON phd_docs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_docs_user ON phd_docs(user_id);
CREATE INDEX idx_docs_folder ON phd_docs(folder);

-- ============================================================
-- 11. DOCUMENT VERSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS phd_doc_versions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  doc_id      UUID NOT NULL REFERENCES phd_docs(id) ON DELETE CASCADE,
  content_md  TEXT NOT NULL,
  change_note TEXT DEFAULT ''
);

ALTER TABLE phd_doc_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage versions of their docs"
  ON phd_doc_versions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM phd_docs d
      WHERE d.id = phd_doc_versions.doc_id
      AND d.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM phd_docs d
      WHERE d.id = phd_doc_versions.doc_id
      AND d.user_id = auth.uid()
    )
  );

CREATE INDEX idx_doc_versions_doc ON phd_doc_versions(doc_id);

-- ============================================================
-- Done! All phd_* tables created with RLS enabled.
-- Only the authenticated user can access their own data.
-- ============================================================
