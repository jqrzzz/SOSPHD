/* ─── SOSPHD MCP server ────────────────────────────────────────────────
 *  Personal, single-user, stdio-only. Exposes the owner's research
 *  workspace (notes, journal, tasks, contacts, mind maps, docs, baseline
 *  stats) as typed MCP tools for Claude Code / Cowork / OpenClaw.
 *
 *  Auth: signs in to Supabase as the owner on first tool call — every
 *  query is RLS-scoped; there is no service-role key anywhere. Missing
 *  credentials fail the *tool call* with setup instructions, not the
 *  process, so `tools/list` always works.
 * ────────────────────────────────────────────────────────────────────── */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerBaselineTools } from "./tools/baseline.js";
import { registerCaptureTools } from "./tools/capture.js";
import { registerDocTools } from "./tools/docs.js";
import { registerFieldworkTools } from "./tools/fieldwork.js";
import { registerMindMapTools } from "./tools/mindmaps.js";

const server = new McpServer({ name: "sosphd", version: "0.1.0" });

registerCaptureTools(server); // create_note, search_notes, add_task, list_open_tasks, complete_task
registerFieldworkTools(server); // add_journal_entry, list_recent_journal, add_contact, search_contacts
registerMindMapTools(server); // list_mind_maps, add_mind_map_node, link_mind_map_nodes
registerDocTools(server); // search_docs, list_doc_annotations, append_to_doc
registerBaselineTools(server); // get_baseline_stats

await server.connect(new StdioServerTransport());
// stdout is the protocol channel — human-facing logs go to stderr.
console.error("[sosphd-mcp] ready — 16 tools registered");
