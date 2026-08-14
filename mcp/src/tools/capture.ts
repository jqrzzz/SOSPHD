/* ─── Quick capture: notes + tasks ─────────────────────────────────────
 *  research.notes / research.tasks — the highest-frequency agent writes
 *  ("note this down", "remind me to…"). Everything lands tagged 'agent'
 *  and appears in /workspace on next load.
 * ────────────────────────────────────────────────────────────────────── */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  fail,
  ok,
  okJson,
  sanitizeSearch,
  snippetAround,
  withAgentTag,
} from "../helpers.js";
import { research } from "../supabase.js";

export function registerCaptureTools(server: McpServer): void {
  server.tool(
    "create_note",
    "Save a quick research note into SOSPHD (research.notes; visible in /workspace). " +
      "Tagged 'agent' automatically. Never include PHI — no patient names, DOB, or passport numbers.",
    {
      content: z.string().min(1).describe("Note body (markdown is fine)"),
      title: z.string().optional(),
      tags: z.array(z.string()).optional(),
    },
    async ({ content, title, tags }) => {
      const { q, userId } = await research("notes");
      const { data, error } = await q
        .insert({
          user_id: userId,
          title: title ?? null,
          content,
          tags: withAgentTag(tags),
        })
        .select("id")
        .single();
      if (error) return fail(`create_note failed: ${error.message}`);
      return ok(`Note saved (id ${(data as { id: string }).id}).`);
    },
  );

  server.tool(
    "search_notes",
    "Search research notes by title/content (case-insensitive substring).",
    {
      query: z.string().min(1),
      limit: z.number().int().min(1).max(50).optional().describe("Default 10"),
    },
    async ({ query, limit }) => {
      const clean = sanitizeSearch(query);
      if (!clean) return fail("Search query is empty after sanitization.");
      const { q } = await research("notes");
      const { data, error } = await q
        .select("id, created_at, title, content, tags")
        .or(`title.ilike.%${clean}%,content.ilike.%${clean}%`)
        .order("created_at", { ascending: false })
        .limit(limit ?? 10);
      if (error) return fail(`search_notes failed: ${error.message}`);
      const rows = (data as {
        id: string;
        created_at: string;
        title: string | null;
        content: string;
        tags: string[];
      }[]).map((r) => ({
        id: r.id,
        created_at: r.created_at,
        title: r.title,
        tags: r.tags,
        snippet: snippetAround(r.content, clean),
      }));
      return okJson({ matches: rows.length, notes: rows });
    },
  );

  server.tool(
    "add_task",
    "Add a research task (research.tasks; visible in /workspace). Status starts at 'todo'.",
    {
      title: z.string().min(1),
      description: z.string().optional(),
      priority: z
        .number()
        .int()
        .min(1)
        .max(3)
        .optional()
        .describe("1 = highest, 3 = lowest; default 2"),
      due_date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe("YYYY-MM-DD"),
    },
    async ({ title, description, priority, due_date }) => {
      const { q, userId } = await research("tasks");
      const { data, error } = await q
        .insert({
          user_id: userId,
          title,
          description: description ?? null,
          priority: priority ?? 2,
          due_date: due_date ?? null,
        })
        .select("id")
        .single();
      if (error) return fail(`add_task failed: ${error.message}`);
      return ok(`Task added (id ${(data as { id: string }).id}).`);
    },
  );

  server.tool(
    "list_open_tasks",
    "List open research tasks (status todo/doing), highest priority first.",
    {},
    async () => {
      const { q } = await research("tasks");
      const { data, error } = await q
        .select("id, title, status, priority, due_date, created_at")
        .in("status", ["todo", "doing"])
        .order("priority", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return fail(`list_open_tasks failed: ${error.message}`);
      return okJson({ open_tasks: data });
    },
  );

  server.tool(
    "complete_task",
    "Mark a research task done by id (get ids from list_open_tasks).",
    { task_id: z.string().uuid() },
    async ({ task_id }) => {
      const { q } = await research("tasks");
      const { data, error } = await q
        .update({ status: "done" })
        .eq("id", task_id)
        .select("id, title")
        .single();
      if (error) {
        return fail(
          `complete_task failed (id not found or not yours): ${error.message}`,
        );
      }
      return ok(`Task done: "${(data as { title: string }).title}".`);
    },
  );
}
