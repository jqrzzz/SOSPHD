/* ─── Fieldwork: journal entries + contacts ────────────────────────────
 *  research.journal_entries / research.contacts — the field-capture path
 *  ("met Dr. X, add to contacts, journal what we discussed"). Journal
 *  writes carry the consent gate from migration 011; the tool refuses to
 *  guess 'obtained' — that has to be stated explicitly.
 * ────────────────────────────────────────────────────────────────────── */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fail, ok, okJson, sanitizeSearch, withAgentTag } from "../helpers.js";
import { research } from "../supabase.js";

const ENTRY_TYPES = [
  "observation",
  "conversation",
  "interview",
  "site_visit",
  "event",
  "idea",
  "media",
] as const;

const CONTACT_ROLES = [
  "doctor",
  "nurse",
  "hospital_admin",
  "insurance",
  "embassy",
  "transport",
  "government",
  "academic",
  "ngo",
  "fixer",
  "other",
] as const;

const CORRIDOR_HINT =
  "Canonical corridors: 'Koh Samui → Bangkok', 'Phuket → Bangkok', " +
  "'Chiang Mai → Bangkok', 'Pattaya → Bangkok', 'Krabi → Bangkok', 'Bangkok Hub'";

export function registerFieldworkTools(server: McpServer): void {
  server.tool(
    "add_journal_entry",
    "Add a field journal entry (research.journal_entries; visible in /fieldwork). " +
      "consent_status semantics: 'not_required' = self-authored reflection; 'pending' = " +
      "third-party material, consent not yet captured (use this when unsure); 'obtained' = " +
      "consent captured (also pass consent_method + consent_jurisdiction); 'declined' entries " +
      "are excluded from research. Never include PHI.",
    {
      entry_type: z.enum(ENTRY_TYPES),
      title: z.string().min(1),
      content: z.string().min(1).describe("Markdown body"),
      location: z.string().optional().describe("e.g. 'Krabi Nakharin Hospital, Krabi'"),
      corridor: z.string().optional().describe(CORRIDOR_HINT),
      tags: z.array(z.string()).optional(),
      consent_status: z.enum(["not_required", "pending", "obtained", "declined"]),
      consent_method: z
        .enum(["verbal", "written", "recorded_verbal"])
        .optional()
        .describe("Required when consent_status is 'obtained'"),
      consent_jurisdiction: z
        .string()
        .length(2)
        .optional()
        .describe("ISO country code where consent was captured, e.g. 'TH'"),
    },
    async (args) => {
      if (args.consent_status === "obtained" && !args.consent_method) {
        return fail(
          "consent_status 'obtained' requires consent_method (verbal/written/recorded_verbal).",
        );
      }
      const { q, userId } = await research("journal_entries");
      const { data, error } = await q
        .insert({
          user_id: userId,
          entry_type: args.entry_type,
          title: args.title,
          content: args.content,
          location: args.location ?? null,
          corridor: args.corridor ?? null,
          tags: withAgentTag(args.tags),
          consent_status: args.consent_status,
          consent_method: args.consent_method ?? null,
          consent_jurisdiction: args.consent_jurisdiction?.toUpperCase() ?? null,
          consent_captured_at:
            args.consent_status === "obtained" ? new Date().toISOString() : null,
        })
        .select("id")
        .single();
      if (error) return fail(`add_journal_entry failed: ${error.message}`);
      return ok(`Journal entry saved (id ${(data as { id: string }).id}).`);
    },
  );

  server.tool(
    "list_recent_journal",
    "List recent field journal entries (newest first).",
    { limit: z.number().int().min(1).max(50).optional().describe("Default 10") },
    async ({ limit }) => {
      const { q } = await research("journal_entries");
      const { data, error } = await q
        .select("id, created_at, entry_type, title, corridor, tags, consent_status")
        .order("created_at", { ascending: false })
        .limit(limit ?? 10);
      if (error) return fail(`list_recent_journal failed: ${error.message}`);
      return okJson({ entries: data });
    },
  );

  server.tool(
    "add_contact",
    "Add a person to the research network CRM (research.contacts; visible in /contacts). " +
      "These are research/professional contacts (doctors, fixers, academics) — never patients.",
    {
      name: z.string().min(1),
      role: z.enum(CONTACT_ROLES).optional().describe("Default 'other'"),
      organization: z.string().optional(),
      title: z.string().optional().describe("Job title, e.g. 'Head of ED'"),
      email: z.string().optional(),
      phone: z.string().optional(),
      location: z.string().optional().describe("City / country"),
      corridor: z.string().optional().describe(CORRIDOR_HINT),
      notes: z.string().optional(),
      tags: z.array(z.string()).optional(),
    },
    async (args) => {
      const { q, userId } = await research("contacts");
      const { data, error } = await q
        .insert({
          user_id: userId,
          name: args.name,
          role: args.role ?? "other",
          organization: args.organization ?? null,
          title: args.title ?? null,
          email: args.email ?? null,
          phone: args.phone ?? null,
          location: args.location ?? null,
          corridor: args.corridor ?? null,
          notes: args.notes ?? "",
          tags: withAgentTag(args.tags),
        })
        .select("id")
        .single();
      if (error) return fail(`add_contact failed: ${error.message}`);
      return ok(`Contact saved: ${args.name} (id ${(data as { id: string }).id}).`);
    },
  );

  server.tool(
    "search_contacts",
    "Search the research network by name or organization.",
    {
      query: z.string().min(1),
      limit: z.number().int().min(1).max(50).optional().describe("Default 10"),
    },
    async ({ query, limit }) => {
      const clean = sanitizeSearch(query);
      if (!clean) return fail("Search query is empty after sanitization.");
      const { q } = await research("contacts");
      const { data, error } = await q
        .select("id, name, role, organization, title, email, phone, location, corridor, tags")
        .or(`name.ilike.%${clean}%,organization.ilike.%${clean}%`)
        .order("updated_at", { ascending: false })
        .limit(limit ?? 10);
      if (error) return fail(`search_contacts failed: ${error.message}`);
      return okJson({ matches: (data as unknown[]).length, contacts: data });
    },
  );
}
