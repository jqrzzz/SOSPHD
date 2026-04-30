import Link from "next/link";
import { getDashboardSummary, getCaseMetricRows } from "@/lib/data/analytics";
import { DashboardSummaryCards } from "@/components/dashboard-summary";
import { DashboardMetricChart } from "@/components/dashboard-metric-chart";
import { DashboardCaseTable } from "@/components/dashboard-case-table";

export default async function DashboardPage() {
  const summary = await getDashboardSummary();
  const rows = await getCaseMetricRows();

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

<
    </div>
  );
}
