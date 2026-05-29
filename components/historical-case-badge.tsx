import { cn } from "@/lib/utils";

/**
 * Marks a case as research-historical (backfilled 2018–2023) vs
 * live-operational. Rendered only when source === "historical" so
 * operational cases stay visually clean.
 */
export function HistoricalCaseBadge({ className }: { className?: string }) {
  return (
    <span
      title="Historical case from the 2018–2023 backfill, not from live operational data."
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.08em] font-medium text-purple-300",
        className,
      )}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-purple-400" />
      Historical
    </span>
  );
}
