/* ─── Advisor Module Types ─────────────────────────────────────────────
 *  Mirror the target Postgres schema for research_notes, tasks,
 *  advisor_sessions, and advisor_messages.
 * ────────────────────────────────────────────────────────────────────── */

// ── Research Notes ───────────────────────────────────────────────────

export interface ResearchNote {
  id: string;
  created_at: string; // ISO 8601
  user_id: string;
  site_id: string | null;
  title: string | null;
  content: string;
  tags: string[];
  linked_case_id: string | null;
}

// ── Tasks ────────────────────────────────────────────────────────────

export type TaskStatus = "todo" | "doing" | "done";

export interface ResearchTask {
  id: string;
  created_at: string;
  user_id: string;
  site_id: string | null;
  status: TaskStatus;
  priority: number; // 1 = highest, 3 = lowest
  due_date: string | null; // ISO date string
  title: string;
  description: string | null;
  linked_case_id: string | null;
}

// ── Advisor Sessions ─────────────────────────────────────────────────

export interface AdvisorSession {
  id: string;
  created_at: string;
  user_id: string;
  title: string;
}

// ── Advisor Messages ─────────────────────────────────────────────────

export type AdvisorRole = "user" | "assistant" | "system";

export interface AdvisorMessage {
  id: string;
  created_at: string;
  session_id: string;
  role: AdvisorRole;
  content: string;
  context_snapshot: Record<string, unknown> | null;
}

// ── Context snapshot (safe, no PHI beyond pseudonym) ──────────────────

export interface SafeCaseSummary {
  id: string;
  status: string;
  created_at: string;
  site_id: string;
  severity: number;
  chief_complaint: string;
  patient_ref: string; // pseudonym only
}

export interface MissingMilestones {
  case_id: string;
  patient_ref: string;
  missing: string[];
}

export interface ContextSnapshot {
  user_role: string;
  total_cases: number;
  recent_cases: SafeCaseSummary[];
  active_case_metrics: {
    case_id: string;
    ttta_ms: number | null;
    ttgp_ms: number | null;
    ttdc_ms: number | null;
    ttta_running: boolean;
    ttgp_running: boolean;
    ttdc_running: boolean;
    missing_milestones: string[];
  } | null;
  top_tasks: Array<{ id: string; title: string; status: string; priority: number }>;
  recent_notes: Array<{ id: string; title: string | null; content: string; created_at: string }>;
  missing_milestones_all: MissingMilestones[];
}
