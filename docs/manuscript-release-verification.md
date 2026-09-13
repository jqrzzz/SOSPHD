# Manuscript-specific release checks

This is an additive offline verifier. The existing `verify-paper-figures.mjs`,
its default historical assertions, snapshot format and capture path are unchanged.
Do not change old expected values merely to turn drift into a passing result.

## Purpose

A private release manifest pairs one exact Markdown manuscript version with exact
aggregate evidence files and an explicit list of claims. It checks byte identities,
version marker, declared population/unit, selected quantities and exact text locators.
It does not certify the scientific meaning of the text, search all claims or references,
authenticate the source, or query the current database.

```sh
node scripts/verify-manuscript-release.mjs \
  --manifest /private/release.json \
  --manuscript /private/paper.md \
  --evidence registry=/private/retained-query.json \
  --evidence source=/private/source-audit.json --json
```

Supply paths explicitly; the tool never opens filenames from manifest contents.
It has no live fallback, environment-file loading, provider call or write path.
Each regular input file is bounded to 4 MiB. Invalid UTF-8, missing values, unknown
formats, unsupported claims and inconsistent supported counts fail closed.

Exit 0 means only `declared_checks_agree`; 1 means mismatch; 2 means invalid input.
The JSON report always keeps scholarly and source-authentication clearances false.
Hashes identify bytes. They do not authenticate their origin.

## Manifest contract

Use `format: "sosphd-manuscript-release-v1"` and `paper: "paper1"`.
`manuscript` contains `version`, lower-case `sha256`, and an exact `marker` containing
`v` followed by that version. The manifest must have at least one evidence input
and one claim; unused evidence and duplicate IDs are rejected.

Each `evidence` entry contains `id`, `format`, `sha256`, `label`. For a supplied
snapshot, `label` must be nonempty and match its metadata. Other adapters use an
empty label. Supported formats:

- `retained-paper1-v1`: the earlier explicitly labelled query-transcription format.
  Populations `imported` and `canonical-subset` map to its legacy `registry_836`
  and `canonical_829` objects. Those are format keys, not hard-coded assertions
  that the counts must stay at those numbers. This does not make a transcription
  a fresh or authenticated extract.
- `source-audit-v012`: the existing minimized source-audit format. `source-ledger`
  identifies the enumerated ledger, with separate all-body and selected-row fields.
- `paper1-snapshot-v1`: selected numeric fields in the app's existing
  `payload.paper1` block. Only the imported population is supported. This adapter
  performs bounded identity/count checks, NOT complete snapshot-schema validation;
  use the existing schema validator separately. Never invent a canonical subset
  from aggregates that do not contain it.

Each claim contains exactly `id`, `evidence`, `population`, `field`, `unit`,
`expected`, `anchor`, `occurrences`. Field names and units are allowlisted in
`scripts/lib/manuscript-release.mjs`. Expectations are nonnegative safe integers;
null, a numeric string and zero are different. The exact anchor must visibly include
the expected number, but locating that string does not establish its meaning.
Counts of locators do not scan the rest of the manuscript for contradictions.

Construct and review the manifest beside the exact manuscript/evidence files.
Do not automatically infer a scientific assertion from a convenient matching number.
Record a new manifest after an intentional revision; retain the old release and its
report. A wrong version or changed byte sequence should remain a mismatch until
reconciliation explains it. Keep manifests, manuscripts and nonpublic evidence out
of Git, including branches and public CI artifacts.

## Testing and limitations

The shared synthetic suite runs both under Vitest and Node:

```sh
node --test scripts/lib/__tests__/scholarly-evidence.node.mjs
pnpm test
```

Fixtures test wrong versions, population substitutions, mismatched numbers, invalid
values, byte changes, source partitions, snapshot labels and private-output behavior.
The report omits manuscript excerpts, arbitrary source fields and source filenames.
Custom IDs are metadata, not an anonymization guarantee; keep the whole report private.

This tool pairs an existing draft with evidence; it does not edit a manuscript,
resolve clinical identity, silently migrate a snapshot or grant release approval.
