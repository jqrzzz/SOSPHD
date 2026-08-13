-- ═══════════════════════════════════════════════════════════════════════
-- 011 — Consent capture on fieldwork records
-- Applied live 2026-08-13 (MCP migration `research_consent_fields`).
--
-- Recordings and field notes involving other people (providers, fixers,
-- clients) are only usable as RESEARCH data when collected with informed
-- consent under a jurisdiction's rules — and consent cannot be granted
-- retroactively. These columns make consent a first-class property of
-- journal entries and uploads, so every record states whether it may
-- enter a paper. Vocabulary aligns with SOSPRO's scribe consent pattern
-- (consent_method / consent_captured_at); consent_jurisdiction is the
-- ISO country code whose rules applied at capture time (multi-market
-- expansion means this varies per record, not per deployment).
--
-- consent_status semantics:
--   not_required — self-authored material, no third party involved
--   pending      — third party involved, consent not yet captured
--   obtained     — consent captured (method + timestamp should be set)
--   declined     — consent refused; record is operational context only
--                  and MUST be excluded from research outputs
-- ═══════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE research.consent_status AS ENUM
    ('not_required', 'pending', 'obtained', 'declined');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE research.journal_entries
  ADD COLUMN IF NOT EXISTS consent_status research.consent_status NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS consent_method text,
  ADD COLUMN IF NOT EXISTS consent_jurisdiction text,
  ADD COLUMN IF NOT EXISTS consent_captured_at timestamptz;

ALTER TABLE research.uploads
  ADD COLUMN IF NOT EXISTS consent_status research.consent_status NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS consent_method text,
  ADD COLUMN IF NOT EXISTS consent_jurisdiction text,
  ADD COLUMN IF NOT EXISTS consent_captured_at timestamptz;

COMMENT ON COLUMN research.journal_entries.consent_status IS
  'Research-usability gate. Records involving third parties need obtained consent to appear in research outputs; declined records are operational context only.';
COMMENT ON COLUMN research.uploads.consent_status IS
  'Research-usability gate for the underlying file (recordings especially). Consent cannot be captured retroactively.';
