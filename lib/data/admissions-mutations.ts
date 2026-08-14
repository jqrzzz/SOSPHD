import "server-only";

/* ─── Admissions write paths — SERVER ONLY ─────────────────────────────
 *  All writes resolve auth and bound queries by user_id (defence in
 *  depth behind RLS). Errors throw loudly; the server actions in
 *  lib/admissions-actions.ts wrap them into {error} envelopes.
 * ────────────────────────────────────────────────────────────────────── */

import { requireAuthOrThrow } from "@/lib/supabase/server-auth";
import type {
  ApplicationStage,
  Outreach,
  RequirementStatus,
} from "./admissions-types";

export async function setRequirementStatus(
  id: string,
  status: RequirementStatus,
): Promise<void> {
  const { supabase: sb, userId } = await requireAuthOrThrow();
  const { error } = await sb
    .schema("research")
    .from("institution_requirements")
    .update({ status })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(`Failed to update requirement: ${error.message}`);
}

export async function setInstitutionStage(
  id: string,
  stage: ApplicationStage,
): Promise<void> {
  const { supabase: sb, userId } = await requireAuthOrThrow();
  const { error } = await sb
    .schema("research")
    .from("institutions")
    .update({ stage, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(`Failed to update stage: ${error.message}`);
}

/** Mark a requirement's facts confirmed against the official page. Only
 *  the owner can do this — agents may never self-certify (AGENTS.md). */
export async function verifyRequirement(id: string): Promise<void> {
  const { supabase: sb, userId } = await requireAuthOrThrow();
  const { error } = await sb
    .schema("research")
    .from("institution_requirements")
    .update({ verified_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(`Failed to verify requirement: ${error.message}`);
}

export async function updateInstitutionNotes(
  id: string,
  notes: string,
): Promise<void> {
  const { supabase: sb, userId } = await requireAuthOrThrow();
  const { error } = await sb
    .schema("research")
    .from("institutions")
    .update({ notes, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(`Failed to save notes: ${error.message}`);
}

export async function createOutreach(data: {
  institution_id: string;
  person_name: string;
  person_role?: string | null;
  subject?: string | null;
  body: string;
  follow_up_at?: string | null;
}): Promise<Outreach> {
  const { supabase: sb, userId } = await requireAuthOrThrow();
  const { data: row, error } = await sb
    .schema("research")
    .from("outreach")
    .insert({
      user_id: userId,
      institution_id: data.institution_id,
      person_name: data.person_name,
      person_role: data.person_role ?? null,
      subject: data.subject ?? null,
      body: data.body,
      follow_up_at: data.follow_up_at ?? null,
      status: "draft",
    })
    .select()
    .single();
  if (error || !row) {
    throw new Error(`Failed to save outreach: ${error?.message}`);
  }
  return row as Outreach;
}

export async function updateOutreach(
  id: string,
  updates: {
    subject?: string;
    body?: string;
    status?: string;
    follow_up_at?: string | null;
    sent_at?: string | null;
  },
): Promise<void> {
  const { supabase: sb, userId } = await requireAuthOrThrow();
  const { error } = await sb
    .schema("research")
    .from("outreach")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(`Failed to update outreach: ${error.message}`);
}

export async function deleteOutreach(id: string): Promise<void> {
  const { supabase: sb, userId } = await requireAuthOrThrow();
  const { error } = await sb
    .schema("research")
    .from("outreach")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(`Failed to delete outreach: ${error.message}`);
}
