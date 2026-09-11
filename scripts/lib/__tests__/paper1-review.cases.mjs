import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildPaper1ReviewReport, renderPaper1ReviewMarkdown, ReviewInputError } from "../paper1-review-report.mjs";

const CLI = fileURLToPath(new URL("../../review-paper1-reconciliation.mjs", import.meta.url));
const fakeMD5 = "a".repeat(32);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** Entirely synthetic: legacy input key names do not prescribe population counts. */
export function fixture() {
  const group = (source_group, rows, dated) => ({ source_group, rows, dated,
    key_md5: fakeMD5, key_date_md5: fakeMD5, key_nationality_md5: fakeMD5 });
  const groups = [group("numbered", 6, 6), group("NR", 2, 1), group("MC", 1, 1)];
  const population = (records, dates) => ({ records, thailand: records - 1, indonesia: 1,
    first_contact_dates: dates, transport_dates: 1, event_rows: dates + 1,
    evacuated_yes: 1, evacuated_no: records - 2, evacuated_unknown: 1,
    selfpay_label: 2, payer_missing: 1, payer_labels: 3,
    admissible_ttta: 0, admissible_ttgp: 0, admissible_ttdc: 0 });
  const source = {
    release: "0.12", canonical: {
      export_body_rows: 10, selected_source_rows: 8, numbered_rows: 6, unnumbered_named_rows: 2,
      dated_rows: 7, undated_rows: 1, explicit_mop_selfpay_rows: 2, explicit_mop_selfpay_key_md5: fakeMD5,
      monthly_counts: { "2020-01": 7 }, recorded_countries: { Thailand: 7, Indonesia: 1 },
      unrecognized_or_missing_country_rows: 0, source_evacuation_tokens: { yes: 1, no: 5, blank: 1, other: 1 },
      exclusions: [{ row: 10, reason: "identity_underdetermined" }, { row: 11, reason: "administrative_marker" }],
    }, source_group_hashes: groups, source_bytes_unchanged_during_audit: true,
    seven_added_records: [{ older_sheet_row: 2, canonical_sheet_row: 2, file_number_equal: true,
      date_equal: true, diagnosis_text_equal: true, clinic_equal: true, provider_equal: true, name_ordered_equal: false }],
    repeated_file_numbers: [{ source_rows: [2, 3], rows: 2 }],
    within_source_same_file_and_date: [{ source_rows: [2, 3], same_normalized_name: false, same_diagnosis_text: false }],
  };
  const retained = {
    status: "retained_prior_connector_evidence_not_fresh_database_read",
    cohort_filter: "research.cases.source::text = 'backfill_2018_2023'",
    source_group_check_utc: "2026-01-01T10:00:00+00:00", subset_check_utc: "2026-01-01T10:01:00+00:00",
    last_recorded_stability_check_utc: "2026-01-01T10:02:00+00:00",
    source_groups: Object.fromEntries(groups.map((g) => [g.source_group, { ...g }])),
    registry_836: population(9, 8), canonical_829: population(8, 7), canonical_selfpay_key_md5: fakeMD5,
  };
  return { source, retained };
}
function report(mutate = () => {}) {
  const f = fixture(); mutate(f); return buildPaper1ReviewReport(f.source, f.retained);
}
function runCLI(transform = () => {}, options = []) {
  const directory = mkdtempSync(join(tmpdir(), "sosphd-review-synthetic-"));
  try {
    const { source, retained } = fixture();
    const paths = { source: join(directory, "source.json"), retained: join(directory, "retained.json") };
    writeFileSync(paths.source, JSON.stringify(source)); writeFileSync(paths.retained, JSON.stringify(retained));
    transform(paths);
    const before = Object.fromEntries(Object.entries(paths).map(([k, path]) => [k, hash(readFileSync(path))]));
    const args = [CLI, "--source", paths.source, "--retained", paths.retained, "--json", ...options];
    const result = spawnSync(process.execPath, args, { encoding: "utf8", timeout: 4000, maxBuffer: 1024 * 1024 });
    assert.equal(result.error, undefined);
    const after = Object.fromEntries(Object.entries(paths).map(([k, path]) => [k, hash(readFileSync(path))]));
    assert.deepEqual(after, before, "CLI must never modify evidence");
    return result;
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

/** @type {Array<[string, () => void | Promise<void>]>} */
export const reviewCases = [
  ["reports non-hardcoded synthetic populations and unknown episodes", () => {
    const r = report(); assert.equal(r.result, "consistent");
    assert.equal(r.populations.imported_records, 9); assert.equal(r.populations.selected_source_records, 8);
    assert.equal(r.populations.unique_clinical_episodes, null); assert.equal(r.release_ready, false);
    assert.ok(r.checks.every((c) => c.pass));
  }],
  ["does not merge a strong candidate with a different recorded name", () => {
    const r = report(); assert.equal(r.candidate_review.matching_file_date_diagnosis_clinic_provider, 1);
    assert.equal(r.candidate_review.different_recorded_names, 1); assert.equal(r.candidate_review.auto_merge_performed, false);
    assert.equal(r.candidate_review.clinical_identity_adjudicated, false);
  }],
  ["retains same-number/date name conflicts", () => {
    assert.equal(report().candidate_review.same_file_date_name_disagreements, 1);
  }],
  ["checks all comparison fields instead of assuming a strong match", () => {
    assert.equal(report((f) => { f.source.seven_added_records[0].clinic_equal = false; }).candidate_review.matching_file_date_diagnosis_clinic_provider, 0);
  }],
  ["marks group digest drift without exposing the digests", () => {
    const r = report((f) => { f.retained.source_groups.NR.key_date_md5 = "b".repeat(32); });
    assert.equal(r.result, "discrepancy"); assert.equal(r.measurement.zero_qualifying_intervals_reported_in_both, null);
    assert.ok(!JSON.stringify(r).includes(fakeMD5));
  }],
  ["reports nonzero observed pair counts without forcing the old conclusion", () => {
    const r = report((f) => { f.retained.registry_836.admissible_ttta = 1; });
    assert.equal(r.result, "consistent"); assert.equal(r.measurement.zero_qualifying_intervals_reported_in_both, false);
  }],
  ["never elevates valid evidence consistency to submission clearance", () => {
    const r = report(); assert.equal(r.evidence_status, "retained_prior_queries_not_live_or_frozen");
    assert.equal(r.release_ready, false); assert.match(r.scope, /not a fresh source/);
  }],
  ["does not echo unexpected text, row locators, or source instructions", () => {
    const r = report((f) => { f.source.scope = "PRIVATE_CANARY"; f.source.patient_name = "PRIVATE_CANARY";
      f.source.seven_added_records[0].review_id = "PRIVATE_CANARY"; f.retained.source_project = "PRIVATE_CANARY"; });
    const text = JSON.stringify(r) + renderPaper1ReviewMarkdown(r);
    assert.ok(!text.includes("PRIVATE_CANARY")); assert.ok(!text.includes("canonical_sheet_row"));
  }],
  ["does not mutate either evidence object", () => {
    const f = fixture(); const before = JSON.stringify(f); buildPaper1ReviewReport(f.source, f.retained);
    assert.equal(JSON.stringify(f), before);
  }],
  ["renders a review report with explicit limitations", () => {
    const text = renderPaper1ReviewMarkdown(report()); assert.match(text, /Not submission clearance/);
    assert.match(text, /Unique clinical episodes \| Not established/); assert.match(text, /TTTA pairs/);
    assert.match(text, /No manuscript was scanned or changed/);
  }],
  ["CLI preserves inputs and emits their exact SHA-256 identifiers", () => {
    const result = runCLI(); assert.equal(result.status, 0);
    const r = JSON.parse(result.stdout); assert.match(r.input_sha256.source, /^[a-f0-9]{64}$/);
    assert.equal(r.release_ready, false);
  }],
  ["CLI renders Markdown by default", () => {
    const f = fixture(); const dir = mkdtempSync(join(tmpdir(), "sosphd-review-md-"));
    try { const s = join(dir, "s.json"), r = join(dir, "r.json");
      writeFileSync(s, JSON.stringify(f.source)); writeFileSync(r, JSON.stringify(f.retained));
      const run = spawnSync(process.execPath, [CLI, "--source", s, "--retained", r], { encoding: "utf8", timeout: 4000 });
      assert.equal(run.status, 0); assert.match(run.stdout, /# Paper 1: read-only/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }],
  ["CLI gives discrepancies exit code 1", () => {
    const run = runCLI((p) => { const s = JSON.parse(readFileSync(p.source)); s.canonical.export_body_rows++; writeFileSync(p.source, JSON.stringify(s)); });
    assert.equal(run.status, 1); assert.equal(JSON.parse(run.stdout).result, "discrepancy");
  }],
  ["CLI accepts valid exact file pins", () => {
    const f = fixture(); const pin = hash(Buffer.from(JSON.stringify(f.source)));
    assert.equal(runCLI(() => {}, ["--source-sha256", pin]).status, 0);
  }],
  ["CLI rejects wrong pins rather than silently using another file", () => {
    assert.equal(runCLI(() => {}, ["--source-sha256", "0".repeat(64)]).status, 2);
  }],
  ["CLI rejects invalid UTF-8", () => {
    assert.equal(runCLI((p) => writeFileSync(p.source, Buffer.from([0xff, 0xfe]))).status, 2);
  }],
  ["CLI rejects oversized input without echoing content", () => {
    const run = runCLI((p) => writeFileSync(p.source, "PRIVATE_CANARY".repeat(400_000)));
    assert.equal(run.status, 2); assert.ok(!run.stdout.includes("PRIVATE_CANARY"));
  }],
  ["CLI rejects invalid JSON without echoing content", () => {
    const run = runCLI((p) => writeFileSync(p.source, "PRIVATE_CANARY{"));
    assert.equal(run.status, 2); assert.ok(!run.stdout.includes("PRIVATE_CANARY"));
  }],
  ["CLI rejects repeated flags", () => { assert.equal(runCLI(() => {}, ["--json"]).status, 2); }],
  ["CLI rejects live mode and positional arguments", () => {
    assert.equal(runCLI(() => {}, ["--live"]).status, 2);
    assert.equal(runCLI(() => {}, ["PRIVATE_CANARY"]).status, 2);
  }],
  ["CLI does not echo missing file paths", () => {
    const run = spawnSync(process.execPath, [CLI, "--source", "/PRIVATE_CANARY/missing", "--retained", "/also_missing", "--json"], { encoding: "utf8", timeout: 4000 });
    assert.equal(run.status, 2); assert.ok(!run.stdout.includes("PRIVATE_CANARY"));
  }],
  ["CLI rejects directory inputs", () => {
    const run = spawnSync(process.execPath, [CLI, "--source", tmpdir(), "--retained", tmpdir(), "--json"], { encoding: "utf8", timeout: 4000 });
    assert.equal(run.status, 2);
  }],
  ["CLI rejects symlink inputs on POSIX", () => {
    if (process.platform === "win32") return;
    const dir = mkdtempSync(join(tmpdir(), "sosphd-review-link-"));
    try { const target = join(dir, "target.json"), link = join(dir, "link.json"); writeFileSync(target, "{}"); symlinkSync(target, link);
      const run = spawnSync(process.execPath, [CLI, "--source", link, "--retained", target, "--json"], { encoding: "utf8", timeout: 4000 });
      assert.equal(run.status, 2);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }],
];

for (const [name, mutate] of [
  ["source selection mismatch", (f) => { f.source.canonical.numbered_rows++; }],
  ["monthly total mismatch", (f) => { f.source.canonical.monthly_counts["2020-01"]++; }],
  ["country total mismatch", (f) => { f.source.canonical.recorded_countries.Thailand++; }],
  ["changed source byte assertion", (f) => { f.source.source_bytes_unchanged_during_audit = false; }],
  ["imported event mismatch", (f) => { f.retained.registry_836.event_rows++; }],
  ["oversized admissible-pair count", (f) => { f.retained.registry_836.admissible_ttta = 2; }],
  ["subset exceeds imported records", (f) => { f.retained.canonical_829.records = 100; }],
  ["evacuation accounting mismatch", (f) => { f.retained.registry_836.evacuated_no++; }],
  ["source group count mismatch", (f) => { f.retained.source_groups.NR.rows++; }],
  ["self-pay digest mismatch", (f) => { f.retained.canonical_selfpay_key_md5 = "b".repeat(32); }],
  ["missing candidate coverage", (f) => { f.source.seven_added_records = []; }],
  ["retained time ordering mismatch", (f) => { f.retained.last_recorded_stability_check_utc = "2025-01-01T00:00:00Z"; }],
]) {
  reviewCases.push([name, () => { assert.equal(report(mutate).result, "discrepancy"); }]);
}
for (const [name, mutate] of [
  ["missing required count", (f) => { delete f.retained.registry_836.first_contact_dates; }],
  ["null is not zero", (f) => { f.source.canonical.dated_rows = null; }],
  ["string is not a count", (f) => { f.source.canonical.dated_rows = "7"; }],
  ["boolean is not a count", (f) => { f.source.canonical.dated_rows = true; }],
  ["fractional count", (f) => { f.source.canonical.dated_rows = 1.5; }],
  ["negative count", (f) => { f.source.canonical.dated_rows = -1; }],
  ["nonfinite count", (f) => { f.source.canonical.dated_rows = Infinity; }],
  ["NaN count", (f) => { f.source.canonical.dated_rows = NaN; }],
  ["unsafe count", (f) => { f.source.canonical.dated_rows = Number.MAX_SAFE_INTEGER + 1; }],
  ["unknown source release", (f) => { f.source.release = "future"; }],
  ["cannot promote retained evidence to live", (f) => { f.retained.status = "fresh_live"; }],
  ["different cohort filter", (f) => { f.retained.cohort_filter = "all_records"; }],
  ["duplicated exclusion row", (f) => { f.source.canonical.exclusions.push(f.source.canonical.exclusions[0]); }],
  ["unknown exclusion category", (f) => { f.source.canonical.exclusions[0].reason = "PRIVATE_CANARY"; }],
  ["duplicated source group", (f) => { f.source.source_group_hashes[2] = f.source.source_group_hashes[0]; }],
  ["missing source group", (f) => { f.source.source_group_hashes.pop(); }],
  ["bad legacy digest", (f) => { f.retained.source_groups.NR.key_md5 = "PRIVATE_CANARY"; }],
  ["candidate requires genuine booleans", (f) => { f.source.seven_added_records[0].date_equal = "true"; }],
  ["duplicated candidate row", (f) => { f.source.seven_added_records.push(f.source.seven_added_records[0]); }],
  ["repeated group count mismatch", (f) => { f.source.repeated_file_numbers[0].rows = 3; }],
  ["duplicate within-group locator", (f) => { f.source.repeated_file_numbers[0].source_rows = [2, 2]; }],
  ["overlapping repeated-number groups", (f) => { f.source.repeated_file_numbers.push({ source_rows: [3, 4], rows: 2 }); }],
  ["same-date group outside repeated groups", (f) => { f.source.within_source_same_file_and_date[0].source_rows = [4, 5]; }],
  ["invalid timestamp", (f) => { f.retained.subset_check_utc = "PRIVATE_CANARY"; }],
  ["impossible calendar date", (f) => { f.retained.subset_check_utc = "2026-02-30T00:00:00Z"; }],
]) {
  reviewCases.push([name, () => {
    assert.throws(() => report(mutate), (error) => error instanceof ReviewInputError && !error.message.includes("PRIVATE_CANARY"));
  }]);
}
reviewCases.push(["an empty record set is not evidence for the negative measurement finding", () => {
  const f = fixture();
  for (const key of Object.keys(f.source.canonical)) if (typeof f.source.canonical[key] === "number") f.source.canonical[key] = 0;
  f.source.canonical.monthly_counts = {};
  f.source.canonical.recorded_countries = { Thailand: 0, Indonesia: 0 };
  f.source.canonical.source_evacuation_tokens = { yes: 0, no: 0, blank: 0, other: 0 };
  f.source.canonical.exclusions = [];
  for (const group of f.source.source_group_hashes) { group.rows = 0; group.dated = 0; }
  for (const group of Object.values(f.retained.source_groups)) { group.rows = 0; group.dated = 0; }
  for (const pop of [f.retained.registry_836, f.retained.canonical_829]) for (const key of Object.keys(pop)) pop[key] = 0;
  f.source.seven_added_records = []; f.source.repeated_file_numbers = []; f.source.within_source_same_file_and_date = [];
  const r = buildPaper1ReviewReport(f.source, f.retained);
  assert.equal(r.result, "consistent"); assert.equal(r.measurement.zero_qualifying_intervals_reported_in_both, false);
  assert.equal(r.populations.unique_clinical_episodes, null);
}]);
reviewCases.push(["shared candidate targets stay unresolved rather than being automatically removed", () => {
  const f = fixture(); f.source.source_group_hashes[2].rows = 2; f.source.source_group_hashes[2].dated = 2;
  f.retained.source_groups.MC.rows = 2; f.retained.source_groups.MC.dated = 2;
  Object.assign(f.retained.registry_836, { records: 10, thailand: 9, first_contact_dates: 9, event_rows: 10, evacuated_no: 8 });
  f.source.seven_added_records.push({ ...f.source.seven_added_records[0], older_sheet_row: 3 });
  const r = buildPaper1ReviewReport(f.source, f.retained);
  assert.equal(r.result, "consistent"); assert.equal(r.candidate_review.reused_canonical_targets, 1);
  assert.equal(r.candidate_review.auto_merge_performed, false); assert.equal(r.populations.unique_clinical_episodes, null);
}]);
