/* ─── SOSCOMMAND → Research Sync ──────────────────────────────────────
 *  SOSPHD computes TTTA / TTGP / TTDC from research.case_events. The
 *  authoritative timestamps for the underlying operational milestones
 *  live in SOSCOMMAND-owned public.* tables, not in events. Without a
 *  sync, Paper 1 metrics depend on whether an operator remembered to
 *  type each event in — which means they measure researcher behavior,
 *  not operational reality.
 *
 *  This module materializes the SOSCOMMAND-side timestamps as
 *  research.case_events rows tagged with actor_id = 'soscommand_sync'
 *  so they're distinguishable from operator-entered events but
 *  participate in the same metric computation.
 *
 *  Idempotency: same (case_id, event_type, occurred_at, actor_id) is
 *  treated as the same event. Re-running sync is safe.
 *
 *  Mapping:
 *    public.cases.intake_at                  → FIRST_CONTACT
 *    public.cases.triage_at                  → TRIAGE_COMPLETE
 *    case_transport.actual_departure         → TRANSPORT_ACTIVATED
 *    case_transport.actual_arrival           → FACILITY_ARRIVAL
 *    guarantees_of_payment.issued_date       → GUARANTEED_PAYMENT (earliest)
 *    case_episodes.start_date                → DEFINITIVE_CARE_START (earliest)
 *    public.cases.resolved_at / closed_at    → DISCHARGE
 * ────────────────────────────────────────────────────────────────────── */

import { createClient } from "@/lib/supabase/server";
import type { EventType } from "./types";

const SYNC_ACTOR_ID = "soscommand_sync";

export interface NewEvent {
  case_id: string;
  event_type: EventType;
  occurred_at: string;
  actor_id: string;
  payload: string;
}

// ── Pure logic (exported for tests) ───────────────────────────────────

export interface OperationalRows {
  caseRow: {
    intake_at?: string | null;
    triage_at?: string | null;
    active_at?: string | null;
    resolved_at?: string | null;
    closed_at?: string | null;
    closed_date?: string | null;
  } | null;
  transports: { actual_departure?: string | null; actual_arrival?: string | null }[];
  gops: { issued_date?: string | null }[];
  episodes: { start_date?: string | null }[];
}

export function asTimestamp(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  if (value.trim().length === 0) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

/**
 * Pure: given raw operational rows for a case, produce the set of
 * research.case_events rows that should exist. No I/O. Used both at
 * runtime by gatherOperationalEvents() and by the unit test suite.
 */
export function mapOperationalRowsToEvents(
  caseId: string,
  rows: OperationalRows,
): NewEvent[] {
  const events: NewEvent[] = [];
  const push = (type: EventType, raw: unknown, source: string) => {
    const at = asTimestamp(raw);
    if (!at) return;
    events.push({
      case_id: caseId,
      event_type: type,
      occurred_at: at,
      actor_id: SYNC_ACTOR_ID,
      payload: JSON.stringify({ source }),
    });
  };

  if (rows.caseRow) {
    push("FIRST_CONTACT", rows.caseRow.intake_at, "cases.intake_at");
    push("TRIAGE_COMPLETE", rows.caseRow.triage_at, "cases.triage_at");
    const dischargeAt =
      rows.caseRow.resolved_at ??
      rows.caseRow.closed_at ??
      rows.caseRow.closed_date;
    push("DISCHARGE", dischargeAt, "cases.resolved_at|closed_at|closed_date");
  }

  // Earliest non-null departure / arrival across transport rows.
  for (const t of rows.transports) {
    if (t.actual_departure) {
      push("TRANSPORT_ACTIVATED", t.actual_departure, "case_transport.actual_departure");
      break;
    }
  }
  for (const t of rows.transports) {
    if (t.actual_arrival) {
      push("FACILITY_ARRIVAL", t.actual_arrival, "case_transport.actual_arrival");
      break;
    }
  }

  const firstGop = rows.gops[0];
  if (firstGop) {
    push("GUARANTEED_PAYMENT", firstGop.issued_date, "guarantees_of_payment.issued_date");
  }

  const firstEpisode = rows.episodes[0];
  if (firstEpisode) {
    push(
      "DEFINITIVE_CARE_START",
      firstEpisode.start_date,
      "case_episodes.start_date",
    );
  }

  return events;
}

/**
 * Pure: given the events that should exist + the events already
 * synced, return the subset to insert. Same dedup key as the
 * runtime: (event_type, occurred_at).
 */
export function diffEventsToInsert(
  expected: NewEvent[],
  existing: { event_type: EventType; occurred_at: string }[],
): NewEvent[] {
  const existingKeys = new Set(
    existing.map((e) => `${e.event_type}:${asTimestamp(e.occurred_at)}`),
  );
  return expected.filter(
    (e) => !existingKeys.has(`${e.event_type}:${e.occurred_at}`),
  );
}

// ── Runtime (impure) ──────────────────────────────────────────────────

async function tryCreateClient() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return null;
  }
  try {
    return await createClient();
  } catch {
    return null;
  }
}

/**
 * Pull every relevant SOSCOMMAND row for a case and translate to the
 * expected research event set via mapOperationalRowsToEvents.
 */
async function gatherOperationalEvents(
  caseId: string,
): Promise<NewEvent[]> {
  const supabase = await tryCreateClient();
  if (!supabase) return [];

  const [
    caseRow,
    transports,
    gops,
    episodes,
  ] = await Promise.all([
    supabase
      .from("cases")
      .select("intake_at, triage_at, active_at, resolved_at, closed_at, closed_date")
      .eq("id", caseId)
      .maybeSingle(),
    supabase
      .from("case_transport")
      .select("actual_departure, actual_arrival")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true }),
    supabase
      .from("guarantees_of_payment")
      .select("issued_date")
      .eq("case_id", caseId)
      .not("issued_date", "is", null)
      .order("issued_date", { ascending: true })
      .limit(1),
    supabase
      .from("case_episodes")
      .select("start_date")
      .eq("case_id", caseId)
      .not("start_date", "is", null)
      .order("start_date", { ascending: true })
      .limit(1),
  ]);

  return mapOperationalRowsToEvents(caseId, {
    caseRow: caseRow.data ?? null,
    transports: transports.data ?? [],
    gops: gops.data ?? [],
    episodes: episodes.data ?? [],
  });
}

export interface SyncResult {
  case_id: string;
  inserted: number;
  skipped: number;
  total_expected: number;
}

/**
 * Idempotently materialize SOSCOMMAND timestamps as
 * research.case_events rows for a single case. Safe to call repeatedly.
 */
export async function syncCaseFromOperational(
  caseId: string,
): Promise<SyncResult> {
  const supabase = await tryCreateClient();
  if (!supabase) {
    return { case_id: caseId, inserted: 0, skipped: 0, total_expected: 0 };
  }

  const expected = await gatherOperationalEvents(caseId);
  if (expected.length === 0) {
    return { case_id: caseId, inserted: 0, skipped: 0, total_expected: 0 };
  }

  // What's already in research.case_events for this case from sync?
  const { data: existing, error: readError } = await supabase
    .schema("research")
    .from("case_events")
    .select("event_type, occurred_at")
    .eq("case_id", caseId)
    .eq("actor_id", SYNC_ACTOR_ID);

  if (readError) {
    // Don't fail the page — the sync is best-effort.
    return {
      case_id: caseId,
      inserted: 0,
      skipped: expected.length,
      total_expected: expected.length,
    };
  }

  const toInsert = diffEventsToInsert(
    expected,
    (existing ?? []).map((e) => ({
      event_type: e.event_type as EventType,
      occurred_at: e.occurred_at as string,
    })),
  );

  if (toInsert.length === 0) {
    return {
      case_id: caseId,
      inserted: 0,
      skipped: expected.length,
      total_expected: expected.length,
    };
  }

  const { error: insertError } = await supabase
    .schema("research")
    .from("case_events")
    .insert(toInsert);

  if (insertError) {
    return {
      case_id: caseId,
      inserted: 0,
      skipped: expected.length,
      total_expected: expected.length,
    };
  }

  return {
    case_id: caseId,
    inserted: toInsert.length,
    skipped: expected.length - toInsert.length,
    total_expected: expected.length,
  };
}

/**
 * Backfill helper: sync every case in public.cases. Called by an
 * admin endpoint, not a background process. Limited to 200 cases per
 * call to keep response times bounded — call repeatedly for larger
 * datasets.
 */
export async function syncAllCasesFromOperational(
  limit: number = 200,
): Promise<{ scanned: number; results: SyncResult[] }> {
  const supabase = await tryCreateClient();
  if (!supabase) return { scanned: 0, results: [] };

  const { data: cases } = await supabase
    .from("cases")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!cases) return { scanned: 0, results: [] };

  const results: SyncResult[] = [];
  // Process in parallel but bounded — avoid blasting the DB.
  const CONCURRENCY = 8;
  for (let i = 0; i < cases.length; i += CONCURRENCY) {
    const batch = cases.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((c) => syncCaseFromOperational(c.id as string)),
    );
    results.push(...batchResults);
  }
  return { scanned: cases.length, results };
}

export const SYNC_ACTOR = SYNC_ACTOR_ID;
