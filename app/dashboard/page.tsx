import Link from "next/link";
import { getDashboardSummary, getCaseMetricRows } from "@/lib/data/analytics";
import { DashboardSummaryCards } from "@/components/dashboard-summary";
import { DashboardMetricChart } from "@/components/dashboard-metric-chart";
import { DashboardCaseTable } from "@/components/dashboard-case-table";
import { DashboardExport } from "@/components/dashboard-export";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CountUp } from "@/components/motion/count-up";
import { ProgressRing } from "@/components/motion/progress-ring";
import { StaggerContainer, StaggerItem } from "@/components/motion/stagger";
import { FadeIn } from "@/components/motion/fade-in";
import { getResearchPulse, suggestNextActions, detectGaps } from "@/lib/agent";

const HEALTH_LABEL: Record<string, string> = {
  strong: "Strong",
  good: "Good",
  "needs-attention": "Needs attention",
  "at-risk": "At risk",
};

const HEALTH_COLORS: Record<string, { text: string; from: string; to: string }> = {
  strong: {
    text: "text-emerald-400",
    from: "hsl(142 71% 45%)",
    to: "hsl(170 70% 50%)",
  },
  good: {
    text: "text-primary",
    from: "hsl(170 50% 38%)",
    to: "hsl(190 70% 50%)",
  },
  "needs-attention": {
    text: "text-amber-400",
    from: "hsl(38 92% 50%)",
    to: "hsl(25 95% 53%)",
  },
  "at-risk": {
    text: "text-red-400",
    from: "hsl(0 72% 51%)",
    to: "hsl(25 95% 53%)",
  },
};

const SEVERITY_STYLES: Record<string, string> = {
  high: "border-red-500/30 bg-red-500/10 text-red-300",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  low: "border-border bg-muted/30 text-muted-foreground",
};

const SEVERITY_DOT: Record<string, string> = {
  high: "bg-red-400 shadow-[0_0_12px_2px_hsl(0_72%_51%/0.5)]",
  medium: "bg-amber-400 shadow-[0_0_10px_2px_hsl(38_92%_50%/0.4)]",
  low: "bg-muted-foreground/60",
};

export default async function DashboardPage() {
  const [summary, rows, pulse, nextActions, gaps] = await Promise.all([
    getDashboardSummary(),
    getCaseMetricRows(),
    getResearchPulse(),
    suggestNextActions(5),
    detectGaps(),
  ]);

  const palette = HEALTH_COLORS[pulse.health] ?? HEALTH_COLORS.good;
  const [coverNum, coverDenom] = pulse.corridorCoverage.split("/").map(Number);
  const coveragePct =
    coverDenom > 0 ? Math.round((coverNum / coverDenom) * 100) : 0;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <PageHeader
        eyebrow="Phase 1 · Paper 1"
        title="Analytics Dashboard"
        description="TTDC, TTGP, and TTTA across all cases. The data here feeds directly into Paper 1 results."
        actions={rows.length > 0 ? <DashboardExport rows={rows} /> : null}
      />

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        {summary.total_cases === 0 ? (
          <FadeIn>
            <Card className="surface-lifted">
              <CardContent className="flex flex-col items-center gap-5 py-16">
                <div className="relative">
                  <div className="absolute inset-0 -z-10 rounded-full bg-primary/15 blur-2xl" />
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 to-primary/5 font-mono text-3xl text-primary/80">
                    0
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2 text-center">
                  <p className="text-base font-semibold text-foreground">
                    No case data yet
                  </p>
                  <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                    Once cases land here from the operational system, you'll
                    see TTTA / TTGP / TTDC computed, charted, and decomposed by
                    delay source.
                  </p>
                </div>
                <Button asChild size="sm">
                  <Link href="/cases/new">Create first case</Link>
                </Button>
              </CardContent>
            </Card>
          </FadeIn>
        ) : (
          <>
            {/* ── Hero: research health ring + supporting tiles ───────── */}
            <FadeIn>
              <Card className="surface-lifted overflow-hidden">
                <CardContent className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-[auto_1fr] sm:p-8">
                  <div className="flex items-center justify-center sm:justify-start">
                    <ProgressRing
                      value={pulse.score}
                      size={148}
                      stroke={10}
                      gradientFrom={palette.from}
                      gradientTo={palette.to}
                    >
                      <div className="flex flex-col items-center leading-none">
                        <span
                          className={`font-mono text-[44px] font-semibold tabular-nums tracking-tight ${palette.text}`}
                        >
                          <CountUp value={pulse.score} duration={1.4} />
                        </span>
                        <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                          score · /100
                        </span>
                      </div>
                    </ProgressRing>
                  </div>

                  <div className="flex flex-col justify-center gap-4">
                    <div>
                      <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-primary/90">
                        Research health
                      </span>
                      <h2 className="mt-3 text-balance text-xl font-semibold tracking-tight">
                        {HEALTH_LABEL[pulse.health] ?? pulse.health} —{" "}
                        <span className="text-muted-foreground">
                          {pulse.openTasks} open task
                          {pulse.openTasks === 1 ? "" : "s"},{" "}
                          {pulse.totalGaps} gap
                          {pulse.totalGaps === 1 ? "" : "s"} identified.
                        </span>
                      </h2>
                    </div>

                    <StaggerContainer
                      className="grid grid-cols-3 gap-3"
                      delay={0.2}
                    >
                      <StaggerItem>
                        <MiniStat
                          label="Corridors"
                          value={
                            <span className="font-mono tabular-nums">
                              <CountUp value={coverNum} duration={1} />
                              <span className="text-muted-foreground">
                                /{coverDenom}
                              </span>
                            </span>
                          }
                          sub={`${coveragePct}% covered`}
                          href="/dashboard/corridors"
                        />
                      </StaggerItem>
                      <StaggerItem>
                        <MiniStat
                          label="High-priority gaps"
                          value={
                            <CountUp
                              className="text-amber-400"
                              value={pulse.highPriorityGaps}
                              duration={1}
                            />
                          }
                          sub={`of ${pulse.totalGaps} total`}
                        />
                      </StaggerItem>
                      <StaggerItem>
                        <MiniStat
                          label="Open tasks"
                          value={
                            <CountUp value={pulse.openTasks} duration={1} />
                          }
                          sub="awaiting completion"
                        />
                      </StaggerItem>
                    </StaggerContainer>
                  </div>
                </CardContent>
              </Card>
            </FadeIn>

            {/* ── Suggested actions + gap breakdown ───────────────────── */}
            {(nextActions.length > 0 || gaps.totalGaps > 0) && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {nextActions.length > 0 && (
                  <Card>
                    <CardContent className="p-5">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">
                          Suggested next actions
                        </h3>
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                          AI agent
                        </span>
                      </div>
                      <StaggerContainer
                        className="flex flex-col gap-1.5"
                        stagger={0.05}
                      >
                        {nextActions.map((action, i) => (
                          <StaggerItem key={i}>
                            <div className="group flex items-start gap-3 rounded-lg border border-border/40 bg-background/40 px-3 py-2.5 transition-colors hover:border-border hover:bg-accent/30">
                              <span
                                aria-hidden="true"
                                className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${
                                  SEVERITY_DOT[action.severity] ??
                                  SEVERITY_DOT.low
                                }`}
                              />
                              <div className="flex min-w-0 flex-col gap-0.5">
                                <span className="text-sm leading-snug text-foreground">
                                  {action.action}
                                </span>
                                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                                  {action.area} ·{" "}
                                  <span
                                    className={
                                      action.severity === "high"
                                        ? "text-red-300"
                                        : action.severity === "medium"
                                          ? "text-amber-300"
                                          : "text-muted-foreground"
                                    }
                                  >
                                    {action.severity}
                                  </span>
                                </span>
                              </div>
                            </div>
                          </StaggerItem>
                        ))}
                      </StaggerContainer>
                    </CardContent>
                  </Card>
                )}

                {gaps.totalGaps > 0 && (
                  <Card>
                    <CardContent className="p-5">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">
                          Research gaps
                        </h3>
                        <Badge
                          variant="outline"
                          className="border-amber-500/30 bg-amber-500/10 font-mono text-[10px] tabular-nums text-amber-300"
                        >
                          {gaps.totalGaps} total
                        </Badge>
                      </div>
                      <div className="mb-4 flex flex-wrap gap-1.5">
                        {Object.entries(gaps.byArea).map(
                          ([area, count]) =>
                            count > 0 && (
                              <span
                                key={area}
                                className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2 py-0.5 text-xs"
                              >
                                <span className="font-mono uppercase tracking-[0.1em] text-muted-foreground/80">
                                  {area}
                                </span>
                                <span className="font-mono text-xs tabular-nums text-foreground">
                                  {count}
                                </span>
                              </span>
                            ),
                        )}
                      </div>
                      <div className="flex max-h-56 flex-col gap-2 overflow-auto pr-1">
                        {gaps.gaps.slice(0, 12).map((gap, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-2 text-xs leading-relaxed"
                          >
                            <span
                              aria-hidden="true"
                              className={`mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                                gap.severity === "high"
                                  ? "bg-red-400"
                                  : gap.severity === "medium"
                                    ? "bg-amber-400"
                                    : "bg-muted-foreground/60"
                              }`}
                            />
                            <span className="text-muted-foreground">
                              {gap.gap}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            <DashboardSummaryCards summary={summary} />
            <DashboardMetricChart rows={rows} />
            <DashboardCaseTable rows={rows} />
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
  href,
}: {
  label: string;
  value: React.ReactNode;
  sub: string;
  href?: string;
}) {
  const body = (
    <div className="flex h-full flex-col gap-1.5 rounded-lg border border-border/50 bg-background/40 p-3 transition-colors hover:border-border hover:bg-accent/30">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </span>
      <span className="text-[11px] text-muted-foreground/70">{sub}</span>
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}
