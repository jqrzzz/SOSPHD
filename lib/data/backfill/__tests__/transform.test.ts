import { describe, it, expect } from "vitest";
import { historicalCaseToRows, ALL_MILESTONES } from "../transform";
import {
  normalizePayer,
  bucketDiagnosis,
  mapHistoricalStatus,
  mapHistoricalSeverity,
} from "../normalize";
import type { HistoricalCaseInput } from "../types";

describe("historicalCaseToRows", () => {
  it("derives one event per present milestone and logs the rest as missing", () => {
    const input: HistoricalCaseInput = {
      external_ref: "ROW-42",
      patient_ref: "H-0042",
      first_contact_at: "2019-03-01T08:00:00Z",
      transport_activated_at: "2019-03-01T09:30:00Z",
      // no triage / facility / payment / definitive / discharge
    };
    const { caseRow, events, missing } = historicalCaseToRows(input);

    expect(events.map((e) => e.event_type)).toEqual([
      "FIRST_CONTACT",
      "TRANSPORT_ACTIVATED",
    ]);
    expect(events[0].occurred_at).toBe("2019-03-01T08:00:00Z");
    expect(missing).toContain("GUARANTEED_PAYMENT");
    expect(missing).toContain("DISCHARGE");
    expect(events.length + missing.length).toBe(ALL_MILESTONES.length);

    expect(caseRow.source).toBe("backfill_2018_2023");
    expect(caseRow.external_ref).toBe("ROW-42");
    expect(caseRow.intake_date).toBe("2019-03-01T08:00:00Z");
    expect(caseRow.closed_date).toBeNull();
  });

  it("normalizes dimensions into the research model", () => {
    const { caseRow } = historicalCaseToRows({
      external_ref: "ROW-1",
      patient_ref: "H-0001",
      status_raw: "Resolved",
      severity_raw: "critical",
      payer_raw: "allianz partners",
      diagnosis_raw: "Acute MI / chest pain",
      discharge_at: "2020-01-02T00:00:00Z",
    });
    expect(caseRow.status).toBe("closed");
    expect(caseRow.severity).toBe(4);
    expect(caseRow.payer_entity).toBe("Allianz");
    expect(caseRow.diagnosis_bucket).toBe("cardiac");
    expect(caseRow.closed_date).toBe("2020-01-02T00:00:00Z");
  });

  it("produces idempotent occurred_at straight from the source timestamp", () => {
    const input: HistoricalCaseInput = {
      external_ref: "ROW-7",
      patient_ref: "H-0007",
      first_contact_at: "2021-06-15T12:00:00Z",
    };
    const a = historicalCaseToRows(input);
    const b = historicalCaseToRows(input);
    expect(a.events[0].occurred_at).toBe(b.events[0].occurred_at);
  });
});

describe("normalize helpers", () => {
  it("collapses payer aliases and preserves the long tail", () => {
    expect(normalizePayer("ALLIANZ")).toBe("Allianz");
    expect(normalizePayer("Allianz Global Assistance")).toBe("Allianz");
    expect(normalizePayer("cash")).toBe("Self-pay");
    expect(normalizePayer("Obscure Local Insurer")).toBe("Obscure Local Insurer");
    expect(normalizePayer("")).toBeNull();
    expect(normalizePayer(null)).toBeNull();
  });

  it("buckets diagnoses by keyword with 'other' fallback", () => {
    expect(bucketDiagnosis("fractured femur from a fall")).toBe("trauma");
    expect(bucketDiagnosis("decompression sickness")).toBe("diving");
    expect(bucketDiagnosis("something unmapped")).toBe("other");
    expect(bucketDiagnosis(null)).toBeNull();
  });

  it("maps status with closed-default for historical data", () => {
    expect(mapHistoricalStatus("open")).toBe("open");
    expect(mapHistoricalStatus("In Treatment")).toBe("active");
    expect(mapHistoricalStatus("resolved")).toBe("closed");
    expect(mapHistoricalStatus(undefined)).toBe("closed");
  });

  it("maps severity to 1-4 with sev-5 collapsing to 4", () => {
    expect(mapHistoricalSeverity("low")).toBe(1);
    expect(mapHistoricalSeverity("3")).toBe(3);
    expect(mapHistoricalSeverity("5")).toBe(4);
    expect(mapHistoricalSeverity("critical")).toBe(4);
    expect(mapHistoricalSeverity(null)).toBeNull();
  });
});
