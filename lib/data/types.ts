/* ─── ResearchOS Domain Types ────────────────────────────────────────────
 *  Mirror the target Postgres schema exactly.
 *  When Supabase is connected, these become the Row types.
 * ────────────────────────────────────────────────────────────────────── */

// ── Event taxonomy (provenance-critical) ──────────────────────────────

export const EVENT_TYPES = [
  "FIRST_CONTACT",
  "TRIAGE_COMPLETE",
  "TRANSPORT_ACTIVATED",
  "FACILITY_ARRIVAL",
  "GUARANTEED_PAYMENT",
  "DEFINITIVE_CARE_START",
  "DISCHARGE",
  "NOTE",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  FIRST_CONTACT: "First Contact",
  TRIAGE_COMPLETE: "Triage Complete",
  TRANSPORT_ACTIVATED: "Transport Activated",
  FACILITY_ARRIVAL: "Facility Arrival",
  GUARANTEED_PAYMENT: "Guaranteed Payment",
  DEFINITIVE_CARE_START: "Definitive Care Start",
  DISCHARGE: "Discharge",
  NOTE: "Note",
};

// ── Case ──────────────────────────────────────────────────────────────

export type CaseStatus = "open" | "active" | "closed";
export type Severity = 1 | 2 | 3 | 4 | 5;

export interface Case {
  id: string;
  site_id: string;
  created_at: string; // ISO 8601
  status: CaseStatus;
  severity: Severity;
  chief_complaint: string;
  patient_ref: string;
  notes: string;
}

// ── Event (the provenance spine) ──────────────────────────────────────

export interface CaseEvent {
  id: string;
  case_id: string;
  occurred_at: string; // ISO 8601
  event_type: EventType;
  actor_id: string;
  payload: string;
}

// ── Recommendation (AI provenance) ────────────────────────────────────

export type EngineType = "rule_based" | "ml_model" | "llm";
export type ConfidenceType = "probability" | "categorical";

export interface Recommendation {
  id: string;
  case_id: string;
  created_at: string;
  engine_type: EngineType;
  engine_version: string;
  confidence_type: ConfidenceType;
  confidence_value: number; // 0-1 for probability
  recommendation: string;
  explanation: string;
  accepted: boolean | null; // null = pending
  override_reason: string | null;
}

// ── Site ──────────────────────────────────────────────────────────────

export interface Site {
  id: string;
  name: string;
  country_code: string;
  city: string;
}

// ── Profile ──────────────────────────────────────────────────────────

export type UserRole = "operator" | "coordinator" | "supervisor" | "researcher";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  site_id: string;
}

// ── Computed metric result ───────────────────────────────────────────

export interface MetricResult {
  label: string;
  abbreviation: string;
  description: string;
  value_ms: number | null; // duration in milliseconds, null = not computable
  is_running: boolean; // true if start exists but end doesn't yet
  from_event: EventType | null;
  to_event: EventType | null;
}
