import { getDashboardSummary } from "@/lib/data/analytics";
import { PaperBuilder } from "@/components/paper-builder";

export default async function PaperBuilderPage() {
  const summary = await getDashboardSummary();

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
      {/* Page header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-balance text-xl font-semibold tracking-tight text-foreground">
          Paper Builder
        </h1>
        <p className="text-sm text-muted-foreground">
          Generate academic paper sections from live provenance data. Each
          section uses computed TTDC, TTGP, and TTTA metrics.
        </p>
      </div>

      <PaperBuilder
        totalCases={summary.total_cases}
        closedCases={summary.closed_cases}
      />
    </div>
  );
}
