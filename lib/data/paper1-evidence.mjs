import { z } from "zod";

export const BASELINE_SOURCE = "backfill_2018_2023";
export const DEFAULT_BASELINE_LABEL = "paper1-baseline-v1";
const count = z.number().int().nonnegative().safe();
const timestamp = z.string().datetime({ offset: true });
const nullableText = z.string().nullable();
const eventTypes = [
  "FIRST_CONTACT", "TRIAGE_COMPLETE", "TRANSPORT_ACTIVATED", "FACILITY_ARRIVAL",
  "GUARANTEED_PAYMENT", "DEFINITIVE_CARE_START", "DISCHARGE", "NOTE",
];

// Only the columns needed for the paper; raw records never enter the evidence block.
const casesSchema = z.array(z.object({
  id: z.string().uuid(), source: z.literal(BASELINE_SOURCE),
  country: nullableText, intake_date: timestamp.nullable(),
  nationality: nullableText, diagnosis_bucket: nullableText,
  payer_entity: nullableText, evacuated: z.boolean().nullable(),
})).nonempty();
const eventsSchema = z.array(z.object({
  id: z.string().uuid(), case_id: z.string().uuid(),
  event_type: z.enum(eventTypes), occurred_at: timestamp,
  resolution: z.enum(["date", "entry", "measured"]).nullable(),
}));
const intervalsSchema = z.array(z.object({
  case_id: z.string().uuid(),
  ttta_minutes: z.number().finite().nullable(),
  ttgp_minutes: z.number().finite().nullable(),
  ttdc_minutes: z.number().finite().nullable(),
}));

// The existing manuscript's assertions, kept separate from captured observations.
// Study dates use Bangkok calendar days, including midnight at 17:00 UTC.
export const PAPER1_CHECKS = [
  { key: "total_cases", label: "total cases", expected: 836 },
  { key: "thailand_cases", label: "incidents in Thailand", expected: 790 },
  { key: "nationalities", label: "identified nationalities", expected: 68 },
  { key: "missing_nationality", label: "cases missing nationality", expected: 54 },
  { key: "gastro", label: "gastrointestinal cases", expected: 231 },
  { key: "trauma", label: "trauma cases", expected: 170 },
  { key: "animal_bite", label: "animal bite cases", expected: 114 },
  { key: "marine", label: "marine cases", expected: 46 },
  { key: "missing_diagnosis", label: "cases with no diagnosis bucket", expected: 54 },
  { key: "other_diagnosis", label: "cases bucketed other", expected: 98 },
  { key: "evacuations", label: "evacuations", expected: 49 },
  { key: "evacuations_with_transport", label: "evacuations with a transport date", expected: 7 },
  { key: "self_pay", label: "self-pay cases", expected: 233 },
  { key: "payers", label: "distinct payer entities", expected: 311 },
  { key: "allianz", label: "Allianz cases", expected: 32 },
  { key: "first_date", label: "first case date (Bangkok)", expected: "2018-12-02" },
  { key: "last_date", label: "last case date (Bangkok)", expected: "2020-03-24" },
  { key: "first_contact", label: "cases with FIRST_CONTACT", expected: 835 },
  { key: "transport", label: "cases with TRANSPORT_ACTIVATED", expected: 9 },
  { key: "off_midnight_transport", label: "transport values off midnight ICT", expected: 0 },
  { key: "raw_ttta_hours", label: "distinct raw date differences (not admissible TTTA)", expected: "0h,24h" },
  { key: "computable_ttta", label: "computable TTTA in baseline", expected: 0 },
  { key: "computable_ttgp", label: "computable TTGP in baseline", expected: 0 },
  { key: "computable_ttdc", label: "computable TTDC in baseline", expected: 0 },
  { key: "unclassified_resolution", label: "events with unclassified clock resolution", expected: 0 },
  ...["TRIAGE_COMPLETE", "FACILITY_ARRIVAL", "GUARANTEED_PAYMENT", "DEFINITIVE_CARE_START", "DISCHARGE"]
    .map((type) => ({ key: type, label: `cases with ${type}`, expected: 0 })),
];

const figuresSchema = z.object(Object.fromEntries(PAPER1_CHECKS.map(({ key, expected }) => [
  key, typeof expected === "number" ? count : z.string().max(200),
]))).strict();

export const paper1EvidenceSchema = z.object({
  version: z.literal(1), source: z.literal(BASELINE_SOURCE),
  capture: z.object({ started_at: timestamp, ended_at: timestamp }).strict()
    .refine((c) => Date.parse(c.ended_at) >= Date.parse(c.started_at)),
  case_count: count.positive(), event_count: count, interval_count: count,
  figures: figuresSchema,
}).strict().superRefine((e, ctx) => {
  const f = e.figures;
  if (f.total_cases !== e.case_count || f.first_contact !== e.interval_count ||
      e.interval_count > e.case_count || e.event_count < e.interval_count) {
    ctx.addIssue({ code: "custom", message: "Inconsistent evidence counts" });
  }
  const milestoneCount = ["first_contact", "transport", "TRIAGE_COMPLETE", "FACILITY_ARRIVAL",
    "GUARANTEED_PAYMENT", "DEFINITIVE_CARE_START", "DISCHARGE"]
    .reduce((total, key) => total + Number(f[key]), 0);
  const diagnosisCount = ["missing_diagnosis", "other_diagnosis", "gastro", "trauma", "animal_bite", "marine"]
    .reduce((total, key) => total + Number(f[key]), 0);
  if (milestoneCount > e.event_count || diagnosisCount > e.case_count ||
      Number(f.missing_nationality) + Number(f.nationalities) > e.case_count ||
      Number(f.evacuations_with_transport) > Math.min(Number(f.evacuations), Number(f.transport)) ||
      Number(f.off_midnight_transport) > Number(f.transport) ||
      Number(f.computable_ttta) > Math.min(Number(f.first_contact), Number(f.transport)) ||
      Number(f.computable_ttgp) > Math.min(Number(f.first_contact), Number(f.GUARANTEED_PAYMENT)) ||
      Number(f.computable_ttdc) > Math.min(Number(f.first_contact), Number(f.DEFINITIVE_CARE_START))) {
    ctx.addIssue({ code: "custom", message: "Inconsistent evidence subsets" });
  }
  for (const { key, expected } of PAPER1_CHECKS) {
    if (typeof expected !== "number") continue;
    const max = ["off_midnight_transport", "unclassified_resolution"].includes(key)
      ? e.event_count : e.case_count;
    if (Number(f[key]) > max) ctx.addIssue({ code: "custom", message: "Count exceeds cohort" });
  }
});

/** @param {unknown} value @param {import('zod').ZodTypeAny} schema */
function parseSource(value, schema) {
  const parsed = schema.safeParse(value);
  // Do not echo rejected raw data or detailed validation messages into app logs.
  if (!parsed.success) throw new Error("Paper 1 source data is incomplete or invalid; snapshot not frozen.");
  return parsed.data;
}

/**
 * @param {unknown} caseRows
 * @param {unknown} eventRows
 * @param {unknown} intervalRows
 * @param {{started_at: string, ended_at: string}} capture
 */
export function buildPaper1Evidence(caseRows, eventRows, intervalRows, capture) {
  const cases = casesSchema.parse(parseSource(caseRows, casesSchema));
  const events = eventsSchema.parse(parseSource(eventRows, eventsSchema));
  const intervals = intervalsSchema.parse(parseSource(intervalRows, intervalsSchema));
  const ids = new Set(cases.map((c) => c.id));
  if (ids.size !== cases.length || new Set(events.map((e) => e.id)).size !== events.length ||
      new Set(intervals.map((r) => r.case_id)).size !== intervals.length ||
      events.some((e) => !ids.has(e.case_id)) || intervals.some((r) => !ids.has(r.case_id))) {
    throw new Error("Paper 1 cohort has duplicate or out-of-scope records; snapshot not frozen.");
  }
  const milestones = events.filter((e) => e.event_type !== "NOTE");
  const milestoneByKey = new Map(milestones.map((e) => [`${e.case_id}:${e.event_type}`, e]));
  if (milestoneByKey.size !== milestones.length) {
    throw new Error("Paper 1 has repeated milestones; reconcile their interpretation before freezing.");
  }
  const first = new Map(events.filter((e) => e.event_type === "FIRST_CONTACT")
    .map((e) => [e.case_id, Date.parse(e.occurred_at)]));
  if (first.size !== intervals.length || intervals.some((r) => !first.has(r.case_id))) {
    throw new Error("Paper 1 interval coverage disagrees with events; snapshot not frozen.");
  }
  // The view supplies durations. Check only its admissibility against the same
  // captured endpoints, so inconsistent reads cannot become silent nulls.
  const resolvesWithinDay = (event) => event && event.resolution !== null && event.resolution !== "date";
  for (const row of intervals) {
    const firstEvent = milestoneByKey.get(`${row.case_id}:FIRST_CONTACT`);
    for (const [column, type] of [
      ["ttta_minutes", "TRANSPORT_ACTIVATED"],
      ["ttgp_minutes", "GUARANTEED_PAYMENT"],
      ["ttdc_minutes", "DEFINITIVE_CARE_START"],
    ]) {
      const endpoint = milestoneByKey.get(`${row.case_id}:${type}`);
      const admissible = Boolean(resolvesWithinDay(firstEvent) && resolvesWithinDay(endpoint));
      if ((row[column] !== null) !== admissible) {
        throw new Error("Paper 1 interval clocks disagree with events; snapshot not frozen.");
      }
    }
  }
  const transports = events.filter((e) => e.event_type === "TRANSPORT_ACTIVATED");
  const evacuatedIds = new Set(cases.filter((c) => c.evacuated === true).map((c) => c.id));
  const dates = cases.filter((c) => c.intake_date !== null)
    .map((c) => new Date(Date.parse(c.intake_date) + 7 * 3_600_000).toISOString()).sort();
  const rawHours = [...new Set(transports.filter((e) => first.has(e.case_id))
    .map((e) => (Date.parse(e.occurred_at) - first.get(e.case_id)) / 3_600_000))]
    .sort((a, b) => a - b).map((h) => `${h}h`).join(",");
  const diagnosis = (name) => cases.filter((c) => c.diagnosis_bucket === name).length;
  const eventCounts = Object.fromEntries(eventTypes.map((type) => [
    type, new Set(events.filter((e) => e.event_type === type).map((e) => e.case_id)).size,
  ]));
  const evidence = {
    version: 1, source: BASELINE_SOURCE, capture,
    case_count: cases.length, event_count: events.length, interval_count: intervals.length,
    figures: {
      total_cases: cases.length,
      thailand_cases: cases.filter((c) => /thai/i.test(c.country ?? "")).length,
      nationalities: new Set(cases.map((c) => (c.nationality ?? "").trim().toLowerCase())
        .filter((n) => n && !["?", "-", "n/a", "unknown"].includes(n))).size,
      missing_nationality: cases.filter((c) => ["", "?", "-"].includes((c.nationality ?? "").trim())).length,
      gastro: diagnosis("gastro"), trauma: diagnosis("trauma"), animal_bite: diagnosis("animal_bite"), marine: diagnosis("marine"),
      missing_diagnosis: cases.filter((c) => !c.diagnosis_bucket).length,
      other_diagnosis: diagnosis("other"), evacuations: evacuatedIds.size,
      evacuations_with_transport: transports.filter((e) => evacuatedIds.has(e.case_id)).length,
      self_pay: cases.filter((c) => c.payer_entity === "Self-pay").length,
      payers: new Set(cases.map((c) => c.payer_entity).filter(Boolean)).size,
      allianz: cases.filter((c) => c.payer_entity === "Allianz").length,
      first_date: dates[0]?.slice(0, 10) ?? "", last_date: dates.at(-1)?.slice(0, 10) ?? "",
      first_contact: first.size, transport: transports.length,
      // Date truncates microseconds; any nonzero raw fraction is off midnight.
      off_midnight_transport: transports.filter((e) =>
        !new Date(e.occurred_at).toISOString().endsWith("T17:00:00.000Z") ||
        /\.\d*[1-9]\d*(?:Z|[+-]\d{2}:?\d{2})$/.test(e.occurred_at)).length,
      raw_ttta_hours: rawHours,
      computable_ttta: intervals.filter((r) => r.ttta_minutes !== null).length,
      computable_ttgp: intervals.filter((r) => r.ttgp_minutes !== null).length,
      computable_ttdc: intervals.filter((r) => r.ttdc_minutes !== null).length,
      unclassified_resolution: events.filter((e) => e.resolution === null).length,
      ...Object.fromEntries(PAPER1_CHECKS.filter((c) => eventTypes.includes(c.key)).map((c) => [c.key, eventCounts[c.key]])),
    },
  };
  return paper1EvidenceSchema.parse(evidence);
}

const snapshotSchema = z.object({
  meta: z.object({ id: z.string().uuid(), label: z.string().min(1).max(120), created_at: timestamp }),
  payload: z.object({ paper1: paper1EvidenceSchema }),
});

/** @param {unknown} snapshot @param {string} expectedLabel */
export function verifyPaper1Snapshot(snapshot, expectedLabel = DEFAULT_BASELINE_LABEL) {
  const parsed = snapshotSchema.safeParse(snapshot);
  if (!parsed.success) {
    throw new Error("Invalid snapshot or missing Paper 1 v1 evidence. Download a new snapshot created by the updated app; no live fallback was used.");
  }
  const { meta, payload } = parsed.data;
  if (meta.label !== expectedLabel) throw new Error("Snapshot label does not match the requested baseline.");
  if (Date.parse(meta.created_at) < Date.parse(payload.paper1.capture.ended_at)) {
    throw new Error("Snapshot creation precedes evidence capture.");
  }
  return {
    meta, evidence: payload.paper1,
    checks: PAPER1_CHECKS.map((check) => ({ ...check,
      actual: payload.paper1.figures[check.key],
      pass: payload.paper1.figures[check.key] === check.expected,
    })),
  };
}
