import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  getInstitutions,
  getRequirements,
} from "@/lib/data/admissions-store";
import {
  APPLICATION_STAGE_LABELS,
  STUDY_FORMAT_LABELS,
  daysUntil,
  deadlineUrgency,
  readiness,
  type Institution,
  type InstitutionRequirement,
} from "@/lib/data/admissions-types";
import {
  DeadlineTimeline,
  SchoolComparison,
} from "@/components/school-comparison";
import { PortfolioPanel } from "@/components/portfolio-panel";
import {
  computeCoverage,
  coverageSummary,
  greStance,
  portfolioRollup,
} from "@/lib/data/admissions-coverage";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Applications",
  description:
    "PhD admissions pipeline — institutions, requirements, deadlines, and supervisor outreach.",
};

const URGENCY_CLASS = {
  past: "text-muted-foreground",
  critical: "text-destructive",
  soon: "text-amber-400",
  later: "text-muted-foreground",
} as const;

/**
 * Applications — the bureaucratic track that runs alongside the research.
 * Ordered by deadline because that is the only thing here that cannot be
 * renegotiated.
 */
export default async function ApplyPage() {
  const [institutions, allReqs] = await Promise.all([
    getInstitutions(),
    getRequirements(),
  ]);

  const reqsByInstitution = new Map<string, InstitutionRequirement[]>();
  for (const r of allReqs) {
    const list = reqsByInstitution.get(r.institution_id) ?? [];
    list.push(r);
    reqsByInstitution.set(r.institution_id, list);
  }

  const active = institutions.filter(
    (i) => i.stage !== "withdrawn" && i.stage !== "rejected",
  );
  const dated = active
    .filter((i) => i.next_deadline)
    .sort((a, b) => (a.next_deadline! < b.next_deadline! ? -1 : 1));
  const undated = active.filter((i) => !i.next_deadline);
  const parked = institutions.filter(
    (i) => i.stage === "withdrawn" || i.stage === "rejected",
  );

  const nextUp = dated[0];
  const activeIds = new Set(active.map((i) => i.id));
  const unverifiedReqCount = allReqs.filter(
    (r) => !r.verified_at && activeIds.has(r.institution_id),
  ).length;
  const supervisorFirst = active.filter((i) => i.supervisor_required);

  // Shared work, counted once across every school still in play.
  const portfolio = portfolioRollup(
    active.map((i) => ({
      id: i.id,
      name: i.name,
      next_deadline: i.next_deadline,
      supervisor_required: i.supervisor_required,
      requirements: reqsByInstitution.get(i.id) ?? [],
    })),
  );

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <PageHeader
        eyebrow="Admissions"
        title="Applications"
        description="Every institution under consideration, what each one demands, and when it closes. Deadlines and requirements carry their source — anything unconfirmed is marked."
      />

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        {/* The three things that actually matter right now */}
        <section className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex flex-col gap-1 p-5">
              <span className="text-xs text-muted-foreground">Next deadline</span>
              {nextUp ? (
                <>
                  <span
                    className={cn(
                      "text-2xl font-semibold tracking-tight",
                      URGENCY_CLASS[deadlineUrgency(daysUntil(nextUp.next_deadline!))],
                    )}
                  >
                    {daysUntil(nextUp.next_deadline!)} days
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {nextUp.name} · {nextUp.next_deadline}
                  </span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">
                  No dated deadlines yet
                </span>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-1 p-5">
              <span className="text-xs text-muted-foreground">
                Supervisor-first programmes
              </span>
              <span className="text-2xl font-semibold tracking-tight text-foreground">
                {supervisorFirst.length}
              </span>
              <span className="text-[11px] text-muted-foreground">
                need an agreed supervisor before you can apply
              </span>
            </CardContent>
          </Card>

          {/* Links to the burn-down queue: the one admissions job only a
              human browser can do, since institutional domains are blocked
              from the research environment. */}
          <Link href="/apply/verify" className="group">
            <Card className="h-full transition-colors group-hover:border-primary/50">
              <CardContent className="flex flex-col gap-1 p-5">
                <span className="text-xs text-muted-foreground">
                  Verification queue
                </span>
                <span className="text-2xl font-semibold tracking-tight text-foreground">
                  {unverifiedReqCount}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  requirements to confirm against official pages →
                </span>
              </CardContent>
            </Card>
          </Link>
        </section>

        {/* Shared work first. Five applications look like sixty problems
            until the items that are one piece of work are counted once. */}
        <PortfolioPanel actions={portfolio} />

        {/* Deadline strip — see the pile-up, don't infer it from a list */}
        {dated.length > 0 && (
          <Card>
            <CardContent className="p-5">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Deadline runway
              </p>
              <DeadlineTimeline institutions={active} />
            </CardContent>
          </Card>
        )}

        {/* Side-by-side comparison — hidden when there is nothing to
            compare, so the empty state is one message, not a bare box. */}
        {active.length > 0 && (
          <Card>
            <CardContent className="p-5">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Compare
              </p>
              <SchoolComparison
                institutions={active}
                reqsByInstitution={reqsByInstitution}
              />
            </CardContent>
          </Card>
        )}

        {/* Live pipeline, deadline order */}
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-foreground">
            In play · by deadline
          </h2>
          <div className="flex flex-col gap-3">
            {[...dated, ...undated].map((inst) => (
              <InstitutionRow
                key={inst.id}
                inst={inst}
                reqs={reqsByInstitution.get(inst.id) ?? []}
              />
            ))}
            {active.length === 0 && (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  No institutions yet.
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        {parked.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              Parked
            </h2>
            <div className="flex flex-col gap-3 opacity-70">
              {parked.map((inst) => (
                <InstitutionRow
                  key={inst.id}
                  inst={inst}
                  reqs={reqsByInstitution.get(inst.id) ?? []}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function InstitutionRow({
  inst,
  reqs,
}: {
  inst: Institution;
  reqs: InstitutionRequirement[];
}) {
  const days = inst.next_deadline ? daysUntil(inst.next_deadline) : null;
  const pct = readiness(reqs);
  const coverage = computeCoverage(inst, reqs);
  const gre = greStance(reqs);

  return (
    <Link href={`/apply/${inst.id}`} className="group">
      <Card className="transition-colors group-hover:border-primary/50">
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  {inst.name}
                </h3>
                {inst.fit_score && (
                  <span className="font-mono text-[10px] text-primary">
                    fit {inst.fit_score}/5
                  </span>
                )}
                {!inst.verified_at && (
                  <Badge
                    variant="outline"
                    className="border-amber-500/40 text-[9px] uppercase tracking-wide text-amber-400"
                  >
                    Unverified
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {inst.school ? `${inst.school} · ` : ""}
                {inst.programme} · {inst.country}
              </p>
            </div>

            <div className="flex flex-col items-end gap-0.5">
              {days !== null ? (
                <span
                  className={cn(
                    "font-mono text-sm font-semibold",
                    URGENCY_CLASS[deadlineUrgency(days)],
                  )}
                >
                  {days < 0 ? "passed" : `${days}d`}
                </span>
              ) : (
                <span className="font-mono text-[11px] text-muted-foreground">
                  no date
                </span>
              )}
              <span className="text-[10px] text-muted-foreground">
                {inst.next_deadline_label ?? "—"}
              </span>
            </div>
          </div>

          {inst.fit_rationale && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {inst.fit_rationale}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {inst.formats.map((f) => (
              <Badge key={f} variant="secondary" className="text-[10px]">
                {STUDY_FORMAT_LABELS[f] ?? f}
              </Badge>
            ))}
            {inst.supervisor_required && (
              <Badge
                variant="outline"
                className="border-primary/40 text-[10px] text-primary"
              >
                Supervisor first
              </Badge>
            )}
            {/* A hard filter, not one requirement among many — sitting the
                GRE is ruled out, so a school that mandates it is ineligible
                however well it fits otherwise. Shown at list level so that
                never has to be rediscovered inside a school's page. */}
            {gre === "required" && (
              <Badge
                variant="outline"
                className="border-destructive/50 text-[10px] text-destructive"
              >
                GRE required
              </Badge>
            )}
            {gre === "not_required" && (
              <Badge
                variant="outline"
                className="border-primary/30 text-[10px] text-primary/80"
              >
                No GRE
              </Badge>
            )}
            {gre === "unknown" && (
              <Badge
                variant="outline"
                className="border-amber-500/40 text-[10px] text-amber-400"
              >
                GRE unknown
              </Badge>
            )}
            <span className="ml-auto flex flex-wrap items-center justify-end gap-x-2 font-mono text-[10px] text-muted-foreground">
              <span>
                {APPLICATION_STAGE_LABELS[inst.stage]} · {reqs.length} requirement
                {reqs.length === 1 ? "" : "s"} · {pct}% of known work
              </span>
              {/* Coverage, not progress. A row can be 100% on known work and
                  still be missing half its requirements. */}
              <span
                className={cn(
                  coverage.unknownUniversal.length > 0
                    ? "text-destructive"
                    : coverage.unknown.length > 0
                      ? "text-amber-400"
                      : "text-primary",
                )}
              >
                · {coverageSummary(coverage)}
              </span>
              {coverage.behind.length > 0 && (
                <span className="text-destructive">
                  · {coverage.behind.length} past lead time
                </span>
              )}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
