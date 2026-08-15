/* ─── People to contact ────────────────────────────────────────────────
 *  Prospective supervisors on an institution, programme officers on a
 *  funder. The one thing this component must communicate clearly is
 *  whether an address is safe to send to: an email with no source URL
 *  was not observed on an official page, and sending to a guessed
 *  address either bounces or reaches a stranger.
 * ────────────────────────────────────────────────────────────────────── */

import { Badge } from "@/components/ui/badge";
import {
  OUTREACH_PRIORITY_LABELS,
  emailIsVerified,
  type Contact,
} from "@/lib/data/fieldwork-types";
import { cn } from "@/lib/utils";

const PRIORITY_STYLE: Record<string, string> = {
  first_wave: "border-primary/40 text-primary",
  second_wave: "border-amber-500/40 text-amber-400",
  background: "border-border text-muted-foreground",
};

export function PeopleToContact({
  contacts,
  emptyHint,
}: {
  contacts: Contact[];
  emptyHint?: string;
}) {
  if (contacts.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {emptyHint ??
          "No named people yet. Ask the research agent to find prospective supervisors — outreach cannot start without a real person to write to."}
      </p>
    );
  }

  const sendable = contacts.filter(emailIsVerified).length;

  return (
    <div className="flex flex-col gap-3">
      <p className="font-mono text-[10px] text-muted-foreground">
        {contacts.length} {contacts.length === 1 ? "person" : "people"} ·{" "}
        {sendable} with a confirmed address
      </p>

      {contacts.map((c) => {
        const verified = emailIsVerified(c);
        return (
          <div
            key={c.id}
            className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">{c.name}</span>
              {c.outreach_priority && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[9px] uppercase tracking-wide",
                    PRIORITY_STYLE[c.outreach_priority],
                  )}
                >
                  {OUTREACH_PRIORITY_LABELS[c.outreach_priority]}
                </Badge>
              )}
            </div>

            {(c.title || c.organization) && (
              <p className="text-xs text-muted-foreground">
                {[c.title, c.organization].filter(Boolean).join(" · ")}
              </p>
            )}

            {c.research_focus && (
              <p className="text-xs leading-relaxed text-foreground/80">
                {c.research_focus}
              </p>
            )}

            {c.recent_work && (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                <span className="font-mono uppercase tracking-wide">Recent: </span>
                {c.recent_work}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[10px]">
              {verified ? (
                <>
                  <a
                    href={`mailto:${c.email}`}
                    className="font-mono text-primary underline underline-offset-2"
                  >
                    {c.email}
                  </a>
                  <a
                    href={c.email_source_url!}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    source ↗
                  </a>
                </>
              ) : c.email ? (
                <span className="rounded border border-destructive/40 px-1.5 py-0.5 font-mono text-destructive">
                  {c.email} — unverified, do not send
                </span>
              ) : (
                <span className="text-muted-foreground">
                  No address found — check the faculty page before writing
                </span>
              )}
            </div>

            {c.notes && (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {c.notes}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
