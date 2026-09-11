# Scholarly revision handoff | 11 September 2026

## Read first

The owner authorizes focused research, manuscript improvements and code PRs. Manual owner merge; no production promotion, new spending, public disclosure of private manuscripts, or hosted data changes as part of agent execution. Read AGENTS.md. PRs #29 (writing policy/builder) and #30 (offline reconciliation report) are separate, unmerged at this work's starting checkpoint. This change is based directly on main and does not silently include either PR.

## This PR: a usable, non-destructive section revision workflow

From a saved document, choose **Revise saved sections in a new tab**. The separate tab protects unsaved work in the existing editor. At `/docs/[id]/revise`:

1. Read open review notes and choose a Markdown heading section.
2. Write/paste the replacement body and a change note. The selected heading is retained; a parent body includes its subsections.
3. Preview the full assembled manuscript and explicitly confirm review.
4. Save a separate full draft. The workflow first archives the entire base under the source's existing version history and verifies it by readback, then inserts the full new draft and reads it back. Continue from that draft for the next sequential revision.

This is not inline AI generation. It accepts authored or externally drafted text without a provider call, new model, budget increase or document-wide model context. No AI provider receives the manuscript from this workflow. It does not certify facts or automatically repair citations.

## Preservation and failure contract

- Only authenticated, allowlisted owner access; explicit owner filters on every read. No seeded/degraded manuscript fallback.
- Only `research.docs` and `research.doc_versions` receive INSERTs after an explicit Save. Review annotations are read-only. No UPDATE, DELETE, upsert, data migration or schema change.
- The source token covers the full text, metadata and open review notes. Changed source/notes before saving produce a conflict, not a stale overwrite.
- The archive and draft are separate append-only operations, NOT a database transaction. A failed draft insert can leave one extra recoverable archive row. This is intentional and reported honestly. A concurrent edit after the source read cannot be overwritten; the archived base identifies exactly what was used, not a promise to serialize all writers.
- Stable request IDs and receipt hashes recover identical retries, including a lost success response. A changed request, changed saved draft or conflicting archive is not overwritten.
- Successful save means both full base and new full draft were read back. Failed reads never become success or empty source data.
- No automatic resolution of annotations, promotion to active/submitted, or edits to study definitions.
- Unsaved proposals live in memory only. A browser close/reload warning and explicit private export protect work. Export includes the full base and proposals; treat it as private. Download is not a database save.

## Supported scope

ATX Markdown headings (`#` to `######`); fenced code and HTML comments are excluded from heading discovery. Setext-only documents need conversion in a separate reviewed edit. This is an exact-range tool, not a complete CommonMark semantic parser. It does not rewrite the selected outer heading or renumber following sections. Empty body replacement is rejected; complete structural reorganization remains a separate reviewed workflow rather than an accidental partial generation.

Limits: 1 MiB full manuscript, 128 KiB replacement, 500 headings, 200 open annotations, 2,000-character change note. No existing AI budget or request limit was increased. Exceeding a limit fails visibly; text is never silently clipped. The existing general-purpose editor and restore paths are unchanged and are NOT made concurrency-safe by this PR. Use the new route for this preservation contract.

## Tests and verification

`pnpm test` includes pure range, Unicode and append-only save/retry tests, owner-scoped store tests and action-failure tests. Local core verification can compile the two dependency-free TypeScript modules and run the shared synthetic cases using Node's test runner. Integration status and exact commit are recorded in the PR, not inferred from local checks.

Manual acceptance in an isolated authenticated test environment: select parent and nested sections; change notes; preview; save; verify original unchanged and full base in version history; open saved draft; test interrupted save/retry; edit source in another tab and expect stale rejection; check narrow screens and keyboard access. Do not perform mutation tests against live private manuscripts. Automated tests use synthetic documents only.

The session container cannot resolve GitHub for a full checkout/dependency install. Official current Next.js Server Function documentation was consulted in place of unavailable bundled docs; repository CI is the integration verification route. No framework or dependency upgrade is included. Default same-origin Server Action protection is retained; each action authenticates independently.

## Private research deliverables (not in Git)

Paper 1 v0.13 is a full scholarly revision of the privately delivered v0.12, not a new live database manuscript. The private package preserves the exact prior release and adds a contribution/claim map, an uncertainty-to-claim decision table, literature access notes, verification outputs and a Paper 2 measurement protocol development draft. Do not invent paths to those files: obtain the owner's actual conversation package or local copy and verify its manifest.

The current database refresh was attempted twice, including a minimal connection check, and both requests timed out. No fresh database result or frozen analysis release was established. Retained query evidence is labelled with its earlier provenance. No live manuscript annotations can be claimed rechecked in this session. This limits claims about the current registry, not drafting from the preserved record-level evidence.

## Recommended next Codex session

Review the actual diff, tests and private manuscript, not just agent summaries. Resolve concrete findings with locations and evidence. Do not demand that every possible future study be completed before reviewing a bounded record-level methods paper. Conversely, do not call passing software checks scientific validation.

Next steps in order: isolated browser acceptance of this route; merge decision by owner; regenerate the bounded registry evidence through approved owner access; reconcile versioned assertions to the selected manuscript; obtain independent event-definition/methodological review. Advance the Paper 2 protocol in parallel, without inventing enrollment, clinical results, ethics approvals or AI efficacy.

## Technical references inspected

- Next.js Server Functions: https://nextjs.org/docs/app/getting-started/updating-data
- Next.js Server Action security and default body bound: https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions
- Supabase insert/readback behavior: https://supabase.com/docs/reference/javascript/insert

These references describe APIs, not proof that this application is tested in production. No production promotion was requested or performed. Standard Git preview automation may run when the branch is pushed.
