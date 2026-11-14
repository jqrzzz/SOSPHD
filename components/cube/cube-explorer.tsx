"use client";

/* ─── The cube explorer ────────────────────────────────────────────────
 *  The 26-faced solid, turned by drag or the arrow keys; the place you
 *  choose, with what the PhD records there; and every place as a list,
 *  which is also the way in for a keyboard or a screen reader. Colors
 *  carry one meaning: teal is where the PhD's instrument records, strong
 *  where a clock stops. The six question colors are the Case Cube's own,
 *  so the two tools read alike.
 * ────────────────────────────────────────────────────────────────────── */

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { EVENT_TYPE_LABELS } from "@/lib/data/types";
import type { QuestionKey, Vec3 } from "@/lib/cube/language";
import {
  PLACES,
  PLACE_KIND_LABEL,
  placeOf,
  placesAround,
  questionOf,
  type Place,
  type PlaceKind,
} from "@/lib/cube/places";
import { FACES, project, rotation, turn, viewFacing, type Face } from "@/lib/cube/solid";
import { phdAt, recorded } from "@/lib/cube/phd";
import { cn } from "@/lib/utils";

/** The solid's radius in drawing units. */
const R = 200;
const START = { yaw: -35, pitch: 25 };
/** The guarantee, where TTGP stops: the thesis's payment clock. */
const FIRST_PLACE = "care+cover";

type View = { yaw: number; pitch: number };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const xy = (p: [number, number]) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
const scale = (v: Vec3, k: number): Vec3 => [v[0] * k, v[1] * k, v[2] * k];
const faceOf = (key: string) => FACES.find((f) => f.key === key);

function Dots({ colors }: { colors: readonly QuestionKey[] }) {
  return (
    <span className="inline-flex shrink-0 gap-0.5" aria-hidden="true">
      {colors.map((c) => (
        <span key={c} className="h-2 w-2 rounded-full" style={{ background: questionOf(c).hue }} />
      ))}
    </span>
  );
}

/* ── The solid ──────────────────────────────────────────────────────── */

function Solid({
  selected,
  focus,
  onSelect,
}: {
  selected: string;
  /** Bumped when a place is chosen from a list, so the solid turns to it. */
  focus: number;
  onSelect: (key: string) => void;
}) {
  const [view, setView] = useState<View>(START);
  const viewRef = useRef<View>(START);
  const raf = useRef(0);
  const handled = useRef(0);
  const drag = useRef<{ x: number; y: number; from: View; moved: boolean; key: string | null } | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // A place chosen from a list turns toward the reader, unless it already
  // faces them; a face tapped on the solid is already in view. An axis runs
  // through the middle, so it only turns when seen end-on, back to the
  // first view, where all three axes lie across the page.
  useEffect(() => {
    if (!focus || focus === handled.current) return;
    handled.current = focus;
    const place = placeOf(selected);
    const from = viewRef.current;
    const m = rotation(from.yaw, from.pitch);
    let goal: View | null = null;
    if (place.kind === "axis") {
      if (Math.abs(turn(m, questionOf(place.colors[0]).dir)[2]) > 0.8) goal = START;
    } else if (place.dir && turn(m, place.dir)[2] <= 0.7) {
      goal = viewFacing(place.dir);
    }
    if (!goal) return;
    const to = goal;
    const dYaw = ((((to.yaw - from.yaw) % 360) + 540) % 360) - 180;
    if (reduce) {
      setView({ yaw: from.yaw + dYaw, pitch: to.pitch });
      return;
    }
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 520);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      setView({ yaw: from.yaw + dYaw * e, pitch: from.pitch + (to.pitch - from.pitch) * e });
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [focus, selected, reduce]);

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    cancelAnimationFrame(raf.current);
    const hit = (e.target as Element).closest("[data-key]");
    drag.current = { x: e.clientX, y: e.clientY, from: viewRef.current, moved: false, key: hit?.getAttribute("data-key") ?? null };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    d.moved = true;
    setView({ yaw: d.from.yaw + dx * 0.45, pitch: clamp(d.from.pitch + dy * 0.45, -80, 80) });
  }
  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved && d.key) onSelect(d.key);
  }
  function onKeyDown(e: React.KeyboardEvent<SVGSVGElement>) {
    const k = ({ ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] } as Record<string, [number, number]>)[e.key];
    if (!k) return;
    e.preventDefault();
    cancelAnimationFrame(raf.current);
    setView((v) => ({ yaw: v.yaw + k[0], pitch: clamp(v.pitch + k[1], -80, 80) }));
  }

  const m = rotation(view.yaw, view.pitch);
  const shown = FACES.map((f) => ({ f, lit: turn(m, f.normal)[2] })).filter((s) => s.lit > 0.001);
  const outline = (f: Face) => f.points.map((p) => xy(project(turn(m, p), R))).join(" ");
  const place = placeOf(selected);
  // the chosen face, or both ends of a chosen axis
  const ringed: readonly string[] = place.kind === "axis" ? place.colors : [place.key];

  // an axis: from the far question's octagon, through the core, to the near
  // one; each end stands just off its face, clear of the face's name
  let axis: { far: [number, number]; near: [number, number]; farHue: string; nearHue: string } | null = null;
  if (place.kind === "axis") {
    const ends = place.colors.map((c) => ({ p: turn(m, scale(faceOf(c)!.center, 1.42)), hue: questionOf(c).hue }));
    const [far, near] = ends[0].p[2] < ends[1].p[2] ? ends : [ends[1], ends[0]];
    axis = { far: project(far.p, R), near: project(near.p, R), farHue: far.hue, nearHue: near.hue };
  }

  return (
    <svg
      viewBox="-262 -262 524 524"
      role="img"
      aria-label="The cube's 26 faces: six questions, twelve meetings and eight big decisions. Drag, or use the arrow keys, to turn it; tap a face to read it."
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onKeyDown={onKeyDown}
      className="h-auto w-full max-w-[460px] cursor-grab touch-pan-y select-none rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
    >
      {shown.map(({ f, lit }) => {
        const at = phdAt(f.key);
        const clock = at.clocks.length > 0;
        const seen = recorded(f.key);
        const question = f.kind === "question";
        return (
          <polygon
            key={f.key}
            data-key={f.key}
            points={outline(f)}
            fill={seen ? "hsl(var(--chart-1))" : "hsl(var(--foreground))"}
            fillOpacity={clock ? 0.42 + 0.42 * lit : seen ? 0.14 + 0.26 * lit : 0.03 + 0.1 * lit}
            stroke={question ? questionOf(f.key as QuestionKey).hue : "hsl(var(--foreground))"}
            strokeOpacity={question ? 0.85 : 0.16}
            strokeWidth={question ? 1.75 : 1}
            strokeLinejoin="round"
            className="cursor-pointer transition-[filter] hover:brightness-150"
          />
        );
      })}

      {shown
        .filter(({ f }) => ringed.includes(f.key))
        .map(({ f }) => (
          <polygon
            key={`ring-${f.key}`}
            points={outline(f)}
            fill="none"
            stroke="hsl(var(--foreground))"
            strokeWidth={2.5}
            strokeLinejoin="round"
            className="pointer-events-none"
          />
        ))}

      {/* the half going away is dashed and faint, the near half solid */}
      {axis && (
        <g className="pointer-events-none">
          <line x1={axis.far[0]} y1={axis.far[1]} x2={0} y2={0} stroke="hsl(var(--foreground))" strokeWidth={2} strokeDasharray="4 5" strokeLinecap="round" opacity={0.55} />
          <line x1={0} y1={0} x2={axis.near[0]} y2={axis.near[1]} stroke="hsl(var(--foreground))" strokeWidth={2.4} strokeLinecap="round" />
          <circle cx={axis.far[0]} cy={axis.far[1]} r={5} fill={axis.farHue} stroke="hsl(var(--foreground))" strokeWidth={1.5} opacity={0.6} />
          <circle cx={axis.near[0]} cy={axis.near[1]} r={5} fill={axis.nearHue} stroke="hsl(var(--foreground))" strokeWidth={1.5} />
          <circle cx={0} cy={0} r={3.4} fill="hsl(var(--foreground))" />
        </g>
      )}

      {/* names last, so a line never crosses out a word */}
      {shown.map(({ f, lit }) => {
        const c = project(turn(m, f.center), R);
        const clock = phdAt(f.key).clocks[0];
        if (f.kind === "question" && lit > 0.3) {
          return (
            <text key={`label-${f.key}`} x={c[0]} y={c[1]} textAnchor="middle" dominantBaseline="central" fontSize={12.5} fontWeight={600} fill="hsl(var(--foreground))" fillOpacity={0.45 + 0.5 * lit} className="pointer-events-none select-none">
              {questionOf(f.key as QuestionKey).name}
            </text>
          );
        }
        if (clock && lit > 0.45) {
          return (
            <text key={`label-${f.key}`} x={c[0]} y={c[1]} textAnchor="middle" dominantBaseline="central" fontSize={10.5} fontWeight={600} fill="hsl(var(--primary-foreground))" className="pointer-events-none select-none font-mono">
              {clock.abbr}
            </text>
          );
        }
        return null;
      })}
    </svg>
  );
}

/* ── The chosen place ───────────────────────────────────────────────── */

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="mr-2 inline-flex w-16 shrink-0 justify-center rounded border border-border/80 px-1.5 py-px font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
      {children}
    </span>
  );
}

function Chip({ place, selected, onChoose }: { place: Place; selected?: boolean; onChoose: (key: string) => void }) {
  const at = phdAt(place.key);
  const clock = at.clocks[0];
  const seen = recorded(place.key);
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onChoose(place.key)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
        selected
          ? "border-primary/60 bg-primary/15 text-foreground"
          : "border-border/70 text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      <Dots colors={place.colors} />
      {place.name}
      {clock ? (
        <span className="font-mono text-[9px] font-semibold text-primary">{clock.abbr}</span>
      ) : seen ? (
        <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
      ) : null}
      {seen && <span className="sr-only">, recorded by the PhD</span>}
    </button>
  );
}

function PlaceDetail({ place, onChoose }: { place: Place; onChoose: (key: string) => void }) {
  const at = phdAt(place.key);
  const nothing = at.events.length + at.clocks.length + at.recommendations.length === 0;
  const around = placesAround(place);
  const aroundSeen = around.filter((p) => recorded(p.key)).length;
  return (
    <div className="flex flex-col gap-5" aria-live="polite">
      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-primary/90">{PLACE_KIND_LABEL[place.kind]}</span>
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
          <Dots colors={place.colors} />
          {place.name}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{place.say}</p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">In the PhD</h3>
        {nothing ? (
          <p className="text-sm text-muted-foreground">Nothing recorded here yet.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm text-foreground">
            {at.clocks.map((c) => (
              <li key={c.abbr} className="flex items-baseline">
                <Tag>Clock</Tag>
                <span>
                  <span className="font-mono font-semibold text-primary">{c.abbr}</span> {c.name} stops here
                </span>
              </li>
            ))}
            {at.events.map((e) => (
              <li key={e} className="flex items-baseline">
                <Tag>Event</Tag>
                <span>{EVENT_TYPE_LABELS[e]}</span>
              </li>
            ))}
            {at.recommendations.length > 0 && (
              <li className="flex items-baseline">
                <Tag>Paper 2</Tag>
                <span>Recommends on {at.recommendations.join(", ")}</span>
              </li>
            )}
          </ul>
        )}
      </div>

      {around.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Around it · {aroundSeen} of {around.length} recorded
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {around.map((p) => (
              <Chip key={p.key} place={p} onChoose={onChoose} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Everything together ────────────────────────────────────────────── */

const GROUPS: { kind: PlaceKind; label: (n: number) => string }[] = [
  { kind: "question", label: (n) => `${n} questions` },
  { kind: "meeting", label: (n) => `${n} meetings of two` },
  { kind: "decision", label: (n) => `${n} big decisions` },
  { kind: "axis", label: (n) => `${n} axes through the core` },
];

function Legend() {
  const swatch = (opacity: number, filled: boolean) => (
    <span
      className="inline-block h-2.5 w-2.5 rounded-sm border border-foreground/20"
      style={filled ? { background: `hsl(var(--chart-1) / ${opacity})` } : undefined}
      aria-hidden="true"
    />
  );
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 font-mono text-[10px] text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">{swatch(0.8, true)} a clock stops here</span>
      <span className="inline-flex items-center gap-1.5">{swatch(0.35, true)} an event is recorded</span>
      <span className="inline-flex items-center gap-1.5">{swatch(0, false)} nothing recorded yet</span>
    </div>
  );
}

export function CubeExplorer() {
  const [selected, setSelected] = useState(FIRST_PLACE);
  const [focus, setFocus] = useState(0);
  const detail = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const choose = (key: string) => {
    setSelected(key);
    setFocus((n) => n + 1);
  };
  // the full list sits below the solid: a choice there scrolls back up to it
  const chooseFromList = (key: string) => {
    choose(key);
    const el = detail.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) {
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "end" });
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-4 sm:p-6">
          <Solid selected={selected} focus={focus} onSelect={setSelected} />
          <Legend />
          <p className="font-mono text-[10px] text-muted-foreground/70">Drag to turn · tap a face</p>
        </CardContent>
      </Card>

      <Card ref={detail} className="scroll-mb-4">
        <CardContent className="p-5">
          <PlaceDetail place={placeOf(selected)} onChoose={choose} />
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardContent className="flex flex-col gap-4 p-5">
          {GROUPS.map((g) => {
            const places = PLACES.filter((p) => p.kind === g.kind);
            return (
              <div key={g.kind} className="flex flex-col gap-2">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{g.label(places.length)}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {places.map((p) => (
                    <Chip key={p.key} place={p} selected={p.key === selected} onChoose={chooseFromList} />
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
