/* ─── The Case Cube's language ─────────────────────────────────────────
 *  Every tourist emergency asks six questions. On the cube each question is
 *  a face. Two questions whose faces share an edge meet there (12 meetings);
 *  three that share a corner make a big decision (8). Opposite questions
 *  never touch on the surface: they meet only through the core, along three
 *  axes. 29 places in all.
 *
 *  The words are copied from the Case Cube, spec 6, which lives in Tourist
 *  SOS's private repository. Words only: Terra's rules, cases and test sets
 *  stay there. Change a word there first, then here.
 * ────────────────────────────────────────────────────────────────────── */

export const CUBE_SPEC_VERSION = 6;

export const QUESTION_KEYS = ["clinical", "care", "transport", "law", "cover", "language"] as const;
export type QuestionKey = (typeof QUESTION_KEYS)[number];

export type Vec3 = readonly [number, number, number];

export interface Question {
  key: QuestionKey;
  name: string;
  /** The question itself, as a coordinator asks it. */
  question: string;
  /** Its color on the Case Cube, so the two tools read alike. */
  hue: string;
  /** Which way its face points: x to the right, y up, z toward the reader. */
  dir: Vec3;
}

export const QUESTIONS: readonly Question[] = [
  { key: "clinical", name: "Clinical", question: "What's wrong, and is it safe to move?", hue: "#30D158", dir: [0, 0, 1] },
  { key: "care", name: "Care", question: "Where is the right care?", hue: "#0A84FF", dir: [1, 0, 0] },
  { key: "transport", name: "Transport", question: "How do they get there?", hue: "#FF9F0A", dir: [-1, 0, 0] },
  { key: "law", name: "Law", question: "What's allowed here?", hue: "#BF5AF2", dir: [0, 0, -1] },
  { key: "cover", name: "Cover", question: "Who pays?", hue: "#FFD60A", dir: [0, 1, 0] },
  { key: "language", name: "Language", question: "Who speaks, and who decides?", hue: "#64D2FF", dir: [0, -1, 0] },
];

export interface Meeting {
  colors: readonly [QuestionKey, QuestionKey];
  name: string;
  say: string;
}

/** Two questions whose faces share an edge. */
export const MEETINGS: readonly Meeting[] = [
  { colors: ["clinical", "care"], name: "The right destination", say: "What's wrong decides where they can be treated." },
  { colors: ["clinical", "cover"], name: "Medical necessity", say: "The doctor's report that lets the insurer say yes." },
  { colors: ["clinical", "transport"], name: "Fit to move", say: "How they travel depends on how sick they are." },
  { colors: ["clinical", "language"], name: "The history", say: "Symptoms, allergies and consent, in their own words." },
  { colors: ["care", "cover"], name: "The guarantee", say: "The hospital treats; the insurer guarantees the bill." },
  { colors: ["care", "law"], name: "Licensed care", say: "The place must be licensed for the care it gives." },
  { colors: ["care", "language"], name: "At the bedside", say: "Doctors and family understand each other." },
  { colors: ["transport", "cover"], name: "Who pays the ride", say: "Every move has a price someone agrees to." },
  { colors: ["transport", "law"], name: "Permits", say: "Aircraft and ships need permission to land and cross." },
  { colors: ["transport", "language"], name: "The handover", say: "The crew knows the patient's story before they arrive." },
  { colors: ["cover", "law"], name: "Money rules", say: "Currencies and payment rules change at every border." },
  { colors: ["law", "language"], name: "Papers", say: "Passports, visas and reports, explained in their language." },
];

export interface Decision {
  colors: readonly [QuestionKey, QuestionKey, QuestionKey];
  name: string;
  say: string;
}

/** Three questions whose faces share a corner: the big decisions. */
export const DECISIONS: readonly Decision[] = [
  { colors: ["clinical", "care", "cover"], name: "Treatment approved", say: "This treatment, at this hospital, paid for." },
  { colors: ["clinical", "care", "language"], name: "Consent", say: "The patient or family understands and agrees." },
  { colors: ["clinical", "transport", "cover"], name: "The evacuation decision", say: "Needed and safe now, with payment arranged alongside." },
  { colors: ["clinical", "transport", "language"], name: "The escort", say: "Who travels with them, and who explains." },
  { colors: ["law", "care", "cover"], name: "Billing across borders", say: "A foreign hospital, a foreign insurer, one bill." },
  { colors: ["law", "care", "language"], name: "The record", say: "Reports and certificates everyone can read." },
  { colors: ["law", "transport", "cover"], name: "The cross-border medevac", say: "Permits, aircraft and payment, together." },
  { colors: ["law", "transport", "language"], name: "Crossing the border", say: "Immigration for the patient and whoever comes." },
];
