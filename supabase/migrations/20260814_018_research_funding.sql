-- ─── 018: funding module ───────────────────────────────────────────────
-- Grants, fellowships, government schemes, foundations, and major donors.
--
-- The eligibility_category column is the point of this table. Most research
-- funding requires an academic host institution and an enrolled or employed
-- principal investigator. Pre-acceptance, the owner has neither — so an
-- opportunity list that does not separate "can apply today" from "only after
-- a PhD place" is worse than useless, because it hides the few that are
-- actually actionable now:
--   a_open_now          — open to independent researchers / individuals today
--   c_company_eligible  — Tourist SOS can apply as an organisation
--   b_needs_affiliation — only becomes available after a PhD place
--
-- Same provenance discipline as admissions (migration 017): source_url on
-- every row, verified_at only when the funder's own page was read for the
-- current cycle.

CREATE TYPE research.funding_stage AS ENUM (
  'identified',
  'assessing',
  'preparing',
  'submitted',
  'awarded',
  'declined',
  'not_eligible',
  'passed'
);

CREATE TABLE IF NOT EXISTS research.funding_opportunities (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  user_id               uuid NOT NULL,
  name                  text NOT NULL,
  funder                text NOT NULL,
  -- grant | fellowship | scholarship | government | foundation | prize | donor | industry
  kind                  text NOT NULL DEFAULT 'grant',
  geography             text,
  amount_note           text,
  deadline_note         text,
  next_deadline         date,
  eligibility_note      text,
  eligibility_category  text NOT NULL DEFAULT 'b_needs_affiliation',
  relevance             text,
  stage                 research.funding_stage NOT NULL DEFAULT 'identified',
  fit_score             integer CHECK (fit_score BETWEEN 1 AND 5),
  confidence            text NOT NULL DEFAULT 'medium',
  caveats               text,
  notes                 text NOT NULL DEFAULT '',
  source_url            text,
  verified_at           timestamptz
);

CREATE INDEX IF NOT EXISTS funding_opportunities_user_idx
  ON research.funding_opportunities (user_id, eligibility_category, next_deadline);

-- Outreach already models "a drafted message to a named person, reviewed and
-- sent by the owner". Donor and programme-officer approaches are the same
-- shape, so extend it rather than duplicating the table.
ALTER TABLE research.outreach
  ADD COLUMN IF NOT EXISTS opportunity_id uuid
  REFERENCES research.funding_opportunities(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS outreach_opportunity_idx
  ON research.outreach (opportunity_id, status);

ALTER TABLE research.funding_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY funding_opportunities_all ON research.funding_opportunities
  FOR ALL TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON research.funding_opportunities TO authenticated;
