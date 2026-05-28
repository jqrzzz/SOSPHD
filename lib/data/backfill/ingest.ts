/* ─── Historical Backfill — writer (SERVER ONLY) ───────────────────────
 *  Persists HistoricalCaseInput[] into research.cases + research.case_events
 *  under a single ingest_batch_id, idempotently. This is the reusable,
 *  schema-correct half of the backfill; the spreadsheet parser that
 *  produces the inputs must be written against the real sheet headers
 *  (docs/backfill-plan.md §5.4).
 *
 *  Idempotency: case_events insert uses ON CONFLICT on the dedup
 *  constraint (case_id, event_type, occurred_at, actor_id). With a fixed
 *  actor_id and deterministic occurred_at, re-running a batch never
 *  duplicates events. research.cases dedups on (source, external_ref)
 *  via a pre-check so re-running doesn't duplicate case rows either.
 * ────────────────────────────────────────────────────────────────────── */

import { randomUUID } from "node:crypto";
import { requireAuthOrThrow } from "@/lib/supabase/server-auth";
import { historicalCaseToRows, ALL_MILESTONES } from "./transform";
import type { HistoricalCaseInput, IngestResult, DerivedEvent } from "./types";

const BACKFILL_ACTOR_ID = "historical_backfill";

/**
 * Ingest a batch of historical cases. Auth-gated (must be an allowlisted
 * user per SD-001 — RLS enforces it on write). Returns counts + a
 * per-milestone missingness log for Paper 1's denominator reporting.
 */
export async function ingestHistoricalCases(
  inputs: HistoricalCaseInput[],
): Promise<IngestResult> {
  const { supabase: sb } = await requireAuthOrThrow();
  const batchId = randomUUID();

  const missingness = Object.fromEntries(
    ALL_MILESTONES.map((m) => [m, 0]),
  ) as IngestResult["missingness"];

  let casesInserted = 0;
  let eventsInserted = 0;

  for (const input of inputs) {
    const { caseRow, events, missing } = historicalCaseToRows(input);
    for (const m of missing) missingness[m] += 1;

    // Skip if this external_ref was already ingested (idempotent re-run).
    const { data: existing } = await sb
      .schema("research")
      .from("cases")
      .select("id")
      .eq("source", caseRow.source)
      .eq("external_ref", caseRow.external_ref)
      .maybeSingle();

    let caseId: string;
    if (existing?.id) {
      caseId = existing.id as string;
    } else {
      const { data: inserted, error } = await sb
        .schema("research")
        .from("cases")
        .insert({ ...caseRow, ingest_batch_id: batchId })
        .select("id")
        .single();
      if (error || !inserted) {
        throw new Error(
          `Backfill: failed to insert case ${caseRow.external_ref}: ${error?.message}`,
        );
      }
      caseId = inserted.id as string;
      casesInserted += 1;
    }

    eventsInserted += await insertEvents(sb, caseId, batchId, events);
  }

  return {
    batch_id: batchId,
    cases_inserted: casesInserted,
    events_inserted: eventsInserted,
    missingness,
  };
}

async function insertEvents(
  sb: Awaited<ReturnType<typeof requireAuthOrThrow>>["supabase"],
  caseId: string,
  batchId: string,
  events: DerivedEvent[],
): Promise<number> {
  if (events.length === 0) return 0;
  const rows = events.map((e) => ({
    case_id: caseId,
    event_type: e.event_type,
    occurred_at: e.occurred_at,
    actor_id: BACKFILL_ACTOR_ID,
    payload: e.payload,
    ingest_batch_id: batchId,
  }));
  // ON CONFLICT DO NOTHING via ignoreDuplicates so re-runs are lossless.
  const { data, error } = await sb
    .schema("research")
    .from("case_events")
    .upsert(rows, {
      onConflict: "case_id,event_type,occurred_at,actor_id",
      ignoreDuplicates: true,
    })
    .select("id");
  if (error) {
    throw new Error(`Backfill: failed to insert events for ${caseId}: ${error.message}`);
  }
  return data?.length ?? 0;
}
