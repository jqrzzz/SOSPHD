import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import type { MetricResult } from "@/lib/data/types";
import { formatDuration } from "@/lib/data/metrics";

export function MetricCard({ metric }: { metric: MetricResult }) {
  const hasValue = metric.value_ms !== null;
  const isComplete = hasValue && !metric.is_running;

  return (
    <Card
      className={cn(
        "relative overflow-hidden",
        isComplete && "border-emerald-500/25",
        metric.is_running && "border-amber-500/25",
      )}
    >
      {/* Status indicator strip */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-0.5",
          isComplete && "bg-emerald-500",
          metric.is_running && "bg-amber-500",
          !hasValue && "bg-muted-foreground/30",
        )}
        aria-hidden="true"
      />

      <CardContent className="flex flex-col gap-1 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {metric.abbreviation}
          </span>
          {metric.is_running && (
            <span className="flex items-center gap-1 text-xs text-amber-400">
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400"
                aria-hidden="true"
              />
              Running
            </span>
          )}
          {isComplete && (
            <span className="text-xs text-emerald-400">Complete</span>
          )}
        </div>

        <p
          className={cn(
            "font-mono text-2xl font-semibold font-tabular tracking-tight",
            isComplete && "text-foreground",
            metric.is_running && "text-amber-400",
            !hasValue && "text-muted-foreground",
          )}
        >
          {hasValue ? formatDuration(metric.value_ms) : "--"}
        </p>

        <p className="text-xs text-muted-foreground">{metric.description}</p>
      </CardContent>
    </Card>
  );
}
