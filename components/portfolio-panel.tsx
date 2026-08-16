/* ─── Portfolio panel — do this once, unblock several schools ──────────
 *  The per-school coverage view is honest and exhausting. It shows the
 *  same CV, the same transcripts and the same English test as separate
 *  unknowns at every school, so five applications read as sixty problems.
 *  Most of them are one piece of work each.
 *
 *  This is the leverage view: portfolio items collapsed into single
 *  actions, ordered by what should start today. Per-school work is
 *  deliberately absent — that genuinely is repeated and belongs on each
 *  school's own page.
 * ────────────────────────────────────────────────────────────────────── */

import { Card, CardContent } from "@/components/ui/card";
import type { PortfolioAction } from "@/lib/data/admissions-coverage";
import { cn } from "@/lib/utils";

function Action({ action }: { action: PortfolioAction }) {
  const { canonical, blocking, daysToEarliest, behind } = action;

  return (
    <li className="flex flex-col gap-1.5 rounded-md border border-border/60 px-3 py-3">
      <div className="flex items-start gap-3">
        <span className="flex-1 text-sm text-foreground">{canonical.label}</span>
        <span
          className={cn(
            "shrink-0 font-mono text-[10px] tabular-nums",
            behind ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {daysToEarliest === null
            ? `needs ${canonical.leadDays}d`
            : `${daysToEarliest}d left · needs ${canonical.leadDays}d`}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className={cn(
            "font-mono text-[10px] uppercase tracking-wide",
            blocking.length > 1 ? "text-primary" : "text-muted-foreground",
          )}
        >
          unblocks {blocking.length}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {blocking.map((b) => b.name).join(" · ")}
        </span>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {canonical.why}
      </p>
    </li>
  );
}

export function PortfolioPanel({ actions }: { actions: PortfolioAction[] }) {
  if (actions.length === 0) return null;
  const late = actions.filter((a) => a.behind).length;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium text-foreground">
            Produce once, serves every school
          </h2>
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
            {actions.length} action{actions.length === 1 ? "" : "s"}
            {late > 0 && (
              <span className="text-destructive"> · {late} already late</span>
            )}
          </span>
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          One CV, one set of transcripts, one test sitting. Each row is a
          single piece of work counted once, against the soonest deadline it
          would miss — not against any one school&apos;s. School-specific work
          — fees, forms, supervisor agreements, funding applications — stays
          on each school&apos;s page.
        </p>

        <ul className="flex flex-col gap-2">
          {actions.map((a) => (
            <Action key={a.canonical.slug} action={a} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
