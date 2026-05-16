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

/** Map operational case_status to SOSPHD's simpler 3-state model */
function mapStatus(opStatus: string): CaseStatus {
  switch (opStatus) {
    case "intake":
    case "pending_info":
    case "pending_authorization":
      return "open";
    case "active":
    case "in_treatment":
    case "transport_arranged":
      return "active";
    case "discharged":
    case "billing":
    case "claims":
    case "closed":
    case "cancelled":
      return "closed";
    default:
      return "open";
  }
}

/** Map operational case_priority to SOSPHD severity (1-5) */
function mapPriority(priority: string): Severity {
  switch (priority) {
    case "low": return 1;
    case "normal": return 2;
    case "high": return 3;
    case "critical": return 4;
    default: return 2;
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
  };
}

// ── Query functions ─────────────────────────────────────────────────

export async function getCases(filters?: {
  status?: CaseStatus;
  search?: string;
}): Promise<Case[]> {
  const supabase = await tryCreateClient();
  if (!supabase) return [];

  const query = supabase
    .from("cases")
    .select("*, patients(full_name, medical_id)")
    .order("created_at", { ascending: false });

  // We filter in JS since operational statuses don't map 1:1
  const { data, error } = await query;
  if (error || !data) return [];

  let result = data.map(toCase);

  if (filters?.status) {
    result = result.filter((c) => c.status === filters.status);
  }
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
  const { data, error } = await supabase
    .from("cases")
    .select("*, patients(full_name, medical_id)")
    .eq("id", id)
    .single();

  if (error || !data) return undefined;
  return toCase(data);
}

export async function createCase(data: {
  severity: Severity;
  chief_complaint: string;
  patient_ref: string;
  notes: string;
}): Promise<Case> {
  // Creating a case in the operational system is complex (requires patient_id, etc.)
  // For the research layer, we create a minimal case entry.
  // In production, cases originate from SOSCOMMAND — SOSPHD is read-mostly.
  const supabase = await tryCreateClient();
  if (!supabase) {
    throw new Error("Supabase is not configured. Cannot create case.");
  }
  const caseNumber = `SOS-${Date.now().toString(36).toUpperCase()}`;

  const { data: newCase, error } = await supabase
    .from("cases")
    .insert({
      case_number: caseNumber,
      patient_id: "00000000-0000-0000-0000-000000000000", // placeholder
      status: "intake",
      priority: data.severity >= 4 ? "critical" : data.severity >= 3 ? "high" : "normal",
      incident_description: data.chief_complaint,
      notes: data.notes,
    })
    .select("*, patients(full_name, medical_id)")
    .single();

  if (error || !newCase) {
    throw new Error(`Failed to create case: ${error?.message}`);
  }

  return toCase(newCase);
}

// ── Events (research schema) ────────────────────────────────────────

export async function getEventsByCaseId(caseId: string): Promise<CaseEvent[]> {
  const supabase = await tryCreateClient();
  if (!supabase) return [];

  // Materialize any new SOSCOMMAND timestamps before reading. Idempotent
  // and best-effort: if the sync fails, we still return the events we
  // have. This is what makes Paper 1's TTTA/TTGP/TTDC numbers come
  // from operational reality rather than operator data entry.
  try {
    const { syncCaseFromOperational } = await import("./sync");
    await syncCaseFromOperational(caseId);
  } catch {
    // Sync failure should never block reading existing events.
  }

  const { data, error } = await supabase
    .schema("research")
    .from("case_events")
    .select("*")
    .eq("case_id", caseId)
    .order("occurred_at", { ascending: true });

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
  let query = supabase
    .schema("research")
    .from("recommendations")
    .select("*")
    .order("created_at", { ascending: true });
  if (caseIds && caseIds.length > 0) {
    query = query.in("case_id", caseIds);
  }
  const { data, error } = await query;
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
  let query = supabase
    .schema("research")
    .from("case_events")
    .select("*")
    .order("occurred_at", { ascending: true });
  if (caseIds && caseIds.length > 0) {
    query = query.in("case_id", caseIds);
  }
  const { data, error } = await query;
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
