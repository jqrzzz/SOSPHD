import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  getInstitutionById,
  getOutreach,
  getRequirements,
} from "@/lib/data/admissions-store";
import {
  APPLICATION_STAGE_LABELS,
  REQUIREMENT_STATUS_LABELS,
  STUDY_FORMAT_LABELS,
  daysUntil,
  deadlineUrgency,
  readiness,
  type InstitutionRequirement,
  type RequirementKind,
} from "@/lib/data/admissions-types";
import { cn } from "@/lib/utils";

const KIND_ORDER: RequirementKind[] = [
  "process",
  "deadline",
  "test",
  "document",
  "reference",
  "fee",
];

const KIND_LABELS: Record<RequirementKind, string> = {
  process: "Process",
  deadline: "Deadlines",
  test: "Tests",
  document: "Documents",
  reference: "References",
  fee: "Fees",
};

const URGENCY_CLASS = {
  past: "text-muted-foreground",
  critical: "text-destructive",
  soon: "text-amber-400",
  later: "text-muted-foreground",
} as const;

export default async function InstitutionPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const institution = await getInstitutionById(id);
  if (!institution) notFound();

  const [requirements, outreach] = await Promise.all([
    getRequirements(institution.id),
    getOutreach(institution.id),
  ]);

  const days = institution.next_deadline
    ? daysUntil(institution.next_deadline)
    : null;
  const pct = readiness(requirements);

  const byKind = new Map<RequirementKind, InstitutionRequirement[]>();
  for (const r of requirements) {
    const list = byKind.get(r.kind) ?? [];
    list.push(r);
    byKind.set(r.kind, list);
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="border-b border-border px-6 py-5">
        <Link
          href="/apply"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Applications
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {institution.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {institution.school ? `${institution.school} · ` : ""}
              {institution.programme}
            </p>
            <p className="text-xs text-muted-foreground">
              {institution.city ? `${institution.city}, ` : ""}
              {institution.country}
            </p>
          </div>
          {days !== null && (
            <div className="flex flex-col items-end">
              <span
                className={cn(
                  "font-mono text-2xl font-semibold",
                  URGENCY_CLASS[deadlineUrgency(days)],
                )}
              >
                {days < 0 ? "passed" : `${days}d`}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {institution.next_deadline_label ?? "deadline"} ·{" "}
                {institution.next_deadline}
              </span>
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            {APPLICATION_STAGE_LABELS[institution.stage]}
          </Badge>
          {institution.formats.map((f) => (
            <Badge key={f} variant="secondary" className="text-[10px]">
              {STUDY_FORMAT_LABELS[f] ?? f}
            </Badge>
          ))}
          {institution.supervisor_required && (
            <Badge
              variant="outline"
              className="border-primary/40 text-[10px] text-primary"
            >
              Supervisor agreement required before applying
            </Badge>
          )}
          {institution.fit_score && (
            <span className="font-mono text-[10px] text-primary">
              fit {institution.fit_score}/5
            </span>
          )}
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
            {pct}% of mandatory requirements settled
          </span>
        </div>
      </header>

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        {institution.fit_rationale && (
          <Card>
            <CardContent className="p-5">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Why this one
              </p>
              <p className="text-sm leading-relaxed text-foreground/85">
                {institution.fit_rationale}
              </p>
            </CardContent>
          </Card>
        )}

        {institution.notes && (
          <Card>
            <CardContent className="p-5">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Notes
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {institution.notes}
              </p>
              <div className="mt-3 flex flex-wrap gap-4 text-xs">
                {institution.homepage_url && (
                  <a
                    href={institution.homepage_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-primary underline underline-offset-2"
                  >
                    Programme page ↗
                  </a>
                )}
                {institution.source_url && (
                  <a
                    href={institution.source_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-primary underline underline-offset-2"
                  >
                    Source ↗
                  </a>
                )}
                <span className="text-muted-foreground">
                  {institution.verified_at
                    ? `Verified ${institution.verified_at.slice(0, 10)}`
                    : "Not yet verified against the official page"}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Requirements, grouped */}
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-medium text-foreground">Requirements</h2>
          {requirements.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No requirements recorded yet.
              </CardContent>
            </Card>
          )}
          {KIND_ORDER.filter((k) => byKind.has(k)).map((kind) => (
            <div key={kind} className="flex flex-col gap-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {KIND_LABELS[kind]}
              </p>
              {(byKind.get(kind) ?? []).map((r) => (
                <RequirementCard key={r.id} r={r} />
              ))}
            </div>
          ))}
        </section>

        {/* Supervisor outreach */}
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-foreground">
            Supervisor outreach
          </h2>
          {outreach.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col gap-1 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No outreach logged yet.
                </p>
                {institution.supervisor_required && (
                  <p className="text-xs text-primary">
                    This programme needs an agreed supervisor before you can
                    apply — outreach is the critical path here, not the form.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            outreach.map((o) => (
              <Card key={o.id}>
                <CardContent className="flex flex-col gap-1 p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {o.person_name}
                    </span>
                    {o.person_role && (
                      <span className="text-xs text-muted-foreground">
                        {o.person_role}
                      </span>
                    )}
                    <Badge variant="outline" className="ml-auto text-[10px]">
                      {o.status}
                    </Badge>
                  </div>
                  {o.subject && (
                    <p className="text-xs font-medium text-foreground/80">
                      {o.subject}
                    </p>
                  )}
                  <div className="flex gap-4 font-mono text-[10px] text-muted-foreground">
                    {o.sent_at && <span>sent {o.sent_at.slice(0, 10)}</span>}
                    {o.follow_up_at && (
                      <span>follow up {o.follow_up_at}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </section>
      </div>
    </div>
  );
}

function RequirementCard({ r }: { r: InstitutionRequirement }) {
  const days = r.due_date ? daysUntil(r.due_date) : null;
  const done = r.status === "done" || r.status === "waived";

  return (
    <Card className={cn(done && "opacity-60")}>
      <CardContent className="flex flex-col gap-1.5 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">{r.label}</span>
          {!r.mandatory && (
            <Badge variant="secondary" className="text-[9px]">
              Optional
            </Badge>
          )}
          {!r.verified_at && (
            <Badge
              variant="outline"
              className="border-amber-500/40 text-[9px] uppercase tracking-wide text-amber-400"
            >
              Unverified
            </Badge>
          )}
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
            {REQUIREMENT_STATUS_LABELS[r.status]}
          </span>
        </div>

        {r.detail && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {r.detail}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 text-[10px]">
          {days !== null && (
            <span
              className={cn(
                "font-mono",
                URGENCY_CLASS[deadlineUrgency(days)],
              )}
            >
              {r.due_date} · {days < 0 ? "passed" : `${days} days`}
            </span>
          )}
          {r.source_url && (
            <a
              href={r.source_url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-primary underline underline-offset-2"
            >
              source ↗
            </a>
          )}
          {r.verified_at && (
            <span className="text-muted-foreground">
              verified {r.verified_at.slice(0, 10)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
