import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCaseById,
  getEventsByCaseId,
  getRecommendationsByCaseId,
} from "@/lib/data/store";
import { computeAllMetrics } from "@/lib/data/metrics";
import { MetricCard } from "@/components/metric-card";
import { SeverityBadge } from "@/components/severity-badge";
import { StatusBadge } from "@/components/status-badge";
import { CaseTimeline } from "@/components/case-timeline";
import { CaseMetricTimeline } from "@/components/case-metric-timeline";
import { EventForm } from "@/components/event-form";
import { RecommendationCard } from "@/components/recommendation-card";
import { GenerateRecommendationsButton } from "@/components/generate-recommendations-button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export default async function CaseDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const caseData = await getCaseById(params.id);

  if (!caseData) {
    notFound();
  }

  const events = await getEventsByCaseId(params.id);
  const metrics = computeAllMetrics(events);
  const recommendations = await getRecommendationsByCaseId(params.id);

  const pendingRecs = recommendations.filter((r) => r.accepted === null);
  const acceptedRecs = recommendations.filter((r) => r.accepted === true);
  const overriddenRecs = recommendations.filter((r) => r.accepted === false);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Header */}
      <header className="relative isolate border-b border-border/60 px-4 pb-6 pt-6 sm:px-6 sm:pt-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-32 bg-gradient-to-b from-primary/[0.06] via-transparent to-transparent"
        />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Link
              href="/cases"
              className="inline-flex w-fit items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Back to cases"
            >
              ← Cases
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-xl font-semibold tracking-tight sm:text-2xl">
                {caseData.patient_ref}
              </h1>
              <SeverityBadge severity={caseData.severity} />
              <StatusBadge status={caseData.status} />
            </div>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {caseData.chief_complaint}
            </p>
            {caseData.notes && (
              <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground/70">
                {caseData.notes}
              </p>
            )}
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
              Created {formatDate(caseData.created_at, "datetime")} ·{" "}
              {events.length} event{events.length === 1 ? "" : "s"} ·{" "}
              {recommendations.length} recommendation
              {recommendations.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-col gap-8 p-4 sm:p-6">
        {/* Metric cards */}
        <section aria-label="Key metrics">
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Key metrics
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {metrics.map((metric) => (
              <MetricCard key={metric.abbreviation} metric={metric} />
            ))}
          </div>
        </section>

        {/* Metric timeline */}
        {events.length >= 2 && (
          <section aria-label="Metric timeline">
            <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Metric timeline
            </h2>
            <CaseMetricTimeline events={events} metrics={metrics} />
          </section>
        )}

        {/* AI Recommendations (the Paper 2 surface) */}
        <section aria-label="AI recommendations">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                AI recommendations · paper 2 provenance
              </h2>
              {recommendations.length > 0 && (
                <p className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.12em]">
                  {pendingRecs.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-primary">
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_0_hsl(170_50%_38%/0.6)]"
                      />
                      {pendingRecs.length} pending
                    </span>
                  )}
                  {acceptedRecs.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-emerald-300">
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                      />
                      {acceptedRecs.length} accepted
                    </span>
                  )}
                  {overriddenRecs.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-amber-300">
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 rounded-full bg-amber-400"
                      />
                      {overriddenRecs.length} overridden
                    </span>
                  )}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <GenerateRecommendationsButton
                caseId={params.id}
                count={3}
                variant={recommendations.length === 0 ? "default" : "outline"}
                label={
                  recommendations.length === 0
                    ? "Generate AI recommendations"
                    : "Generate 3 more"
                }
              />
            </div>
          </div>

          {recommendations.length === 0 ? (
            <Card className="surface-lifted">
              <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
                <div className="relative">
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 -z-10 rounded-2xl bg-primary/15 blur-2xl"
                  />
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 to-primary/5 text-xl text-primary/80">
                    ◆
                  </div>
                </div>
                <div className="flex max-w-md flex-col gap-1.5">
                  <p className="text-sm font-semibold text-foreground">
                    No recommendations yet
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Generate coordination recommendations grounded in the
                    current event timeline. Every accept / override is logged
                    to the timeline as a NOTE — that&apos;s the audit trail
                    Paper 2 cites.
                  </p>
                </div>
                <GenerateRecommendationsButton
                  caseId={params.id}
                  count={3}
                  label="Generate 3 recommendations"
                />
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Pending first, then accepted/overridden */}
              {[...pendingRecs, ...acceptedRecs, ...overriddenRecs].map(
                (rec) => (
                  <RecommendationCard key={rec.id} recommendation={rec} />
                ),
              )}
            </div>
          )}
        </section>

        {/* Timeline */}
        <section aria-label="Event timeline">
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Timeline · {events.length} event{events.length === 1 ? "" : "s"}
          </h2>
          <CaseTimeline events={events} />
        </section>

        {/* Add event form */}
        <section aria-label="Add event">
          <EventForm caseId={params.id} />
        </section>
      </div>
    </div>
  );
}
