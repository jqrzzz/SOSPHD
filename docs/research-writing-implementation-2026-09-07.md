# Research writing improvement: first implementation tranche

Base: `0ed6b58c3c185d597e28f28222a3b56c35e5690f` on `main`.
Working branch: `chatgpt/research-writing-quality-2026-09-07`.
Scope: research writing policy, Paper Builder and synthetic regression coverage.
No live database or manuscript changes; no model/provider or budget changes.

## Implemented

1. Shared, versioned writing policy and paper/stage profiles.
2. Paper and stage selectors, introduction and analysis-plan sections, accurate
   paper-specific new-document names/tags, and provisional evidence warnings.
3. Removed instructions prescribing stepped-wedge methods, predetermined payment
   delay findings, novelty and finished-manuscript word counts.
4. Replaced prewritten findings and illustrative case rows with numeric aggregates.
   Completed-pair denominators are explicit; running/invalid clocks are excluded.
   No patient references or case notes are forwarded from workbench records.
5. Protocol and later-paper drafting does not fetch workbench records. Requests
   for results without a study-result dataset return a deterministic reporting
   placeholder, without an AI call or claim about actual enrollment status.
6. Added generation model/policy receipts and refusal to save cut-off/empty output
   as a complete draft. Provider errors are returned without raw private details.
7. Preserved research authentication, usage gating and bounded requests. Legacy
   section-only requests default to Paper 1 exploratory drafting.
8. Clarified agent permission for substantive revision with recoverable versions.

## Verification boundaries

The dependency-free writing module passed a local strict TypeScript check and
66 synthetic offline checks during implementation. These are pure-module checks,
not the full application test suite, deployed browser verification or proof of
model output accuracy.

Added Vitest suites cover profiles, prompt rules, numeric aggregation, no-result
behavior, privacy canaries, rejection ordering, provider failure and output
completion. Run the existing CI for full lint, typecheck, build, unit tests and
disposable database contracts. Record its actual result in the pull request;
adding a test is not proof it passed.

No paid generation, deployed browser session, live data read/write, snapshot
creation or manuscript promotion is part of this tranche. Prompt assertions test
the instructions supplied, not a guarantee of any model's scientific accuracy.

## Continue on the same branch

- Apply the existing Paper 1 correction packet and the new scope/denominator
  review to private, version-preserving manuscript revisions.
- Repair Papers 2 and 3 timing definitions, pilot design and comparative methods.
- Build a bounded section-edit workflow with full-document context, stale-range
  checks and version recovery before removing the current whole-document limit.
- Add a verified selected-cohort/frozen-snapshot path for analysis writing; do not
  expose a submission-ready mode merely because a user selects an option.
- Align the separate Docs assistant with the writing contract.
- Review confidence, abstention, actual model/protocol identity and urgent override
  handling as a distinct, versioned intervention-protocol change.
- Qualify consent-policy assertions with appropriate review; do not loosen data
  use permissions or perform study enrollment through this software tranche.

## Existing work retained

- `paper1-submission-readiness-2026-08-31.md`
- `paper1-strobe-record-checklist-2026-08-31.md`
- `paper1-snapshot-verification.md`
- `paper2-reporting-readiness-2026-08-31.md`
- `outcome-portfolio-2026-08-31.md`

Their completed source checks remain useful. Their scoped deferrals do not
prohibit this newly authorized development tranche. Their human approval gates
still apply to the corresponding consequential actions.
