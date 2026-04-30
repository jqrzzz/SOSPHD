import { getDashboardSummary } from "@/lib/data/analytics";
import { PaperBuilder } from "@/components/paper-builder";

export default async function PaperBuilderPage() {
  const summary = await getDashboardSummary();

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">
          Paper Builder
        </h1>
        <p className="text-sm text-muted-foreground">
          Generate academic paper sections from live provenance data. Each
          section uses computed TTDC, TTGP, and TTTA metrics.
        </p>
      </header>

      <div className="p-6">
      <PaperBuilder
        totalCases={summary.total_cases}
        closedCases={summary.closed_cases}
      />
      </div>
    </div>
  );
}
