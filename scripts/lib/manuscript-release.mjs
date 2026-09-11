import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { TextDecoder } from "node:util";

export const RELEASE_FORMAT = "sosphd-manuscript-release-v1";
export const MAX_BYTES = 4 * 1024 * 1024;
const ID = /^[a-z][a-z0-9._-]{0,63}$/;
const SHA = /^[a-f0-9]{64}$/;
const validSha = (value) => typeof value === "string" && SHA.test(value);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const object = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const count = (x) => Number.isSafeInteger(x) && x >= 0;
const formats = ["retained-paper1-v1", "source-audit-v012", "paper1-snapshot-v1"];
const sourceFields = {
  export_body_rows: "source_row", selected_source_rows: "source_row", numbered_rows: "source_row",
  unnumbered_named_rows: "source_row", dated_rows: "source_row", undated_rows: "source_row",
};
const retainedFields = {
  records: "imported_record", thailand: "imported_record", indonesia: "imported_record",
  first_contact_dates: "imported_record", transport_dates: "imported_record", event_rows: "event_row",
  admissible_ttta: "interval", admissible_ttgp: "interval", admissible_ttdc: "interval",
};
const snapshotFields = {
  total_cases: "imported_record", thailand_cases: "imported_record", first_contact: "imported_record",
  transport: "imported_record", computable_ttta: "interval", computable_ttgp: "interval", computable_ttdc: "interval",
};
export class ReleaseInputError extends Error {
  constructor() { super("Invalid or unsupported release input. No private values were included in this error."); }
}
const requireValid = (condition) => { if (!condition) throw new ReleaseInputError(); };
const keys = (o, required) => object(o) && Object.keys(o).length === required.length && required.every((k) => own(o, k));
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
export function decodeBytes(bytes) {
  requireValid(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= MAX_BYTES);
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { throw new ReleaseInputError(); }
}
export function parseJsonBytes(bytes) {
  const text = decodeBytes(bytes);
  try { return JSON.parse(text); } catch { throw new ReleaseInputError(); }
}

function parseManifest(bytes) {
  const m = parseJsonBytes(bytes);
  requireValid(keys(m, ["format", "paper", "manuscript", "evidence", "claims"]));
  requireValid(m.format === RELEASE_FORMAT && m.paper === "paper1");
  requireValid(keys(m.manuscript, ["version", "sha256", "marker"]));
  requireValid(typeof m.manuscript.version === "string" && /^\d{1,3}\.\d{1,3}(?:\.\d{1,3})?$/.test(m.manuscript.version) && validSha(m.manuscript.sha256));
  requireValid(typeof m.manuscript.marker === "string" && m.manuscript.marker.length <= 300 &&
    new RegExp(`(?:^|[^A-Za-z0-9])v${m.manuscript.version.replaceAll(".", "\\.")}(?![A-Za-z0-9.])`).test(m.manuscript.marker));
  requireValid(Array.isArray(m.evidence) && m.evidence.length > 0 && m.evidence.length <= 4);
  const ids = new Set();
  for (const e of m.evidence) {
    requireValid(keys(e, ["id", "format", "sha256", "label"]));
    requireValid(typeof e.id === "string" && ID.test(e.id) && !ids.has(e.id)); ids.add(e.id);
    requireValid(formats.includes(e.format) && validSha(e.sha256) && typeof e.label === "string" && e.label.length <= 120);
    requireValid(e.format === "paper1-snapshot-v1" ? e.label.trim().length > 0 : e.label === "");
  }
  requireValid(Array.isArray(m.claims) && m.claims.length > 0 && m.claims.length <= 100);
  const claims = new Set();
  for (const c of m.claims) {
    requireValid(keys(c, ["id", "evidence", "population", "field", "unit", "expected", "anchor", "occurrences"]));
    requireValid(typeof c.id === "string" && ID.test(c.id) && !claims.has(c.id)); claims.add(c.id);
    requireValid(ids.has(c.evidence) && count(c.expected) && Number.isInteger(c.occurrences) && c.occurrences >= 1 && c.occurrences <= 30);
    requireValid(typeof c.anchor === "string" && c.anchor.trim().length > 0 && c.anchor.length <= 2000 && !c.anchor.includes("\0"));
    // A locator must visibly contain the asserted number. This is not semantic NLP validation.
    requireValid(new RegExp(`(^|[^\\d])${c.expected}([^\\d]|$)`).test(c.anchor));
    const format = m.evidence.find((e) => e.id === c.evidence).format;
    const fieldMap = format === "source-audit-v012" ? sourceFields : format === "retained-paper1-v1" ? retainedFields : snapshotFields;
    requireValid(own(fieldMap, c.field) && c.unit === fieldMap[c.field]);
    requireValid(format === "source-audit-v012" ? c.population === "source-ledger" :
      format === "paper1-snapshot-v1" ? c.population === "imported" : ["imported", "canonical-subset"].includes(c.population));
  }
  requireValid(m.evidence.every((e) => m.claims.some((c) => c.evidence === e.id)));
  return m;
}

function readEvidence(bytes, spec) {
  const d = parseJsonBytes(bytes);
  requireValid(object(d));
  if (spec.format === "retained-paper1-v1") {
    requireValid(d.status === "retained_prior_connector_evidence_not_fresh_database_read" &&
      d.cohort_filter === "research.cases.source::text = 'backfill_2018_2023'");
    for (const key of ["registry_836", "canonical_829"]) {
      requireValid(object(d[key]) && Object.keys(retainedFields).every((f) => count(d[key][f])));
      requireValid(d[key].thailand + d[key].indonesia === d[key].records &&
        d[key].first_contact_dates <= d[key].records && d[key].transport_dates <= d[key].records &&
        d[key].event_rows >= d[key].first_contact_dates + d[key].transport_dates);
      for (const f of ["admissible_ttta", "admissible_ttgp", "admissible_ttdc"]) requireValid(d[key][f] <= d[key].first_contact_dates);
      requireValid(d[key].admissible_ttta <= d[key].transport_dates);
    }
    requireValid(d.canonical_829.records <= d.registry_836.records);
    return { populations: { imported: d.registry_836, "canonical-subset": d.canonical_829 }, basis: "retained-query-transcription-not-refreshed" };
  }
  if (spec.format === "source-audit-v012") {
    requireValid(d.release === "0.12" && object(d.canonical));
    const c = d.canonical;
    requireValid(Object.keys(sourceFields).every((f) => count(c[f])) && Array.isArray(c.exclusions));
    requireValid(c.numbered_rows + c.unnumbered_named_rows === c.selected_source_rows &&
      c.dated_rows + c.undated_rows === c.selected_source_rows &&
      c.selected_source_rows + c.exclusions.length === c.export_body_rows);
    return { populations: { "source-ledger": c }, basis: "retained-source-audit-not-independent-validation" };
  }
  const p = d.payload?.paper1;
  requireValid(object(d.meta) && d.meta.label === spec.label && object(p) && p.version === 1 &&
    p.source === "backfill_2018_2023" && object(p.figures) &&
    Object.keys(snapshotFields).every((f) => count(p.figures[f])));
  requireValid(object(p.capture) && Number.isFinite(Date.parse(p.capture.started_at)) &&
    Number.isFinite(Date.parse(p.capture.ended_at)) && Date.parse(p.capture.ended_at) >= Date.parse(p.capture.started_at) &&
    Number.isFinite(Date.parse(d.meta.created_at)) && Date.parse(d.meta.created_at) >= Date.parse(p.capture.ended_at));
  const f = p.figures;
  requireValid(count(p.case_count) && count(p.event_count) && count(p.interval_count) && p.case_count === f.total_cases &&
    p.interval_count === f.first_contact && f.thailand_cases <= f.total_cases && f.first_contact <= f.total_cases &&
    f.transport <= f.total_cases && p.event_count >= f.first_contact + f.transport);
  for (const k of ["computable_ttta", "computable_ttgp", "computable_ttdc"]) requireValid(f[k] <= f.first_contact);
  requireValid(f.computable_ttta <= f.transport);
  // This is a selected-claim adapter, not a replacement for paper1EvidenceSchema.
  return { populations: { imported: f }, basis: "supplied-snapshot-capture-not-authenticated-here" };
}

/** Pure, bounded comparison. Never edits evidence, runs queries or certifies a paper. */
export function verifyManuscriptRelease(manifestBytes, manuscriptBytes, evidenceBytes) {
  const m = parseManifest(manifestBytes);
  requireValid(evidenceBytes instanceof Map && evidenceBytes.size === m.evidence.length && m.evidence.every((e) => evidenceBytes.has(e.id)));
  const manuscript = decodeBytes(manuscriptBytes);
  const checks = [
    { id: "manuscript-bytes", agrees: sha256(manuscriptBytes) === m.manuscript.sha256 },
    { id: "manuscript-version-marker", agrees: manuscript.includes(m.manuscript.marker) },
  ];
  const loaded = new Map();
  const evidence = m.evidence.map((e) => {
    const bytes = evidenceBytes.get(e.id);
    const parsed = readEvidence(bytes, e); loaded.set(e.id, parsed);
    const digest = sha256(bytes);
    checks.push({ id: `evidence-bytes.${e.id}`, agrees: digest === e.sha256 });
    return { id: e.id, sha256: digest, basis: parsed.basis };
  });
  for (const c of m.claims) {
    const actual = loaded.get(c.evidence).populations[c.population][c.field];
    checks.push({ id: `${c.id}.quantity`, agrees: actual === c.expected });
    checks.push({ id: `${c.id}.locator`, agrees: manuscript.split(c.anchor).length - 1 === c.occurrences });
  }
  return {
    format: "sosphd-manuscript-release-report-v1", paper: "paper1", version: m.manuscript.version,
    manifest_sha256: sha256(manifestBytes), manuscript_sha256: sha256(manuscriptBytes), evidence, checks,
    result: checks.every((c) => c.agrees) ? "declared_checks_agree" : "mismatch",
    boundaries: {
      source_authenticated: false, current_database_checked: false, complete_snapshot_schema_checked: false,
      all_manuscript_claims_checked: false, clinical_meaning_validated: false, submission_clearance: false,
    },
  };
}
