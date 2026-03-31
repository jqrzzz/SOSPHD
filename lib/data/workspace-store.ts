/* ─── In-Memory Workspace Store ────────────────────────────────────────
 *  Same swap-for-Supabase pattern as other stores.
 * ────────────────────────────────────────────────────────────────────── */

import type {
  Upload,
  UploadCategory,
  MindMap,
  MindMapNode,
  MindMapEdge,
} from "./workspace-types";

const DEMO_USER_ID = "user_demo";

// ── Seed uploads ─────────────────────────────────────────────────────

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
    notes:
      "Transcript of operator call during DCS case. Documents 22h payment delay.",
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

// ── Seed mind maps ───────────────────────────────────────────────────

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

// ── Mutable store ────────────────────────────────────────────────────

const uploads = [...seedUploads];
const mindMaps = [...seedMindMaps];

let nextUploadNum = 4;
let nextMindMapNum = 2;

// ── Uploads ──────────────────────────────────────────────────────────

export function getUploads(filters?: {
  category?: UploadCategory;
  search?: string;
}): Upload[] {
  let result = [...uploads];

  if (filters?.category) {
    result = result.filter((u) => u.category === filters.category);
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (u) =>
        u.filename.toLowerCase().includes(q) ||
        u.notes.toLowerCase().includes(q) ||
        u.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }

  return result.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export function createUpload(data: {
  filename: string;
  mime_type: string;
  size_bytes: number;
  category: UploadCategory;
  url: string;
  tags?: string[];
  notes?: string;
  linked_case_id?: string | null;
  linked_doc_id?: string | null;
}): Upload {
  const upload: Upload = {
    id: `upload_${String(nextUploadNum++).padStart(3, "0")}`,
    created_at: new Date().toISOString(),
    user_id: DEMO_USER_ID,
    filename: data.filename,
    mime_type: data.mime_type,
    size_bytes: data.size_bytes,
    category: data.category,
    url: data.url,
    tags: data.tags ?? [],
    notes: data.notes ?? "",
    linked_case_id: data.linked_case_id ?? null,
    linked_doc_id: data.linked_doc_id ?? null,
  };
  uploads.push(upload);
  return upload;
}

export function deleteUpload(id: string): boolean {
  const idx = uploads.findIndex((u) => u.id === id);
  if (idx === -1) return false;
  uploads.splice(idx, 1);
  return true;
}

// ── Mind Maps ────────────────────────────────────────────────────────

export function getMindMaps(): MindMap[] {
  return [...mindMaps].sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

export function getMindMapById(id: string): MindMap | undefined {
  return mindMaps.find((m) => m.id === id);
}

export function createMindMap(title: string): MindMap {
  const mm: MindMap = {
    id: `mm_${String(nextMindMapNum++).padStart(3, "0")}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user_id: DEMO_USER_ID,
    title,
    nodes: [
      { id: "n1", x: 400, y: 250, label: title, color: "#3b82f6", radius: 36 },
    ],
    edges: [],
  };
  mindMaps.push(mm);
  return mm;
}

export function updateMindMap(
  id: string,
  updates: {
    title?: string;
    nodes?: MindMapNode[];
    edges?: MindMapEdge[];
  },
): MindMap | null {
  const mm = mindMaps.find((m) => m.id === id);
  if (!mm) return null;

  if (updates.title !== undefined) mm.title = updates.title;
  if (updates.nodes !== undefined) mm.nodes = updates.nodes;
  if (updates.edges !== undefined) mm.edges = updates.edges;
  mm.updated_at = new Date().toISOString();

  return mm;
}

export function deleteMindMap(id: string): boolean {
  const idx = mindMaps.findIndex((m) => m.id === id);
  if (idx === -1) return false;
  mindMaps.splice(idx, 1);
  return true;
}
