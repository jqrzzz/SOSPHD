import Link from "next/link";
import { getDashboardSummary, getCaseMetricRows } from "@/lib/data/analytics";
import { DashboardSummaryCards } from "@/components/dashboard-summary";
import { DashboardMetricChart } from "@/components/dashboard-metric-chart";
import { DashboardCaseTable } from "@/components/dashboard-case-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function DashboardPage() {
  const summary = await getDashboardSummary();
  const rows = await getCaseMetricRows();

  return (
    <div className="flex flex-col gap-6 overflow-y-auto p-6">
      {/* Page header */}
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
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-secondary">
              <span className="text-2xl text-muted-foreground">0</span>
            </div>
            <div className="flex flex-col items-center gap-1 text-center">
              <p className="text-sm font-medium text-foreground">
                No case data yet
              </p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Create cases and add provenance events to see TTDC, TTGP, and
                TTTA metrics computed here. Charts and statistics populate
                automatically.
              </p>
            </div>
            <Button asChild size="sm">
              <Link href="/cases/new">Create First Case</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary cards */}
          <DashboardSummaryCards summary={summary} />

          {/* Chart */}
          <DashboardMetricChart rows={rows} />

          {/* Case-level detail table */}
          <DashboardCaseTable rows={rows} />
        </>
      )}
    </div>
  );
}
