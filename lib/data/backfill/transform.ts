/* ─── Historical Backfill — pure transform ─────────────────────────────
 *  HistoricalCaseInput → (research.cases row, derived case_events). Pure
 *  and deterministic so it's unit-testable without a database. The
 *  writer (ingest.ts) calls this, then persists the result. See
 *  docs/backfill-plan.md §5.
 * ────────────────────────────────────────────────────────────────────── */

import type {
  HistoricalCaseInput,
  ResearchCaseRow,
  DerivedEvent,
} from "./types";
import {
  normalizePayer,
  bucketDiagnosis,
  mapHistoricalStatus,
  mapHistoricalSeverity,
} from "./normalize";

const MILESTONE_FIELDS: {
  field: keyof HistoricalCaseInput;
  event_type: DerivedEvent["event_type"];
}[] = [
  { field: "first_contact_at", event_type: "FIRST_CONTACT" },
  { field: "triage_at", event_type: "TRIAGE_COMPLETE" },
  { field: "transport_activated_at", event_type: "TRANSPORT_ACTIVATED" },
  { field: "facility_arrival_at", event_type: "FACILITY_ARRIVAL" },
  { field: "guaranteed_payment_at", event_type: "GUARANTEED_PAYMENT" },
  { field: "definitive_care_at", event_type: "DEFINITIVE_CARE_START" },
  { field: "discharge_at", event_type: "DISCHARGE" },
];

export const ALL_MILESTONES: DerivedEvent["event_type"][] =
  MILESTONE_FIELDS.map((m) => m.event_type);

export interface TransformedCase {
  caseRow: ResearchCaseRow;
  events: DerivedEvent[];
  /** Milestones absent from this input — feeds the missingness log. */
  missing: DerivedEvent["event_type"][];
}

/**
 * Pure transform. Builds the research.cases insert payload and derives
 * one case_event per present milestone timestamp. occurred_at comes
 * straight from the source timestamp so re-runs are idempotent under
 * the (case_id, event_type, occurred_at, actor_id) dedup constraint.
 */
export function historicalCaseToRows(
  input: HistoricalCaseInput,
): TransformedCase {
  const events: DerivedEvent[] = [];
  const missing: DerivedEvent["event_type"][] = [];

  for (const { field, event_type } of MILESTONE_FIELDS) {
    const ts = input[field] as string | undefined;
    if (ts) {
      events.push({
        event_type,
        occurred_at: ts,
        payload: `Backfilled from historical record ${input.external_ref}`,
      });
    } else {
      missing.push(event_type);
    }
  }

  const caseRow: ResearchCaseRow = {
    source: "backfill_2018_2023",
    external_ref: input.external_ref,
    patient_ref: input.patient_ref,
    status: mapHistoricalStatus(input.status_raw),
    severity: mapHistoricalSeverity(input.severity_raw),
    corridor: input.corridor ?? null,
    payer_entity: normalizePayer(input.payer_raw),
    diagnosis_bucket: bucketDiagnosis(input.diagnosis_raw),
    country: input.country ?? null,
    incident_summary: input.incident_summary ?? null,
    intake_date: input.first_contact_at ?? null,
    closed_date: input.discharge_at ?? null,
  };

  return { caseRow, events, missing };
}
