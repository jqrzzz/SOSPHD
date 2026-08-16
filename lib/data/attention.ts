import "server-only";

/* ─── What needs attention ─────────────────────────────────────────────
 *  One query layer answering "what is on fire, what is close, and what
 *  is blocked" across every module — deadlines, tasks, and the things
 *  that are ready except for one missing piece.
 *
 *  This exists so the app carries the load of remembering, rather than
 *  the owner holding a mental list or an agent reciting one at him.
 * ────────────────────────────────────────────────────────────────────── */

import { getServerSupabase } from "@/lib/supabase/server-auth";
import { warnDegradedMode } from "@/lib/data/degraded";
import { computeCoverage, coverageSummary } from "./admissions-coverage";
import { daysUntil, type InstitutionRequirement } from "./admissions-types";
import type { AttentionItem } from "./attention-types";

export type { AttentionItem, AttentionKind } from "./attention-types";
export { bandAttention } from "./attention-types";

interface Row {
  [k: string]: unknown;
}

/**
 * Deadlines, overdue work, and blockers, ranked by how soon they bite.
 * Undated blockers sort after dated ones but before distant deadlines,
 * because "ready except for one thing" is usually more actionable than
 * "due in four months".
 */
export async function getAttention(): Promise<AttentionItem[]> {
  const sb = await getServerSupabase();
  if (!sb) {
    warnDegradedMode("getAttention", "supabase unavailable");
    return [];
  }

  const [institutions, funding, tasks, contacts, liveInstitutions, requirements] = await Promise.all([
    sb
      .schema("research")
      .from("institutions")
      .select("id, name, programme, next_deadline, next_deadline_label, stage, verified_at, supervisor_required")
      .not("next_deadline", "is", null),
    sb
      .schema("research")
      .from("funding_opportunities")
      .select("id, name, funder, next_deadline, eligibility_category, stage")
      .not("next_deadline", "is", null),
    sb
      .schema("research")
      .from("tasks")
      .select("id, title, description, due_date, priority, status")
      .eq("status", "todo"),
    sb
      .schema("research")
      .from("contacts")
      .select("id, name, organization, email, email_source_url, outreach_priority, institution_id, opportunity_id")
      .in("outreach_priority", ["first_wave", "second_wave"]),
    // Coverage needs every live institution, including ones with no
    // deadline on file — those are the most dangerous, since a missing
    // date makes a school invisible to every date-ordered view.
    sb
      .schema("research")
      .from("institutions")
      .select("id, name, programme, next_deadline, supervisor_required, stage, fit_score")
      .not("stage", "in", "(submitted,offer,rejected,withdrawn)"),
    sb
      .schema("research")
      .from("institution_requirements")
      .select("id, created_at, user_id, institution_id, kind, label, detail, due_date, mandatory, status, source_url, verified_at"),
  ]);

  const items: AttentionItem[] = [];

  for (const r of (institutions.data ?? []) as Row[]) {
    const d = daysUntil(r.next_deadline as string);
    // Terminal stages have no live deadline pressure.
    if (["submitted", "offer", "rejected", "withdrawn"].includes(r.stage as string)) continue;
    items.push({
      id: `inst-${r.id}`,
      kind: "deadline",
      title: `${r.name} — ${r.next_deadline_label ?? "deadline"}`,
      detail:
        `${r.programme}` +
        (r.verified_at ? "" : " · date NOT yet confirmed on the official page") +
        (r.supervisor_required ? " · needs an agreed supervisor before you can apply" : ""),
      days: d,
      href: `/apply/${r.id}`,
      weight: d,
    });
  }

  for (const r of (funding.data ?? []) as Row[]) {
    const d = daysUntil(r.next_deadline as string);
    if (["submitted", "awarded", "declined", "not_eligible", "passed"].includes(r.stage as string)) continue;
    // Affiliation-gated funders are years out; they are not "attention".
    if (r.eligibility_category === "b_needs_affiliation") continue;
    items.push({
      id: `fund-${r.id}`,
      kind: "deadline",
      title: `${r.name}`,
      detail: `${r.funder} · funding deadline`,
      days: d,
      href: `/funding/${r.id}`,
      weight: d,
    });
  }

  for (const r of (tasks.data ?? []) as Row[]) {
    const d = r.due_date ? daysUntil(r.due_date as string) : null;
    items.push({
      id: `task-${r.id}`,
      kind: "task",
      title: r.title as string,
      detail: ((r.description as string) ?? "").slice(0, 220),
      days: d,
      href: "/workspace",
      // Undated tasks sit just past the three-month horizon rather than last.
      weight: d ?? 100,
    });
  }

  // Blindspots: requirements nobody has established either way. These are
  // deliberately ranked with — not after — dated work, because an unknown
  // cannot be planned around. A gap found six weeks out is an inconvenience;
  // the same gap found six days out has already decided the outcome.
  const reqsByInstitution = new Map<string, InstitutionRequirement[]>();
  for (const r of (requirements.data ?? []) as unknown as InstitutionRequirement[]) {
    const list = reqsByInstitution.get(r.institution_id) ?? [];
    list.push(r);
    reqsByInstitution.set(r.institution_id, list);
  }

  for (const r of (liveInstitutions.data ?? []) as Row[]) {
    const coverage = computeCoverage(
      {
        next_deadline: (r.next_deadline as string | null) ?? null,
        supervisor_required: Boolean(r.supervisor_required),
      },
      reqsByInstitution.get(r.id as string) ?? [],
    );
    if (coverage.unknown.length === 0 && coverage.behind.length === 0) continue;

    const d = r.next_deadline ? daysUntil(r.next_deadline as string) : null;
    const late = coverage.behind.length;
    const gaps = coverage.unknownUniversal.length;

    items.push({
      id: `coverage-${r.id}`,
      kind: "unverified",
      title: `${r.name} — ${coverageSummary(coverage)}`,
      detail:
        (late > 0
          ? `${late} item${late === 1 ? " is" : "s are"} already inside the lead time they need. `
          : "") +
        (gaps > 0
          ? `Not established: ${coverage.unknownUniversal.map((i) => i.canonical.label).join(", ")}.`
          : `To confirm: ${coverage.unknown.map((i) => i.canonical.label).join(", ")}.`),
      days: d,
      href: `/apply/${r.id}`,
      // Sits just ahead of the deadline it endangers, so a blindspot is
      // read before the date it would ruin. Undated schools sort to the
      // front of the blocked band: no date is worse than a near one.
      weight: d === null ? -0.5 : d - 0.5,
    });
  }

  // Blocked: worth contacting, but no address that is safe to send to.
  const unaddressed = ((contacts.data ?? []) as Row[]).filter(
    (c) => !(c.email && c.email_source_url),
  );
  if (unaddressed.length > 0) {
    const linked = unaddressed.filter((c) => c.institution_id).length;
    items.push({
      id: "blocked-emails",
      kind: "blocked",
      title: `${unaddressed.length} contacts have no confirmed email address`,
      detail:
        `${linked} are prospective supervisors. Each has a profile URL on file; ` +
        `addresses were never guessed, so outreach is blocked until they are read ` +
        `off the official pages.`,
      days: null,
      href: "/contacts",
      weight: -1, // ahead of dated items: it blocks everything downstream
    });
  }

  return items.sort((a, b) => a.weight - b.weight);
}
