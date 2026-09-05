# Verify Paper 1 against a frozen snapshot

The snapshot fixes the evidence used for the paper at one recorded capture
window. Later registry changes do not change the downloaded file or its
verification result. The app captures the evidence; the verifier checks it
locally. No manual calculation of the figures is required.

## Capture and check

1. After the updated app is deployed, sign in as the owner and open the dashboard.
2. Pause registry corrections while capturing. Freeze a new analysis snapshot
   with the label `paper1-baseline-v1`, then download its JSON file.
3. Keep that download private and run this command from the repository:

   ```sh
   corepack pnpm verify:figures --snapshot "path/to/download.json"
   ```

The report records the snapshot ID, label, creation time, baseline source,
capture start/end times, SHA-256 checksum, and all 30 figure checks. The default
command reads local files only. It does not load environment files, authenticate,
or query the database. Older downloads without the Paper 1 evidence block fail
validation. Create a new snapshot rather than editing the old file or falling
back to live data.

| Exit code | Meaning | Next action |
|---|---|---|
| `0` | All packaged figures match the manuscript assertions; any requested stale-phrase scan also passed. | Retain the exact file and report with the release. |
| `1` | A figure differs, or a supplied manuscript contains a known stale phrase. | Review the discrepancy before freezing the manuscript. |
| `2` | Input, identity, checksum, or evidence validation failed. | Correct the command or obtain a valid new download. |

## Optional checks

```sh
corepack pnpm verify:figures --snapshot "path/to/download.json" --json
corepack pnpm verify:figures --snapshot "path/to/download.json" --label "paper1-baseline-v1"
corepack pnpm verify:figures --snapshot "path/to/download.json" --sha256 "YOUR_64_CHARACTER_HEX_CHECKSUM"
corepack pnpm verify:figures --snapshot "path/to/download.json" --manuscript "path/to/paper1.md"
```

`--sha256` requires an exact match to the file bytes, including whitespace. Save
the checksum with the release before using it as a later comparison. It identifies
those bytes; it does not authenticate their origin or prove that the underlying
records were correct.

Without `--manuscript`, the report explicitly says manuscript text was not
checked. With it, the verifier hashes and scans that local Markdown file for the
existing list of known superseded phrases. This is a limited text check, not a
complete numerical, citation, or scientific review of the manuscript.

## What is captured

The versioned `payload.paper1` evidence block contains aggregates for cases whose
source is `backfill_2018_2023` and their events and interval rows. Its scope is
separate from older dashboard snapshot metadata, which can summarize the mixed
registry. Use the Paper 1 block for this release's figure checks.

The new evidence block stores no raw case IDs, event IDs, or free text. The full
existing snapshot download can still contain per-case information in its other
sections. Keep the complete download out of public Git history, public artifacts,
and pull requests.

Capture records a read window, not a transaction across every paginated query.
Avoid editing or importing registry data during capture. The builder rejects
missing selected fields, duplicate or out-of-scope records, repeated non-`NOTE`
milestones, and inconsistent interval coverage or precision. Multiple notes are
valid. A case with no `FIRST_CONTACT` legitimately has no interval row.

Case-date bounds use Bangkok calendar dates (UTC+7). Reconcile any difference from
the manuscript's historical date assertions against the new frozen release.
Raw date differences remain diagnostic observations; they do not become admissible
TTTA, TTGP, or TTDC merely because two dates can be subtracted. Interval availability
must agree with the presence and recorded precision of both endpoints.

## Separate live diagnostic

```sh
corepack pnpm verify:figures --live
```

`--live` must be used alone. It runs the legacy diagnostic against the live
registry and requires the existing authenticated-owner setup. Its broader scope
and changing inputs make it unsuitable as the frozen-paper release check.

A successful snapshot check completes the figure-verification gate. Ethics,
authorship, literature corrections, journal formatting, and final manuscript
review still follow the [Paper 1 submission checklist](paper1-submission-readiness-2026-08-31.md).
