# Paper 1: read-only reconciliation review

Development tool | 11 September 2026 | No clinical, data-cleaning or publication approval implied.

## Purpose

Turn the private v0.12 audit into a repeatable, concise review report. Keep imported records, selected source records and unverified clinical episodes separate. Show defined source-to-retained-evidence discrepancies without changing the underlying records or rewriting a paper.

This is an offline command, not a new app screen. It has no database, network, model, credential or application dependencies. It is independent of the writing-tool PR. Existing app code, research definitions and snapshot assertions are unchanged.

## Run

Use Node.js 22 or later and the two files from the private v0.12 review package:

```sh
node scripts/review-paper1-reconciliation.mjs \
  --source /private/review/evidence/source_reconciliation.json \
  --retained /private/review/evidence/retained_database_evidence.json
```

Add `--json` for structured output. Optional `--source-sha256` and `--retained-sha256` pins must match the exact input file bytes. Output goes to stdout; the command itself creates or overwrites no files. When redirecting output, choose a NEW private destination, never an input path or the public repository. The report contains aggregate research material and is not approved for publication.

| Exit | Meaning |
| --- | --- |
| 0 | The defined correspondence/consistency checks agree. Scientific review and release clearance are NOT established. |
| 1 | At least one defined comparison differs. Investigate it; do not edit expected values merely to obtain a pass. |
| 2 | Missing, malformed, oversized, unsupported or incorrectly pinned input. No count defaults to zero. |

## Evidence contract and scope

The adapter explicitly supports `source.release = "0.12"` and retained status `retained_prior_connector_evidence_not_fresh_database_read`, with the exact historical cohort filter. The input properties `registry_836`, `canonical_829` and `seven_added_records` are legacy field names, NOT expected counts. The tests use different, entirely synthetic counts.

Required sections: canonical row accounting, month/country/date counts, exclusion categories, source group counts and legacy digests, candidate comparison flags, repeated-identifier groups, both retained populations, and retained query timestamps. Missing counts, nulls, numeric strings, malformed flags and duplicate group/locator entries fail validation. Sums, subset bounds and correspondence disagreements remain visible in the report. This is a selected-field contract, not an exhaustive validator of every unused property in the private input package.

The report identifies the two input files by SHA-256. It checks supplied legacy group MD5 values for correspondence but does not re-hash source ledgers or authenticate the earlier SQL transcripts. A reported source-preservation boolean is checked as a supplied assertion, not independently re-established. Source free text, file numbers, patient names, per-record locators, arbitrary metadata and raw errors are not copied into the report.

The command reads regular local files, bounds actual bytes read to 4 MiB per input, rejects invalid UTF-8, and never loads `.env` files. Final-path symlinks are rejected where the platform exposes `O_NOFOLLOW`. No `--live` route or write capability exists. Keep source files stable during a run; two separately read files are not a transaction or an authenticated frozen dataset.

## Interpretation

- A candidate agreement is not an adjudicated duplicate. Matching fields need not be independent. No records are automatically merged or removed.
- Unique clinical episodes remain `null`, even when all arithmetic checks pass. A reviewer must establish that unit separately.
- First-contact and transport labels retain their supplied meaning uncertainty. Counts of qualifying pairs are not elapsed durations, and zero pairs is not zero delay.
- Empty populations cannot support a negative measurement finding. A discrepancy also prevents the report's combined zero-pair indicator being promoted to a positive assertion.
- Running the tool does not refresh retained evidence, scan the manuscript, validate source semantics, adjudicate identity, or establish ethics/independent review. `release_ready` is always false for this report.

Use the existing [frozen-snapshot verifier](paper1-snapshot-verification.md) for its separate release check. This report neither modifies its expected figures nor substitutes retained queries for a required frozen release. A future evidence schema or new population must receive an explicit adapter and tests, not be silently forced into this one.

## Verification and review

The same synthetic case suite runs in normal `pnpm test` through a Vitest wrapper and standalone without dependency installation:

```sh
node --test scripts/lib/__tests__/paper1-review.node.mjs
```

The tests cover wrong/missing counts, correspondence drift, candidate ambiguity, evidence-age labels, unsupported schemas, nonfinite values, private-text containment, CLI limits, exit codes, pinning, and input-file preservation. They do not certify clinical truth. Never add the private package or raw ledgers as repository test fixtures.

For review, inspect the exact diff and rerun tests. Challenge what the report calls consistent, whether uncertainty remains explicit, and whether any source data could escape. Merging this change adds an offline tool only: no migration, model/budget change, app-route change or live manuscript update. Rollback removes these added files without changing stored research data.
