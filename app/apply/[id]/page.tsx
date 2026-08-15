import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PeopleToContact } from "@/components/people-to-contact";
import {
  NotesEditor,
  OutreachPanel,
  RequirementCard,
  StageControl,
} from "@/components/admissions-controls";
import {
  getContactsForTarget,
  getInstitutionById,
  getOutreach,
  getRequirements,
} from "@/lib/data/admissions-store";
import {
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
  process: "Process — do these first",
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

  const [requirements, outreach, people] = await Promise.all([
    getRequirements(institution.id),
    getOutreach(institution.id),
    getContactsForTarget({ institutionId: institution.id }),
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
                  "font-mono text-3xl font-semibold",
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

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StageControl institutionId={institution.id} stage={institution.stage} />
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
              Supervisor first
            </Badge>
          )}
          {institution.fit_score && (
            <span className="font-mono text-[10px] text-primary">
              fit {institution.fit_score}/5
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">
              {pct}% ready
            </span>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-6 p-4 sm:p-6 lg:flex-row lg:items-start">
        <div className="flex flex-1 flex-col gap-6">
          {institution.fit_rationale && (
            <Card>
              <CardContent className="p-5">
                <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Why this one
                </p>
                <p className="text-sm leading-relaxed text-foreground/85">
                  {institution.fit_rationale}
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
                      : "Dates not yet confirmed against the official page"}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-medium text-foreground">
              Requirements{" "}
              <span className="font-normal text-muted-foreground">
                — click a box to advance it
              </span>
            </h2>
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
                  <RequirementCard key={r.id} r={r} institutionId={institution.id} />
                ))}
              </div>
            ))}
          </section>
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-6 lg:w-96">
          <Card>
            <CardContent className="p-5">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                People to contact
              </p>
              <PeopleToContact
                contacts={people}
                emptyHint={
                  institution.supervisor_required
                    ? "No named supervisors yet — and this programme requires an agreed supervisor before you can apply, so finding them is the critical path."
                    : undefined
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <OutreachPanel
                institutionId={institution.id}
                outreach={outreach}
                supervisorRequired={institution.supervisor_required}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Notes
              </p>
              <NotesEditor
                institutionId={institution.id}
                notes={institution.notes}
              />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
