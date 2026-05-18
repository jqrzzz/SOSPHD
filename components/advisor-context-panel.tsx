import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProgressRing } from "@/components/motion/progress-ring";
import { CountUp } from "@/components/motion/count-up";
import type { ContextSnapshot } from "@/lib/data/advisor-types";

export interface AgentInsights {
  score: number;
  health: string;
  corridorCoverage: string;
  highPriorityGaps: number;
  totalGaps: number;
  openTasks: number;
  actions: Array<{ area: string; action: string; severity: string }>;
}

interface ContextPanelProps {
  context: ContextSnapshot;
  agentInsights?: AgentInsights;
}

const HEALTH_PALETTE: Record<string, { from: string; to: string; text: string }> =
  {
    strong: {
      from: "hsl(142 71% 45%)",
      to: "hsl(170 70% 50%)",
      text: "text-emerald-400",
    },
    good: {
      from: "hsl(170 50% 38%)",
      to: "hsl(190 70% 50%)",
      text: "text-primary",
    },
    "needs-attention": {
      from: "hsl(38 92% 50%)",
      to: "hsl(25 95% 53%)",
      text: "text-amber-400",
    },
    "at-risk": {
      from: "hsl(0 72% 51%)",
      to: "hsl(25 95% 53%)",
      text: "text-red-400",
    },
  };

const SEVERITY_DOT: Record<string, string> = {
  high: "bg-red-400 shadow-[0_0_10px_2px_hsl(0_72%_51%/0.5)]",
  medium: "bg-amber-400 shadow-[0_0_8px_2px_hsl(38_92%_50%/0.4)]",
  low: "bg-muted-foreground/60",
};

const STATUS_VARIANTS: Record<
  string,
  { dot: string; label: string }
> = {
  todo: { dot: "bg-muted-foreground/40", label: "todo" },
  doing: { dot: "bg-amber-400 shadow-[0_0_8px_2px_hsl(38_92%_50%/0.4)]", label: "doing" },
  done: { dot: "bg-emerald-400", label: "done" },
};

export function AdvisorContextPanel({
  context,
  agentInsights,
}: ContextPanelProps) {
  const openCount = context.recent_cases.filter((c) => c.status === "open").length;
  const activeCount = context.recent_cases.filter((c) => c.status === "active").length;
  const closedCount = context.recent_cases.filter((c) => c.status === "closed").length;

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-3 p-3">
        {agentInsights && (
          <PanelCard
            label="Research health"
            accent
          >
            <div className="flex items-center gap-4">
              <ProgressRing
                value={agentInsights.score}
                size={72}
                stroke={6}
                gradientFrom={(HEALTH_PALETTE[agentInsights.health] ?? HEALTH_PALETTE.good).from}
                gradientTo={(HEALTH_PALETTE[agentInsights.health] ?? HEALTH_PALETTE.good).to}
                glow={false}
              >
                <span
                  className={`font-mono text-base font-semibold tabular-nums ${(HEALTH_PALETTE[agentInsights.health] ?? HEALTH_PALETTE.good).text}`}
                >
                  <CountUp value={agentInsights.score} duration={1} />
                </span>
              </ProgressRing>
              <div className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] text-muted-foreground">
                <div className="flex items-center justify-between gap-2">
                  <span>Corridors</span>
                  <span className="font-mono tabular-nums text-foreground">
                    {agentInsights.corridorCoverage}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Gaps · high / total</span>
                  <span className="font-mono tabular-nums text-foreground">
                    {agentInsights.highPriorityGaps} /{" "}
                    {agentInsights.totalGaps}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Open tasks</span>
                  <span className="font-mono tabular-nums text-foreground">
                    {agentInsights.openTasks}
                  </span>
                </div>
              </div>
            </div>
          </PanelCard>
        )}

        {agentInsights && agentInsights.actions.length > 0 && (
          <PanelCard label="AI actions">
            <div className="flex flex-col gap-2">
              {agentInsights.actions.slice(0, 3).map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px]">
                  <span
                    aria-hidden="true"
                    className={`mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                      SEVERITY_DOT[a.severity] ?? SEVERITY_DOT.low
                    }`}
                  />
                  <span className="leading-relaxed text-muted-foreground">
                    {a.action}
                  </span>
                </div>
              ))}
            </div>
          </PanelCard>
        )}

        <PanelCard label="Active cases">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground">
              <CountUp value={context.total_cases} duration={1} />
            </span>
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              total
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusPill label="open" value={openCount} color="hsl(213 94% 56%)" />
            <StatusPill
              label="active"
              value={activeCount}
              color="hsl(38 92% 50%)"
            />
            <StatusPill
              label="closed"
              value={closedCount}
              color="hsl(142 71% 45%)"
            />
          </div>
        </PanelCard>

        <PanelCard label="Missing milestones">
          {context.missing_milestones_all.length === 0 ? (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              All cases have complete milestone chains.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {context.missing_milestones_all.slice(0, 6).map((m) => (
                <div key={m.case_id} className="flex flex-col gap-1">
                  <span className="font-mono text-[11px] font-medium text-foreground">
                    {m.patient_ref}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {m.missing.map((evt) => (
                      <Badge
                        key={evt}
                        variant="outline"
                        className="border-destructive/30 font-mono text-[9px] text-destructive/90"
                      >
                        {evt}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </PanelCard>

        <PanelCard label="Top tasks">
          {context.top_tasks.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No tasks yet.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {context.top_tasks.map((t) => {
                const variant =
                  STATUS_VARIANTS[t.status] ?? STATUS_VARIANTS.todo;
                return (
                  <div
                    key={t.id}
                    className="flex items-start gap-2 text-[11px]"
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${variant.dot}`}
                    />
                    <span className="line-clamp-2 flex-1 leading-relaxed text-foreground">
                      {t.title}
                    </span>
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                      P{t.priority}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </PanelCard>

        <PanelCard label="Recent notes">
          {context.recent_notes.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No notes yet.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {context.recent_notes.map((n) => (
                <div key={n.id} className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-medium text-foreground">
                    {n.title ?? "(untitled)"}
                  </span>
                  <span className="line-clamp-2 text-[10.5px] leading-relaxed text-muted-foreground">
                    {n.content}
                  </span>
                </div>
              ))}
            </div>
          )}
        </PanelCard>
      </div>
    </ScrollArea>
  );
}

function PanelCard({
  label,
  accent,
  children,
}: {
  label: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className={accent ? "border-primary/20" : undefined}>
      <CardContent className="flex flex-col gap-2 p-3">
        <span
          className={`font-mono text-[10px] uppercase tracking-[0.14em] ${
            accent ? "text-primary/90" : "text-muted-foreground"
          }`}
        >
          {label}
        </span>
        {children}
      </CardContent>
    </Card>
  );
}

function StatusPill({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground/80">
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: color }}
      />
      {label}
      <span className="text-foreground">{value}</span>
    </span>
  );
}
