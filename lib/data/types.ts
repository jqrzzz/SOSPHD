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

// ── Consent (research-usability gate; migration 011) ──────────────────

/**
 * Whether a fieldwork record (journal entry, upload) may enter research
 * outputs. Mirrors research.consent_status:
 *  - not_required: self-authored, no third party involved
 *  - pending: third party involved, consent not yet captured
 *  - obtained: informed consent captured (method + timestamp set)
 *  - declined: refused — operational context only, NEVER research data
 */
export type ConsentStatus =
  | "not_required"
  | "pending"
  | "obtained"
  | "declined";

export const CONSENT_STATUS_LABELS: Record<ConsentStatus, string> = {
  not_required: "Not required (self-authored)",
  pending: "Pending — third party, consent not yet captured",
  obtained: "Obtained",
  declined: "Declined — exclude from research",
};

// ── Case ──────────────────────────────────────────────────────────────

export type CaseStatus = "open" | "active" | "closed";

/**
 * Clinical severity scale, derived from `public.cases.priority` via
 * `mapPriority` in lib/data/store.ts. Cardinality (1-4) matches the
 * operational enum's 4 values: low → 1, normal → 2, high → 3,
 * critical → 4. Widen this if richer severity data (e.g. acuity_level)
 * becomes the source of truth.
 *
 * 1 = Low, 2 = Normal, 3 = High, 4 = Critical.
 */
export type Severity = 1 | 2 | 3 | 4;

/**
 * Where a Case row originated:
 *  - "operational" = projected from public.cases (live SOSCOMMAND data)
 *  - "historical"  = a research.cases row (backfilled 2018–2023, or any
 *    research-native case). See docs/backfill-plan.md.
 * Optional so existing construction sites stay valid; the read layer
 * sets it explicitly.
 */
export type CaseSource = "operational" | "historical";

export interface Case {
  id: string;
  site_id: string;
  created_at: string; // ISO 8601
  status: CaseStatus;
  severity: Severity;
  chief_complaint: string;
  patient_ref: string;
  notes: string;
  source?: CaseSource;
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
  /** Auth user id of operator who decided. NULL until decided. */
  decided_by: string | null;
  /** ISO timestamp of decision. NULL until decided. */
  decided_at: string | null;
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
