import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import {
  ConfirmRequirementButton,
  ContactEmailForm,
} from "@/components/verify-controls";
import {
  getInstitutions,
  getOutreachWaveContacts,
  getRequirements,
} from "@/lib/data/admissions-store";
import { daysUntil, type InstitutionRequirement } from "@/lib/data/admissions-types";
import { emailIsVerified } from "@/lib/data/fieldwork-types";

export const metadata = {
  title: "Verification queue",
  description:
    "Everything recorded from search results that still needs confirming against an official page.",
};

/* ─── Verification queue ───────────────────────────────────────────────
 *  The structural bottleneck of the admissions system, made into a
 *  burn-down list. The research environment cannot reach institutional
 *  domains, so requirements arrive marked UNCONFIRMED and supervisors
 *  arrive without addresses. The owner's browser has no such limit.
 *
 *  Each row is: open the link, read the page, press the button. Nothing
 *  here asks for judgement beyond "does the page say what we recorded" —
 *  and pressing confirm without reading defeats the entire point of the
 *  provenance system, so don't.
 * ────────────────────────────────────────────────────────────────────── */

export default async function VerifyPage() {
  const [institutions, requirements, contacts] = await Promise.all([
    getInstitutions(),
    getRequirements(),
    getOutreachWaveContacts(),
  ]);

  const live = institutions.filter(
    (i) => i.stage !== "withdrawn" && i.stage !== "rejected",
  );
  const liveIds = new Set(live.map((i) => i.id));

  // Unverified requirements, only for schools still in play, grouped by
  // school and ordered by deadline pressure — LSHTM's unknowns matter more
  // than Duke-NUS's because its deadline arrives three months sooner.
  const unverified = requirements.filter(
    (r) => !r.verified_at && liveIds.has(r.institution_id),
  );
  const bySchool = new Map<string, InstitutionRequirement[]>();
  for (const r of unverified) {
    const list = bySchool.get(r.institution_id) ?? [];
    list.push(r);
    bySchool.set(r.institution_id, list);
  }
  const schools = live
    .filter((i) => bySchool.has(i.id))
    .sort((a, b) => {
      if (a.next_deadline && b.next_deadline)
        return a.next_deadline < b.next_deadline ? -1 : 1;
      // Undated schools sort first: their unknowns include the deadline itself.
      if (!a.next_deadline && b.next_deadline) return -1;
      if (a.next_deadline && !b.next_deadline) return 1;
      return (b.fit_score ?? 0) - (a.fit_score ?? 0);
    });

  const unaddressed = contacts.filter((c) => !emailIsVerified(c));

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="border-b border-border px-6 py-5">
        <Link
          href="/apply"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Applications
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
          Verification queue
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Everything below was recorded from search results because the research
          environment cannot open institutional pages — your browser can. Open
          the link, read the page, then confirm. If the page disagrees with what
          we recorded, edit the requirement on the school&apos;s page instead of
          confirming it.
        </p>
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
          {unverified.length} requirement{unverified.length === 1 ? "" : "s"} unconfirmed ·{" "}
          {unaddressed.length} contact{unaddressed.length === 1 ? "" : "s"} without a usable address
        </p>
      </header>

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        {/* Contacts first: every confirmed address unblocks outreach drafts
            that are already written and waiting. */}
        {unaddressed.length > 0 && (
          <Card>
            <CardContent className="flex flex-col gap-4 p-5">
              <div>
                <h2 className="text-sm font-medium text-foreground">
                  Addresses to read off official pages
                </h2>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  These people are worth contacting and no address on file is
                  safe to send to. Addresses were never guessed — record one
                  only exactly as an official page shows it, with that
                  page&apos;s URL. Each one recorded unblocks outreach that is
                  already drafted.
                </p>
              </div>
              <ul className="flex flex-col gap-4">
                {unaddressed.map((c) => (
                  <li key={c.id} className="flex flex-col gap-2 rounded-md border border-border/60 p-3">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-medium text-foreground">{c.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.title ? `${c.title} · ` : ""}
                        {c.organization ?? ""}
                      </span>
                      {c.profile_url && (
                        <a
                          href={c.profile_url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="ml-auto text-xs text-primary underline underline-offset-2"
                        >
                          Open profile page ↗
                        </a>
                      )}
                    </div>
                    <ContactEmailForm contactId={c.id} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {schools.map((school) => {
          const reqs = bySchool.get(school.id) ?? [];
          const days = school.next_deadline ? daysUntil(school.next_deadline) : null;
          return (
            <Card key={school.id}>
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link
                    href={`/apply/${school.id}`}
                    className="text-sm font-medium text-foreground hover:text-primary"
                  >
                    {school.name}
                    <span className="ml-2 font-normal text-muted-foreground">
                      {school.programme}
                    </span>
                  </Link>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {days === null
                      ? "no deadline established — that is itself in this list"
                      : `deadline in ${days}d`}
                  </span>
                </div>
                <ul className="flex flex-col gap-2">
                  {reqs.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-col gap-1.5 rounded-md border border-border/60 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-sm text-foreground">{r.label}</span>
                        <ConfirmRequirementButton id={r.id} institutionId={school.id} />
                      </div>
                      {r.detail && (
                        <p className="line-clamp-3 text-[11px] leading-relaxed text-muted-foreground">
                          {r.detail}
                        </p>
                      )}
                      {r.source_url ? (
                        <a
                          href={r.source_url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-xs text-primary underline underline-offset-2"
                        >
                          Open the official page ↗
                        </a>
                      ) : (
                        <span className="text-[11px] text-amber-400">
                          No source URL recorded — find the official page first.
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}

        {unverified.length === 0 && unaddressed.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nothing waiting. Every requirement is confirmed and every
              outreach contact has a sourced address.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
