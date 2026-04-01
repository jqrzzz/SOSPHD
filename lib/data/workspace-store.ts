/* ─── Workspace Store (Supabase) ───────────────────────────────────────
 *  Queries phd_uploads, phd_mind_maps.
 *  Falls back to seed data when Supabase is unavailable.
 * ────────────────────────────────────────────────────────────────────── */

import { getSupabase, getCurrentUserId } from "@/lib/supabase/db";
import type {
  Upload,
  UploadCategory,
  MindMap,
  MindMapNode,
  MindMapEdge,
} from "./workspace-types";

// ── Seed data (fallback) ─────────────────────────────────────────────

const DEMO_USER_ID = "user_demo";

const seedUploads: Upload[] = [
  {
    id: "upload_001",
    created_at: "2026-02-06T09:00:00Z",
    user_id: DEMO_USER_ID,
    filename: "insurance-verification-guide.pdf",
    mime_type: "application/pdf",
    size_bytes: 245_000,
    category: "pdf",
    url: "#",
    tags: ["insurance", "protocol"],
    notes: "Standard operating procedure for insurance pre-auth verification.",
    linked_case_id: null,
    linked_doc_id: null,
  },
  {
    id: "upload_002",
    created_at: "2026-02-08T14:00:00Z",
    user_id: DEMO_USER_ID,
    filename: "case-004-operator-transcript.txt",
    mime_type: "text/plain",
    size_bytes: 12_400,
    category: "transcript",
    url: "#",
    tags: ["case-004", "transcript", "dcs"],
    notes: "Transcript of operator call during DCS case. Documents 22h payment delay.",
    linked_case_id: "case_004",
    linked_doc_id: null,
  },
  {
    id: "upload_003",
    created_at: "2026-02-10T10:30:00Z",
    user_id: DEMO_USER_ID,
    filename: "stepped-wedge-design-diagram.png",
    mime_type: "image/png",
    size_bytes: 89_000,
    category: "image",
    url: "#",
    tags: ["methodology", "stepped-wedge"],
    notes: "Visual diagram of the stepped-wedge cluster rollout schedule.",
    linked_case_id: null,
    linked_doc_id: "doc_004",
  },
];

const seedMindMaps: MindMap[] = [
  {
    id: "mm_001",
    created_at: "2026-02-07T11:00:00Z",
    updated_at: "2026-02-11T09:00:00Z",
    user_id: DEMO_USER_ID,
    title: "PhD Thesis Structure",
    nodes: [
      { id: "n1", x: 400, y: 200, label: "PhD Thesis", color: "#3b82f6", radius: 40, nodeType: "milestone" as const },
      { id: "n2", x: 200, y: 100, label: "Paper 1:\nMetrics", color: "#22c55e", radius: 32, nodeType: "paper" as const },
      { id: "n3", x: 200, y: 300, label: "Paper 2:\nIntervention", color: "#22c55e", radius: 32, nodeType: "paper" as const },
      { id: "n4", x: 600, y: 100, label: "Paper 3:\nEvaluation", color: "#22c55e", radius: 32, nodeType: "paper" as const },
      { id: "n5", x: 600, y: 300, label: "Stepped\nWedge", color: "#f59e0b", radius: 28, nodeType: "method" as const },
      { id: "n6", x: 400, y: 380, label: "Provenance\nChain", color: "#f59e0b", radius: 28, nodeType: "method" as const },
      { id: "n7", x: 100, y: 200, label: "TTDC /\nTTGP", color: "#ef4444", radius: 26, nodeType: "data" as const },
    ],
    edges: [
      { id: "e1", from: "n1", to: "n2", label: "produces" },
      { id: "e2", from: "n1", to: "n3", label: "produces" },
      { id: "e3", from: "n1", to: "n4", label: "produces" },
      { id: "e4", from: "n4", to: "n5", label: "uses" },
      { id: "e5", from: "n3", to: "n6", label: "defines" },
      { id: "e6", from: "n2", to: "n7", label: "measures" },
      { id: "e7", from: "n6", to: "n5", label: "feeds into" },
    ],
  },
];

// ── Uploads ──────────────────────────────────────────────────────────

export async function getUploads(filters?: {
  category?: UploadCategory;
  search?: string;
}): Promise<Upload[]> {
  const sb = getSupabase();
  if (sb) {
    try {
      let query = sb
        .from("phd_uploads")
        .select("*")
        .order("created_at", { ascending: false });

      if (filters?.category) query = query.eq("category", filters.category);
      if (filters?.search) query = query.or(
        `filename.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`
      );

      const { data, error } = await query;
      if (!error && data) return data as Upload[];
    } catch { /* fall through */ }
  }

  let result = [...seedUploads];
  if (filters?.category) result = result.filter((u) => u.category === filters.category);
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (u) =>
        u.filename.toLowerCase().includes(q) ||
        u.notes.toLowerCase().includes(q) ||
        u.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }
  return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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
}): Promise<Upload | null> {
  const sb = getSupabase();
  const userId = await getCurrentUserId();

  if (sb && userId) {
    const { data: row, error } = await sb
      .from("phd_uploads")
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
    if (!error && row) return row as Upload;
  }
  return null;
}

export async function deleteUpload(id: string): Promise<boolean> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from("phd_uploads").delete().eq("id", id);
    return !error;
  }
  return false;
}

// ── Mind Maps ────────────────────────────────────────────────────────

export async function getMindMaps(): Promise<MindMap[]> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("phd_mind_maps")
        .select("*")
        .order("updated_at", { ascending: false });
      if (!error && data) return data as MindMap[];
    } catch { /* fall through */ }
  }
  return [...seedMindMaps].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

export async function getMindMapById(id: string): Promise<MindMap | null> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("phd_mind_maps")
        .select("*")
        .eq("id", id)
        .single();
      if (!error && data) return data as MindMap;
    } catch { /* fall through */ }
  }
  return seedMindMaps.find((m) => m.id === id) ?? null;
}

export async function createMindMap(title: string): Promise<MindMap | null> {
  const sb = getSupabase();
  const userId = await getCurrentUserId();

  if (sb && userId) {
    const { data: row, error } = await sb
      .from("phd_mind_maps")
      .insert({
        user_id: userId,
        title,
        nodes: [{ id: "n1", x: 400, y: 250, label: title, color: "#3b82f6", radius: 36 }],
        edges: [],
      })
      .select()
      .single();
    if (!error && row) return row as MindMap;
  }
  return null;
}

export async function updateMindMap(
  id: string,
  updates: {
    title?: string;
    nodes?: MindMapNode[];
    edges?: MindMapEdge[];
  },
): Promise<MindMap | null> {
  const sb = getSupabase();
  if (sb) {
    const { data: row, error } = await sb
      .from("phd_mind_maps")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (!error && row) return row as MindMap;
  }
  return null;
}

export async function deleteMindMap(id: string): Promise<boolean> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from("phd_mind_maps").delete().eq("id", id);
    return !error;
  }
  return false;
}
