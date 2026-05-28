/* ─── Recommendation Generation API ───────────────────────────────────
 *  Thin HTTP wrapper around lib/recommendations.ts. Exists so external
 *  callers (other SOS apps, scripts, debug tools) can invoke the same
 *  engine the server action uses internally.
 *
 *  POST /api/recommendations/generate
 *  Body: { case_id: string, count?: number }
 * ────────────────────────────────────────────────────────────────────── */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  generateRecommendationsForCase,
  RecommendationError,
} from "@/lib/recommendations";
import {
  requireAuthenticatedUser,
  UnauthenticatedError,
} from "@/lib/ai/config";

export const maxDuration = 60;

const requestSchema = z.object({
  case_id: z.string().min(1),
  count: z.number().int().min(1).max(5).default(3),
});

export async function POST(req: Request) {
  try {
    await requireAuthenticatedUser();
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch (err) {
    return Response.json(
      {
        error: "Malformed JSON in request body",
        detail: err instanceof Error ? err.message : undefined,
      },
      { status: 400 },
    );
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  try {
    const recommendations = await generateRecommendationsForCase({
      caseId: parsed.data.case_id,
      count: parsed.data.count,
      signal: req.signal,
    });
    revalidatePath(`/cases/${parsed.data.case_id}`);
    return Response.json({
      case_id: parsed.data.case_id,
      count: recommendations.length,
      recommendations,
    });
  } catch (err) {
    if (err instanceof RecommendationError) {
      return Response.json(
        { error: err.message, ...(err.detail ? { detail: err.detail } : {}) },
        { status: err.status },
      );
    }
    throw err;
  }
}
