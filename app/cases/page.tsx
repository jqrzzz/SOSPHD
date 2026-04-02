import Link from "next/link";
import { Suspense } from "react";
import { getCases, getEventCountByCaseId } from "@/lib/data/store";
import { SeverityBadge } from "@/components/severity-badge";
import { StatusBadge } from "@/components/status-badge";
import { CaseListFilters } from "@/components/case-list-filters";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

  const cases = getCases({
    status: statusFilter,
    search: searchQuery,
  });

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Cases</h1>
          <p className="text-sm text-muted-foreground">
            {cases.length} case{cases.length !== 1 ? "s" : ""} found
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/cases/new">New Case</Link>
        </Button>
      </header>

      {/* Filters */}
      <Suspense fallback={<div className="h-12 border-b border-border" />}>
        <CaseListFilters
          currentStatus={statusFilter}
          currentSearch={searchQuery}
        />
      </Suspense>

      {/* Table */}
      <div className="flex-1 overflow-auto px-3 pb-6 sm:px-6">
        {cases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-sm text-muted-foreground">
              No cases match your filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">Patient Ref</TableHead>
                <TableHead className="w-28 hidden sm:table-cell">Severity</TableHead>
                <TableHead>Chief Complaint</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-36 hidden md:table-cell">Created</TableHead>
                <TableHead className="w-20 text-right hidden sm:table-cell">Events</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cases.map((c) => {
                const eventCount = getEventCountByCaseId(c.id);
                return (
                  <TableRow key={c.id} className="group">
                    <TableCell>
                      <Link
                        href={`/cases/${c.id}`}
                        className="font-mono text-sm font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {c.patient_ref}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <SeverityBadge severity={c.severity} />
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {c.chief_complaint}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground font-tabular hidden md:table-cell">
                      {formatDate(c.created_at, "datetime")}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-tabular hidden sm:table-cell">
                      {eventCount}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        )}
      </div>
    </div>
  );
}
