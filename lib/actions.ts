"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  addEvent,
  decideRecommendation,
  getRecommendationById,
} from "@/lib/data/store";
import { createClient } from "@/lib/supabase/server";
import {
  generateRecommendationsForCase,
  RecommendationError,
} from "@/lib/recommendations";
import { EVENT_TYPES } from "@/lib/data/types";

// ── Schemas ──────────────────────────────────────────────────────────

const addEventSchema = z.object({
  case_id: z.string().min(1),
  event_type: z.enum(EVENT_TYPES),
  occurred_at: z.string().min(1, "Event time is required"),
  payload: z.string().default(""),
});

// Per docs/audit-action-plan.md Decision C: SOSPHD does not create
// cases. Cases originate in SOSCOMMAND. The former createCaseAction
// inserted a placeholder patient_id that violated the FK and would
// have polluted SOSCOMMAND's operational table if it had ever
// succeeded. Function and UI removed.

// ── Actions ─────────────────────────────────────────────────────────

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

  // Resolve the authenticated user once — the same id goes onto both the
  // recommendation row (decided_by) and the audit NOTE (actor_id) so the
  // two records stay consistent.
  let actorId: string;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      return {
        error:
          "Not authenticated — sign in before deciding recommendations. Paper 2 provenance requires a real operator id.",
      };
    }
    actorId = data.user.id;
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? `Auth check failed: ${err.message}`
          : "Auth check failed",
    };
  }

  const accepted = decision === "accept";
  const decidedAt = new Date().toISOString();
  try {
    await decideRecommendation(
      recommendationId,
      accepted,
      accepted ? null : overrideReason!.trim(),
      actorId,
      decidedAt,
    );

    // Log the decision on the case timeline as a NOTE — denormalized
    // mirror of the columns, kept for the immutable timeline view.
    await addEvent({
      case_id: existing.case_id,
      event_type: "NOTE",
      occurred_at: decidedAt,
      actor_id: actorId,
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
    const recommendations = await generateRecommendationsForCase({
      caseId,
      count,
    });
    revalidatePath(`/cases/${caseId}`);
    return { success: true, count: recommendations.length };
  } catch (err) {
    if (err instanceof RecommendationError) {
      return { error: err.message };
    }
    return {
      error: err instanceof Error ? err.message : "Generation request failed",
    };
  }
}
