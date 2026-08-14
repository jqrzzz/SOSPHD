/* ─── Docs Mutations — SERVER ONLY ─────────────────────────────────────
 *  Write paths for research.docs, research.doc_versions.
 *
 *  Lives separate from docs-store.ts (reads). All write functions
 *  use requireAuthOrThrow and throw on auth/DB failure. Server actions
 *  in lib/docs-actions.ts wrap calls in try/catch and return structured
 *  {error} envelopes.
 *
 *  Notes:
 *    - research.docs has no site_id; mapDbDoc in the read store
 *      coerces the TS field to null. createDoc therefore does not
 *      attempt to persist site_id.
 *    - research.doc_versions.user_id is NOT NULL — auth is required.
 * ────────────────────────────────────────────────────────────────────── */

import { requireAuthOrThrow } from "@/lib/supabase/server-auth";
import type { Doc, DocVersion, DocAnnotation } from "./docs-types";

// Local copy of the read store's mapping helpers (intentional duplication
// so mutations doesn't depend on the read store and stay independently
// importable from server-only contexts).

function mapDbDoc(row: Record<string, unknown>): Doc {
  return {
    ...(row as unknown as Doc),
    site_id: null,
  };
}

function mapDbVersion(row: Record<string, unknown>): DocVersion {
  return {
    id: row.id as string,
    created_at: row.created_at as string,
    doc_id: row.doc_id as string,
    user_id: row.user_id as string,
    content_md: row.content_md as string,
    note: (row.note as string | null) ?? null,
  };
}

// ── Docs ─────────────────────────────────────────────────────────────

export async function createDoc(data: {
  title: string;
  folder?: string;
  tags?: string[];
  content_md?: string;
  linked_case_id?: string | null;
}): Promise<Doc> {
  const { supabase: sb, userId } = await requireAuthOrThrow();

  const slug = data.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const { data: row, error } = await sb
    .schema("research")
    .from("docs")
    .insert({
      user_id: userId,
      title: data.title,
      slug,
      folder: data.folder ?? "General",
      tags: data.tags ?? [],
      content_md: data.content_md ?? "",
      status: "draft",
      linked_case_id: data.linked_case_id ?? null,
    })
    .select()
    .single();
  if (error || !row) {
    throw new Error(`Failed to create doc: ${error?.message}`);
  }
  return mapDbDoc(row as Record<string, unknown>);
}

export async function updateDoc(
  id: string,
  updates: Partial<
    Pick<
      Doc,
      "title" | "content_md" | "folder" | "tags" | "status" | "linked_case_id"
    >
  >,
): Promise<Doc> {
  // Defense-in-depth: RLS already enforces this, but bound the query
  // by user_id so a misconfigured policy can't let a researcher edit
  // someone else's doc by id.
  const { supabase: sb, userId } = await requireAuthOrThrow();
  const { data: row, error } = await sb
    .schema("research")
    .from("docs")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();
  if (error || !row) {
    throw new Error(`Failed to update doc: ${error?.message}`);
  }
  return mapDbDoc(row as Record<string, unknown>);
}

// ── Versions ────────────────────────────────────────────────────────

export async function createVersion(data: {
  doc_id: string;
  content_md: string;
  note?: string | null;
}): Promise<DocVersion> {
  // research.doc_versions.user_id is NOT NULL — must resolve auth.
  const { supabase: sb, userId } = await requireAuthOrThrow();
  const { data: row, error } = await sb
    .schema("research")
    .from("doc_versions")
    .insert({
      doc_id: data.doc_id,
      user_id: userId,
      content_md: data.content_md,
      note: data.note ?? "",
    })
    .select()
    .single();
  if (error || !row) {
    throw new Error(`Failed to create version: ${error?.message}`);
  }
  return mapDbVersion(row as Record<string, unknown>);
}

// ── Annotations ─────────────────────────────────────────────────────

export async function createAnnotation(data: {
  doc_id: string;
  quote?: string;
  comment: string;
}): Promise<DocAnnotation> {
  const { supabase: sb, userId } = await requireAuthOrThrow();
  const { data: row, error } = await sb
    .schema("research")
    .from("doc_annotations")
    .insert({
      doc_id: data.doc_id,
      user_id: userId,
      quote: data.quote ?? "",
      comment: data.comment,
    })
    .select()
    .single();
  if (error || !row) {
    throw new Error(`Failed to create annotation: ${error?.message}`);
  }
  return row as DocAnnotation;
}

export async function setAnnotationResolved(
  id: string,
  resolved: boolean,
): Promise<void> {
  const { supabase: sb, userId } = await requireAuthOrThrow();
  const { error } = await sb
    .schema("research")
    .from("doc_annotations")
    .update({ resolved })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) {
    throw new Error(`Failed to update annotation: ${error.message}`);
  }
}

export async function deleteAnnotation(id: string): Promise<void> {
  const { supabase: sb, userId } = await requireAuthOrThrow();
  const { error } = await sb
    .schema("research")
    .from("doc_annotations")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) {
    throw new Error(`Failed to delete annotation: ${error.message}`);
  }
}
