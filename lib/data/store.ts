/* ─── In-Memory Data Store ────────────────────────────────────────────
 *  Swap this single file for Supabase client calls when connected.
 *  Every function signature is designed to match a Supabase query.
 * ────────────────────────────────────────────────────────────────────── */

import type { Case, CaseEvent, CaseStatus, Severity, Recommendation } from "./types";

// ── Seed data ────────────────────────────────────────────────────────

const DEMO_SITE_ID = "site_001";

const seedCases: Case[] = [
  {
    id: "case_001",
    site_id: DEMO_SITE_ID,
    created_at: "2026-02-01T08:30:00Z",
    status: "closed",
    severity: 4,
    chief_complaint: "Severe dehydration and suspected heat stroke during desert tour",
    patient_ref: "PT-2026-0401",
    notes: "Tourist on guided excursion, found unresponsive by group leader.",
  },
  {
    id: "case_002",
    site_id: DEMO_SITE_ID,
    created_at: "2026-02-05T14:15:00Z",
    status: "active",
    severity: 3,
    chief_complaint: "Open fracture lower leg from hiking fall",
    patient_ref: "PT-2026-0402",
    notes: "Fall from approximately 3m height on unmarked trail. Conscious, oriented.",
  },
  {
    id: "case_003",
    site_id: DEMO_SITE_ID,
    created_at: "2026-02-10T22:00:00Z",
    status: "open",
    severity: 2,
    chief_complaint: "Allergic reaction to local food, facial swelling",
    patient_ref: "PT-2026-0403",
    notes: "First-time visitor, unknown allergen. No history of anaphylaxis.",
  },
  {
    id: "case_004",
    site_id: DEMO_SITE_ID,
    created_at: "2026-02-03T11:00:00Z",
    status: "closed",
    severity: 5,
    chief_complaint: "Chest pain and dyspnea during scuba diving excursion",
    patient_ref: "PT-2026-0404",
    notes: "Possible decompression sickness. Payment clearance delayed by insurer.",
  },
];

const seedEvents: CaseEvent[] = [
  // Case 1: Full resolution (all events)
  { id: "evt_001", case_id: "case_001", occurred_at: "2026-02-01T08:30:00Z", event_type: "FIRST_CONTACT", actor_id: "op_001", payload: "Distress call received from tour guide. Patient unresponsive." },
  { id: "evt_002", case_id: "case_001", occurred_at: "2026-02-01T08:42:00Z", event_type: "TRIAGE_COMPLETE", actor_id: "op_001", payload: "Severity 4 confirmed. Vitals: HR 120, BP 80/50, Temp 40.2C." },
  { id: "evt_003", case_id: "case_001", occurred_at: "2026-02-01T08:48:00Z", event_type: "TRANSPORT_ACTIVATED", actor_id: "op_001", payload: "Helicopter dispatched from Regional Medical Center. ETA 25 min." },
  { id: "evt_004", case_id: "case_001", occurred_at: "2026-02-01T09:05:00Z", event_type: "GUARANTEED_PAYMENT", actor_id: "op_002", payload: "Travel insurance verified. Policy AXA-TRV-29481. Pre-auth confirmed." },
  { id: "evt_005", case_id: "case_001", occurred_at: "2026-02-01T09:15:00Z", event_type: "FACILITY_ARRIVAL", actor_id: "op_001", payload: "Patient arrived at Regional Medical Center ED." },
  { id: "evt_006", case_id: "case_001", occurred_at: "2026-02-01T09:22:00Z", event_type: "DEFINITIVE_CARE_START", actor_id: "op_001", payload: "IV rehydration and active cooling initiated. ED physician Dr. Alvarez." },
  { id: "evt_007", case_id: "case_001", occurred_at: "2026-02-02T16:00:00Z", event_type: "DISCHARGE", actor_id: "op_002", payload: "Patient discharged, stable. Follow-up with home physician recommended." },

  // Case 2: In-progress (FIRST_CONTACT + TRANSPORT_ACTIVATED only)
  { id: "evt_008", case_id: "case_002", occurred_at: "2026-02-05T14:15:00Z", event_type: "FIRST_CONTACT", actor_id: "op_001", payload: "Call from hiking guide. Patient conscious, compound fracture visible." },
  { id: "evt_009", case_id: "case_002", occurred_at: "2026-02-05T14:22:00Z", event_type: "TRIAGE_COMPLETE", actor_id: "op_001", payload: "Severity 3. Open fracture tibia. Bleeding controlled with tourniquet." },
  { id: "evt_010", case_id: "case_002", occurred_at: "2026-02-05T14:30:00Z", event_type: "TRANSPORT_ACTIVATED", actor_id: "op_001", payload: "Ground ambulance dispatched. Trail access via service road. ETA 40 min." },
  { id: "evt_011", case_id: "case_002", occurred_at: "2026-02-05T15:10:00Z", event_type: "NOTE", actor_id: "op_002", payload: "Insurance company requesting additional documentation before pre-auth. Escalating." },

  // Case 3: Just opened (FIRST_CONTACT only)
  { id: "evt_012", case_id: "case_003", occurred_at: "2026-02-10T22:00:00Z", event_type: "FIRST_CONTACT", actor_id: "op_001", payload: "Hotel concierge reports guest with facial swelling after dinner. Guest is breathing normally." },

  // Case 4: Payment delay scenario (TTGP > TTDC)
  { id: "evt_013", case_id: "case_004", occurred_at: "2026-02-03T11:00:00Z", event_type: "FIRST_CONTACT", actor_id: "op_001", payload: "Dive operator emergency call. Tourist surfaced with chest pain, difficulty breathing." },
  { id: "evt_014", case_id: "case_004", occurred_at: "2026-02-03T11:08:00Z", event_type: "TRANSPORT_ACTIVATED", actor_id: "op_001", payload: "Coast guard boat + ambulance coordinated. Nearest hyperbaric chamber 45 min." },
  { id: "evt_015", case_id: "case_004", occurred_at: "2026-02-03T11:55:00Z", event_type: "FACILITY_ARRIVAL", actor_id: "op_001", payload: "Arrived at Coastal Medical hyperbaric unit." },
  { id: "evt_016", case_id: "case_004", occurred_at: "2026-02-03T12:10:00Z", event_type: "DEFINITIVE_CARE_START", actor_id: "op_001", payload: "Hyperbaric oxygen therapy initiated. Dive medicine specialist Dr. Chen." },
  { id: "evt_017", case_id: "case_004", occurred_at: "2026-02-03T14:30:00Z", event_type: "NOTE", actor_id: "op_002", payload: "Insurer disputing coverage. Claim that diving was excluded activity. Escalated to supervisor." },
  { id: "evt_018", case_id: "case_004", occurred_at: "2026-02-04T09:00:00Z", event_type: "GUARANTEED_PAYMENT", actor_id: "op_002", payload: "Payment finally guaranteed after supervisor intervention. Insurer agreed to cover. 22h delay." },
  { id: "evt_019", case_id: "case_004", occurred_at: "2026-02-05T11:00:00Z", event_type: "DISCHARGE", actor_id: "op_001", payload: "Patient cleared after two HBO sessions. Fit to fly in 72h." },
];

const seedRecommendations: Recommendation[] = [
  {
    id: "rec_001",
    case_id: "case_001",
    created_at: "2026-02-01T08:43:00Z",
    engine_type: "rule_based",
    engine_version: "v0.1.0",
    confidence_type: "categorical",
    confidence_value: 0.92,
    recommendation: "Dispatch helicopter to Regional Medical Center (closest level-2 facility with capacity)",
    explanation: "Patient severity 4 in remote desert location. Ground transport ETA >90min exceeds clinical window. Helicopter ETA 25min from Regional Medical, which has 3 available ED beds and heat-stroke protocol.",
    accepted: true,
    override_reason: null,
  },
  {
    id: "rec_002",
    case_id: "case_004",
    created_at: "2026-02-03T11:05:00Z",
    engine_type: "rule_based",
    engine_version: "v0.1.0",
    confidence_type: "probability",
    confidence_value: 0.87,
    recommendation: "Route to Coastal Medical hyperbaric unit via coast guard + ambulance relay",
    explanation: "Suspected DCS requires hyperbaric oxygen. Coastal Medical is the only facility within 100km with a functional chamber. Coast guard vessel + ambulance relay is fastest multimodal option.",
    accepted: true,
    override_reason: null,
  },
];

// ── Mutable store (arrays are mutated in-place for simplicity) ──────

const cases = [...seedCases];
const events = [...seedEvents];
const recommendations = [...seedRecommendations];

let nextCaseNum = 5;
let nextEventNum = 20;

// ── Query functions ─────────────────────────────────────────────────

export function getCases(filters?: {
  status?: CaseStatus;
  search?: string;
}): Case[] {
  let result = [...cases];

  if (filters?.status) {
    result = result.filter((c) => c.status === filters.status);
  }

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (c) =>
        c.patient_ref.toLowerCase().includes(q) ||
        c.chief_complaint.toLowerCase().includes(q),
    );
  }

  // Sort newest first
  return result.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export function getCaseById(id: string): Case | undefined {
  return cases.find((c) => c.id === id);
}

export function createCase(data: {
  severity: Severity;
  chief_complaint: string;
  patient_ref: string;
  notes: string;
}): Case {
  const newCase: Case = {
    id: `case_${String(nextCaseNum++).padStart(3, "0")}`,
    site_id: DEMO_SITE_ID,
    created_at: new Date().toISOString(),
    status: "open",
    severity: data.severity,
    chief_complaint: data.chief_complaint,
    patient_ref: data.patient_ref,
    notes: data.notes,
  };
  cases.push(newCase);
  return newCase;
}

export function getEventsByCaseId(caseId: string): CaseEvent[] {
  return events
    .filter((e) => e.case_id === caseId)
    .sort(
      (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
    );
}

export function addEvent(data: {
  case_id: string;
  event_type: CaseEvent["event_type"];
  occurred_at: string;
  payload: string;
}): CaseEvent {
  const newEvent: CaseEvent = {
    id: `evt_${String(nextEventNum++).padStart(3, "0")}`,
    case_id: data.case_id,
    occurred_at: data.occurred_at,
    event_type: data.event_type,
    actor_id: "op_demo",
    payload: data.payload,
  };
  events.push(newEvent);

  // Auto-update case status based on event
  const c = cases.find((cs) => cs.id === data.case_id);
  if (c) {
    if (data.event_type === "DISCHARGE") {
      c.status = "closed";
    } else if (c.status === "open" && data.event_type !== "NOTE") {
      c.status = "active";
    }
  }

  return newEvent;
}

export function getRecommendationsByCaseId(caseId: string): Recommendation[] {
  return recommendations
    .filter((r) => r.case_id === caseId)
    .sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
}

export function getEventCountByCaseId(caseId: string): number {
  return events.filter((e) => e.case_id === caseId).length;
}
