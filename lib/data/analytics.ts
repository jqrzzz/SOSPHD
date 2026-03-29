/* ─── Analytics & Aggregate Metrics ──────────────────────────────────
 *  Pure functions that compute dashboard-level stats from the store.
 *  All computations use the same metric functions as the case detail
 *  page for consistency.
 * ────────────────────────────────────────────────────────────────────── */

import { getCases, getEventsByCaseId, getRecommendationsByCaseId } from "./store";
import { computeAllMetrics, computeTTTA, computeTTGP, computeTTDC, formatDuration } from "./metrics";
import type { Case, CaseEvent, MetricResult } from "./types";

// ── Summary stats ────────────────────────────────────────────────────

export interface DashboardSummary {
  total_cases: number;
  open_cases: number;
  active_cases: number;
  closed_cases: number;
  total_recommendations: number;
  accepted_recommendations: number;
  overridden_recommendations: number;
  avg_ttta_ms: number | null;
  avg_ttgp_ms: number | null;
  avg_ttdc_ms: number | null;
  median_ttta_ms: number | null;
  median_ttgp_ms: number | null;
  median_ttdc_ms: number | null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function getDashboardSummary(): DashboardSummary {
  const allCases = getCases();

  const tttas: number[] = [];
  const ttgps: number[] = [];
  const ttdcs: number[] = [];
  let totalRecs = 0;
  let acceptedRecs = 0;
  let overriddenRecs = 0;

  for (const c of allCases) {
    const events = getEventsByCaseId(c.id);
    const ttta = computeTTTA(events);
    const ttgp = computeTTGP(events);
    const ttdc = computeTTDC(events);

    // Only include completed (non-running) metrics in averages
    if (ttta.value_ms !== null && !ttta.is_running) tttas.push(ttta.value_ms);
    if (ttgp.value_ms !== null && !ttgp.is_running) ttgps.push(ttgp.value_ms);
    if (ttdc.value_ms !== null && !ttdc.is_running) ttdcs.push(ttdc.value_ms);

    const recs = getRecommendationsByCaseId(c.id);
    totalRecs += recs.length;
    acceptedRecs += recs.filter((r) => r.accepted === true).length;
    overriddenRecs += recs.filter((r) => r.accepted === false).length;
  }

  return {
    total_cases: allCases.length,
    open_cases: allCases.filter((c) => c.status === "open").length,
    active_cases: allCases.filter((c) => c.status === "active").length,
    closed_cases: allCases.filter((c) => c.status === "closed").length,
    total_recommendations: totalRecs,
    accepted_recommendations: acceptedRecs,
    overridden_recommendations: overriddenRecs,
    avg_ttta_ms: average(tttas),
    avg_ttgp_ms: average(ttgps),
    avg_ttdc_ms: average(ttdcs),
    median_ttta_ms: median(tttas),
    median_ttgp_ms: median(ttgps),
    median_ttdc_ms: median(ttdcs),
  };
}

// ── Per-case metric table (for charts and export) ────────────────────

export interface CaseMetricRow {
  case_id: string;
  patient_ref: string;
  severity: number;
  status: string;
  created_at: string;
  ttta_ms: number | null;
  ttgp_ms: number | null;
  ttdc_ms: number | null;
  ttta_complete: boolean;
  ttgp_complete: boolean;
  ttdc_complete: boolean;
  /** TTGP arrived after TTDC — payment delayed care */
  payment_delayed: boolean;
  recommendation_count: number;
  accepted_count: number;
  override_count: number;
}

export function getCaseMetricRows(): CaseMetricRow[] {
  const allCases = getCases();

  return allCases.map((c) => {
    const events = getEventsByCaseId(c.id);
    const ttta = computeTTTA(events);
    const ttgp = computeTTGP(events);
    const ttdc = computeTTDC(events);
    const recs = getRecommendationsByCaseId(c.id);

    const ttgpComplete = ttgp.value_ms !== null && !ttgp.is_running;
    const ttdcComplete = ttdc.value_ms !== null && !ttdc.is_running;
    const paymentDelayed =
      ttgpComplete && ttdcComplete && (ttgp.value_ms ?? 0) > (ttdc.value_ms ?? 0);

    return {
      case_id: c.id,
      patient_ref: c.patient_ref,
      severity: c.severity,
      status: c.status,
      created_at: c.created_at,
      ttta_ms: ttta.value_ms,
      ttgp_ms: ttgp.value_ms,
      ttdc_ms: ttdc.value_ms,
      ttta_complete: ttta.value_ms !== null && !ttta.is_running,
      ttgp_complete: ttgpComplete,
      ttdc_complete: ttdcComplete,
      payment_delayed: paymentDelayed,
      recommendation_count: recs.length,
      accepted_count: recs.filter((r) => r.accepted === true).length,
      override_count: recs.filter((r) => r.accepted === false).length,
    };
  });
}

// ── Paper builder context ────────────────────────────────────────────

export interface PaperBuilderContext {
  summary: DashboardSummary;
  rows: CaseMetricRow[];
  /** Pre-formatted strings for direct insertion into methods/results */
  formatted: {
    sample_size: string;
    metric_summary: string;
    payment_delay_finding: string;
    provenance_summary: string;
    severity_distribution: string;
  };
}

export function buildPaperContext(): PaperBuilderContext {
  const summary = getDashboardSummary();
  const rows = getCaseMetricRows();

  const completedCases = rows.filter((r) => r.status === "closed");
  const delayedCases = rows.filter((r) => r.payment_delayed);

  // Severity distribution
  const sevCounts: Record<number, number> = {};
  for (const r of rows) {
    sevCounts[r.severity] = (sevCounts[r.severity] ?? 0) + 1;
  }
  const sevParts = Object.entries(sevCounts)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([sev, count]) => `severity ${sev} (n=${count})`)
    .join(", ");

  return {
    summary,
    rows,
    formatted: {
      sample_size: `N=${rows.length} cases were recorded across the observation period, of which ${completedCases.length} reached full resolution (DISCHARGE event recorded).`,

      metric_summary: [
        summary.avg_ttdc_ms !== null
          ? `Mean TTDC was ${formatDuration(summary.avg_ttdc_ms)} (median ${summary.median_ttdc_ms !== null ? formatDuration(summary.median_ttdc_ms) : "N/A"}).`
          : "Insufficient closed cases to compute TTDC statistics.",
        summary.avg_ttgp_ms !== null
          ? `Mean TTGP was ${formatDuration(summary.avg_ttgp_ms)} (median ${summary.median_ttgp_ms !== null ? formatDuration(summary.median_ttgp_ms) : "N/A"}).`
          : "Insufficient closed cases to compute TTGP statistics.",
        summary.avg_ttta_ms !== null
          ? `Mean TTTA was ${formatDuration(summary.avg_ttta_ms)} (median ${summary.median_ttta_ms !== null ? formatDuration(summary.median_ttta_ms) : "N/A"}).`
          : "Insufficient closed cases to compute TTTA statistics.",
      ].join(" "),

      payment_delay_finding: delayedCases.length > 0
        ? `In ${delayedCases.length} of ${completedCases.length} completed cases (${completedCases.length > 0 ? Math.round((delayedCases.length / completedCases.length) * 100) : 0}%), financial clearance (TTGP) arrived after definitive care had already begun (TTDC), indicating that payment guarantee processes delayed clinical care initiation.`
        : "No cases showed payment-delayed care in the current dataset.",

      provenance_summary: summary.total_recommendations > 0
        ? `The AI recommendation engine generated ${summary.total_recommendations} recommendations across all cases. Of these, ${summary.accepted_recommendations} (${Math.round((summary.accepted_recommendations / summary.total_recommendations) * 100)}%) were accepted by operators and ${summary.overridden_recommendations} (${Math.round((summary.overridden_recommendations / summary.total_recommendations) * 100)}%) were overridden.`
        : "No AI recommendations were recorded in the current dataset.",

      severity_distribution: `Cases were distributed across severity levels: ${sevParts}.`,
    },
  };
}
