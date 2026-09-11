# Codex handoff: evidence pairing and measurement rehearsal

## Starting point and scope

Base: `7709e6d917d5218df2fc73ff18b92c96bed015b4`, after the owner's merges of
PRs #29, #30 and #31. This pass adds offline evidence pairing, synthetic measurement
examples, and actual-browser integration tests with a mocked backend. Read AGENTS.md,
the research-writing policy and academic research standard first.

The owner controls merge and release. No live source record, manuscript, annotation,
snapshot, clinical definition, permission, model or budget is changed by this pass.
Private manuscripts and evidence are delivered separately, not copied into public Git.

## Code to review

- `scripts/verify-manuscript-release.mjs` and `scripts/lib/manuscript-release.mjs`:
  explicit version and byte pairing; selected-claim comparison; no changes to the
  historical verifier or snapshot parser. Read `docs/manuscript-release-verification.md`.
- `research-fixtures/measurement-challenge-v1.mjs` and the pure measurement evaluator:
  15 authored fictional scenarios, NOT a validated benchmark or operational engine.
  Read `docs/measurement-challenge-v1.md`.
- `scripts/browser/revision_acceptance.py`: runs the real Next page and Server Actions
  against an explicitly synthetic HTTP auth/persistence service on loopback. It tests
  client interaction, full-draft preservation, response-loss retry, source/note conflict,
  archive-readback failure, export and narrow-screen behavior. No external URL is an
  input; local environment files are refused. Credentials and records are fictional.
- `.github/workflows/scholarly-browser.yml`: separate, bounded, read-only-token CI job;
  no deployment or hosted credentials. Browser tooling is isolated from app dependencies.

## Verification boundaries

The browser harness is more than a mocked component test: it exercises the actual
page, form interaction, server action and store adapter. But auth/persistence are
MOCKED. It does NOT validate real Supabase auth, PostgREST, database constraints or
RLS. Do not relabel it as a completed real-database signed-in acceptance pass.
The existing disposable database-contract suite is separate evidence, not a substitute
for that end-to-end check. A real isolated Supabase acceptance pass remains open.

A successful release report means only the declared quantities, byte identities and
text locators agree. It does not authenticate retained SQL transcripts, inspect every
sentence, validate event meaning or clear publication. The private v0.13 paper is
paired with retained evidence, not advertised as a new live data capture.

Exact current commit, CI results, failures and fixes belong in the PR. Do not copy
an earlier commit's green checks forward. Synthetic test totals are not a scientific
quality score. Review unknown-input behavior, output privacy and population semantics.

## Private scholarly continuation

A full proposed Paper 2 measurement-validation protocol develops one referral/transfer
pathway, event-specific denominators, independent abstraction, precision planning,
reference limitations and a later separately authorized AI-workflow phase. It extends
the prior methods companion, not the inaccessible live manuscript. The prior companion
and exact Paper 1 release are preserved. A private source/claim manifest and pairing
report identify the exact Paper 1 version rather than creating a cosmetic v0.14.

No final sample size, clinical error tolerance, recruitment site, ethics determination,
human reviewer participation or intervention benefit is invented. Those decisions
remain explicit. Study planning and synthetic rehearsal can continue meanwhile.

## Next meaningful checks

Inspect the recorded CI outputs and test the true Supabase path in an isolated
owner-authenticated environment. Obtain a fresh authorized registry capture and
compare it with the retained evidence, without overwriting either. Read current
Paper 2 and annotations before applying the privately proposed protocol. Resolve
pathway/event/tolerance decisions with qualified clinical and methods reviewers.
Do not add another dashboard or rename uncertainty as validation.
