/* ─── Process diagrams ─────────────────────────────────────────────────
 *  Small inline-SVG visuals that explain the program's mechanisms at a
 *  glance. Server-safe (no state), theme-token colored, responsive via
 *  viewBox. Visual language: hairline strokes, teal data hue for
 *  coordination signals (dashed = in motion, a nod to the Signal mark's
 *  Morse rings), the brand red reserved for the emergency moment.
 * ────────────────────────────────────────────────────────────────────── */

const TEAL = "hsl(var(--chart-1))";
const RED = "hsl(var(--destructive))";

// ── 1. Coordination timeline — what TTTA/TTGP/TTDC actually measure ──

const MILESTONES = [
  { key: "FIRST_CONTACT", label: "First contact", red: true },
  { key: "TRIAGE_COMPLETE", label: "Triage" },
  { key: "TRANSPORT_ACTIVATED", label: "Transport activated" },
  { key: "FACILITY_ARRIVAL", label: "Facility arrival" },
  { key: "GUARANTEED_PAYMENT", label: "Payment guaranteed" },
  { key: "DEFINITIVE_CARE_START", label: "Definitive care" },
  { key: "DISCHARGE", label: "Discharge" },
];

const METRIC_BRACES = [
  { label: "TTTA", toIndex: 2, y: 118 },
  { label: "TTGP", toIndex: 4, y: 143 },
  { label: "TTDC", toIndex: 5, y: 168 },
];

export function CoordinationTimeline() {
  const X0 = 46;
  const SPAN = 668;
  const x = (i: number) => X0 + (i * SPAN) / (MILESTONES.length - 1);
  const AXIS_Y = 62;

  return (
    <svg
      viewBox="0 0 760 196"
      className="w-full"
      role="img"
      aria-label="Coordination timeline: the three metrics all start at first contact — TTTA ends at transport activation, TTGP at payment guarantee, TTDC at definitive care start"
    >
      {/* the case timeline */}
      <line
        x1={X0}
        y1={AXIS_Y}
        x2={X0 + SPAN}
        y2={AXIS_Y}
        stroke={TEAL}
        strokeWidth="1.5"
        strokeDasharray="7 4"
        opacity="0.55"
      />

      {MILESTONES.map((m, i) => {
        const above = i % 2 === 0;
        return (
          <g key={m.key}>
            <circle
              cx={x(i)}
              cy={AXIS_Y}
              r={m.red ? 6 : 4.5}
              fill={m.red ? RED : TEAL}
              className="stroke-card"
              strokeWidth="2"
            />
            <text
              x={x(i)}
              y={above ? AXIS_Y - 16 : AXIS_Y + 24}
              textAnchor="middle"
              className="fill-foreground"
              fontSize="10.5"
              fontWeight="500"
            >
              {m.label}
            </text>
            <text
              x={x(i)}
              y={above ? AXIS_Y - 30 : AXIS_Y + 37}
              textAnchor="middle"
              className="fill-muted-foreground"
              fontSize="7.5"
              fontFamily="var(--font-mono, monospace)"
            >
              {m.key}
            </text>
          </g>
        );
      })}

      {/* metric braces — every clock starts at FIRST_CONTACT */}
      {METRIC_BRACES.map((b) => {
        const x1 = x(0);
        const x2 = x(b.toIndex);
        const mid = (x1 + x2) / 2;
        return (
          <g key={b.label}>
            <line x1={x1} y1={b.y} x2={x2} y2={b.y} stroke={TEAL} strokeWidth="1" opacity="0.7" />
            <line x1={x1} y1={b.y - 4} x2={x1} y2={b.y + 4} stroke={TEAL} strokeWidth="1" opacity="0.7" />
            <line x1={x2} y1={b.y - 4} x2={x2} y2={b.y + 4} stroke={TEAL} strokeWidth="1" opacity="0.7" />
            <rect
              x={mid - 24}
              y={b.y - 9}
              width="48"
              height="16"
              rx="8"
              className="fill-card stroke-border"
              strokeWidth="1"
            />
            <text
              x={mid}
              y={b.y + 3}
              textAnchor="middle"
              className="fill-foreground"
              fontSize="9.5"
              fontWeight="600"
              fontFamily="var(--font-mono, monospace)"
            >
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── 2. Research pipeline — how field work becomes papers ─────────────

const PIPELINE_STAGES = [
  { title: "Field capture", sub: "journal · contacts · uploads" },
  { title: "Research spine", sub: "cases · events · decisions" },
  { title: "Metrics", sub: "TTTA · TTGP · TTDC" },
  { title: "Papers", sub: "baseline · human-AI · wedge" },
];

export function ResearchPipeline() {
  const BOX_W = 150;
  const BOX_H = 52;
  const GAP = 46;
  const X0 = 22;
  const Y = 34;

  return (
    <svg
      viewBox="0 0 760 168"
      className="w-full"
      role="img"
      aria-label="Research pipeline: field capture and operational triggers feed the research spine, which computes metrics, which fill the papers"
    >
      <defs>
        <marker id="pd-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M 0 0.5 L 7.5 4 L 0 7.5" fill="none" stroke={TEAL} strokeWidth="1.4" />
        </marker>
      </defs>

      {PIPELINE_STAGES.map((s, i) => {
        const bx = X0 + i * (BOX_W + GAP);
        return (
          <g key={s.title}>
            <rect
              x={bx}
              y={Y}
              width={BOX_W}
              height={BOX_H}
              rx="10"
              className="fill-card stroke-border"
              strokeWidth="1"
            />
            <text x={bx + BOX_W / 2} y={Y + 22} textAnchor="middle" className="fill-foreground" fontSize="11.5" fontWeight="600">
              {s.title}
            </text>
            <text x={bx + BOX_W / 2} y={Y + 38} textAnchor="middle" className="fill-muted-foreground" fontSize="8.5" fontFamily="var(--font-mono, monospace)">
              {s.sub}
            </text>
            {i < PIPELINE_STAGES.length - 1 && (
              <line
                x1={bx + BOX_W + 4}
                y1={Y + BOX_H / 2}
                x2={bx + BOX_W + GAP - 6}
                y2={Y + BOX_H / 2}
                stroke={TEAL}
                strokeWidth="1.4"
                strokeDasharray="6 4"
                markerEnd="url(#pd-arrow)"
              />
            )}
          </g>
        );
      })}

      {/* side feeds: who writes into the first two stages */}
      <SideFeed x={X0 + BOX_W / 2} label="you + agents (MCP)" sub="notes · observations" boxY={Y + BOX_H} />
      <SideFeed x={X0 + BOX_W + GAP + BOX_W / 2} label="SOSCOMMAND triggers" sub="operational milestones" boxY={Y + BOX_H} />
    </svg>
  );
}

function SideFeed({ x, label, sub, boxY }: { x: number; label: string; sub: string; boxY: number }) {
  const y = boxY + 44;
  return (
    <g>
      <line x1={x} y1={y - 10} x2={x} y2={boxY + 6} stroke={TEAL} strokeWidth="1.2" strokeDasharray="3 3" markerEnd="url(#pd-arrow)" opacity="0.8" />
      <text x={x} y={y + 4} textAnchor="middle" className="fill-foreground" fontSize="9.5" fontWeight="500">
        {label}
      </text>
      <text x={x} y={y + 16} textAnchor="middle" className="fill-muted-foreground" fontSize="8">
        {sub}
      </text>
    </g>
  );
}

// ── 3. Corridor journey — what one evacuation actually traverses ────

const JOURNEY_STOPS = [
  { t: 0, label: "Incident", sub: "island / province", red: true },
  { t: 0.22, label: "Local clinic", sub: "stabilize · assess" },
  { t: 0.47, label: "Payer contact", sub: "GOP negotiated" },
  { t: 0.72, label: "Transport", sub: "road · boat · air" },
  { t: 1, label: "Bangkok", sub: "definitive care" },
];

export function CorridorJourney() {
  const X0 = 50;
  const SPAN = 660;
  // gentle arc: stops sit on a shallow curve so it reads as a journey
  const px = (t: number) => X0 + t * SPAN;
  const py = (t: number) => 74 - Math.sin(t * Math.PI) * 26;

  const pathD = JOURNEY_STOPS.map((s, i) =>
    i === 0 ? `M ${px(s.t)} ${py(s.t)}` : `L ${px(s.t)} ${py(s.t)}`,
  ).join(" ");

  return (
    <svg
      viewBox="0 0 760 140"
      className="w-full"
      role="img"
      aria-label="A corridor journey from incident through local clinic, payment guarantee, transport, and definitive care in Bangkok. The journey starts at the incident; TTTA, TTGP, and TTDC start at FIRST_CONTACT."
    >
      <path d={pathD} fill="none" stroke={TEAL} strokeWidth="1.5" strokeDasharray="7 4" opacity="0.6" />
      {JOURNEY_STOPS.map((s) => (
        <g key={s.label}>
          <circle
            cx={px(s.t)}
            cy={py(s.t)}
            r={s.red ? 6 : 4.5}
            fill={s.red ? RED : TEAL}
            className="stroke-card"
            strokeWidth="2"
          />
          <text x={px(s.t)} y={py(s.t) + 24} textAnchor="middle" className="fill-foreground" fontSize="10.5" fontWeight="500">
            {s.label}
          </text>
          <text x={px(s.t)} y={py(s.t) + 37} textAnchor="middle" className="fill-muted-foreground" fontSize="8.5">
            {s.sub}
          </text>
        </g>
      ))}
      {/* The journey starts at incident; research clocks start at contact. */}
      <text x={X0 + SPAN / 2} y={126} textAnchor="middle" className="fill-muted-foreground" fontSize="8.5" fontFamily="var(--font-mono, monospace)">
        Journey starts at incident · TTTA · TTGP · TTDC start at FIRST_CONTACT
      </text>
    </svg>
  );
}
