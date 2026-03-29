import { cn } from "@/lib/utils";
import type { CaseStatus } from "@/lib/data/types";

const STATUS_CONFIG: Record<
  CaseStatus,
  { label: string; className: string; dotClassName: string }
> = {
  open: {
    label: "Open",
    className: "bg-blue-500/15 text-blue-400 border-blue-500/25",
    dotClassName: "bg-blue-400",
  },
  active: {
    label: "Active",
    className: "bg-amber-500/15 text-amber-400 border-amber-500/25",
    dotClassName: "bg-amber-400",
  },
  closed: {
    label: "Closed",
    className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    dotClassName: "bg-emerald-400",
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
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        config.className,
        className,
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", config.dotClassName)}
        aria-hidden="true"
      />
      {config.label}
    </span>
  );
}
