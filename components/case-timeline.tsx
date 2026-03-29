import { cn, formatDate } from "@/lib/utils";
import type { CaseEvent, EventType } from "@/lib/data/types";
import { EVENT_TYPE_LABELS } from "@/lib/data/types";

const EVENT_TYPE_STYLES: Record<
  EventType,
  { dotColor: string; badgeClass: string }
> = {
  FIRST_CONTACT: {
    dotColor: "bg-blue-400",
    badgeClass: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  },
  TRIAGE_COMPLETE: {
    dotColor: "bg-sky-400",
    badgeClass: "bg-sky-500/15 text-sky-400 border-sky-500/25",
  },
  TRANSPORT_ACTIVATED: {
    dotColor: "bg-amber-400",
    badgeClass: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  },
  FACILITY_ARRIVAL: {
    dotColor: "bg-indigo-400",
    badgeClass: "bg-indigo-500/15 text-indigo-400 border-indigo-500/25",
  },
  GUARANTEED_PAYMENT: {
    dotColor: "bg-emerald-400",
    badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  },
  DEFINITIVE_CARE_START: {
    dotColor: "bg-teal-400",
    badgeClass: "bg-teal-500/15 text-teal-400 border-teal-500/25",
  },
  DISCHARGE: {
    dotColor: "bg-green-400",
    badgeClass: "bg-green-500/15 text-green-400 border-green-500/25",
  },
  NOTE: {
    dotColor: "bg-muted-foreground",
    badgeClass: "bg-secondary text-muted-foreground border-border",
  },
};

function formatTimestamp(iso: string): { date: string; time: string } {
  return {
    date: formatDate(iso, "long"),
    time: formatDate(iso, "time"),
  };
}

export function CaseTimeline({ events }: { events: CaseEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
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

        return (
          <li key={event.id} className="relative flex gap-4 pb-8 last:pb-0">
            {/* Vertical connector line */}
            {!isLast && (
              <div
                className="absolute left-[11px] top-6 h-full w-px bg-border"
                aria-hidden="true"
              />
            )}

            {/* Dot */}
            <div className="relative z-10 flex-shrink-0 pt-1">
              <div
                className={cn("h-[22px] w-[22px] rounded-full border-2 border-background flex items-center justify-center", style.dotColor)}
                aria-hidden="true"
              >
                <div className="h-2 w-2 rounded-full bg-background/30" />
              </div>
            </div>

            {/* Content */}
            <div className="flex flex-1 flex-col gap-1.5 pt-0.5">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                    style.badgeClass,
                  )}
                >
                  {EVENT_TYPE_LABELS[event.event_type]}
                </span>
                <span className="font-mono text-xs text-muted-foreground font-tabular">
                  {ts.date} {ts.time}
                </span>
              </div>

              {event.payload && (
                <p className="text-sm leading-relaxed text-foreground/80">
                  {event.payload}
                </p>
              )}

              <p className="text-xs text-muted-foreground">
                Actor: {event.actor_id}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
