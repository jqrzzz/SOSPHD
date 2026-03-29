import { Card, CardContent } from "@/components/ui/card";
import type { DashboardSummary } from "@/lib/data/analytics";
import { formatDuration } from "@/lib/data/metrics";

interface Props {
  summary: DashboardSummary;
}

const STAT_CARDS = [
  { key: "total_cases", label: "Total Cases", format: "number" },
  { key: "open_cases", label: "Open", format: "number" },
  { key: "active_cases", label: "Active", format: "number" },
  { key: "closed_cases", label: "Closed", format: "number" },
] as const;

const METRIC_CARDS = [
  {
    key: "avg_ttta_ms",
    medianKey: "median_ttta_ms",
    label: "Avg TTTA",
    medianLabel: "Median",
  },
  {
    key: "avg_ttgp_ms",
    medianKey: "median_ttgp_ms",
    label: "Avg TTGP",
    medianLabel: "Median",
  },
  {
    key: "avg_ttdc_ms",
    medianKey: "median_ttdc_ms",
    label: "Avg TTDC",
    medianLabel: "Median",
  },
] as const;

export function DashboardSummaryCards({ summary }: Props) {
  return (
    <div className="flex flex-col gap-4">
      {/* Case counts row */}
      <div className="grid grid-cols-4 gap-3">
        {STAT_CARDS.map((card) => (
          <Card key={card.key}>
            <CardContent className="flex flex-col gap-1 p-4">
              <span className="text-xs font-medium text-muted-foreground">
                {card.label}
              </span>
              <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                {summary[card.key]}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Metric averages row */}
      <div className="grid grid-cols-3 gap-3">
        {METRIC_CARDS.map((card) => {
          const avgMs = summary[card.key];
          const medMs = summary[card.medianKey];
          return (
            <Card key={card.key} className="border-border/50">
              <CardContent className="flex flex-col gap-1 p-4">
                <span className="text-xs font-medium text-muted-foreground">
                  {card.label}
                </span>
                <span className="font-mono text-xl font-semibold tabular-nums tracking-tight text-foreground">
                  {avgMs !== null ? formatDuration(avgMs) : "--"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {card.medianLabel}:{" "}
                  <span className="font-mono tabular-nums">
                    {medMs !== null ? formatDuration(medMs) : "--"}
                  </span>
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Provenance stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="flex flex-col gap-1 p-4">
            <span className="text-xs font-medium text-muted-foreground">
              AI Recommendations
            </span>
            <span className="font-mono text-xl font-semibold tabular-nums tracking-tight text-foreground">
              {summary.total_recommendations}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4">
            <span className="text-xs font-medium text-muted-foreground">
              Accepted
            </span>
            <span className="font-mono text-xl font-semibold tabular-nums tracking-tight text-[#2dd4a0]">
              {summary.accepted_recommendations}
            </span>
            {summary.total_recommendations > 0 && (
              <span className="text-xs text-muted-foreground">
                {Math.round(
                  (summary.accepted_recommendations /
                    summary.total_recommendations) *
                    100,
                )}
                %
              </span>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4">
            <span className="text-xs font-medium text-muted-foreground">
              Overridden
            </span>
            <span className="font-mono text-xl font-semibold tabular-nums tracking-tight text-[#f59e0b]">
              {summary.overridden_recommendations}
            </span>
            {summary.total_recommendations > 0 && (
              <span className="text-xs text-muted-foreground">
                {Math.round(
                  (summary.overridden_recommendations /
                    summary.total_recommendations) *
                    100,
                )}
                %
              </span>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
