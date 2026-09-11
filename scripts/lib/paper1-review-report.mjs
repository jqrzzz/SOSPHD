/** Read-only adapter for the private v0.12 reconciliation package, not source adjudication. */
export const REVIEW_REPORT_VERSION = 1;
const RETAINED_STATUS = "retained_prior_connector_evidence_not_fresh_database_read";
const GROUPS = ["numbered", "NR", "MC"];
const HASH_FIELDS = ["key_md5", "key_date_md5"];
const POPULATION_FIELDS = [
  "records", "thailand", "indonesia", "first_contact_dates", "transport_dates", "event_rows",
  "evacuated_yes", "evacuated_no", "evacuated_unknown", "selfpay_label", "payer_missing",
  "payer_labels", "admissible_ttta", "admissible_ttgp", "admissible_ttdc",
];

export class ReviewInputError extends Error {}
const invalid = () => { throw new ReviewInputError("Missing, invalid or unsupported review evidence. See the v0.12 input contract."); };
function object(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  return value;
}
function count(value) {
  if (!Number.isSafeInteger(value) || value < 0) invalid();
  return value;
}
function sum(values) { return count(values.reduce((a, b) => a + count(b), 0)); }
function array(value) { if (!Array.isArray(value) || value.length > 100_000) invalid(); return value; }
function flag(value) { if (typeof value !== "boolean") invalid(); return value; }
function digest(value) { if (typeof value !== "string" || !/^[a-f0-9]{32}$/.test(value)) invalid(); return value; }
function timestamp(value) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value))) invalid();
  const day = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== value.slice(0, 10)) invalid();
  return new Date(value).toISOString();
}
function counts(value, fields) {
  const input = object(value);
  return Object.fromEntries(fields.map((key) => [key, count(input[key])]));
}
function unique(values) { return new Set(values).size === values.length; }
function rowNumber(value) { if (count(value) < 2) invalid(); return value; }
function sourceRows(value, upperBound) {
  const rows = array(value).map(rowNumber);
  if (!unique(rows) || rows.some((row) => row > upperBound)) invalid();
  return rows;
}

/** Only enumerated counts, booleans and normalized timestamps can reach the report. */
export function buildPaper1ReviewReport(sourceInput, retainedInput) {
  const source = object(sourceInput);
  const retained = object(retainedInput);
  if (source.release !== "0.12" || retained.status !== RETAINED_STATUS ||
      retained.cohort_filter !== "research.cases.source::text = 'backfill_2018_2023'") invalid();
  const c = counts(source.canonical, [
    "export_body_rows", "selected_source_rows", "numbered_rows", "unnumbered_named_rows",
    "dated_rows", "undated_rows", "explicit_mop_selfpay_rows",
  ]);
  const canonicalInput = source.canonical;
  const rowUpperBound = sum([c.export_body_rows, 1]);
  const exclusions = array(canonicalInput.exclusions).map((value) => {
    const entry = object(value);
    const row = rowNumber(entry.row);
    if (row > rowUpperBound || !["identity_underdetermined", "administrative_marker"].includes(entry.reason)) invalid();
    return { row, reason: entry.reason };
  });
  if (!unique(exclusions.map((entry) => entry.row))) invalid();
  const months = Object.entries(object(canonicalInput.monthly_counts));
  if (months.some(([key]) => !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(key))) invalid();
  const monthlyTotal = sum(months.map(([, value]) => count(value)));
  const countries = counts(canonicalInput.recorded_countries, ["Thailand", "Indonesia"]);
  const unknownCountry = count(canonicalInput.unrecognized_or_missing_country_rows);
  const tokens = counts(canonicalInput.source_evacuation_tokens, ["yes", "no", "blank", "other"]);
  const imported = counts(retained.registry_836, POPULATION_FIELDS);
  const selected = counts(retained.canonical_829, POPULATION_FIELDS);
  const sourceGroups = array(source.source_group_hashes).map((value) => {
    const entry = object(value);
    if (!GROUPS.includes(entry.source_group)) invalid();
    return { ...counts(entry, ["rows", "dated"]), source_group: entry.source_group,
      ...Object.fromEntries(HASH_FIELDS.map((key) => [key, digest(entry[key])])),
      ...(entry.source_group !== "MC" ? { key_nationality_md5: digest(entry.key_nationality_md5) } : {}),
    };
  });
  if (sourceGroups.length !== GROUPS.length || !unique(sourceGroups.map((g) => g.source_group))) invalid();
  const dbGroups = object(retained.source_groups);
  const groupChecks = [];
  const checks = [];
  const check = (id, actual, expected) => checks.push({ id, actual, expected, pass: actual === expected });
  const within = (id, actual, maximum) => check(id, actual <= maximum, true);
  for (const group of sourceGroups) {
    const dbInput = object(dbGroups[group.source_group]);
    const db = counts(dbInput, ["rows", "dated"]);
    const rowMatch = group.rows === db.rows;
    const datedMatch = group.dated === db.dated;
    const keysMatch = group.key_md5 === digest(dbInput.key_md5);
    const datesMatch = group.key_date_md5 === digest(dbInput.key_date_md5);
    const nationalityMatch = group.source_group === "MC" ? null
      : group.key_nationality_md5 === digest(dbInput.key_nationality_md5);
    groupChecks.push({ group: group.source_group, source_records: group.rows, retained_records: db.rows,
      count_match: rowMatch, dated_count_match: datedMatch, key_digest_match: keysMatch,
      date_digest_match: datesMatch, nationality_digest_match: nationalityMatch });
    for (const [suffix, match] of [["count", rowMatch], ["dated_count", datedMatch], ["keys", keysMatch], ["dates", datesMatch]]) {
      check(`${group.source_group}_${suffix}`, match, true);
    }
    if (nationalityMatch !== null) check(`${group.source_group}_nationality`, nationalityMatch, true);
    within(`${group.source_group}_source_dates_within_records`, group.dated, group.rows);
    within(`${group.source_group}_retained_dates_within_records`, db.dated, db.rows);
  }
  const group = (key) => sourceGroups.find((entry) => entry.source_group === key);
  check("source_row_accounting", sum([c.selected_source_rows, exclusions.length]), c.export_body_rows);
  check("selected_source_accounting", sum([c.numbered_rows, c.unnumbered_named_rows]), c.selected_source_rows);
  check("date_accounting", sum([c.dated_rows, c.undated_rows]), c.selected_source_rows);
  check("monthly_date_accounting", monthlyTotal, c.dated_rows);
  check("source_country_accounting", sum([countries.Thailand, countries.Indonesia, unknownCountry]), c.selected_source_rows);
  check("source_evacuation_token_accounting", sum(Object.values(tokens)), c.selected_source_rows);
  check("numbered_group_count", group("numbered").rows, c.numbered_rows);
  check("unnumbered_group_count", group("NR").rows, c.unnumbered_named_rows);
  check("canonical_group_dates", sum([group("numbered").dated, group("NR").dated]), c.dated_rows);
  check("imported_record_accounting", sum(sourceGroups.map((entry) => entry.rows)), imported.records);
  check("imported_date_accounting", sum(sourceGroups.map((entry) => entry.dated)), imported.first_contact_dates);
  check("canonical_record_correspondence", c.selected_source_rows, selected.records);
  check("canonical_date_correspondence", c.dated_rows, selected.first_contact_dates);
  check("canonical_thailand_correspondence", countries.Thailand, selected.thailand);
  check("canonical_indonesia_correspondence", countries.Indonesia, selected.indonesia);
  check("selfpay_label_correspondence", c.explicit_mop_selfpay_rows, selected.selfpay_label);
  check("selfpay_key_correspondence", digest(canonicalInput.explicit_mop_selfpay_key_md5) === digest(retained.canonical_selfpay_key_md5), true);
  check("reported_source_bytes_unchanged", flag(source.source_bytes_unchanged_during_audit), true);
  for (const [label, pop] of [["imported", imported], ["canonical", selected]]) {
    check(`${label}_country_accounting`, sum([pop.thailand, pop.indonesia]), pop.records);
    check(`${label}_evacuation_accounting`, sum([pop.evacuated_yes, pop.evacuated_no, pop.evacuated_unknown]), pop.records);
    // v0.12 contains only these two event types; a different package needs a new adapter.
    check(`${label}_event_accounting`, sum([pop.first_contact_dates, pop.transport_dates]), pop.event_rows);
    for (const key of POPULATION_FIELDS.filter((key) => !["records", "event_rows"].includes(key))) within(`${label}_${key}_within_records`, pop[key], pop.records);
    within(`${label}_payer_labels_within_nonmissing`, sum([pop.payer_labels, pop.payer_missing]), pop.records);
    within(`${label}_selfpay_within_nonmissing`, sum([pop.selfpay_label, pop.payer_missing]), pop.records);
    within(`${label}_ttta_within_pairs`, pop.admissible_ttta, Math.min(pop.first_contact_dates, pop.transport_dates));
    within(`${label}_ttgp_within_startpoints`, pop.admissible_ttgp, pop.first_contact_dates);
    within(`${label}_ttdc_within_startpoints`, pop.admissible_ttdc, pop.first_contact_dates);
  }
  for (const key of POPULATION_FIELDS) within(`canonical_${key}_within_imported`, selected[key], imported[key]);

  const pairs = array(source.seven_added_records).map((value) => {
    const pair = object(value);
    const canonicalRow = rowNumber(pair.canonical_sheet_row);
    if (canonicalRow > rowUpperBound) invalid();
    const matching = ["file_number_equal", "date_equal", "diagnosis_text_equal", "clinic_equal", "provider_equal"].map((key) => flag(pair[key]));
    return { olderRow: rowNumber(pair.older_sheet_row), canonicalRow,
      strong: matching.every(Boolean), nameEqual: flag(pair.name_ordered_equal) };
  });
  if (!unique(pairs.map((pair) => pair.olderRow))) invalid();
  check("older_addition_candidates_accounted", pairs.length, group("MC").rows);
  const repeated = array(source.repeated_file_numbers).map((value) => {
    const entry = object(value);
    const rows = sourceRows(entry.source_rows, rowUpperBound);
    if (rows.length < 2 || count(entry.rows) !== rows.length) invalid();
    return rows;
  });
  if (!unique(repeated.flat())) invalid();
  within("repeated_group_records_within_selected", repeated.flat().length, c.selected_source_rows);
  const sameDate = array(source.within_source_same_file_and_date).map((value) => {
    const entry = object(value);
    const rows = sourceRows(entry.source_rows, rowUpperBound);
    if (rows.length < 2) invalid();
    if (!repeated.some((g) => rows.every((row) => g.includes(row)))) invalid();
    return { rows, nameEqual: flag(entry.same_normalized_name), diagnosisEqual: flag(entry.same_diagnosis_text) };
  });
  if (!unique(sameDate.flatMap((entry) => entry.rows))) invalid();
  const subsetAt = timestamp(retained.subset_check_utc);
  const groupsAt = timestamp(retained.source_group_check_utc);
  const lastAt = timestamp(retained.last_recorded_stability_check_utc);
  check("retained_timestamp_order", Date.parse(lastAt) >= Math.max(Date.parse(subsetAt), Date.parse(groupsAt)), true);
  const consistency = checks.every((entry) => entry.pass) ? "consistent" : "discrepancy";
  const metrics = ["admissible_ttta", "admissible_ttgp", "admissible_ttdc"];
  const bothZero = [imported, selected].every((pop) => pop.records > 0 && metrics.every((key) => pop[key] === 0));
  return {
    report_version: REVIEW_REPORT_VERSION, result: consistency,
    scope: "Selected aggregate and digest correspondence checks against retained v0.12 evidence; not a fresh source or database audit.",
    evidence_status: "retained_prior_queries_not_live_or_frozen",
    retained_checks_utc: { source_groups: groupsAt, subset: subsetAt, last_stability: lastAt },
    populations: {
      source_body_rows: c.export_body_rows, selected_source_records: c.selected_source_rows,
      excluded_identity_underdetermined: exclusions.filter((e) => e.reason === "identity_underdetermined").length,
      excluded_administrative: exclusions.filter((e) => e.reason === "administrative_marker").length,
      older_source_additions: group("MC").rows, imported_records: imported.records,
      unique_clinical_episodes: null,
    },
    candidate_review: {
      added_records_reviewed: pairs.length, matching_file_date_diagnosis_clinic_provider: pairs.filter((p) => p.strong).length,
      different_recorded_names: pairs.filter((p) => !p.nameEqual).length,
      reused_canonical_targets: pairs.length - new Set(pairs.map((p) => p.canonicalRow)).size,
      repeated_file_number_groups: repeated.length, same_file_date_groups: sameDate.length,
      same_file_date_name_disagreements: sameDate.filter((p) => !p.nameEqual).length,
      auto_merge_performed: false, clinical_identity_adjudicated: false,
    },
    measurement: {
      imported_counts: Object.fromEntries(metrics.map((key) => [key, imported[key]])),
      canonical_counts: Object.fromEntries(metrics.map((key) => [key, selected[key]])),
      zero_qualifying_intervals_reported_in_both: consistency === "consistent" ? bothZero : null,
      interpretation: "Reported qualifying-pair counts, not durations. No event semantics or clinical effects verified.",
    },
    correspondence: groupChecks, checks,
    review_questions: [
      "Adjudicate candidate overlap and incomplete-identity exclusions before making unique-episode claims.",
      "Validate source Date and transport labels against their intended operational meanings.",
      "Obtain an authorized frozen analysis release before a final manuscript-to-release check.",
      "Obtain independent methodological review and confirm ethics, authorship and disclosure requirements.",
    ],
    release_ready: false,
    limitations: [
      "Consistency does not authenticate the retained queries, validate original records, or establish distinct episodes.",
      "MD5 correspondence is a legacy input check, not secure authentication or proof of anonymization.",
      "No manuscript was scanned or changed. This report does not replace the frozen-snapshot verifier.",
      "Counts and candidate agreements are reported, not statistically independent evidence of identity.",
    ],
  };
}

export function renderPaper1ReviewMarkdown(report) {
  const p = report.populations;
  return [
    "# Paper 1: read-only reconciliation review", "",
    `**Evidence consistency: ${report.result}. Not submission clearance.**`, "", report.scope, "",
    "## Record accounting", "",
    "| Measure | Count |", "| --- | ---: |",
    ...[["Source body rows", p.source_body_rows], ["Selected source records", p.selected_source_records],
      ["Identity-underdetermined exclusions", p.excluded_identity_underdetermined], ["Administrative exclusions", p.excluded_administrative],
      ["Older-source additions", p.older_source_additions], ["Imported records", p.imported_records],
      ["Unique clinical episodes", "Not established"]].map(([label, value]) => `| ${label} | ${value} |`),
    "", "## Candidate review", "",
    `${report.candidate_review.matching_file_date_diagnosis_clinic_provider} of ${report.candidate_review.added_records_reviewed} additions match on the five reported comparison fields. These are candidates, not adjudicated duplicates.`,
    `${report.candidate_review.repeated_file_number_groups} repeated-number groups; ${report.candidate_review.same_file_date_name_disagreements} same-number/date groups with name disagreements. No records merged.`,
    "", "## Defined checks", "",
    `${report.checks.filter((check) => check.pass).length}/${report.checks.length} checks agree. Missing required inputs are rejected, not treated as zero.`,
    ...report.checks.filter((check) => !check.pass).map((check) => `- Discrepancy: ${check.id}; actual ${check.actual}, expected ${check.expected}.`),
    "", "## Measurement", "",
    "| Population | TTTA pairs | TTGP pairs | TTDC pairs |", "| --- | ---: | ---: | ---: |",
    ...[["Imported records", report.measurement.imported_counts], ["Canonical source subset", report.measurement.canonical_counts]]
      .map(([label, counts]) => `| ${label} | ${counts.admissible_ttta} | ${counts.admissible_ttgp} | ${counts.admissible_ttdc} |`),
    "", report.measurement.interpretation, "", "## Still requires review", "",
    ...report.review_questions.map((text) => `- ${text}`), "", "## Evidence boundary", "",
    `Retained stability check: ${report.retained_checks_utc.last_stability}. Running this tool does not refresh that evidence.`,
    ...report.limitations.map((text) => `- ${text}`), "",
  ].join("\n");
}
