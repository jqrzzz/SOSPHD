"use client";

/* ─── Statistics charts ────────────────────────────────────────────────
 *  Dependency-free SVG/HTML charts for the baseline statistics view.
 *  Specs follow the dataviz method: single validated data hue
 *  (--chart-1, teal-600 — see globals.css), ≤24px columns with 4px
 *  rounded data-ends and square baselines, 2px surface gaps, hairline
 *  recessive grid, text in text tokens (never the series color), hover
 *  tooltips on the column chart, ranked bars direct-labeled per row,
 *  meters with a lighter-step track of the same hue.
 * ────────────────────────────────────────────────────────────────────── */

import { useState } from "react";
import type { MonthlyVolume } from "@/lib/data/analytics";

const CHART_HUE = "hsl(var(--chart-1))";

// ── Monthly column chart ─────────────────────────────────────────────

interface MonthlyColumnsProps {
  data: MonthlyVolume[];
  /** Month keys ("2019-07") known to be recording gaps, not zero demand. */
  gapMonths?: string[];
}

export function MonthlyColumns({ data, gapMonths = [] }: MonthlyColumnsProps) {
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No dated cases yet.
      </p>
    );
  }

  const W = 720;
  const H = 200;
  const PAD_L = 34;
  const PAD_B = 26;
  const PAD_T = 14;
  const plotW = W - PAD_L - 8;
  const plotH = H - PAD_T - PAD_B;

  const max = Math.max(...data.map((d) => d.count), 1);
  // Clean y ticks: 0, half, top (rounded up to a clean step).
  const step = Math.max(10, Math.ceil(max / 2 / 10) * 10);
  const yTop = step * 2 >= max ? step * 2 : step * 3;
  const y = (v: number) => PAD_T + plotH - (v / yTop) * plotH;

  const slot = plotW / data.length;
  const barW = Math.min(24, Math.max(4, slot - 2)); // 2px surface gap

  const gapSet = new Set(gapMonths);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Cases per month"
      >
        {/* recessive hairline grid: baseline + two ticks */}
        {[0, step, yTop].map((v) => (
          <g key={v}>
            <line
              x1={PAD_L}
              y1={y(v)}
              x2={W - 8}
              y2={y(v)}
              className="stroke-border"
              strokeWidth="1"
            />
            <text
              x={PAD_L - 6}
              y={y(v) + 3}
              textAnchor="end"
              className="fill-muted-foreground"
              fontSize="9"
            >
              {v}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const x = PAD_L + i * slot + (slot - barW) / 2;
          const h = Math.max(d.count > 0 ? 2 : 0, (d.count / yTop) * plotH);
          const isGap = gapSet.has(d.month);
          return (
            <g key={d.month}>
              {/* hit target wider than the mark */}
              <rect
                x={PAD_L + i * slot}
                y={PAD_T}
                width={slot}
                height={plotH + PAD_B}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
              {d.count > 0 ? (
                <path
                  d={roundedTopBar(x, PAD_T + plotH - h, barW, h)}
                  fill={CHART_HUE}
                  opacity={hover === null || hover === i ? 1 : 0.55}
                  pointerEvents="none"
                />
              ) : (
                // explicit zero / recording gap: a baseline tick so the month
                // visibly exists instead of silently vanishing
                <line
                  x1={x}
                  y1={PAD_T + plotH}
                  x2={x + barW}
                  y2={PAD_T + plotH}
                  className={isGap ? "stroke-destructive/70" : "stroke-muted-foreground/50"}
                  strokeWidth="2"
                  pointerEvents="none"
                />
              )}
              {/* x labels: every 3rd month to avoid collisions */}
              {i % 3 === 0 && (
                <text
                  x={PAD_L + i * slot + slot / 2}
                  y={H - 8}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  fontSize="9"
                >
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {hover !== null && (
        <div
          className="pointer-events-none absolute -top-1 z-10 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md"
          style={{
            left: `${((PAD_L + hover * slot + slot / 2) / W) * 100}%`,
            transform: "translateX(-50%)",
          }}
        >
          <span className="font-medium text-foreground">{data[hover].label}</span>{" "}
          <span className="text-muted-foreground">
            · {data[hover].count} case{data[hover].count === 1 ? "" : "s"}
            {gapSet.has(data[hover].month) ? " · recording gap" : ""}
          </span>
        </div>
      )}

      {/* table view for accessibility */}
      <table className="sr-only">
        <caption>Cases per month</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.month}>
              <th scope="row">{d.label}</th>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Column with a 4px rounded data-end (top) and a square baseline. */
function roundedTopBar(x: number, top: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  const bottom = top + h;
  return [
    `M ${x} ${bottom}`,
    `L ${x} ${top + r}`,
    `Q ${x} ${top} ${x + r} ${top}`,
    `L ${x + w - r} ${top}`,
    `Q ${x + w} ${top} ${x + w} ${top + r}`,
    `L ${x + w} ${bottom}`,
    "Z",
  ].join(" ");
}

// ── Ranked horizontal bars (label · bar · value rows) ────────────────

interface RankedBarsProps {
  items: { label: string; count: number }[];
  /** Denominator for the share column; defaults to the sum of items. */
  total?: number;
  limit?: number;
}

export function RankedBars({ items, total, limit = 10 }: RankedBarsProps) {
  const shown = items.slice(0, limit);
  const denom = total ?? items.reduce((s, i) => s + i.count, 0);
  const max = Math.max(...shown.map((i) => i.count), 1);
  const rest = items.length - shown.length;

  return (
    <div className="flex flex-col gap-1.5">
      {shown.map((item) => (
        <div key={item.label} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-2">
          <span className="truncate text-xs text-muted-foreground" title={item.label}>
            {item.label}
          </span>
          <div className="h-2 overflow-hidden rounded-sm">
            <div
              className="h-full rounded-sm"
              style={{
                width: `${Math.max(1.5, (item.count / max) * 100)}%`,
                background: CHART_HUE,
              }}
            />
          </div>
          <span className="text-right font-mono text-xs tabular-nums text-foreground">
            {item.count}
            <span className="ml-1 text-muted-foreground">
              {denom > 0 ? `${Math.round((item.count / denom) * 100)}%` : ""}
            </span>
          </span>
        </div>
      ))}
      {rest > 0 && (
        <p className="pt-1 text-[11px] text-muted-foreground">
          + {rest} more — full list in the CSV export
        </p>
      )}
    </div>
  );
}

// ── Milestone coverage meters ────────────────────────────────────────

interface CoverageMetersProps {
  items: { label: string; present: number; total: number }[];
}

export function CoverageMeters({ items }: CoverageMetersProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((m) => {
        const pct = m.total > 0 ? (m.present / m.total) * 100 : 0;
        return (
          <div key={m.label} className="grid grid-cols-[11rem_1fr_auto] items-center gap-3">
            <span className="truncate font-mono text-[11px] text-muted-foreground">
              {m.label}
            </span>
            {/* meter: fill in the data hue; track = lighter step of the same hue */}
            <div
              className="h-2 rounded-sm"
              style={{ background: "hsl(var(--chart-1) / 0.16)" }}
            >
              <div
                className="h-full rounded-sm"
                style={{
                  width: `${Math.max(pct > 0 ? 1 : 0, pct)}%`,
                  background: CHART_HUE,
                }}
              />
            </div>
            <span className="text-right font-mono text-xs tabular-nums text-foreground">
              {m.present}
              <span className="text-muted-foreground">/{m.total}</span>
              <span className="ml-1.5 inline-block w-11 text-muted-foreground">
                {pct === 0 ? "0%" : pct < 1 ? "<1%" : `${pct.toFixed(pct < 10 ? 1 : 0)}%`}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
