import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CaseMetricRow } from "@/lib/data/analytics";
import { formatDuration } from "@/lib/data/metrics";

interface Props {
  rows: CaseMetricRow[];
}

function MetricCell({
  ms,
  complete,
}: {
  ms: number | null;
  complete: boolean;
}) {
  if (ms === null) {
    return <span className="text-muted-foreground">--</span>;
  }
  return (
    <span
      className={
        complete
          ? "font-mono tabular-nums text-foreground"
          : "font-mono tabular-nums text-amber-400"
      }
    >
      {formatDuration(ms)}
      {!complete && (
        <span className="ml-1 text-[10px] text-amber-400/70">live</span>
      )}
    </span>
  );
}

export function DashboardCaseTable({ rows }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Case Metric Detail</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead className="w-32">Patient Ref</TableHead>
              <TableHead className="w-16 text-center">Sev</TableHead>
              <TableHead className="w-20 text-center">Status</TableHead>
              <TableHead className="text-right">TTTA</TableHead>
              <TableHead className="text-right">TTGP</TableHead>
              <TableHead className="text-right">TTDC</TableHead>
              <TableHead className="w-16 text-center">Recs</TableHead>
              <TableHead className="w-20 text-center">Delay?</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.case_id} className="text-xs">
                <TableCell>
                  <Link
                    href={`/cases/${row.case_id}`}
                    className="font-mono text-primary underline-offset-4 hover:underline"
                  >
                    {row.patient_ref}
                  </Link>
                </TableCell>
                <TableCell className="text-center">
                  <Badge
                    variant="outline"
                    className="px-1.5 py-0 text-[10px]"
                  >
                    {row.severity}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge
                    variant="secondary"
                    className="px-1.5 py-0 text-[10px] capitalize"
                  >
                    {row.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <MetricCell ms={row.ttta_ms} complete={row.ttta_complete} />
                </TableCell>
                <TableCell className="text-right">
                  <MetricCell ms={row.ttgp_ms} complete={row.ttgp_complete} />
                </TableCell>
                <TableCell className="text-right">
                  <MetricCell ms={row.ttdc_ms} complete={row.ttdc_complete} />
                </TableCell>
                <TableCell className="text-center font-mono tabular-nums">
                  {row.recommendation_count > 0 ? (
                    <span>
                      {row.accepted_count}/{row.recommendation_count}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">--</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {row.payment_delayed ? (
                    <Badge
                      variant="destructive"
                      className="px-1.5 py-0 text-[10px]"
                    >
                      Yes
                    </Badge>
                  ) : row.ttgp_complete && row.ttdc_complete ? (
                    <span className="text-[10px] text-[#2dd4a0]">No</span>
                  ) : (
                    <span className="text-muted-foreground">--</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
