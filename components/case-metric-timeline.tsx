"use client";

import type { CaseEvent } from "@/lib/data/types";
import type { MetricResult } from "@/lib/data/types";
import { formatDuration } from "@/lib/data/metrics";

const METRIC_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  TTTA: { bg: "bg-amber-500/20", border: "border-amber-500/40", text: "text-amber-400", label: "TTTA" },
  TTGP: { bg: "bg-emerald-500/20", border: "border-emerald-500/40", text: "text-emerald-400", label: "TTGP" },
  TTDC: { bg: "bg-teal-500/20", border: "border-teal-500/40", text: "text-teal-400", label: "TTDC" },
};

const EVENT_LABELS: Record<string, string> = {
  FIRST_CONTACT: "First Contact",
  TRIAGE_COMPLETE: "Triage",
  TRANSPORT_ACTIVATED: "Transport",
  FACILITY_ARRIVAL: "Facility",
  GUARANTEED_PAYMENT: "Payment",
  DEFINITIVE_CARE_START: "Care Start",
  DISCHARGE: "Discharge",
  NOTE: "Note",
};

interface Props {
  events: CaseEvent[];
  metrics: MetricResult[];
}

export function CaseMetricTimeline({ events, metrics }: Props) {
  if (events.length < 2) return null;

  // Sort events chronologically
  const sorted = [...events]
    .filter((e) => e.event_type !== "NOTE")
    .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());

  if (sorted.length < 2) return null;

  const startTime = new Date(sorted[0].occurred_at).getTime();
  const endTime = new Date(sorted[sorted.length - 1].occurred_at).getTime();
  const totalSpan = endTime - startTime;

  if (totalSpan === 0) return null;

  // Build metric spans
  const metricSpans = metrics
    .filter((m) => m.value_ms !== null && m.from_event && m.to_event)
    .map((m) => {
      const fromEvent = sorted.find((e) => e.event_type === m.from_event);
      const toEvent = sorted.find((e) => e.event_type === m.to_event);
      if (!fromEvent || !toEvent) return null;

      const fromTime = new Date(fromEvent.occurred_at).getTime();
      const toTime = new Date(toEvent.occurred_at).getTime();

      return {
        abbreviation: m.abbreviation,
        leftPct: ((fromTime - startTime) / totalSpan) * 100,
        widthPct: ((toTime - fromTime) / totalSpan) * 100,
        value_ms: m.value_ms!,
        is_running: m.is_running,
      };
    })
    .filter(Boolean) as Array<{
    abbreviation: string;
    leftPct: number;
    widthPct: number;
    value_ms: number;
    is_running: boolean;
  }>;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Metric Timeline
      </h3>

      {/* Metric interval bars */}
      <div className="flex flex-col gap-2">
        {metricSpans.map((span) => {
          const color = METRIC_COLORS[span.abbreviation];
          if (!color) return null;
          return (
            <div key={span.abbreviation} className="flex items-center gap-3">
              <span className={`w-10 text-xs font-mono font-semibold ${color.text}`}>
                {color.label}
              </span>
              <div className="relative flex-1 h-6 rounded bg-muted/30">
                <div
                  className={`absolute top-0 h-full rounded border ${color.bg} ${color.border} flex items-center justify-center min-w-[40px]`}
                  style={{
                    left: `${span.leftPct}%`,
                    width: `${Math.max(span.widthPct, 3)}%`,
                  }}
                >
                  <span className={`text-[10px] font-mono font-medium ${color.text} whitespace-nowrap px-1`}>
                    {formatDuration(span.value_ms)}
                    {span.is_running ? " ..." : ""}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Event markers */}
      <div className="relative h-8 mt-1">
        <div className="absolute inset-x-0 top-3 h-px bg-border" />
        {sorted.map((event, i) => {
          const time = new Date(event.occurred_at).getTime();
          const leftPct = ((time - startTime) / totalSpan) * 100;
          const label = EVENT_LABELS[event.event_type] ?? event.event_type;

          return (
            <div
              key={event.id}
              className="absolute flex flex-col items-center"
              style={{ left: `${leftPct}%`, transform: "translateX(-50%)" }}
            >
              <div className="h-3 w-px bg-muted-foreground/50" />
              <div className="h-2 w-2 rounded-full bg-foreground/70" />
              <span
                className="mt-0.5 text-[9px] text-muted-foreground whitespace-nowrap"
                style={{
                  transform: i % 2 === 0 ? "none" : "translateY(10px)",
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 pt-1 text-[10px] text-muted-foreground">
        <span>
          Start: {new Date(sorted[0].occurred_at).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <span>
          End: {new Date(sorted[sorted.length - 1].occurred_at).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <span>Total span: {formatDuration(totalSpan)}</span>
      </div>
    </div>
  );
}
