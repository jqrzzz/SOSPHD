/* ─── Analytics & Aggregate Metrics ──────────────────────────────────
 *  Pure functions that compute dashboard-level stats from the store.
 *  All computations use the same metric functions as the case detail
 *  page for consistency.
 * ────────────────────────────────────────────────────────────────────── */

import { getCases, getEventsByCaseId, getRecommendationsByCaseId } from "./store";
import { computeTTTA, computeTTGP, computeTTDC, formatDuration } from "./metrics";
import type { Recommendation, CaseEvent } from "./types";

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

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const allCases = await getCases();

  const tttas: number[] = [];
  const ttgps: number[] = [];
  const ttdcs: number[] = [];
  let totalRecs = 0;
  let acceptedRecs = 0;
  let overriddenRecs = 0;

  for (const c of allCases) {
    const events = await getEventsByCaseId(c.id);
    const ttta = computeTTTA(events);
    const ttgp = computeTTGP(events);
    const ttdc = computeTTDC(events);

    if (ttta.value_ms !== null && !ttta.is_running) tttas.push(ttta.value_ms);
    if (ttgp.value_ms !== null && !ttgp.is_running) ttgps.push(ttgp.value_ms);
    if (ttdc.value_ms !== null && !ttdc.is_running) ttdcs.push(ttdc.value_ms);

    const recs = await getRecommendationsByCaseId(c.id);
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

// ── Per-case metric table ───────────────────────────────────────────

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
  payment_delayed: boolean;
  recommendation_count: number;
  accepted_count: number;
  override_count: number;
}

export async function getCaseMetricRows(): Promise<CaseMetricRow[]> {
  const allCases = await getCases();

  const rows: CaseMetricRow[] = [];
  for (const c of allCases) {
    const events = await getEventsByCaseId(c.id);
    const ttta = computeTTTA(events);
    const ttgp = computeTTGP(events);
    const ttdc = computeTTDC(events);
    const recs = await getRecommendationsByCaseId(c.id);

    const ttgpComplete = ttgp.value_ms !== null && !ttgp.is_running;
    const ttdcComplete = ttdc.value_ms !== null && !ttdc.is_running;
    const paymentDelayed =
      ttgpComplete && ttdcComplete && (ttgp.value_ms ?? 0) > (ttdc.value_ms ?? 0);

    rows.push({
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
    });
  }

  return rows;
}

// ── Paper 2: human-AI coordination analytics ─────────────────────────

interface DecisionPayload {
  kind: "rec_decision";
  recommendation_id: string;
  engine_type: string;
  engine_version: string;
  confidence_value: number;
  decision: "accepted" | "overridden";
  override_reason: string | null;
  recommendation_text: string;
}

function tryParseDecisionPayload(payload: string): DecisionPayload | null {
  if (!payload || !payload.trim().startsWith("{")) return null;
  try {
    const parsed = JSON.parse(payload);
    if (parsed?.kind === "rec_decision") return parsed as DecisionPayload;
  } catch {
    /* fall through */
  }
  return null;
}

export interface EngineStat {
  engine_version: string;
  total: number;
  accepted: number;
  overridden: number;
  pending: number;
  accept_rate: number | null; // null when no decided recs
  avg_confidence: number;
  avg_time_to_decision_ms: number | null;
}

export interface ConfidenceBucket {
  label: string;
  lo: number;
  hi: number;
  total: number;
  accepted: number;
  overridden: number;
  accept_rate: number | null;
}

export interface SeverityStat {
  severity: number;
  total: number;
  accepted: number;
  overridden: number;
  accept_rate: number | null;
}

export interface OverrideReason {
  case_id: string;
  patient_ref: string;
  recommendation_text: string;
  reason: string;
  engine_version: string;
  confidence: number;
  decided_at: string;
}

export interface Paper2Coordination {
  total: number;
  accepted: number;
  overridden: number;
  pending: number;
  overall_accept_rate: number | null;
  avg_confidence: number | null;
  avg_time_to_decision_ms: number | null;
  median_time_to_decision_ms: number | null;
  by_engine: EngineStat[];
  by_confidence: ConfidenceBucket[];
  by_severity: SeverityStat[];
  override_reasons: OverrideReason[];
  unique_engines: number;
  cases_with_recommendations: number;
}

function bucketLabel(lo: number, hi: number): string {
  return `${Math.round(lo * 100)}–${Math.round(hi * 100)}%`;
}

/**
 * Aggregates every recommendation across every case, joins each rec to
 * its decision NOTE (matched by recommendation_id in the payload), and
 * produces the figure-set Paper 2 cites.
 */
export async function getPaper2Coordination(): Promise<Paper2Coordination> {
  const allCases = await getCases();

  type DecidedRec = {
    rec: Recommendation;
    case_id: string;
    patient_ref: string;
    severity: number;
    decision_event: CaseEvent | null;
    decision_payload: DecisionPayload | null;
  };

  const decidedRecs: DecidedRec[] = [];
  let casesWithRecs = 0;

  for (const c of allCases) {
    const recs = await getRecommendationsByCaseId(c.id);
    if (recs.length === 0) continue;
    casesWithRecs += 1;
    const events = await getEventsByCaseId(c.id);

    // Index decision NOTEs by rec id for O(1) join
    const decisionByRecId = new Map<
      string,
      { event: CaseEvent; payload: DecisionPayload }
    >();
    for (const e of events) {
      const dp = tryParseDecisionPayload(e.payload);
      if (dp) decisionByRecId.set(dp.recommendation_id, { event: e, payload: dp });
    }

    for (const rec of recs) {
      const decision = decisionByRecId.get(rec.id);
      decidedRecs.push({
        rec,
        case_id: c.id,
        patient_ref: c.patient_ref,
        severity: c.severity,
        decision_event: decision?.event ?? null,
        decision_payload: decision?.payload ?? null,
      });
    }
  }

  const total = decidedRecs.length;
  const accepted = decidedRecs.filter((d) => d.rec.accepted === true).length;
  const overridden = decidedRecs.filter((d) => d.rec.accepted === false).length;
  const pending = decidedRecs.filter((d) => d.rec.accepted === null).length;
  const decided = accepted + overridden;

  const overall_accept_rate = decided > 0 ? accepted / decided : null;
  const avg_confidence =
    total > 0
      ? decidedRecs.reduce((sum, d) => sum + d.rec.confidence_value, 0) / total
      : null;

  // Time-to-decision distribution
  const decisionTimes: number[] = [];
  for (const d of decidedRecs) {
    if (!d.decision_event) continue;
    const created = Date.parse(d.rec.created_at);
    const decidedAt = Date.parse(d.decision_event.occurred_at);
    if (!Number.isFinite(created) || !Number.isFinite(decidedAt)) continue;
    const diff = decidedAt - created;
    if (diff >= 0) decisionTimes.push(diff);
  }
  const avg_time_to_decision_ms = average(decisionTimes);
  const median_time_to_decision_ms = median(decisionTimes);

  // By engine_version
  const engineMap = new Map<string, DecidedRec[]>();
  for (const d of decidedRecs) {
    const key = d.rec.engine_version;
    const arr = engineMap.get(key) ?? [];
    arr.push(d);
    engineMap.set(key, arr);
  }
  const by_engine: EngineStat[] = [];
  for (const [engine_version, recs] of engineMap.entries()) {
    const acc = recs.filter((d) => d.rec.accepted === true).length;
    const ovr = recs.filter((d) => d.rec.accepted === false).length;
    const pen = recs.filter((d) => d.rec.accepted === null).length;
    const dec = acc + ovr;
    const times: number[] = [];
    for (const d of recs) {
      if (!d.decision_event) continue;
      const t = Date.parse(d.decision_event.occurred_at) - Date.parse(d.rec.created_at);
      if (Number.isFinite(t) && t >= 0) times.push(t);
    }
    by_engine.push({
      engine_version,
      total: recs.length,
      accepted: acc,
      overridden: ovr,
      pending: pen,
      accept_rate: dec > 0 ? acc / dec : null,
      avg_confidence:
        recs.reduce((sum, d) => sum + d.rec.confidence_value, 0) / recs.length,
      avg_time_to_decision_ms: average(times),
    });
  }
  by_engine.sort((a, b) => b.total - a.total);

  // Confidence calibration buckets (only decided recs — calibration is
  // meaningless for pending)
  const decidedOnly = decidedRecs.filter((d) => d.rec.accepted !== null);
  const buckets: { lo: number; hi: number }[] = [
    { lo: 0.0, hi: 0.25 },
    { lo: 0.25, hi: 0.5 },
    { lo: 0.5, hi: 0.75 },
    { lo: 0.75, hi: 1.0001 }, // include 1.0
  ];
  const by_confidence: ConfidenceBucket[] = buckets.map((b) => {
    const inBucket = decidedOnly.filter(
      (d) =>
        d.rec.confidence_value >= b.lo && d.rec.confidence_value < b.hi,
    );
    const acc = inBucket.filter((d) => d.rec.accepted === true).length;
    const ovr = inBucket.filter((d) => d.rec.accepted === false).length;
    return {
      label: bucketLabel(b.lo, Math.min(b.hi, 1)),
      lo: b.lo,
      hi: Math.min(b.hi, 1),
      total: inBucket.length,
      accepted: acc,
      overridden: ovr,
      accept_rate: inBucket.length > 0 ? acc / inBucket.length : null,
    };
  });

  // By severity
  const sevMap = new Map<number, DecidedRec[]>();
  for (const d of decidedOnly) {
    const arr = sevMap.get(d.severity) ?? [];
    arr.push(d);
    sevMap.set(d.severity, arr);
  }
  const by_severity: SeverityStat[] = [];
  for (let sev = 1; sev <= 5; sev++) {
    const recs = sevMap.get(sev) ?? [];
    const acc = recs.filter((d) => d.rec.accepted === true).length;
    const ovr = recs.filter((d) => d.rec.accepted === false).length;
    by_severity.push({
      severity: sev,
      total: recs.length,
      accepted: acc,
      overridden: ovr,
      accept_rate: recs.length > 0 ? acc / recs.length : null,
    });
  }

  // Override reasons (recent first, max 20)
  const override_reasons: OverrideReason[] = [];
  for (const d of decidedRecs) {
    if (d.rec.accepted === false && d.rec.override_reason && d.decision_event) {
      override_reasons.push({
        case_id: d.case_id,
        patient_ref: d.patient_ref,
        recommendation_text: d.rec.recommendation,
        reason: d.rec.override_reason,
        engine_version: d.rec.engine_version,
        confidence: d.rec.confidence_value,
        decided_at: d.decision_event.occurred_at,
      });
    }
  }
  override_reasons.sort(
    (a, b) => Date.parse(b.decided_at) - Date.parse(a.decided_at),
  );

  return {
    total,
    accepted,
    overridden,
    pending,
    overall_accept_rate,
    avg_confidence,
    avg_time_to_decision_ms,
    median_time_to_decision_ms,
    by_engine,
    by_confidence,
    by_severity,
    override_reasons: override_reasons.slice(0, 20),
    unique_engines: engineMap.size,
    cases_with_recommendations: casesWithRecs,
  };
}

// ── Paper builder context ───────────────────────────────────────────

export interface PaperBuilderContext {
  summary: DashboardSummary;
  rows: CaseMetricRow[];
  formatted: {
    sample_size: string;
    metric_summary: string;
    payment_delay_finding: string;
    provenance_summary: string;
    severity_distribution: string;
  };
}

export async function buildPaperContext(): Promise<PaperBuilderContext> {
  const summary = await getDashboardSummary();
  const rows = await getCaseMetricRows();

  const completedCases = rows.filter((r) => r.status === "closed");
  const delayedCases = rows.filter((r) => r.payment_delayed);

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

      severity_distribution: `Cases were distributed across severity levels: ${sevParts || "none recorded"}.`,
    },
  };
}
