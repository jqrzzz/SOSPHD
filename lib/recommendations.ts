/* ─── Recommendation Generation Engine (Paper 2) ──────────────────────
 *  Pure library: takes a case id, returns persisted recommendation rows.
 *  Used by both the API route (/api/recommendations/generate) and the
 *  server action (generateRecommendationsAction) — same code path, no
 *  self-HTTP round-trips.
 *
 *  Operates under SOSPHD Intervention Protocol v0.1 — the system prompt
 *  cites the protocol scope and confidence policy verbatim.
 * ────────────────────────────────────────────────────────────────────── */

import { generateText } from "ai";
import { z } from "zod";
import {
  getCaseById,
  getEventsByCaseId,
  createRecommendation,
} from "@/lib/data/store";
import { computeAllMetrics, formatDuration } from "@/lib/data/metrics";
import { modelFor, requireAIKey, MissingAIKeyError } from "@/lib/ai/config";
import { PROTOCOL_VERSION } from "@/lib/protocol";
import type { Recommendation } from "@/lib/data/types";

export const ENGINE_VERSION = "llm-paper2-v0.1";

export type RecommendationCategory =
  | "transport"
  | "payment"
  | "triage"
  | "facility"
  | "follow_up"
  | "data_capture"
  | "other";

export class RecommendationError extends Error {
  constructor(
    message: string,
    public status: number = 500,
    public detail?: unknown,
  ) {
    super(message);
    this.name = "RecommendationError";
  }
}

const recommendationSchema = z.object({
  recommendations: z
    .array(
      z.object({
        recommendation: z.string().min(1),
        explanation: z.string().min(1),
        confidence: z.number().min(0).max(1),
        category: z
          .enum([
            "transport",
            "payment",
            "triage",
            "facility",
            "follow_up",
            "data_capture",
            "other",
          ])
          .default("other"),
      }),
    )
    .min(1)
    .max(5),
});

const SYSTEM_PROMPT = `You are the SOS PHD recommendation engine for Paper 2 of the research program. You operate under SOSPHD Intervention Protocol ${PROTOCOL_VERSION}.

Your task: given the current state of a tourist medical emergency case, produce 1-3 actionable, narrowly-scoped recommendations that a Tourist SOS operator could plausibly act on right now.

## Protocol §1 — Scope
Allowed categories: transport, payment, triage, facility, follow_up, data_capture, other.
Out of scope: clinical orders, drug dosing, definitive diagnosis, patient-side advice. The intervention coordinates the system around the patient; it does not replace the clinician.

## Protocol §2 — Confidence policy
Confidence is your honest estimate in [0,1]:
- 0.80-1.00 (High): evidence in the timeline is unambiguous.
- 0.50-0.79 (Medium): default operating zone for well-supported coordination suggestions.
- 0.00-0.49 (Low): use when milestones are missing or evidence is sparse.
Be calibrated — Paper 2's reliability diagram depends on it.

## Output rules
- Output strictly valid JSON matching the requested schema. No prose outside the JSON.
- Each recommendation must reference observable case state (specific events, missing milestones, computed metrics). NEVER invent patient details.
- Each "explanation" is one short paragraph (<= 60 words) citing the specific events / metric values that justified the recommendation.
- Recommendations should be coordination-oriented: payer triggers, transport activation, facility escalation, data-capture gaps. NOT clinical orders.

## Output schema
{
  "recommendations": [
    {
      "recommendation": "<single sentence imperative>",
      "explanation": "<short justification citing event types and metric values>",
      "confidence": 0.0-1.0,
      "category": "transport" | "payment" | "triage" | "facility" | "follow_up" | "data_capture" | "other"
    }
  ]
}`;

function formatCaseContext(
  caseRow: NonNullable<Awaited<ReturnType<typeof getCaseById>>>,
  events: Awaited<ReturnType<typeof getEventsByCaseId>>,
): string {
  const metrics = computeAllMetrics(events);
  const lines: string[] = [
    `## Case ${caseRow.patient_ref}`,
    `- Status: ${caseRow.status}`,
    `- Severity: ${caseRow.severity}/5`,
    `- Chief complaint: ${caseRow.chief_complaint}`,
    `- Created: ${caseRow.created_at}`,
  ];
  if (caseRow.notes) lines.push(`- Notes: ${caseRow.notes}`);

  lines.push("", `## Events (${events.length})`);
  if (events.length === 0) {
    lines.push("- (no events logged yet)");
  } else {
    for (const e of events) {
      const payload = e.payload ? ` — ${e.payload}` : "";
      lines.push(`- [${e.occurred_at}] ${e.event_type}${payload}`);
    }
  }

  lines.push("", "## Computed metrics");
  for (const m of metrics) {
    const value =
      m.value_ms !== null
        ? `${formatDuration(m.value_ms)}${m.is_running ? " (running)" : ""}`
        : "N/A (missing milestone)";
    lines.push(`- ${m.abbreviation} (${m.label}): ${value}`);
  }

  return lines.join("\n");
}

export interface GenerateOptions {
  caseId: string;
  count?: number;
  signal?: AbortSignal;
}

/**
 * Generate AI recommendations for a case and persist them to
 * research.recommendations. Throws RecommendationError on failure;
 * callers handle the error or surface it as appropriate.
 */
export async function generateRecommendationsForCase({
  caseId,
  count = 3,
  signal,
}: GenerateOptions): Promise<Recommendation[]> {
  try {
    requireAIKey("recommendations");
  } catch (err) {
    if (err instanceof MissingAIKeyError) {
      throw new RecommendationError(err.message, err.status);
    }
    throw err;
  }

  const caseRow = await getCaseById(caseId);
  if (!caseRow) {
    throw new RecommendationError("Case not found", 404);
  }

  const events = await getEventsByCaseId(caseId);
  const context = formatCaseContext(caseRow, events);

  const result = await generateText({
    model: modelFor("recommendations"),
    system: SYSTEM_PROMPT,
    prompt: [
      `Generate ${count} recommendation${count === 1 ? "" : "s"} for the case below. Output strictly valid JSON.`,
      "",
      context,
    ].join("\n"),
    abortSignal: signal,
  });

  // Strip fences if the model wrapped output despite instructions.
  const jsonText = (() => {
    const fenced = result.text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fenced) return fenced[1];
    return result.text;
  })();

  let parsedResult: z.infer<typeof recommendationSchema>;
  try {
    parsedResult = recommendationSchema.parse(JSON.parse(jsonText));
  } catch (err) {
    throw new RecommendationError(
      "AI returned malformed recommendations",
      502,
      {
        detail: err instanceof Error ? err.message : "parse failure",
        raw: result.text.slice(0, 500),
      },
    );
  }

  const persisted: Recommendation[] = [];
  for (const rec of parsedResult.recommendations) {
    const row = await createRecommendation({
      case_id: caseId,
      engine_type: "llm",
      engine_version: `${ENGINE_VERSION}/${rec.category}`,
      confidence_type: "probability",
      confidence_value: rec.confidence,
      recommendation: rec.recommendation,
      explanation: rec.explanation,
    });
    persisted.push(row);
  }

  return persisted;
}
