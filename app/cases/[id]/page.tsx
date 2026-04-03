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
import { EventForm } from "@/components/event-form";
import { RecommendationCard } from "@/components/recommendation-card";
import { formatDate } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

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

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <header className="flex flex-col gap-3 border-b border-border px-6 py-4">
        <div className="flex items-center gap-4">
          <Link
            href="/cases"
            className="text-sm text-muted-foreground hover:text-foreground"
            aria-label="Back to cases"
          >
            &larr; Cases
          </Link>
          <Separator orientation="vertical" className="h-4" />
          <h1 className="font-mono text-lg font-semibold tracking-tight">
            {caseData.patient_ref}
          </h1>
          <SeverityBadge severity={caseData.severity} />
          <StatusBadge status={caseData.status} />
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {caseData.chief_complaint}
        </p>
        {caseData.notes && (
          <p className="max-w-2xl text-xs text-muted-foreground/70">
            {caseData.notes}
          </p>
        )}
        <p className="font-mono text-xs text-muted-foreground font-tabular">
          Created {formatDate(caseData.created_at, "datetime")}
        </p>
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-auto">
        <div className="flex flex-col gap-8 p-6">
          {/* Metric cards */}
          <section aria-label="Key metrics">
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
              Key Metrics
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {metrics.map((metric) => (
                <MetricCard key={metric.abbreviation} metric={metric} />
              ))}
            </div>
          </section>

          {/* AI Recommendations */}
          {recommendations.length > 0 && (
            <section aria-label="AI recommendations">
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
                AI Recommendations (Provenance)
              </h2>
              <div className="flex flex-col gap-3">
                {recommendations.map((rec) => (
                  <RecommendationCard key={rec.id} recommendation={rec} />
                ))}
              </div>
            </section>
          )}

          {/* Timeline */}
          <section aria-label="Event timeline">
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
              Timeline ({events.length} event{events.length !== 1 ? "s" : ""})
            </h2>
            <CaseTimeline events={events} />
          </section>

          {/* Add event form */}
          <section aria-label="Add event">
            <EventForm caseId={params.id} />
          </section>
        </div>
      </div>
    </div>
  );
}
