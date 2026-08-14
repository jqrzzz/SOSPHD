-- ─── 017: admissions module ────────────────────────────────────────────
-- The bureaucratic half of the PhD: which institutions, what each one
-- demands, when it is due, and every conversation with a prospective
-- supervisor.
--
-- MEASUREMENT DISCIPLINE (same rule as the [REF:] placeholders in the
-- papers): every requirement and deadline carries source_url and
-- verified_at. A NULL verified_at means "not confirmed against the
-- official page" and the UI marks it unverified. Admissions details
-- change every cycle; an invented deadline costs a whole year.

CREATE TYPE research.application_stage AS ENUM (
  'researching',
  'shortlisted',
  'contacting',
  'preparing',
  'submitted',
  'interview',
  'offer',
  'rejected',
  'withdrawn'
);

CREATE TABLE IF NOT EXISTS research.institutions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  user_id              uuid NOT NULL,
  name                 text NOT NULL,
  school               text,
  programme            text NOT NULL,
  country              text NOT NULL,
  city                 text,
  -- {full_time, part_time, by_publication, external}
  formats              text[] NOT NULL DEFAULT '{}',
  funding_model        text,
  -- Singapore programmes generally require an agreed supervisor BEFORE
  -- the application is submitted — that inverts the whole timeline.
  supervisor_required  boolean NOT NULL DEFAULT false,
  stage                research.application_stage NOT NULL DEFAULT 'researching',
  fit_score            integer CHECK (fit_score BETWEEN 1 AND 5),
  fit_rationale        text,
  next_deadline        date,
  next_deadline_label  text,
  homepage_url         text,
  notes                text NOT NULL DEFAULT '',
  source_url           text,
  verified_at          timestamptz
);

CREATE TABLE IF NOT EXISTS research.institution_requirements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  user_id         uuid NOT NULL,
  institution_id  uuid NOT NULL REFERENCES research.institutions(id) ON DELETE CASCADE,
  -- deadline | test | document | reference | process | fee
  kind            text NOT NULL DEFAULT 'document',
  label           text NOT NULL,
  detail          text,
  due_date        date,
  mandatory       boolean NOT NULL DEFAULT true,
  -- not_started | in_progress | done | waived | not_applicable
  status          text NOT NULL DEFAULT 'not_started',
  source_url      text,
  verified_at     timestamptz
);

CREATE TABLE IF NOT EXISTS research.outreach (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  user_id         uuid NOT NULL,
  institution_id  uuid REFERENCES research.institutions(id) ON DELETE CASCADE,
  contact_id      uuid,
  person_name     text NOT NULL,
  person_role     text,
  channel         text NOT NULL DEFAULT 'email',
  direction       text NOT NULL DEFAULT 'outbound',
  subject         text,
  body            text NOT NULL DEFAULT '',
  -- draft | sent | replied | no_reply | closed
  status          text NOT NULL DEFAULT 'draft',
  sent_at         timestamptz,
  follow_up_at    date
);

CREATE INDEX IF NOT EXISTS institutions_deadline_idx
  ON research.institutions (user_id, next_deadline);
CREATE INDEX IF NOT EXISTS institution_requirements_inst_idx
  ON research.institution_requirements (institution_id, status);
CREATE INDEX IF NOT EXISTS outreach_inst_idx
  ON research.outreach (institution_id, status, follow_up_at);

ALTER TABLE research.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE research.institution_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE research.outreach ENABLE ROW LEVEL SECURITY;

CREATE POLICY institutions_all ON research.institutions
  FOR ALL TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY institution_requirements_all ON research.institution_requirements
  FOR ALL TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY outreach_all ON research.outreach
  FOR ALL TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- App-shaped grants (migration 009 normalization: no TRUNCATE, no anon).
GRANT SELECT, INSERT, UPDATE, DELETE ON research.institutions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON research.institution_requirements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON research.outreach TO authenticated;
