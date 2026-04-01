/* ─── PhD Agent — Public API ──────────────────────────────────────────
 *  Clean exports for the rest of the app.
 * ────────────────────────────────────────────────────────────────────── */

// Domain knowledge
export { RESEARCH_DOMAIN } from "./domain";
export type { MetricKey, CorridorId, PaperStatus } from "./domain";

// Agent core
export { executeAgent, getAgentCapabilities } from "./core";
export type { AgentRequest, AgentResponse, AgentAction } from "./core";

// Tools
export { AGENT_TOOLS, getToolByName } from "./tools";
export type { ToolDefinition } from "./tools";

// Workflows (the most commonly used exports)
export {
  autoCategorize,
  detectGaps,
  getResearchPulse,
  suggestNextActions,
  getCorridorBriefing,
  handleAgentContract,
} from "./workflows";
