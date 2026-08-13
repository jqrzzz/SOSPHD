-- ═══════════════════════════════════════════════════════════════════════
-- 013 — Real storage for research uploads
-- Applied live 2026-08-13 (MCP migration `research_uploads_bucket`).
--
-- research.uploads has always stored metadata with url = '#' — no file
-- ever uploaded. This creates a PRIVATE bucket `research-uploads` with
-- owner-folder RLS (path convention: {auth.uid()}/{uuid}-{filename}),
-- mirroring the ecosystem's existing bucket patterns (322_case_documents,
-- 307_persona_avatars). Files are served via short-lived signed URLs
-- created client-side; the bucket is never public — recordings and
-- research documents may involve third parties.
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
VALUES ('research-uploads', 'research-uploads', false)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "research_uploads_owner_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'research-uploads'
      AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "research_uploads_owner_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'research-uploads'
      AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "research_uploads_owner_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'research-uploads'
      AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
