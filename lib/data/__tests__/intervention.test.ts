import { describe, it, expect } from "vitest";
import {
  classifyMetricIntervention,
  classifyAllInterventions,
  isInterventionRec,
} from "../intervention";
import type { CaseEvent, Recommendation } from "../types";

/* ─── OQ-7: the treatment variable Paper 3 regresses on ────────────────
 *  Rule under test (lib/data/phd-spine.ts OQ-7): a case has the
 *  intervention for a metric iff ≥1 non-historical recommendation was
 *  DECIDED strictly before that metric's outcome milestone.
 * ────────────────────────────────────────────────────────────────────── */

const CASE_ID = "case-1";

function ev(event_type: CaseEvent["event_type"], occurred_at: string): CaseEvent {
  return { id: `ev-${event_type}-${occurred_at}`, case_id: CASE_ID, occurred_at, event_type, actor_id: "op-1", payload: "" };
}

function rec(overrides: Partial<Recommendation>): Recommendation {
  return {
    id: "rec-1",
    case_id: CASE_ID,
    created_at: "2026-03-01T10:00:00Z",
    engine_type: "llm",
    engine_version: "llm-paper2-v0.1/transport",
    confidence_type: "probability",
    confidence_value: 0.7,
    recommendation: "Activate transport",
    explanation: "Timeline supports it",
    accepted: true,
    override_reason: null,
    decided_by: "op-1",
    decided_at: "2026-03-01T10:30:00Z",
    ...overrides,
  };
}

describe("isInterventionRec (QD-1 exclusions)", () => {
  it("accepts a decided, non-historical rec", () => {
    expect(isInterventionRec(rec({}))).toBe(true);
  });
  it("rejects an undecided rec", () => {
    expect(isInterventionRec(rec({ accepted: null, decided_at: null, decided_by: null }))).toBe(false);
  });
  it("rejects a /historical rec even when decided", () => {
    expect(isInterventionRec(rec({ engine_version: "llm-paper2-v0.1/transport/historical" }))).toBe(false);
  });
});

describe("classifyMetricIntervention", () => {
  const outcomeAt = "2026-03-01T12:00:00Z";
  const events = [ev("FIRST_CONTACT", "2026-03-01T09:00:00Z"), ev("TRANSPORT_ACTIVATED", outcomeAt)];

  it("intervention when a rec was decided before the outcome", () => {
    const result = classifyMetricIntervention("TTTA", events, [rec({ decided_at: "2026-03-01T10:30:00Z" })]);
    expect(result.classification).toBe("intervention");
    expect(result.outcome_at).toBe(outcomeAt);
    expect(result.decided_recs_before_outcome).toBe(1);
  });

  it("baseline when the only decision came after the outcome", () => {
    const result = classifyMetricIntervention("TTTA", events, [rec({ decided_at: "2026-03-01T13:00:00Z" })]);
    expect(result.classification).toBe("baseline");
    expect(result.decided_recs_before_outcome).toBe(0);
  });

  it("baseline when the outcome exists and no rec was ever decided", () => {
    const result = classifyMetricIntervention("TTTA", events, [rec({ accepted: null, decided_at: null, decided_by: null })]);
    expect(result.classification).toBe("baseline");
  });

  it("pending_outcome when the outcome milestone is missing", () => {
    const result = classifyMetricIntervention("TTGP", events, [rec({})]);
    expect(result.classification).toBe("pending_outcome");
    expect(result.outcome_at).toBeNull();
  });

  it("uses the EARLIEST outcome event (first-leg-only, matching metrics.ts)", () => {
    const multiLeg = [...events, ev("TRANSPORT_ACTIVATED", "2026-03-01T18:00:00Z")];
    // Decided between leg 1 and leg 2 — must NOT count as intervention.
    const result = classifyMetricIntervention("TTTA", multiLeg, [rec({ decided_at: "2026-03-01T14:00:00Z" })]);
    expect(result.classification).toBe("baseline");
    expect(result.outcome_at).toBe(outcomeAt);
  });

  it("excludes /historical recs from the intervention set", () => {
    const result = classifyMetricIntervention("TTTA", events, [
      rec({ engine_version: "llm-paper2-v0.1/transport/historical", decided_at: "2026-03-01T10:30:00Z" }),
    ]);
    expect(result.classification).toBe("baseline");
  });
});

describe("classifyAllInterventions", () => {
  it("classifies per case from the full batches and ignores unknown case_ids", () => {
    const events = [
      ev("TRANSPORT_ACTIVATED", "2026-03-01T12:00:00Z"),
      { ...ev("TRANSPORT_ACTIVATED", "2026-03-01T12:00:00Z"), id: "x", case_id: "unknown-case" },
    ];
    const rows = classifyAllInterventions([CASE_ID], events, [rec({ decided_at: "2026-03-01T11:00:00Z" })]);
    expect(rows).toHaveLength(1);
    expect(rows[0].case_id).toBe(CASE_ID);
    expect(rows[0].ttta.classification).toBe("intervention");
    expect(rows[0].ttgp.classification).toBe("pending_outcome");
    expect(rows[0].ttdc.classification).toBe("pending_outcome");
  });
});
