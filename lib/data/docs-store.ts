/* ─── Supabase-Backed Docs Store ──────────────────────────────────────
 *  Reads/writes from research.docs and research.doc_versions.
 * ────────────────────────────────────────────────────────────────────── */

import { createClient } from "@/lib/supabase/server";
import type { Doc, DocVersion, DocStatus } from "./docs-types";

// ── Query functions ─────────────────────────────────────────────────

export async function getDocs(filters?: {
  folder?: string;
  status?: DocStatus;
  search?: string;
  tag?: string;
}): Promise<Doc[]> {
  const supabase = await createClient();
  let query = supabase
    .schema("research")
    .from("docs")
    .select("*")
    .order("updated_at", { ascending: false });

  if (filters?.folder) {
    query = query.eq("folder", filters.folder);
  }
  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.tag) {
    query = query.contains("tags", [filters.tag]);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  let result = data as Doc[];

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.content_md.toLowerCase().includes(q) ||
        d.tags.some((t: string) => t.toLowerCase().includes(q)),
    );
  }

  return result;
}

export async function getDocById(id: string): Promise<Doc | undefined> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("research")
    .from("docs")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return undefined;
  return data as Doc;
}

export async function createDoc(data: {
  title: string;
  folder?: string;
  tags?: string[];
  content_md?: string;
  linked_case_id?: string | null;
}): Promise<Doc> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const slug = data.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const { data: newDoc, error } = await supabase
    .schema("research")
    .from("docs")
    .insert({
      user_id: user?.id ?? "00000000-0000-0000-0000-000000000000",
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

  if (error || !newDoc) {
    throw new Error(`Failed to create doc: ${error?.message}`);
  }

  return newDoc as Doc;
}

export async function updateDoc(
  id: string,
  updates: Partial<Pick<Doc, "title" | "content_md" | "folder" | "tags" | "status" | "linked_case_id">>,
): Promise<Doc | null> {
  const supabase = await createClient();
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.content_md !== undefined) updateData.content_md = updates.content_md;
  if (updates.folder !== undefined) updateData.folder = updates.folder;
  if (updates.tags !== undefined) updateData.tags = updates.tags;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.linked_case_id !== undefined) updateData.linked_case_id = updates.linked_case_id;

  const { data, error } = await supabase
    .schema("research")
    .from("docs")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) return null;
  return data as Doc;
}

// ── Versions ────────────────────────────────────────────────────────

export async function getVersionsByDocId(docId: string): Promise<DocVersion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("research")
    .from("doc_versions")
    .select("*")
    .eq("doc_id", docId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as DocVersion[];
}

export async function createVersion(data: {
  doc_id: string;
  content_md: string;
  note?: string | null;
}): Promise<DocVersion> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: version, error } = await supabase
    .schema("research")
    .from("doc_versions")
    .insert({
      doc_id: data.doc_id,
      user_id: user?.id ?? "00000000-0000-0000-0000-000000000000",
      content_md: data.content_md,
      note: data.note ?? null,
    })
    .select()
    .single();

  if (error || !version) {
    throw new Error(`Failed to create version: ${error?.message}`);
  }

  return version as DocVersion;
}

export async function getVersionById(id: string): Promise<DocVersion | undefined> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("research")
    .from("doc_versions")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return undefined;
  return data as DocVersion;
}

// ── Unique tags ─────────────────────────────────────────────────────

export async function getAllTags(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("research")
    .from("docs")
    .select("tags");

  if (error || !data) return [];

  const tagSet = new Set<string>();
  for (const doc of data) {
    for (const tag of (doc.tags as string[]) ?? []) {
      tagSet.add(tag);
    }
  }
  return Array.from(tagSet).sort();
}
