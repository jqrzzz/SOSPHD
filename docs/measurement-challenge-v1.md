# Measurement challenge set v1

Status: authored synthetic training examples and a proposed coding manual.
Not a validated instrument, independent benchmark, clinical advice or permission
for a live study. No real patient or operator records appear in these fixtures.

## What to review

`research-fixtures/measurement-challenge-v1.mjs` contains 15 deliberately fictional
scenarios. Each supplies a narrative, proposed event coding, expected calculation
status and unresolved interpretation. The expected answers were authored with the
rules; passing them demonstrates consistency, not accuracy on unseen real records.

The pure evaluator in `scripts/lib/measurement-challenge.mjs` consumes already-coded
events. It does NOT extract events from text, choose a clinically correct source,
validate whether a commitment or treatment really occurred, or establish a causal effect.

**Common fictional calculation context:** Unless explicitly replaced or made uncertain by a scenario, use 15 January 2030, UTC+07:00, first documented operator awareness at 10:00, the same synthetic episode and its first outbound leg A. Date-only, unzoned and unknown-time scenarios override that default; do not use the default to fill their missing evidence. These are stated exercise assumptions, not established clinical facts.

## Coding order

1. Identify the episode, intended endpoint, and transport leg where relevant.
2. Establish whether the endpoint is applicable. Retain unknown separately.
3. Identify occurrence, occurrence with unknown time, not reached at cutoff, or
   conflicting evidence. Never replace an unavailable time with the cutoff or zero.
4. Identify occurrence time separately from message receipt and data-entry time.
5. Preserve precision and a justified explicit offset. A point-format string is not
   proof of an accurately observed event. Month/day values are not promoted to points.
6. Calculate only when the two coded endpoints meet the declared requirements.
   Report a preceding endpoint as `precedes_start`, not a clipped zero duration.

For this draft, transport activation means provider commitment of an asset/crew for
a specified leg. Request, quote, departure and arrival are distinct events. The live
application's event taxonomy and historical rows are NOT changed by this proposal.

For the financial endpoint, assurance must be accepted as sufficient for the named
next step under its applicable pathway. Issuance, receipt, acceptance and settlement
are not interchangeable. Conditional approval must not become unqualified clearance.
Care start requires a defined pathway-specific treatment action; referral acceptance
and admission alone cannot supply it. Whether the term definitive care is useful
across disparate conditions remains a scientific decision, not a parser convention.

## Review procedure

Give reviewers the narratives and proposed dictionary without showing the expected
answers first. Collect their independent event type, applicability, occurrence status,
time/precision, source basis and reason for uncertainty. Then reveal the authored
answers and record disagreements. Do not change answers merely to improve a score.
Version any clarified rule and rerun all examples, including counterexamples.

A later, genuinely independent assessment needs held-out examples and authorized
reference review. Reviewers of synthetic scenarios are not a clinical gold standard.
Two agreeing abstractions from the same source do not independently authenticate it.
No reviewers were enrolled and no agreement rate is claimed by this implementation.

## Scope of the executable evaluator

Point timestamps require explicit `Z` or numeric offsets, valid civil dates, and
millisecond-or-coarser fractional seconds. `-00:00` is rejected because it does not
establish a known offset. Unsupported leap-second representations and submillisecond
values fail visibly rather than being normalized. Cross-zone instants are compared
as instants, not wall-clock labels. Date/bounded endpoints remain unavailable for
this point calculation; interval-bound estimation is intentionally not implemented.

Every result keeps `clinical_validation: false`. Missing endpoints, unknown
applicability, inapplicability, conflicting accounts, pending milestones, wrong
identity/leg, insufficient precision and preceding endpoints are distinct outcomes.
This is an offline rehearsal, not an operational decision service.

## Relationship to Paper 2

Use the scenarios to challenge a proposed measurement-validation protocol before
real-data execution. They do not supply enrollment, effect estimates, safety rates,
ethics approval or evidence that AI improves coordination. The full proposed protocol
is delivered privately and must be reviewed against the current live Paper 2 before
any version-preserving incorporation.

Methodological anchors: Kahn et al., 2016, doi:10.13063/2327-9214.1244;
Harron et al., 2017, doi:10.1093/ije/dyx177; Vasey et al., 2022,
doi:10.1038/s41591-022-01772-9. These motivate separate verification, linkage and
live-workflow evaluation; they do not prescribe these authored answers.
