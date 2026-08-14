/* ─── Workspace Store — READ paths (SERVER ONLY) ───────────────────────
 *  Queries research.uploads, research.mind_maps.
 *
 *  SERVER ONLY as of the Phase 2 client unification: every consumer is a
 *  server context (workspace + mindmap pages), and the previous browser
 *  client carried no session cookies on the server — queries ran as
 *  `anon`, RLS returned nothing, and the seed fallback silently served
 *  fabricated content. The `server-only` import makes any future client
 *  import a build error instead of a repeat of that bug.
 *
 *  Fallback policy (lib/data/degraded.ts): seed data in dev, EMPTY in
 *  production, always with a [SOSPHD:DEGRADED] warning.
 *
 *  Per Phase 3 of audit-action-plan.md, this file is reads-only; writes
 *  live in workspace-mutations.ts.
 * ────────────────────────────────────────────────────────────────────── */

import "server-only";

import { getServerSupabase } from "@/lib/supabase/server-auth";
import { warnDegradedMode, seedOrEmpty } from "@/lib/data/degraded";
import type { Upload, UploadCategory, MindMap } from "./workspace-types";

// ── Seed data (fallback) ─────────────────────────────────────────────

const DEMO_USER_ID = "user_demo";

const seedUploadsRaw: Omit<Upload, "consent_status" | "consent_method" | "consent_jurisdiction" | "consent_captured_at">[] = [
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

// Seed uploads predate the consent columns (migration 011).
const seedUploads: Upload[] = seedUploadsRaw.map((u) => ({
  ...u,
  consent_status: "not_required" as const,
  consent_method: null,
  consent_jurisdiction: null,
  consent_captured_at: null,
}));

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
  const sb = await getServerSupabase();
  if (sb) {
    try {
      let query = sb
        .schema("research")
        .from("uploads")
        .select("*")
        .order("created_at", { ascending: false });

      if (filters?.category) query = query.eq("category", filters.category);
      if (filters?.search) query = query.or(
        `filename.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`
      );

      const { data, error } = await query;
      if (!error && data) return data as Upload[];
      if (error) warnDegradedMode("getUploads", error.message);
    } catch (e) {
      warnDegradedMode(
        "getUploads",
        e instanceof Error ? e.message : "supabase query threw",
      );
    }
  } else {
    warnDegradedMode("getUploads", "supabase env vars missing");
  }

  let result = [...seedUploads];
  if (filters?.category) result = result.filter((u) => u.category === filters.category);
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (u) =>
        u.filename.toLowerCase().includes(q) ||
        u.notes.toLowerCase().includes(q) ||
        u.tags.some((t: string) => t.toLowerCase().includes(q)),
    );
  }
  return seedOrEmpty(
    result.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    ),
    [],
  );
}

// ── Mind Maps (reads only — writes in workspace-mutations.ts) ──────

export async function getMindMaps(): Promise<MindMap[]> {
  const sb = await getServerSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .schema("research")
        .from("mind_maps")
        .select("*")
        .order("updated_at", { ascending: false });
      if (!error && data) return data as MindMap[];
      if (error) warnDegradedMode("getMindMaps", error.message);
    } catch (e) {
      warnDegradedMode(
        "getMindMaps",
        e instanceof Error ? e.message : "supabase query threw",
      );
    }
  } else {
    warnDegradedMode("getMindMaps", "supabase env vars missing");
  }
  return seedOrEmpty(
    [...seedMindMaps].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    ),
    [],
  );
}

export async function getMindMapById(id: string): Promise<MindMap | null> {
  const sb = await getServerSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .schema("research")
        .from("mind_maps")
        .select("*")
        .eq("id", id)
        .single();
      if (!error && data) return data as MindMap;
      if (error) warnDegradedMode("getMindMapById", error.message);
    } catch (e) {
      warnDegradedMode(
        "getMindMapById",
        e instanceof Error ? e.message : "supabase query threw",
      );
    }
  } else {
    warnDegradedMode("getMindMapById", "supabase unavailable");
  }
  return seedOrEmpty(seedMindMaps.find((m) => m.id === id) ?? null, null);
}

