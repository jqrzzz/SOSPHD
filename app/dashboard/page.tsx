import { getDashboardSummary, getCaseMetricRows } from "@/lib/data/analytics";
import { DashboardSummaryCards } from "@/components/dashboard-summary";
import { DashboardMetricChart } from "@/components/dashboard-metric-chart";
import { DashboardCaseTable } from "@/components/dashboard-case-table";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent } from "@/components/ui/card";

export default async function DashboardPage() {
  const [summary, rows] = await Promise.all([
    getDashboardSummary(),
    getCaseMetricRows(),
  ]);

  return (
    <div className="flex flex-col gap-6 overflow-y-auto p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-balance text-xl font-semibold tracking-tight text-foreground">
          Analytics Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          TTDC, TTGP, and TTTA across all cases. Data feeds directly into Paper
          1 results.
        </p>
      </div>

      {summary.total_cases === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon="0"
              title="No case data yet"
              description="Create cases and add provenance events to see TTDC, TTGP, and TTTA metrics computed here. Charts and statistics populate automatically."
              action={{ href: "/cases/new", label: "Create First Case" }}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <DashboardSummaryCards summary={summary} />
          <DashboardMetricChart rows={rows} />
          <DashboardCaseTable rows={rows} />
        </>
      )}
    </div>
  );
}
