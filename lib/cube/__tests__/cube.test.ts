import { describe, expect, it } from "vitest";
import { computeAllMetrics } from "@/lib/data/metrics";
import { EVENT_TYPES } from "@/lib/data/types";
import { DECISIONS, MEETINGS, QUESTIONS } from "../language";
import { PLACES, placeOf, placesAround } from "../places";
import { FACES, rotation, turn, viewFacing } from "../solid";
import {
  CLOCKS,
  EVENT_PLACE,
  RECOMMENDATION_QUESTION,
  clockPlace,
  phdAt,
  phdFindings,
} from "../phd";

const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe("the 29 places", () => {
  it("are 6 questions, 12 meetings, 8 big decisions and 3 axes, each with its own key", () => {
    const count = (k: string) => PLACES.filter((p) => p.kind === k).length;
    expect([count("question"), count("meeting"), count("decision"), count("axis")]).toEqual([6, 12, 8, 3]);
    expect(new Set(PLACES.map((p) => p.key)).size).toBe(29);
  });

  it("join questions the way the cube does: meetings and big decisions share faces, axes face away", () => {
    const dir = new Map(QUESTIONS.map((q) => [q.key, q.dir]));
    for (const m of MEETINGS) expect(dot(dir.get(m.colors[0])!, dir.get(m.colors[1])!)).toBe(0);
    for (const d of DECISIONS) {
      const [a, b, c] = d.colors.map((k) => dir.get(k)!);
      expect([dot(a, b), dot(a, c), dot(b, c)]).toEqual([0, 0, 0]);
    }
    const axes = PLACES.filter((p) => p.kind === "axis");
    expect(axes.map((a) => a.key)).toEqual(["clinical+law", "care+transport", "cover+language"]);
    for (const a of axes) expect(dot(dir.get(a.colors[0])!, dir.get(a.colors[1])!)).toBe(-1);
  });

  it("know what they touch: a question 9 places, a meeting 4, a big decision 6, an axis its 2 ends", () => {
    const kinds = (key: string) => {
      const n = { question: 0, meeting: 0, decision: 0, axis: 0 };
      for (const p of placesAround(placeOf(key))) n[p.kind]++;
      return [n.question, n.meeting, n.decision, n.axis];
    };
    for (const p of PLACES) {
      const want = { question: [0, 4, 4, 1], meeting: [2, 0, 2, 0], decision: [3, 3, 0, 0], axis: [2, 0, 0, 0] }[p.kind];
      expect(kinds(p.key)).toEqual(want);
    }
    // and touching runs both ways
    for (const p of PLACES) for (const q of placesAround(p)) expect(placesAround(q).map((r) => r.key)).toContain(p.key);
  });
});

describe("the 26-faced solid", () => {
  it("has 6 octagons, 12 squares and 8 hexagons, one face for every place but the axes", () => {
    const sides = (k: string) => FACES.filter((f) => f.kind === k).map((f) => f.points.length);
    expect(sides("question")).toEqual(Array(6).fill(8));
    expect(sides("meeting")).toEqual(Array(12).fill(4));
    expect(sides("decision")).toEqual(Array(8).fill(6));
    expect(FACES.map((f) => f.key).sort()).toEqual(PLACES.filter((p) => p.kind !== "axis").map((p) => p.key).sort());
  });

  it("is a true Archimedean solid: every corner on one sphere, every edge one length, every face flat and in order", () => {
    const edges: number[] = [];
    for (const f of FACES) {
      const plane = dot(f.points[0], f.normal);
      f.points.forEach((p, i) => {
        expect(Math.hypot(p[0], p[1], p[2])).toBeCloseTo(1, 9);
        expect(dot(p, f.normal)).toBeCloseTo(plane, 9);
        const q = f.points[(i + 1) % f.points.length];
        edges.push(dist(p, q));
        // walking the corners turns the same way as the outward normal: convex, in order
        const a = [p[0] - f.center[0], p[1] - f.center[1], p[2] - f.center[2]];
        const b = [q[0] - f.center[0], q[1] - f.center[1], q[2] - f.center[2]];
        const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
        expect(dot(c, f.normal)).toBeGreaterThan(0);
      });
    }
    for (const e of edges) expect(e).toBeCloseTo(edges[0], 9);
  });

  it("turns without stretching, and can face any place toward the reader", () => {
    const m = rotation(-35, 25);
    for (const r of m) expect(Math.hypot(r[0], r[1], r[2])).toBeCloseTo(1, 12);
    expect(dot(m[0], m[1])).toBeCloseTo(0, 12);
    for (const f of FACES) {
      const v = viewFacing(f.normal);
      const facing = turn(rotation(v.yaw, v.pitch), f.normal);
      expect(facing[2]).toBeGreaterThan(0.85);
      // and it is the face nearest the reader
      const nearest = FACES.reduce((best, g) => (turn(rotation(v.yaw, v.pitch), g.normal)[2] > turn(rotation(v.yaw, v.pitch), best.normal)[2] ? g : best));
      expect(nearest.key).toBe(f.key);
    }
  });
});

describe("the PhD on the cube", () => {
  it("places every milestone the event spine records, except first contact and notes", () => {
    const placed = Object.keys(EVENT_PLACE).sort();
    expect(placed).toEqual(EVENT_TYPES.filter((e) => e !== "FIRST_CONTACT" && e !== "NOTE").sort());
    for (const key of Object.values(EVENT_PLACE)) expect(() => placeOf(key)).not.toThrow();
  });

  it("stops each clock at the event lib/data/metrics.ts stops it at, and puts the clock where that event sits", () => {
    const metrics = computeAllMetrics([]).map((m) => [m.abbreviation, m.from_event, m.to_event]);
    expect(metrics).toEqual(CLOCKS.map((c) => [c.abbr, "FIRST_CONTACT", c.stop]));
    for (const c of CLOCKS) expect(phdAt(clockPlace(c)).events).toContain(c.stop);
    expect(CLOCKS.map((c) => placeOf(clockPlace(c)).name)).toEqual(["Fit to move", "The guarantee", "The right destination"]);
  });

  it("counts what the instrument sees: 4 of 6 questions, and 6 of the 8 big decisions touch the 2 it can't", () => {
    const f = phdFindings();
    expect(f.places).toBe(29);
    expect(f.clockPlaces).toHaveLength(3);
    expect(f.questionsReached).toEqual(["clinical", "care", "transport", "cover"]);
    expect(f.questionsUnseen).toEqual(["law", "language"]);
    expect([f.decisionsTouchingUnseen, f.decisions]).toEqual([6, 8]);
    expect(f.recommendable).toEqual(["clinical", "care", "transport", "cover"]);
    expect(f.notRecommendable).toEqual(["law", "language"]);
  });

  it("maps each recommendation category to a question only where there is one", () => {
    const q = Object.entries(RECOMMENDATION_QUESTION);
    expect(q.filter(([, v]) => v !== null).map(([k]) => k).sort()).toEqual(["facility", "payment", "transport", "triage"]);
    for (const [category, question] of q) if (question) expect(phdAt(question).recommendations).toContain(category);
  });
});
