/* ─── PhD Agent API ───────────────────────────────────────────────────
 *  REST endpoint for the PhD research agent.
 *  Used by:
 *  - The SOSPHD UI (advisor, dashboard, workspace)
 *  - Other SOS ecosystem agents (SOSCOMMAND, SOSTRAVEL, etc.)
 *  - External research tools
 *
 *  POST /api/agent  — execute an agent action
 *  GET  /api/agent  — discover agent capabilities
 * ────────────────────────────────────────────────────────────────────── */

import { z } from "zod";
import { executeAgent, getAgentCapabilities, type AgentAction } from "@/lib/agent/core";

const VALID_ACTIONS: AgentAction[] = [
  "research_status",
  "identify_gaps",
  "compute_metrics",
  "categorize",
  "corridor_analysis",
  "weekly_digest",
  "suggest_next_actions",
  "answer_query",
  "create_task",
  "create_note",
];

const requestSchema = z.object({
  action: z.enum(VALID_ACTIONS as [AgentAction, ...AgentAction[]]),
  params: z.record(z.unknown()).optional(),
  caller: z.object({
    system: z.string(),
    context: z.string().optional(),
  }).optional(),
});

/** GET /api/agent — Discover agent capabilities */
export async function GET() {
  return Response.json(getAgentCapabilities());
}

/** POST /api/agent — Execute an agent action */
export async function POST(req: Request) {
  const body = await req.json();
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid request",
        details: parsed.error.issues,
        availableActions: VALID_ACTIONS,
      },
      { status: 400 },
    );
  }

  try {
    const response = await executeAgent({
      action: parsed.data.action,
      params: parsed.data.params,
      caller: parsed.data.caller,
    });

    return Response.json(response);
  } catch (err) {
    return Response.json(
      { error: "Agent execution failed", message: String(err) },
      { status: 500 },
    );
  }
}
