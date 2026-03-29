/* ─── Metric Computation (pure functions) ─────────────────────────────
 *  TTTA = Time To Transport Activation  (FIRST_CONTACT → TRANSPORT_ACTIVATED)
 *  TTGP = Time To Guaranteed Payment    (FIRST_CONTACT → GUARANTEED_PAYMENT)
 *  TTDC = Time To Definitive Care       (FIRST_CONTACT → DEFINITIVE_CARE_START)
 *
 *  All functions are pure: events array in, MetricResult out.
 *  They are intentionally simple for auditability.
 * ────────────────────────────────────────────────────────────────────── */

import type { CaseEvent, EventType, MetricResult } from "./types";

function findEvent(events: CaseEvent[], type: EventType): CaseEvent | undefined {
  return events.find((e) => e.event_type === type);
}

function computeInterval(
  events: CaseEvent[],
  fromType: EventType,
  toType: EventType,
  label: string,
  abbreviation: string,
  description: string,
): MetricResult {
  const from = findEvent(events, fromType);
  const to = findEvent(events, toType);

  if (!from) {
    return {
      label,
      abbreviation,
      description,
      value_ms: null,
      is_running: false,
      from_event: fromType,
      to_event: toType,
    };
  }

  if (!to) {
    // Clock is running -- compute elapsed so far
    const elapsed = Date.now() - new Date(from.occurred_at).getTime();
    return {
      label,
      abbreviation,
      description,
      value_ms: elapsed,
      is_running: true,
      from_event: fromType,
      to_event: toType,
    };
  }

  const delta = new Date(to.occurred_at).getTime() - new Date(from.occurred_at).getTime();
  return {
    label,
    abbreviation,
    description,
    value_ms: delta,
    is_running: false,
    from_event: fromType,
    to_event: toType,
  };
}

export function computeTTTA(events: CaseEvent[]): MetricResult {
  return computeInterval(
    events,
    "FIRST_CONTACT",
    "TRANSPORT_ACTIVATED",
    "Time to Transport Activation",
    "TTTA",
    "Interval from first contact to transport dispatch",
  );
}

export function computeTTGP(events: CaseEvent[]): MetricResult {
  return computeInterval(
    events,
    "FIRST_CONTACT",
    "GUARANTEED_PAYMENT",
    "Time to Guaranteed Payment",
    "TTGP",
    "Interval from first contact to financial clearance",
  );
}

export function computeTTDC(events: CaseEvent[]): MetricResult {
  return computeInterval(
    events,
    "FIRST_CONTACT",
    "DEFINITIVE_CARE_START",
    "Time to Definitive Care",
    "TTDC",
    "Interval from first contact to definitive care start",
  );
}

export function computeAllMetrics(events: CaseEvent[]): MetricResult[] {
  return [computeTTTA(events), computeTTGP(events), computeTTDC(events)];
}

/** Format milliseconds into a human-readable duration string */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
