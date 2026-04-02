import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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

const STATUS_STYLES: Record<StepStatus, { label: string; className: string }> =
  {
    done: {
      label: "Done",
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    },
    in_progress: {
      label: "In Progress",
      className: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    },
    next: {
      label: "Up Next",
      className: "border-primary/30 bg-primary/10 text-primary",
    },
    pending: {
      label: "Pending",
      className: "border-border bg-muted/30 text-muted-foreground",
    },
  };

/* ── Page ─────────────────────────────────────────────────────── */

export default async function SpinePage() {
  const overall = getOverallProgress();
  const nextStep = getNextStep();
  const unresolvedQuestions = getUnresolvedQuestions();

  // Agent-powered insights
  const [nextActions, pulse] = await Promise.all([
    suggestNextActions(3),
    getResearchPulse(),
  ]);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">PhD Spine</h1>
        <p className="text-sm text-muted-foreground">
          Research program progress — phases, steps, and open questions.
        </p>
      </header>

      <div className="flex flex-col gap-6 p-3 sm:p-6">
        {/* ── Top summary row ────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Overall progress */}
          <Card>
            <CardContent className="flex flex-col gap-2 p-4">
              <span className="text-xs font-medium text-muted-foreground">
                Overall Progress
              </span>
              <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight">
                {overall.done}/{overall.total}
              </span>
              <Progress value={overall.percent} className="h-1.5" />
              <span className="text-xs text-muted-foreground">
                {overall.percent}% of steps complete
              </span>
            </CardContent>
          </Card>

          {/* Next step */}
          <Card>
            <CardContent className="flex flex-col gap-2 p-4">
              <span className="text-xs font-medium text-muted-foreground">
                Current Focus
              </span>
              {nextStep ? (
                <>
                  <span className="text-sm font-semibold leading-tight">
                    {nextStep.label}
                  </span>
                  <span className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
                    {nextStep.description}
                  </span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">
                  All steps complete
                </span>
              )}
            </CardContent>
          </Card>

          {/* Open questions */}
          <Card>
            <CardContent className="flex flex-col gap-2 p-4">
              <span className="text-xs font-medium text-muted-foreground">
                Open Questions
              </span>
              <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-amber-400">
                {unresolvedQuestions.length}
              </span>
              <span className="text-xs text-muted-foreground">
                Definitional decisions needed before codebook is final
              </span>
            </CardContent>
          </Card>

          {/* Research health */}
          <Card>
            <CardContent className="flex flex-col gap-2 p-4">
              <span className="text-xs font-medium text-muted-foreground">
                Research Health
              </span>
              <span className={`font-mono text-2xl font-semibold tabular-nums tracking-tight ${
                pulse.score >= 80 ? "text-emerald-400" :
                pulse.score >= 60 ? "text-primary" :
                pulse.score >= 40 ? "text-amber-400" : "text-red-400"
              }`}>
                {pulse.score}
              </span>
              <Progress value={pulse.score} className="h-1.5" />
              <span className="text-xs text-muted-foreground">
                {pulse.corridorCoverage} corridors · {pulse.highPriorityGaps} gaps
              </span>
            </CardContent>
          </Card>
        </div>

        {/* ── AI Suggested Actions ───────────────────────────── */}
        {nextActions.length > 0 && (
          <Card className="border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-medium text-primary">AI Agent</span>
                <span className="text-xs text-muted-foreground">— What to do next</span>
              </div>
              <div className="flex flex-col gap-2">
                {nextActions.map((action, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-md border border-border/50 px-3 py-2"
                  >
                    <span className={`mt-1 inline-block h-2 w-2 rounded-full shrink-0 ${
                      action.severity === "high" ? "bg-red-400" :
                      action.severity === "medium" ? "bg-amber-400" : "bg-muted-foreground"
                    }`} />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm text-foreground">{action.action}</span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        {action.area}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Phases ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-foreground">
            Research Phases
          </h2>

          {PHD_PHASES.map((phase) => {
            const progress = getPhaseProgress(phase);
            return (
              <Card key={phase.id}>
                <CardContent className="flex flex-col gap-3 p-4">
                  {/* Phase header */}
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold">
                        {phase.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {phase.summary}
                      </span>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                      {progress.done}/{progress.total}
                    </span>
                  </div>

                  <Progress value={progress.percent} className="h-1" />

                  {/* Steps */}
                  <div className="flex flex-col gap-2">
                    {phase.steps.map((step) => {
                      const style = STATUS_STYLES[step.status];
                      return (
                        <div
                          key={step.id}
                          className="flex items-start gap-3 rounded-md border border-border/50 px-3 py-2.5"
                        >
                          <Badge
                            variant="outline"
                            className={`mt-0.5 shrink-0 text-[10px] ${style.className}`}
                          >
                            {style.label}
                          </Badge>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium leading-tight">
                              {step.label}
                            </span>
                            <span className="text-xs leading-relaxed text-muted-foreground">
                              {step.description}
                            </span>
                            {step.deliverable && (
                              <span className="mt-0.5 text-xs text-primary/80">
                                Deliverable: {step.deliverable}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* ── Open Questions ─────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-foreground">
            Open Questions
          </h2>
          <p className="text-xs text-muted-foreground">
            These definitional decisions must be resolved before the codebook is
            final and prospective data collection can begin.
          </p>

          <div className="flex flex-col gap-3">
            {OPEN_QUESTIONS.map((q) => {
              const resolved = !!q.answer;
              return (
                <Card
                  key={q.id}
                  className={resolved ? "border-emerald-500/20" : ""}
                >
                  <CardContent className="flex flex-col gap-2 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{q.label}</span>
                      <Badge
                        variant="outline"
                        className={
                          resolved
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px]"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-400 text-[10px]"
                        }
                      >
                        {resolved ? "Resolved" : "Open"}
                      </Badge>
                    </div>
                    <span className="text-xs leading-relaxed text-muted-foreground">
                      {q.question}
                    </span>
                    {q.options && (
                      <ul className="flex flex-col gap-1 pl-3">
                        {q.options.map((opt, i) => (
                          <li
                            key={i}
                            className="text-xs text-muted-foreground before:mr-1.5 before:content-['•']"
                          >
                            {opt}
                          </li>
                        ))}
                      </ul>
                    )}
                    <span className="text-[10px] text-muted-foreground/60">
                      Source: {q.source}
                    </span>
                    {q.answer && (
                      <div className="mt-1 rounded-md bg-emerald-500/5 px-3 py-2">
                        <span className="text-xs font-medium text-emerald-400">
                          Answer: {q.answer}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
