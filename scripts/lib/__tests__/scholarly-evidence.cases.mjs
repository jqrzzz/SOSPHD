import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { RELEASE_FORMAT, MAX_BYTES, sha256, verifyManuscriptRelease, ReleaseInputError } from "../manuscript-release.mjs";
import { assessMeasurementPair, clockMilliseconds } from "../measurement-challenge.mjs";
import { measurementChallengeSet } from "../../../research-fixtures/measurement-challenge-v1.mjs";
import { boundedRead } from "../../verify-manuscript-release.mjs";

const bytes = (x) => Buffer.from(JSON.stringify(x));
function fixture() {
  const manuscript = Buffer.from("# Paper 1 v0.1\n\nThere are 3 imported records.\n");
  const record = { records: 3, thailand: 2, indonesia: 1, first_contact_dates: 2, transport_dates: 1, event_rows: 3, admissible_ttta: 0, admissible_ttgp: 0, admissible_ttdc: 0 };
  const data = { status: "retained_prior_connector_evidence_not_fresh_database_read", cohort_filter: "research.cases.source::text = 'backfill_2018_2023'", registry_836: record, canonical_829: { ...record } };
  const manifest = { format: RELEASE_FORMAT, paper: "paper1", manuscript: { version: "0.1", marker: "# Paper 1 v0.1", sha256: sha256(manuscript) }, evidence: [{ id: "registry", format: "retained-paper1-v1", sha256: sha256(bytes(data)), label: "" }], claims: [{ id: "records", evidence: "registry", population: "imported", field: "records", unit: "imported_record", expected: 3, anchor: "There are 3 imported records.", occurrences: 1 }] };
  return { manuscript, data, manifest };
}
const run = (f) => verifyManuscriptRelease(bytes(f.manifest), f.manuscript, new Map([["registry", bytes(f.data)]]));
export function registerScholarlyTests(test) {
  test("pins manuscript, evidence, version and declared text without clearing release", () => {
    const r = run(fixture()); assert.equal(r.result, "declared_checks_agree");
    assert.ok(Object.values(r.boundaries).every((x) => x === false));
  });
  for (const [name, mutate] of [
    ["manuscript bytes", (f) => { f.manuscript = Buffer.concat([f.manuscript, Buffer.from("Changed")]); }],
    ["evidence bytes", (f) => { f.data.extra_metadata = true; }],
    ["version marker", (f) => { f.manifest.manuscript.marker = "# A different Paper v0.1"; }],
    ["quantity", (f) => { f.manifest.claims[0].expected = 2; f.manifest.claims[0].anchor = "2 imported records"; }],
    ["text location", (f) => { f.manifest.claims[0].anchor = "There were 3 imported records."; }],
    ["duplicated location", (f) => { f.manuscript = Buffer.from(f.manuscript.toString().repeat(2)); f.manifest.manuscript.sha256 = sha256(f.manuscript); }],
  ]) test(`reports mismatch: ${name}`, () => { const f = fixture(); mutate(f); assert.equal(run(f).result, "mismatch"); });
  for (const [name, mutate] of [
    ["empty claims", (f) => { f.manifest.claims = []; }],
    ["duplicate claim IDs", (f) => { f.manifest.claims.push({ ...f.manifest.claims[0] }); }],
    ["duplicate evidence IDs", (f) => { f.manifest.evidence.push({ ...f.manifest.evidence[0] }); }],
    ["unknown format", (f) => { f.manifest.evidence[0].format = "live"; }],
    ["unsupported paper", (f) => { f.manifest.paper = "paper2"; }],
    ["population substitution", (f) => { f.manifest.claims[0].population = "unique-patients"; }],
    ["unit substitution", (f) => { f.manifest.claims[0].unit = "patient"; }],
    ["arbitrary private field", (f) => { f.manifest.claims[0].field = "notes"; }],
    ["undeclared provenance", (f) => { delete f.data.status; }],
    ["freshness relabelling", (f) => { f.data.status = "live_snapshot"; }],
    ["wrong cohort", (f) => { f.data.cohort_filter = "all_cases"; }],
    ["missing quantity", (f) => { delete f.data.registry_836.records; }],
    ["null quantity", (f) => { f.data.registry_836.first_contact_dates = null; }],
    ["negative quantity", (f) => { f.manifest.claims[0].expected = -1; }],
    ["numeric string", (f) => { f.manifest.claims[0].expected = "3"; }],
    ["wrong country sum", (f) => { f.data.registry_836.indonesia = 7; }],
    ["impossible interval subset", (f) => { f.data.registry_836.admissible_ttta = 3; }],
    ["wrong manuscript marker version", (f) => { f.manifest.manuscript.version = "0.2"; }],
    ["anchor lacks asserted number", (f) => { f.manifest.claims[0].anchor = "No numbers here"; }],
    ["claim anchor contains number only as substring", (f) => { f.manifest.claims[0].anchor = "13 records"; }],
    ["unknown manifest key", (f) => { f.manifest.filename = "/private/data"; }],
  ]) test(`fails closed: ${name}`, () => { const f = fixture(); mutate(f); assert.throws(() => run(f), ReleaseInputError); });
  test("source-audit profile checks source partition separately", () => {
    const f = fixture(); f.data = { release: "0.12", canonical: { export_body_rows: 4, selected_source_rows: 3, numbered_rows: 2, unnumbered_named_rows: 1, dated_rows: 2, undated_rows: 1, exclusions: [{}] } };
    f.manifest.evidence[0].format = "source-audit-v012"; f.manifest.evidence[0].sha256 = sha256(bytes(f.data));
    Object.assign(f.manifest.claims[0], { population: "source-ledger", field: "selected_source_rows", unit: "source_row" });
    assert.equal(run(f).result, "declared_checks_agree");
    f.data.canonical.exclusions = []; assert.throws(() => run(f), ReleaseInputError);
  });
  test("snapshot profile does not apply old manuscript constants", () => {
    const f = fixture(); f.manifest.evidence[0].format = "paper1-snapshot-v1"; f.manifest.evidence[0].label = "synthetic-release";
    f.data = { meta: { label: "synthetic-release", created_at: "2030-01-01T00:00:01Z" }, payload: { paper1: { version: 1, source: "backfill_2018_2023", capture: { started_at: "2030-01-01T00:00:00Z", ended_at: "2030-01-01T00:00:01Z" }, case_count: 3, event_count: 3, interval_count: 2, figures: { total_cases: 3, thailand_cases: 2, first_contact: 2, transport: 1, computable_ttta: 0, computable_ttgp: 0, computable_ttdc: 0 } } };
    f.manifest.claims[0].field = "total_cases"; f.manifest.evidence[0].sha256 = sha256(bytes(f.data));
    assert.equal(run(f).result, "declared_checks_agree");
    f.data.meta.label = "another-snapshot"; assert.throws(() => run(f), ReleaseInputError);
  });
  test("report does not echo evidence text, manuscript text or locator", () => {
    const f = fixture(); f.data.private_notes = "PRIVATE_CANARY"; f.manifest.evidence[0].sha256 = sha256(bytes(f.data));
    const report = JSON.stringify(run(f)); assert.ok(!report.includes("PRIVATE_CANARY")); assert.ok(!report.includes("There are 3"));
  });
  test("rejects malformed UTF-8 without exposing bytes", () => {
    const f = fixture(); assert.throws(() => verifyManuscriptRelease(Buffer.from([0xff]), f.manuscript, new Map()), ReleaseInputError);
  });
  test("rejects unbounded manuscript", () => {
    const f = fixture(); f.manuscript = Buffer.alloc(MAX_BYTES + 1, 65); assert.throws(() => run(f), ReleaseInputError);
  });
  test("CLI checks all three exit states and sanitizes read errors", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sosphd-release-"));
    try {
      const f = fixture(); const paths = [join(dir, "manifest.json"), join(dir, "paper.md"), join(dir, "evidence.json")];
      await Promise.all([writeFile(paths[0], bytes(f.manifest)), writeFile(paths[1], f.manuscript), writeFile(paths[2], bytes(f.data))]);
      const cli = new URL("../../verify-manuscript-release.mjs", import.meta.url);
      const args = [cli.pathname, "--manifest", paths[0], "--manuscript", paths[1], "--evidence", `registry=${paths[2]}`, "--json"];
      assert.equal(spawnSync(process.execPath, args).status, 0);
      await writeFile(paths[1], "Changed v0.1"); assert.equal(spawnSync(process.execPath, args).status, 1);
      const bad = spawnSync(process.execPath, [cli.pathname, "--manifest", "/PRIVATE_PATH_CANARY", "--manuscript", paths[1], "--evidence", `registry=${paths[2]}`]);
      assert.equal(bad.status, 2); assert.ok(!bad.stderr.toString().includes("PRIVATE_PATH_CANARY"));
      await symlink(paths[0], join(dir, "link")); await assert.rejects(boundedRead(join(dir, "link")));
      await assert.rejects(boundedRead(dir));
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  test("15 authored challenge scenarios agree with their explicit draft rules", async () => {
    const data = measurementChallengeSet;
    assert.equal(data.synthetic, true); assert.equal(data.cases.length, 15); assert.equal(new Set(data.cases.map((c) => c.id)).size, 15);
    for (const c of data.cases) for (const p of c.comparisons) {
      const r = assessMeasurementPair(p.start, p.end, p.scope);
      assert.deepEqual({ status: r.status, minutes: r.minutes }, p.expected, c.id); assert.equal(r.clinical_validation, false);
    }
  });
  for (const s of ["2030-02-30T00:00:00Z", "2030-01-01T24:00:00Z", "2030-01-01T00:00:60Z", "2030-01-01T00:00:00", "2030-01-01T00:00:00+15:00", "2030-01-01T00:00:00-00:00", "2030-01-01T00:00:00+14:01", "2030-01-01T00:00:00.0001Z", null]) {
    test(`invalid clock rejected ${String(s)}`, () => assert.equal(clockMilliseconds(s), null));
  }
  test("valid leap day and cross-zone equality", () => {
    assert.ok(clockMilliseconds("2032-02-29T00:00:00Z") !== null);
    assert.equal(clockMilliseconds("2030-01-15T10:00:00+07:00"), clockMilliseconds("2030-01-15T11:00:00+08:00"));
  });
  test("zero is a valid duration, a preceding endpoint is not zero", async () => {
    const data = measurementChallengeSet;
    const p = data.cases[0].comparisons[0];
    assert.equal(assessMeasurementPair(p.start, { ...p.end, occurred_at: p.start.occurred_at }, p.scope).minutes, 0);
    const r = assessMeasurementPair(p.start, { ...p.end, occurred_at: "2030-01-15T09:59:00+07:00" }, p.scope);
    assert.equal(r.status, "precedes_start"); assert.equal(r.minutes, null);
    assert.equal(assessMeasurementPair(p.start, null, p.scope).status, "endpoint_missing");
    assert.equal(assessMeasurementPair(p.start, { ...p.end, dictionary_version: "other" }, p.scope).status, "invalid_input");
  });
}
