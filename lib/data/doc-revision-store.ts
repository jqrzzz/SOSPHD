import "server-only";
import { createHash } from "node:crypto";
import { requireAuthOrThrow } from "@/lib/supabase/server-auth";
import { requireResearchUser } from "@/lib/auth/research-user";
import { RevisionError } from "@/lib/docs/section-revision";
import type { RevisionStore } from "@/lib/docs/revision-service";

export const hashRevision = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

/** Real owner-scoped reads only: this workflow must never revise seed/fallback data. */
export async function getRevisionStore(): Promise<{ store: RevisionStore; owner: string }> {
  const allowed = await requireResearchUser();
  const { supabase, userId } = await requireAuthOrThrow();
  if (allowed.id !== userId) throw new RevisionError("unavailable", "Research authorization could not be confirmed.");
  const db = supabase.schema("research");
  const unavailable = () => new RevisionError("unavailable", "The research database is unavailable. No source document was changed.");
  const store: RevisionStore = {
    async readDoc(id) {
      const { data, error } = await db.from("docs")
        .select("id,user_id,title,content_md,updated_at,folder,tags,status,linked_case_id")
        .eq("id", id).eq("user_id", userId).maybeSingle();
      if (error) throw unavailable();
      return data;
    },
    async readAnnotations(id) {
      const { data, error } = await db.from("doc_annotations")
        .select("id,quote,comment,resolved").eq("doc_id", id).eq("user_id", userId)
        .eq("resolved", false).order("id").limit(201);
      // Fail closed instead of silently omitting review notes beyond the bounded view.
      if (error || !data || data.length > 200) throw unavailable();
      return data;
    },
    async readVersion(id) {
      const { data, error } = await db.from("doc_versions")
        .select("id,doc_id,user_id,content_md,note").eq("id", id).eq("user_id", userId).maybeSingle();
      if (error) throw unavailable();
      return data;
    },
    async insertVersion(row) {
      if (row.user_id !== userId) throw unavailable();
      const { error } = await db.from("doc_versions").insert(row);
      if (error) throw unavailable();
    },
    async insertDoc(row) {
      if (row.user_id !== userId) throw unavailable();
      const { error } = await db.from("docs").insert(row);
      if (error) throw unavailable();
    },
  };
  return { store, owner: userId };
}
