import { describe, it, expect } from "vitest";
import {
  mapStatus,
  mapPriority,
  toResearchCase,
  mergeAndFilterCases,
  OP_STATUSES_BY_RESEARCH_BUCKET,
} from "../store";
import type { Case } from "../types";

/* ─── Measurement projection — THIS IS Paper 1's methodology ─────────── */

describe("mapStatus (19 operational statuses → 3 research states)", () => {
  const open = [
    "intake",
    "pending",
    "pending_info",
    "pending_authorization",
    "pending_external",
    "needs_review",
    "verified",
    "rejected",
  ];
  const active = [
    "active",
    "in_progress",
    "in_treatment",
    "transport_arranged",
    "triage",
  ];
  const closed = [
    "discharged",
    "resolved",
    "billing",
    "claims",
    "closed",
    "cancelled",
  ];

  it.each(open)("'%s' → open", (s) => expect(mapStatus(s)).toBe("open"));
  it.each(active)("'%s' → active", (s) => expect(mapStatus(s)).toBe("active"));
  it.each(closed)("'%s' → closed", (s) => expect(mapStatus(s)).toBe("closed"));

  it("covers exactly 19 known statuses (drift tripwire)", () => {
    expect(open.length + active.length + closed.length).toBe(19);
  });

  it("unknown future status defaults to 'open' (fail-safe, not crash)", () => {
    expect(mapStatus("some_new_enum_value")).toBe("open");
    expect(mapStatus("")).toBe("open");
  });
});

describe("mapPriority (operational priority → severity 1-4)", () => {
  it("maps monotonically low→1, normal→2, high→3, critical→4", () => {
    expect(mapPriority("low")).toBe(1);
    expect(mapPriority("normal")).toBe(2);
    expect(mapPriority("high")).toBe(3);
    expect(mapPriority("critical")).toBe(4);
  });
  it("unknown priority defaults to 2 (normal)", () => {
    expect(mapPriority("unknown")).toBe(2);
    expect(mapPriority("")).toBe(2);
  });
});

/* ─── Filter-pushdown symmetry: the DB .in() filter must agree with
 *     mapStatus, or status-filtered queries silently return wrong rows. */

describe("OP_STATUSES_BY_RESEARCH_BUCKET ↔ mapStatus symmetry", () => {
  it("every operational status in a bucket maps back to that bucket", () => {
    for (const bucket of ["open", "active", "closed"] as const) {
      for (const status of OP_STATUSES_BY_RESEARCH_BUCKET[bucket]) {
        expect(mapStatus(status)).toBe(bucket);
      }
    }
  });

  it("the pushdown table and mapStatus cover the same 19 statuses", () => {
    const total = (["open", "active", "closed"] as const).reduce(
      (n, b) => n + OP_STATUSES_BY_RESEARCH_BUCKET[b].length,
      0,
    );
    expect(total).toBe(19);
  });
});

/* ─── Phase 9: research.cases row → Case ─────────────────────────────── */

describe("toResearchCase", () => {
  it("maps a well-formed research row to a historical Case", () => {
    const c = toResearchCase({
      id: "r1",
      status: "closed",
      severity: 3,
      country: "Thailand",
      incident_summary: "diving incident",
      patient_ref: "H-0001",
      created_at: "2019-05-01T00:00:00Z",
    });
    expect(c).toMatchObject({
      id: "r1",
      status: "closed",
      severity: 3,
      site_id: "Thailand",
      chief_complaint: "diving incident",
      patient_ref: "H-0001",
      source: "historical",
    });
  });

  it("defaults null/out-of-range severity to 2 and missing fields safely", () => {
    expect(toResearchCase({ id: "r2", patient_ref: "H", created_at: "2020-01-01T00:00:00Z" }).severity).toBe(2);
    expect(toResearchCase({ id: "r3", patient_ref: "H", severity: 9, created_at: "2020-01-01T00:00:00Z" }).severity).toBe(2);
    expect(toResearchCase({ id: "r4", patient_ref: "H", created_at: "2020-01-01T00:00:00Z" }).site_id).toBe("unknown");
    expect(toResearchCase({ id: "r5", patient_ref: "H", created_at: "2020-01-01T00:00:00Z" }).status).toBe("closed");
  });
});

/* ─── Phase 9: union merge / sort / search ───────────────────────────── */

describe("mergeAndFilterCases", () => {
  const mk = (
    id: string,
    created_at: string,
    extra: Partial<Case> = {},
  ): Case => ({
    id,
    site_id: "x",
    created_at,
    status: "closed",
    severity: 2,
    chief_complaint: "",
    patient_ref: id,
    notes: "",
    ...extra,
  });

  it("concatenates operational + research, newest first", () => {
    const op = [mk("op1", "2026-01-01T00:00:00Z")];
    const re = [
      mk("re1", "2019-01-01T00:00:00Z"),
      mk("re2", "2027-01-01T00:00:00Z"),
    ];
    const out = mergeAndFilterCases(op, re);
    expect(out.map((c) => c.id)).toEqual(["re2", "op1", "re1"]);
  });

  it("preserves both sources (no dropping)", () => {
    const out = mergeAndFilterCases(
      [mk("op1", "2026-01-01T00:00:00Z")],
      [mk("re1", "2025-01-01T00:00:00Z")],
    );
    expect(out).toHaveLength(2);
  });

  it("search matches patient_ref and chief_complaint, case-insensitively", () => {
    const op = [
      mk("op1", "2026-01-01T00:00:00Z", { patient_ref: "SOS-042" }),
      mk("op2", "2026-01-02T00:00:00Z", { chief_complaint: "Chest pain" }),
    ];
    const re = [mk("re1", "2026-01-03T00:00:00Z", { patient_ref: "H-9" })];
    expect(mergeAndFilterCases(op, re, "sos-042").map((c) => c.id)).toEqual(["op1"]);
    expect(mergeAndFilterCases(op, re, "CHEST").map((c) => c.id)).toEqual(["op2"]);
    expect(mergeAndFilterCases(op, re, "zzz")).toHaveLength(0);
  });

  it("no search returns the full sorted union", () => {
    expect(
      mergeAndFilterCases([mk("a", "2026-01-01T00:00:00Z")], []),
    ).toHaveLength(1);
  });
});
