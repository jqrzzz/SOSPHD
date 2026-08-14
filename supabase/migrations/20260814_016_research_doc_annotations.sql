-- ─── 016: doc annotations ──────────────────────────────────────────────
-- Margin notes on research documents — the owner reads a draft, selects a
-- passage, leaves a comment; agents read the open annotations (MCP
-- list_doc_annotations) and address them in the next version. This is the
-- revision loop for the papers: annotate → revise → new doc_version →
-- resolve.
--
-- quote is the annotated passage (verbatim substring of the doc at the
-- time of annotation; may drift as the doc is revised — annotations are
-- notes, not anchored ranges). resolved marks addressed notes; they stay
-- as history rather than being deleted.

CREATE TABLE IF NOT EXISTS research.doc_annotations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  doc_id      uuid NOT NULL REFERENCES research.docs(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  quote       text NOT NULL DEFAULT '',
  comment     text NOT NULL,
  resolved    boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS doc_annotations_doc_id_idx
  ON research.doc_annotations (doc_id, resolved, created_at DESC);

ALTER TABLE research.doc_annotations ENABLE ROW LEVEL SECURITY;

-- User-scoped, same as the other personal tables (SD-001 applies only to
-- the shared research spine; annotations are the owner's own notes).
CREATE POLICY doc_annotations_select ON research.doc_annotations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY doc_annotations_insert ON research.doc_annotations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY doc_annotations_update ON research.doc_annotations
  FOR UPDATE TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY doc_annotations_delete ON research.doc_annotations
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- App-shaped grants (matches migration 009's normalization: no TRUNCATE/
-- REFERENCES/TRIGGER, nothing for anon).
GRANT SELECT, INSERT, UPDATE, DELETE ON research.doc_annotations TO authenticated;
