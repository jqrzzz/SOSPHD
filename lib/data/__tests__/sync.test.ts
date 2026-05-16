import { describe, it, expect } from "vitest";
import {
  asTimestamp,
  mapOperationalRowsToEvents,
  diffEventsToInsert,
  type OperationalRows,
  type NewEvent,
} from "../sync";

const CASE_ID = "case-1";

// ── asTimestamp — defensive parsing ─────────────────────────────────

describe("asTimestamp", () => {
  it("parses ISO 8601 timestamps to canonical ISO", () => {
    expect(asTimestamp("2026-05-16T10:00:00Z")).toBe("2026-05-16T10:00:00.000Z");
  });

  it("normalizes timezone offsets to UTC", () => {
    expect(asTimestamp("2026-05-16T15:00:00+05:00")).toBe(
      "2026-05-16T10:00:00.000Z",
    );
  });

  it("accepts date-only strings (treated as midnight UTC)", () => {
    const result = asTimestamp("2026-05-16");
    expect(result).not.toBeNull();
    expect(new Date(result!).getUTCFullYear()).toBe(2026);
  });

  it("returns null for empty / whitespace / non-strings", () => {
    expect(asTimestamp(null)).toBeNull();
    expect(asTimestamp(undefined)).toBeNull();
    expect(asTimestamp("")).toBeNull();
    expect(asTimestamp("   ")).toBeNull();
    expect(asTimestamp(123)).toBeNull();
    expect(asTimestamp({})).toBeNull();
  });

  it("returns null for unparseable strings", () => {
    expect(asTimestamp("not a date")).toBeNull();
    expect(asTimestamp("2026-13-99")).toBeNull();
  });
});

// ── mapOperationalRowsToEvents — the core mapping ───────────────────

describe("mapOperationalRowsToEvents", () => {
  it("emits FIRST_CONTACT + TRIAGE_COMPLETE + DISCHARGE from cases", () => {
    const rows: OperationalRows = {
      caseRow: {
        intake_at: "2026-05-16T10:00:00Z",
        triage_at: "2026-05-16T10:05:00Z",
        resolved_at: "2026-05-16T12:00:00Z",
      },
      transports: [],
      gops: [],
      episodes: [],
    };
    const events = mapOperationalRowsToEvents(CASE_ID, rows);
    expect(events.map((e) => e.event_type)).toEqual([
      "FIRST_CONTACT",
      "TRIAGE_COMPLETE",
      "DISCHARGE",
    ]);
    expect(events.every((e) => e.case_id === CASE_ID)).toBe(true);
    expect(events.every((e) => e.actor_id === "soscommand_sync")).toBe(true);
  });

  it("falls through resolved_at → closed_at → closed_date for DISCHARGE", () => {
    const onlyClosedAt = mapOperationalRowsToEvents(CASE_ID, {
      caseRow: { closed_at: "2026-05-16T11:00:00Z" },
      transports: [],
      gops: [],
      episodes: [],
    });
    expect(
      onlyClosedAt.find((e) => e.event_type === "DISCHARGE")?.occurred_at,
    ).toBe("2026-05-16T11:00:00.000Z");

    const onlyClosedDate = mapOperationalRowsToEvents(CASE_ID, {
      caseRow: { closed_date: "2026-05-16" },
      transports: [],
      gops: [],
      episodes: [],
    });
    expect(
      onlyClosedDate.find((e) => e.event_type === "DISCHARGE"),
    ).toBeDefined();
  });

  it("picks the earliest non-null actual_departure / actual_arrival", () => {
    const rows: OperationalRows = {
      caseRow: null,
      transports: [
        { actual_departure: null, actual_arrival: null },
        {
          actual_departure: "2026-05-16T10:30:00Z",
          actual_arrival: "2026-05-16T10:55:00Z",
        },
        {
          actual_departure: "2026-05-16T11:00:00Z",
          actual_arrival: "2026-05-16T11:25:00Z",
        },
      ],
      gops: [],
      episodes: [],
    };
    const events = mapOperationalRowsToEvents(CASE_ID, rows);
    const dep = events.find((e) => e.event_type === "TRANSPORT_ACTIVATED");
    const arr = events.find((e) => e.event_type === "FACILITY_ARRIVAL");
    expect(dep?.occurred_at).toBe("2026-05-16T10:30:00.000Z");
    expect(arr?.occurred_at).toBe("2026-05-16T10:55:00.000Z");
  });

  it("emits GUARANTEED_PAYMENT from earliest issued GOP", () => {
    const rows: OperationalRows = {
      caseRow: null,
      transports: [],
      gops: [{ issued_date: "2026-05-16" }, { issued_date: "2026-05-17" }],
      episodes: [],
    };
    const events = mapOperationalRowsToEvents(CASE_ID, rows);
    expect(events.find((e) => e.event_type === "GUARANTEED_PAYMENT"))
      .toBeDefined();
  });

  it("emits DEFINITIVE_CARE_START from earliest episode start_date", () => {
    const rows: OperationalRows = {
      caseRow: null,
      transports: [],
      gops: [],
      episodes: [{ start_date: "2026-05-16T11:30:00Z" }],
    };
    const events = mapOperationalRowsToEvents(CASE_ID, rows);
    expect(
      events.find((e) => e.event_type === "DEFINITIVE_CARE_START")?.occurred_at,
    ).toBe("2026-05-16T11:30:00.000Z");
  });

  it("skips event types whose source timestamp is null", () => {
    const rows: OperationalRows = {
      caseRow: { intake_at: "2026-05-16T10:00:00Z", triage_at: null },
      transports: [],
      gops: [],
      episodes: [],
    };
    const events = mapOperationalRowsToEvents(CASE_ID, rows);
    expect(events.map((e) => e.event_type)).toEqual(["FIRST_CONTACT"]);
  });

  it("stamps source provenance into payload as JSON", () => {
    const rows: OperationalRows = {
      caseRow: { intake_at: "2026-05-16T10:00:00Z" },
      transports: [],
      gops: [],
      episodes: [],
    };
    const events = mapOperationalRowsToEvents(CASE_ID, rows);
    const payload = JSON.parse(events[0].payload);
    expect(payload.source).toBe("cases.intake_at");
  });

  it("returns empty array when no data is available", () => {
    const events = mapOperationalRowsToEvents(CASE_ID, {
      caseRow: null,
      transports: [],
      gops: [],
      episodes: [],
    });
    expect(events).toEqual([]);
  });
});

// ── diffEventsToInsert — idempotency ────────────────────────────────

describe("diffEventsToInsert", () => {
  const baseEvent = (
    type: NewEvent["event_type"],
    iso: string,
  ): NewEvent => ({
    case_id: CASE_ID,
    event_type: type,
    occurred_at: iso,
    actor_id: "soscommand_sync",
    payload: "{}",
  });

  it("returns all expected events when nothing exists yet", () => {
    const expected = [
      baseEvent("FIRST_CONTACT", "2026-05-16T10:00:00.000Z"),
      baseEvent("TRIAGE_COMPLETE", "2026-05-16T10:05:00.000Z"),
    ];
    expect(diffEventsToInsert(expected, [])).toEqual(expected);
  });

  it("skips events already present (same type + timestamp)", () => {
    const expected = [
      baseEvent("FIRST_CONTACT", "2026-05-16T10:00:00.000Z"),
      baseEvent("TRIAGE_COMPLETE", "2026-05-16T10:05:00.000Z"),
    ];
    const existing = [
      { event_type: "FIRST_CONTACT" as const, occurred_at: "2026-05-16T10:00:00.000Z" },
    ];
    const result = diffEventsToInsert(expected, existing);
    expect(result.map((e) => e.event_type)).toEqual(["TRIAGE_COMPLETE"]);
  });

  it("normalizes existing timestamps before comparing", () => {
    const expected = [
      baseEvent("FIRST_CONTACT", "2026-05-16T10:00:00.000Z"),
    ];
    // Existing has unnormalized timezone offset — should still dedup
    const existing = [
      { event_type: "FIRST_CONTACT" as const, occurred_at: "2026-05-16T15:00:00+05:00" },
    ];
    expect(diffEventsToInsert(expected, existing)).toEqual([]);
  });

  it("inserts when same type exists at a DIFFERENT timestamp (multiple visits)", () => {
    const expected = [
      baseEvent("FACILITY_ARRIVAL", "2026-05-16T12:00:00.000Z"),
    ];
    const existing = [
      // Earlier arrival at a different facility
      { event_type: "FACILITY_ARRIVAL" as const, occurred_at: "2026-05-16T10:00:00.000Z" },
    ];
    expect(diffEventsToInsert(expected, existing)).toEqual(expected);
  });

  it("is idempotent: applying the diff twice produces no new events", () => {
    const expected = [
      baseEvent("FIRST_CONTACT", "2026-05-16T10:00:00.000Z"),
      baseEvent("TRIAGE_COMPLETE", "2026-05-16T10:05:00.000Z"),
    ];
    // First pass: nothing exists → insert all
    const firstPass = diffEventsToInsert(expected, []);
    expect(firstPass).toHaveLength(2);
    // Second pass: pretend the first pass was persisted
    const secondPass = diffEventsToInsert(
      expected,
      firstPass.map((e) => ({
        event_type: e.event_type,
        occurred_at: e.occurred_at,
      })),
    );
    expect(secondPass).toEqual([]);
  });
});
