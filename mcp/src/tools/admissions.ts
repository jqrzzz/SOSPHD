/* ─── Admissions tools ─────────────────────────────────────────────────
 *  The application track: institutions, their requirements, and
 *  supervisor outreach. Agents research programmes and log findings;
 *  the owner decides and sends.
 *
 *  Provenance rule (AGENTS.md): never write a deadline or requirement
 *  without source_url. verified_at is set ONLY when the agent has read
 *  the official page for the CURRENT cycle — a pattern inferred from a
 *  previous year stays unverified, because a wrong deadline costs a
 *  whole application cycle.
 *
 *  Outreach is written as DRAFTS only. Sending a first email to a
 *  prospective supervisor is a one-shot impression and stays a human
 *  action.
 * ────────────────────────────────────────────────────────────────────── */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fail, ok, okJson } from "../helpers.js";
import { research } from "../supabase.js";

const STAGES = [
  "researching",
  "shortlisted",
  "contacting",
  "preparing",
  "submitted",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
] as const;

const KINDS = ["deadline", "test", "document", "reference", "process", "fee"] as const;

export function registerAdmissionsTools(server: McpServer): void {
  server.tool(
    "list_institutions",
    "List the PhD programmes under consideration with their stage, formats, next deadline, " +
      "and whether the deadline has been verified against the official page.",
    {},
    async () => {
      const { q } = await research("institutions");
      const { data, error } = await q
        .select(
          "id, name, school, programme, country, formats, stage, fit_score, supervisor_required, next_deadline, next_deadline_label, verified_at, source_url",
        )
        .order("next_deadline", { ascending: true, nullsFirst: false })
        .limit(50);
      if (error) return fail(`list_institutions failed: ${error.message}`);
      return okJson({ institutions: data });
    },
  );

  server.tool(
    "get_institution",
    "Full detail for one programme including every recorded requirement and its source.",
    { institution_id: z.string().uuid().describe("From list_institutions") },
    async ({ institution_id }) => {
      const { q } = await research("institutions");
      const { data: inst, error } = await q
        .select("*")
        .eq("id", institution_id)
        .maybeSingle();
      if (error) return fail(`get_institution failed: ${error.message}`);
      if (!inst) return fail(`No institution with id ${institution_id}`);

      const { q: reqQ } = await research("institution_requirements");
      const { data: reqs } = await reqQ
        .select("id, kind, label, detail, due_date, mandatory, status, source_url, verified_at")
        .eq("institution_id", institution_id)
        .order("due_date", { ascending: true, nullsFirst: false });

      return okJson({ institution: inst, requirements: reqs ?? [] });
    },
  );

  server.tool(
    "add_institution",
    "Add a PhD programme to the application pipeline. Provide source_url. Set verified " +
      "only if you read the official page for the CURRENT admissions cycle — an inferred " +
      "date must stay unverified.",
    {
      name: z.string().min(1).describe("University name"),
      programme: z.string().min(1).describe("e.g. 'PhD, Health Policy'"),
      country: z.string().min(1),
      school: z.string().optional().describe("Faculty or school within the university"),
      city: z.string().optional(),
      formats: z
        .array(z.enum(["full_time", "part_time", "by_publication", "external"]))
        .optional(),
      supervisor_required: z
        .boolean()
        .optional()
        .describe("True when a supervisor must agree BEFORE the application is filed"),
      fit_score: z.number().int().min(1).max(5).optional(),
      fit_rationale: z.string().optional().describe("Honest assessment, including drawbacks"),
      next_deadline: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      next_deadline_label: z.string().optional(),
      homepage_url: z.string().optional(),
      source_url: z.string().describe("Official page the facts came from — required"),
      verified: z
        .boolean()
        .optional()
        .describe("Only true if the official page was read for the current cycle"),
      notes: z.string().optional(),
    },
    async (args) => {
      const { q, userId } = await research("institutions");
      const { data, error } = await q
        .insert({
          user_id: userId,
          name: args.name,
          school: args.school ?? null,
          programme: args.programme,
          country: args.country,
          city: args.city ?? null,
          formats: args.formats ?? [],
          supervisor_required: args.supervisor_required ?? false,
          fit_score: args.fit_score ?? null,
          fit_rationale: args.fit_rationale ?? null,
          next_deadline: args.next_deadline ?? null,
          next_deadline_label: args.next_deadline_label ?? null,
          homepage_url: args.homepage_url ?? null,
          source_url: args.source_url,
          verified_at: args.verified ? new Date().toISOString() : null,
          notes: args.notes ?? "",
        })
        .select("id")
        .single();
      if (error) return fail(`add_institution failed: ${error.message}`);
      return ok(
        `Added ${args.name} — ${args.programme} (id ${(data as { id: string }).id})` +
          (args.verified ? ", verified." : ", marked UNVERIFIED."),
      );
    },
  );

  server.tool(
    "add_requirement",
    "Record one admission requirement or deadline for a programme. source_url is required; " +
      "leave verified false unless the official page was read for the current cycle.",
    {
      institution_id: z.string().uuid(),
      kind: z.enum(KINDS),
      label: z.string().min(1),
      detail: z.string().optional(),
      due_date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      mandatory: z.boolean().optional().describe("Default true"),
      source_url: z.string(),
      verified: z.boolean().optional(),
    },
    async (args) => {
      const { q, userId } = await research("institution_requirements");
      const { error } = await q.insert({
        user_id: userId,
        institution_id: args.institution_id,
        kind: args.kind,
        label: args.label,
        detail: args.detail ?? null,
        due_date: args.due_date ?? null,
        mandatory: args.mandatory ?? true,
        source_url: args.source_url,
        verified_at: args.verified ? new Date().toISOString() : null,
      });
      if (error) return fail(`add_requirement failed: ${error.message}`);
      return ok(`Recorded "${args.label}".`);
    },
  );

  server.tool(
    "update_institution_stage",
    "Move a programme along the pipeline (researching → shortlisted → contacting → " +
      "preparing → submitted → interview → offer / rejected / withdrawn).",
    {
      institution_id: z.string().uuid(),
      stage: z.enum(STAGES),
      note: z.string().optional().describe("Appended to the programme's notes"),
    },
    async ({ institution_id, stage, note }) => {
      const { q } = await research("institutions");
      const patch: Record<string, unknown> = {
        stage,
        updated_at: new Date().toISOString(),
      };
      if (note) {
        const { q: readQ } = await research("institutions");
        const { data: current } = await readQ
          .select("notes")
          .eq("id", institution_id)
          .maybeSingle();
        const existing = (current as { notes?: string } | null)?.notes ?? "";
        patch.notes = existing ? `${existing}\n\n${note}` : note;
      }
      const { error } = await q.update(patch).eq("id", institution_id);
      if (error) return fail(`update_institution_stage failed: ${error.message}`);
      return ok(`Stage set to ${stage}.`);
    },
  );

  server.tool(
    "draft_outreach",
    "Save a DRAFT email to a prospective supervisor. Drafts are never sent by an agent — " +
      "the owner reviews and sends. Ground the message in the actual research (the 836-case " +
      "baseline, the missing-timestamps finding) rather than generic enthusiasm.",
    {
      institution_id: z.string().uuid(),
      person_name: z.string().min(1),
      person_role: z.string().optional().describe("e.g. 'Professor, Health Systems'"),
      subject: z.string().min(1),
      body: z.string().min(1).describe("Full email text, ready for the owner to review"),
      follow_up_at: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe("When to chase if there is no reply"),
    },
    async (args) => {
      const { q, userId } = await research("outreach");
      const { data, error } = await q
        .insert({
          user_id: userId,
          institution_id: args.institution_id,
          person_name: args.person_name,
          person_role: args.person_role ?? null,
          subject: args.subject,
          body: args.body,
          status: "draft",
          follow_up_at: args.follow_up_at ?? null,
        })
        .select("id")
        .single();
      if (error) return fail(`draft_outreach failed: ${error.message}`);
      return ok(
        `Draft saved for ${args.person_name} (id ${(data as { id: string }).id}). ` +
          `Review it in the app before sending — agents do not send.`,
      );
    },
  );

  server.tool(
    "list_outreach",
    "List supervisor outreach — drafts awaiting review, sent messages awaiting reply, and " +
      "follow-ups now due.",
    {
      institution_id: z.string().uuid().optional(),
      status: z.enum(["draft", "sent", "replied", "no_reply", "closed"]).optional(),
    },
    async ({ institution_id, status }) => {
      const { q } = await research("outreach");
      let query = q
        .select("id, institution_id, person_name, person_role, subject, status, sent_at, follow_up_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (institution_id) query = query.eq("institution_id", institution_id);
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) return fail(`list_outreach failed: ${error.message}`);
      return okJson({ outreach: data });
    },
  );
}
