import { cn, formatDate } from "@/lib/utils";
import type { CaseEvent, EventType } from "@/lib/data/types";
import { EVENT_TYPE_LABELS } from "@/lib/data/types";

const EVENT_TYPE_STYLES: Record<
  EventType,
  { dotColor: string; badgeClass: string }
> = {
  FIRST_CONTACT: {
    dotColor: "bg-blue-400 shadow-[0_0_10px_0_hsl(213_94%_56%/0.5)]",
    badgeClass: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  },
  TRIAGE_COMPLETE: {
    dotColor: "bg-sky-400 shadow-[0_0_10px_0_hsl(199_89%_48%/0.5)]",
    badgeClass: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  },
  TRANSPORT_ACTIVATED: {
    dotColor: "bg-amber-400 shadow-[0_0_10px_0_hsl(38_92%_50%/0.5)]",
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  },
  FACILITY_ARRIVAL: {
    dotColor: "bg-indigo-400 shadow-[0_0_10px_0_hsl(243_75%_59%/0.5)]",
    badgeClass: "border-indigo-500/30 bg-indigo-500/10 text-indigo-300",
  },
  GUARANTEED_PAYMENT: {
    dotColor: "bg-emerald-400 shadow-[0_0_10px_0_hsl(142_71%_45%/0.5)]",
    badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  },
  DEFINITIVE_CARE_START: {
    dotColor: "bg-teal-400 shadow-[0_0_10px_0_hsl(170_70%_50%/0.5)]",
    badgeClass: "border-teal-500/30 bg-teal-500/10 text-teal-300",
  },
  DISCHARGE: {
    dotColor: "bg-green-400 shadow-[0_0_10px_0_hsl(142_71%_45%/0.5)]",
    badgeClass: "border-green-500/30 bg-green-500/10 text-green-300",
  },
  NOTE: {
    dotColor: "bg-muted-foreground/70",
    badgeClass: "border-border bg-muted/40 text-muted-foreground",
  },
};

interface DecisionPayload {
  kind: "rec_decision";
  recommendation_id: string;
  engine_type: string;
  engine_version: string;
  confidence_value: number;
  decision: "accepted" | "overridden";
  override_reason: string | null;
  recommendation_text: string;
}

function tryParseDecision(payload: string): DecisionPayload | null {
  if (!payload || !payload.trim().startsWith("{")) return null;
  try {
    const parsed = JSON.parse(payload);
    if (parsed?.kind === "rec_decision") return parsed as DecisionPayload;
  } catch {
    /* fall through */
  }
  return null;
}

function formatTimestamp(iso: string): { date: string; time: string } {
  return {
    date: formatDate(iso, "long"),
    time: formatDate(iso, "time"),
  };
}

export function CaseTimeline({ events }: { events: CaseEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-card/30 px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          No events recorded yet.
        </p>
      </div>
    );
  }

  return (
    <ol className="relative flex flex-col" aria-label="Case event timeline">
      {events.map((event, index) => {
        const style = EVENT_TYPE_STYLES[event.event_type];
        const ts = formatTimestamp(event.occurred_at);
        const isLast = index === events.length - 1;
        const decision = tryParseDecision(event.payload);

        return (
          <li key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
            {!isLast && (
              <div
                className="absolute left-[10px] top-6 h-full w-px bg-gradient-to-b from-border to-border/40"
                aria-hidden="true"
              />
            )}

            <div className="relative z-10 flex-shrink-0 pt-1">
              <div
                className={cn(
                  "h-[20px] w-[20px] rounded-full border-2 border-background flex items-center justify-center",
                  style.dotColor,
                )}
                aria-hidden="true"
              >
                <div className="h-1.5 w-1.5 rounded-full bg-background/40" />
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-1.5 pt-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.08em] font-medium",
                    style.badgeClass,
                  )}
                >
                  {decision
                    ? `Decision · ${decision.decision}`
                    : EVENT_TYPE_LABELS[event.event_type]}
                </span>
                {event.payload.startsWith("Auto-synced:") && (
                  <span
                    title="Emitted by SOSCOMMAND → research DB trigger"
                    className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-primary/90"
                  >
                    <span
                      aria-hidden="true"
                      className="h-1 w-1 rounded-full bg-primary"
                    />
                    soscommand
                  </span>
                )}
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground tabular-nums">
                  {ts.date} · {ts.time}
                </span>
              </div>

              {decision ? (
                <div
                  className={cn(
                    "rounded-lg border px-3 py-2",
                    decision.decision === "accepted"
                      ? "border-emerald-500/25 bg-emerald-500/5"
                      : "border-amber-500/25 bg-amber-500/5",
                  )}
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {decision.engine_type} · {decision.engine_version} ·{" "}
                    {Math.round(decision.confidence_value * 100)}% confidence
                  </p>
                  <p className="mt-0.5 text-sm leading-snug text-foreground/90">
                    “{decision.recommendation_text}”
                  </p>
                  {decision.override_reason && (
                    <p className="mt-1.5 text-xs leading-relaxed text-amber-200/90">
                      <span className="font-medium text-amber-300">
                        Override:{" "}
                      </span>
                      {decision.override_reason}
                    </p>
                  )}
                </div>
              ) : (
                event.payload && (
                  <p className="text-sm leading-relaxed text-foreground/85">
                    {event.payload}
                  </p>
                )
              )}

              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground/60">
                Actor · {event.actor_id}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
