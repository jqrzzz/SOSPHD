# Admissions blindspots — 2026-08-16

What the top schools require, what nobody has established, and why the app now
measures the second thing rather than only the first.

## The problem the module was hiding

`research.institution_requirements` records what research turned up. The
readiness percentage scored progress against that. Those two facts combine
badly: a school with three recorded requirements, all done, reads **100%
ready** while a dozen real requirements remain undiscovered.

Measured against a canonical set of what any research degree needs, the top
five sat at **0–33% coverage**. LSHTM — the earliest deadline on the shortlist
— was at zero.

Nothing at all was recorded anywhere for: research proposal, referees, CV,
personal statement, degree certificates, application fees, funding
applications, ethics pathway, data governance, or whether the programme can be
done without abandoning the operation.

## Three things the taxonomy adds that no school will tell you

Most of the canonical set is ordinary admissions bureaucracy. Three items are
specific to this candidate and this thesis, and none of them appeared anywhere
in the repo or the database before this pass:

**`format_compatibility` — can this be done without abandoning the operation?**
Paper 1's conclusion is that coordination timing must be captured prospectively
by an instrumented operational system. The research therefore depends on
continued access to a running operation. A full-time residential programme
abroad does not inconvenience that, it removes the data source. Six of eight
live programmes are recorded as full-time only. JHU is explicit: full-time,
residency in Baltimore, part-time by rare exception. This is a precondition for
applying, not a preference, and it was being treated as neither.

**`data_governance` — researching data your own company holds.** The registry
behind these papers belongs to a company the candidate owns and operates. Every
institution will want a position on that: a data-access or data-sharing
agreement, a declared conflict of interest, IP ownership, and whether one person
can be both the operator generating the data and the researcher analysing it.
Schools differ substantially and the answer shapes what can be published.
Nothing on file for any school.

**`ethics_pathway`.** Paper 1 carries an open `[ACTION: confirm IRB/ethics
pathway]` that cannot be closed without an institution. Two distinct approvals
are needed and schools route them differently: retrospective analysis of
de-identified operational records, and prospective collection from live
emergencies. The second is harder and determines what Papers 2 and 3 can
attempt. It belongs in the school choice, not after arrival.

## Portfolio versus per-school — the reframe

The per-school view is honest and exhausting. It shows the same CV, the same
transcripts and the same English test as separate unknowns at every school, so
eight applications read as sixty-odd problems.

Each canonical item now carries `scope`. Portfolio items are one piece of work
that serves every school; per-school items genuinely repeat. `portfolioRollup`
collapses the former across the whole shortlist and measures lateness against
the **soonest deadline the item would miss**, not against any one school's.

The current picture is ten shared actions, four of them already past their lead
time against LSHTM's 1 October deadline:

| Action | Unblocks | Needs | Days to soonest deadline |
|---|---:|---:|---:|
| GRE | 8 | 90d | **46** |
| English test | 8 | 75d | **46** |
| Credential evaluation | 8 | 75d | **46** |
| Referees | 8 | 60d | **46** |
| Transcripts | 8 | 45d | 46 |
| Research proposal | 8 | 45d | 46 |
| Degree certificates | 8 | 30d | 46 |
| Academic CV | 8 | 21d | 46 |
| Publications / writing sample | 8 | 21d | 46 |
| Passport | 8 | 14d | 46 |

A school that records an item as optional (`mandatory: false`) drops out of that
item's count — being told the GRE is optional is a positive finding, not an
absence. An item that is merely *unknown* keeps blocking, because not knowing
whether a school requires something is not the same as being told it does not.

## What was researched, and the limit on it

Twenty-four requirements were added across the top five. Coverage moved from
0–33% to 28–50%.

**Every institutional domain is blocked by this environment's egress proxy.**
Not one official page could be read. All new rows are therefore `verified_at =
NULL`, say `UNCONFIRMED (search index)` in their detail, and carry the URL that
must be opened. Recorded-but-unconfirmed is a real step up from unknown; it is
not the same as verified, and the UI shows the difference.

### Conflicts found, recorded rather than resolved

- **JHU GRE.** On file as optional; a departmental source says standardized
  tests are required. Deadline 1 Dec, GRE lead time ~90 days. If required and
  unbooked, that school is out for the cycle.
- **NUS deadline.** 1 Nov on file; a general NUS source says 15 Nov. The earlier
  is treated as operative until the Aug-2027 instructions are read.
- **NUS format.** Recorded as full-time only; a general NUS source says
  candidates may be admitted full-time *or* part-time, with an 18-month minimum
  residency. This cuts in the favourable direction — if it holds for Public
  Health, NUS moves from structurally incompatible to workable. The source is a
  different faculty's page, so it is a conflict to resolve, not a correction to
  apply.

### Other findings

- **NTU does not accept TOEFL** — IELTS 7.0 with 6.5+ sub-scores, unlike every
  other school on the shortlist. Booking the wrong test would waste weeks.
- **NTU's Jan-2027 window has already closed** (1 Jun – 31 Jul 2026). August
  2027 is the live target and its window is unestablished, which is why the
  school carries no deadline.
- **Duke-NUS requires three references, at least one academic** — more than the
  two-referee norm, and the academic one is the binding constraint for a
  candidate whose recent years are operational.
- **Duke-NUS funding appears automatic on admission** (100% tuition plus stipend
  for four years). If it holds, it is the only school on the shortlist with no
  separate funding race.
- **LSHTM scholarships are separate applications**, several closing before the
  1 October programme deadline, some requiring an offer already in hand.

## Two data corrections

**`funding_model` cleared on all nine institutions.** Every row read
`self_funded`. It is rendered nowhere, was never sourced, and is contradicted
for Duke-NUS. An unsourced value in a field that cannot carry provenance is
worse than no value; funding facts now live in `institution_requirements`,
which carries `source_url` and `verified_at`.

**`bandAttention` dropped every undated non-blocker** from all four bands, so
undated tasks and schools with no deadline on file vanished from the attention
panel silently — exactly the items least safe to lose. They now have their own
band, because being unassessable is worse than being distant, not better.

## The no-GRE pass (2026-08-16, later the same day)

The owner ruled out sitting the GRE. That turns out to steer the shortlist
somewhere better rather than merely smaller, because **the GRE is essentially a
US instrument** — UK, Singapore, Hong Kong, mainland China and Japanese research
degrees do not use it.

`greStance()` reads the position from every matching row and resolves
contradictions toward `required`. JHU is why: one row records "GRE optional",
another records a departmental page saying tests are required. Resolving that
toward *not* required would hide an eligibility bar until the deadline had
passed. The stance is shown as a chip on every row in `/apply`, so it never has
to be rediscovered inside a school's page.

### Parked

| School | Reason |
|---|---|
| Harvard, Population Health Sciences | GRE required, stated with no exceptions |
| Stanford, Health Policy | GRE required for the 2026-27 cycle |
| Stanford, MS&E | Parked alongside; always the most tangential fit — coordination and operations modelling, but not a health-systems department |

Withdrawn rather than deleted, with the reasoning appended to `fit_rationale`.
The decision is reversible if the GRE is ever sat for another reason.

### Added — five, all GRE-free

**Mahidol University** (Bangkok) — fit 5, and its absence was the shortlist's
single largest blindspot. The research is about Thailand, the data is in
Thailand, the operation is in Thailand, and no Thai institution was under
consideration. It dissolves `format_compatibility` rather than negotiating
around it: no relocation, so the operation keeps running and the prospective
data Papers 2 and 3 need keeps flowing. It also puts the ethics pathway under
Thai PDPA in the same jurisdiction as the data, instead of asking a foreign IRB
to rule on Thai patient records.

**Nagasaki University TMGH — NU-LSHTM Joint PhD** (Japan) — fit 5. A joint
degree awarded with LSHTM, already on the shortlist at fit 4, so it is a second
route into the same relationship with a tropical-medicine department attached.
Applicants may bring their own project rather than take one from the published
list, which is the whole reason it fits an already-designed thesis. Confirmed
interview stage. The Autumn 2026 round is at best imminent and probably gone.

**University of Hong Kong, School of Public Health** — fit 4, and the best
answer found so far to the format problem. HKU runs the PhD full-time *and*
part-time, and part-time students — described as people who may hold a
full-time job — can be granted approval to be away from Hong Kong for up to six
months in an academic year. Three hours from Bangkok. The catch is recorded:
part-time places are "very limited", and the Hong Kong PhD Fellowship Scheme
requires full-time admission, so **the flexible route and the funded route are
mutually exclusive** — a decision that has to be made before applying.

**University of Tokyo, Global Health Policy** — fit 4. Health policy rather
than clinical tropical medicine, which suits the coordination-and-systems
framing better. English throughout including the thesis; TOEFL/IELTS the only
test named. Two entry points a year off one early-January deadline, so missing
a cycle costs six months rather than twelve.

**Tsinghua Vanke School of Public Health** (Beijing) — fit 3, the
weakest-evidenced of the batch and recorded as such. The sweep surfaced its
International MPH, not an English-taught PhD; Tsinghua lists nine English
doctoral programmes, mostly engineering and natural sciences, and whether public
health is among them is unestablished. One hard bar found nowhere else on the
shortlist: applicants must not be over 45 at enrolment.

All five carry `next_deadline = NULL`. No cycle date could be established for
any of them, and inventing one is worse than letting them sit in the attention
panel's "no date on file" band — which is what that band was added for.

## Where the remaining risk sits

The five new schools are at low coverage by construction — they were added
today. More importantly, **none of them has a cycle date**, so five of ten live
programmes cannot currently be planned against at all. Establishing those
windows is worth more than any individual requirement, because a lead time
measured against nothing is not a lead time.

Tsinghua carries a prior question the others do not: whether an English-taught
public health doctorate exists there at all. Until that resolves, nothing else
about it is worth researching.

Across all twenty-two prospective supervisors and funder contacts, **zero have a
confirmed email address**. Every institutional domain was blocked, so addresses
were never guessed. NUS and NTU both require an agreed supervisor before
applying, and NUS's 1 November deadline is inside the 120-day lead time that
question needs — which the attention panel now says out loud.
