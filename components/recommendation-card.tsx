import { cn, formatDate } from "@/lib/utils";
import type { Recommendation } from "@/lib/data/types";

export function RecommendationCard({
  recommendation,
}: {
  recommendation: Recommendation;
}) {
  const confidence = Math.round(recommendation.confidence_value * 100);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {recommendation.engine_type === "rule_based"
                ? "Rule Engine"
                : recommendation.engine_type === "ml_model"
                  ? "ML Model"
                  : "LLM"}{" "}
              {recommendation.engine_version}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                confidence >= 80
                  ? "border-emerald-500/25 bg-emerald-500/15 text-emerald-400"
                  : confidence >= 50
                    ? "border-amber-500/25 bg-amber-500/15 text-amber-400"
                    : "border-red-500/25 bg-red-500/15 text-red-400",
              )}
            >
              {confidence}% confidence
            </span>
          </div>
          <p className="text-sm font-medium text-foreground">
            {recommendation.recommendation}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {recommendation.explanation}
          </p>
        </div>

        <div className="flex-shrink-0">
          {recommendation.accepted === true && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
              Accepted
            </span>
          )}
          {recommendation.accepted === false && (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-500/25 bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400">
              Overridden
            </span>
          )}
          {recommendation.accepted === null && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Pending
            </span>
          )}
        </div>
      </div>

      {recommendation.override_reason && (
        <div className="mt-2 rounded-md border border-border bg-secondary/50 p-2">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Override reason:</span>{" "}
            {recommendation.override_reason}
          </p>
        </div>
      )}

      <p className="mt-2 font-mono text-xs text-muted-foreground font-tabular">
        {formatDate(recommendation.created_at, "datetime")}
      </p>
    </div>
  );
}
