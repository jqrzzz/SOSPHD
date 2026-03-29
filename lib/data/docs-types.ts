/* ─── Docs Module Types ────────────────────────────────────────────────
 *  Mirror the target Postgres schema for docs and doc_versions.
 * ────────────────────────────────────────────────────────────────────── */

export type DocStatus = "draft" | "active" | "archived";

export interface Doc {
  id: string;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
  user_id: string;
  site_id: string | null;
  title: string;
  slug: string | null;
  folder: string;
  tags: string[];
  content_md: string;
  status: DocStatus;
  linked_case_id: string | null;
}

export interface DocVersion {
  id: string;
  created_at: string;
  doc_id: string;
  user_id: string;
  content_md: string;
  note: string | null;
}

// ── AI modes ────────────────────────────────────────────────────────

export const DOC_AI_MODES = [
  "summarize",
  "rewrite",
  "outline",
  "extract_tasks",
  "one_pager",
] as const;

export type DocAIMode = (typeof DOC_AI_MODES)[number];

export const DOC_AI_MODE_LABELS: Record<DocAIMode, string> = {
  summarize: "Summarize",
  rewrite: "Rewrite",
  outline: "Outline",
  extract_tasks: "Extract Tasks",
  one_pager: "One-Pager",
};

// ── Folder presets ──────────────────────────────────────────────────

export const DOC_FOLDERS = [
  "General",
  "Papers",
  "Methods",
  "Field Logs",
  "Planning",
] as const;

export type DocFolder = (typeof DOC_FOLDERS)[number];
