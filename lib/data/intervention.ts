/* ─── Intervention classification (OQ-7) ───────────────────────────────
 *  Implements the pre-registered rule from lib/data/phd-spine.ts OQ-7:
 *
 *    "A case is classified as having the intervention iff at least one
 *     recommendation was generated and decided for it BEFORE the
 *     relevant outcome milestone (DEFINITIVE_CARE_START for TTDC;
 *     GUARANTEED_PAYMENT for TTGP; TRANSPORT_ACTIVATED for TTTA)."
 *
 *  This is the treatment variable Paper 3's stepped-wedge analysis
 *  regresses on. Until this module existed the rule was prose only —
 *  nothing computed it, so nothing could be checked against it.
 *
 *  Two deliberate alignments with the rest of the measurement layer:
 *   - The outcome event is the EARLIEST event of the outcome type,
 *     matching findEvent's first-leg-only semantics in
 *     lib/data/metrics.ts (sorted defensively here rather than
 *     depending on caller ordering).
 *   - Recommendations whose engine_version ends in "/historical" are
 *     EXCLUDED (QD-1: retrospective recs on backfilled cases are not
 *     part of the intervention set).
 *
 *  Pure functions, unit-tested in __tests__/intervention.test.ts.
 * ────────────────────────────────────────────────────────────────────── */

import type { CaseEvent, EventType, Recommendation } from "./types";

export type InterventionMetric = "TTTA" | "TTGP" | "TTDC";

export const OUTCOME_EVENT: Record<InterventionMetric, EventType> = {
  TTTA: "TRANSPORT_ACTIVATED",
  TTGP: "GUARANTEED_PAYMENT",
  TTDC: "DEFINITIVE_CARE_START",
};

export type InterventionClass =
  /** ≥1 non-historical rec decided strictly before the outcome milestone. */
  | "intervention"
  /** Outcome milestone reached with no qualifying prior decision. */
  | "baseline"
  /** Outcome milestone not yet recorded — classification is not possible. */
  | "pending_outcome";

export interface MetricIntervention {
  metric: InterventionMetric;
  classification: InterventionClass;
  /** occurred_at of the earliest outcome event, null when pending_outcome. */
  outcome_at: string | null;
  /** Count of qualifying decisions strictly before the outcome. */
  decided_recs_before_outcome: number;
}

/** QD-1: retrospective recs on historical cases are not the intervention. */
export function isInterventionRec(rec: Recommendation): boolean {
  return rec.decided_at !== null && !rec.engine_version.endsWith("/historical");
}

function earliestOfType(
  events: CaseEvent[],
  type: EventType,
): CaseEvent | undefined {
  let earliest: CaseEvent | undefined;
  for (const e of events) {
    if (e.event_type !== type) continue;
    if (!earliest || Date.parse(e.occurred_at) < Date.parse(earliest.occurred_at)) {
      earliest = e;
    }
  }
  return earliest;
}

/**
 * Classify one case for one metric. `events` and `recs` must belong to
 * the same case as each other; the function does not filter by case_id.
 */
export function classifyMetricIntervention(
  metric: InterventionMetric,
  events: CaseEvent[],
  recs: Recommendation[],
): MetricIntervention {
  const outcome = earliestOfType(events, OUTCOME_EVENT[metric]);
  if (!outcome) {
    return {
      metric,
      classification: "pending_outcome",
      outcome_at: null,
      decided_recs_before_outcome: 0,
    };
  }

  const outcomeMs = Date.parse(outcome.occurred_at);
  let priorDecisions = 0;
  for (const rec of recs) {
    if (!isInterventionRec(rec)) continue;
    const decidedMs = Date.parse(rec.decided_at as string);
    if (Number.isFinite(decidedMs) && decidedMs < outcomeMs) {
      priorDecisions += 1;
    }
  }

  return {
    metric,
    classification: priorDecisions > 0 ? "intervention" : "baseline",
    outcome_at: outcome.occurred_at,
    decided_recs_before_outcome: priorDecisions,
  };
}

/** All three metric classifications for one case. */
export function classifyCaseIntervention(
  events: CaseEvent[],
  recs: Recommendation[],
): MetricIntervention[] {
  return (Object.keys(OUTCOME_EVENT) as InterventionMetric[]).map((metric) =>
    classifyMetricIntervention(metric, events, recs),
  );
}

export interface CaseInterventionRow {
  case_id: string;
  ttta: MetricIntervention;
  ttgp: MetricIntervention;
  ttdc: MetricIntervention;
}

/**
 * Classify every case from the full event + recommendation batches
 * (same three-round-trip data shape the analytics layer already uses).
 * Cases absent from `caseIds` contribute nothing; events/recs for
 * unknown cases are ignored.
 */
export function classifyAllInterventions(
  caseIds: string[],
  allEvents: CaseEvent[],
  allRecs: Recommendation[],
): CaseInterventionRow[] {
  const eventsByCase = new Map<string, CaseEvent[]>();
  for (const e of allEvents) {
    const arr = eventsByCase.get(e.case_id) ?? [];
    arr.push(e);
    eventsByCase.set(e.case_id, arr);
  }
  const recsByCase = new Map<string, Recommendation[]>();
  for (const r of allRecs) {
    const arr = recsByCase.get(r.case_id) ?? [];
    arr.push(r);
    recsByCase.set(r.case_id, arr);
  }

  return caseIds.map((case_id) => {
    const events = eventsByCase.get(case_id) ?? [];
    const recs = recsByCase.get(case_id) ?? [];
    const [ttta, ttgp, ttdc] = classifyCaseIntervention(events, recs);
    return { case_id, ttta, ttgp, ttdc };
  });
}
