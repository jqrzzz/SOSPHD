/* ─── Workspace Mutations — SERVER ONLY ────────────────────────────────
 *  Write paths for research.uploads, research.mind_maps.
 *
 *  Lives separate from workspace-store.ts (reads). All write functions
 *  use requireAuthOrThrow and throw on auth/DB failure. Server actions
 *  in lib/workspace-actions.ts wrap calls in try/catch and return
 *  structured {error} envelopes.
 * ────────────────────────────────────────────────────────────────────── */

import { requireAuthOrThrow } from "@/lib/supabase/server-auth";
import type {
  Upload,
  UploadCategory,
  MindMap,
  MindMapNode,
  MindMapEdge,
} from "./workspace-types";

// ── Uploads ──────────────────────────────────────────────────────────

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
  const { supabase: sb, userId } = await requireAuthOrThrow();
  const { data: row, error } = await sb
    .schema("research")
    .from("uploads")
    .insert({
      user_id: userId,
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
  if (error || !row) {
    throw new Error(`Failed to create upload: ${error?.message}`);
  }
  return row as Upload;
}

export async function deleteUpload(id: string): Promise<void> {
  const { supabase: sb } = await requireAuthOrThrow();
  const { error } = await sb
    .schema("research")
    .from("uploads")
    .delete()
    .eq("id", id);
  if (error) {
    throw new Error(`Failed to delete upload: ${error.message}`);
  }
}

// ── Mind Maps ────────────────────────────────────────────────────────

export async function createMindMap(title: string): Promise<MindMap> {
  const { supabase: sb, userId } = await requireAuthOrThrow();
  const { data: row, error } = await sb
    .schema("research")
    .from("mind_maps")
    .insert({
      user_id: userId,
      title,
      nodes: [
        { id: "n1", x: 400, y: 250, label: title, color: "#3b82f6", radius: 36 },
      ],
      edges: [],
    })
    .select()
    .single();
  if (error || !row) {
    throw new Error(`Failed to create mind map: ${error?.message}`);
  }
  return row as MindMap;
}

export async function updateMindMap(
  id: string,
  updates: {
    title?: string;
    nodes?: MindMapNode[];
    edges?: MindMapEdge[];
  },
): Promise<MindMap> {
  const { supabase: sb } = await requireAuthOrThrow();
  const { data: row, error } = await sb
    .schema("research")
    .from("mind_maps")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error || !row) {
    throw new Error(`Failed to update mind map: ${error?.message}`);
  }
  return row as MindMap;
}

export async function deleteMindMap(id: string): Promise<void> {
  const { supabase: sb } = await requireAuthOrThrow();
  const { error } = await sb
    .schema("research")
    .from("mind_maps")
    .delete()
    .eq("id", id);
  if (error) {
    throw new Error(`Failed to delete mind map: ${error.message}`);
  }
}
