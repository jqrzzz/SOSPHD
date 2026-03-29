"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { CaseMetricRow } from "@/lib/data/analytics";

// Chart colors -- computed values, not CSS vars (Recharts requirement)
const COLORS = {
  ttta: "#3b82f6", // blue
  ttgp: "#f59e0b", // amber
  ttdc: "#2dd4a0", // emerald
};

function msToMinutes(ms: number | null): number {
  if (ms === null) return 0;
  return Math.round(ms / 60000);
}

interface Props {
  rows: CaseMetricRow[];
}

export function DashboardMetricChart({ rows }: Props) {
  // Only show cases with at least one completed metric
  const chartData = rows
    .filter((r) => r.ttta_complete || r.ttgp_complete || r.ttdc_complete)
    .map((r) => ({
      name: r.patient_ref,
      ttta: r.ttta_complete ? msToMinutes(r.ttta_ms) : 0,
      ttgp: r.ttgp_complete ? msToMinutes(r.ttgp_ms) : 0,
      ttdc: r.ttdc_complete ? msToMinutes(r.ttdc_ms) : 0,
      payment_delayed: r.payment_delayed,
    }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Metric Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No completed metrics to chart yet. Close some cases to see data.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          TTTA / TTGP / TTDC by Case (minutes)
        </CardTitle>
        <CardDescription className="text-xs">
          Completed metrics only. Cases where TTGP {">"} TTDC indicate
          payment-delayed care.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            ttta: { label: "TTTA", color: COLORS.ttta },
            ttgp: { label: "TTGP", color: COLORS.ttgp },
            ttdc: { label: "TTDC", color: COLORS.ttdc },
          }}
          className="h-[280px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(240 4% 18%)"
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "#8898aa" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#8898aa" }}
                tickLine={false}
                axisLine={false}
                label={{
                  value: "min",
                  position: "insideTopLeft",
                  offset: -5,
                  style: { fontSize: 10, fill: "#8898aa" },
                }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend
                iconType="square"
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              />
              <Bar
                dataKey="ttta"
                fill={COLORS.ttta}
                name="TTTA"
                radius={[3, 3, 0, 0]}
              />
              <Bar
                dataKey="ttgp"
                fill={COLORS.ttgp}
                name="TTGP"
                radius={[3, 3, 0, 0]}
              />
              <Bar
                dataKey="ttdc"
                fill={COLORS.ttdc}
                name="TTDC"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
