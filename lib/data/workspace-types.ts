/* ─── Workspace Module Types ───────────────────────────────────────────
 *  Uploads (file metadata) and Mind Maps (nodes + edges).
 * ────────────────────────────────────────────────────────────────────── */

// ── Uploads ──────────────────────────────────────────────────────────

export type UploadCategory =
  | "transcript"
  | "pdf"
  | "image"
  | "video"
  | "document"
  | "other";

export interface Upload {
  id: string;
  created_at: string;
  user_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  category: UploadCategory;
  url: string; // Vercel Blob URL or placeholder
  tags: string[];
  notes: string;
  linked_case_id: string | null;
  linked_doc_id: string | null;
}

// ── Mind Maps ────────────────────────────────────────────────────────

export interface MindMapNode {
  id: string;
  x: number;
  y: number;
  label: string;
  color: string; // hex
  radius: number;
}

export interface MindMapEdge {
  id: string;
  from: string; // node id
  to: string; // node id
}

export interface MindMap {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  title: string;
  nodes: MindMapNode[];
  edges: MindMapEdge[];
}
