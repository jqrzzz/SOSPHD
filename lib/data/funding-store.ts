import "server-only";

/* ─── Funding read paths ───────────────────────────────────────────────
 *  Same degraded-mode contract as the other stores: warn loudly, return
 *  empty — never invent funding that does not exist.
 * ────────────────────────────────────────────────────────────────────── */

import { getServerSupabase } from "@/lib/supabase/server-auth";
import { warnDegradedMode } from "@/lib/data/degraded";
import type { FundingOpportunity } from "./funding-types";

export async function getFundingOpportunities(): Promise<FundingOpportunity[]> {
  const sb = await getServerSupabase();
  if (!sb) {
    warnDegradedMode("getFundingOpportunities", "supabase unavailable");
    return [];
  }
  const { data, error } = await sb
    .schema("research")
    .from("funding_opportunities")
    .select("*")
    .order("fit_score", { ascending: false, nullsFirst: false })
    .order("next_deadline", { ascending: true, nullsFirst: false });
  if (error) {
    warnDegradedMode("getFundingOpportunities", error.message);
    return [];
  }
  return (data ?? []) as FundingOpportunity[];
}

export async function getFundingOpportunityById(
  id: string,
): Promise<FundingOpportunity | null> {
  const sb = await getServerSupabase();
  if (!sb) {
    warnDegradedMode("getFundingOpportunityById", "supabase unavailable");
    return null;
  }
  const { data, error } = await sb
    .schema("research")
    .from("funding_opportunities")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    warnDegradedMode("getFundingOpportunityById", error.message);
    return null;
  }
  return (data as FundingOpportunity) ?? null;
}
