import { describe, it, expect } from "vitest";
import { computeMissingness, MILESTONE_EVENT_TYPES } from "../analytics";
import type { CaseEvent, EventType } from "../types";

function ev(case_id: string, event_type: EventType): CaseEvent {
  return {
    id: `${case_id}-${event_type}`,
    case_id,
    occurred_at: "2026-03-01T10:00:00Z",
    event_type,
    actor_id: "op-1",
    payload: "",
  };
}

describe("computeMissingness (Paper 1 denominators)", () => {
  it("empty input produces zero totals and null rates", () => {
    const report = computeMissingness([], []);
    expect(report.total_cases).toBe(0);
    expect(report.complete_cases).toBe(0);
    for (const m of report.by_milestone) {
      expect(m.present).toBe(0);
      expect(m.missing).toBe(0);
      expect(m.missing_rate).toBeNull();
    }
  });

  it("counts presence per milestone and identifies complete cases", () => {
    const cases = [{ id: "c1" }, { id: "c2" }];
    // c1 has every milestone; c2 has only FIRST_CONTACT.
    const events: CaseEvent[] = [
      ...MILESTONE_EVENT_TYPES.map((t) => ev("c1", t)),
      ev("c2", "FIRST_CONTACT"),
    ];
    const report = computeMissingness(cases, events);

    expect(report.total_cases).toBe(2);
    expect(report.complete_cases).toBe(1);

    const first = report.by_milestone.find((m) => m.event_type === "FIRST_CONTACT")!;
    expect(first.present).toBe(2);
    expect(first.missing).toBe(0);
    expect(first.missing_rate).toBe(0);

    const gop = report.by_milestone.find((m) => m.event_type === "GUARANTEED_PAYMENT")!;
    expect(gop.present).toBe(1);
    expect(gop.missing).toBe(1);
    expect(gop.missing_rate).toBe(0.5);
  });

  it("duplicate events of one type count presence once, and NOTE never counts", () => {
    const cases = [{ id: "c1" }];
    const events = [
      ev("c1", "FIRST_CONTACT"),
      { ...ev("c1", "FIRST_CONTACT"), id: "dup" },
      ev("c1", "NOTE"),
    ];
    const report = computeMissingness(cases, events);
    const first = report.by_milestone.find((m) => m.event_type === "FIRST_CONTACT")!;
    expect(first.present).toBe(1);
    expect(report.by_milestone.some((m) => (m.event_type as string) === "NOTE")).toBe(false);
    expect(report.complete_cases).toBe(0);
  });

  it("ignores events for cases outside the case list", () => {
    const report = computeMissingness([{ id: "c1" }], [ev("ghost", "FIRST_CONTACT")]);
    const first = report.by_milestone.find((m) => m.event_type === "FIRST_CONTACT")!;
    expect(first.present).toBe(0);
    expect(first.missing).toBe(1);
  });
});
