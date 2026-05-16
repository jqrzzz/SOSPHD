"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Cell,
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

// Resolved hex values (Recharts can't read CSS vars directly).
const COLORS = {
  ttta: "#60a5fa", // blue-400
  ttgp: "#f59e0b", // amber-500
  ttdc: "#2dd4bf", // teal-400
  delayed: "#ef4444", // red-500
};

function msToMinutes(ms: number | null): number {
  if (ms === null) return 0;
  return Math.round(ms / 60000);
}

interface Props {
  rows: CaseMetricRow[];
}

export function DashboardMetricChart({ rows }: Props) {
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
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-semibold">
              TTTA · TTGP · TTDC{" "}
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                by case · minutes
              </span>
            </CardTitle>
            <CardDescription className="mt-1 text-xs">
              Completed metrics only. Bars in red indicate cases where TTGP
              exceeded TTDC — payment delayed care.
            </CardDescription>
          </div>
          <div className="hidden items-center gap-3 text-[10px] font-mono uppercase tracking-[0.14em] sm:flex">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="inline-block h-2 w-2 rounded-sm"
                style={{ background: COLORS.ttta }}
              />
              TTTA
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="inline-block h-2 w-2 rounded-sm"
                style={{ background: COLORS.ttgp }}
              />
              TTGP
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="inline-block h-2 w-2 rounded-sm"
                style={{ background: COLORS.ttdc }}
              />
              TTDC
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <ChartContainer
          config={{
            ttta: { label: "TTTA", color: COLORS.ttta },
            ttgp: { label: "TTGP", color: COLORS.ttgp },
            ttdc: { label: "TTDC", color: COLORS.ttdc },
          }}
          className="h-[300px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="grad-ttta" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.ttta} stopOpacity={1} />
                  <stop
                    offset="100%"
                    stopColor={COLORS.ttta}
                    stopOpacity={0.35}
                  />
                </linearGradient>
                <linearGradient id="grad-ttgp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.ttgp} stopOpacity={1} />
                  <stop
                    offset="100%"
                    stopColor={COLORS.ttgp}
                    stopOpacity={0.35}
                  />
                </linearGradient>
                <linearGradient id="grad-ttdc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.ttdc} stopOpacity={1} />
                  <stop
                    offset="100%"
                    stopColor={COLORS.ttdc}
                    stopOpacity={0.35}
                  />
                </linearGradient>
                <linearGradient id="grad-delayed" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={COLORS.delayed}
                    stopOpacity={1}
                  />
                  <stop
                    offset="100%"
                    stopColor={COLORS.delayed}
                    stopOpacity={0.35}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="2 4"
                stroke="hsl(220 14% 18%)"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "hsl(215 14% 55%)" }}
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-25}
                height={50}
                textAnchor="end"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(215 14% 55%)" }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <ChartTooltip
                cursor={{ fill: "hsl(220 16% 12%)", opacity: 0.4 }}
                content={<ChartTooltipContent />}
              />
              <Legend iconType="circle" iconSize={6} wrapperStyle={{ display: "none" }} />
              <Bar
                dataKey="ttta"
                fill="url(#grad-ttta)"
                name="TTTA"
                radius={[6, 6, 0, 0]}
                maxBarSize={36}
                animationDuration={900}
              />
              <Bar
                dataKey="ttgp"
                name="TTGP"
                radius={[6, 6, 0, 0]}
                maxBarSize={36}
                animationDuration={900}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`ttgp-${index}`}
                    fill={
                      entry.payment_delayed
                        ? "url(#grad-delayed)"
                        : "url(#grad-ttgp)"
                    }
                  />
                ))}
              </Bar>
              <Bar
                dataKey="ttdc"
                fill="url(#grad-ttdc)"
                name="TTDC"
                radius={[6, 6, 0, 0]}
                maxBarSize={36}
                animationDuration={900}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
