/* ─── PhD Agent Core ──────────────────────────────────────────────────
 *  The orchestrator. Takes a request, reasons about it using domain
 *  knowledge, picks tools, and returns structured results.
 *
 *  This is NOT a chatbot — it's a function-calling agent that other
 *  systems (UI, API, other agents) can invoke programmatically.
 *
 *  Architecture:
 *  1. Request comes in (from UI, API, or another agent)
 *  2. Agent builds a context from domain knowledge + current state
 *  3. Agent decides which tools to call
 *  4. Tools execute and return structured data
 *  5. Agent formats the response
 *
 *  The AI model call is optional — the agent can operate in "direct"
 *  mode (tool execution only) or "reasoning" mode (AI model decides).
 * ────────────────────────────────────────────────────────────────────── */

import { RESEARCH_DOMAIN } from "./domain";
import { AGENT_TOOLS, getToolByName } from "./tools";

// ── Types ───────────────────────────────────────────────────────────

export interface AgentRequest {
  /** What the agent should do */
  action: AgentAction;
  /** Optional parameters for the action */
  params?: Record<string, unknown>;
  /** Who is asking (for agent-to-agent contracts) */
  caller?: {
    system: string;  // e.g. "soscommand", "sostravel", "user"
    context?: string; // why they're asking
  };
}

export type AgentAction =
  | "research_status"        // Full research snapshot
  | "identify_gaps"          // Find what's missing
  | "compute_metrics"        // TTTA/TTGP/TTDC for cases
  | "categorize"             // Auto-categorize text content
  | "corridor_analysis"      // Coverage across corridors
  | "weekly_digest"          // Activity summary
  | "suggest_next_actions"   // What should the researcher do next
  | "answer_query"           // Free-form question about the research
  | "create_task"            // Create a task from insight
  | "create_note";           // Create a note from insight

export interface AgentResponse {
  success: boolean;
  action: AgentAction;
  data: unknown;
  /** Human-readable summary the UI can display directly */
  summary?: string;
  /** Suggested follow-up actions */
  followUp?: Array<{ action: AgentAction; label: string; params?: Record<string, unknown> }>;
  /** Metadata for agent-to-agent contracts */
  meta?: {
    toolsUsed: string[];
    executionMs: number;
    domain: string;
  };
}

// ── Action → Tool mapping ───────────────────────────────────────────

const ACTION_TOOL_MAP: Record<AgentAction, string[]> = {
  research_status: ["get_research_status"],
  identify_gaps: ["identify_research_gaps"],
  compute_metrics: ["compute_case_metrics"],
  categorize: ["categorize_text"],
  corridor_analysis: ["analyze_corridor_coverage"],
  weekly_digest: ["generate_weekly_digest"],
  suggest_next_actions: ["get_research_status", "identify_research_gaps"],
  answer_query: ["get_research_status"],
  create_task: ["create_task"],
  create_note: ["create_note"],
};

// ── Agent Execution ─────────────────────────────────────────────────

/**
 * Execute an agent request in "direct" mode (no AI model needed).
 * Tools are selected by action type and executed immediately.
 */
export async function executeAgent(request: AgentRequest): Promise<AgentResponse> {
  const start = Date.now();
  const toolNames = ACTION_TOOL_MAP[request.action] ?? [];
  const toolsUsed: string[] = [];

  // Execute all tools for this action
  const results: Record<string, unknown> = {};
  for (const toolName of toolNames) {
    const tool = getToolByName(toolName);
    if (tool) {
      results[toolName] = await tool.execute(request.params ?? {});
      toolsUsed.push(toolName);
    }
  }

  // Build response based on action type
  const response: AgentResponse = {
    success: true,
    action: request.action,
    data: toolNames.length === 1 ? results[toolNames[0]] : results,
    meta: {
      toolsUsed,
      executionMs: Date.now() - start,
      domain: "tourist-medical-emergency-research",
    },
  };

  // Add summaries and follow-ups based on action
  switch (request.action) {
    case "research_status": {
      const status = results.get_research_status as Record<string, Record<string, number>>;
      if (status) {
        response.summary = `Research status: ${status.fieldwork?.journalEntries ?? 0} journal entries, ${status.fieldwork?.contacts ?? 0} contacts, ${status.cases?.total ?? 0} cases tracked, ${status.tasks?.open ?? 0} open tasks.`;
        response.followUp = [
          { action: "identify_gaps", label: "Find research gaps" },
          { action: "weekly_digest", label: "Generate weekly digest" },
          { action: "corridor_analysis", label: "Check corridor coverage" },
        ];
      }
      break;
    }

    case "identify_gaps": {
      const gaps = results.identify_research_gaps as { totalGaps: number; gaps: Array<{ severity: string }> };
      if (gaps) {
        const highCount = gaps.gaps?.filter((g) => g.severity === "high").length ?? 0;
        response.summary = `Found ${gaps.totalGaps} research gaps (${highCount} high priority).`;
        response.followUp = [
          { action: "suggest_next_actions", label: "Get prioritized next steps" },
        ];
      }
      break;
    }

    case "suggest_next_actions": {
      const status = results.get_research_status as Record<string, unknown>;
      const gaps = results.identify_research_gaps as { gaps: Array<{ severity: string; suggestion: string; area: string }> };
      if (gaps?.gaps) {
        // Top 5 actions from high-priority gaps
        const topActions = gaps.gaps.slice(0, 5).map((g) => ({
          area: g.area,
          action: g.suggestion,
          severity: g.severity,
        }));
        response.data = { status, topActions };
        response.summary = `Top ${topActions.length} suggested actions based on current gaps.`;
      }
      break;
    }

    case "compute_metrics": {
      const metrics = results.compute_case_metrics as { summary?: { totalCases: number; ttdc?: { mean: number } } };
      if (metrics?.summary) {
        const s = metrics.summary;
        response.summary = `Analyzed ${s.totalCases} cases. ${s.ttdc ? `Mean TTDC: ${s.ttdc.mean} min.` : "No TTDC data yet."}`;
      }
      break;
    }

    case "categorize": {
      const cat = results.categorize_text as { suggestedType: string; suggestedTags: string[] };
      if (cat) {
        response.summary = `Suggested type: ${cat.suggestedType}. Tags: ${cat.suggestedTags.join(", ") || "none detected"}.`;
      }
      break;
    }

    case "corridor_analysis": {
      const corridors = results.analyze_corridor_coverage as Array<{ name: string; coverage: { hasData: boolean } }>;
      if (Array.isArray(corridors)) {
        const covered = corridors.filter((c) => c.coverage.hasData).length;
        response.summary = `${covered}/${corridors.length} corridors have field data.`;
        response.followUp = [
          { action: "identify_gaps", label: "See detailed gaps" },
        ];
      }
      break;
    }

    case "weekly_digest": {
      const digest = results.generate_weekly_digest as { activity?: { newJournalEntries: number; tasksCompleted: number; tasksOpen: number } };
      if (digest?.activity) {
        const a = digest.activity;
        response.summary = `This week: ${a.newJournalEntries} new entries, ${a.tasksCompleted} tasks completed, ${a.tasksOpen} still open.`;
      }
      break;
    }
  }

  return response;
}

// ── Agent Capabilities (for discovery by other agents) ──────────────

export function getAgentCapabilities() {
  return {
    agent: "sosphd-research-agent",
    version: "0.1",
    domain: "tourist-medical-emergency-research",
    thesis: RESEARCH_DOMAIN.thesis.claim,
    actions: Object.keys(ACTION_TOOL_MAP) as AgentAction[],
    tools: AGENT_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    })),
    corridors: RESEARCH_DOMAIN.corridors.map((c) => c.name),
    metrics: Object.keys(RESEARCH_DOMAIN.metrics),
    contractProtocol: {
      endpoint: "/api/agent",
      method: "POST",
      auth: "supabase-jwt",
      requestFormat: {
        action: "AgentAction",
        params: "Record<string, unknown>",
        caller: "{ system: string, context?: string }",
      },
    },
  };
}
