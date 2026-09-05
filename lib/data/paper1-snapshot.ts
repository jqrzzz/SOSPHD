import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { BASELINE_SOURCE, buildPaper1Evidence } from "./paper1-evidence.mjs";

const PAGE_SIZE = 2_000;
const CASE_BATCH_SIZE = 100;
// These are failure limits, never sampling or truncation limits.
const MAX_CASES = 20_000;
const MAX_EVENTS = 200_000;

const CASE_COLUMNS = "id,source,country,intake_date,nationality,diagnosis_bucket,payer_entity,evacuated";
const EVENT_COLUMNS = "id,case_id,event_type,occurred_at,resolution";
const INTERVAL_COLUMNS = "case_id,ttta_minutes,ttgp_minutes,ttdc_minutes";

type RawRow = Record<string, unknown>;
type Page = { data: RawRow[] | null; count: number | null; error: unknown };

/** Read every counted row, including when the server caps a page below our request. */
async function readAll(
  surface: string,
  uniqueKey: string,
  maximum: number,
  readPage: (from: number, to: number) => PromiseLike<Page>,
): Promise<RawRow[]> {
  const rows: RawRow[] = [];
  const seen = new Set<string>();
  let expectedCount: number | undefined;

  do {
    let page: Page;
    try {
      page = await readPage(rows.length, rows.length + PAGE_SIZE - 1);
    } catch {
      throw new Error(`Paper 1 ${surface} read failed. No evidence was frozen.`);
    }
    if (page.error || !Array.isArray(page.data)) {
      throw new Error(`Paper 1 ${surface} read failed. No evidence was frozen.`);
    }
    if (page.count === null || !Number.isSafeInteger(page.count) || page.count < 0) {
      throw new Error(`Paper 1 ${surface} count is unavailable. No evidence was frozen.`);
    }
    if (page.count > maximum) {
      throw new Error(`Paper 1 ${surface} exceeds the supported read limit. No evidence was frozen.`);
    }
    if (expectedCount !== undefined && page.count !== expectedCount) {
      throw new Error(`Paper 1 ${surface} changed during the read. Retry when data is stable.`);
    }
    expectedCount = page.count;
    if (rows.length + page.data.length > expectedCount || page.data.length > PAGE_SIZE) {
      throw new Error(`Paper 1 ${surface} returned inconsistent rows. No evidence was frozen.`);
    }
    if (page.data.length === 0 && rows.length < expectedCount) {
      throw new Error(`Paper 1 ${surface} read is incomplete. No evidence was frozen.`);
    }
    for (const row of page.data) {
      const id = row?.[uniqueKey];
      if (typeof id !== "string" || id.length === 0 || seen.has(id)) {
        throw new Error(`Paper 1 ${surface} contains invalid or duplicate identifiers. No evidence was frozen.`);
      }
      seen.add(id);
      rows.push(row);
    }
  } while (rows.length < expectedCount);

  return rows;
}

/**
 * Use the already authenticated owner's client. All inputs come from explicit
 * research projections; operational rows and free text never enter this path.
 * Counts and IDs detect incomplete reads, but REST pagination is not a database
 * transaction: the evidence records its read window rather than claiming one.
 */
export async function loadPaper1Evidence(sb: SupabaseClient) {
  const started_at = new Date().toISOString();
  const cases = await readAll("cases", "id", MAX_CASES, (from, to) =>
    sb.schema("research")
      .from("cases")
      .select(CASE_COLUMNS, { count: "exact" })
      .eq("source", BASELINE_SOURCE)
      .order("id", { ascending: true })
      .range(from, to),
  );
  if (cases.length === 0) {
    throw new Error("Paper 1 baseline is empty or inaccessible. No evidence was frozen.");
  }

  const events: RawRow[] = [];
  const intervals: RawRow[] = [];
  const eventIds = new Set<string>();
  const intervalIds = new Set<string>();
  for (let offset = 0; offset < cases.length; offset += CASE_BATCH_SIZE) {
    const caseIds = cases.slice(offset, offset + CASE_BATCH_SIZE).map((row) => row.id as string);
    const caseIdSet = new Set(caseIds);
    const batchEvents = await readAll("events", "id", MAX_EVENTS - events.length, (from, to) =>
      sb.schema("research")
        .from("case_events")
        .select(EVENT_COLUMNS, { count: "exact" })
        .in("case_id", caseIds)
        .order("id", { ascending: true })
        .range(from, to),
    );
    const batchIntervals = await readAll("intervals", "case_id", MAX_CASES - intervals.length, (from, to) =>
      sb.schema("research")
        .from("case_intervals")
        .select(INTERVAL_COLUMNS, { count: "exact" })
        .in("case_id", caseIds)
        .order("case_id", { ascending: true })
        .range(from, to),
    );

    for (const row of batchEvents) {
      if (!caseIdSet.has(row.case_id as string) || eventIds.has(row.id as string)) {
        throw new Error("Paper 1 events have inconsistent cohort membership or identifiers. No evidence was frozen.");
      }
      eventIds.add(row.id as string);
      events.push(row);
    }
    for (const row of batchIntervals) {
      if (!caseIdSet.has(row.case_id as string) || intervalIds.has(row.case_id as string)) {
        throw new Error("Paper 1 intervals have inconsistent cohort membership or identifiers. No evidence was frozen.");
      }
      intervalIds.add(row.case_id as string);
      intervals.push(row);
    }
  }

  return buildPaper1Evidence(cases, events, intervals, {
    started_at,
    ended_at: new Date().toISOString(),
  });
}
