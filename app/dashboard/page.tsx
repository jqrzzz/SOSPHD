import { getDashboardSummary, getCaseMetricRows } from "@/lib/data/analytics";
import { DashboardSummaryCards } from "@/components/dashboard-summary";
import { DashboardMetricChart } from "@/components/dashboard-metric-chart";
import { DashboardCaseTable } from "@/components/dashboard-case-table";

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

      {/* Summary cards */}
      <DashboardSummaryCards summary={summary} />

      {/* Chart */}
      <DashboardMetricChart rows={rows} />

      {/* Case-level detail table */}
      <DashboardCaseTable rows={rows} />
    </div>
  );
}
