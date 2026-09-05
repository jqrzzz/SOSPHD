# Paper 2 reporting-standard readiness — 2026-08-31

Source-backed resolution of the formal reporting citations currently marked
`[REF:]` in:

> **Paper 2 — Human–AI Coordination: Does Decision Support Reduce Delay?**

No manuscript or hosted row was changed.

The quoted live title asks a causal efficacy question that the current
nonrandomized feasibility design cannot answer. Use the provisional working title
**Paper 2 — Prospective Measurement and Human–AI Coordination Feasibility** until
a defensible causal design exists. Impact evaluation remains Paper 3's role.

## Current evidence boundary

The live research database currently contains:

- 0 prospective research cases;
- 0 recommendations;
- 0 accepted or overridden decisions;
- 0 computable TTTA, TTGP, or TTDC intervals.

Paper 2 can proceed as a protocol and preregistration package. It cannot proceed
as a results paper, and operator acceptance cannot be presented as calibrated
recommendation correctness.

## Applicability decision

The current working design in the live draft is a nonrandomized observational
evaluation of live human–AI coordination. It is not yet frozen. On that working
design:

- the paper should estimate measurement fidelity, workflow feasibility, operator
  behavior, and safety signals—not whether decision support reduces delay;
- **STROBE** is the core observational reporting framework.
- **DECIDE-AI** is additionally relevant if the system is evaluated during live,
  early-stage use and the supported decisions can affect patient care.
- **SPIRIT 2025** can be consulted as a protocol-completeness aid, but formal
  SPIRIT adherence should not be claimed unless Paper 2 becomes a randomized
  trial protocol.
- **SPIRIT-AI** is an extension for clinical-trial protocols involving AI. It is
  not independently applicable to the current nonrandomized protocol.
- **CONSORT-AI** is for reporting trial results. It does not govern the current
  protocol or observational evaluation.

## Exact references

### STROBE

von Elm E, Altman DG, Egger M, Pocock SJ, Gøtzsche PC, Vandenbroucke JP;
STROBE Initiative. The Strengthening the Reporting of Observational Studies in
Epidemiology (STROBE) Statement: guidelines for reporting observational studies.
*PLoS Medicine.* 2007;4(10):e296.
[DOI](https://doi.org/10.1371/journal.pmed.0040296),
[official STROBE publications](https://www.strobe-statement.org/strobe-publications/).

The official STROBE site still identifies the original simultaneous 2007/2008
publications and current cohort/case-control/cross-sectional checklists. No newer
core STROBE statement is listed.

### SPIRIT 2025

Chan A-W, Boutron I, Hopewell S, Moher D, Schulz KF, Collins GS, et al.
SPIRIT 2025 statement: updated guideline for protocols of randomised trials.
*BMJ.* 2025;389:e081477.
[DOI](https://doi.org/10.1136/bmj-2024-081477),
[official publication record](https://www.consort-spirit.org/published-statements).

SPIRIT 2025 supersedes the 2013 core statement. It specifies minimum reporting
content for randomized-trial protocols; it does not prescribe study design or
establish methodological quality.

Optional explanation and elaboration:

Hróbjartsson A, Boutron I, Hopewell S, Moher D, Schulz KF, Collins GS, et al.
SPIRIT 2025 explanation and elaboration: updated guideline for protocols of
randomised trials. *BMJ.* 2025;389:e081660.
[DOI](https://doi.org/10.1136/bmj-2024-081660).

### DECIDE-AI

Vasey B, Nagendran M, Campbell B, Clifton DA, Collins GS, Denaxas S, et al.;
DECIDE-AI Expert Group. Reporting guideline for the early-stage clinical
evaluation of decision support systems driven by artificial intelligence:
DECIDE-AI. *Nature Medicine.* 2022;28:924–933.
[DOI](https://doi.org/10.1038/s41591-022-01772-9),
[publisher](https://www.nature.com/articles/s41591-022-01772-9).

DECIDE-AI is design-agnostic but applies to early, small-scale, live clinical
evaluation of AI decision support where supported decisions have an actual
effect on patient care. It adds workflow, human-factors, safety, and error-
analysis reporting. It is not for a purely retrospective or offline model study.

### SPIRIT-AI

Cruz Rivera S, Liu X, Chan A-W, Denniston AK, Calvert MJ, et al. Guidelines for
clinical trial protocols for interventions involving artificial intelligence:
the SPIRIT-AI extension. *Nature Medicine.* 2020;26(9):1351–1363.
[DOI](https://doi.org/10.1038/s41591-020-1037-7),
[publisher](https://www.nature.com/articles/s41591-020-1037-7).

If Paper 2 becomes randomized, use SPIRIT-AI alongside SPIRIT 2025 rather than
instead of it.

### CONSORT-AI

Liu X, Cruz Rivera S, Moher D, Calvert MJ, Denniston AK; SPIRIT-AI and
CONSORT-AI Working Group. Reporting guidelines for clinical trial reports for
interventions involving artificial intelligence: the CONSORT-AI extension.
*Nature Medicine.* 2020;26(9):1364–1374.
[DOI](https://doi.org/10.1038/s41591-020-1034-x).

CONSORT-AI adds AI-specific items to reports of clinical-trial results. It
should not be claimed for the current nonrandomized protocol.

The current core trial-results statement, if future random allocation is added,
is:

Hopewell S, Chan A-W, Collins GS, Hróbjartsson A, Moher D, Schulz KF, et al.
CONSORT 2025 statement: updated guideline for reporting randomised trials.
*BMJ.* 2025;388:e081123.
[DOI](https://doi.org/10.1136/bmj-2024-081123).

## Recommended replacement wording

Replace the current sentence that claims STROBE with SPIRIT protocol extensions
with:

> Reporting of the observational evaluation will be structured using the STROBE
> statement. If the AI-assisted recommendations are evaluated during live use
> and can influence patient care, reporting will additionally address the
> AI-specific items in DECIDE-AI, including the intervention's intended use,
> human–AI interaction, workflow integration, safety, and error analysis. These
> are reporting frameworks and do not determine the study design or establish
> intervention efficacy. Because the present design does not allocate
> participants or cases at random, formal adherence to SPIRIT, SPIRIT-AI,
> CONSORT, or CONSORT-AI is not claimed.

For the protocol-methods note, add:

> SPIRIT 2025 and SPIRIT-AI were consulted only as supplementary protocol-
> completeness aids for applicable items. Both formally address clinical-trial
> protocols, whereas the present Paper 2 evaluation is nonrandomized.

If random allocation is introduced before enrolment, replace that wording with:

> The protocol will be reported using SPIRIT 2025 together with the existing
> SPIRIT-AI extension; trial results will be reported using CONSORT 2025 together
> with the existing CONSORT-AI extension. DECIDE-AI will additionally guide
> reporting if this is an early-stage live clinical evaluation of human–AI
> decision support.

## Revision gate

- [ ] choose and freeze the actual study design before changing the manuscript;
- [ ] replace the formal STROBE and SPIRIT `[REF:]` markers with the citations
      above;
- [ ] remove any claim of formal trial-guideline adherence while the design is
      nonrandomized;
- [ ] add DECIDE-AI only if the live-use applicability test is satisfied;
- [ ] create a new authenticated `doc_versions` row for the revision;
- [ ] preregister before the first prospective enrolment;
- [ ] leave results empty until the prespecified data threshold or cutoff.

## Readiness verdict

**THE REPORTING CITATION GAP IS RESOLVED.** The manuscript still needs a human
design decision and ethics/preregistration approval, but no further search is
needed for the core reporting statements.
