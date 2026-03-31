import { getDashboardSummary, getCaseMetricRows } from "@/lib/data/analytics";
import { DashboardSummaryCards } from "@/components/dashboard-summary";
import { DashboardMetricChart } from "@/components/dashboard-metric-chart";
import { DashboardCaseTable } from "@/components/dashboard-case-table";

export default async function DashboardPage() {
  const summary = getDashboardSummary();
  const rows = getCaseMetricRows();

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">
          Analytics Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          TTDC, TTGP, and TTTA across all cases. Data feeds directly into Paper
          1 results.
        </p>
      </header>

      <div className="flex flex-col gap-6 p-6">

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
