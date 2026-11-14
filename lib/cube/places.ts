/* ─── The 29 places ─────────────────────────────────────────────────────
 *  Built from the language: 6 questions, 12 meetings, 8 big decisions and
 *  3 axes. A place's key is its questions in alphabetical order, joined by
 *  "+": the same key the Case Cube uses, so a place means the same thing in
 *  both tools.
 * ────────────────────────────────────────────────────────────────────── */

import {
  DECISIONS,
  MEETINGS,
  QUESTIONS,
  type QuestionKey,
  type Vec3,
} from "./language";

export type PlaceKind = "question" | "meeting" | "decision" | "axis";

export interface Place {
  key: string;
  kind: PlaceKind;
  /** Its questions, in the cube's own order. */
  colors: readonly QuestionKey[];
  name: string;
  say: string;
  /** Where it points: a question's face, or between the faces it joins.
   *  An axis runs through the middle and has no face of its own. */
  dir: Vec3 | null;
}

export const PLACE_KIND_LABEL: Record<PlaceKind, string> = {
  question: "Question",
  meeting: "Where two meet",
  decision: "Big decision",
  axis: "Through the core",
};

export const AXIS_SAY =
  "Opposite questions. They never touch on the surface and meet only through the core.";

export function placeKey(colors: readonly QuestionKey[]): string {
  return [...colors].sort().join("+");
}

const QUESTION_BY_KEY = new Map(QUESTIONS.map((q) => [q.key, q]));
const ORDER = new Map(QUESTIONS.map((q, i) => [q.key, i]));

export function questionOf(key: QuestionKey) {
  const q = QUESTION_BY_KEY.get(key);
  if (!q) throw new Error(`No question on the cube: ${key}`);
  return q;
}

function inOrder(colors: readonly QuestionKey[]): QuestionKey[] {
  return [...colors].sort((a, b) => ORDER.get(a)! - ORDER.get(b)!);
}

function between(colors: readonly QuestionKey[]): Vec3 {
  const s = [0, 0, 0];
  for (const c of colors) {
    const d = questionOf(c).dir;
    s[0] += d[0];
    s[1] += d[1];
    s[2] += d[2];
  }
  const n = Math.hypot(s[0], s[1], s[2]);
  return [s[0] / n, s[1] / n, s[2] / n];
}

function buildPlaces(): Place[] {
  const out: Place[] = [];
  for (const q of QUESTIONS) {
    out.push({ key: q.key, kind: "question", colors: [q.key], name: q.name, say: q.question, dir: q.dir });
  }
  for (const m of MEETINGS) {
    out.push({ key: placeKey(m.colors), kind: "meeting", colors: inOrder(m.colors), name: m.name, say: m.say, dir: between(m.colors) });
  }
  for (const d of DECISIONS) {
    out.push({ key: placeKey(d.colors), kind: "decision", colors: inOrder(d.colors), name: d.name, say: d.say, dir: between(d.colors) });
  }
  // two questions whose faces point opposite ways share no edge and no corner
  QUESTIONS.forEach((a, i) => {
    QUESTIONS.slice(i + 1).forEach((b) => {
      const dot = a.dir[0] * b.dir[0] + a.dir[1] * b.dir[1] + a.dir[2] * b.dir[2];
      if (dot === -1) {
        out.push({ key: placeKey([a.key, b.key]), kind: "axis", colors: [a.key, b.key], name: `${a.name} ↔ ${b.name}`, say: AXIS_SAY, dir: null });
      }
    });
  });
  return out;
}

export const PLACES: readonly Place[] = buildPlaces();

const PLACE_BY_KEY = new Map(PLACES.map((p) => [p.key, p]));

export function placeOf(key: string): Place {
  const p = PLACE_BY_KEY.get(key);
  if (!p) throw new Error(`No place on the cube: ${key}`);
  return p;
}

/** The places a place touches. A question: its 4 meetings, its 4 big
 *  decisions and its axis. A meeting: its 2 questions and the 2 big
 *  decisions at its ends. A big decision: its 3 questions and the 3
 *  meetings between them. An axis: the 2 questions at its ends. */
export function placesAround(place: Place): Place[] {
  const within = (p: Place) => p.colors.every((c) => place.colors.includes(c));
  const around = (p: Place) => place.colors.every((c) => p.colors.includes(c));
  switch (place.kind) {
    case "question":
      return PLACES.filter((p) => p.kind !== "question" && around(p));
    case "meeting":
      return PLACES.filter((p) => (p.kind === "question" && within(p)) || (p.kind === "decision" && around(p)));
    case "decision":
      return PLACES.filter((p) => (p.kind === "question" || p.kind === "meeting") && within(p));
    case "axis":
      return PLACES.filter((p) => p.kind === "question" && within(p));
  }
}
