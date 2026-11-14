/* ─── The PhD on the cube ──────────────────────────────────────────────
 *  Where the PhD's own instrument sits among the 29 places: the milestone
 *  events the event spine records, the three clocks they stop, and the
 *  questions Paper 2's recommendation engine can speak to. Everything on
 *  /cube is counted from these tables, never typed in by hand.
 *
 *  The placements are a reading of the instrument, not a finding: each is
 *  the owner's to confirm or move. One rule keeps them honest: a clock
 *  sits where the event that stops it sits.
 * ────────────────────────────────────────────────────────────────────── */

import type { EventType } from "@/lib/data/types";
import type { RecommendationCategory } from "@/lib/recommendations";
import { DECISIONS, QUESTION_KEYS, type QuestionKey } from "./language";
import { PLACES, placeOf, placeKey, type Place } from "./places";

/** Events that answer a question. FIRST_CONTACT starts every clock and
 *  belongs to no single question; NOTE is free text. */
export type PlacedEvent = Exclude<EventType, "FIRST_CONTACT" | "NOTE">;

export const EVENT_PLACE: Record<PlacedEvent, string> = {
  // what's wrong, and is it safe to move
  TRIAGE_COMPLETE: placeKey(["clinical"]),
  // an asset and crew committed for this patient: Fit to move
  TRANSPORT_ACTIVATED: placeKey(["clinical", "transport"]),
  // the ride ends at the care: transport and care meet through the core
  FACILITY_ARRIVAL: placeKey(["care", "transport"]),
  // the hospital treats; the insurer guarantees the bill
  GUARANTEED_PAYMENT: placeKey(["care", "cover"]),
  // what's wrong, treated at the right place
  DEFINITIVE_CARE_START: placeKey(["clinical", "care"]),
  DISCHARGE: placeKey(["care"]),
};

export interface Clock {
  abbr: "TTTA" | "TTGP" | "TTDC";
  name: string;
  /** The event that stops it (every clock starts at FIRST_CONTACT). */
  stop: PlacedEvent;
}

/** The PhD's three clocks, in lib/data/metrics.ts order. */
export const CLOCKS: readonly Clock[] = [
  { abbr: "TTTA", name: "Time to Transport Activation", stop: "TRANSPORT_ACTIVATED" },
  { abbr: "TTGP", name: "Time to Guaranteed Payment", stop: "GUARANTEED_PAYMENT" },
  { abbr: "TTDC", name: "Time to Definitive Care", stop: "DEFINITIVE_CARE_START" },
];

export function clockPlace(clock: Clock): string {
  return EVENT_PLACE[clock.stop];
}

/** The question each Paper 2 recommendation category speaks to, if one. */
export const RECOMMENDATION_QUESTION: Record<RecommendationCategory, QuestionKey | null> = {
  triage: "clinical",
  facility: "care",
  transport: "transport",
  payment: "cover",
  follow_up: null,
  data_capture: null,
  other: null,
};

export interface PhdAtPlace {
  events: PlacedEvent[];
  clocks: Clock[];
  recommendations: RecommendationCategory[];
}

const EMPTY: PhdAtPlace = { events: [], clocks: [], recommendations: [] };

function buildAtPlace(): Map<string, PhdAtPlace> {
  const at = new Map<string, PhdAtPlace>();
  const slot = (key: string) => {
    placeOf(key); // a mistyped key fails loudly, here, not on screen
    let s = at.get(key);
    if (!s) {
      s = { events: [], clocks: [], recommendations: [] };
      at.set(key, s);
    }
    return s;
  };
  for (const [event, key] of Object.entries(EVENT_PLACE) as [PlacedEvent, string][]) {
    slot(key).events.push(event);
  }
  for (const clock of CLOCKS) slot(clockPlace(clock)).clocks.push(clock);
  for (const [category, q] of Object.entries(RECOMMENDATION_QUESTION) as [RecommendationCategory, QuestionKey | null][]) {
    if (q) slot(q).recommendations.push(category);
  }
  return at;
}

const AT_PLACE = buildAtPlace();

export function phdAt(key: string): PhdAtPlace {
  return AT_PLACE.get(key) ?? EMPTY;
}

/** Whether the instrument records anything at a place: an event or a clock. */
export function recorded(key: string): boolean {
  const s = phdAt(key);
  return s.events.length > 0 || s.clocks.length > 0;
}

export interface PhdFindings {
  places: number;
  clockPlaces: Place[];
  questionsReached: QuestionKey[];
  questionsUnseen: QuestionKey[];
  decisions: number;
  decisionsTouchingUnseen: number;
  recommendable: QuestionKey[];
  notRecommendable: QuestionKey[];
}

/** What the instrument sees, counted. */
export function phdFindings(): PhdFindings {
  const reached = new Set<QuestionKey>();
  for (const key of Object.values(EVENT_PLACE)) {
    for (const q of placeOf(key).colors) reached.add(q);
  }
  const unseen = QUESTION_KEYS.filter((q) => !reached.has(q));
  const recommendable = new Set(
    Object.values(RECOMMENDATION_QUESTION).filter((q): q is QuestionKey => q !== null),
  );
  return {
    places: PLACES.length,
    clockPlaces: CLOCKS.map((c) => placeOf(clockPlace(c))),
    questionsReached: QUESTION_KEYS.filter((q) => reached.has(q)),
    questionsUnseen: unseen,
    decisions: DECISIONS.length,
    decisionsTouchingUnseen: DECISIONS.filter((d) => d.colors.some((c) => unseen.includes(c))).length,
    recommendable: QUESTION_KEYS.filter((q) => recommendable.has(q)),
    notRecommendable: QUESTION_KEYS.filter((q) => !recommendable.has(q)),
  };
}
