import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/page-header";
import { CountUp } from "@/components/motion/count-up";
import { ProgressRing } from "@/components/motion/progress-ring";
import { StaggerContainer, StaggerItem } from "@/components/motion/stagger";
import { FadeIn } from "@/components/motion/fade-in";
import {
  PHD_PHASES,
  OPEN_QUESTIONS,
  getPhaseProgress,
  getOverallProgress,
  getNextStep,
  getUnresolvedQuestions,
} from "@/lib/data/phd-spine";
import type { StepStatus } from "@/lib/data/phd-spine";
import { suggestNextActions, getResearchPulse } from "@/lib/agent";

/* ── Status helpers ───────────────────────────────────────────── */

const STATUS_STYLES: Record<
  StepStatus,
  { label: string; className: string; dot: string }
> = {
  done: {
    label: "Done",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    dot: "bg-emerald-400",
  },
  in_progress: {
    label: "In progress",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    dot: "bg-amber-400 shadow-[0_0_10px_2px_hsl(38_92%_50%/0.5)]",
  },
  next: {
    label: "Up next",
    className: "border-primary/30 bg-primary/10 text-primary",
    dot: "bg-primary shadow-[0_0_10px_2px_hsl(170_50%_38%/0.5)]",
  },
  pending: {
    label: "Pending",
    className: "border-border bg-muted/30 text-muted-foreground",
    dot: "bg-muted-foreground/40",
  },
};

const SEVERITY_DOT: Record<string, string> = {
  high: "bg-red-400 shadow-[0_0_12px_2px_hsl(0_72%_51%/0.5)]",
  medium: "bg-amber-400 shadow-[0_0_10px_2px_hsl(38_92%_50%/0.4)]",
  low: "bg-muted-foreground/60",
};

const HEALTH_PALETTE: Record<
  string,
  { from: string; to: string; text: string; label: string }
> = {
  strong: {
    from: "hsl(142 71% 45%)",
    to: "hsl(170 70% 50%)",
    text: "text-emerald-400",
    label: "Strong",
  },
  good: {
    from: "hsl(170 50% 38%)",
    to: "hsl(190 70% 50%)",
    text: "text-primary",
    label: "Good",
  },
  "needs-attention": {
    from: "hsl(38 92% 50%)",
    to: "hsl(25 95% 53%)",
    text: "text-amber-400",
    label: "Needs attention",
  },
  "at-risk": {
    from: "hsl(0 72% 51%)",
    to: "hsl(25 95% 53%)",
    text: "text-red-400",
    label: "At risk",
  },
};

/* ── Page ─────────────────────────────────────────────────────── */

export default async function SpinePage() {
  const overall = getOverallProgress();
  const nextStep = getNextStep();
  const unresolvedQuestions = getUnresolvedQuestions();

  const [nextActions, pulse] = await Promise.all([
    suggestNextActions(3),
    getResearchPulse(),
  ]);

  const health = HEALTH_PALETTE[pulse.health] ?? HEALTH_PALETTE.good;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <PageHeader
        eyebrow="PhD program · spine"
        title="Where the research stands today."
        description="Phases, steps, and the definitional questions that gate the codebook. Every PhD-shaped decision lives here."
      />

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        {/* ── Hero: overall progress ring + key facts ──────────────── */}
        <FadeIn>
          <Card className="surface-lifted overflow-hidden">
            <CardContent className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-[auto_1fr] sm:p-8">
              <div className="flex items-center justify-center sm:justify-start">
                <ProgressRing
                  value={overall.percent}
                  size={156}
                  stroke={10}
                  gradientFrom="hsl(170 50% 38%)"
                  gradientTo="hsl(190 70% 50%)"
                >
                  <div className="flex flex-col items-center leading-none">
                    <span className="font-mono text-[44px] font-semibold tabular-nums tracking-tight text-foreground">
                      <CountUp value={overall.percent} duration={1.4} />
                      <span className="text-muted-foreground/60">%</span>
                    </span>
                    <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                      {overall.done} of {overall.total} steps
                    </span>
                  </div>
                </ProgressRing>
              </div>

              <div className="flex flex-col justify-center gap-4">
                <div>
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-primary/90">
                    Overall progress
                  </span>
                  {nextStep ? (
                    <h2 className="mt-3 text-balance text-xl font-semibold leading-snug tracking-tight">
                      Next up:{" "}
                      <span className="text-primary">{nextStep.label}</span>
                      <span className="text-muted-foreground"> — </span>
                      <span className="text-muted-foreground">
                        {nextStep.description}
                      </span>
                    </h2>
                  ) : (
                    <h2 className="mt-3 text-balance text-xl font-semibold leading-snug tracking-tight">
                      All steps complete.
                    </h2>
                  )}
                </div>

                <StaggerContainer
                  className="grid grid-cols-1 gap-3 sm:grid-cols-3"
                  delay={0.2}
                >
                  <StaggerItem>
                    <MiniStat
                      label="Open questions"
                      value={
                        <CountUp
                          className="text-amber-400"
                          value={unresolvedQuestions.length}
                        />
                      }
                      sub="Definitions to lock"
                    />
                  </StaggerItem>
                  <StaggerItem>
                    <MiniStat
                      label="Research health"
                      value={
                        <span className={health.text}>
                          <CountUp value={pulse.score} duration={1} />
                        </span>
                      }
                      sub={health.label}
                    />
                  </StaggerItem>
                  <StaggerItem>
                    <MiniStat
                      label="Corridor coverage"
                      value={
                        <span className="font-mono tabular-nums">
                          {pulse.corridorCoverage}
                        </span>
                      }
                      sub={`${pulse.highPriorityGaps} high-priority gap${pulse.highPriorityGaps === 1 ? "" : "s"}`}
                    />
                  </StaggerItem>
                </StaggerContainer>
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        {/* ── AI Suggested Actions ───────────────────────────── */}
        {nextActions.length > 0 && (
          <FadeIn delay={0.1}>
            <Card>
              <CardContent className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">
                    What to do next
                  </h3>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    AI agent
                  </span>
                </div>
                <StaggerContainer className="flex flex-col gap-1.5" stagger={0.05}>
                  {nextActions.map((action, i) => (
                    <StaggerItem key={i}>
                      <div className="group flex items-start gap-3 rounded-lg border border-border/40 bg-background/40 px-3 py-2.5 transition-colors hover:border-border hover:bg-accent/30">
                        <span
                          aria-hidden="true"
                          className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${
                            SEVERITY_DOT[action.severity] ?? SEVERITY_DOT.low
                          }`}
                        />
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-sm leading-snug text-foreground">
                            {action.action}
                          </span>
                          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                            {action.area}
                          </span>
                        </div>
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerContainer>
              </CardContent>
            </Card>
          </FadeIn>
        )}

        {/* ── Phases ──────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <h2 className="px-1 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Research phases
          </h2>

          <StaggerContainer className="flex flex-col gap-3" stagger={0.07}>
            {PHD_PHASES.map((phase) => {
              const progress = getPhaseProgress(phase);
              const isComplete = progress.percent === 100;
              return (
                <StaggerItem key={phase.id}>
                  <Card className="lift">
                    <CardContent className="flex flex-col gap-4 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-semibold text-foreground">
                            {phase.label}
                          </span>
                          <span className="text-xs leading-relaxed text-muted-foreground">
                            {phase.summary}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-xs tabular-nums">
                          <span
                            className={
                              isComplete
                                ? "text-emerald-400"
                                : "text-foreground"
                            }
                          >
                            {progress.done}/{progress.total}
                          </span>
                          <span className="text-muted-foreground">
                            · {progress.percent}%
                          </span>
                        </div>
                      </div>

                      <Progress value={progress.percent} className="h-1" />

                      <div className="flex flex-col gap-1.5">
                        {phase.steps.map((step) => {
                          const style = STATUS_STYLES[step.status];
                          return (
                            <div
                              key={step.id}
                              className="flex items-start gap-3 rounded-lg border border-border/40 bg-background/30 px-3 py-2.5 transition-colors hover:border-border/80"
                            >
                              <span
                                aria-hidden="true"
                                className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${style.dot}`}
                              />
                              <div className="flex flex-1 flex-col gap-0.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-medium leading-tight">
                                    {step.label}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${style.className}`}
                                  >
                                    {style.label}
                                  </Badge>
                                </div>
                                <span className="text-xs leading-relaxed text-muted-foreground">
                                  {step.description}
                                </span>
                                {step.deliverable && (
                                  <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-primary/80">
                                    ↳ {step.deliverable}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        </div>

        {/* ── Open Questions ──────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Open questions
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {unresolvedQuestions.length} unresolved · {OPEN_QUESTIONS.length - unresolvedQuestions.length} answered
            </span>
          </div>
          <p className="px-1 text-xs leading-relaxed text-muted-foreground">
            These definitional decisions must be resolved before the codebook is
            final and prospective data collection can begin.
          </p>

          <StaggerContainer className="grid grid-cols-1 gap-3 lg:grid-cols-2" stagger={0.04}>
            {OPEN_QUESTIONS.map((q) => {
              const resolved = !!q.answer;
              return (
                <StaggerItem key={q.id}>
                  <Card
                    className={`lift h-full ${
                      resolved
                        ? "border-emerald-500/20"
                        : "border-amber-500/15"
                    }`}
                  >
                    <CardContent className="flex h-full flex-col gap-2 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-sm font-medium leading-tight">
                          {q.label}
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            resolved
                              ? "shrink-0 border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-300"
                              : "shrink-0 border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-300"
                          }
                        >
                          {resolved ? "Resolved" : "Open"}
                        </Badge>
                      </div>
                      <span className="text-xs leading-relaxed text-muted-foreground">
                        {q.question}
                      </span>
                      {q.options && !resolved && (
                        <ul className="flex flex-col gap-1 pl-3">
                          {q.options.map((opt, i) => (
                            <li
                              key={i}
                              className="text-xs text-muted-foreground/80 before:mr-1.5 before:content-['•']"
                            >
                              {opt}
                            </li>
                          ))}
                        </ul>
                      )}
                      <span className="mt-auto pt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/60">
                        Source · {q.source}
                      </span>
                      {q.answer && (
                        <div className="mt-1 rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-3 py-2">
                          <span className="text-xs leading-relaxed text-emerald-200/90">
                            <span className="font-semibold text-emerald-300">
                              Answer:{" "}
                            </span>
                            {q.answer}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        </div>
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
