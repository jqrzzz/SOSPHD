/* ─── Supabase-Backed Workspace Store ─────────────────────────────────
 *  Reads/writes from research.uploads and research.mind_maps.
 * ────────────────────────────────────────────────────────────────────── */

import { createClient } from "@/lib/supabase/server";
import type {
  Upload,
  UploadCategory,
  MindMap,
  MindMapNode,
  MindMapEdge,
} from "./workspace-types";

// ── Uploads ─────────────────────────────────────────────────────────

export async function getUploads(filters?: {
  category?: UploadCategory;
  search?: string;
}): Promise<Upload[]> {
  const supabase = await createClient();
  let query = supabase
    .schema("research")
    .from("uploads")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.category) {
    query = query.eq("category", filters.category);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  let result = data as Upload[];

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (u) =>
        u.filename.toLowerCase().includes(q) ||
        u.notes.toLowerCase().includes(q) ||
        u.tags.some((t: string) => t.toLowerCase().includes(q)),
    );
  }

  return result;
}

export async function createUpload(data: {
  filename: string;
  mime_type: string;
  size_bytes: number;
  category: UploadCategory;
  url: string;
  tags?: string[];
  notes?: string;
  linked_case_id?: string | null;
  linked_doc_id?: string | null;
}): Promise<Upload> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: upload, error } = await supabase
    .schema("research")
    .from("uploads")
    .insert({
      user_id: user?.id ?? "00000000-0000-0000-0000-000000000000",
      filename: data.filename,
      mime_type: data.mime_type,
      size_bytes: data.size_bytes,
      category: data.category,
      url: data.url,
      tags: data.tags ?? [],
      notes: data.notes ?? "",
      linked_case_id: data.linked_case_id ?? null,
      linked_doc_id: data.linked_doc_id ?? null,
    })
    .select()
    .single();

  if (error || !upload) {
    throw new Error(`Failed to create upload: ${error?.message}`);
  }

  return upload as Upload;
}

export async function deleteUpload(id: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .schema("research")
    .from("uploads")
    .delete()
    .eq("id", id);

  return !error;
}

// ── Mind Maps ───────────────────────────────────────────────────────

export async function getMindMaps(): Promise<MindMap[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("research")
    .from("mind_maps")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error || !data) return [];
  return data as MindMap[];
}

export async function getMindMapById(id: string): Promise<MindMap | undefined> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("research")
    .from("mind_maps")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return undefined;
  return data as MindMap;
}

export async function createMindMap(title: string): Promise<MindMap> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: mm, error } = await supabase
    .schema("research")
    .from("mind_maps")
    .insert({
      user_id: user?.id ?? "00000000-0000-0000-0000-000000000000",
      title,
      nodes: [{ id: "n1", x: 400, y: 250, label: title, color: "#3b82f6", radius: 36 }],
      edges: [],
    })
    .select()
    .single();

  if (error || !mm) {
    throw new Error(`Failed to create mind map: ${error?.message}`);
  }

  return mm as MindMap;
}

export async function updateMindMap(
  id: string,
  updates: {
    title?: string;
    nodes?: MindMapNode[];
    edges?: MindMapEdge[];
  },
): Promise<MindMap | null> {
  const supabase = await createClient();
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.nodes !== undefined) updateData.nodes = updates.nodes;
  if (updates.edges !== undefined) updateData.edges = updates.edges;

  const { data, error } = await supabase
    .schema("research")
    .from("mind_maps")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) return null;
  return data as MindMap;
}

export async function deleteMindMap(id: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .schema("research")
    .from("mind_maps")
    .delete()
    .eq("id", id);

  return !error;
}
