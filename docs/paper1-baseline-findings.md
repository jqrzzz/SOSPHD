# Paper 1 — Baseline Findings Memo (v0.1)

**Date**: 2026-08-14 · **Dataset**: `research.cases` where
`source='backfill_2018_2023'` — ingest batches
`c201c6c2-3f5d-41db-8f06-40bfdef82b82` (665) + `b3264682-d691-4cec-9d0f-ece4fb62a3cd` (171).
Every number below was queried from the live database on the date above; freeze
an analysis snapshot (dashboard → "Freeze current dataset") before citing any of
them in a submitted draft.

This is a findings *memo*, not a results section: it states what the baseline
registry shows, what it cannot show, and what that implies for the paper.

## 1. Sample

**836 de-identified cases**, December 2018 – March 2020, from the Tourist SOS
operational registry (2 clinic-stream sources reconciled; 99.2% of the
operator-claimed 843 recovered; `docs/backfill-plan.md` documents the
provenance chain and both batch IDs). One case lacks a service date. All cases
terminal (`status='closed'`).

- **Years**: 2018: 62 · 2019: ~499 · 2020: ~276 (COVID stop: registry ends
  2020-03, matching Thailand's border closure)
- **Country of incident**: Thailand ~95%, Indonesia (Lombok/Gili) ~5%
- **Corridors** (derived from recorded province/branch keywords):
  Krabi → Bangkok 666 · Chiang Mai → Bangkok 11 · Koh Samui → Bangkok 4 ·
  unassigned/Indonesia 155. The baseline is effectively a **single-corridor
  sample** — generalization claims must be scoped accordingly.

## 2. Seasonality

Monthly volume shows the high-season signature: Nov 2019 (107), Jan 2020 (121),
Feb 2020 (93) vs. Jun 2019 (14). **Registry gaps**: July 2019 has zero rows and
Feb 2019 only 13 — these are recording gaps, not demand troughs, and must be
reported as missingness, not seasonality.

## 3. Who the patients are

Top nationalities: UK 119, Germany 64, US 51, Russia 44, Canada 41, Poland 33,
Spain 32, Sweden 30, Finland 28, France 26 — a long tail across 67 countries.
Tourist-origin diversity is itself a coordination-friction finding (language,
payer jurisdiction, insurer variety).

## 4. What happens to them

Diagnosis mix (keyword-bucketed; rules in `lib/data/backfill/normalize.ts`):
gastro 231 (27.6%) · trauma 179 (21.4%) · **animal_bite 109 (13.0%** — almost
entirely monkey bites, a Phi Phi–specific occupational-tourism hazard worth a
standalone paragraph) · other 98 · infectious 64 · marine 42 · ent 23 ·
respiratory 17 · derm 12 · neuro 5 · cardiac 2 · unclassified 54.

*Correction 2026-08-14*: an initial bucketing pass substring-matched short
keywords ("cut" ⊂ "acute"), inflating trauma by 45 cases; the matcher now
requires word boundaries for short tokens and the 45 rows were re-bucketed in
place (regression-tested in `lib/data/backfill/__tests__/transform.test.ts`).

**Evacuations: 49 (5.9%)**, led by trauma and gastro-with-dehydration. These 49 are the TTTA-relevant subpopulation — and the registry recorded
**no transport timestamps** for 40 of them.

Care level was recorded for only 106/836 (Out-patient 48, In-patient 39, Hotel
Call 16) — too sparse for analysis; report as a data-capture gap.

## 5. Who pays

311 distinct payer entities after normalization (from 387+ raw strings).
**Self-pay is the single largest category: 233 cases (27.9%)** — payment
friction begins with no payer at all. Largest insurers: Allianz 32, AXA 30,
ERGO 10, AIG 9, Assist Card 8. The extreme payer fragmentation (no insurer
above 4%) is the structural argument for a coordination layer: no single payer
relationship can cover the caseload.

## 6. The central finding: the timestamps do not exist

Milestone coverage across 836 cases:

| Milestone | Present | Coverage |
|---|---|---|
| FIRST_CONTACT | 835 | 99.9% |
| TRANSPORT_ACTIVATED\* | 9 | 1.1% |
| TRIAGE_COMPLETE / FACILITY_ARRIVAL / GUARANTEED_PAYMENT / DEFINITIVE_CARE_START / DISCHARGE | 0 | 0% |

\* **These are not activation times.** Provenance audit 2026-08-16, now Paper 1
§6.2. All nine sit at exactly 00:00 Asia/Bangkok, and the interval
`FIRST_CONTACT → TRANSPORT_ACTIVATED` takes exactly two values across all nine
cases — 0 h (seven cases) and exactly 24 h (two cases), with no third value. A
measured duration cannot have that distribution; a pair of differenced calendar
dates must. Their provenance annotation names the case's own registry file
number rather than any separate transport document, and its wording appears
nowhere in the ingest code — so they were written by a one-off statement during
the backfill batch, not by `historicalCaseToRows`. Strictly counted, milestone
coverage other than first contact is **zero**. The earlier reading — a fragment
of real instrumentation, proving the field "can be populated when someone
chooses to" — is withdrawn. Both assertions are encoded in
`scripts/verify-paper-figures.mjs` under §6.2 — PROVENANCE.

**Zero cases support TTTA, TTGP, or TTDC computation end-to-end.** Sixteen
months of professionally-operated registry data (2 Dec 2018 – 24 Mar 2020), and
not one case can answer "how long did coordination take" — because operational
record-keeping captures *what* happened, not *when* the coordination milestones
occurred. This is Paper 1's
core motivating result: the metrics the field needs cannot be recovered
retrospectively; they must be captured prospectively by an instrumented system
(which is what SOSPHD's event spine + SOSCOMMAND triggers do). Frame the
baseline as establishing epidemiology + payer structure + the missingness
result, with metric distributions arriving from prospective data.

## 7. Measurement notes a reviewer will ask about

- Source timestamps are **date-only**; stored as 00:00 Asia/Bangkok (+07:00).
  No intra-day analysis is possible on baseline data.
- Corridor is **derived** from province/branch keywords, not operator-assigned
  (`lib/data/backfill/corridor.ts` holds the rules); 155 cases unassignable.
- Diagnosis buckets are keyword rules over clinical free text; 54 unclassified,
  132 of the batch-2 rows had free text, the rest sparse.
- 16 duplicate file numbers were disambiguated (`#N` suffixes = repeat visits);
  164 cases had no file number and carry synthetic `NR-r<row>` refs; 2 probable
  repeat-visit rows in an older registry copy were deliberately excluded.
- Projection rules for status/severity: `docs/measurement-projection.md`.

## 8. What would make this submission-ready

1. Freeze `paper1-baseline-v1` snapshot (owner action — one click, then cite
   its label + created_at).
2. Decide the seasonality-gap treatment (report July 2019/Feb 2019 as missing
   months vs. exclude from monthly figures).
3. A per-corridor prospective target: the stepped wedge needs ≥1 additional
   corridor producing prospective cases before Paper 3 design locks.
4. Ethics statement: retrospective de-identified registry analysis — confirm
   which IRB pathway covers it before submission.
