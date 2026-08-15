import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getFundingOpportunityById } from "@/lib/data/funding-store";
import { getContactsForTarget, getOutreach } from "@/lib/data/admissions-store";
import { PeopleToContact } from "@/components/people-to-contact";
import {
  ELIGIBILITY_BLURB,
  ELIGIBILITY_LABELS,
  FUNDING_STAGE_LABELS,
} from "@/lib/data/funding-types";
import { daysUntil, deadlineUrgency } from "@/lib/data/admissions-types";
import { cn } from "@/lib/utils";

const URGENCY_CLASS = {
  past: "text-muted-foreground",
  critical: "text-destructive",
  soon: "text-amber-400",
  later: "text-muted-foreground",
} as const;

export default async function FundingDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const o = await getFundingOpportunityById(id);
  if (!o) notFound();

  const [allOutreach, people] = await Promise.all([
    getOutreach(),
    getContactsForTarget({ opportunityId: o.id }),
  ]);
  const outreach = allOutreach.filter((x) => x.opportunity_id === o.id);
  const days = o.next_deadline ? daysUntil(o.next_deadline) : null;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="border-b border-border px-6 py-5">
        <Link
          href="/funding"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Funding
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {o.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {o.funder}
              {o.geography ? ` · ${o.geography}` : ""}
            </p>
          </div>
          {days !== null && (
            <div className="flex flex-col items-end">
              <span
                className={cn(
                  "font-mono text-3xl font-semibold",
                  URGENCY_CLASS[deadlineUrgency(days)],
                )}
              >
                {days < 0 ? "passed" : `${days}d`}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {o.next_deadline}
              </span>
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            {FUNDING_STAGE_LABELS[o.stage]}
          </Badge>
          <Badge variant="secondary" className="text-[10px] capitalize">
            {o.kind}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px]",
              o.eligibility_category === "b_needs_affiliation"
                ? "border-border text-muted-foreground"
                : "border-primary/40 text-primary",
            )}
          >
            {ELIGIBILITY_LABELS[o.eligibility_category]}
          </Badge>
          {o.fit_score && (
            <span className="font-mono text-[10px] text-primary">
              fit {o.fit_score}/5
            </span>
          )}
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
            confidence: {o.confidence}
          </span>
        </div>
      </header>

      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <Card>
          <CardContent className="flex flex-col gap-3 p-5">
            <div>
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Eligibility
              </p>
              <p className="text-xs text-muted-foreground">
                {ELIGIBILITY_BLURB[o.eligibility_category]}
              </p>
              {o.eligibility_note && (
                <p className="mt-2 text-sm leading-relaxed text-foreground/85">
                  {o.eligibility_note}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {o.relevance && (
          <Card>
            <CardContent className="p-5">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Why it fits this research
              </p>
              <p className="text-sm leading-relaxed text-foreground/85">
                {o.relevance}
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Amount" value={o.amount_note} />
            <Field label="Deadline" value={o.deadline_note} />
            <Field label="Caveats" value={o.caveats} />
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Source
              </span>
              {o.source_url ? (
                <a
                  href={o.source_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="break-all text-xs text-primary underline underline-offset-2"
                >
                  {o.source_url} ↗
                </a>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
              <span className="text-[10px] text-muted-foreground">
                {o.verified_at
                  ? `Verified ${o.verified_at.slice(0, 10)}`
                  : "Not yet confirmed on the funder's own page"}
              </span>
            </div>
          </CardContent>
        </Card>

        {o.notes && (
          <Card>
            <CardContent className="p-5">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Notes
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {o.notes}
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-5">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Who to contact
            </p>
            <PeopleToContact
              contacts={people}
              emptyHint="No contact point recorded yet. For funders a general grants inbox is often the correct route — unlike academic outreach, foundations expect it."
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Approaches
            </p>
            {outreach.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No approaches logged. Drafts written by the research agent
                appear here for you to review — nothing is ever sent
                automatically.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {outreach.map((x) => (
                  <div
                    key={x.id}
                    className="flex items-center gap-2 rounded-md border border-border p-3"
                  >
                    <span className="text-sm text-foreground">
                      {x.person_name}
                    </span>
                    {x.subject && (
                      <span className="text-xs text-muted-foreground">
                        {x.subject}
                      </span>
                    )}
                    <Badge variant="outline" className="ml-auto text-[10px]">
                      {x.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <span className="text-sm text-foreground/85">{value || "—"}</span>
    </div>
  );
}
