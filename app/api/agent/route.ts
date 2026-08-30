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
import { gateResearchRequest } from "@/lib/ai/gate";
import {
  readAIRequestJson,
  requestPolicyErrorResponse,
} from "@/lib/ai/request-policy";

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
    system: z.string().min(1).max(64),
    context: z.string().max(4_000).optional(),
  }).optional(),
});

/** GET /api/agent — Discover agent capabilities. Auth-gated so capability
 *  discovery doesn't leak the action surface to unauthenticated callers. */
export async function GET() {
  const research = await gateResearchRequest();
  if (!research.ok) return research.response;
  return Response.json(getAgentCapabilities());
}

/** POST /api/agent — Execute an agent action */
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
    console.error("[SOSPHD] /api/agent: executeAgent failed", {
      code: "agent_execution_failed",
      error_type: err instanceof Error ? err.name : "unknown",
    });
    return Response.json(
      {
        error: "Agent execution failed",
      },
      { status: 500 },
    );
  }
}
