"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createCase,
  addEvent,
  decideRecommendation,
  getRecommendationById,
} from "@/lib/data/store";
import { EVENT_TYPES } from "@/lib/data/types";

// ── Schemas ──────────────────────────────────────────────────────────

const createCaseSchema = z.object({
  patient_ref: z.string().min(1, "Patient reference is required"),
  severity: z.coerce.number().int().min(1).max(5),
  chief_complaint: z.string().min(1, "Chief complaint is required"),
  notes: z.string().default(""),
});

const addEventSchema = z.object({
  case_id: z.string().min(1),
  event_type: z.enum(EVENT_TYPES),
  occurred_at: z.string().min(1, "Event time is required"),
  payload: z.string().default(""),
});

// ── Actions ─────────────────────────────────────────────────────────

export async function createCaseAction(
  _prevState: { error?: string } | null,
  formData: FormData,
) {
  const raw = {
    patient_ref: formData.get("patient_ref"),
    severity: formData.get("severity"),
    chief_complaint: formData.get("chief_complaint"),
    notes: formData.get("notes") ?? "",
  };

  const parsed = createCaseSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const newCase = await createCase({
    severity: parsed.data.severity as 1 | 2 | 3 | 4 | 5,
    chief_complaint: parsed.data.chief_complaint,
    patient_ref: parsed.data.patient_ref,
    notes: parsed.data.notes,
  });

  redirect(`/cases/${newCase.id}`);
}

export async function addEventAction(
  _prevState: { error?: string; success?: boolean } | null,
  formData: FormData,
) {
  const raw = {
    case_id: formData.get("case_id"),
    event_type: formData.get("event_type"),
    occurred_at: formData.get("occurred_at"),
    payload: formData.get("payload") ?? "",
  };

  const parsed = addEventSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await addEvent(parsed.data);

  revalidatePath(`/cases/${parsed.data.case_id}`);
  return { success: true };
}

// ── Recommendations: operator decision flow (Paper 2) ───────────────

/**
 * Operator accepts or overrides an AI recommendation.
 *
 * Writes:
 * 1. recommendation.accepted (true/false), override_reason
 * 2. a NOTE event on the case timeline so the decision is part of the
 *    provenance chain (occurred_at + actor_id = who/when)
 *
 * Paper 2's intervention measurement is the difference in TTDC / TTGP
 * for cases where coordination decisions went through this flow vs
 * baseline. The NOTE-on-timeline is what gives us the timestamped
 * decision audit a viva will demand.
 */
export async function decideRecommendationAction(
  recommendationId: string,
  decision: "accept" | "override",
  overrideReason?: string,
): Promise<{ error?: string; success?: boolean }> {
  if (!recommendationId) {
    return { error: "Missing recommendation id" };
  }

  const existing = await getRecommendationById(recommendationId);
  if (!existing) {
    return { error: "Recommendation not found" };
  }
  if (existing.accepted !== null) {
    return { error: "Decision has already been recorded for this recommendation" };
  }
  if (decision === "override" && (!overrideReason || !overrideReason.trim())) {
    return { error: "Override requires a reason" };
  }

  const accepted = decision === "accept";
  try {
    await decideRecommendation(
      recommendationId,
      accepted,
      accepted ? null : overrideReason!.trim(),
    );

    // Log the decision on the case timeline as a NOTE — this is the
    // timestamped audit row Paper 2 cites.
    await addEvent({
      case_id: existing.case_id,
      event_type: "NOTE",
      occurred_at: new Date().toISOString(),
      payload: JSON.stringify({
        kind: "rec_decision",
        recommendation_id: recommendationId,
        engine_type: existing.engine_type,
        engine_version: existing.engine_version,
        confidence_value: existing.confidence_value,
        decision: accepted ? "accepted" : "overridden",
        override_reason: accepted ? null : overrideReason!.trim(),
        recommendation_text: existing.recommendation,
      }),
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to record decision",
    };
  }

  revalidatePath(`/cases/${existing.case_id}`);
  return { success: true };
}

export async function generateRecommendationsAction(
  caseId: string,
  count: number = 3,
): Promise<{ error?: string; success?: boolean; count?: number }> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/recommendations/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ case_id: caseId, count }),
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { error: body.error ?? `Failed (${res.status})` };
    }
    const body = await res.json();
    revalidatePath(`/cases/${caseId}`);
    return { success: true, count: body.count };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Generation request failed",
    };
  }
}
