-- ─── 019: link people to the things you're applying to ────────────────
-- research.contacts already models the research network (doctors, fixers,
-- academics). Prospective supervisors and funder programme officers are
-- the same shape, so this extends that table rather than adding another.
--
-- email_source_url / email_verified_at exist for one reason: an email
-- address that was pattern-guessed rather than observed is worse than no
-- address at all. It either bounces or reaches a stranger, and a wrong
-- first contact with a prospective supervisor cannot be undone. An
-- address without a source URL is treated as unverified in the UI.

ALTER TABLE research.contacts
  ADD COLUMN IF NOT EXISTS institution_id uuid
    REFERENCES research.institutions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS opportunity_id uuid
    REFERENCES research.funding_opportunities(id) ON DELETE SET NULL,
  -- Structured rather than buried in notes, because these two fields are
  -- what a tailored outreach email is actually built from.
  ADD COLUMN IF NOT EXISTS research_focus text,
  ADD COLUMN IF NOT EXISTS recent_work text,
  ADD COLUMN IF NOT EXISTS profile_url text,
  ADD COLUMN IF NOT EXISTS email_source_url text,
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
  -- first_wave | second_wave | background
  ADD COLUMN IF NOT EXISTS outreach_priority text;

CREATE INDEX IF NOT EXISTS contacts_institution_idx
  ON research.contacts (institution_id) WHERE institution_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS contacts_opportunity_idx
  ON research.contacts (opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS contacts_priority_idx
  ON research.contacts (user_id, outreach_priority)
  WHERE outreach_priority IS NOT NULL;

-- Let an outreach draft point at the person it is addressed to, so the
-- draft, the person, and the target all hang together.
ALTER TABLE research.outreach
  ADD COLUMN IF NOT EXISTS contact_ref uuid
    REFERENCES research.contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS outreach_contact_ref_idx
  ON research.outreach (contact_ref) WHERE contact_ref IS NOT NULL;
