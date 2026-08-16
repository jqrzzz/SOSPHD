import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getFundingOpportunities } from "@/lib/data/funding-store";
import {
  ELIGIBILITY_BLURB,
  ELIGIBILITY_LABELS,
  ELIGIBILITY_ORDER,
  FUNDING_STAGE_LABELS,
  isLive,
  type EligibilityCategory,
  type FundingOpportunity,
} from "@/lib/data/funding-types";
import { daysUntil, deadlineUrgency } from "@/lib/data/admissions-types";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Funding",
  description:
    "Grants, fellowships, government schemes and donors — grouped by what you can actually apply for today.",
};

const URGENCY_CLASS = {
  past: "text-muted-foreground",
  critical: "text-destructive",
  soon: "text-amber-400",
  later: "text-muted-foreground",
} as const;

const CATEGORY_ACCENT: Record<EligibilityCategory, string> = {
  a_open_now: "border-primary/40",
  c_company_eligible: "border-primary/25",
  b_needs_affiliation: "border-border",
};

/**
 * Funding — grouped by eligibility rather than by funder or amount,
 * because the binding constraint pre-acceptance is not "which grant is
 * biggest" but "which grant will even accept an application from someone
 * without a university behind them".
 */
export default async function FundingPage() {
  const all = await getFundingOpportunities();
  const live = all.filter(isLive);

  const byCategory = new Map<EligibilityCategory, FundingOpportunity[]>();
  for (const o of live) {
    const list = byCategory.get(o.eligibility_category) ?? [];
    list.push(o);
    byCategory.set(o.eligibility_category, list);
  }

  const actionable =
    (byCategory.get("a_open_now")?.length ?? 0) +
    (byCategory.get("c_company_eligible")?.length ?? 0);
  const unverified = live.filter((o) => !o.verified_at).length;
  const nextDated = live
    .filter((o) => o.next_deadline)
    .sort((a, b) => (a.next_deadline! < b.next_deadline! ? -1 : 1))[0];

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <PageHeader
        eyebrow="Support"
        title="Funding"
        description="Grants, fellowships, government schemes and donors — grouped by whether you can apply today, whether Tourist SOS can apply, or whether it waits on a university place."
      />

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <section className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex flex-col gap-1 p-5">
              <span className="text-xs text-muted-foreground">
                Actionable now
              </span>
              <span className="text-2xl font-semibold tracking-tight text-foreground">
                {actionable}
              </span>
              <span className="text-[11px] text-muted-foreground">
                open to you or to Tourist SOS today
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-1 p-5">
              <span className="text-xs text-muted-foreground">
                Next dated deadline
              </span>
              {nextDated ? (
                <>
                  <span
                    className={cn(
                      "text-2xl font-semibold tracking-tight",
                      URGENCY_CLASS[
                        deadlineUrgency(daysUntil(nextDated.next_deadline!))
                      ],
                    )}
                  >
                    {daysUntil(nextDated.next_deadline!)} days
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {nextDated.name}
                  </span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">
                  No dated deadlines recorded
                </span>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-1 p-5">
              <span className="text-xs text-muted-foreground">Unverified</span>
              <span className="text-2xl font-semibold tracking-tight text-foreground">
                {unverified}
              </span>
              <span className="text-[11px] text-muted-foreground">
                need confirming on the funder&apos;s own page
              </span>
            </CardContent>
          </Card>
        </section>

        {live.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
              <p className="text-sm font-medium text-foreground">
                No funding opportunities recorded yet.
              </p>
              <p className="max-w-md text-xs text-muted-foreground">
                Ask the research agent to sweep for grants, fellowships and
                donors — findings land here with their source links.
              </p>
            </CardContent>
          </Card>
        )}

        {ELIGIBILITY_ORDER.filter((c) => byCategory.has(c)).map((category) => (
          <section key={category} className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-sm font-medium text-foreground">
                {ELIGIBILITY_LABELS[category]}
                <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                  {byCategory.get(category)!.length}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                {ELIGIBILITY_BLURB[category]}
              </p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {byCategory.get(category)!.map((o) => (
                <OpportunityCard key={o.id} o={o} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function OpportunityCard({ o }: { o: FundingOpportunity }) {
  const days = o.next_deadline ? daysUntil(o.next_deadline) : null;

  return (
    <Link href={`/funding/${o.id}`} className="group">
      <Card
        className={cn(
          "h-full border transition-colors group-hover:border-primary/50",
          CATEGORY_ACCENT[o.eligibility_category],
        )}
      >
        <CardContent className="flex h-full flex-col gap-2 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <h3 className="text-sm font-semibold leading-snug text-foreground">
                {o.name}
              </h3>
              <p className="text-xs text-muted-foreground">
                {o.funder}
                {o.geography ? ` · ${o.geography}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Badge variant="secondary" className="text-[10px] capitalize">
                {o.kind}
              </Badge>
              {o.fit_score && (
                <span className="font-mono text-[10px] text-primary">
                  fit {o.fit_score}/5
                </span>
              )}
            </div>
          </div>

          {o.relevance && (
            <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
              {o.relevance}
            </p>
          )}

          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 font-mono text-[10px] text-muted-foreground">
            {o.amount_note && (
              <span className="text-foreground/70">{o.amount_note}</span>
            )}
            {days !== null ? (
              <span className={URGENCY_CLASS[deadlineUrgency(days)]}>
                {o.next_deadline} · {days < 0 ? "passed" : `${days}d`}
              </span>
            ) : (
              o.deadline_note && <span>{o.deadline_note}</span>
            )}
            {!o.verified_at && (
              <span className="text-amber-400">unverified</span>
            )}
            <span className="ml-auto">{FUNDING_STAGE_LABELS[o.stage]}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
