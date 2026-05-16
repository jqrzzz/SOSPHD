import Link from "next/link";
import { getPaper2Coordination } from "@/lib/data/analytics";
import { formatDate } from "@/lib/utils";
import { formatDuration } from "@/lib/data/metrics";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion/fade-in";
import { CountUp } from "@/components/motion/count-up";
import { ProgressRing } from "@/components/motion/progress-ring";
import { StaggerContainer, StaggerItem } from "@/components/motion/stagger";

function pct(value: number | null, digits = 0): string {
  if (value === null) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

function tier(rate: number | null): {
  ring: string;
  bar: string;
  text: string;
} {
  if (rate === null)
    return {
      ring: "border-border bg-muted/30 text-muted-foreground",
      bar: "from-muted to-muted/60",
      text: "text-muted-foreground",
    };
  const p = rate * 100;
  if (p >= 70)
    return {
      ring: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
      bar: "from-emerald-400 to-emerald-500",
      text: "text-emerald-300",
    };
  if (p >= 40)
    return {
      ring: "border-amber-500/30 bg-amber-500/10 text-amber-300",
      bar: "from-amber-400 to-amber-500",
      text: "text-amber-300",
    };
  return {
    ring: "border-red-500/30 bg-red-500/10 text-red-300",
    bar: "from-red-400 to-red-500",
    text: "text-red-300",
  };
}

export default async function Paper2DashboardPage() {
  const data = await getPaper2Coordination();
  const decided = data.accepted + data.overridden;
  const overallTier = tier(data.overall_accept_rate);
  const overallScore = data.overall_accept_rate === null
    ? 0
    : Math.round(data.overall_accept_rate * 100);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <PageHeader
        eyebrow="Phase 2 · Paper 2"
        title="Human-AI Coordination"
        description="Every AI recommendation, every operator decision, every override reason. This is the provenance figure-set Paper 2 cites."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/cases">Open cases →</Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        {data.total === 0 ? (
          <FadeIn>
            <Card className="surface-lifted">
              <CardContent className="flex flex-col items-center gap-5 py-16 text-center">
                <div className="relative">
                  <div className="absolute inset-0 -z-10 rounded-full bg-primary/15 blur-2xl" />
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 to-primary/5 font-mono text-3xl text-primary/80">
                    ◆
                  </div>
                </div>
                <div className="flex max-w-md flex-col gap-2">
                  <p className="text-base font-semibold text-foreground">
                    No coordination data yet
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Open a case and click{" "}
                    <span className="font-medium text-foreground">
                      Generate AI recommendations
                    </span>
                    . Each accept / override the operator makes becomes a row in
                    this dashboard.
                  </p>
                </div>
                <Button asChild size="sm">
                  <Link href="/cases">Go to cases</Link>
                </Button>
              </CardContent>
            </Card>
          </FadeIn>
        ) : (
          <>
            {/* ── Hero: acceptance rate ring + summary ─────────────────── */}
            <FadeIn>
              <Card className="surface-lifted overflow-hidden">
                <CardContent className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-[auto_1fr] sm:p-8">
                  <div className="flex items-center justify-center sm:justify-start">
                    <ProgressRing
                      value={overallScore}
                      size={148}
                      stroke={10}
                      gradientFrom={
                        overallScore >= 70
                          ? "hsl(142 71% 45%)"
                          : overallScore >= 40
                            ? "hsl(38 92% 50%)"
                            : "hsl(0 72% 51%)"
                      }
                      gradientTo={
                        overallScore >= 70
                          ? "hsl(170 70% 50%)"
                          : overallScore >= 40
                            ? "hsl(25 95% 53%)"
                            : "hsl(25 95% 53%)"
                      }
                    >
                      <div className="flex flex-col items-center leading-none">
                        <span
                          className={`font-mono text-[44px] font-semibold tabular-nums tracking-tight ${overallTier.text}`}
                        >
                          {data.overall_accept_rate === null ? (
                            "—"
                          ) : (
                            <>
                              <CountUp value={overallScore} duration={1.4} />
                              <span className="text-xl">%</span>
                            </>
                          )}
                        </span>
                        <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                          accept rate
                        </span>
                      </div>
                    </ProgressRing>
                  </div>

                  <div className="flex flex-col justify-center gap-4">
                    <div>
                      <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-primary/90">
                        Coordination summary
                      </span>
                      <h2 className="mt-3 text-balance text-xl font-semibold tracking-tight">
                        <CountUp value={data.total} /> recommendation
                        {data.total === 1 ? "" : "s"} across{" "}
                        <CountUp value={data.cases_with_recommendations} /> case
                        {data.cases_with_recommendations === 1 ? "" : "s"} —{" "}
                        <span className="text-muted-foreground">
                          {decided} decided, {data.pending} pending
                        </span>
                      </h2>
                    </div>

                    <StaggerContainer
                      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
                      delay={0.2}
                    >
                      <StaggerItem>
                        <MiniStat
                          label="Accepted"
                          value={
                            <span className="text-emerald-300">
                              <CountUp value={data.accepted} />
                            </span>
                          }
                          sub={`${pct(decided > 0 ? data.accepted / decided : null)} of decided`}
                        />
                      </StaggerItem>
                      <StaggerItem>
                        <MiniStat
                          label="Overridden"
                          value={
                            <span className="text-amber-300">
                              <CountUp value={data.overridden} />
                            </span>
                          }
                          sub={`${pct(decided > 0 ? data.overridden / decided : null)} of decided`}
                        />
                      </StaggerItem>
                      <StaggerItem>
                        <MiniStat
                          label="Avg confidence"
                          value={
                            <>
                              {data.avg_confidence === null
                                ? "—"
                                : (data.avg_confidence * 100).toFixed(0)}
                              <span className="text-xl">%</span>
                            </>
                          }
                          sub={`across ${data.unique_engines} engine${data.unique_engines === 1 ? "" : "s"}`}
                        />
                      </StaggerItem>
                      <StaggerItem>
                        <MiniStat
                          label="Median t-to-decision"
                          value={
                            data.median_time_to_decision_ms === null
                              ? "—"
                              : formatDuration(data.median_time_to_decision_ms)
                          }
                          sub={
                            data.avg_time_to_decision_ms === null
                              ? "no decisions yet"
                              : `avg ${formatDuration(data.avg_time_to_decision_ms)}`
                          }
                        />
                      </StaggerItem>
                    </StaggerContainer>
                  </div>
                </CardContent>
              </Card>
            </FadeIn>

            {/* ── Confidence calibration ───────────────────────────────── */}
            <FadeIn>
              <Card>
                <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      Confidence calibration
                    </h3>
                    <p className="max-w-md font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      acceptance rate by confidence bucket — does the AI know
                      when it&apos;s right?
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                    {data.by_confidence.map((b) => {
                      const t = tier(b.accept_rate);
                      const widthPct =
                        b.accept_rate === null
                          ? 0
                          : Math.round(b.accept_rate * 100);
                      return (
                        <div
                          key={b.label}
                          className="flex flex-col gap-2 rounded-lg border border-border/50 bg-background/40 p-3"
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                              {b.label}
                            </span>
                            <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
                              n={b.total}
                            </span>
                          </div>
                          <div
                            className={`font-mono text-2xl font-semibold tabular-nums ${t.text}`}
                          >
                            {b.accept_rate === null
                              ? "—"
                              : `${Math.round(b.accept_rate * 100)}%`}
                          </div>
                          <div className="relative h-1 overflow-hidden rounded-full bg-muted/60">
                            <div
                              className={`h-full bg-gradient-to-r transition-all ${t.bar}`}
                              style={{ width: `${widthPct}%` }}
                            />
                          </div>
                          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground/60">
                            {b.accepted}A · {b.overridden}O
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </FadeIn>

            {/* ── By engine_version ────────────────────────────────────── */}
            <FadeIn>
              <Card>
                <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      Engine breakdown
                    </h3>
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      acceptance rate, avg confidence &amp; time-to-decision per
                      engine version
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead>
                        <tr className="border-b border-border/60 text-left">
                          <th className="pb-2 pr-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                            Engine
                          </th>
                          <th className="pb-2 pr-3 text-right font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                            Total
                          </th>
                          <th className="pb-2 pr-3 text-right font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                            Accepted
                          </th>
                          <th className="pb-2 pr-3 text-right font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                            Overridden
                          </th>
                          <th className="pb-2 pr-3 text-right font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                            Accept rate
                          </th>
                          <th className="pb-2 pr-3 text-right font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                            Avg conf
                          </th>
                          <th className="pb-2 text-right font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                            Median t-to-d
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.by_engine.map((e) => {
                          const t = tier(e.accept_rate);
                          const widthPct =
                            e.accept_rate === null
                              ? 0
                              : Math.round(e.accept_rate * 100);
                          return (
                            <tr
                              key={e.engine_version}
                              className="border-b border-border/30 last:border-b-0"
                            >
                              <td className="py-2.5 pr-3 font-mono text-xs">
                                {e.engine_version}
                              </td>
                              <td className="py-2.5 pr-3 text-right tabular-nums text-foreground">
                                {e.total}
                              </td>
                              <td className="py-2.5 pr-3 text-right tabular-nums text-emerald-300/90">
                                {e.accepted}
                              </td>
                              <td className="py-2.5 pr-3 text-right tabular-nums text-amber-300/90">
                                {e.overridden}
                              </td>
                              <td className="py-2.5 pr-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="relative h-1 w-16 overflow-hidden rounded-full bg-muted/60">
                                    <div
                                      className={`h-full bg-gradient-to-r ${t.bar}`}
                                      style={{ width: `${widthPct}%` }}
                                    />
                                  </div>
                                  <span
                                    className={`font-mono tabular-nums ${t.text}`}
                                  >
                                    {pct(e.accept_rate)}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                                {(e.avg_confidence * 100).toFixed(0)}%
                              </td>
                              <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                                {e.avg_time_to_decision_ms === null
                                  ? "—"
                                  : formatDuration(e.avg_time_to_decision_ms)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </FadeIn>

            {/* ── Per-severity acceptance ──────────────────────────────── */}
            <FadeIn>
              <Card>
                <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      Acceptance by case severity
                    </h3>
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      does AI value depend on how acute the case is?
                    </p>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {data.by_severity.map((s) => {
                      const t = tier(s.accept_rate);
                      const widthPct =
                        s.accept_rate === null
                          ? 0
                          : Math.round(s.accept_rate * 100);
                      return (
                        <div
                          key={s.severity}
                          className="flex flex-col gap-2 rounded-lg border border-border/50 bg-background/40 p-3"
                        >
                          <div className="flex items-baseline justify-between">
                            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                              sev {s.severity}
                            </span>
                            <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
                              n={s.total}
                            </span>
                          </div>
                          <div
                            className={`font-mono text-xl font-semibold tabular-nums ${t.text}`}
                          >
                            {s.accept_rate === null
                              ? "—"
                              : `${Math.round(s.accept_rate * 100)}%`}
                          </div>
                          <div className="relative h-1 overflow-hidden rounded-full bg-muted/60">
                            <div
                              className={`h-full bg-gradient-to-r ${t.bar}`}
                              style={{ width: `${widthPct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </FadeIn>

            {/* ── Override reasons ─────────────────────────────────────── */}
            {data.override_reasons.length > 0 && (
              <FadeIn>
                <Card>
                  <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <h3 className="text-sm font-semibold text-foreground">
                        Recent overrides
                      </h3>
                      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        operator-supplied reasons — the qualitative thematic
                        layer
                      </p>
                    </div>
                    <ol className="flex flex-col gap-2">
                      {data.override_reasons.map((o, idx) => (
                        <li
                          key={idx}
                          className="rounded-lg border border-amber-500/15 bg-amber-500/5 p-3"
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <Link
                              href={`/cases/${o.case_id}`}
                              className="font-mono text-xs text-foreground/90 underline-offset-2 hover:underline"
                            >
                              {o.patient_ref}
                            </Link>
                            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground/70 tabular-nums">
                              {formatDate(o.decided_at, "datetime")} ·{" "}
                              {Math.round(o.confidence * 100)}% conf ·{" "}
                              {o.engine_version}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground/90">
                            <span className="text-muted-foreground/70">
                              AI suggested:
                            </span>{" "}
                            “{o.recommendation_text}”
                          </p>
                          <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">
                            <span className="font-medium text-amber-300">
                              Override:{" "}
                            </span>
                            {o.reason}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              </FadeIn>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub: string;
}) {
  return (
    <div className="flex h-full flex-col gap-1.5 rounded-lg border border-border/50 bg-background/40 p-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </span>
      <span className="text-[11px] text-muted-foreground/70">{sub}</span>
    </div>
  );
}
