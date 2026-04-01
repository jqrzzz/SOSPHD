/* ─── Context Builder ──────────────────────────────────────────────────
 *  Builds a safe (no PHI beyond pseudonym) context snapshot for the
 *  advisor AI. This snapshot is stored alongside assistant messages
 *  for provenance.
 * ────────────────────────────────────────────────────────────────────── */

import type { ContextSnapshot, MissingMilestones } from "./advisor-types";
import { getCases, getEventsByCaseId } from "./store";
import { getNotes, getTasks } from "./advisor-store";
import { computeAllMetrics } from "./metrics";
import { EVENT_TYPES, type EventType } from "./types";

/** Milestone events that should eventually appear for a complete case */
const MILESTONE_EVENTS: EventType[] = [
  "FIRST_CONTACT",
  "TRIAGE_COMPLETE",
  "TRANSPORT_ACTIVATED",
  "FACILITY_ARRIVAL",
  "GUARANTEED_PAYMENT",
  "DEFINITIVE_CARE_START",
  "DISCHARGE",
];

function getMissingMilestones(caseId: string): string[] {
  const events = getEventsByCaseId(caseId);
  const present = new Set(events.map((e) => e.event_type));
  return MILESTONE_EVENTS.filter((m) => !present.has(m));
}

export async function buildContextSnapshot(): Promise<ContextSnapshot> {
  const allCases = getCases();

  // Recent 10 cases as safe summaries
  const recentCases = allCases.slice(0, 10).map((c) => ({
    id: c.id,
    status: c.status,
    created_at: c.created_at,
    site_id: c.site_id,
    severity: c.severity,
    chief_complaint: c.chief_complaint,
    patient_ref: c.patient_ref,
  }));

  // Most recent active case with full metrics
  const activeCase = allCases.find((c) => c.status === "active") ?? allCases[0];
  let activeCaseMetrics: ContextSnapshot["active_case_metrics"] = null;

  if (activeCase) {
    const events = getEventsByCaseId(activeCase.id);
    const metrics = computeAllMetrics(events);
    const ttta = metrics.find((m) => m.abbreviation === "TTTA");
    const ttgp = metrics.find((m) => m.abbreviation === "TTGP");
    const ttdc = metrics.find((m) => m.abbreviation === "TTDC");

    activeCaseMetrics = {
      case_id: activeCase.id,
      ttta_ms: ttta?.value_ms ?? null,
      ttgp_ms: ttgp?.value_ms ?? null,
      ttdc_ms: ttdc?.value_ms ?? null,
      ttta_running: ttta?.is_running ?? false,
      ttgp_running: ttgp?.is_running ?? false,
      ttdc_running: ttdc?.is_running ?? false,
      missing_milestones: getMissingMilestones(activeCase.id),
    };
  }

  // Missing milestones for all open/active cases
  const missingAll: MissingMilestones[] = allCases
    .filter((c) => c.status !== "closed")
    .map((c) => ({
      case_id: c.id,
      patient_ref: c.patient_ref,
      missing: getMissingMilestones(c.id),
    }))
    .filter((m) => m.missing.length > 0);

  // Tasks and notes
  const topTasksRaw = await getTasks({ limit: 5 });
  const topTasks = topTasksRaw.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
  }));

  const recentNotesRaw = await getNotes(5);
  const recentNotes = recentNotesRaw.map((n) => ({
    id: n.id,
    title: n.title,
    content: n.content.slice(0, 200),
    created_at: n.created_at,
  }));

  return {
    user_role: "researcher",
    total_cases: allCases.length,
    recent_cases: recentCases,
    active_case_metrics: activeCaseMetrics,
    top_tasks: topTasks,
    recent_notes: recentNotes,
    missing_milestones_all: missingAll,
  };
}
