# Paper 1 STROBE + RECORD checklist — evidence state 2026-08-31

**Compiled:** 2026-09-05

**Paper:** *The Missing Timestamps: A Sixteen-Month Baseline of Tourist
Medical Coordination in Thailand*

**Working design label:** retrospective descriptive cohort study of routinely
collected operational registry records.

This is a submission-preparation checklist, not a claim that the current live
manuscript already contains every item. The manuscript itself is not stored in
this repository, so `DONE` means that the local evidence packet is sufficient
to write and page-locate the item. Final submission still requires a completed
journal checklist with manuscript page numbers.

No live database was queried for this checklist, and no row-level or identifying
data are reproduced.

## Sources and status rules

Primary reporting sources:

- [STROBE combined checklist](https://www.strobe-statement.org/fileadmin/Strobe/uploads/checklists/STROBE_checklist_v4_combined.pdf)
  and its [official explanation and elaboration](https://doi.org/10.1371/journal.pmed.0040297);
- [RECORD statement and its 13-item extension](https://doi.org/10.1371/journal.pmed.1001885).

The reporting guidelines improve transparency; they are not study-quality
scores. Statuses mean:

- `DONE` — the repository contains adequate, internally consistent evidence to
  write the item; only manuscript placement/page numbering remains;
- `PARTIAL` — some evidence exists, but the reporting statement, table, or
  verification is incomplete;
- `BLOCKED` — a named snapshot, analysis, ethics/legal decision, or author fact
  is still required;
- `NOT APPLICABLE` — the design does not use the method, with the reason stated
  so the item is not silently skipped.

## Release blockers before a checklist can be signed

1. Freeze and cite the append-only `paper1-baseline-v1` analysis snapshot. The
   submission-readiness audit records zero snapshots, while implementation is
   ready ([evidence census](paper1-submission-readiness-2026-08-31.md#evidence-census);
   [`createAnalysisSnapshot`](../lib/data/snapshots.ts)).
2. Run `corepack pnpm verify:figures --snapshot "path/to/download.json"` on a
   fresh export containing the versioned Paper 1 evidence block. Follow the
   [offline verification guide](paper1-snapshot-verification.md), and retain
   the exact download and report with the release.
3. Confirm and write the retrospective ethics/waiver, Thai PDPA, company-data
   access, conflict-of-interest, funding, and funder-role statements
   ([submission-readiness human gates](paper1-submission-readiness-2026-08-31.md#remaining-human-gates)).
4. Run and report the pre-specified seasonality sensitivity analysis with July
   2019 and February 2019 flagged/excluded
   ([seasonality decision](paper1-submission-readiness-2026-08-31.md#seasonality-decision--recommended-treatment)).
5. Do not copy headline figures from the older v0.1 findings memo. It retains
   superseded values, including trauma 179 and 109 animal bites; the current
   assertions are maintained in
   [`PAPER1_CHECKS`](../lib/data/paper1-evidence.mjs) and the
   explicit stale-value registry in
   [`superseded.mjs`](../scripts/lib/superseded.mjs#L25). Reconcile every number
   against the frozen release.

## STROBE mapping

### Title, abstract, and introduction

| Item | Status | Local evidence | Submission action |
|---|---|---|---|
| 1a — identify the design | PARTIAL | The title names the duration and setting but not the observational design; the cohort is described in [findings §1](paper1-baseline-findings.md#1-sample). | Use “retrospective descriptive cohort study” in the title or first abstract sentence. Do not call this a prospective cohort or an intervention study. |
| 1b — balanced abstract | PARTIAL | Headline sample and outcome assertions are enumerated in [`PAPER1_CHECKS`](../lib/data/paper1-evidence.mjs), while the readiness audit records no frozen snapshot ([evidence census](paper1-submission-readiness-2026-08-31.md#evidence-census)). | Write a structured abstract covering source, period, selection, descriptive methods, principal missingness result, limitations, and conclusion; populate numbers only from the frozen release. |
| 2 — background/rationale | PARTIAL | The negative measurement rationale is explicit in [findings §6](paper1-baseline-findings.md#6-the-central-finding-the-timestamps-do-not-exist); source corrections remain in [readiness §§1–5](paper1-submission-readiness-2026-08-31.md#required-literature-corrections). | Apply the verified citation corrections and frame the work as a transferable health-services measurement problem, not proof that the product reduces delay. |
| 3 — objectives/hypotheses | PARTIAL | The local packet establishes descriptive epidemiology, payer structure, and timestamp availability as the intended outputs ([findings overview](paper1-baseline-findings.md)); it does not clearly label analyses as pre-specified, exploratory, or post hoc. | State one primary objective (availability/admissibility of coordination timestamps) and secondary descriptive objectives. Label rule refinement and post-ingest exploratory analyses as post hoc; do not invent a preregistration. |

### Methods

| Item | Status | Local evidence | Submission action |
|---|---|---|---|
| 4 — key design elements | PARTIAL | The case set and observational nature are recoverable from [findings §1](paper1-baseline-findings.md#1-sample) and the [backfill reconciliation record](backfill-plan.md). | Open Methods with one sentence naming the retrospective descriptive cohort, routine operational source, census sampling, and fixed study period. |
| 5 — setting and dates | PARTIAL | Location, source purpose, the historically asserted period (2 Dec 2018–24 Mar 2020), COVID stop, and corridor concentration appear in [findings §§1–2](paper1-baseline-findings.md#1-sample); current boundary assertions are in [`PAPER1_CHECKS`](../lib/data/paper1-evidence.mjs). | Reconcile those historical date assertions against a fresh snapshot using Bangkok calendar dates before transcribing them. Distinguish operational data-collection dates from later ETL/reconciliation dates, and state that the registry served tourist medical coordination rather than research collection. |
| 6a — eligibility, source, selection, follow-up | PARTIAL | Batch provenance, one junk-row exclusion, missing-number rows, older-file reconciliation, and deliberately excluded probable repeat visits are documented in the [backfill status and reconciliation record](backfill-plan.md). | Define the unit as a coordination case/episode, give explicit inclusion and exclusion criteria, identify both source streams, and state whether any within-case follow-up beyond recorded closure was available. |
| 6b — matched cohort details | NOT APPLICABLE | No exposed/unexposed matching or matched comparison groups are described anywhere in the analysis plan. | State “no matching was performed” if the journal form requires a response. |
| 7 — variables | PARTIAL | Event outcomes and selection rules are in [measurement projection §§1–6](measurement-projection.md); historical payer, diagnosis, status, and severity rules are implemented in [`normalize.ts`](../lib/data/backfill/normalize.ts#L77). | Define the primary outcome as admissible computability of TTTA, TTGP, and TTDC, including endpoint-resolution rules. Define every descriptive dimension and say explicitly that there is no exposure-effect estimate or confounder model in this paper. |
| 8 — data sources and measurement | PARTIAL | Date-only precision, derived corridor, free-text diagnosis bucketing, duplicate references, and synthetic references are in [findings §7](paper1-baseline-findings.md#7-measurement-notes-a-reviewer-will-ask-about); event projections are in [measurement projection §§2–6](measurement-projection.md). | Consolidate a source-to-variable table in Supplement S1. Describe comparability and completeness separately for the two source streams and distinguish `date`, `entry`, and `measured` clock resolution. |
| 9 — bias | PARTIAL | Known selection, information, misclassification, missingness, corridor, and calendar-coverage problems are scattered across [findings §§1–2, 4, 7](paper1-baseline-findings.md) and the [clock audit](prospective-clock-audit.md). | Add a structured bias subsection. For each bias, give the likely direction where defensible: e.g. source undercoverage lowers case counts; rule-based classification can move cases between diagnosis groups; absent timestamps prevent rather than merely attenuate interval estimation. |
| 10 — study size | DONE | The study is the reconciled census of 836 eligible backfilled cases, not a sampled or powered comparison ([backfill reconciliation](backfill-plan.md); [findings §1](paper1-baseline-findings.md#1-sample)). | State that no a priori sample-size calculation was performed because all recoverable eligible records in the fixed source period were included. Do not use the operator’s approximate “843” as an eligibility denominator. |
| 11 — quantitative-variable handling | DONE | Status/severity projections, earliest-event selection, running-clock treatment, and time resolution are fully specified in [measurement projection §§2–6](measurement-projection.md); diagnosis and payer mappings are in [`normalize.ts`](../lib/data/backfill/normalize.ts#L77). | Put the full rules in Supplement S1, including timezone, month construction, percentage denominators, `other` versus missing diagnosis, and the rule prohibiting hour-scale differences from day-resolution dates. |
| 12a — statistical methods/confounding | PARTIAL | Current outputs are counts, proportions, distributions, and missingness; reproducible headline checks are enumerated in [`PAPER1_CHECKS`](../lib/data/paper1-evidence.mjs). | Specify descriptive statistics and denominators. State that no effect estimate or confounder adjustment was attempted because Paper 1 has no exposure/comparator causal question. |
| 12b — subgroups/interactions | PARTIAL | Descriptive stratification exists for corridor, nationality, diagnosis, payer, and evacuation ([findings §§1, 3–5](paper1-baseline-findings.md)). | Name these analyses and label them descriptive. State that no formal interaction tests were conducted unless a frozen analysis shows otherwise. |
| 12c — missing data | PARTIAL | Missing date, nationality, care level, diagnosis, corridor, and milestone coverage are partly enumerated in [findings §§1–7](paper1-baseline-findings.md); the recommended seasonality handling is specified in the [readiness audit](paper1-submission-readiness-2026-08-31.md#seasonality-decision--recommended-treatment). | Add a variable-by-variable missingness table with explicit denominators. State “no imputation”; distinguish missing, unmatched, unclassified, and structurally unavailable fields. |
| 12d — loss to follow-up | NOT APPLICABLE | The analysis concerns completed historical coordination records, not a prospective person-time follow-up cohort; all included cases are described as terminal in [findings §1](paper1-baseline-findings.md#1-sample). | Say no prospective follow-up was undertaken and define the available episode window. If outcomes after operational closure are later added, reopen this item. |
| 12e — sensitivity analyses | BLOCKED | A complete-series display and exclusion of the two coverage-gap months are pre-specified but not yet reported ([seasonality decision](paper1-submission-readiness-2026-08-31.md#seasonality-decision--recommended-treatment)); the frozen snapshot is absent. | After snapshot freeze, rerun monthly descriptions with July 2019 and February 2019 excluded and report whether the qualitative high-season conclusion changes. |

### Results

| Item | Status | Local evidence | Submission action |
|---|---|---|---|
| 13a — numbers at each selection stage | PARTIAL | The two batches (665 + 171), exact-overlap reconciliation, exclusions, and final 836 are documented in [backfill reconciliation](backfill-plan.md). | Produce a source-stream flow table/diagram. Start from observed rows in each source, show invalid/duplicate/overlap/excluded rows, and end at 836 analysed cases. |
| 13b — reasons for exclusion/non-participation | PARTIAL | The record identifies one junk row, two deliberately excluded probable repeat visits, overlaps among older copies, and the fact that 843 was an estimate rather than a verified source denominator ([backfill reconciliation](backfill-plan.md)). | Report each exclusion category with mutually exclusive counts. Do not present “843 minus 836” as a participant flow unless the raw candidate-row denominator is reconstructed. |
| 13c — flow diagram | PARTIAL | No submission-ready flow figure is referenced in the local evidence packet. | Add one de-identified RECORD/STROBE flow diagram as supplementary material and cite it from Methods and Results. |
| 14a — participant characteristics | PARTIAL | Selected case characteristics are available in [findings §§1, 3–5](paper1-baseline-findings.md), but not as one complete descriptive table. | Build Table 1 with geography/corridor, nationality, diagnosis category, payer, evacuation, care level, and relevant record-completeness fields. Avoid PHI and avoid implying these cases are a representative sample of all tourists. |
| 14b — missingness by variable | PARTIAL | Several missingness counts are recorded, and the primary milestone coverage table appears in [findings §6](paper1-baseline-findings.md#6-the-central-finding-the-timestamps-do-not-exist); completeness is not tabulated for every reported variable. | Add `n/N (%) missing` beside each Table 1 and outcome variable, using the frozen snapshot as denominator. |
| 14c — follow-up time | NOT APPLICABLE | There is a 16-month database-observation window, but no person-time follow-up analysis. | Report the registry period under Setting, not as participant follow-up. |
| 15 — outcome data | DONE | The principal outcome is fully specified: 835 first-contact records, no admissible end-to-end TTTA/TTGP/TTDC, and explicit raw milestone coverage ([findings §6](paper1-baseline-findings.md#6-the-central-finding-the-timestamps-do-not-exist); [submission-readiness evidence census](paper1-submission-readiness-2026-08-31.md#evidence-census)). | Present raw event coverage and admissible interval counts separately so nine date-only transport values are not mistaken for measured activation times. |
| 16a — main estimates and precision | PARTIAL | Counts and proportions are defined, but the local packet does not establish a final policy for confidence intervals or adjusted estimates. | Report `n/N (%)` for all descriptive estimates. State that estimates are unadjusted and explain whether confidence intervals are omitted for the complete registry census or used only to express uncertainty beyond the database population. |
| 16b — boundaries for categorized continuous variables | NOT APPLICABLE | Current categories are source enums, text-rule buckets, or calendar months; no continuous clinical variable is shown as cut into arbitrary bands. | State N/A. Reopen if age, interval, or another continuous measure is binned in the final manuscript. |
| 16c — translate relative to absolute risk | NOT APPLICABLE | The paper estimates no relative risk. | State N/A. |
| 17 — other analyses | PARTIAL | Descriptive subgroup work is recorded; the planned seasonality sensitivity result is absent. | Separate primary, secondary, exploratory, and sensitivity results. Report analyses actually run; do not imply pre-specification retrospectively. |

### Discussion and other information

| Item | Status | Local evidence | Submission action |
|---|---|---|---|
| 18 — key results against objectives | DONE | The core result and its implication are stated in [findings §6](paper1-baseline-findings.md#6-the-central-finding-the-timestamps-do-not-exist) and the [readiness verdict](paper1-submission-readiness-2026-08-31.md#readiness-verdict). | Lead with measurement non-computability, then the secondary epidemiology and payer findings. Keep prospective instrumentation as an implication, not a result of this cohort. |
| 19 — limitations, direction, magnitude | PARTIAL | Limitations are identified but not yet synthesized, including single-corridor concentration, two coverage-gap months, rule-based diagnosis, sparse care level, date-only timestamps, and source reconciliation ([findings §§1–2, 4, 7](paper1-baseline-findings.md)). | Add a dedicated limitations section addressing direction and plausible magnitude when supportable; explicitly cover misclassification, unmeasured confounding, missingness, operator-generated data, and absence of a population denominator. |
| 20 — cautious interpretation | PARTIAL | The readiness audit narrows several literature claims and causal framings ([required corrections](paper1-submission-readiness-2026-08-31.md#required-literature-corrections)). | Apply every correction, avoid causal language, and distinguish “cannot be computed from this registry” from “coordination was delayed.” |
| 21 — generalisability | DONE | Thailand supplies about 95% of cases, the Krabi–Bangkok corridor dominates, and 155 cases are unassigned/Indonesia; limits are explicit in [findings §1](paper1-baseline-findings.md#1-sample). | Define inference to this operator’s recorded tourist-coordination cases during the period. Discuss transferability of the measurement problem separately from representativeness of case distributions. |
| 22 — funding and funder role | BLOCKED | Venue planning requires explicit non-commercial purpose, company ownership, conflict management, and funding disclosure ([journal shortlist, BMC risk](paper1-journal-shortlist-2026-08-31.md#1-bmc-health-services-research--recommended-first-submission)); author/funder facts are not settled in the local packet. | Obtain author-approved wording naming every funding source and role, or “no specific funding”; separately disclose operator/company ownership, data access, analysis role, and any sponsor independence. |

## RECORD extension mapping

RECORD is applied because the source registry was created for operational care
coordination rather than for this research question. Its numbered additions are
mapped below; the paired STROBE item remains applicable.

| RECORD item | Status | Local evidence | Submission action |
|---|---|---|---|
| 1.1 — name the routine-data type/database | PARTIAL | The working title says “baseline” but not “routinely collected operational registry”; source identity is described in [findings §1](paper1-baseline-findings.md#1-sample). | Put “routinely collected tourist medical-coordination registry” in the title or abstract. Name Tourist SOS only after the COI/data-ownership wording is approved. |
| 1.2 — region and time frame in title/abstract | PARTIAL | “Thailand” and “sixteen-month” are in the title; exact dates and the minority Indonesia records appear only in [findings §1](paper1-baseline-findings.md#1-sample). | Give 2 Dec 2018–24 Mar 2020 and Thailand in the abstract; disclose the Indonesia minority rather than implying a strictly Thailand-only cohort. |
| 1.3 — disclose linkage in title/abstract when applicable | PARTIAL | Two source streams and older registry copies were reconciled by exact name+date matching locally ([backfill reconciliation](backfill-plan.md)). | Resolve the classification before submission: if this is treated as record linkage, say “reconciled across two operational source streams” in the abstract; if it is version deduplication rather than database linkage, state “no cross-database linkage was performed” and mark 1.3 N/A. |
| 6.1 — detailed population-selection codes/algorithms | PARTIAL | Source selection and exclusions are documented in [backfill reconciliation](backfill-plan.md), but not as one replicable algorithm. | Publish the ordered inclusion, matching, deduplication, synthetic-reference, and exclusion rules in Supplement S1, with a version/commit identifier. |
| 6.2 — validation of selection algorithms | PARTIAL | Exact overlap counts and regression checks exist, but no external validation study or diagnostic-accuracy study is documented ([backfill reconciliation](backfill-plan.md); [`transform.test.ts`](../lib/data/backfill/__tests__/transform.test.ts#L3)). | State that no external validation of case-selection algorithms was available. Report the internal reconciliation checks and their results without calling unit tests clinical validation. |
| 6.3 — linkage flow display when applicable | PARTIAL | Matching across versions/streams is described in prose; no flow display exists. | If 1.3 is applicable, add linked/unlinked/overlap counts to the participant-flow figure. Otherwise mark N/A with the same explicit no-linkage rationale. |
| 7.1 — full classification code/algorithm lists | PARTIAL | Payer aliases, ordered diagnosis keywords, status mappings, and severity mappings are executable in [`normalize.ts`](../lib/data/backfill/normalize.ts#L77); event mappings are in [measurement projection §§2–6](measurement-projection.md). | Export the exact rules to a citable Supplement S1 and identify the code release/commit. Include category order, whole-word exceptions, unknown defaults, and changes made after audit. |
| 12.1 — investigators’ extent of database access | PARTIAL | The [backfill record](backfill-plan.md) establishes local access to source files and a PHI-minimizing ETL; the exact investigator/company access relationship is not stated in manuscript-ready form. | Disclose whether the investigator had full or partial source-registry access, which fields were unavailable, who performed extraction, and the operator-owner role. |
| 12.2 — data-cleaning methods | DONE | Cleaning, exact-match reconciliation, payer normalization, diagnosis bucketing, duplicate disambiguation, synthetic references, date normalization, and regression corrections are documented in [backfill reconciliation](backfill-plan.md), [`normalize.ts`](../lib/data/backfill/normalize.ts#L77), and [`transform.test.ts`](../lib/data/backfill/__tests__/transform.test.ts#L3). | Condense these into Methods and put complete rules/results in Supplement S1. Preserve the chronology of post-ingest corrections rather than presenting the final classifier as pre-specified. |
| 12.3 — linkage method/quality when applicable | PARTIAL | Deterministic exact name+date matching was local; 120/129 older-file rows overlapped the canonical registry, and names did not enter the research database ([backfill reconciliation](backfill-plan.md)). | If applicable, report match fields, deterministic method, who linked, overlap/unlinked counts, manual-review rules, and known false-match/missed-match risk. Do not expose identifiers. Otherwise mark N/A consistently with 1.3/6.3. |
| 13.1 — detailed derivation of included persons | PARTIAL | Final case derivation is reconstructable from [backfill reconciliation](backfill-plan.md), but the older approximate 843 claim is not a valid starting denominator. | Supply the source-stream flow table/figure and explain filters for data quality, availability, overlap, repeat visits, and invalid rows. Use observed source counts only. |
| 19.1 — implications of data not collected for research | PARTIAL | The central missing-timestamp result, date-only precision, incomplete fields, rule-based classifications, and operational-purpose limitations are documented in [findings §§6–7](paper1-baseline-findings.md#6-the-central-finding-the-timestamps-do-not-exist). | Explicitly discuss misclassification, unmeasured confounding, missing data, changing source coverage, and the inability to distinguish true zero activity from missing capture. |
| 22.1 — access to protocol, raw data, and code | BLOCKED | Code can be referenced, snapshots are designed to be downloadable and append-only ([snapshot implementation](../lib/data/snapshots.ts#L1)), but no snapshot exists and ethics/legal access conditions for company-held case data are unresolved ([readiness human gates](paper1-submission-readiness-2026-08-31.md#remaining-human-gates)). | Write a data/code availability statement naming the repository release, frozen aggregate snapshot, protocol location/registration status, restrictions on row-level data, access request route, decision authority, and why restrictions are necessary. Never promise public raw data before ethics/legal approval. |

### RECORD explanatory points without separate numbered items

| Point | Status | Required action |
|---|---|---|
| Exploratory versus confirmatory analysis, hypothesis timing, protocol, and registration | PARTIAL | State which questions preceded data inspection, which classifier corrections and analyses were post hoc, whether a protocol exists, and honestly state “not registered” if applicable. |
| Source, database, and study population hierarchy | PARTIAL | Define: source population (tourist medical-coordination encounters potentially served by the operator), database population (encounters recorded in the available operational sources), and study population (836 records surviving the stated selection/reconciliation algorithm). Narrow the source-population wording if the operator’s true capture boundary cannot be established. |

## Sign-off order

1. Resolve the conditional linkage classification once; apply it consistently
   to RECORD 1.3, 6.3, and 12.3.
2. Freeze `paper1-baseline-v1`, download its payload, and record snapshot ID,
   label, creation time, analysis-code commit, and data cut-off.
3. Run the headline, missingness, participant-flow, and seasonality checks against
   that frozen payload; reconcile every manuscript table and figure.
4. Add Supplement S1 (selection, cleaning, mapping, and measurement rules) and
   the participant-flow figure.
5. Insert the approved ethics/PDPA, funding, COI, data-access, and code-availability
   statements.
6. Complete the target journal’s official STROBE and RECORD forms with final page
   numbers, then perform the citation-to-claim audit in the
   [machine-verifiable release gate](paper1-submission-readiness-2026-08-31.md#machine-verifiable-release-gate).
