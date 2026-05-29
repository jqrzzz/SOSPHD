/* ─── Historical Backfill — shared types ───────────────────────────────
 *  The contract between a spreadsheet parser (which must be written
 *  against the real 843-case sheet headers) and the writer in
 *  ingest.ts. The parser's only job is to produce HistoricalCaseInput[];
 *  everything downstream (normalization, event derivation, idempotent
 *  insert) is implemented here. See docs/backfill-plan.md §5.
 *
 *  PHI rule: HistoricalCaseInput carries only the de-identified research
 *  projection. patient_ref is a pseudonym. Do NOT put names/DOB/passport
 *  here — research.cases has no column for them by design.
 * ────────────────────────────────────────────────────────────────────── */

import type { CaseStatus, Severity } from "../types";

/**
 * One historical case as produced by the spreadsheet parser. Milestone
 * timestamps are optional — absence is expected and feeds the
 * missingness log. Raw payer / diagnosis strings are pre-normalization;
 * the writer normalizes them.
 */
export interface HistoricalCaseInput {
  /** Stable id from the source sheet (row id / case number) for audit. */
  external_ref: string;
  /** Pseudonym. Never a real name. */
  patient_ref: string;

  // Raw dimensions (normalized by the writer)
  status_raw?: string;
  severity_raw?: string;
  payer_raw?: string;
  diagnosis_raw?: string;
  corridor?: string;
  country?: string;
  incident_summary?: string;

  // Milestone timestamps (ISO 8601). Any subset may be present.
  first_contact_at?: string;
  triage_at?: string;
  transport_activated_at?: string;
  facility_arrival_at?: string;
  guaranteed_payment_at?: string;
  definitive_care_at?: string;
  discharge_at?: string;
}

/** Insert payload for one research.cases row. */
export interface ResearchCaseRow {
  source: "backfill_2018_2023";
  external_ref: string;
  patient_ref: string;
  status: CaseStatus;
  severity: Severity | null;
  corridor: string | null;
  payer_entity: string | null;
  diagnosis_bucket: string | null;
  country: string | null;
  incident_summary: string | null;
  intake_date: string | null;
  closed_date: string | null;
}

/** A derived research.case_events row (case_id + batch filled at write time). */
export interface DerivedEvent {
  event_type:
    | "FIRST_CONTACT"
    | "TRIAGE_COMPLETE"
    | "TRANSPORT_ACTIVATED"
    | "FACILITY_ARRIVAL"
    | "GUARANTEED_PAYMENT"
    | "DEFINITIVE_CARE_START"
    | "DISCHARGE";
  occurred_at: string;
  payload: string;
}

export interface IngestResult {
  batch_id: string;
  cases_inserted: number;
  events_inserted: number;
  /** Per-milestone count of cases that lacked that milestone. */
  missingness: Record<DerivedEvent["event_type"], number>;
}
