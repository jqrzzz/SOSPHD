import Link from "next/link";
import { Suspense } from "react";
import { getCases, getEventCountByCaseId } from "@/lib/data/store";
import { SeverityBadge } from "@/components/severity-badge";
import { StatusBadge } from "@/components/status-badge";
import { CaseListFilters } from "@/components/case-list-filters";
import { PageHeader } from "@/components/page-header";
import { CountUp } from "@/components/motion/count-up";
import { FadeIn } from "@/components/motion/fade-in";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function CasesPage(props: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const searchParams = await props.searchParams;
  const statusFilter = searchParams.status as
    | "open"
    | "active"
    | "closed"
    | undefined;
  const searchQuery = searchParams.q;

  const cases = await getCases({
    status: statusFilter,
    search: searchQuery,
  });

  const eventCounts = await Promise.all(
    cases.map((c) => getEventCountByCaseId(c.id)),
  );
  const eventCountMap = new Map(cases.map((c, i) => [c.id, eventCounts[i]]));

  const openCount = cases.filter((c) => c.status === "open").length;
  const activeCount = cases.filter((c) => c.status === "active").length;
  const closedCount = cases.filter((c) => c.status === "closed").length;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <PageHeader
        eyebrow="Operational data"
        title="Cases"
        description="Every case the operational system has surfaced. Open one to see its event timeline, computed metrics, and AI recommendations."
        actions={
          <Button asChild size="sm">
            <Link href="/cases/new">
              <span className="mr-1 text-base leading-none">+</span> New case
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-5 p-4 sm:p-6">
        {/* Stat row */}
        <FadeIn>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile
              label="Total"
              value={<CountUp value={cases.length} duration={1} />}
              dot="bg-muted-foreground/40"
            />
            <StatTile
              label="Open"
              value={
                <span className="text-[hsl(213_94%_56%)]">
                  <CountUp value={openCount} duration={1} />
                </span>
              }
              dot="bg-[hsl(213_94%_56%)]"
            />
            <StatTile
              label="Active"
              value={
                <span className="text-[hsl(38_92%_50%)]">
                  <CountUp value={activeCount} duration={1} />
                </span>
              }
              dot="bg-[hsl(38_92%_50%)]"
            />
            <StatTile
              label="Closed"
              value={
                <span className="text-[hsl(142_71%_45%)]">
                  <CountUp value={closedCount} duration={1} />
                </span>
              }
              dot="bg-[hsl(142_71%_45%)]"
            />
          </div>
        </FadeIn>

        {/* Filters */}
        <Suspense fallback={<div className="h-10" />}>
          <CaseListFilters
            currentStatus={statusFilter}
            currentSearch={searchQuery}
          />
        </Suspense>

        {/* List / empty state */}
        {cases.length === 0 ? (
          <FadeIn>
            <Card className="surface-lifted">
              <CardContent className="flex flex-col items-center gap-5 py-16">
                <div className="relative">
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 -z-10 rounded-2xl bg-primary/15 blur-2xl"
                  />
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 to-primary/5 font-mono text-2xl text-primary/80">
                    +
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1.5 text-center">
                  <p className="text-sm font-semibold text-foreground">
                    {statusFilter || searchQuery
                      ? "No cases match those filters."
                      : "No cases yet."}
                  </p>
                  <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                    {statusFilter || searchQuery
                      ? "Try clearing the filter or a different search term."
                      : "Each case anchors a chain of provenance events. TTTA / TTGP / TTDC are computed from those events as they arrive."}
                  </p>
                </div>
                {!statusFilter && !searchQuery && (
                  <Button asChild size="sm">
                    <Link href="/cases/new">Create first case</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          </FadeIn>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/20">
                    <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Patient ref
                    </th>
                    <th className="hidden px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:table-cell">
                      Severity
                    </th>
                    <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Chief complaint
                    </th>
                    <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Status
                    </th>
                    <th className="hidden px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground md:table-cell">
                      Created
                    </th>
                    <th className="hidden px-4 py-3 text-right font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:table-cell">
                      Events
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c) => {
                    const eventCount = eventCountMap.get(c.id) ?? 0;
                    return (
                      <tr
                        key={c.id}
                        className="group border-b border-border/30 transition-colors last:border-0 hover:bg-accent/40"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/cases/${c.id}`}
                            className="font-mono text-sm font-medium text-primary underline-offset-4 transition-colors group-hover:underline"
                          >
                            {c.patient_ref}
                          </Link>
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <SeverityBadge severity={c.severity} />
                        </td>
                        <td className="max-w-[260px] truncate px-4 py-3 text-sm text-muted-foreground">
                          {c.chief_complaint}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={c.status} />
                        </td>
                        <td className="hidden px-4 py-3 font-mono text-xs tabular-nums text-muted-foreground md:table-cell">
                          {formatDate(c.created_at, "datetime")}
                        </td>
                        <td className="hidden px-4 py-3 text-right font-mono text-sm tabular-nums sm:table-cell">
                          <span
                            className={
                              eventCount > 0
                                ? "text-foreground"
                                : "text-muted-foreground/50"
                            }
                          >
                            {eventCount}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  dot,
}: {
  label: string;
  value: React.ReactNode;
  dot: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border/50 bg-card/40 p-3">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`}
        />
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
      </div>
      <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </span>
    </div>
  );
}
