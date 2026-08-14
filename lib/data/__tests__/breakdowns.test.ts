import { describe, it, expect } from "vitest";
import { computeCaseBreakdowns } from "../analytics";
import type { Case } from "../types";

function mkCase(overrides: Partial<Case>): Case {
  return {
    id: crypto.randomUUID(),
    site_id: "Thailand",
    created_at: "2019-06-01T00:00:00Z",
    status: "closed",
    severity: 2,
    chief_complaint: "",
    patient_ref: "x",
    notes: "",
    source: "historical",
    ...overrides,
  };
}

describe("computeCaseBreakdowns", () => {
  it("counts dimensions descending and buckets missing values under the unknown label", () => {
    const cases = [
      mkCase({ corridor: "Krabi → Bangkok", payer_entity: "AXA", diagnosis_bucket: "gastro", evacuated: true }),
      mkCase({ corridor: "Krabi → Bangkok", payer_entity: "AXA", diagnosis_bucket: "trauma" }),
      mkCase({ corridor: null, payer_entity: null, diagnosis_bucket: null, evacuated: false }),
    ];
    const b = computeCaseBreakdowns(cases);
    expect(b.total_cases).toBe(3);
    expect(b.by_corridor[0]).toEqual({ label: "Krabi → Bangkok", count: 2 });
    expect(b.by_corridor[1]).toEqual({ label: "Unassigned", count: 1 });
    expect(b.by_payer[0]).toEqual({ label: "AXA", count: 2 });
    expect(b.by_diagnosis.find((d) => d.label === "unclassified")?.count).toBe(1);
    expect(b.evacuated_count).toBe(1);
  });

  it("empty input produces empty lists and zero totals", () => {
    const b = computeCaseBreakdowns([]);
    expect(b.total_cases).toBe(0);
    expect(b.by_corridor).toEqual([]);
    expect(b.evacuated_count).toBe(0);
  });
});
