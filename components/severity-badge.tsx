import { cn } from "@/lib/utils";
import type { Severity } from "@/lib/data/types";

const SEVERITY_CONFIG: Record<
  Severity,
  { label: string; className: string; glow: string }
> = {
  1: {
    label: "Low",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    glow: "shadow-[0_0_8px_0_hsl(142_71%_45%/0.35)] bg-emerald-400",
  },
  2: {
    label: "Normal",
    className: "border-teal-500/30 bg-teal-500/10 text-teal-300",
    glow: "shadow-[0_0_8px_0_hsl(170_60%_45%/0.35)] bg-teal-400",
  },
  3: {
    label: "High",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    glow: "shadow-[0_0_10px_0_hsl(38_92%_50%/0.4)] bg-amber-400",
  },
  4: {
    label: "Critical",
    className: "border-red-500/30 bg-red-500/10 text-red-300",
    glow: "shadow-[0_0_12px_0_hsl(0_72%_51%/0.55)] bg-red-400",
  },
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
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.08em] font-medium",
        config.className,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("h-1.5 w-1.5 rounded-full", config.glow)}
      />
      <span className="tabular-nums">{severity}</span>
      <span className="opacity-70">·</span>
      <span>{config.label}</span>
    </span>
  );
}
