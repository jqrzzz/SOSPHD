# SOSPHD Outcome Portfolio — current execution index

**As of:** 2026-09-05 (31 August tranche, refreshed 5 September)

This is the single entry point for the current paper, admissions, funding, and
database-readiness work. It links to evidence rather than duplicating it.

## Priority order

1. Paper 1 submission preparation.
2. NUS supervisor/project fit and Mahidol language/programme gate.
3. Laerdal applicant-eligibility clarification and concept preparation.
4. Paper 2 protocol/preregistration preparation.
5. Hosted containment migration only after separate approval.

No new UI, schema, editor, citation manager, workflow engine, or autonomous
outreach is part of this tranche.

## Paper 1

- [Submission-readiness and citation-correction packet](paper1-submission-readiness-2026-08-31.md)
- [STROBE + RECORD evidence checklist](paper1-strobe-record-checklist-2026-08-31.md)
- [Official journal shortlist](paper1-journal-shortlist-2026-08-31.md)
- [Baseline findings memo](paper1-baseline-findings.md)
- [Measurement projection](measurement-projection.md)

Machine work completed:

- live manuscript marker census;
- primary-source audit of the load-bearing provisional citations;
- exact correction wording and replacement citations;
- full STROBE/RECORD evidence-to-action mapping;
- seasonality-gap recommendation;
- official-publisher journal comparison.

Human gates remaining:

- create `paper1-baseline-v1` through the authenticated app;
- confirm ethics/IRB and Thai PDPA wording;
- select the journal and approve the revised manuscript;
- obtain academic review and submit.

## Paper 2

- [Reporting-standard readiness](paper2-reporting-readiness-2026-08-31.md)
- [Prospective clock audit](prospective-clock-audit.md)

Machine work completed:

- verified the STROBE and SPIRIT sources and drafted replacement citations and
  wording;
- identified SPIRIT 2025 as the current trial-protocol core;
- scoped DECIDE-AI, SPIRIT-AI, and CONSORT-AI correctly;
- drafted replacement wording that does not claim trial-guideline adherence for
  a nonrandomized design.

Human gates remaining:

- freeze the study design and estimands;
- approve ethics and preregistration;
- begin prospective enrolment only after approval;
- write no results until prospective data exist.

## Admissions and funding

- [Official programme and funding verification](admissions-funding-verification-2026-08-31.md)
- [Review-ready outreach and concept drafts](outreach-drafts-2026-08-31.md)

The row-level correction packet remains in private working state and is excluded
from this public branch.

Current decisions:

- Mahidol Public Health Administration: conditional on Thai-language feasibility;
- NUS Saw Swee Hock: active English-language backup, supervisor first;
- HKU: parked on residence incompatibility;
- Laerdal: prepare, but clarify applicant eligibility first;
- Fulbright Thailand: blocked on owner travel/residency evidence;
- NUS Research Scholarship: part of the NUS application, not a separate grant;
- RSTMH: monitor only while paused.

No message has been sent and no application has been submitted.

## Shared database

- [Merged containment PR #26](https://github.com/jqrzzz/SOSPHD/pull/26)

A read-only live preflight was completed and retained outside the public
repository. Applying the containment migration remains a separate hosted-write
decision.

## Next execution gates

There is no ungated admissions, funding, outreach, or hosted-database action left
in this tranche. The next high-value sequence is:

1. Owner selects the Paper 1 target journal and approves the correction packet.
2. Machine work converts the completed STROBE/RECORD evidence mapping into the
   journal forms and revises the manuscript through the authenticated
   version-preserving workflow.
3. Owner decides whether Singapore residence is feasible before any further NUS
   tailoring.
4. Laerdal concept work resumes only after the Foundation answers the applicant-
   eligibility question.

Current owner decision: choose whether Paper 1 should be prepared first for BMC
Health Services Research, the recommended venue, subject to ethics and fee review.

## Explicitly deferred

- Case-to-Claim Observatory tranches beyond completed containment/harness work;
- Paper 3 execution before ethics, volumes, and Paper 2 variance estimates;
- general UI consolidation until two weeks of real workflow use identifies
  repeated friction;
- automated email, submissions, calendar integrations, or unsupervised writing.
