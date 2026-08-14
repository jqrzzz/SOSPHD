/* ─── Research docs ────────────────────────────────────────────────────
 *  research.docs / research.doc_versions. Append-only from agents: the
 *  tool grows content_md and snapshots a version, mirroring the app's
 *  save semantics (doc_versions rows hold the full content at save time).
 *  Destructive rewrites stay a human action in /docs.
 * ────────────────────────────────────────────────────────────────────── */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fail, ok, okJson, sanitizeSearch, snippetAround } from "../helpers.js";
import { research } from "../supabase.js";

export function registerDocTools(server: McpServer): void {
  server.tool(
    "search_docs",
    "Search research documents (papers, field logs, methods) by title or content.",
    {
      query: z.string().min(1),
      limit: z.number().int().min(1).max(25).optional().describe("Default 8"),
    },
    async ({ query, limit }) => {
      const clean = sanitizeSearch(query);
      if (!clean) return fail("Search query is empty after sanitization.");
      const { q } = await research("docs");
      const { data, error } = await q
        .select("id, title, folder, status, updated_at, content_md")
        .or(`title.ilike.%${clean}%,content_md.ilike.%${clean}%`)
        .order("updated_at", { ascending: false })
        .limit(limit ?? 8);
      if (error) return fail(`search_docs failed: ${error.message}`);
      const rows = (data as {
        id: string;
        title: string;
        folder: string;
        status: string;
        updated_at: string;
        content_md: string;
      }[]).map((d) => ({
        id: d.id,
        title: d.title,
        folder: d.folder,
        status: d.status,
        updated_at: d.updated_at,
        snippet: snippetAround(d.content_md, clean),
      }));
      return okJson({ matches: rows.length, docs: rows });
    },
  );

  server.tool(
    "list_doc_annotations",
    "List the owner's margin notes on a research document (open ones by default) — " +
      "read these before revising a draft; each open note is a review comment to address " +
      "in the next version. Resolving notes stays a human action in the app.",
    {
      doc_id: z.string().uuid().describe("From search_docs"),
      include_resolved: z.boolean().optional().describe("Default false"),
    },
    async ({ doc_id, include_resolved }) => {
      const { q } = await research("doc_annotations");
      let query = q
        .select("id, created_at, quote, comment, resolved")
        .eq("doc_id", doc_id)
        .order("created_at", { ascending: true });
      if (!include_resolved) query = query.eq("resolved", false);
      const { data, error } = await query;
      if (error) return fail(`list_doc_annotations failed: ${error.message}`);
      const rows = data as unknown[];
      return okJson({ count: rows.length, annotations: rows });
    },
  );

  server.tool(
    "append_to_doc",
    "Append markdown to the end of a research document and snapshot a version. " +
      "Never overwrites existing content — rewriting stays a human action in /docs.",
    {
      doc_id: z.string().uuid().describe("From search_docs"),
      content_md: z.string().min(1).describe("Markdown to append"),
      version_note: z.string().optional().describe("Shown in the doc's version history"),
    },
    async ({ doc_id, content_md, version_note }) => {
      const { q, userId } = await research("docs");
      const { data, error } = await q
        .select("id, title, content_md")
        .eq("id", doc_id)
        .single();
      if (error) return fail(`Doc ${doc_id} not found: ${error.message}`);
      const doc = data as { id: string; title: string; content_md: string };

      const next = doc.content_md.trim()
        ? `${doc.content_md.replace(/\s+$/, "")}\n\n${content_md}`
        : content_md;

      const { q: updateQ } = await research("docs");
      const { error: updateError } = await updateQ
        .update({ content_md: next, updated_at: new Date().toISOString() })
        .eq("id", doc_id);
      if (updateError) return fail(`append_to_doc failed: ${updateError.message}`);

      const { q: versionQ } = await research("doc_versions");
      const { error: versionError } = await versionQ.insert({
        doc_id,
        user_id: userId,
        content_md: next,
        note: version_note ?? "Appended via MCP",
      });
      if (versionError) {
        return ok(
          `Appended ${content_md.length} chars to "${doc.title}" — but the version ` +
            `snapshot failed (${versionError.message}). Content is saved; save once ` +
            `in /docs to create the version manually.`,
        );
      }
      return ok(`Appended ${content_md.length} chars to "${doc.title}" (version snapshotted).`);
    },
  );
}
