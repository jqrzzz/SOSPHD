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
import { gateAIUsage, gateResearchRequest } from "@/lib/ai/gate";
import {
  readAIRequestJson,
  requestPolicyErrorResponse,
} from "@/lib/ai/request-policy";

export const maxDuration = 60;

const requestSchema = z.object({
  case_id: z.string().min(1).max(128),
  count: z.number().int().min(1).max(5).default(3),
});

export async function POST(req: Request) {
  const research = await gateResearchRequest();
  if (!research.ok) return research.response;

  let body: unknown;
  try {
    body = await readAIRequestJson(req);
  } catch (error) {
    const response = requestPolicyErrorResponse(error);
    if (response) return response;
    throw error;
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const usage = gateAIUsage(research.grant, "recommendations");
  if (!usage.ok) return usage.response;

  try {
    const recommendations = await generateRecommendationsForCase({
      caseId: parsed.data.case_id,
      count: parsed.data.count,
      signal: req.signal,
      grant: usage.grant,
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
