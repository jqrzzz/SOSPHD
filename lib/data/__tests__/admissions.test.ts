import { describe, expect, it } from "vitest";
import {
  daysUntil,
  deadlineUrgency,
  readiness,
  type InstitutionRequirement,
} from "../admissions-types";

function req(over: Partial<InstitutionRequirement>): InstitutionRequirement {
  return {
    id: crypto.randomUUID(),
    created_at: "2026-08-14T00:00:00Z",
    user_id: "u",
    institution_id: "i",
    kind: "document",
    label: "x",
    detail: null,
    due_date: null,
    mandatory: true,
    status: "not_started",
    source_url: null,
    verified_at: null,
    ...over,
  };
}

describe("daysUntil", () => {
  const now = new Date("2026-08-14T09:00:00Z");

  it("counts whole days forward", () => {
    expect(daysUntil("2026-10-01", now)).toBe(48);
    expect(daysUntil("2026-08-15", now)).toBe(1);
  });

  it("returns 0 for today regardless of time of day", () => {
    expect(daysUntil("2026-08-14", now)).toBe(0);
    expect(daysUntil("2026-08-14", new Date("2026-08-14T23:30:00Z"))).toBe(0);
  });

  it("goes negative for past dates", () => {
    expect(daysUntil("2026-08-01", now)).toBe(-13);
  });
});

describe("deadlineUrgency", () => {
  it("bands by days remaining", () => {
    expect(deadlineUrgency(-1)).toBe("past");
    expect(deadlineUrgency(0)).toBe("critical");
    expect(deadlineUrgency(30)).toBe("critical");
    expect(deadlineUrgency(31)).toBe("soon");
    expect(deadlineUrgency(90)).toBe("soon");
    expect(deadlineUrgency(91)).toBe("later");
  });
});

describe("readiness", () => {
  it("counts done and waived as settled", () => {
    expect(
      readiness([
        req({ status: "done" }),
        req({ status: "waived" }),
        req({ status: "not_started" }),
        req({ status: "in_progress" }),
      ]),
    ).toBe(50);
  });

  it("ignores optional and not-applicable requirements", () => {
    expect(
      readiness([
        req({ status: "done" }),
        req({ status: "not_started", mandatory: false }),
        req({ status: "not_applicable" }),
      ]),
    ).toBe(100);
  });

  it("is 0 when there is nothing mandatory to track", () => {
    expect(readiness([])).toBe(0);
    expect(readiness([req({ mandatory: false })])).toBe(0);
  });
});
