# SOSPHD academic research standard

Version 1.0 | 7 September 2026 | Applies alongside AGENTS.md and the research writing policy.

## Purpose and authority

Build arguments that remain useful after attempts to disprove them. Write, explore, calculate and compare alternatives without waiting for every eventual publication decision. Preserve recoverable work, not every sentence. This standard does not grant ethics approval, permission to publish private data, hosted-database write access, or authority to change clinical practice.

The standard is a working review procedure, not a claim that the application automatically enforces every item. A checklist cannot certify scientific quality.

## 1. Define the question and the unit

At the start of an analysis record: the research question; source population; selected records; exclusions; analysis unit; intended outcome; and what would contradict the main interpretation. Distinguish a patient, episode, claim, source row, imported row, and event. A unique database ID does not prove a unique episode.

Keep observed results, interpretations, hypotheses, and simulations visibly separate. Exploratory work may change the question. Record the change rather than pretending it was prespecified. A protocol draft is not registered until registration is verified.

## 2. Identify and preserve the evidence

Locate the named source and version, not just a related file. Record the file ID, relevant worksheet/range, source owner, access date, export format, and byte checksum. Preserve the source unchanged. Record whether an export is the complete workbook or one sheet. Copies from one underlying ledger are not independent replication.

Source permission, ethics determination, and technical accessibility are different. Do not infer permission for public release from an ability to read the file. Keep identifiers and case-level source data out of public Git history, model prompts, logs, and public artifacts. Perform necessary authorized linkage in private processing; return only minimized audit results. Hashes identify bytes or matching inputs, not truth or anonymity.

## 3. Validate the transformation, not only the totals

Trace an analytic value back to its source cell or event. Record source meaning, source precision, transformation, stored meaning, and remaining uncertainty. Compare selected keys and paired values, not only marginal totals. Keep blank, unknown, not applicable, not observed, and an explicit negative separate. Do not silently map an unrecognized category to a reassuring default.

For dates, inspect stored values and formatting. Record calendar convention, timezone and precision separately. Do not parse an ambiguous display string when a numeric source date is available. A date-of-service field is not automatically first contact. A payment date is not automatically a payment guarantee. A precise message timestamp is not automatically the time the described action occurred.

Re-execute the documented transformation. A mismatch is an investigation finding: retain both values, identify the affected records privately, and explain or adjudicate it. Never edit expectations merely to make a test green. A matching transform can still implement the wrong meaning.

## 4. Audit linkage and ascertainment

Account for source rows through selection, exclusion, linkage and import in a reconciled flow. Inspect duplicates, contradictory identifiers, unmatched records and source-version changes. Names can change order or spelling; file numbers can be reused. No single identifier is universally sufficient.

Use explicit linkage rules and preserve evidence for disputed pairs. Do not equate failure of a name match with a new episode. Conversely, do not delete records solely because a file number and date match. Adjudicate consequential decisions against additional source evidence. Explore stricter and looser linkage rules as labelled sensitivity analyses; never choose them only because they improve the desired result.

Do not describe the ratio of retained records to spreadsheet rows as population completeness unless the denominator independently enumerates eligible episodes.

## 5. Test the claim against competing explanations

For each important finding ask whether it could result from cohort leakage, duplicate imports, transformation defaults, missing endpoints, insufficient precision, ambiguous event meaning, recording delay, selection, or an inappropriate denominator. Do not assume one of these explanations merely because it is convenient.

Use the least elaborate analysis that answers the question. Add sensitivity analyses that could change the conclusion. Unknown parameters do not bar planning: use disclosed ranges or simulations without describing assumed values as observations. Missing measurement does not prove clinical delay, ineffective care, or universal impossibility of another measurement approach.

## 6. Verify sources at the claim level

For every load-bearing literature claim record bibliographic identity, exact claim supported, population, endpoint/denominator, inspected location, access depth, limitations, and verification date. Distinguish metadata, an abstract, selected full-text passages, and a full-article reading. A citation that exists can still be misquoted or irrelevant.

Seek counterexamples to novelty and impossibility claims. Use primary research for empirical assertions and official statements for reporting requirements. Reporting checklists guide disclosure; they do not supply ethics approval, determine the study design, or demonstrate intervention benefit. No reference is promoted from provisional because another AI called it verified.

## 7. Revise and verify the actual manuscript

Read the current full manuscript and open annotations. Preserve the preceding version before making a substantive revision. Replace only intended content, guard against stale versions and partial output, and retain a readable change log. A summary or one-pager is a separate derivative.

Separate verification layers in the report:
- software tests and arithmetic;
- source-to-registry correspondence;
- meaning of clinical/operational events;
- statistical design and interpretation;
- independent academic/clinical review;
- ethics, consent, authorship and release authorization.

State which layers were tested and which were not. A large count of tests is not a quality score. Render and inspect final documents. Verify tables, denominators, references, version labels and package contents. Do not package private source data as part of a public reproducibility supplement.

## 8. Use stage-specific release gates, not a global stop sign

Working drafts, source audits, analysis code and alternative designs can progress while later decisions are pending. Before promoting a particular result, resolve the uncertainty that materially affects that result or retain an explicit limitation and appropriate sensitivity analysis.

Before submission, identify a reproducible analysis release, reconcile the manuscript to it, document unresolved exclusions, confirm the applicable ethics/consent determination, complete authorship and conflict declarations, disclose AI use, and obtain the agreed independent review. Before a hosted write, use the authorized owner workflow and preserve history. Publication, outreach and production changes remain separate actions.

Each handoff records: completed work; evidence changed; failed or unresolved checks; consequences for claims; preserved versions; and the next decision that genuinely needs a person. Do not hand off a new plan while leaving an already-authorized, feasible revision unapplied.

## Reusable claim and audit record

Use one compact row per claim or issue:

`ID | question/claim | evidence source/version | population/unit | transform/query | support or discrepancy | sensitivity | status | reviewer/action`

Suggested statuses: observed; source-matched; semantic review pending; interpretation; hypothesis; simulation; contradicted; release-ready after recorded approvals. Do not automatically promote between statuses. The distinction between source-matched and semantically valid is essential.

## Methodological anchors

These sources inform this procedure; the exact workflow above is a local proposal, not their prescribed standard.

- Benchimol EI et al. RECORD statement. PLoS Medicine. 2015;12:e1001885. https://doi.org/10.1371/journal.pmed.1001885
- Harron KL et al. A guide to evaluating linkage quality for the analysis of linked data. International Journal of Epidemiology. 2017;46:1699-1710. https://doi.org/10.1093/ije/dyx177
- Kahn MG et al. A harmonized data quality assessment terminology and framework for secondary use of electronic health record data. 2016. https://doi.org/10.13063/2327-9214.1244
- ICMJE. Use of AI by Authors. Official guidance accessed 7 September 2026. https://icmje.org/recommendations/browse/artificial-intelligence/ai-use-by-authors.html
