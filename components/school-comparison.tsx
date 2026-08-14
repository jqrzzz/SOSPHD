/* ─── School comparison + deadline timeline ────────────────────────────
 *  The two artefacts an admissions consultant hands you: a side-by-side
 *  matrix of every option on the axes that actually decide it, and a
 *  calendar strip showing how the deadlines stack up against each other.
 *  Server-rendered; no interactivity needed to read either.
 * ────────────────────────────────────────────────────────────────────── */

import Link from "next/link";
import {
  STUDY_FORMAT_LABELS,
  daysUntil,
  deadlineUrgency,
  readiness,
  type Institution,
  type InstitutionRequirement,
} from "@/lib/data/admissions-types";
import { cn } from "@/lib/utils";

const URGENCY_CLASS = {
  past: "text-muted-foreground",
  critical: "text-destructive",
  soon: "text-amber-400",
  later: "text-muted-foreground",
} as const;

const URGENCY_FILL = {
  past: "hsl(var(--muted-foreground))",
  critical: "hsl(var(--destructive))",
  soon: "hsl(38 92% 50%)",
  later: "hsl(var(--chart-1))",
} as const;

/** Trim a label to the pixels available. ~5.1px per char at fontSize 10
 *  in the app's sans stack — deliberately conservative so a long name
 *  never runs past the viewBox. */
function truncateToWidth(text: string, available: number): string {
  const max = Math.floor(available / 5.1);
  if (max <= 1) return "…";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Does this programme require a specific test? Read off its requirements
 *  rather than a duplicated flag, so the matrix can never drift. */
function testStatus(reqs: InstitutionRequirement[], needle: string): string {
  const hit = reqs.find((r) =>
    r.label.toLowerCase().includes(needle.toLowerCase()),
  );
  if (!hit) return "—";
  if (!hit.mandatory) return "optional";
  return "required";
}

export function SchoolComparison({
  institutions,
  reqsByInstitution,
}: {
  institutions: Institution[];
  reqsByInstitution: Map<string, InstitutionRequirement[]>;
}) {
  if (institutions.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {[
              "Programme",
              "Country",
              "Format",
              "Deadline",
              "Supervisor first",
              "GRE",
              "Fit",
              "Ready",
            ].map((h) => (
              <th
                key={h}
                className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {institutions.map((i) => {
            const reqs = reqsByInstitution.get(i.id) ?? [];
            const days = i.next_deadline ? daysUntil(i.next_deadline) : null;
            const gre = testStatus(reqs, "GRE");
            return (
              <tr
                key={i.id}
                className="border-b border-border/60 hover:bg-accent/40"
              >
                <td className="px-3 py-2.5">
                  <Link
                    href={`/apply/${i.id}`}
                    className="font-medium text-foreground hover:text-primary"
                  >
                    {i.name}
                  </Link>
                  <div className="text-[10px] text-muted-foreground">
                    {i.programme}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">
                  {i.country}
                </td>
                <td className="px-3 py-2.5 text-xs">
                  <div className="flex flex-wrap gap-1">
                    {i.formats.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      i.formats.map((f) => (
                        <span
                          key={f}
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px]",
                            f === "part_time" || f === "external"
                              ? "bg-primary/15 text-primary"
                              : "bg-secondary text-muted-foreground",
                          )}
                        >
                          {STUDY_FORMAT_LABELS[f] ?? f}
                        </span>
                      ))
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-xs">
                  {days !== null ? (
                    <span
                      className={cn(
                        "font-mono",
                        URGENCY_CLASS[deadlineUrgency(days)],
                      )}
                    >
                      {i.next_deadline}
                      <span className="ml-1 text-[10px]">
                        ({days < 0 ? "passed" : `${days}d`})
                      </span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-400">
                      unconfirmed
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs">
                  {i.supervisor_required ? (
                    <span className="text-primary">yes</span>
                  ) : (
                    <span className="text-muted-foreground">no</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs">
                  <span
                    className={cn(
                      gre === "required" && "text-destructive",
                      gre === "optional" && "text-muted-foreground",
                      gre === "—" && "text-muted-foreground",
                    )}
                  >
                    {gre}
                  </span>
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-primary">
                  {i.fit_score ? `${i.fit_score}/5` : "—"}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-12 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${readiness(reqs)}%` }}
                      />
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {readiness(reqs)}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Deadline strip — every dated deadline on one horizontal axis, so the
 * pile-up is visible at a glance rather than inferred from a list.
 */
export function DeadlineTimeline({
  institutions,
}: {
  institutions: Institution[];
}) {
  const dated = institutions
    .filter((i) => i.next_deadline)
    .map((i) => ({ inst: i, days: daysUntil(i.next_deadline!) }))
    .filter((d) => d.days >= 0)
    .sort((a, b) => a.days - b.days);

  if (dated.length === 0) return null;

  const maxDays = Math.max(dated[dated.length - 1].days, 30);
  const W = 760;
  const LEFT = 8;
  const RIGHT = 150; // room for the label at the far end
  const span = W - LEFT - RIGHT;
  const rowH = 26;
  const H = dated.length * rowH + 34;

  const x = (days: number) => LEFT + (days / maxDays) * span;

  // Month gridlines at 30-day steps.
  const ticks: number[] = [];
  for (let d = 0; d <= maxDays; d += 30) ticks.push(d);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Upcoming application deadlines on a time axis"
    >
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={x(t)}
            y1={16}
            x2={x(t)}
            y2={H - 14}
            className="stroke-border"
            strokeWidth="1"
          />
          <text
            x={x(t)}
            y={10}
            // The first tick sits on the left edge — centring it clips the word.
            textAnchor={t === 0 ? "start" : "middle"}
            className="fill-muted-foreground"
            fontSize="8"
            fontFamily="var(--font-mono, monospace)"
          >
            {t === 0 ? "today" : `+${t}d`}
          </text>
        </g>
      ))}

      {dated.map((d, idx) => {
        const y = 26 + idx * rowH;
        const urgency = deadlineUrgency(d.days);
        return (
          <g key={d.inst.id}>
            <line
              x1={LEFT}
              y1={y}
              x2={x(d.days)}
              y2={y}
              stroke={URGENCY_FILL[urgency]}
              strokeWidth="1.5"
              strokeDasharray="4 3"
              opacity="0.5"
            />
            <circle
              cx={x(d.days)}
              cy={y}
              r="4.5"
              fill={URGENCY_FILL[urgency]}
              className="stroke-card"
              strokeWidth="2"
            />
            <text
              x={x(d.days) + 10}
              y={y + 3}
              className="fill-foreground"
              fontSize="10"
            >
              {/* Truncate to the room actually left on this row — an early
                  deadline sits far left and can show its full name. */}
              {truncateToWidth(d.inst.name, W - (x(d.days) + 12))}
            </text>
            <text
              x={x(d.days) + 10}
              y={y + 13}
              className="fill-muted-foreground"
              fontSize="8"
              fontFamily="var(--font-mono, monospace)"
            >
              {d.inst.next_deadline} · {d.days}d
            </text>
          </g>
        );
      })}
    </svg>
  );
}
