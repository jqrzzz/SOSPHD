import { cn } from "@/lib/utils";
import type { CaseStatus } from "@/lib/data/types";

const STATUS_CONFIG: Record<
  CaseStatus,
  { label: string; className: string; dot: string }
> = {
  open: {
    label: "Open",
    className: "border-blue-500/30 bg-blue-500/10 text-blue-300",
    dot: "bg-blue-400 shadow-[0_0_8px_0_hsl(213_94%_56%/0.4)]",
  },
  active: {
    label: "Active",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    dot: "bg-amber-400 shadow-[0_0_8px_0_hsl(38_92%_50%/0.4)]",
  },
  closed: {
    label: "Closed",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    dot: "bg-emerald-400",
  },
};

export function StatusBadge({
  status,
  className,
}: {
  status: CaseStatus;
  className?: string;
}) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.08em] font-medium",
        config.className,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("h-1.5 w-1.5 rounded-full", config.dot)}
      />
      {config.label}
    </span>
  );
}
