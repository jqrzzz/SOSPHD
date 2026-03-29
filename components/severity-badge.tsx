import { cn } from "@/lib/utils";
import type { Severity } from "@/lib/data/types";

const SEVERITY_CONFIG: Record<
  Severity,
  { label: string; className: string }
> = {
  1: { label: "Low", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
  2: { label: "Moderate", className: "bg-teal-500/15 text-teal-400 border-teal-500/25" },
  3: { label: "Elevated", className: "bg-amber-500/15 text-amber-400 border-amber-500/25" },
  4: { label: "High", className: "bg-orange-500/15 text-orange-400 border-orange-500/25" },
  5: { label: "Critical", className: "bg-red-500/15 text-red-400 border-red-500/25" },
};

export function SeverityBadge({
  severity,
  className,
}: {
  severity: Severity;
  className?: string;
}) {
  const config = SEVERITY_CONFIG[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        config.className,
        className,
      )}
    >
      {severity} - {config.label}
    </span>
  );
}
