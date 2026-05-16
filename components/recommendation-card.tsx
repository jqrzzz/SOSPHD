"use client";

import { useState, useTransition } from "react";
import { cn, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { decideRecommendationAction } from "@/lib/actions";
import { toast } from "sonner";
import type { Recommendation } from "@/lib/data/types";

const ENGINE_LABELS: Record<Recommendation["engine_type"], string> = {
  rule_based: "Rule Engine",
  ml_model: "ML Model",
  llm: "LLM",
};

function confidenceTier(value: number): {
  pct: number;
  label: string;
  ring: string;
  bar: string;
  text: string;
} {
  const pct = Math.round(value * 100);
  if (pct >= 80)
    return {
      pct,
      label: "High",
      ring: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
      bar: "from-emerald-400 to-emerald-500",
      text: "text-emerald-300",
    };
  if (pct >= 50)
    return {
      pct,
      label: "Medium",
      ring: "border-amber-500/30 bg-amber-500/10 text-amber-300",
      bar: "from-amber-400 to-amber-500",
      text: "text-amber-300",
    };
  return {
    pct,
    label: "Low",
    ring: "border-red-500/30 bg-red-500/10 text-red-300",
    bar: "from-red-400 to-red-500",
    text: "text-red-300",
  };
}

export function RecommendationCard({
  recommendation,
}: {
  recommendation: Recommendation;
}) {
  const conf = confidenceTier(recommendation.confidence_value);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const isPendingDecision = recommendation.accepted === null;

  function decide(decision: "accept" | "override", overrideReason?: string) {
    startTransition(async () => {
      const result = await decideRecommendationAction(
        recommendation.id,
        decision,
        overrideReason,
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        decision === "accept" ? "Recommendation accepted" : "Recommendation overridden",
      );
      setOverrideOpen(false);
      setReason("");
    });
  }

  return (
    <div
      className={cn(
        "surface-card relative overflow-hidden rounded-xl border p-4",
        isPendingDecision
          ? "border-primary/25"
          : recommendation.accepted
            ? "border-emerald-500/20"
            : "border-amber-500/20",
      )}
    >
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          <span className="text-foreground/90">
            {ENGINE_LABELS[recommendation.engine_type]}
          </span>
          <span aria-hidden="true">·</span>
          <span>{recommendation.engine_version}</span>
        </span>

        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]",
            conf.ring,
          )}
        >
          <span className="tabular-nums">{conf.pct}%</span>
          <span aria-hidden="true">·</span>
          <span>{conf.label}</span>
        </span>

        <div className="ml-auto">
          {recommendation.accepted === true && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-emerald-300">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-emerald-400"
              />
              Accepted
            </span>
          )}
          {recommendation.accepted === false && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-amber-300">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_0_hsl(38_92%_50%/0.5)]"
              />
              Overridden
            </span>
          )}
          {isPendingDecision && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-primary">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_0_hsl(170_50%_38%/0.6)]"
              />
              Pending
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <p className="mt-3 text-sm font-medium leading-snug text-foreground">
        {recommendation.recommendation}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
        {recommendation.explanation}
      </p>

      {/* Confidence meter */}
      <div className="mt-3 flex items-center gap-2">
        <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-muted/60">
          <div
            className={cn(
              "h-full rounded-full bg-gradient-to-r transition-all",
              conf.bar,
            )}
            style={{ width: `${conf.pct}%` }}
          />
        </div>
        <span className={cn("font-mono text-[10px] tabular-nums", conf.text)}>
          {conf.pct}%
        </span>
      </div>

      {/* Override reason (if set) */}
      {recommendation.override_reason && (
        <div className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-amber-300/80">
            Override reason
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-foreground/90">
            {recommendation.override_reason}
          </p>
        </div>
      )}

      {/* Pending-decision actions */}
      {isPendingDecision && (
        <div className="mt-4 flex items-center gap-2 border-t border-border/40 pt-3">
          <Button
            size="sm"
            onClick={() => decide("accept")}
            disabled={isPending}
          >
            {isPending ? "Saving…" : "Accept"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOverrideOpen(true)}
            disabled={isPending}
          >
            Override…
          </Button>
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground/60">
            ⏎ logs decision to timeline
          </span>
        </div>
      )}

      {/* Footer timestamp */}
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground/60">
        Created {formatDate(recommendation.created_at, "datetime")}
      </p>

      {/* Override dialog */}
      <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override recommendation</DialogTitle>
            <DialogDescription>
              Recording why you didn&apos;t take this action is the core
              provenance signal Paper 2 measures. Be specific.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="rounded-md border border-border/60 bg-muted/30 p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                AI suggested
              </p>
              <p className="mt-0.5 text-sm leading-snug text-foreground/90">
                {recommendation.recommendation}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="override-reason" className="text-xs">
                Reason for override
              </Label>
              <Textarea
                id="override-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="What did you do instead, and why? e.g. 'Patient already in transit via private vehicle; payer was contacted earlier.'"
                rows={4}
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOverrideOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => decide("override", reason)}
              disabled={isPending || !reason.trim()}
            >
              {isPending ? "Saving…" : "Record override"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
