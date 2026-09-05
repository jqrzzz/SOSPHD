import { describe, expect, it } from "vitest";
import {
  BASELINE_SOURCE,
  buildPaper1Evidence,
  PAPER1_CHECKS,
  paper1EvidenceSchema,
  verifyPaper1Snapshot,
} from "../../../lib/data/paper1-evidence.mjs";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const capture = {
  started_at: "2026-09-05T02:00:00.000Z",
  ended_at: "2026-09-05T02:00:01.000Z",
};

// Entirely synthetic: these five records are never taken from or sent to a database.
function sourceRows() {
  const cases = [
    { id: uuid(1), source: BASELINE_SOURCE, country: "Thailand", intake_date: "2019-01-01T17:00:00Z", nationality: "US", diagnosis_bucket: "gastro", payer_entity: "Self-pay", evacuated: true },
    { id: uuid(2), source: BASELINE_SOURCE, country: "thailand", intake_date: "2019-03-10T17:00:00Z", nationality: " us ", diagnosis_bucket: "trauma", payer_entity: "Allianz", evacuated: false },
    { id: uuid(3), source: BASELINE_SOURCE, country: "Japan", intake_date: null, nationality: "?", diagnosis_bucket: "animal_bite", payer_entity: null, evacuated: null },
    { id: uuid(4), source: BASELINE_SOURCE, country: null, intake_date: "2019-02-01T00:00:00+07:00", nationality: null, diagnosis_bucket: "marine", payer_entity: "Allianz", evacuated: true },
    { id: uuid(5), source: BASELINE_SOURCE, country: "Thailand", intake_date: "2019-03-10T18:00:00Z", nationality: "n/a", diagnosis_bucket: null, payer_entity: "Synthetic payer", evacuated: false },
  ];
  const event = (id: number, caseId: number, event_type: string, occurred_at: string, resolution: string | null = "date") => ({
    id: uuid(id), case_id: uuid(caseId), event_type, occurred_at, resolution,
  });
  const events = [
    event(101, 1, "FIRST_CONTACT", "2019-01-01T17:00:00Z"),
    event(102, 1, "TRANSPORT_ACTIVATED", "2019-01-02T17:00:00Z"),
    event(103, 2, "FIRST_CONTACT", "2019-03-10T18:00:00Z", "entry"),
    event(104, 2, "TRANSPORT_ACTIVATED", "2019-03-10T18:00:00Z", "entry"),
    event(105, 3, "TRANSPORT_ACTIVATED", "2019-02-01T17:00:00Z", null),
    event(106, 4, "FIRST_CONTACT", "2019-01-31T17:00:00Z", "measured"),
    event(107, 4, "TRIAGE_COMPLETE", "2019-01-31T18:00:00Z", "measured"),
    event(108, 4, "FACILITY_ARRIVAL", "2019-01-31T19:00:00Z", "measured"),
    event(109, 4, "GUARANTEED_PAYMENT", "2019-01-31T20:00:00Z", "measured"),
    event(110, 4, "DEFINITIVE_CARE_START", "2019-01-31T21:00:00Z", "measured"),
    event(111, 4, "DISCHARGE", "2019-02-01T17:00:00Z"),
    event(112, 1, "NOTE", "2019-01-01T17:00:00Z"),
    event(113, 1, "NOTE", "2019-01-01T17:00:00Z"),
  ];
  const intervals = [
    { case_id: uuid(1), ttta_minutes: null, ttgp_minutes: null, ttdc_minutes: null },
    { case_id: uuid(2), ttta_minutes: 0, ttgp_minutes: null, ttdc_minutes: null },
    { case_id: uuid(4), ttta_minutes: null, ttgp_minutes: 180, ttdc_minutes: 240 },
  ];
  return { cases, events, intervals };
}

function build(rows = sourceRows()) {
  return buildPaper1Evidence(rows.cases, rows.events, rows.intervals, capture);
}

// Synthetic aggregate fixture for verifier behavior only. Matching the expected
// numbers here is not evidence that any real cohort satisfies the manuscript.
function syntheticMatchingSnapshot() {
  return {
    meta: { id: uuid(900), label: "paper1-baseline-v1", created_at: "2026-09-05T02:00:02.000Z" },
    payload: {
      paper1: {
        version: 1,
        source: BASELINE_SOURCE,
        capture: { ...capture },
        case_count: 836,
        event_count: 844,
        interval_count: 835,
        figures: Object.fromEntries(PAPER1_CHECKS.map(({ key, expected }) => [key, expected])),
      },
    },
  };
}

describe("Paper 1 evidence capture", () => {
  it("derives all 30 assertions from the synthetic cohort, with Bangkok dates", () => {
    const evidence = build();
    expect(evidence).toMatchObject({
      version: 1, source: BASELINE_SOURCE, capture,
      case_count: 5, event_count: 13, interval_count: 3,
    });
    expect(evidence.figures).toEqual({
      total_cases: 5, thailand_cases: 3, nationalities: 1, missing_nationality: 2,
      gastro: 1, trauma: 1, animal_bite: 1, marine: 1,
      missing_diagnosis: 1, other_diagnosis: 0,
      evacuations: 2, evacuations_with_transport: 1,
      self_pay: 1, payers: 3, allianz: 2,
      first_date: "2019-01-02", last_date: "2019-03-11",
      first_contact: 3, transport: 3, off_midnight_transport: 1,
      raw_ttta_hours: "0h,24h",
      computable_ttta: 1, computable_ttgp: 1, computable_ttdc: 1,
      unclassified_resolution: 1,
      TRIAGE_COMPLETE: 1, FACILITY_ARRIVAL: 1, GUARANTEED_PAYMENT: 1,
      DEFINITIVE_CARE_START: 1, DISCHARGE: 1,
    });
    expect(Object.keys(evidence.figures)).toHaveLength(30);
    expect(PAPER1_CHECKS).toHaveLength(30);
    expect(new Set(PAPER1_CHECKS.map(({ key }) => key)).size).toBe(30);
  });

  it("distinguishes an explicit other diagnosis from missing diagnosis", () => {
    const rows = sourceRows();
    rows.cases[4].diagnosis_bucket = "other";
    expect(build(rows).figures).toMatchObject({ other_diagnosis: 1, missing_diagnosis: 0 });
  });

  it("treats zero-minute intervals as observed but does not infer intervals from raw date differences", () => {
    const rows = sourceRows();
    rows.events[2].resolution = "date";
    rows.events[3].resolution = "date";
    rows.intervals.forEach((row) => { row.ttta_minutes = null; });
    expect(build(rows).figures).toMatchObject({ raw_ttta_hours: "0h,24h", computable_ttta: 0 });
  });

  it("recognizes Bangkok midnight across offsets and counts subsecond deviations", () => {
    const rows = sourceRows();
    rows.events[1].occurred_at = "2019-01-03T00:00:00+07:00";
    rows.events[2].occurred_at = "2019-03-12T00:00:00.001+07:00";
    rows.events[3].occurred_at = "2019-03-12T00:00:00.001+07:00";
    expect(build(rows).figures.off_midnight_transport).toBe(1);
  });

  it.each([["000001", 1], ["000000", 0]])("preserves raw submillisecond midnight precision: .%s", (fraction, expected) => {
    const rows = sourceRows();
    rows.events[1].occurred_at = `2019-01-02T17:00:00.${fraction}Z`;
    rows.events[2].occurred_at = "2019-03-10T17:00:00Z";
    rows.events[3].occurred_at = "2019-03-10T17:00:00Z";
    expect(build(rows).figures.off_midnight_transport).toBe(expected);
  });

  it("is deterministic under row reordering and does not mutate source arrays", () => {
    const rows = sourceRows();
    const original = structuredClone(rows);
    const expected = build(rows);
    expect(build({ cases: [...rows.cases].reverse(), events: [...rows.events].reverse(), intervals: [...rows.intervals].reverse() })).toEqual(expected);
    expect(rows).toEqual(original);
  });

  it("persists aggregates only, with no case IDs, event IDs, or free text", () => {
    const rows = sourceRows();
    Object.assign(rows.cases[0], { private_note: "SYNTHETIC_PRIVATE_SENTINEL" });
    Object.assign(rows.events[0], { notes: "SYNTHETIC_EVENT_SENTINEL" });
    const serialized = JSON.stringify(build(rows));
    for (const row of [...rows.cases, ...rows.events]) expect(serialized).not.toContain(row.id);
    expect(serialized).not.toContain("SYNTHETIC_PRIVATE_SENTINEL");
    expect(serialized).not.toContain("SYNTHETIC_EVENT_SENTINEL");
    expect(serialized).not.toContain("Synthetic payer");
  });

  it("accepts explicit null optional observations but rejects missing selected columns", () => {
    const rows = sourceRows();
    const nullableCase = {
      id: uuid(10), source: BASELINE_SOURCE,
      country: null, intake_date: null, nationality: null,
      diagnosis_bucket: null, payer_entity: null, evacuated: null,
    };
    expect(() => buildPaper1Evidence([nullableCase], [], [], capture)).not.toThrow();
    for (const key of ["country", "intake_date", "nationality", "diagnosis_bucket", "payer_entity", "evacuated"]) {
      const incomplete: Record<string, unknown> = { ...nullableCase };
      delete incomplete[key];
      expect(() => buildPaper1Evidence([incomplete], [], [], capture)).toThrow();
    }
    const eventWithoutResolution: Record<string, unknown> = { ...rows.events[0] };
    delete eventWithoutResolution.resolution;
    expect(() => buildPaper1Evidence(rows.cases, [eventWithoutResolution], [rows.intervals[0]], capture)).toThrow();
    for (const key of ["ttta_minutes", "ttgp_minutes", "ttdc_minutes"]) {
      const incomplete: Record<string, unknown> = { ...rows.intervals[0] };
      delete incomplete[key];
      expect(() => buildPaper1Evidence(rows.cases, [rows.events[0]], [incomplete], capture)).toThrow();
    }
  });

  it.each([null, undefined, {}, [], [{ id: "bad-id" }]].map((cases) => ({ cases })))("rejects malformed or empty case input: $cases", ({ cases }) => {
    expect(() => buildPaper1Evidence(cases, [], [], capture)).toThrow();
  });

  it("rejects a different source without including source records in the error", () => {
    const rows = sourceRows();
    rows.cases[0].source = "SYNTHETIC_REJECTED_SOURCE";
    expect(() => build(rows)).toThrow(/invalid|incomplete/i);
    try { build(rows); } catch (error) {
      expect(String(error)).not.toContain("SYNTHETIC_REJECTED_SOURCE");
      expect(String(error)).not.toContain(uuid(1));
    }
  });

  it.each(["cases", "events", "intervals"] as const)("rejects duplicate identities in %s", (table) => {
    const rows = sourceRows();
    if (table === "cases") rows.cases.push({ ...rows.cases[0] });
    if (table === "events") rows.events.push({ ...rows.events[0] });
    if (table === "intervals") rows.intervals.push({ ...rows.intervals[0] });
    expect(() => build(rows)).toThrow(/duplicate/i);
  });

  it.each(["events", "intervals"] as const)("rejects out-of-cohort records in %s", (table) => {
    const rows = sourceRows();
    rows[table][0].case_id = uuid(999);
    expect(() => build(rows)).toThrow(/out-of-scope/i);
  });

  it("rejects repeated milestones even when their timestamps differ", () => {
    const rows = sourceRows();
    rows.events.push({ ...rows.events[0], id: uuid(999), occurred_at: "2019-01-02T17:00:00Z" });
    expect(() => build(rows)).toThrow(/repeated milestones/i);
  });

  it("requires interval coverage to match FIRST_CONTACT identities, not just row count", () => {
    const rows = sourceRows();
    rows.intervals[0].case_id = uuid(5);
    expect(() => build(rows)).toThrow(/coverage/i);
    rows.intervals.pop();
    expect(() => build(rows)).toThrow(/coverage/i);
  });

  it("rejects a non-null interval when its endpoints have only date precision", () => {
    const rows = sourceRows();
    rows.intervals[0].ttta_minutes = 1440;
    expect(() => build(rows)).toThrow();
  });

  it("rejects a non-null interval when an endpoint is missing or unclassified", () => {
    const missing = sourceRows();
    missing.intervals[2].ttta_minutes = 0;
    expect(() => build(missing)).toThrow();
    const unclassified = sourceRows();
    unclassified.events[2].resolution = null;
    expect(() => build(unclassified)).toThrow();
  });

  it("rejects a null interval when both endpoints have finer-than-date precision", () => {
    const rows = sourceRows();
    rows.intervals[1].ttta_minutes = null;
    expect(() => build(rows)).toThrow();
  });

  it.each(["not-a-date", "2019-01-01", "2019-01-01T17:00:00"])("rejects invalid or timezone-free event timestamps: %s", (occurred_at) => {
    const rows = sourceRows();
    rows.events[0].occurred_at = occurred_at;
    expect(() => build(rows)).toThrow();
  });

  it.each([NaN, Infinity, -Infinity])("rejects non-finite interval values: %s", (value) => {
    const rows = sourceRows();
    rows.intervals[0].ttta_minutes = value;
    expect(() => build(rows)).toThrow();
  });

  it("rejects unknown event types and clock resolutions", () => {
    const rows = sourceRows();
    rows.events[0].event_type = "UNKNOWN";
    expect(() => build(rows)).toThrow();
    rows.events[0].event_type = "FIRST_CONTACT";
    rows.events[0].resolution = "precise-ish";
    expect(() => build(rows)).toThrow();
  });

  it("rejects capture windows whose end precedes their start", () => {
    const rows = sourceRows();
    expect(() => buildPaper1Evidence(rows.cases, rows.events, rows.intervals, {
      started_at: capture.ended_at, ended_at: capture.started_at,
    })).toThrow();
  });
});

describe("Paper 1 frozen snapshot verification", () => {
  it("evaluates all 30 assertions from an explicitly synthetic matching aggregate", () => {
    const result = verifyPaper1Snapshot(syntheticMatchingSnapshot());
    expect(result.checks).toHaveLength(30);
    expect(result.checks.every((check) => check.pass)).toBe(true);
    expect(result.checks.map(({ key }) => key)).toEqual(PAPER1_CHECKS.map(({ key }) => key));
    expect(result.meta.id).toBe(uuid(900));
  });

  it("reports drift from frozen figures without mutating the snapshot or any earlier result", () => {
    const snapshot = syntheticMatchingSnapshot();
    const original = structuredClone(snapshot);
    const before = verifyPaper1Snapshot(snapshot);
    const changed = structuredClone(snapshot);
    changed.payload.paper1.figures.gastro = 230;
    const after = verifyPaper1Snapshot(changed);
    expect(after.checks.filter((check) => !check.pass)).toEqual([
      { key: "gastro", label: "gastrointestinal cases", expected: 231, actual: 230, pass: false },
    ]);
    expect(before.checks.every((check) => check.pass)).toBe(true);
    expect(snapshot).toEqual(original);
  });

  it.each([null, {}, { payload: {} }, { meta: { label: "paper1-baseline-v1" }, payload: { counts: { cases: 836 } } }])("fails closed for malformed, old, or partial snapshots: %j", (snapshot) => {
    expect(() => verifyPaper1Snapshot(snapshot)).toThrow(/no live fallback/i);
  });

  it("rejects a missing figure instead of treating it as zero", () => {
    const snapshot = syntheticMatchingSnapshot();
    delete snapshot.payload.paper1.figures.computable_ttta;
    expect(() => verifyPaper1Snapshot(snapshot)).toThrow();
  });

  it("rejects a wrong label unless that exact alternative label was requested", () => {
    const snapshot = syntheticMatchingSnapshot();
    snapshot.meta.label = "synthetic-alternative-baseline";
    expect(() => verifyPaper1Snapshot(snapshot)).toThrow(/label/i);
    expect(() => verifyPaper1Snapshot(snapshot, "synthetic-alternative-baseline")).not.toThrow();
  });

  it.each(["version", "source"] as const)("rejects unsupported evidence %s", (key) => {
    const snapshot = syntheticMatchingSnapshot();
    if (key === "version") snapshot.payload.paper1.version = 2;
    else snapshot.payload.paper1.source = "prospective";
    expect(() => verifyPaper1Snapshot(snapshot)).toThrow();
  });

  it.each([-1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, "836", null])("rejects invalid aggregate counts: %j", (value) => {
    const evidence = syntheticMatchingSnapshot().payload.paper1;
    const figures = { ...evidence.figures, total_cases: value };
    expect(paper1EvidenceSchema.safeParse({ ...evidence, figures }).success).toBe(false);
  });

  it("rejects inconsistent cohort counts and figures larger than their cohort", () => {
    const evidence = syntheticMatchingSnapshot().payload.paper1;
    for (const patch of [
      { case_count: 835 }, { interval_count: 834 }, { event_count: 1 },
      { figures: { ...evidence.figures, gastro: 837 } },
      { figures: { ...evidence.figures, unclassified_resolution: 845 } },
    ]) expect(paper1EvidenceSchema.safeParse({ ...evidence, ...patch }).success).toBe(false);
  });

  it("rejects an event count below the sum of distinct milestone counts", () => {
    const evidence = syntheticMatchingSnapshot().payload.paper1;
    // 835 FIRST_CONTACT + 9 TRANSPORT_ACTIVATED records require at least 844 events.
    expect(paper1EvidenceSchema.safeParse({ ...evidence, event_count: 835 }).success).toBe(false);
  });

  it.each([
    ["gastro", 800],
    ["nationalities", 800],
    ["evacuations_with_transport", 10],
    ["off_midnight_transport", 10],
    ["computable_ttta", 10],
    ["computable_ttgp", 1],
    ["computable_ttdc", 1],
  ])("rejects impossible subset counts even below the overall cohort: %s", (key, value) => {
    const evidence = syntheticMatchingSnapshot().payload.paper1;
    expect(paper1EvidenceSchema.safeParse({
      ...evidence, figures: { ...evidence.figures, [key]: value },
    }).success).toBe(false);
  });

  it("rejects unexpected raw-record properties in the evidence", () => {
    const evidence = syntheticMatchingSnapshot().payload.paper1;
    expect(paper1EvidenceSchema.safeParse({ ...evidence, cases: [{ id: uuid(1) }] }).success).toBe(false);
    expect(paper1EvidenceSchema.safeParse({ ...evidence, figures: { ...evidence.figures, private_note: "synthetic" } }).success).toBe(false);
  });

  it("rejects malformed snapshot identity and capture chronology", () => {
    const snapshot = syntheticMatchingSnapshot();
    expect(() => verifyPaper1Snapshot({ ...snapshot, meta: { ...snapshot.meta, id: "bad-id" } })).toThrow();
    snapshot.meta.created_at = "2026-09-05T02:00:00.500Z";
    expect(() => verifyPaper1Snapshot(snapshot)).toThrow(/creation precedes/i);
    snapshot.meta.created_at = "not-a-date";
    expect(() => verifyPaper1Snapshot(snapshot)).toThrow();
    snapshot.meta.created_at = "2026-09-05T02:00:02Z";
    snapshot.payload.paper1.capture.started_at = "2026-09-05T02:00:03Z";
    expect(() => verifyPaper1Snapshot(snapshot)).toThrow();
  });
});
