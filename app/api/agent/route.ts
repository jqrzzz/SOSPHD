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
import {
  requireAuthenticatedUser,
  UnauthenticatedError,
} from "@/lib/ai/config";

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

/** GET /api/agent — Discover agent capabilities. Auth-gated so capability
 *  discovery doesn't leak the action surface to unauthenticated callers. */
export async function GET() {
  try {
    await requireAuthenticatedUser();
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
  return Response.json(getAgentCapabilities());
}

/** POST /api/agent — Execute an agent action */
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
    console.error("[SOSPHD] /api/agent: executeAgent failed:", err);
    return Response.json(
      {
        error: "Agent execution failed",
        message: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
