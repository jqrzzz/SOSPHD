import { cn } from "@/lib/utils";

/**
 * Standard page header pattern used across all top-level pages.
 *
 * Layout: thin eyebrow tag → large balanced title → soft description,
 * with optional actions on the right and a subtle bottom rule.
 *
 * The header inherits the ambient radial gradient from <body>, so it
 * reads as one piece with the page instead of a hard band.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  /** Small uppercase label above the title — e.g. "Phase 1 · Paper 1". */
  eyebrow?: React.ReactNode;
  /** The page title. Required. */
  title: React.ReactNode;
  /** One-line subtitle / context. */
  description?: React.ReactNode;
  /** Right-aligned actions (buttons, exports). */
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "relative isolate border-b border-border/60 px-4 pb-6 pt-6 sm:px-6 sm:pt-8",
        className,
      )}
    >
      {/* Subtle teal wash so the header feels lit from the brand color */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-32 bg-gradient-to-b from-primary/[0.06] via-transparent to-transparent"
      />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex max-w-2xl flex-col gap-2">
          {eyebrow && (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-primary/90">
              {eyebrow}
            </span>
          )}
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
            {title}
          </h1>
          {description && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </header>
  );
}
