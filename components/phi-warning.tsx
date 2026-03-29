import { Badge } from "@/components/ui/badge";

export function PhiWarning() {
  return (
    <div
      className="flex items-center gap-2 border-b border-status-active/20 bg-status-active/5 px-4 py-1.5"
      role="alert"
    >
      <ShieldIcon className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--status-active))]" />
      <span className="text-[11px] leading-tight text-[hsl(var(--status-active))]">
        All patient references are pseudonymized (patient_ref only). No real
        identifiers are stored or transmitted to the AI model.
      </span>
      <Badge
        variant="outline"
        className="ml-auto shrink-0 border-[hsl(var(--status-active))]/30 text-[9px] font-mono text-[hsl(var(--status-active))]"
      >
        PHI-SAFE
      </Badge>
    </div>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
