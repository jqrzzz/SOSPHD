#!/usr/bin/env node
/* Smoke test: boots the server over stdio with NO credentials and checks
 * (1) initialize handshake, (2) all 15 tools listed, (3) a tool call fails
 * cleanly with setup instructions instead of crashing the process.
 * Run from mcp/: `pnpm run smoke`. No database access involved.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const mcpDir = dirname(dirname(fileURLToPath(import.meta.url)));

// Strip credential env so the run is deterministic regardless of the shell.
const env = { ...process.env };
for (const k of Object.keys(env)) {
  if (k.startsWith("SOSPHD_") || k.startsWith("NEXT_PUBLIC_SUPABASE")) delete env[k];
}

const child = spawn(join(mcpDir, "node_modules/.bin/tsx"), ["src/index.ts"], {
  cwd: mcpDir,
  env,
  stdio: ["pipe", "pipe", "inherit"],
});

let buffer = "";
const pending = new Map();
child.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  let idx;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

let nextId = 1;
function request(method, params) {
  const id = nextId++;
  const payload = { jsonrpc: "2.0", id, method, params };
  child.stdin.write(JSON.stringify(payload) + "\n");
  return new Promise((resolve, reject) => {
    pending.set(id, resolve);
    setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), 15000);
  });
}
function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

const failures = [];
function check(label, cond) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) failures.push(label);
}

try {
  const init = await request("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "smoke", version: "0.0.0" },
  });
  check("initialize handshake", init.result?.serverInfo?.name === "sosphd");
  notify("notifications/initialized", {});

  const list = await request("tools/list", {});
  const names = (list.result?.tools ?? []).map((t) => t.name).sort();
  check(`tools/list returns 27 tools (got ${names.length})`, names.length === 27);
  const expected = [
    "add_contact", "add_funding_opportunity", "add_institution",
    "add_journal_entry", "add_mind_map_node", "add_requirement", "add_task",
    "append_to_doc", "complete_task", "create_note", "draft_funder_outreach",
    "draft_outreach", "get_baseline_stats", "get_institution",
    "link_mind_map_nodes", "list_doc_annotations", "list_funding",
    "list_institutions", "list_mind_maps", "list_open_tasks", "list_outreach",
    "list_recent_journal", "search_contacts", "search_docs", "search_notes",
    "update_funding_stage", "update_institution_stage",
  ];
  check("tool names match", JSON.stringify(names) === JSON.stringify(expected));

  const call = await request("tools/call", {
    name: "create_note",
    arguments: { content: "smoke test" },
  });
  const text = call.result?.content?.[0]?.text ?? "";
  check("uncredentialed call returns isError (not a crash)", call.result?.isError === true);
  check("error message points at setup", text.includes("mcp/.env.local"));
} catch (err) {
  failures.push(String(err));
  console.error("SMOKE ERROR:", err);
} finally {
  child.kill();
}

console.log(failures.length === 0 ? "\nSMOKE: ALL PASS" : `\nSMOKE: ${failures.length} FAILURE(S)`);
process.exit(failures.length === 0 ? 0 : 1);
