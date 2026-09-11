// Proposed measurement rules for synthetic rehearsal only. No inference from prose.
export const DICTIONARY_VERSION = "measurement-draft-v1";
const endpoints = ["TRANSPORT_ACTIVATED", "GUARANTEED_PAYMENT", "DEFINITIVE_CARE_START"];
const states = ["observed", "time_unknown", "not_reached", "conflict"];
const applicability = ["applicable", "not_applicable", "unknown"];
const object = (x) => x !== null && typeof x === "object" && !Array.isArray(x);

/** Strict millisecond-or-coarser ISO time with explicit offset. Reject normalized impossible dates. */
export function clockMilliseconds(value) {
  if (typeof value !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!m) return null;
  const [year, month, day, hour, minute, second] = m.slice(1, 7).map(Number);
  const days = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1] || hour > 23 || minute > 59 || second > 59 ||
    (m[8] !== "Z" && (Number(m[10]) > 14 || Number(m[11]) > 59 || Number(m[10]) === 14 && Number(m[11]) !== 0)) || m[8] === "-00:00") return null;
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : null;
}

/** Uses an already-reviewed event classification, not an AI-generated clinical judgement.
 * Unavailability of a value is never converted to zero, automatic censoring or an inferred event.
 */
export function assessMeasurementPair(start, end, scope) {
  const result = (status, minutes = null) => ({ status, minutes, dictionary_version: DICTIONARY_VERSION, clinical_validation: false });
  if (!object(scope) || !endpoints.includes(scope.endpoint) || typeof scope.episode !== "string" || !scope.episode ||
    (scope.leg !== null && (typeof scope.leg !== "string" || !scope.leg))) return result("invalid_input");
  if (!object(start) || !object(end)) return result("endpoint_missing");
  for (const event of [start, end]) {
    if (event.dictionary_version !== DICTIONARY_VERSION || !applicability.includes(event.applicability) ||
      !states.includes(event.state) || typeof event.episode !== "string" || !event.episode) return result("invalid_input");
    if (event.episode !== scope.episode) return result("different_episode");
  }
  if (start.type !== "FIRST_CONTACT" || end.type !== scope.endpoint) return result("different_event");
  if (scope.leg !== null && end.leg !== scope.leg) return result("different_leg");
  if ([start, end].some((e) => e.applicability === "not_applicable")) return result("not_applicable");
  if ([start, end].some((e) => e.applicability === "unknown")) return result("applicability_unknown");
  if ([start, end].some((e) => e.state === "conflict")) return result("conflicting_evidence");
  if ([start, end].some((e) => e.state === "not_reached")) return result("not_reached_at_cutoff");
  if ([start, end].some((e) => e.state === "time_unknown" || e.occurred_at === null)) return result("event_time_unknown");
  if ([start, end].some((e) => !["point", "day", "bounded"].includes(e.precision))) return result("invalid_input");
  // Day/interval evidence is retained, but this rehearsal does not calculate interval bounds.
  if ([start, end].some((e) => e.precision !== "point")) return result("insufficient_precision");
  const first = clockMilliseconds(start.occurred_at); const last = clockMilliseconds(end.occurred_at);
  if (first === null || last === null) return result("invalid_clock");
  if (last < first) return result("precedes_start");
  return result("point_interval", (last - first) / 60000);
}
