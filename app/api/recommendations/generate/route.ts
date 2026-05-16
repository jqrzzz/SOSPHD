/* ─── Recommendation Generation API ───────────────────────────────────
 *  POST /api/recommendations/generate
 *  Body: { case_id: string, count?: number }
 *
 *  Produces structured AI recommendations grounded in the case's events
 *  and corridor context. Each recommendation is persisted to
 *  research.recommendations with accepted=null (pending decision).
 *
 *  This is the source of the human-AI coordination signal Paper 2
 *  measures: every recommendation here gets accepted/overridden by an
 *  operator, and those decisions become the intervention data.
 * ────────────────────────────────────────────────────────────────────── */

import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  getCaseById,
  getEventsByCaseId,
  createRecommendation,
} from "@/lib/data/store";
import { computeAllMetrics, formatDuration } from "@/lib/data/metrics";
import type { Recommendation } from "@/lib/data/types";

export const maxDuration = 60;

const PROTOCOL_VERSION = "v0.1";
const ENGINE_VERSION = "llm-paper2-v0.1";

const requestSchema = z.object({
  case_id: z.string().min(1),
  count: z.number().int().min(1).max(5).default(3),
});

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

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      {
        error:
          "AI features require an OPENAI_API_KEY environment variable. Add it to your .env.local file.",
      },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const { case_id, count } = parsed.data;

  const caseRow = await getCaseById(case_id);
  if (!caseRow) {
    return Response.json({ error: "Case not found" }, { status: 404 });
  }

  const events = await getEventsByCaseId(case_id);
  const context = formatCaseContext(caseRow, events);

  const result = await generateText({
    model: openai("gpt-4o-mini"),
    system: SYSTEM_PROMPT,
    prompt: [
      `Generate ${count} recommendation${count === 1 ? "" : "s"} for the case below. Output strictly valid JSON.`,
      "",
      context,
    ].join("\n"),
    abortSignal: req.signal,
  });

  // Extract JSON from the response (the model occasionally wraps in fences)
  const jsonText = (() => {
    const fenced = result.text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fenced) return fenced[1];
    return result.text;
  })();

  let parsedResult: z.infer<typeof recommendationSchema>;
  try {
    parsedResult = recommendationSchema.parse(JSON.parse(jsonText));
  } catch (err) {
    return Response.json(
      {
        error: "AI returned malformed recommendations",
        detail: err instanceof Error ? err.message : "parse failure",
        raw: result.text.slice(0, 500),
      },
      { status: 502 },
    );
  }

  const persisted: Recommendation[] = [];
  for (const rec of parsedResult.recommendations) {
    const row = await createRecommendation({
      case_id,
      engine_type: "llm",
      engine_version: `${ENGINE_VERSION}/${rec.category}`,
      confidence_type: "probability",
      confidence_value: rec.confidence,
      recommendation: rec.recommendation,
      explanation: rec.explanation,
    });
    persisted.push(row);
  }

  revalidatePath(`/cases/${case_id}`);

  return Response.json({
    case_id,
    count: persisted.length,
    recommendations: persisted,
  });
}
