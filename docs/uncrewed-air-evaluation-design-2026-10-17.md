# Evaluating a drone-response pilot in Laos — design note

Written 2026-10-17 for the SOSCOMMAND drone (uncrewed air unit) programme proposed the
same day (`SOSCOMMAND/docs/UNCREWED_AIR_PROGRAM.md`; research record
`SOSCOMMAND/docs/records/UNCREWED_AIR_RECON_2026-10-17.md`). This is a design note and
an owner-decision list, not a protocol, not a registration, not permission for a live
study, and not a change to `research.*`.

**Verdict: the pilot is evaluable, but only if its population is every time-critical
emergency in the catchment — not UXO victims alone — and only if its comparator is
observed, not modelled.** Those two choices answer the criticisms the published
drone-health evaluations attracted, and they are the whole reason this repo should be
the independent evaluation partner rather than a bystander.

Evidence tiers in this note follow `docs/academic-research-standard.md`: every web
item below was a **search-index read on 2026-10-17** (no page could be fetched from the
build container), so each is "provisional" until the full text is read.

---

## 1. Three findings that shape the design

1. **UXO casualties cannot power an outcome study.** National UXO casualty totals in
   recent years are in the tens — 49 in 2024 (9 killed, 40 injured; over 60 % children)
   and 25 in 2025 (6 killed), per UNDP and NRA figures relayed by UNDP press releases and
   the Laotian Times (index reads). Any single catchment sees single digits a year. UXO
   victims are the moral and funding case and must be a **pre-specified, descriptively
   reported subgroup**; the statistical population is all time-critical emergencies in the
   catchment. Road trauma supplies the volume: Lao official 2025 figures of 6,779 crashes,
   over 10,000 injuries and 917 deaths (KPL, index read). The only travel-time datum found
   for UXO casualties is a UNICEF/NRA child-survivor study's average of 2 h 45 min to the
   district hospital (index read); no dataset records the interval to definitive care.
2. **No published drone-health evaluation has shown a patient-survival benefit against an
   observed concurrent comparator.** Rwanda's blood programme measured delivery time
   against *estimated* road times (Nisingizwe et al., Lancet Glob Health 2022) and later
   in-hospital postpartum-haemorrhage deaths in a quasi-experimental design with a
   distance-to-port gradient (Jeon, Song et al. — first a non-peer-reviewed Wharton
   working paper, since published in M&SOM; unrelated figures of 46 %, 56 % and 88 %
   circulate and must not be merged with it — do not cite a number without the paper). Sweden's AED drones were
   dispatched concurrently with ambulances and stopped at time-to-arrival and
   payload-used (Schierbeck et al., Lancet Digit Health 2023: drone first in 67 %, median
   lead 3 min 14 s, AED attached in 6 cases). Ghana's vaccine study was funder-aligned
   and an independent evaluator (IDinsight) found the stockout effect not significant.
   Systematic reviews to 2025 find few experimental studies and almost none from LMICs.
3. **This repo already owns the clock discipline the evaluation needs, and nothing else
   it would need.** Migration 020 gives every milestone a `resolution` of
   `measured | entry | date` and a view that refuses to difference day-resolution
   endpoints. SOSCOMMAND keeps two clocks on a Citizen Report incident — `captured_at`
   (evidence only) and `received_at` (every metric). What is missing: any milestone
   vocabulary for a unit in motion, any Laos vocabulary, and any read path from the
   brain's `arm_*` tables.

## 2. The design — three phases, each a registered protocol, each gated on the last

**Phase 0 — shadow sorties (simulation, labelled as such).** For every real incident the
Lao arm receives, the brain computes what a drone sortie *would* have done from the
nearest proposed base (launch, flight time, arrival); SOSPHD compares it with the
*observed* ground unit's on-scene mark. Output: the distribution of modelled time gain,
the eligible fraction (daylight, weather, payload, landing zone, UXO clearance status),
and the baseline median and variance of the ground clock. Zero patient risk. Under
`docs/research-writing-policy.md` this is published as "simulation" and never described
as observed patient outcomes. **Precondition:** a live Lao ground-response clock, which
does not exist today (the public site states Lao SOS is not yet operating); the
Vientiane Corridor Pilot (SOSCOMMAND `docs/arms/LA/TSOS-LA-015`, January–June 2027) is
what creates it.

**Phase 1 — concurrent-dispatch feasibility (prospective observational cohort; the
Swedish design).** For incidents meeting a closed eligibility rule, the drone launches
*in parallel with* the ground unit the dispatcher sends; nothing about the ground
response changes. Payload: supplies and responder equipment first (tourniquets,
haemostatics, AED, blood if the cold chain is proven) — **not a patient**. Primary
outcome: proportion of eligible incidents where the drone reaches the scene before the
ground unit, and the observed median time difference. Secondary: payload actually used
(the 6-of-55 lesson); abort rate and reasons; safety events; dispatcher agreement with
the engine's sortie recommendation (the existing shadow ledger). Reporting: STROBE plus
DECIDE-AI for the recommendation component, as `docs/paper2-reporting-readiness-2026-08-31.md`
already prescribes for a nonrandomised live evaluation; no SPIRIT/CONSORT adherence
claimed.

**Phase 2 — stepped wedge by district (the service-effect question), only if Phase 1
clears its gates.** Clusters = districts or health-centre catchments; steps = the
randomised order in which drone bases are activated; unit of analysis = incident;
estimand = change in minutes from `received_at` to definitive-care start for
time-critical incidents, adjusted for cluster, calendar period and a pre-specified
terrain covariate — the Malaria Atlas Project friction surface via SOSCOMMAND's Earth
Engine work, with the four limits `docs/earth-engine-assessment.md` already states; its
monsoon-seasonality table becomes the step-scheduling constraint. The policy's own
caution stands: a stepped wedge "is an option, not an automatic ethical or statistical
solution", and the baseline must be *manufactured* by Phases 0–1 before any wedge is
drawn. If patient carriage is not certified by then, Phase 2 evaluates supply and
responder delivery with the same design.

## 3. Outcomes, in a fixed hierarchy

- **Primary (Phase 2):** minutes from `received_at` (server clock) to definitive-care
  start, for time-critical incidents — the TTDC analogue.
- **Primary (Phase 1):** drone-first proportion and the observed time difference against
  the concurrently dispatched ground unit.
- **Secondary:** 30-day vital status; limb outcome category for limb trauma (salvage /
  amputation, level) — coarse, never a narrative; payload-used; abort and safety events;
  cost per sortie as **the licensee's ledger figure, never an estimate**; dispatcher
  accept/override of the recommendation.
- **Descriptive subgroup, pre-specified:** UXO-related incidents — counts and times, no
  inferential claim.
- **Stated in advance:** a time reduction is not evidence of a mortality reduction
  (the prehospital-time literature is mixed and concentrated in neurotrauma and unstable
  penetrating injury); mortality is reported with confidence intervals and no efficacy
  claim is made. **Inapplicable, and said so:** `GUARANTEED_PAYMENT` / TTGP — a public
  emergency response has no payer step.

## 4. Sample-size logic, in words

The time endpoint is continuous and the expected effect is large (Rwanda's gain was
against flat-country road estimates; Laos's is plausibly larger — REASONED, no Lao figure
exists). Power in a stepped wedge is bound by clusters and steps, not patients; a
handful of districts over five to seven periods is the right range. **The computation is
deferred, by policy, until Phases 0–1 yield the baseline median and variance.** A
mortality endpoint is not powerable in a two-year pilot.

## 5. Ethics and consent path

- A Lao national health-research ethics committee (name and current procedure
  **unknown in this session — verify**) plus the owner's university IRB. Phase 0 is
  secondary analysis of de-identified operational data; Phases 1–2 are service-level
  interventions where EMS cluster studies commonly seek a waiver of individual consent —
  the committee's call.
- Clinical consent to be transported, or to receive a delivered payload, is the
  licensee's clinical-governance matter under Lao law and the Ministry of Health, not a
  research consent. SOSPHD records only whether the research-use determination exists.
- Community engagement in UXO-affected villages before Phase 1.
- Fieldwork interviews follow `docs/consent-framework.md` with `consent_jurisdiction =
  'LA'`; the framework's thirty-minute legality check (one-party recording; data
  protection) has **not been done for Laos**.
- Each phase is preregistered before first enrolment; a protocol is not registered until
  registration is verified.

## 6. PHI-free data fields SOSPHD may ever hold

Pseudonymous incident reference (hash of the brain's incident id under a research pepper
— never the reporter device hash); arm code; **district, never coordinates**; eligibility
result; dispatch decision, response tier, unit kinds; `overrode_recommendation`;
timestamps with resolution — received, first human look, decision, en route / on scene /
cleared, sortie launched / arrived / returned / aborted; abort reason code; payload type;
daylight and weather code; disposition from the closed list; facility arrival and
definitive-care start **if a receiving-hospital data agreement exists**; 30-day vital
status likewise; coarse diagnosis bucket; limb outcome category; cost per sortie from the
licensee's ledger. **Never:** reporter text or transcript, keyframes or audio, names, ages
below a band, exact location.

## 7. Mapping onto `research.*` — what fits, what needs owner review

| Object | Fit |
|---|---|
| `research.cases` | A drone-eligible incident is a case with `source = 'prospective'`, `country = 'LA'`, a pseudonymous `patient_ref`, severity, diagnosis bucket, de-identified summary |
| `research.cases.corridor` | Free text; the canonical six are Thai. A Lao catchment label (e.g. the brain's `xk-vte` Xieng Khouang → Vientiane lane) is a **vocabulary decision for the owner** |
| `FIRST_CONTACT` | ← `arm_incidents.received_at`, resolution `measured` |
| `TRIAGE_COMPLETE` | ← first human look (`arm_incident_looks.looked_at`); the AI assessment is not triage complete — a human is (semantic review pending) |
| `TRANSPORT_ACTIVATED` | ← `arm_incident_dispatches.decided_at` where `decision = 'confirm'` |
| `FACILITY_ARRIVAL`, `DEFINITIVE_CARE_START`, `DISCHARGE` | **Not captured by any `arm_*` table** — `arm_incident_outcomes.arrived_at` is the unit's arrival on scene, not the patient's at a facility. A receiving-hospital agreement is the only source |
| `research.recommendations` | The engine's sortie recommendation → dispatcher accept/override with `engine_version`, `confidence_value`, `override_reason` — the Protocol §4 schema; rows frozen once decided |
| `research.case_events.resolution` | Telemetry timestamps are `measured`; a crew tap is closer to `entry`; the view NULLs any interval with a `date` endpoint |
| `research.analysis_snapshots` | Freeze each phase's cohort before any figure is cited |
| `/protocol` | Scope lists `transport`; auto-accept is not permitted. Adding Laos and an airborne mode is a material scope change → **v0.2 bump under §6** |

**Owner decisions (additive, never ad hoc — `AGENTS.md`):**

1. **New milestone types** for a unit in motion — at minimum `UNIT_EN_ROUTE`,
   `UNIT_ON_SCENE`, `UNIT_CLEARED`, and for a sortie `SORTIE_LAUNCHED`, `SORTIE_ON_SCENE`,
   `SORTIE_ABORTED`. `research.event_type` is a Postgres enum; adding values is additive.
   The no-schema alternative (`NOTE` events with a structured payload) is weaker because
   `findEvent` computes metrics over typed events.
2. **A read path.** `docs/prospective-clock-audit.md` already ruled that attaching a
   trigger to another project's live table is not this repo's decision to take alone. The
   compliant shape, as `docs/earth-engine-assessment.md` chose: **SOSCOMMAND materialises a
   de-identified research view; SOSPHD reads it.** Nothing new is built here.
3. **Eligibility vocabulary in `research.funding_opportunities`.** The three categories
   assume the applicant is the owner or Tourist SOS. Most drone/UXO money would be applied
   for by the Lao licensee or an implementing partner, with SOSPHD as evaluation partner —
   a fourth category for owner review.
4. **Thesis scope.** `lib/config.ts` fixes the thesis on *tourist* emergencies. UXO and
   road-crash victims in Lao villages are residents. Either the drone evaluation is a
   **separate, funded protocol that reuses the instrument** (recommended), or the owner
   widens the thesis. Flagged, not resolved.

## 8. The funding file — rows to add as `identified`, unverified

Already in the file and fitting better for rural Laos than for insured tourists in
Bangkok: **Laerdal Foundation** project support (trauma, emergency care and time-critical
conditions are named priorities; applicant eligibility not established; autumn 2026
window passed — target the next); **Horizon Europe Cluster 1** with a Lao legal entity as
funded partner (never lead); **Gates Grand Challenges** (monitor); NIH D&I R21 only as a
Phase 2 play. Do not pitch SBIR/STTR or ARPA-H RSO — a Lao field site makes US-domestic
R&D rules worse.

Missing US channels (names only; eligibility is the programme document's §7 and the
funding lens in the research record): State Department PM/WRA Conventional Weapons
Destruction (victim assistance); the US Medical Fund for UXO Victims run by World
Education (US$553,455 for 2024–2028, covers transport for care within Laos); the Patrick
J. Leahy War Victims Fund (status after USAID's 2025 reorganisation unknown); DoD OHDACA /
INDOPACOM humanitarian assistance (fit unverified); US Embassy Vientiane small grants
(current call unknown); NIH Fogarty; USTDA and DFC (finance for the licensee, not
research — and a probable conflict with Chinese-sourced airframes); Anthropic's AI for
Science programme (API credits for academic/nonprofit research; the university, not
Tourist SOS, is the eligible party); AI-for-good foundations (fit unverified). Advocacy
routes, not funders: Legacies of War and War Legacies Project. Non-US: UNDP Lao PDR's UXO
programme, UNICEF Venture Fund, Grand Challenges Canada, Elrha HIF, Temasek Foundation's
Lao health programme, Japan MOFA grant aid, ADB, World Bank.

**The structural fact:** Tourist SOS never participates in a licensee's procurement,
permits or government relations, so victim-assistance and mine-action money is applied
for by the Lao licensee or an implementing NGO; research money by the researcher or
university. SOSPHD's role in every proposal is **independent evaluation partner** — which
is also what the Ghana/Rwanda critique says reviewers look for.

## 9. What this repo owns, and what it must not touch

**Owns:** the three-phase protocol as a versioned, citable document (the `/protocol`
pattern); the analysis plan; the claim-level literature table (the research record's
table is its seed, every row at "search-index read; full-text verification pending");
the `research.*` mapping and the owner-review requests above; funding rows; the Laos
ethics and consent file; reads of a de-identified export.

**Must not touch:** the airborne unit kind (`config/arms/LA.json`), the dispatch gate
(D4; transport medical clearance human-only), the sortie engine and its typed contract,
the clock tables and the research view — all SOSCOMMAND's. SOSREPORT and LAOSOS change
nothing for this evaluation.

## 10. Open questions for the owner

1. Payload first, or patient first? Everything above assumes supply/responder delivery
   in Phase 1 and patient carriage only in a certified later phase.
2. Which districts, and what is the baseline incident volume there? Power cannot be stated
   without it.
3. Does the owner want Laos in the PhD, or as a separate funded evaluation reusing the
   instrument?
4. Will the Lao ground units accept concurrent dispatch for the Phase 1 comparator?
   Without an observed comparator the pilot repeats Rwanda's weakest design choice.
5. Which Lao ethics committee, and who is PI?
6. May the owner approve the new milestone types and the fourth funding category?

## 11. Verification layers (per `docs/academic-research-standard.md`)

Software/arithmetic: none run; no code changed. Source-to-repo correspondence: every repo
citation above was read in the research pass at the quoted lines. Web claims:
search-index reads only; none promoted beyond "provisional". Event meaning: the §7
mappings are the pass's readings — semantic review pending. Statistical design: proposed,
not powered. Ethics, authorship, release: nothing determined; nothing authorised.
