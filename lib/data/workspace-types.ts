import type { ConsentStatus } from "./types";

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
  /** Storage path in the private `research-uploads` bucket
   *  ({user_id}/{uuid}-{filename}); legacy rows may hold "#". Serve via
   *  short-lived signed URLs — the bucket is never public. */
  url: string;
  tags: string[];
  notes: string;
  linked_case_id: string | null;
  linked_doc_id: string | null;
  // Consent gate (migration 011) — see ConsentStatus in ./types
  consent_status: ConsentStatus;
  consent_method: string | null;
  consent_jurisdiction: string | null;
  consent_captured_at: string | null;
}

// ── Mind Maps ────────────────────────────────────────────────────────

export type MindMapNodeType =
  | "idea"
  | "paper"
  | "data"
  | "method"
  | "question"
  | "milestone";

export interface MindMapNode {
  id: string;
  x: number;
  y: number;
  label: string;
  color: string; // hex
  radius: number;
  nodeType?: MindMapNodeType;
}

export interface MindMapEdge {
  id: string;
  from: string; // node id
  to: string; // node id
  label?: string;
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
