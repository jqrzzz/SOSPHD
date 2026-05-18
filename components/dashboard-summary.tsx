import { Card, CardContent } from "@/components/ui/card";
import type { DashboardSummary } from "@/lib/data/analytics";
import { formatDuration } from "@/lib/data/metrics";
import { CountUp } from "@/components/motion/count-up";

interface Props {
  summary: DashboardSummary;
}

const STAT_CARDS: {
  key: keyof DashboardSummary;
  label: string;
  accent: string;
  dot: string;
}[] = [
  {
    key: "total_cases",
    label: "Total Cases",
    accent: "text-foreground",
    dot: "bg-muted-foreground/40",
  },
  {
    key: "open_cases",
    label: "Open",
    accent: "text-[hsl(213_94%_56%)]",
    dot: "bg-[hsl(213_94%_56%)]",
  },
  {
    key: "active_cases",
    label: "Active",
    accent: "text-[hsl(38_92%_50%)]",
    dot: "bg-[hsl(38_92%_50%)]",
  },
  {
    key: "closed_cases",
    label: "Closed",
    accent: "text-[hsl(142_71%_45%)]",
    dot: "bg-[hsl(142_71%_45%)]",
  },
];

const METRIC_CARDS = [
  {
    key: "avg_ttta_ms",
    medianKey: "median_ttta_ms",
    label: "Avg TTTA",
    description: "Time to transport activation",
  },
  {
    key: "avg_ttgp_ms",
    medianKey: "median_ttgp_ms",
    label: "Avg TTGP",
    description: "Time to guaranteed payment",
  },
  {
    key: "avg_ttdc_ms",
    medianKey: "median_ttdc_ms",
    label: "Avg TTDC",
    description: "Time to definitive care",
  },
] as const;

export function DashboardSummaryCards({ summary }: Props) {
  return (
    <div className="flex flex-col gap-4">
      {/* Case counts row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STAT_CARDS.map((card) => (
          <Card key={card.key} className="lift">
            <CardContent className="flex flex-col gap-1.5 p-4">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`inline-block h-1.5 w-1.5 rounded-full ${card.dot}`}
                />
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {card.label}
                </span>
              </div>
              <span
                className={`font-mono text-3xl font-semibold tabular-nums tracking-tight ${card.accent}`}
              >
                <CountUp value={summary[card.key] as number} duration={1} />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Metric averages row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {METRIC_CARDS.map((card) => {
          const avgMs = summary[card.key];
          const medMs = summary[card.medianKey];
          return (
            <Card key={card.key} className="lift">
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {card.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">
                    median {medMs !== null ? formatDuration(medMs) : "--"}
                  </span>
                </div>
                <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                  {avgMs !== null ? formatDuration(avgMs) : "--"}
                </span>
                <span className="text-[11px] leading-tight text-muted-foreground/70">
                  {card.description}
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recommendation breakdown */}
      {summary.total_recommendations > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="lift">
            <CardContent className="flex flex-col gap-1.5 p-4">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                AI Recommendations
              </span>
              <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                <CountUp value={summary.total_recommendations} />
              </span>
            </CardContent>
          </Card>
          <Card className="lift">
            <CardContent className="flex flex-col gap-1.5 p-4">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Accepted
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-[hsl(142_71%_45%)]">
                  <CountUp value={summary.accepted_recommendations} />
                </span>
                <span className="text-xs text-muted-foreground">
                  {Math.round(
                    (summary.accepted_recommendations /
                      summary.total_recommendations) *
                      100,
                  )}
                  %
                </span>
              </div>
            </CardContent>
          </Card>
          <Card className="lift">
            <CardContent className="flex flex-col gap-1.5 p-4">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Overridden
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-[hsl(38_92%_50%)]">
                  <CountUp value={summary.overridden_recommendations} />
                </span>
                <span className="text-xs text-muted-foreground">
                  {Math.round(
                    (summary.overridden_recommendations /
                      summary.total_recommendations) *
                      100,
                  )}
                  %
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
