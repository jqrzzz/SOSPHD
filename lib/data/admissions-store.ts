import "server-only";

/* ─── Admissions read paths ────────────────────────────────────────────
 *  Institutions, their requirements, and supervisor outreach. Same
 *  degraded-mode contract as the other stores: loud warning, empty
 *  result — never silent fake data on a research surface.
 * ────────────────────────────────────────────────────────────────────── */

import { getServerSupabase } from "@/lib/supabase/server-auth";
import { warnDegradedMode } from "@/lib/data/degraded";
import type {
  Institution,
  InstitutionRequirement,
  Outreach,
} from "./admissions-types";

export async function getInstitutions(): Promise<Institution[]> {
  const sb = await getServerSupabase();
  if (!sb) {
    warnDegradedMode("getInstitutions", "supabase unavailable");
    return [];
  }
  const { data, error } = await sb
    .schema("research")
    .from("institutions")
    .select("*")
    // Nulls last so undated programmes don't crowd out live deadlines.
    .order("next_deadline", { ascending: true, nullsFirst: false })
    .order("fit_score", { ascending: false });
  if (error) {
    warnDegradedMode("getInstitutions", error.message);
    return [];
  }
  return (data ?? []) as Institution[];
}

export async function getInstitutionById(
  id: string,
): Promise<Institution | null> {
  const sb = await getServerSupabase();
  if (!sb) {
    warnDegradedMode("getInstitutionById", "supabase unavailable");
    return null;
  }
  const { data, error } = await sb
    .schema("research")
    .from("institutions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    warnDegradedMode("getInstitutionById", error.message);
    return null;
  }
  return (data as Institution) ?? null;
}

export async function getRequirements(
  institutionId?: string,
): Promise<InstitutionRequirement[]> {
  const sb = await getServerSupabase();
  if (!sb) {
    warnDegradedMode("getRequirements", "supabase unavailable");
    return [];
  }
  let query = sb
    .schema("research")
    .from("institution_requirements")
    .select("*")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (institutionId) query = query.eq("institution_id", institutionId);
  const { data, error } = await query;
  if (error) {
    warnDegradedMode("getRequirements", error.message);
    return [];
  }
  return (data ?? []) as InstitutionRequirement[];
}

export async function getOutreach(institutionId?: string): Promise<Outreach[]> {
  const sb = await getServerSupabase();
  if (!sb) {
    warnDegradedMode("getOutreach", "supabase unavailable");
    return [];
  }
  let query = sb
    .schema("research")
    .from("outreach")
    .select("*")
    .order("created_at", { ascending: false });
  if (institutionId) query = query.eq("institution_id", institutionId);
  const { data, error } = await query;
  if (error) {
    warnDegradedMode("getOutreach", error.message);
    return [];
  }
  return (data ?? []) as Outreach[];
}
