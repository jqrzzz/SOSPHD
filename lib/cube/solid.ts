/* ─── The 26-faced solid ────────────────────────────────────────────────
 *  The truncated cuboctahedron: 6 octagons (the questions), 12 squares
 *  (where two meet) and 8 hexagons (the big decisions). It is the Case
 *  Cube's Level 2 shape, where every meeting of questions is a face of its
 *  own. Its 48 corners are every ordering of (1, 1+√2, 1+2√2) with every
 *  choice of signs; a face is the set of corners furthest along its
 *  direction. Pure math, no DOM: the figure draws what this returns.
 * ────────────────────────────────────────────────────────────────────── */

import type { Vec3 } from "./language";
import { PLACES, type PlaceKind } from "./places";

export interface Face {
  key: string;
  kind: Exclude<PlaceKind, "axis">;
  /** Outward unit normal. */
  normal: Vec3;
  /** Its corners in order around the face, on the unit circumsphere. */
  points: Vec3[];
  center: Vec3;
}

export type Mat3 = readonly [Vec3, Vec3, Vec3];

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a: Vec3): Vec3 => {
  const n = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / n, a[1] / n, a[2] / n];
};

function corners(): Vec3[] {
  const r2 = Math.SQRT2;
  const abc = [1, 1 + r2, 1 + 2 * r2];
  const R = Math.hypot(abc[0], abc[1], abc[2]);
  const perms = [
    [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
  ];
  const out: Vec3[] = [];
  for (const p of perms) {
    for (let s = 0; s < 8; s++) {
      out.push([
        ((s & 1 ? -1 : 1) * abc[p[0]]) / R,
        ((s & 2 ? -1 : 1) * abc[p[1]]) / R,
        ((s & 4 ? -1 : 1) * abc[p[2]]) / R,
      ]);
    }
  }
  return out;
}

function buildFaces(): Face[] {
  const all = corners();
  const faces: Face[] = [];
  for (const place of PLACES) {
    if (!place.dir || place.kind === "axis") continue;
    const n = place.dir;
    const far = Math.max(...all.map((v) => dot(v, n)));
    const pts = all.filter((v) => dot(v, n) > far - 1e-9);
    const c: Vec3 = [
      pts.reduce((s, v) => s + v[0], 0) / pts.length,
      pts.reduce((s, v) => s + v[1], 0) / pts.length,
      pts.reduce((s, v) => s + v[2], 0) / pts.length,
    ];
    const u = unit(sub(pts[0], c));
    const w = cross(n, u);
    pts.sort((a, b) => {
      const da = sub(a, c);
      const db = sub(b, c);
      return Math.atan2(dot(da, w), dot(da, u)) - Math.atan2(dot(db, w), dot(db, u));
    });
    faces.push({ key: place.key, kind: place.kind, normal: n, points: pts, center: c });
  }
  return faces;
}

export const FACES: readonly Face[] = buildFaces();

/* ── Turning it ─────────────────────────────────────────────────────── */

/** Turn about the vertical axis by yaw, then tip by pitch (degrees). */
export function rotation(yawDeg: number, pitchDeg: number): Mat3 {
  const y = (yawDeg * Math.PI) / 180;
  const p = (pitchDeg * Math.PI) / 180;
  const cy = Math.cos(y), sy = Math.sin(y), cp = Math.cos(p), sp = Math.sin(p);
  // rows of Rx(pitch) · Ry(yaw)
  return [
    [cy, 0, sy],
    [sp * sy, cp, -sp * cy],
    [-cp * sy, sp, cp * cy],
  ];
}

export function turn(m: Mat3, v: Vec3): Vec3 {
  return [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
}

/** Screen position of a turned point: a gentle perspective, y down as SVG draws. */
export function project(v: Vec3, scale: number, depth = 5): [number, number] {
  const k = depth / (depth - v[2]);
  return [v[0] * scale * k, -v[1] * scale * k];
}

/** The view that faces a direction toward the reader, a little off-square so it keeps its depth. */
export function viewFacing(dir: Vec3): { yaw: number; pitch: number } {
  const deg = 180 / Math.PI;
  const yaw = Math.atan2(-dir[0], dir[2]) * deg;
  const pitch = Math.atan2(dir[1], Math.hypot(dir[0], dir[2])) * deg;
  return { yaw: yaw - 14, pitch: Math.max(-78, Math.min(78, pitch + 12)) };
}
