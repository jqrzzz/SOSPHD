import { describe, it, expect } from "vitest";
import { computePaper2Coordination } from "../analytics";
import type { Recommendation } from "../types";

// ── Fixtures ─────────────────────────────────────────────────────────

type TestCase = { id: string; patient_ref: string; severity: number };

const cases: TestCase[] = [
  { id: "case-1", patient_ref: "SOS-001", severity: 4 },
  { id: "case-2", patient_ref: "SOS-002", severity: 3 },
  { id: "case-3", patient_ref: "SOS-003", severity: 1 },
];

function makeRec(
  overrides: Partial<Recommendation> & Pick<Recommendation, "id" | "case_id">,
): Recommendation {
  return {
    created_at: "2026-05-16T10:00:00.000Z",
    engine_type: "llm",
    engine_version: "llm-paper2-v0.1/transport",
    confidence_type: "probability",
    confidence_value: 0.7,
    recommendation: "Activate transport",
    explanation: "TTTA exceeds 15min",
    accepted: null,
    override_reason: null,
    decided_by: null,
    decided_at: null,
    ...overrides,
  } as Recommendation;
}

// ── Empty / edge cases ──────────────────────────────────────────────

describe("computePaper2Coordination — empty / edge", () => {
  it("returns zero-filled result on empty inputs", () => {
    const r = computePaper2Coordination([], []);
    expect(r.total).toBe(0);
    expect(r.accepted).toBe(0);
    expect(r.overridden).toBe(0);
    expect(r.pending).toBe(0);
    expect(r.overall_accept_rate).toBeNull();
    expect(r.avg_confidence).toBeNull();
    expect(r.avg_time_to_decision_ms).toBeNull();
    expect(r.median_time_to_decision_ms).toBeNull();
    expect(r.by_engine).toEqual([]);
    expect(r.cases_with_recommendations).toBe(0);
    // Severity grid is always 1..4 (matches Severity type cardinality)
    expect(r.by_severity.map((s) => s.severity)).toEqual([1, 2, 3, 4]);
    expect(r.by_severity.every((s) => s.total === 0)).toBe(true);
    expect(r.by_severity.every((s) => s.accept_rate === null)).toBe(true);
    // Confidence buckets always 4 ranges
    expect(r.by_confidence).toHaveLength(4);
    expect(r.by_confidence.every((b) => b.total === 0)).toBe(true);
  });

  it("skips orphaned recommendations (case_id missing from cases)", () => {
    const orphaned: Recommendation = makeRec({
      id: "r1",
      case_id: "case-not-in-list",
    });
    const r = computePaper2Coordination(cases, [orphaned]);
    expect(r.total).toBe(0);
    expect(r.cases_with_recommendations).toBe(0);
  });
});

// ── Decision tallies + acceptance rate ──────────────────────────────

describe("computePaper2Coordination — decision tallies", () => {
  const decided: Recommendation[] = [
    makeRec({ id: "r1", case_id: "case-1", accepted: true, decided_by: "u", decided_at: "2026-05-16T10:05:00Z" }),
    makeRec({ id: "r2", case_id: "case-1", accepted: false, override_reason: "had it", decided_by: "u", decided_at: "2026-05-16T10:06:00Z" }),
    makeRec({ id: "r3", case_id: "case-2", accepted: true, decided_by: "u", decided_at: "2026-05-16T10:10:00Z" }),
    makeRec({ id: "r4", case_id: "case-3", accepted: null }),
  ];

  it("counts accepted / overridden / pending separately", () => {
    const r = computePaper2Coordination(cases, decided);
    expect(r.accepted).toBe(2);
    expect(r.overridden).toBe(1);
    expect(r.pending).toBe(1);
    expect(r.total).toBe(4);
  });

  it("computes accept rate over decided, not total", () => {
    const r = computePaper2Coordination(cases, decided);
    // accepted / (accepted + overridden) = 2/3
    expect(r.overall_accept_rate).toBeCloseTo(2 / 3, 5);
  });

  it("returns null accept rate when no decisions exist", () => {
    const allPending: Recommendation[] = [
      makeRec({ id: "r1", case_id: "case-1", accepted: null }),
      makeRec({ id: "r2", case_id: "case-2", accepted: null }),
    ];
    const r = computePaper2Coordination(cases, allPending);
    expect(r.overall_accept_rate).toBeNull();
    expect(r.pending).toBe(2);
  });

  it("counts unique cases with recommendations correctly", () => {
    const r = computePaper2Coordination(cases, decided);
    expect(r.cases_with_recommendations).toBe(3); // case-1, case-2, case-3
  });
});

// ── Time-to-decision ────────────────────────────────────────────────

describe("computePaper2Coordination — time to decision", () => {
  it("computes mean and median from decided_at - created_at", () => {
    const recs: Recommendation[] = [
      makeRec({
        id: "r1",
        case_id: "case-1",
        accepted: true,
        decided_by: "u",
        created_at: "2026-05-16T10:00:00Z",
        decided_at: "2026-05-16T10:01:00Z", // 60s
      }),
      makeRec({
        id: "r2",
        case_id: "case-1",
        accepted: false,
        override_reason: "x",
        decided_by: "u",
        created_at: "2026-05-16T10:00:00Z",
        decided_at: "2026-05-16T10:03:00Z", // 180s
      }),
      makeRec({
        id: "r3",
        case_id: "case-2",
        accepted: true,
        decided_by: "u",
        created_at: "2026-05-16T10:00:00Z",
        decided_at: "2026-05-16T10:09:00Z", // 540s
      }),
    ];
    const r = computePaper2Coordination(cases, recs);
    // mean = (60 + 180 + 540) / 3 = 260 (seconds), times 1000 = 260000ms
    expect(r.avg_time_to_decision_ms).toBe(260_000);
    // median of [60_000, 180_000, 540_000] = 180_000
    expect(r.median_time_to_decision_ms).toBe(180_000);
  });

  it("excludes pending recs from time-to-decision (no decided_at)", () => {
    const recs: Recommendation[] = [
      makeRec({ id: "r1", case_id: "case-1", accepted: null }),
      makeRec({
        id: "r2",
        case_id: "case-1",
        accepted: true,
        decided_by: "u",
        created_at: "2026-05-16T10:00:00Z",
        decided_at: "2026-05-16T10:02:00Z",
      }),
    ];
    const r = computePaper2Coordination(cases, recs);
    expect(r.avg_time_to_decision_ms).toBe(120_000);
  });

  it("rejects negative time deltas (clock skew safety)", () => {
    const recs: Recommendation[] = [
      makeRec({
        id: "r1",
        case_id: "case-1",
        accepted: true,
        decided_by: "u",
        created_at: "2026-05-16T10:05:00Z",
        decided_at: "2026-05-16T10:00:00Z", // decided BEFORE created — impossible
      }),
    ];
    const r = computePaper2Coordination(cases, recs);
    expect(r.avg_time_to_decision_ms).toBeNull();
    expect(r.median_time_to_decision_ms).toBeNull();
  });
});

// ── Confidence calibration ──────────────────────────────────────────

describe("computePaper2Coordination — confidence buckets", () => {
  it("buckets recs by [0,0.25), [0.25,0.5), [0.5,0.75), [0.75,1.0]", () => {
    const recs: Recommendation[] = [
      makeRec({ id: "r1", case_id: "case-1", accepted: true, decided_by: "u", decided_at: "2026-05-16T10:01:00Z", confidence_value: 0.10 }),
      makeRec({ id: "r2", case_id: "case-2", accepted: true, decided_by: "u", decided_at: "2026-05-16T10:01:00Z", confidence_value: 0.35 }),
      makeRec({ id: "r3", case_id: "case-3", accepted: false, override_reason: "x", decided_by: "u", decided_at: "2026-05-16T10:01:00Z", confidence_value: 0.60 }),
      makeRec({ id: "r4", case_id: "case-1", accepted: true, decided_by: "u", decided_at: "2026-05-16T10:01:00Z", confidence_value: 0.90 }),
      makeRec({ id: "r5", case_id: "case-2", accepted: true, decided_by: "u", decided_at: "2026-05-16T10:01:00Z", confidence_value: 1.00 }), // boundary
    ];
    const r = computePaper2Coordination(cases, recs);
    expect(r.by_confidence[0].total).toBe(1); // 0.10
    expect(r.by_confidence[1].total).toBe(1); // 0.35
    expect(r.by_confidence[2].total).toBe(1); // 0.60
    expect(r.by_confidence[3].total).toBe(2); // 0.90, 1.00 (upper hi is 1.0001)
  });

  it("excludes pending recs from calibration (their acceptance is unknown)", () => {
    const recs: Recommendation[] = [
      makeRec({ id: "r1", case_id: "case-1", accepted: null, confidence_value: 0.85 }),
      makeRec({ id: "r2", case_id: "case-1", accepted: true, decided_by: "u", decided_at: "2026-05-16T10:01:00Z", confidence_value: 0.85 }),
    ];
    const r = computePaper2Coordination(cases, recs);
    expect(r.by_confidence[3].total).toBe(1); // only the decided one
    expect(r.by_confidence[3].accept_rate).toBe(1);
  });

  it("reports null accept_rate for empty buckets", () => {
    const recs: Recommendation[] = [
      makeRec({ id: "r1", case_id: "case-1", accepted: true, decided_by: "u", decided_at: "2026-05-16T10:01:00Z", confidence_value: 0.90 }),
    ];
    const r = computePaper2Coordination(cases, recs);
    expect(r.by_confidence[0].accept_rate).toBeNull(); // [0, 0.25) is empty
    expect(r.by_confidence[3].accept_rate).toBe(1); // [0.75, 1] has the 0.90
  });
});

// ── By engine version ───────────────────────────────────────────────

describe("computePaper2Coordination — engine breakdown", () => {
  it("groups by engine_version and sorts by total desc", () => {
    const recs: Recommendation[] = [
      makeRec({ id: "r1", case_id: "case-1", engine_version: "engine-A", accepted: true, decided_by: "u", decided_at: "2026-05-16T10:01:00Z" }),
      makeRec({ id: "r2", case_id: "case-1", engine_version: "engine-A", accepted: true, decided_by: "u", decided_at: "2026-05-16T10:02:00Z" }),
      makeRec({ id: "r3", case_id: "case-2", engine_version: "engine-A", accepted: false, override_reason: "x", decided_by: "u", decided_at: "2026-05-16T10:03:00Z" }),
      makeRec({ id: "r4", case_id: "case-3", engine_version: "engine-B", accepted: true, decided_by: "u", decided_at: "2026-05-16T10:04:00Z" }),
    ];
    const r = computePaper2Coordination(cases, recs);
    expect(r.by_engine).toHaveLength(2);
    expect(r.by_engine[0].engine_version).toBe("engine-A");
    expect(r.by_engine[0].total).toBe(3);
    expect(r.by_engine[0].accept_rate).toBeCloseTo(2 / 3, 5);
    expect(r.by_engine[1].engine_version).toBe("engine-B");
    expect(r.by_engine[1].accept_rate).toBe(1);
    expect(r.unique_engines).toBe(2);
  });
});

// ── Override reasons ────────────────────────────────────────────────

describe("computePaper2Coordination — override reasons", () => {
  it("collects override reasons in reverse chronological order", () => {
    const recs: Recommendation[] = [
      makeRec({
        id: "r1",
        case_id: "case-1",
        accepted: false,
        override_reason: "earlier override",
        decided_by: "u",
        decided_at: "2026-05-16T09:00:00Z",
      }),
      makeRec({
        id: "r2",
        case_id: "case-2",
        accepted: false,
        override_reason: "later override",
        decided_by: "u",
        decided_at: "2026-05-16T11:00:00Z",
      }),
    ];
    const r = computePaper2Coordination(cases, recs);
    expect(r.override_reasons).toHaveLength(2);
    expect(r.override_reasons[0].reason).toBe("later override");
    expect(r.override_reasons[1].reason).toBe("earlier override");
  });

  it("caps override reasons at 20", () => {
    const many: Recommendation[] = Array.from({ length: 30 }, (_, i) =>
      makeRec({
        id: `r${i}`,
        case_id: "case-1",
        accepted: false,
        override_reason: `reason ${i}`,
        decided_by: "u",
        decided_at: `2026-05-16T${String(10 + Math.floor(i / 6)).padStart(2, "0")}:${String((i * 10) % 60).padStart(2, "0")}:00Z`,
      }),
    );
    const r = computePaper2Coordination(cases, many);
    expect(r.override_reasons).toHaveLength(20);
  });

  it("excludes overrides without a recorded decided_at", () => {
    const recs: Recommendation[] = [
      makeRec({
        id: "r1",
        case_id: "case-1",
        accepted: false,
        override_reason: "no decided_at",
        // decided_at intentionally omitted — shouldn't happen post-migration
        // but the analytics should be defensive
      }),
    ];
    const r = computePaper2Coordination(cases, recs);
    expect(r.override_reasons).toEqual([]);
  });
});
