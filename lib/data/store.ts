/* ─── Supabase-Backed Data Store ─────────────────────────────────────
 *  Reads cases from public schema (operational).
 *  Reads/writes events & recommendations from research schema.
 *  All functions are async — consumers must await.
 *
 *  When Supabase env vars are not configured (e.g. local dev without
 *  .env.local), reads return empty results and writes throw — same
 *  graceful-degradation pattern the other stores use.
 * ────────────────────────────────────────────────────────────────────── */

import { createClient } from "@/lib/supabase/server";
import { withSupabaseRetry } from "./retry";
import type { Case, CaseEvent, CaseStatus, Severity, Recommendation } from "./types";

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

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Map operational `public.cases.status` enum (19 values) to SOSPHD's
 * 3-state research model. THIS FUNCTION IS THE MEASUREMENT PROJECTION
 * that determines what "open / active / closed" means for Paper 1
 * sample counts. Reviewer-defensible only if every operational status
 * is explicitly handled, not silently bucketed by a `default` clause.
 *
 * Rationale per bucket:
 *  - "open"   = case is in the system but no operational work has
 *               started or is being actively pursued (intake, awaiting
 *               info, awaiting authorization, queued for review)
 *  - "active" = work is actively in progress (triage running, transport
 *               arranged, treatment underway, generic in_progress)
 *  - "closed" = terminal state (discharged, billed, claimed, formally
 *               closed, cancelled, resolved)
 *
 * Unknown values from future enum extensions are mapped to "open" with
 * a `[SOSPHD:UNKNOWN_STATUS]` console.warn so we discover drift before
 * it corrupts dashboard counts.
 */
function mapStatus(opStatus: string): CaseStatus {
  switch (opStatus) {
    // Open: intake / awaiting next step
    case "intake":
    case "pending":
    case "pending_info":
    case "pending_authorization":
    case "pending_external":
    case "needs_review":
    case "verified":
    case "rejected":
      return "open";

    // Active: work currently happening
    case "active":
    case "in_progress":
    case "in_treatment":
    case "transport_arranged":
    case "triage":
      return "active";

    // Closed: terminal
    case "discharged":
    case "resolved":
    case "billing":
    case "claims":
    case "closed":
    case "cancelled":
      return "closed";

    default:
      console.warn(
        `[SOSPHD:UNKNOWN_STATUS] Unhandled operational case status: "${opStatus}". Defaulting to "open". Add an explicit case to mapStatus in lib/data/store.ts.`,
      );
      return "open";
  }
}

/**
 * Map operational `public.cases.priority` enum (4 values) to SOSPHD's
 * Severity scale (1 = lowest, 4 = highest). THIS FUNCTION IS THE
 * MEASUREMENT PROJECTION for clinical severity in Paper 1. The TS
 * `Severity` type is `1 | 2 | 3 | 4` to match the operational enum's
 * cardinality — no synthetic level beyond what operational data
 * actually carries.
 *
 * If a finer-grained severity ever becomes available (e.g. via
 * `public.cases.acuity_level`), widen this projection then.
 */
function mapPriority(priority: string): Severity {
  switch (priority) {
    case "low":
      return 1;
    case "normal":
      return 2;
    case "high":
      return 3;
    case "critical":
      return 4;
    default:
      console.warn(
        `[SOSPHD:UNKNOWN_PRIORITY] Unhandled operational case priority: "${priority}". Defaulting to 2 (normal). Add an explicit case to mapPriority in lib/data/store.ts.`,
      );
      return 2;
  }
}

/** Transform an operational case row + patient into SOSPHD's Case type */
function toCase(row: Record<string, unknown>): Case {
  const patient = row.patients as Record<string, unknown> | null;
  return {
    id: row.id as string,
    site_id: (row.country as string) ?? "unknown",
    created_at: row.created_at as string,
    status: mapStatus(row.status as string),
    severity: mapPriority(row.priority as string),
    chief_complaint: (row.incident_description as string) ?? "",
    patient_ref: (patient?.medical_id as string) ?? (row.case_number as string) ?? "Unknown",
    notes: (row.notes as string) ?? "",
    source: "operational",
  };
}

/**
 * Map a research.cases row → the shared Case type. Unlike toCase (which
 * projects the operational public.cases schema), research.cases already
 * stores the research model: status is open/active/closed, severity is
 * 1–4, and there is no raw PHI — patient_ref is the pseudonym. See
 * docs/backfill-plan.md.
 */
function toResearchCase(row: Record<string, unknown>): Case {
  const sev = row.severity as number | null;
  return {
    id: row.id as string,
    site_id: (row.country as string) ?? "unknown",
    created_at: row.created_at as string,
    status: (row.status as CaseStatus) ?? "closed",
    severity: (sev && sev >= 1 && sev <= 4 ? sev : 2) as Severity,
    chief_complaint: (row.incident_summary as string) ?? "",
    patient_ref: (row.patient_ref as string) ?? "Unknown",
    notes: "",
    source: "historical",
  };
}

// ── Query functions ─────────────────────────────────────────────────

// Explicit column projection — matches the fields toCase() reads.
// `public.cases` has ~40 columns; selecting "*" pulls every one across
// the wire (including PHI-adjacent fields SOSPHD has no business
// touching). Keep this list minimal and document additions.
const CASE_COLUMNS =
  "id, case_number, patient_id, status, priority, country, incident_description, notes, created_at, patients(full_name, medical_id)";

// Inverse of mapStatus — given a research bucket, the set of
// operational statuses that project into it. Used to push the status
// filter to the database so we don't transfer rows we'll discard.
// Keep this in lockstep with mapStatus.
const OP_STATUSES_BY_RESEARCH_BUCKET: Record<CaseStatus, string[]> = {
  open: [
    "intake",
    "pending",
    "pending_info",
    "pending_authorization",
    "pending_external",
    "needs_review",
    "verified",
    "rejected",
  ],
  active: [
    "active",
    "in_progress",
    "in_treatment",
    "transport_arranged",
    "triage",
  ],
  closed: ["discharged", "resolved", "billing", "claims", "closed", "cancelled"],
};

/** Operational cases projected from public.cases (live SOSCOMMAND data). */
async function getOperationalCases(
  statusFilter?: CaseStatus,
): Promise<Case[]> {
  const supabase = await tryCreateClient();
  if (!supabase) return [];

  // Wrap in retry — buildContextSnapshot/buildPaperContext depend on
  // this read and a transient blip would corrupt the AI context.
  const { data, error } = await withSupabaseRetry(() => {
    let query = supabase
      .from("cases")
      .select(CASE_COLUMNS)
      .order("created_at", { ascending: false });
    if (statusFilter) {
      query = query.in("status", OP_STATUSES_BY_RESEARCH_BUCKET[statusFilter]);
    }
    return query;
  }, "getOperationalCases");
  if (error || !data) return [];
  return data.map(toCase);
}

/**
 * Research-native cases from research.cases (historical backfill +
 * future prospective research cases). Status is already the research
 * model, so the filter pushes down directly. See docs/backfill-plan.md.
 */
export async function getResearchCases(
  statusFilter?: CaseStatus,
): Promise<Case[]> {
  const supabase = await tryCreateClient();
  if (!supabase) return [];
  const { data, error } = await withSupabaseRetry(() => {
    let query = supabase
      .schema("research")
      .from("cases")
      .select(
        "id, status, severity, country, incident_summary, patient_ref, created_at",
      )
      .order("created_at", { ascending: false });
    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }
    return query;
  }, "getResearchCases");
  if (error || !data) return [];
  return data.map((row) => toResearchCase(row as Record<string, unknown>));
}

/**
 * Unified case list: operational (public.cases) ∪ research-native
 * (research.cases), newest first. The analytics layer and dashboards
 * call this, so backfilled historical cases become first-class
 * everywhere without those call sites changing.
 */
export async function getCases(filters?: {
  status?: CaseStatus;
  search?: string;
}): Promise<Case[]> {
  const [operational, research] = await Promise.all([
    getOperationalCases(filters?.status),
    getResearchCases(filters?.status),
  ]);

  let result = [...operational, ...research].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (c) =>
        c.patient_ref.toLowerCase().includes(q) ||
        c.chief_complaint.toLowerCase().includes(q),
    );
  }

  return result;
}

export async function getCaseById(id: string): Promise<Case | undefined> {
  const supabase = await tryCreateClient();
  if (!supabase) return undefined;

  // Operational first (the common case), then research-native.
  const { data, error } = await withSupabaseRetry(
    () =>
      supabase.from("cases").select(CASE_COLUMNS).eq("id", id).maybeSingle(),
    "getCaseById",
  );
  if (!error && data) return toCase(data);

  const { data: rData, error: rErr } = await withSupabaseRetry(
    () =>
      supabase
        .schema("research")
        .from("cases")
        .select(
          "id, status, severity, country, incident_summary, patient_ref, created_at",
        )
        .eq("id", id)
        .maybeSingle(),
    "getCaseById.research",
  );
  if (!rErr && rData) return toResearchCase(rData as Record<string, unknown>);

  return undefined;
}

// Per docs/audit-action-plan.md Decision C: SOSPHD does not create
// cases. Cases originate in SOSCOMMAND; SOSPHD reads them via the
// public.cases table. The former createCase function inserted a
// placeholder patient_id that violated the FK to public.patients
// (ON DELETE RESTRICT) and would have polluted SOSCOMMAND's
// operational table with phantom-patient cases if the FK hadn't
// blocked it. Function removed.

// ── Events (research schema) ────────────────────────────────────────

export async function getEventsByCaseId(caseId: string): Promise<CaseEvent[]> {
  const supabase = await tryCreateClient();
  if (!supabase) return [];

  // SOSCOMMAND → research event materialization is handled by DB
  // triggers (migrations 003 + 006), not application code. Events
  // appear in research.case_events the moment SOSCOMMAND writes to
  // the operational tables. See docs/audit-action-plan.md Decision B.
  const { data, error } = await withSupabaseRetry(
    () =>
      supabase
        .schema("research")
        .from("case_events")
        .select("*")
        .eq("case_id", caseId)
        .order("occurred_at", { ascending: true }),
    "getEventsByCaseId",
  );

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    case_id: row.case_id as string,
    occurred_at: row.occurred_at as string,
    event_type: row.event_type as CaseEvent["event_type"],
    actor_id: row.actor_id as string,
    payload: row.payload as string,
  }));
}

export async function addEvent(data: {
  case_id: string;
  event_type: CaseEvent["event_type"];
  occurred_at: string;
  payload: string;
  actor_id?: string;
}): Promise<CaseEvent> {
  const supabase = await tryCreateClient();
  if (!supabase) {
    throw new Error("Supabase is not configured. Cannot add event.");
  }
  const { data: userData } = await supabase.auth.getUser();
  const actorId = data.actor_id ?? userData.user?.id ?? "system";
  const { data: newEvent, error } = await supabase
    .schema("research")
    .from("case_events")
    .insert({
      case_id: data.case_id,
      event_type: data.event_type,
      occurred_at: data.occurred_at,
      actor_id: actorId,
      payload: data.payload,
    })
    .select()
    .single();

  if (error || !newEvent) {
    throw new Error(`Failed to add event: ${error?.message}`);
  }

  return {
    id: newEvent.id,
    case_id: newEvent.case_id,
    occurred_at: newEvent.occurred_at,
    event_type: newEvent.event_type,
    actor_id: newEvent.actor_id,
    payload: newEvent.payload,
  };
}

// ── Recommendations (research schema) ───────────────────────────────

function toRecommendation(row: Record<string, unknown>): Recommendation {
  return {
    id: row.id as string,
    case_id: row.case_id as string,
    created_at: row.created_at as string,
    engine_type: row.engine_type as Recommendation["engine_type"],
    engine_version: row.engine_version as string,
    confidence_type: row.confidence_type as Recommendation["confidence_type"],
    confidence_value: row.confidence_value as number,
    recommendation: row.recommendation as string,
    explanation: row.explanation as string,
    accepted: row.accepted as boolean | null,
    override_reason: row.override_reason as string | null,
    decided_by: (row.decided_by as string | null) ?? null,
    decided_at: (row.decided_at as string | null) ?? null,
  };
}

export async function getRecommendationsByCaseId(caseId: string): Promise<Recommendation[]> {
  const supabase = await tryCreateClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .schema("research")
    .from("recommendations")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => toRecommendation(row as Record<string, unknown>));
}

/**
 * Fetch ALL recommendations across the research schema in a single
 * query, optionally filtered to a set of case ids. This is the
 * O(1)-roundtrips replacement for looping per-case fetches in
 * dashboard aggregators.
 */
export async function getAllRecommendations(
  caseIds?: string[],
): Promise<Recommendation[]> {
  const supabase = await tryCreateClient();
  if (!supabase) return [];
  const { data, error } = await withSupabaseRetry(() => {
    let query = supabase
      .schema("research")
      .from("recommendations")
      .select("*")
      .order("created_at", { ascending: true });
    if (caseIds && caseIds.length > 0) {
      query = query.in("case_id", caseIds);
    }
    return query;
  }, "getAllRecommendations");
  if (error || !data) return [];
  return data.map((row) => toRecommendation(row as Record<string, unknown>));
}

/**
 * Fetch ALL case events across the research schema in a single query,
 * optionally filtered to a set of case ids. Replacement for
 * per-case getEventsByCaseId loops in aggregators.
 */
export async function getAllCaseEvents(
  caseIds?: string[],
): Promise<CaseEvent[]> {
  const supabase = await tryCreateClient();
  if (!supabase) return [];
  const { data, error } = await withSupabaseRetry(() => {
    let query = supabase
      .schema("research")
      .from("case_events")
      .select("*")
      .order("occurred_at", { ascending: true });
    if (caseIds && caseIds.length > 0) {
      query = query.in("case_id", caseIds);
    }
    return query;
  }, "getAllCaseEvents");
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id as string,
    case_id: row.case_id as string,
    occurred_at: row.occurred_at as string,
    event_type: row.event_type as CaseEvent["event_type"],
    actor_id: row.actor_id as string,
    payload: row.payload as string,
  }));
}

export async function getRecommendationById(
  id: string,
): Promise<Recommendation | null> {
  const supabase = await tryCreateClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .schema("research")
    .from("recommendations")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return toRecommendation(data as Record<string, unknown>);
}

export async function createRecommendation(data: {
  case_id: string;
  engine_type: Recommendation["engine_type"];
  engine_version: string;
  confidence_type: Recommendation["confidence_type"];
  confidence_value: number;
  recommendation: string;
  explanation: string;
}): Promise<Recommendation> {
  const supabase = await tryCreateClient();
  if (!supabase) {
    throw new Error("Supabase is not configured. Cannot create recommendation.");
  }
  const { data: row, error } = await supabase
    .schema("research")
    .from("recommendations")
    .insert({
      case_id: data.case_id,
      engine_type: data.engine_type,
      engine_version: data.engine_version,
      confidence_type: data.confidence_type,
      confidence_value: data.confidence_value,
      recommendation: data.recommendation,
      explanation: data.explanation,
      accepted: null,
      override_reason: null,
    })
    .select()
    .single();
  if (error || !row) {
    throw new Error(`Failed to create recommendation: ${error?.message}`);
  }
  return toRecommendation(row as Record<string, unknown>);
}

export class RecommendationAlreadyDecidedError extends Error {
  constructor() {
    super("This recommendation has already been decided");
    this.name = "RecommendationAlreadyDecidedError";
  }
}

/**
 * Atomic check-and-update: the WHERE clause includes `accepted IS NULL`
 * so two concurrent decisions can't both succeed. The first writer
 * wins; the loser sees 0 rows updated and throws
 * RecommendationAlreadyDecidedError, which the action surfaces as a
 * 409-style "already decided" message in the UI.
 */
export async function decideRecommendation(
  id: string,
  accepted: boolean,
  overrideReason: string | null,
  decidedBy: string,
  decidedAt: string = new Date().toISOString(),
): Promise<Recommendation> {
  const supabase = await tryCreateClient();
  if (!supabase) {
    throw new Error("Supabase is not configured. Cannot record decision.");
  }
  const { data: row, error } = await supabase
    .schema("research")
    .from("recommendations")
    .update({
      accepted,
      override_reason: overrideReason,
      decided_by: decidedBy,
      decided_at: decidedAt,
    })
    .eq("id", id)
    .is("accepted", null) // <-- atomic guard: only update if still pending
    .select()
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to record decision: ${error.message}`);
  }
  if (!row) {
    // Either id doesn't exist, or accepted was already set (lost race).
    // Distinguish by re-reading.
    const existing = await getRecommendationById(id);
    if (existing && existing.accepted !== null) {
      throw new RecommendationAlreadyDecidedError();
    }
    throw new Error("Recommendation not found");
  }
  return toRecommendation(row as Record<string, unknown>);
}

// ── SOSCOMMAND operational context (READ-ONLY) ──────────────────────
//
// SOSPHD does not write to public.* operational tables. These functions
// surface the operational state of a case so the research view shows
// what actually happened around the events SOSPHD records itself.
//
// Tables read (per CLAUDE.md ownership):
//   - public.case_status_history     (SOSCOMMAND status audit)
//   - public.case_activity_log       (SOSCOMMAND activity log)
//   - public.case_transport          (transport actuals)
//   - public.guarantees_of_payment   (canonical GOP)
//   - public.insurer_interactions    (payer-side outreach)
//   - public.claims                  (downstream claim lifecycle)

export interface OperationalStatusChange {
  from_status: string | null;
  to_status: string;
  changed_at: string;
  changed_by_user_id: string | null;
  reason: string | null;
}

export interface OperationalActivity {
  action: string;
  actor_name: string | null;
  actor_id: string | null;
  created_at: string;
  details: Record<string, unknown> | null;
}

export interface OperationalTransport {
  mode: string | null;
  transport_status: string | null;
  origin_facility: string | null;
  destination_facility: string | null;
  origin_location: string | null;
  destination_location: string | null;
  actual_departure: string | null;
  actual_arrival: string | null;
  transport_provider: string | null;
  booking_reference: string | null;
}

export interface OperationalGOP {
  gop_number: string | null;
  status: string;
  amount_requested: number | null;
  amount_guaranteed: number | null;
  currency: string | null;
  requested_date: string | null;
  issued_date: string | null;
  expiry_date: string | null;
  payer_reference_number: string | null;
}

export interface OperationalInsurerInteraction {
  interaction_type: string;
  reference_number: string | null;
  status: string | null;
  amount: number | null;
  currency: string | null;
  notes: string | null;
  occurred_at: string;
}

export interface OperationalClaim {
  claim_number: string | null;
  status: string;
  amount_requested: number | null;
  amount_approved: number | null;
  amount_paid: number | null;
  currency: string | null;
  submitted_date: string | null;
  decision_date: string | null;
  denial_reason: string | null;
  paid_at: string | null;
}

export interface OperationalContext {
  has_data: boolean;
  status_history: OperationalStatusChange[];
  activity: OperationalActivity[];
  transport: OperationalTransport | null;
  gops: OperationalGOP[];
  insurer_interactions: OperationalInsurerInteraction[];
  claims: OperationalClaim[];
}

const EMPTY_OPERATIONAL_CONTEXT: OperationalContext = {
  has_data: false,
  status_history: [],
  activity: [],
  transport: null,
  gops: [],
  insurer_interactions: [],
  claims: [],
};

export async function getOperationalContext(
  caseId: string,
): Promise<OperationalContext> {
  const supabase = await tryCreateClient();
  if (!supabase) return EMPTY_OPERATIONAL_CONTEXT;

  // Run all six reads in parallel — operational tables are independent.
  const [
    statusHistoryResult,
    activityResult,
    transportResult,
    gopsResult,
    insurerInteractionsResult,
    claimsResult,
  ] = await Promise.all([
    supabase
      .from("case_status_history")
      .select(
        "from_status, to_status, changed_at, changed_by_user_id, reason",
      )
      .eq("case_id", caseId)
      .order("changed_at", { ascending: true }),
    supabase
      .from("case_activity_log")
      .select("action, actor_id, actor_name, created_at, details")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("case_transport")
      .select(
        "mode, transport_status, origin_facility, destination_facility, origin_location, destination_location, actual_departure, actual_arrival, transport_provider, booking_reference",
      )
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("guarantees_of_payment")
      .select(
        "gop_number, status, amount_requested, amount_guaranteed, currency, requested_date, issued_date, expiry_date, payer_reference_number",
      )
      .eq("case_id", caseId)
      .order("created_at", { ascending: false }),
    supabase
      .from("insurer_interactions")
      .select(
        "interaction_type, reference_number, status, amount, currency, notes, occurred_at",
      )
      .eq("case_id", caseId)
      .order("occurred_at", { ascending: false })
      .limit(10),
    supabase
      .from("claims")
      .select(
        "claim_number, status, amount_requested, amount_approved, amount_paid, currency, submitted_date, decision_date, denial_reason, paid_at",
      )
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const status_history = (statusHistoryResult.data ?? []) as OperationalStatusChange[];
  const activity = (activityResult.data ?? []).map((row) => ({
    action: (row.action as string) ?? "",
    actor_id: (row.actor_id as string | null) ?? null,
    actor_name: (row.actor_name as string | null) ?? null,
    created_at: (row.created_at as string) ?? "",
    details: (row.details as Record<string, unknown> | null) ?? null,
  })) as OperationalActivity[];
  const transport = (transportResult.data ?? null) as OperationalTransport | null;
  const gops = (gopsResult.data ?? []) as OperationalGOP[];
  const insurer_interactions = (insurerInteractionsResult.data ?? []) as OperationalInsurerInteraction[];
  const claims = (claimsResult.data ?? []) as OperationalClaim[];

  const has_data =
    status_history.length > 0 ||
    activity.length > 0 ||
    transport !== null ||
    gops.length > 0 ||
    insurer_interactions.length > 0 ||
    claims.length > 0;

  return {
    has_data,
    status_history,
    activity,
    transport,
    gops,
    insurer_interactions,
    claims,
  };
}

export async function getEventCountByCaseId(caseId: string): Promise<number> {
  const supabase = await tryCreateClient();
  if (!supabase) return 0;
  const { count, error } = await supabase
    .schema("research")
    .from("case_events")
    .select("*", { count: "exact", head: true })
    .eq("case_id", caseId);

  if (error) return 0;
  return count ?? 0;
}

/**
 * Single-roundtrip event counts for a set of cases. Replaces the
 * N+1 anti-pattern of `Promise.all(cases.map(c => getEventCountByCaseId(c.id)))`
 * on the cases list page: one case_id projection query, grouped in memory.
 *
 * For N cases this collapses N count queries into one bulk fetch.
 * Empty input array short-circuits to an empty Map without a network call.
 */
export async function getEventCountsByCaseIds(
  caseIds: string[],
): Promise<Map<string, number>> {
  if (caseIds.length === 0) return new Map();
  const supabase = await tryCreateClient();
  if (!supabase) return new Map();
  const { data, error } = await supabase
    .schema("research")
    .from("case_events")
    .select("case_id")
    .in("case_id", caseIds);
  if (error || !data) return new Map();
  const counts = new Map<string, number>();
  for (const row of data) {
    const id = row.case_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}
