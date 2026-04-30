"use client";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ExportRow {
  case_id: string;
  patient_ref: string;
  severity: number;
  status: string;
  created_at: string;
  ttta_ms: number | null;
  ttgp_ms: number | null;
  ttdc_ms: number | null;
  ttta_complete: boolean;
  ttgp_complete: boolean;
  ttdc_complete: boolean;
  payment_delayed: boolean;
  recommendation_count: number;
  accepted_count: number;
  override_count: number;
}

export function DashboardExport({ rows }: { rows: ExportRow[] }) {
  function exportCSV() {
    const headers = [
      "case_id",
      "patient_ref",
      "severity",
      "status",
      "created_at",
      "ttta_min",
      "ttgp_min",
      "ttdc_min",
      "ttta_complete",
      "ttgp_complete",
      "ttdc_complete",
      "payment_delayed",
      "recommendations",
      "accepted",
      "overridden",
    ];

    const csvRows = rows.map((r) => [
      r.case_id,
      r.patient_ref,
      r.severity,
      r.status,
      r.created_at,
      r.ttta_ms !== null ? Math.round(r.ttta_ms / 60000) : "",
      r.ttgp_ms !== null ? Math.round(r.ttgp_ms / 60000) : "",
      r.ttdc_ms !== null ? Math.round(r.ttdc_ms / 60000) : "",
      r.ttta_complete,
      r.ttgp_complete,
      r.ttdc_complete,
      r.payment_delayed,
      r.recommendation_count,
      r.accepted_count,
      r.override_count,
    ]);

    const csv = [headers, ...csvRows]
      .map((row) => row.map((v) => `"${v}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sosphd-metrics-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} cases to CSV`);
  }

  return (
    <Button variant="outline" size="sm" onClick={exportCSV}>
      Export CSV
    </Button>
  );
}
