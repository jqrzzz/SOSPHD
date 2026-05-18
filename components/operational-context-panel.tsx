import { cn, formatDate } from "@/lib/utils";
import type {
  OperationalContext,
  OperationalGOP,
  OperationalClaim,
  OperationalStatusChange,
  OperationalActivity,
  OperationalInsurerInteraction,
} from "@/lib/data/store";

/**
 * Operational Context · SOSCOMMAND
 *
 * Read-only surface for the SOSCOMMAND-owned operational tables that
 * sit alongside the SOSPHD research event stream. SOSPHD never writes
 * to these tables (per CLAUDE.md ownership rules); this panel just
 * mirrors what SOSCOMMAND has recorded so the research view stays
 * coherent with operational truth.
 *
 * If a case has no operational data at all (e.g. research-only test
 * cases created via /cases/new), the panel collapses to an empty
 * state and surfaces nothing else.
 */
export function OperationalContextPanel({ ctx }: { ctx: OperationalContext }) {
  if (!ctx.has_data) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-card/30 px-5 py-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Operational context · SOSCOMMAND
          </h3>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
            no operational data
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          This case has no entries in SOSCOMMAND&apos;s operational tables (status
          history, transport, GOP, claims, insurer interactions). When the
          operational system records activity here, it surfaces below — SOSPHD
          reads only, never writes.
        </p>
      </div>
    );
  }

  const sections: { count: number; label: string }[] = [
    { count: ctx.status_history.length, label: "status changes" },
    { count: ctx.activity.length, label: "activity entries" },
    { count: ctx.transport ? 1 : 0, label: "transport record" },
    { count: ctx.gops.length, label: "GOPs" },
    { count: ctx.insurer_interactions.length, label: "payer interactions" },
    { count: ctx.claims.length, label: "claims" },
  ].filter((s) => s.count > 0);

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Operational context · SOSCOMMAND
        </h3>
        <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/80">
          {sections.map((s) => (
            <span
              key={s.label}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/30 px-2 py-0.5"
            >
              <span className="tabular-nums text-foreground/85">{s.count}</span>
              <span>{s.label}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {ctx.transport && <TransportRow transport={ctx.transport} />}
        {ctx.gops.length > 0 && <GopList gops={ctx.gops} />}
        {ctx.status_history.length > 0 && (
          <StatusHistoryRow history={ctx.status_history} />
        )}
        {ctx.insurer_interactions.length > 0 && (
          <InsurerInteractionsRow interactions={ctx.insurer_interactions} />
        )}
        {ctx.claims.length > 0 && <ClaimList claims={ctx.claims} />}
        {ctx.activity.length > 0 && <ActivityRow activity={ctx.activity} />}
      </div>

      <p className="mt-4 border-t border-border/40 pt-3 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground/60">
        Read-only · SOSPHD reads from <code className="text-muted-foreground/80">public.*</code> but never writes.
      </p>
    </div>
  );
}

// ── Sub-sections ─────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h4 className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80">
        {title}
      </h4>
      {children}
    </section>
  );
}

function formatMoney(
  amount: number | null,
  currency: string | null,
): string {
  if (amount === null) return "—";
  const cur = (currency ?? "USD").trim();
  return `${cur} ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatDateMaybe(value: string | null, kind: "datetime" | "long" = "long") {
  if (!value) return "—";
  return formatDate(value, kind);
}

function TransportRow({
  transport,
}: {
  transport: NonNullable<OperationalContext["transport"]>;
}) {
  const departed = !!transport.actual_departure;
  const arrived = !!transport.actual_arrival;
  return (
    <Section title="Transport">
      <div className="rounded-lg border border-border/40 bg-background/40 p-3">
        <div className="flex flex-wrap items-center gap-2">
          {transport.mode && (
            <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-amber-300">
              {transport.mode}
            </span>
          )}
          {transport.transport_status && (
            <span className="inline-flex items-center rounded-full border border-border/40 bg-muted/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {transport.transport_status}
            </span>
          )}
          {transport.transport_provider && (
            <span className="font-mono text-[11px] text-muted-foreground">
              {transport.transport_provider}
            </span>
          )}
          {transport.booking_reference && (
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
              ref · {transport.booking_reference}
            </span>
          )}
        </div>

        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              From
            </p>
            <p className="text-sm text-foreground/90">
              {transport.origin_facility ??
                transport.origin_location ??
                "—"}
            </p>
            <p
              className={cn(
                "font-mono text-[10px] uppercase tracking-[0.08em] tabular-nums",
                departed ? "text-emerald-300/80" : "text-muted-foreground/60",
              )}
            >
              {departed
                ? `departed · ${formatDateMaybe(transport.actual_departure, "datetime")}`
                : "not yet departed"}
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              To
            </p>
            <p className="text-sm text-foreground/90">
              {transport.destination_facility ??
                transport.destination_location ??
                "—"}
            </p>
            <p
              className={cn(
                "font-mono text-[10px] uppercase tracking-[0.08em] tabular-nums",
                arrived ? "text-emerald-300/80" : "text-muted-foreground/60",
              )}
            >
              {arrived
                ? `arrived · ${formatDateMaybe(transport.actual_arrival, "datetime")}`
                : "not yet arrived"}
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}

function GopList({ gops }: { gops: OperationalGOP[] }) {
  return (
    <Section title="Guarantees of payment">
      <div className="flex flex-col gap-2">
        {gops.map((g, i) => {
          const isIssued = !!g.issued_date;
          return (
            <div
              key={i}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-border/40 bg-background/40 px-3 py-2"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-xs text-foreground/90">
                  {g.gop_number ?? "—"}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]",
                    isIssued
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-300",
                  )}
                >
                  {g.status}
                </span>
              </div>
              <div className="flex flex-wrap items-baseline gap-3 font-mono text-[10px] tabular-nums text-muted-foreground">
                <span>
                  req {formatMoney(g.amount_requested, g.currency)}
                </span>
                <span className="text-foreground/85">
                  gtd {formatMoney(g.amount_guaranteed, g.currency)}
                </span>
                <span>
                  {g.issued_date
                    ? `issued ${formatDateMaybe(g.issued_date)}`
                    : `req ${formatDateMaybe(g.requested_date)}`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function StatusHistoryRow({
  history,
}: {
  history: OperationalStatusChange[];
}) {
  return (
    <Section title="Status history">
      <ol className="flex flex-col gap-1.5">
        {history.map((h, i) => (
          <li
            key={i}
            className="flex flex-wrap items-baseline gap-2 rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-xs"
          >
            <span className="inline-flex items-center gap-1.5 font-mono text-muted-foreground">
              <span className="text-muted-foreground/60">
                {h.from_status ?? "∅"}
              </span>
              <span aria-hidden="true">→</span>
              <span className="text-foreground/90">{h.to_status}</span>
            </span>
            <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground/70 tabular-nums">
              {formatDateMaybe(h.changed_at, "datetime")}
            </span>
            {h.reason && (
              <p className="basis-full pt-1 text-xs text-muted-foreground/85">
                {h.reason}
              </p>
            )}
          </li>
        ))}
      </ol>
    </Section>
  );
}

function InsurerInteractionsRow({
  interactions,
}: {
  interactions: OperationalInsurerInteraction[];
}) {
  return (
    <Section title="Payer interactions">
      <ol className="flex flex-col gap-1.5">
        {interactions.map((it, i) => (
          <li
            key={i}
            className="flex flex-wrap items-baseline gap-2 rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-xs"
          >
            <span className="inline-flex items-center rounded-full border border-border/40 bg-muted/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {it.interaction_type}
            </span>
            {it.reference_number && (
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/80">
                ref {it.reference_number}
              </span>
            )}
            {it.amount !== null && (
              <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                {formatMoney(it.amount, it.currency)}
              </span>
            )}
            {it.status && (
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/80">
                {it.status}
              </span>
            )}
            <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground/70 tabular-nums">
              {formatDateMaybe(it.occurred_at, "datetime")}
            </span>
            {it.notes && (
              <p className="basis-full pt-1 text-xs text-muted-foreground/85">
                {it.notes}
              </p>
            )}
          </li>
        ))}
      </ol>
    </Section>
  );
}

function ClaimList({ claims }: { claims: OperationalClaim[] }) {
  return (
    <Section title="Claims">
      <div className="flex flex-col gap-2">
        {claims.map((c, i) => (
          <div
            key={i}
            className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-border/40 bg-background/40 px-3 py-2"
          >
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-mono text-xs text-foreground/90">
                {c.claim_number ?? "—"}
              </span>
              <span className="inline-flex items-center rounded-full border border-border/40 bg-muted/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {c.status}
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-3 font-mono text-[10px] tabular-nums text-muted-foreground">
              <span>req {formatMoney(c.amount_requested, c.currency)}</span>
              <span>appr {formatMoney(c.amount_approved, c.currency)}</span>
              <span className="text-foreground/85">
                paid {formatMoney(c.amount_paid, c.currency)}
              </span>
              <span>
                {c.paid_at
                  ? `paid ${formatDateMaybe(c.paid_at, "long")}`
                  : c.decision_date
                    ? `decision ${formatDateMaybe(c.decision_date)}`
                    : c.submitted_date
                      ? `submitted ${formatDateMaybe(c.submitted_date)}`
                      : "—"}
              </span>
            </div>
            {c.denial_reason && (
              <p className="basis-full pt-1 text-xs text-red-300/85">
                <span className="font-medium">Denial:</span> {c.denial_reason}
              </p>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

function ActivityRow({ activity }: { activity: OperationalActivity[] }) {
  return (
    <Section title="Recent activity">
      <ol className="flex flex-col gap-1.5">
        {activity.map((a, i) => (
          <li
            key={i}
            className="flex flex-wrap items-baseline gap-2 rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-xs"
          >
            <span className="text-foreground/90">{a.action}</span>
            {a.actor_name && (
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/80">
                · {a.actor_name}
              </span>
            )}
            <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground/70 tabular-nums">
              {formatDateMaybe(a.created_at, "datetime")}
            </span>
          </li>
        ))}
      </ol>
    </Section>
  );
}
