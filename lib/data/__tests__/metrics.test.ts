import { describe, it, expect } from "vitest";
import {
  computeTTTA,
  computeTTGP,
  computeTTDC,
  computeAllMetrics,
  formatDuration,
} from "../metrics";
import type { CaseEvent } from "../types";

// ── Test fixtures ──────────────────────────────────────────────────────

/** Complete case: all milestone events present */
const fullCaseEvents: CaseEvent[] = [
  { id: "e1", case_id: "c1", occurred_at: "2026-02-01T08:00:00Z", event_type: "FIRST_CONTACT", actor_id: "op1", payload: "" },
  { id: "e2", case_id: "c1", occurred_at: "2026-02-01T08:18:00Z", event_type: "TRANSPORT_ACTIVATED", actor_id: "op1", payload: "" },
  { id: "e3", case_id: "c1", occurred_at: "2026-02-01T08:35:00Z", event_type: "GUARANTEED_PAYMENT", actor_id: "op2", payload: "" },
  { id: "e4", case_id: "c1", occurred_at: "2026-02-01T08:52:00Z", event_type: "DEFINITIVE_CARE_START", actor_id: "op1", payload: "" },
];

/** Payment-delay case: TTGP > TTDC (the harm scenario) */
const paymentDelayEvents: CaseEvent[] = [
  { id: "e1", case_id: "c2", occurred_at: "2026-02-03T11:00:00Z", event_type: "FIRST_CONTACT", actor_id: "op1", payload: "" },
  { id: "e2", case_id: "c2", occurred_at: "2026-02-03T11:08:00Z", event_type: "TRANSPORT_ACTIVATED", actor_id: "op1", payload: "" },
  { id: "e3", case_id: "c2", occurred_at: "2026-02-03T12:10:00Z", event_type: "DEFINITIVE_CARE_START", actor_id: "op1", payload: "" },
  { id: "e4", case_id: "c2", occurred_at: "2026-02-04T09:00:00Z", event_type: "GUARANTEED_PAYMENT", actor_id: "op2", payload: "" },
];

/** Partial case: only FIRST_CONTACT logged */
const partialEvents: CaseEvent[] = [
  { id: "e1", case_id: "c3", occurred_at: "2026-02-10T22:00:00Z", event_type: "FIRST_CONTACT", actor_id: "op1", payload: "" },
];

/** Empty case: no events at all */
const emptyEvents: CaseEvent[] = [];

// ── TTTA tests ─────────────────────────────────────────────────────────

describe("computeTTTA", () => {
  it("computes correct interval for a complete case", () => {
    const result = computeTTTA(fullCaseEvents);
    expect(result.abbreviation).toBe("TTTA");
    expect(result.value_ms).toBe(18 * 60 * 1000); // 18 minutes
    expect(result.is_running).toBe(false);
  });

  it("returns running clock when TRANSPORT_ACTIVATED is missing", () => {
    const result = computeTTTA(partialEvents);
    expect(result.is_running).toBe(true);
    expect(result.value_ms).toBeGreaterThan(0);
  });

  it("returns null value when FIRST_CONTACT is missing", () => {
    const result = computeTTTA(emptyEvents);
    expect(result.value_ms).toBeNull();
    expect(result.is_running).toBe(false);
  });
});

// ── TTGP tests ─────────────────────────────────────────────────────────

describe("computeTTGP", () => {
  it("computes correct interval for a complete case", () => {
    const result = computeTTGP(fullCaseEvents);
    expect(result.abbreviation).toBe("TTGP");
    expect(result.value_ms).toBe(35 * 60 * 1000); // 35 minutes
    expect(result.is_running).toBe(false);
  });

  it("detects payment delay scenario (TTGP >> TTDC)", () => {
    const ttgp = computeTTGP(paymentDelayEvents);
    const ttdc = computeTTDC(paymentDelayEvents);
    // TTGP = 22 hours, TTDC = 70 minutes
    expect(ttgp.value_ms!).toBeGreaterThan(ttdc.value_ms!);
    // Payment was 22 hours after first contact
    expect(ttgp.value_ms).toBe(22 * 60 * 60 * 1000);
  });
});

// ── TTDC tests ─────────────────────────────────────────────────────────

describe("computeTTDC", () => {
  it("computes correct interval for a complete case", () => {
    const result = computeTTDC(fullCaseEvents);
    expect(result.abbreviation).toBe("TTDC");
    expect(result.value_ms).toBe(52 * 60 * 1000); // 52 minutes
    expect(result.is_running).toBe(false);
  });

  it("returns running clock when DEFINITIVE_CARE_START is missing", () => {
    const result = computeTTDC(partialEvents);
    expect(result.is_running).toBe(true);
  });
});

// ── computeAllMetrics ──────────────────────────────────────────────────

describe("computeAllMetrics", () => {
  it("returns exactly 3 metrics in order: TTTA, TTGP, TTDC", () => {
    const results = computeAllMetrics(fullCaseEvents);
    expect(results).toHaveLength(3);
    expect(results[0].abbreviation).toBe("TTTA");
    expect(results[1].abbreviation).toBe("TTGP");
    expect(results[2].abbreviation).toBe("TTDC");
  });

  it("all metrics computable for a full case", () => {
    const results = computeAllMetrics(fullCaseEvents);
    results.forEach((r) => {
      expect(r.value_ms).not.toBeNull();
      expect(r.is_running).toBe(false);
    });
  });

  it("handles empty events without crashing", () => {
    const results = computeAllMetrics(emptyEvents);
    results.forEach((r) => {
      expect(r.value_ms).toBeNull();
      expect(r.is_running).toBe(false);
    });
  });
});

// ── formatDuration ─────────────────────────────────────────────────────

describe("formatDuration", () => {
  it("formats minutes only", () => {
    expect(formatDuration(18 * 60 * 1000)).toBe("18m");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(2 * 60 * 60 * 1000 + 30 * 60 * 1000)).toBe("2h 30m");
  });

  it("formats days, hours, and minutes", () => {
    expect(formatDuration(1 * 86400 * 1000 + 3 * 3600 * 1000 + 15 * 60 * 1000)).toBe("1d 3h 15m");
  });

  it("formats zero as 0m", () => {
    expect(formatDuration(0)).toBe("0m");
  });
});
