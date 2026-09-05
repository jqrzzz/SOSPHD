/* ─── Frozen analysis snapshots (SERVER ONLY) ──────────────────────────
 *  Reads and writes research.analysis_snapshots (migration 012).
 *
 *  A snapshot freezes the full analysis batch — dashboard summary,
 *  per-case metric rows, missingness report, OQ-7 intervention
 *  classifications — under a label, so papers cite an immutable named
 *  dataset instead of a live dashboard. The table is append-only (no
 *  UPDATE/DELETE policy or grant); "editing" a snapshot means taking a
 *  new one.
 *
 *  Reads and writes live in ONE file, breaking the usual store/mutations
 *  split, because both sides are server-only (the split exists solely to
 *  keep client-safe read paths free of next/headers — no client touches
 *  snapshots). No seed fallback either: a missing snapshot list is an
 *  empty list, never fabricated data.
 * ────────────────────────────────────────────────────────────────────── */

import "server-only";

import { requireAuthOrThrow } from "@/lib/supabase/server-auth";
import { getServerSupabase } from "@/lib/supabase/server-auth";
import { warnDegradedMode } from "@/lib/data/degraded";
import { getCases, getAllCaseEvents, getAllRecommendations } from "./store";
import {
  computeDashboardSummary,
  computeCaseMetricRows,
  computeMissingness,
} from "./analytics";
import { classifyAllInterventions } from "./intervention";
import { loadPaper1Evidence } from "./paper1-snapshot";

export interface SnapshotMeta {
  id: string;
  created_at: string;
  created_by: string;
  label: string;
  note: string | null;
  case_count: number;
  event_count: number;
  rec_count: number;
}

/**
 * Read the complete, paginated Paper 1 baseline, then compute the existing
 * dashboard analysis batch and persist both in one frozen snapshot.
 */
export async function createAnalysisSnapshot(
  label: string,
  note?: string | null,
): Promise<SnapshotMeta> {
  const { supabase: sb, userId } = await requireAuthOrThrow();

  let access;
  try {
    access = await sb.schema("research").rpc("is_allowed_user");
  } catch {
    throw new Error("Research access required to freeze a snapshot.");
  }
  if (access.error || access.data !== true) {
    throw new Error("Research access required to freeze a snapshot.");
  }
  const paper1 = await loadPaper1Evidence(sb);

  const [allCases, allEvents, allRecs] = await Promise.all([
    getCases(),
    getAllCaseEvents(),
    getAllRecommendations(),
  ]);

  const payload = {
    generated_at: new Date().toISOString(),
    paper1,
    summary: computeDashboardSummary(allCases, allEvents, allRecs),
    rows: computeCaseMetricRows(allCases, allEvents, allRecs),
    missingness: computeMissingness(allCases, allEvents),
    interventions: classifyAllInterventions(
      allCases.map((c) => c.id),
      allEvents,
      allRecs,
    ),
  };

  const { data: row, error } = await sb
    .schema("research")
    .from("analysis_snapshots")
    .insert({
      created_by: userId,
      label,
      note: note ?? null,
      payload,
      case_count: allCases.length,
      event_count: allEvents.length,
      rec_count: allRecs.length,
    })
    .select("id, created_at, created_by, label, note, case_count, event_count, rec_count")
    .single();

  if (error || !row) {
    throw new Error(`Failed to freeze snapshot: ${error?.message}`);
  }
  return row as SnapshotMeta;
}

/** List snapshot metadata, newest first. Payloads are NOT included. */
export async function getSnapshots(limit = 20): Promise<SnapshotMeta[]> {
  const sb = await getServerSupabase();
  if (!sb) {
    warnDegradedMode("getSnapshots", "supabase unavailable");
    return [];
  }
  const { data, error } = await sb
    .schema("research")
    .from("analysis_snapshots")
    .select("id, created_at, created_by, label, note, case_count, event_count, rec_count")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) {
    if (error) warnDegradedMode("getSnapshots", error.message);
    return [];
  }
  return data as SnapshotMeta[];
}

/** Fetch one snapshot's full frozen payload (for download). */
export async function getSnapshotPayload(
  id: string,
): Promise<{ meta: SnapshotMeta; payload: unknown } | null> {
  const sb = await getServerSupabase();
  if (!sb) {
    warnDegradedMode("getSnapshotPayload", "supabase unavailable");
    return null;
  }
  const { data, error } = await sb
    .schema("research")
    .from("analysis_snapshots")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    if (error) warnDegradedMode("getSnapshotPayload", error.message);
    return null;
  }
  const { payload, ...meta } = data as SnapshotMeta & { payload: unknown };
  return { meta, payload };
}
