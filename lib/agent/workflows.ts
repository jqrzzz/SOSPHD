/* ─── Agent Workflows ─────────────────────────────────────────────────
 *  Automated behaviors the agent performs without being asked.
 *  These can be triggered by:
 *  - Page loads (e.g., dashboard refreshes gap analysis)
 *  - Data writes (e.g., new journal entry → auto-categorize)
 *  - Scheduled intervals (e.g., weekly digest)
 *  - External events (e.g., new case from SOSCOMMAND)
 *
 *  Each workflow is a thin wrapper around agent tools.
 * ────────────────────────────────────────────────────────────────────── */

import { executeAgent } from "./core";
import { getToolByName } from "./tools";

// ── Auto-Categorize ─────────────────────────────────────────────────

/**
 * Auto-categorize content and return suggestions.
 * Called when a user creates a new journal entry or note.
 */
export async function autoCategorize(text: string) {
  const tool = getToolByName("categorize_text");
  if (!tool) return null;

  const result = await tool.execute({ text });
  return result as {
    suggestedType: string;
    suggestedTags: string[];
    suggestedCorridor: string | null;
    detectedMetrics: string[];
    detectedContacts: string[];
  };
}

// ── Gap Detection ───────────────────────────────────────────────────

/**
 * Run gap analysis and return actionable items.
 * Called on dashboard load or on-demand.
 */
export async function detectGaps() {
  const response = await executeAgent({ action: "identify_gaps" });
  return response.data as {
    totalGaps: number;
    byArea: Record<string, number>;
    gaps: Array<{
      area: string;
      gap: string;
      severity: "high" | "medium" | "low";
      suggestion: string;
    }>;
  };
}

// ── Research Pulse ──────────────────────────────────────────────────

/**
 * Quick health check of the research.
 * Returns a simple "pulse" that the dashboard can display.
 */
export async function getResearchPulse() {
  const [statusResponse, gapsResponse] = await Promise.all([
    executeAgent({ action: "research_status" }),
    executeAgent({ action: "identify_gaps" }),
  ]);

  const status = statusResponse.data as Record<string, Record<string, number>>;
  const gaps = gapsResponse.data as { totalGaps: number; gaps: Array<{ severity: string }> };

  const highGaps = gaps?.gaps?.filter((g) => g.severity === "high").length ?? 0;
  const coverage = status?.fieldwork?.corridorsCovered ?? 0;
  const total = status?.fieldwork?.corridorsTotal ?? 6;

  // Compute a simple health score (0-100)
  let score = 50; // base
  score += Math.min(20, (status?.fieldwork?.journalEntries ?? 0) * 2); // up to 20 for entries
  score += Math.min(15, (coverage / total) * 15); // up to 15 for corridor coverage
  score += Math.min(15, (status?.fieldwork?.contacts ?? 0) * 3); // up to 15 for contacts
  score -= highGaps * 5; // penalty for high-priority gaps
  score = Math.max(0, Math.min(100, Math.round(score)));

  let healthLabel: "strong" | "good" | "needs-attention" | "at-risk";
  if (score >= 80) healthLabel = "strong";
  else if (score >= 60) healthLabel = "good";
  else if (score >= 40) healthLabel = "needs-attention";
  else healthLabel = "at-risk";

  return {
    score,
    health: healthLabel,
    corridorCoverage: `${coverage}/${total}`,
    highPriorityGaps: highGaps,
    totalGaps: gaps?.totalGaps ?? 0,
    openTasks: status?.tasks?.open ?? 0,
    summary: statusResponse.summary ?? "",
  };
}

// ── Suggest Next Actions ────────────────────────────────────────────

/**
 * Get the top N actions the researcher should take next.
 * Combines gap analysis with task priority.
 */
export async function suggestNextActions(limit = 5) {
  const response = await executeAgent({ action: "suggest_next_actions" });
  const data = response.data as { topActions?: Array<{ area: string; action: string; severity: string }> };
  return (data?.topActions ?? []).slice(0, limit);
}

// ── Corridor Briefing ───────────────────────────────────────────────

/**
 * Get a briefing for a specific corridor before a field visit.
 * Combines domain knowledge with collected data.
 */
export async function getCorridorBriefing(corridorName: string) {
  const response = await executeAgent({ action: "corridor_analysis" });
  const corridors = response.data as Array<{
    id: string;
    name: string;
    characteristics: string[];
    knownBottlenecks: string[];
    coverage: { journalEntries: number; siteVisits: number; contacts: number; hasData: boolean };
  }>;

  const corridor = corridors?.find(
    (c) => c.name.toLowerCase() === corridorName.toLowerCase()
  );

  if (!corridor) return null;

  return {
    ...corridor,
    recommendations: [
      ...(corridor.coverage.siteVisits === 0
        ? ["No site visits recorded — use the Clinic/Hospital Site Visit protocol"]
        : []),
      ...(corridor.coverage.contacts === 0
        ? ["No local contacts — prioritize building relationships in this corridor"]
        : []),
      ...(corridor.coverage.journalEntries < 3
        ? ["Limited field data — schedule additional observation sessions"]
        : []),
    ],
  };
}

// ── Contract Handler (for other SOS agents) ─────────────────────────

/**
 * Handle an incoming contract from another SOS ecosystem agent.
 * This is the entry point for agent-to-agent communication.
 *
 * Example contract from SOSCOMMAND:
 * {
 *   action: "compute_metrics",
 *   params: { case_id: "case_123" },
 *   caller: { system: "soscommand", context: "Dashboard metric display" }
 * }
 */
export async function handleAgentContract(request: {
  action: string;
  params?: Record<string, unknown>;
  caller: { system: string; context?: string };
}) {
  // Validate the caller is from the SOS ecosystem
  const validCallers = ["soswebsite", "soscommand", "sostravel", "sospro", "sossafe", "user"];
  if (!validCallers.includes(request.caller.system)) {
    return {
      success: false,
      error: `Unknown caller system: ${request.caller.system}`,
      validCallers,
    };
  }

  // Execute the agent action
  return executeAgent({
    action: request.action as Parameters<typeof executeAgent>[0]["action"],
    params: request.params,
    caller: request.caller,
  });
}
