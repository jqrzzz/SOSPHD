import Link from "next/link";
import { getDashboardSummary, getCaseMetricRows } from "@/lib/data/analytics";
import { DashboardSummaryCards } from "@/components/dashboard-summary";
import { DashboardMetricChart } from "@/components/dashboard-metric-chart";
import { DashboardCaseTable } from "@/components/dashboard-case-table";
import { getResearchPulse, suggestNextActions, detectGaps } from "@/lib/agent";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { DashboardExport } from "@/components/dashboard-export";

export default async function DashboardPage() {
  const summary = getDashboardSummary();
  const rows = getCaseMetricRows();

  // Agent-powered insights
  const [pulse, nextActions, gaps] = await Promise.all([
    getResearchPulse(),
    suggestNextActions(5),
    detectGaps(),
  ]);

  const HEALTH_COLORS: Record<string, string> = {
    strong: "text-emerald-400",
    good: "text-primary",
    "needs-attention": "text-amber-400",
    "at-risk": "text-red-400",
  };

  const SEVERITY_COLORS: Record<string, string> = {
    high: "border-red-500/30 bg-red-500/10 text-red-400",
    medium: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    low: "border-border bg-muted/30 text-muted-foreground",
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              Analytics Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              TTDC, TTGP, and TTTA across all cases. Data feeds directly into Paper
              1 results.
            </p>
          </div>
          <DashboardExport rows={rows} />
        </div>
      </header>

      <div className="flex flex-col gap-6 p-3 sm:p-6">
        {/* ── AI Research Pulse ──────────────────────────────── */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex flex-col gap-2 p-4">
              <span className="text-xs font-medium text-muted-foreground">
                Research Health
              </span>
              <div className="flex items-baseline gap-2">
                <span className={`font-mono text-2xl font-semibold tabular-nums ${HEALTH_COLORS[pulse.health] ?? "text-foreground"}`}>
                  {pulse.score}
                </span>
                <span className="text-xs text-muted-foreground">/ 100</span>
              </div>
              <Progress value={pulse.score} className="h-1.5" />
              <Badge variant="outline" className={`w-fit text-[10px] ${HEALTH_COLORS[pulse.health] ?? ""}`}>
                {pulse.health.replace("-", " ")}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-2 p-4">
              <span className="text-xs font-medium text-muted-foreground">
                Corridor Coverage
              </span>
              <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight">
                {pulse.corridorCoverage}
              </span>
              <span className="text-xs text-muted-foreground">
                corridors with field data
              </span>
              <Button variant="link" asChild className="h-auto p-0 text-xs text-primary">
                <Link href="/dashboard/corridors">View briefings</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-2 p-4">
              <span className="text-xs font-medium text-muted-foreground">
                Research Gaps
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-amber-400">
                  {pulse.highPriorityGaps}
                </span>
                <span className="text-xs text-muted-foreground">high priority</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {pulse.totalGaps} total gaps identified
              </span>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-2 p-4">
              <span className="text-xs font-medium text-muted-foreground">
                Open Tasks
              </span>
              <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight">
                {pulse.openTasks}
              </span>
              <span className="text-xs text-muted-foreground">
                tasks awaiting completion
              </span>
            </CardContent>
          </Card>
        </div>

        {/* ── AI Suggested Actions ──────────────────────────── */}
        {nextActions.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-foreground">
                Suggested Next Actions
              </h2>
              <div className="flex flex-col gap-2">
                {nextActions.map((action, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-md border border-border/50 px-3 py-2.5"
                  >
                    <Badge
                      variant="outline"
                      className={`mt-0.5 shrink-0 text-[10px] ${SEVERITY_COLORS[action.severity] ?? ""}`}
                    >
                      {action.severity}
                    </Badge>
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

        {/* ── Research Gaps Breakdown ───────────────────────── */}
        {gaps.totalGaps > 0 && (
          <Card>
            <CardContent className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-foreground">
                Research Gaps ({gaps.totalGaps})
              </h2>
              <div className="mb-3 flex flex-wrap gap-2">
                {Object.entries(gaps.byArea).map(([area, count]) => (
                  count > 0 && (
                    <Badge key={area} variant="secondary" className="text-xs">
                      {area}: {count}
                    </Badge>
                  )
                ))}
              </div>
              <div className="flex flex-col gap-1.5 max-h-60 overflow-auto">
                {gaps.gaps.slice(0, 10).map((gap, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-xs"
                  >
                    <span className={`mt-0.5 inline-block h-1.5 w-1.5 rounded-full shrink-0 ${
                      gap.severity === "high" ? "bg-red-400" :
                      gap.severity === "medium" ? "bg-amber-400" : "bg-muted-foreground"
                    }`} />
                    <span className="text-muted-foreground">{gap.gap}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary cards */}
        <DashboardSummaryCards summary={summary} />

        {/* Chart */}
        <DashboardMetricChart rows={rows} />

        {/* Case-level detail table */}
        <DashboardCaseTable rows={rows} />
      </div>
    </div>
  );
}
