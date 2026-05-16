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

export async function decideRecommendation(
  id: string,
  accepted: boolean,
  overrideReason: string | null,
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
    })
    .eq("id", id)
    .select()
    .single();
  if (error || !row) {
    throw new Error(`Failed to record decision: ${error?.message}`);
  }
  return toRecommendation(row as Record<string, unknown>);
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
