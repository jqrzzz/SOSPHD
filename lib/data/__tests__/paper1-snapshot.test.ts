import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));
const { buildEvidence } = vi.hoisted(() => ({
  buildEvidence: vi.fn((cases, events, intervals, readWindow) => ({
    cases, events, intervals, readWindow,
  })),
}));
vi.mock("../paper1-evidence.mjs", () => ({
  BASELINE_SOURCE: "backfill_2018_2023",
  buildPaper1Evidence: buildEvidence,
}));

import { loadPaper1Evidence } from "../paper1-snapshot";

type Row = Record<string, unknown>;
type Table = "cases" | "case_events" | "case_intervals";
type Page = { data: Row[] | null; count: number | null; error: unknown };
type Request = {
  schema: string;
  table: Table;
  projection: string;
  count: string;
  order: string;
  ascending: boolean;
  equals: [string, unknown][];
  included: [string, string[]][];
  from: number;
  to: number;
};

function baseline(size: number): Row[] {
  return Array.from({ length: size }, (_, index) => ({
    id: `case-${String(index).padStart(5, "0")}`,
    source: "backfill_2018_2023",
    country: "Thailand",
    intake_date: "2020-01-01",
    nationality: "UK",
    diagnosis_bucket: "medical",
    payer_entity: null,
    evacuated: false,
  }));
}

function events(size: number, caseId = "case-00000"): Row[] {
  return Array.from({ length: size }, (_, index) => ({
    id: `event-${String(index).padStart(5, "0")}`,
    case_id: caseId,
    event_type: "NOTE",
    occurred_at: "2020-01-01T00:00:00Z",
    resolution: "date",
  }));
}

function intervals(cases: Row[]): Row[] {
  return cases.map((row) => ({
    case_id: row.id,
    ttta_minutes: null,
    ttgp_minutes: null,
    ttdc_minutes: null,
  }));
}

function database(
  rows: Partial<Record<Table, Row[]>> = {},
  options: {
    cap?: number;
    override?: (request: Request, result: Page) => Page;
  } = {},
) {
  const requests: Request[] = [];
  const sb = {
    schema(schema: string) {
      return {
        from(table: Table) {
          const request: Request = {
            schema, table, projection: "", count: "", order: "", ascending: false,
            equals: [], included: [], from: 0, to: 0,
          };
          const query = {
            select(projection: string, selection: { count: string }) {
              request.projection = projection;
              request.count = selection.count;
              return query;
            },
            eq(column: string, value: unknown) {
              request.equals.push([column, value]);
              return query;
            },
            in(column: string, values: string[]) {
              request.included.push([column, values]);
              return query;
            },
            order(column: string, ordering: { ascending: boolean }) {
              request.order = column;
              request.ascending = ordering.ascending;
              return query;
            },
            async range(from: number, to: number) {
              request.from = from;
              request.to = to;
              requests.push(request);
              const matching = [...(rows[table] ?? [])]
                .filter((row) => request.equals.every(([column, value]) => row[column] === value))
                .filter((row) => request.included.every(([column, values]) => values.includes(row[column] as string)))
                .sort((a, b) => String(a[request.order]).localeCompare(String(b[request.order])));
              const pageRows = matching.slice(from, Math.min(to + 1, from + (options.cap ?? 1_000)))
                .map((row) => Object.fromEntries(request.projection.split(",").map((column) => [column, row[column]])));
              const result: Page = { data: pageRows, count: matching.length, error: null };
              return options.override?.(request, result) ?? result;
            },
          };
          return query;
        },
      };
    },
  } as unknown as SupabaseClient;
  return { sb, requests };
}

beforeEach(() => buildEvidence.mockClear());

describe("loadPaper1Evidence", () => {
  it("includes rows beyond the server's 1,000-row cap and advances by returned length", async () => {
    const cases = baseline(1_101);
    const db = database({ cases, case_events: events(1_101), case_intervals: intervals(cases) });

    await loadPaper1Evidence(db.sb);

    const [loadedCases, loadedEvents, loadedIntervals, window] = buildEvidence.mock.calls[0];
    expect(loadedCases).toHaveLength(1_101);
    expect(loadedEvents).toHaveLength(1_101);
    expect(loadedIntervals).toHaveLength(1_101);
    expect(loadedEvents.at(-1).id).toBe("event-01100");
    expect(db.requests.filter((r) => r.table === "cases").map((r) => r.from)).toEqual([0, 1_000]);
    expect(db.requests.some((r) => r.table === "case_events" && r.from === 1_000)).toBe(true);
    expect(Number.isFinite(Date.parse(window.started_at))).toBe(true);
    expect(Date.parse(window.ended_at)).toBeGreaterThanOrEqual(Date.parse(window.started_at));
  });

  it("paginates all three surfaces even with a server cap of two", async () => {
    const cases = baseline(5);
    const db = database({ cases, case_events: events(5), case_intervals: intervals(cases) }, { cap: 2 });
    await loadPaper1Evidence(db.sb);
    for (const table of ["cases", "case_events", "case_intervals"] as const) {
      expect(db.requests.filter((r) => r.table === table).map((r) => r.from)).toEqual([0, 2, 4]);
    }
    for (const rows of buildEvidence.mock.calls[0].slice(0, 3)) expect(rows).toHaveLength(5);
  });

  it("restricts reads to explicit research projections, the baseline source, and batches of at most 100 IDs", async () => {
    const cases = baseline(205);
    const db = database({ cases: [...cases, { ...baseline(1)[0], id: "other", source: "prospective", notes: "excluded" }] });
    await loadPaper1Evidence(db.sb);

    const projection: Record<Table, string> = {
      cases: "id,source,country,intake_date,nationality,diagnosis_bucket,payer_entity,evacuated",
      case_events: "id,case_id,event_type,occurred_at,resolution",
      case_intervals: "case_id,ttta_minutes,ttgp_minutes,ttdc_minutes",
    };
    for (const request of db.requests) {
      expect(request.schema).toBe("research");
      expect(request.projection).toBe(projection[request.table]);
      expect(request.count).toBe("exact");
      expect(request.order).toBe(request.table === "case_intervals" ? "case_id" : "id");
      expect(request.ascending).toBe(true);
      if (request.table === "cases") {
        expect(request.equals).toEqual([["source", "backfill_2018_2023"]]);
      } else {
        expect(request.included).toHaveLength(1);
        expect(request.included[0][0]).toBe("case_id");
        expect(request.included[0][1].length).toBeLessThanOrEqual(100);
      }
    }
    for (const table of ["case_events", "case_intervals"] as const) {
      const batches = db.requests.filter((r) => r.table === table).map((r) => r.included[0][1]);
      expect(batches.map((ids) => ids.length)).toEqual([100, 100, 5]);
      expect(batches.flat()).toEqual(cases.map((row) => row.id));
    }
    expect(buildEvidence.mock.calls[0][0]).toHaveLength(205);
  });

  it("rejects a partially successful read and does not expose database error contents", async () => {
    const db = database({ cases: baseline(1), case_events: events(3) }, {
      cap: 2,
      override: (request, result) => request.table === "case_events" && request.from > 0
        ? { ...result, error: { message: "sensitive database detail" } }
        : result,
    });
    await expect(loadPaper1Evidence(db.sb)).rejects.toThrow("Paper 1 events read failed.");
    expect(buildEvidence).not.toHaveBeenCalled();
  });

  it("replaces thrown client errors with a generic surface error", async () => {
    const db = database({ cases: baseline(1) }, { override() { throw new Error("raw detail"); } });
    await expect(loadPaper1Evidence(db.sb)).rejects.toThrow(/^Paper 1 cases read failed\. No evidence was frozen\.$/);
    expect(buildEvidence).not.toHaveBeenCalled();
  });

  it.each([null, -1, 1.5, Number.NaN])("rejects unavailable or invalid exact count %s", async (count) => {
    const db = database({ cases: baseline(1) }, { override: (_, result) => ({ ...result, count }) });
    await expect(loadPaper1Evidence(db.sb)).rejects.toThrow("count is unavailable");
    expect(buildEvidence).not.toHaveBeenCalled();
  });

  it.each(["cases", "case_events", "case_intervals"] as const)("rejects null data on %s", async (table) => {
    const cases = baseline(3);
    const db = database({ cases, case_events: events(3), case_intervals: intervals(cases) }, {
      override: (request, result) => request.table === table ? { ...result, data: null } : result,
    });
    await expect(loadPaper1Evidence(db.sb)).rejects.toThrow("read failed");
    expect(buildEvidence).not.toHaveBeenCalled();
  });

  it.each(["cases", "case_events", "case_intervals"] as const)("rejects count drift on %s", async (table) => {
    const cases = baseline(3);
    const db = database({ cases, case_events: events(3), case_intervals: intervals(cases) }, {
      cap: 2,
      override: (request, result) => request.table === table && request.from > 0 ? { ...result, count: 4 } : result,
    });
    await expect(loadPaper1Evidence(db.sb)).rejects.toThrow("changed during the read");
    expect(buildEvidence).not.toHaveBeenCalled();
  });

  it.each(["cases", "case_events", "case_intervals"] as const)("rejects premature empty pages on %s", async (table) => {
    const cases = baseline(3);
    const db = database({ cases, case_events: events(3), case_intervals: intervals(cases) }, {
      cap: 2,
      override: (request, result) => request.table === table && request.from > 0 ? { ...result, data: [] } : result,
    });
    await expect(loadPaper1Evidence(db.sb)).rejects.toThrow("read is incomplete");
    expect(buildEvidence).not.toHaveBeenCalled();
  });

  it.each(["cases", "case_events", "case_intervals"] as const)("rejects duplicate identifiers on %s", async (table) => {
    const cases = baseline(3);
    const db = database({ cases, case_events: events(3), case_intervals: intervals(cases) }, {
      cap: 2,
      override: (request, result) => request.table === table && request.from > 0
        ? { ...result, data: [{ ...result.data![0], [table === "case_intervals" ? "case_id" : "id"]: table === "case_events" ? "event-00000" : "case-00000" }] }
        : result,
    });
    await expect(loadPaper1Evidence(db.sb)).rejects.toThrow("invalid or duplicate identifiers");
    expect(buildEvidence).not.toHaveBeenCalled();
  });

  it("rejects an empty or inaccessible baseline before reading related tables", async () => {
    const db = database();
    await expect(loadPaper1Evidence(db.sb)).rejects.toThrow("baseline is empty or inaccessible");
    expect(db.requests).toHaveLength(1);
    expect(buildEvidence).not.toHaveBeenCalled();
  });

  it.each([
    ["cases", 20_001], ["case_events", 200_001], ["case_intervals", 20_001],
  ] as const)("fails at the supported row limit on %s instead of returning a sample", async (table, count) => {
    const db = database({ cases: baseline(1) }, {
      override: (request, result) => request.table === table ? { ...result, count } : result,
    });
    await expect(loadPaper1Evidence(db.sb)).rejects.toThrow("exceeds the supported read limit");
    expect(buildEvidence).not.toHaveBeenCalled();
  });

  it.each(["case_events", "case_intervals"] as const)("rejects related rows outside the requested cohort in %s", async (table) => {
    const cases = baseline(1);
    const db = database({ cases, case_events: events(1), case_intervals: intervals(cases) }, {
      override: (request, result) => request.table === table
        ? { ...result, data: [{ ...result.data![0], case_id: "outside-cohort" }] }
        : result,
    });
    await expect(loadPaper1Evidence(db.sb)).rejects.toThrow("inconsistent cohort membership");
    expect(buildEvidence).not.toHaveBeenCalled();
  });
});
