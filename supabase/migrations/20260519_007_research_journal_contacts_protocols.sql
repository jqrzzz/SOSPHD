-- ─────────────────────────────────────────────────────────────────────
-- Track A · Phase 2 — Add journal_entries, contacts, protocols to research
--
-- Per audit-action-plan Decision A: migrate code from public.phd_* to
-- research.*. The other 8 phd_* tables overlap with already-live
-- research.* tables (docs, doc_versions, notes, tasks, mind_maps,
-- uploads, advisor_sessions, advisor_messages). These three don't —
-- they live only in the never-applied migration 001. This migration
-- creates the research.* equivalents.
--
-- Differences from the old phd_* shape:
--   - phd_notes.site_id and phd_tasks.site_id were dangling references
--     to a phantom `sites` table. The new research.* equivalents do not
--     include site_id at all. journal_entries and contacts here follow
--     the same rule — no site_id.
--   - phd_notes had `site_id TEXT`. Type was lossy. Removed.
--   - Enum types are used (research.journal_entry_type,
--     research.contact_role, research.protocol_status) instead of
--     plain text + CHECK constraints. Matches the rest of the
--     research schema's convention from migration 002.
--
-- All idempotent (DO blocks, IF NOT EXISTS, EXCEPTION-guarded).
-- ─────────────────────────────────────────────────────────────────────

-- ── Enums ────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE research.journal_entry_type AS ENUM (
    'observation','conversation','interview','site_visit','event','idea','media'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE research.contact_role AS ENUM (
    'doctor','nurse','hospital_admin','insurance','embassy','transport',
    'government','academic','ngo','fixer','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE research.protocol_status AS ENUM (
    'template','in_progress','completed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Tables ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS research.journal_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  user_id         uuid NOT NULL,
  entry_type      research.journal_entry_type NOT NULL,
  title           text NOT NULL,
  content         text NOT NULL,
  location        text,
  corridor        text,
  tags            text[] NOT NULL DEFAULT '{}',
  contact_ids     uuid[] NOT NULL DEFAULT '{}',
  linked_case_id  uuid,
  attachments     jsonb NOT NULL DEFAULT '[]',
  is_pinned       boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS research.contacts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  user_id             uuid NOT NULL,
  name                text NOT NULL,
  role                research.contact_role NOT NULL,
  organization        text,
  title               text,
  email               text,
  phone               text,
  whatsapp            text,
  location            text,
  corridor            text,
  tags                text[] NOT NULL DEFAULT '{}',
  notes               text NOT NULL DEFAULT '',
  linked_journal_ids  uuid[] NOT NULL DEFAULT '{}',
  business_card_url   text
);

CREATE TABLE IF NOT EXISTS research.protocols (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  user_id             uuid NOT NULL,
  template_id         uuid,
  status              research.protocol_status NOT NULL DEFAULT 'template',
  title               text NOT NULL,
  description         text NOT NULL DEFAULT '',
  sections            jsonb NOT NULL DEFAULT '[]',
  location            text,
  corridor            text,
  linked_journal_id   uuid,
  linked_contact_ids  uuid[] NOT NULL DEFAULT '{}'
);

-- ── Indexes ──────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS journal_entries_user_id_idx
  ON research.journal_entries (user_id);
CREATE INDEX IF NOT EXISTS journal_entries_created_at_idx
  ON research.journal_entries (created_at DESC);
CREATE INDEX IF NOT EXISTS contacts_user_id_idx
  ON research.contacts (user_id);
CREATE INDEX IF NOT EXISTS contacts_role_idx
  ON research.contacts (role);
CREATE INDEX IF NOT EXISTS protocols_user_id_status_idx
  ON research.protocols (user_id, status);

-- ── RLS ──────────────────────────────────────────────────────────────

ALTER TABLE research.journal_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE research.contacts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE research.protocols        ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Owner manages journal_entries" ON research.journal_entries
    FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owner manages contacts" ON research.contacts
    FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owner manages protocols" ON research.protocols
    FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Comments ─────────────────────────────────────────────────────────

COMMENT ON TABLE research.journal_entries IS
  'Track A Phase 2: fieldwork journal. Replaces never-applied public.phd_journal_entries.';
COMMENT ON TABLE research.contacts IS
  'Track A Phase 2: research network CRM. Replaces never-applied public.phd_contacts.';
COMMENT ON TABLE research.protocols IS
  'Track A Phase 2: field-visit checklists. Replaces never-applied public.phd_protocols.';
