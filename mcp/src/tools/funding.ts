/* ─── Funding tools ────────────────────────────────────────────────────
 *  Grants, fellowships, government schemes, foundations, major donors.
 *
 *  eligibility_category is the field that matters most and the one most
 *  easily got wrong. The owner is PRE-PhD with no academic affiliation,
 *  so an opportunity requiring a host institution is not "available" —
 *  it is future work. Classify honestly:
 *    a_open_now          — independent/early-career applicants accepted today
 *    c_company_eligible  — Tourist SOS can apply as an organisation
 *    b_needs_affiliation — only after a PhD place is confirmed
 *
 *  Same provenance rule as admissions: source_url always; verified only
 *  after reading the funder's own page for the current round.
 * ────────────────────────────────────────────────────────────────────── */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fail, ok, okJson } from "../helpers.js";
import { research } from "../supabase.js";

const KINDS = [
  "grant",
  "fellowship",
  "scholarship",
  "government",
  "foundation",
  "prize",
  "donor",
  "industry",
] as const;

const CATEGORIES = ["a_open_now", "c_company_eligible", "b_needs_affiliation"] as const;

const STAGES = [
  "identified",
  "assessing",
  "preparing",
  "submitted",
  "awarded",
  "declined",
  "not_eligible",
  "passed",
] as const;

export function registerFundingTools(server: McpServer): void {
  server.tool(
    "list_funding",
    "List funding opportunities. Filter by eligibility to see only what can actually be " +
      "applied for today (a_open_now = open to the owner personally, c_company_eligible = " +
      "Tourist SOS can apply, b_needs_affiliation = waits on a PhD place).",
    {
      eligibility: z.enum(CATEGORIES).optional(),
      stage: z.enum(STAGES).optional(),
    },
    async ({ eligibility, stage }) => {
      const { q } = await research("funding_opportunities");
      let query = q
        .select(
          "id, name, funder, kind, geography, amount_note, deadline_note, next_deadline, eligibility_category, stage, fit_score, confidence, verified_at, source_url",
        )
        .order("fit_score", { ascending: false, nullsFirst: false })
        .limit(100);
      if (eligibility) query = query.eq("eligibility_category", eligibility);
      if (stage) query = query.eq("stage", stage);
      const { data, error } = await query;
      if (error) return fail(`list_funding failed: ${error.message}`);
      return okJson({ opportunities: data });
    },
  );

  server.tool(
    "add_funding_opportunity",
    "Record a funding opportunity found during research. Requires source_url. Be honest " +
      "about eligibility — misclassifying a grant that needs university affiliation as " +
      "'open now' wastes the owner's time on an application that will be rejected unread.",
    {
      name: z.string().min(1),
      funder: z.string().min(1),
      kind: z.enum(KINDS),
      eligibility_category: z.enum(CATEGORIES),
      eligibility_note: z.string().describe("Exactly who may apply, in the funder's terms"),
      relevance: z.string().describe("Why it fits THIS research specifically, not generically"),
      geography: z.string().optional(),
      amount_note: z.string().optional(),
      deadline_note: z.string().optional(),
      next_deadline: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      fit_score: z.number().int().min(1).max(5).optional(),
      confidence: z.enum(["high", "medium", "low"]).optional(),
      caveats: z.string().optional().describe("What could not be confirmed"),
      source_url: z.string().describe("The funder's own page — required"),
      verified: z
        .boolean()
        .optional()
        .describe("Only true if the funder's page was read for the current round"),
    },
    async (args) => {
      const { q, userId } = await research("funding_opportunities");
      const { error } = await q
        .insert({
          user_id: userId,
          name: args.name,
          funder: args.funder,
          kind: args.kind,
          geography: args.geography ?? null,
          amount_note: args.amount_note ?? null,
          deadline_note: args.deadline_note ?? null,
          next_deadline: args.next_deadline ?? null,
          eligibility_note: args.eligibility_note,
          eligibility_category: args.eligibility_category,
          relevance: args.relevance,
          fit_score: args.fit_score ?? null,
          confidence: args.confidence ?? "medium",
          caveats: args.caveats ?? null,
          source_url: args.source_url,
          verified_at: args.verified ? new Date().toISOString() : null,
        });
      if (error) return fail(`add_funding_opportunity failed: ${error.message}`);
      return ok(
        `Recorded ${args.name} (${args.funder}) as ${args.eligibility_category}` +
          (args.verified ? ", verified." : ", UNVERIFIED."),
      );
    },
  );

  server.tool(
    "update_funding_stage",
    "Move a funding opportunity along its pipeline.",
    {
      opportunity_id: z.string().uuid(),
      stage: z.enum(STAGES),
      note: z.string().optional().describe("Appended to the opportunity's notes"),
    },
    async ({ opportunity_id, stage, note }) => {
      const { q } = await research("funding_opportunities");
      const patch: Record<string, unknown> = {
        stage,
        updated_at: new Date().toISOString(),
      };
      if (note) {
        const { q: readQ } = await research("funding_opportunities");
        const { data: current } = await readQ
          .select("notes")
          .eq("id", opportunity_id)
          .maybeSingle();
        const existing = (current as { notes?: string } | null)?.notes ?? "";
        patch.notes = existing ? `${existing}\n\n${note}` : note;
      }
      const { error } = await q.update(patch).eq("id", opportunity_id);
      if (error) return fail(`update_funding_stage failed: ${error.message}`);
      return ok(`Stage set to ${stage}.`);
    },
  );

  server.tool(
    "draft_funder_outreach",
    "Save a DRAFT approach to a programme officer, foundation contact, or major donor. " +
      "Never sent by an agent — the owner reviews and sends. Lead with the concrete asset " +
      "(an 836-case registry and a measurement result), not with ambition.",
    {
      opportunity_id: z.string().uuid(),
      person_name: z.string().min(1),
      person_role: z.string().optional(),
      subject: z.string().min(1),
      body: z.string().min(1),
      follow_up_at: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    },
    async (args) => {
      const { q, userId } = await research("outreach");
      const { error } = await q.insert({
        user_id: userId,
        opportunity_id: args.opportunity_id,
        person_name: args.person_name,
        person_role: args.person_role ?? null,
        subject: args.subject,
        body: args.body,
        status: "draft",
        follow_up_at: args.follow_up_at ?? null,
      });
      if (error) return fail(`draft_funder_outreach failed: ${error.message}`);
      return ok(
        `Draft saved for ${args.person_name}. Review it in the app before sending — agents do not send.`,
      );
    },
  );
}
