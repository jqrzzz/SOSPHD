/* ─── Coverage panel — the things nobody has established ───────────────
 *  The requirements list answers "what do we know this school wants".
 *  This answers the more useful question: "what do we not know".
 *
 *  It leads with unknowns rather than progress, because a progress bar
 *  over recorded requirements is precisely the number that lets a
 *  half-researched application look finished. A school with three
 *  recorded requirements, all done, reads 100% ready and is not.
 * ────────────────────────────────────────────────────────────────────── */

import { Card, CardContent } from "@/components/ui/card";
import type { Coverage, CoverageItem } from "@/lib/data/admissions-coverage";
import { cn } from "@/lib/utils";

function LateBadge({ item }: { item: CoverageItem }) {
  if (item.behind !== true) return null;
  return (
    <span className="shrink-0 rounded bg-destructive/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-destructive">
      needs {item.canonical.leadDays}d
    </span>
  );
}

function Item({ item }: { item: CoverageItem }) {
  return (
    <li className="flex flex-col gap-1 rounded-md border border-border/60 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <span className="flex-1 text-sm text-foreground">
          {item.canonical.label}
        </span>
        <LateBadge item={item} />
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {item.canonical.why}
      </p>
    </li>
  );
}

function Group({
  title,
  hint,
  items,
  tone,
}: {
  title: string;
  hint: string;
  items: CoverageItem[];
  tone: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em]">
        <span className={tone}>{title}</span>
        <span className="ml-2 text-foreground/60">{items.length}</span>
      </p>
      <p className="-mt-1 text-[11px] leading-relaxed text-muted-foreground">
        {hint}
      </p>
      <ul className="flex flex-col gap-1.5">
        {items.map((i) => (
          <Item key={i.canonical.slug} item={i} />
        ))}
      </ul>
    </div>
  );
}

export function CoveragePanel({
  coverage,
  deadlineKnown,
}: {
  coverage: Coverage;
  deadlineKnown: boolean;
}) {
  const { unknown, unknownUniversal, items, coveragePct } = coverage;
  const conditional = unknown.filter(
    (i) => i.canonical.applicability === "conditional",
  );
  const established = items.length - unknown.length;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium text-foreground">
            What we have not established
          </h2>
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
            {established}/{items.length} known
          </span>
        </div>

        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className={cn(
              "h-full rounded-full",
              coveragePct >= 80
                ? "bg-primary"
                : coveragePct >= 40
                  ? "bg-amber-400"
                  : "bg-destructive",
            )}
            style={{ width: `${coveragePct}%` }}
          />
        </div>

        {!deadlineKnown && (
          <p className="rounded-md border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-[11px] leading-relaxed text-amber-200/90">
            No deadline on file, so nothing here can be told whether it is
            late. Establishing the date is worth more than any single item
            below — it is what makes the rest plannable.
          </p>
        )}

        {unknown.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Every item in the canonical set is established one way or the
            other. That is not the same as done — check the requirements list
            for what is still outstanding.
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            <Group
              title="Gaps"
              hint="Every research-degree application needs these. Nothing is on file either way, so the work has not even been scoped."
              items={unknownUniversal}
              tone="text-destructive"
            />
            <Group
              title="Open questions"
              hint="These apply to some schools or some applicants. Whether they apply here is unknown — and an unconfirmed exemption is not an exemption."
              items={conditional}
              tone="text-amber-400"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
