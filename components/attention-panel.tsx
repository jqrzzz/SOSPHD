/* ─── Attention panel ──────────────────────────────────────────────────
 *  The app's answer to "what needs me right now" — so that knowing the
 *  state of the programme does not depend on remembering it, or on an
 *  agent reciting a list.
 *
 *  Ordered by when things bite, with blockers ahead of dated items:
 *  something that is ready except for one missing piece is usually more
 *  actionable than something due in four months.
 * ────────────────────────────────────────────────────────────────────── */

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { bandAttention, type AttentionItem } from "@/lib/data/attention-types";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<string, string> = {
  deadline: "Deadline",
  task: "Task",
  blocked: "Blocked",
  unverified: "Unverified",
};

function Row({ item, tone }: { item: AttentionItem; tone: string }) {
  return (
    <Link
      href={item.href}
      className="group flex items-start gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent/50"
    >
      <span
        className={cn(
          "mt-0.5 w-14 shrink-0 text-right font-mono text-[11px] font-semibold tabular-nums",
          tone,
        )}
      >
        {item.days === null
          ? "—"
          : item.days < 0
            ? `${Math.abs(item.days)}d ago`
            : `${item.days}d`}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm text-foreground group-hover:text-primary">
            {item.title}
          </span>
          <span className="shrink-0 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
            {KIND_LABEL[item.kind]}
          </span>
        </span>
        {item.detail && (
          <span className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
            {item.detail}
          </span>
        )}
      </span>
    </Link>
  );
}

function Section({
  title,
  items,
  tone,
}: {
  title: string;
  items: AttentionItem[];
  tone: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <p className="px-2 pb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {title}
        <span className="ml-2 text-foreground/60">{items.length}</span>
      </p>
      {items.map((i) => (
        <Row key={i.id} item={i} tone={tone} />
      ))}
    </div>
  );
}

export function AttentionPanel({ items }: { items: AttentionItem[] }) {
  const { overdue, blocked, undated, soon, ahead } = bandAttention(items);
  const nothing =
    overdue.length + blocked.length + undated.length + soon.length + ahead.length === 0;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-foreground">
            Needs attention
          </h2>
          <span className="font-mono text-[10px] text-muted-foreground">
            next 120 days · plus anything undated
          </span>
        </div>

        {nothing ? (
          <p className="px-2 text-xs text-muted-foreground">
            Nothing due in the next four months and nothing blocked.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <Section title="Passed" items={overdue} tone="text-destructive" />
            <Section title="Blocked" items={blocked} tone="text-amber-400" />
            <Section title="No date on file" items={undated} tone="text-amber-400" />
            <Section title="Within 30 days" items={soon} tone="text-destructive" />
            <Section title="Next four months" items={ahead} tone="text-muted-foreground" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
