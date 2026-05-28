# SOSPHD — Measurement Projection (Paper 1 methods source)

> The functions in `lib/data/store.ts` (`mapStatus`, `mapPriority`) and `lib/data/metrics.ts` (`findEvent`, `computeInterval`) ARE the measurement methodology Paper 1 cites. This doc is the canonical reviewer-defensible writeup of those rules — Paper 1's methods section can be drafted from here verbatim.

**Status**: v0.1, effective 2026-05-19. Source of truth for Paper 1's "Measurement framework" methods.

---

## 1. What "measurement projection" means

SOSPHD's research metrics are computed from `research.case_events`, but every event in that table ultimately derives from an operational write in `public.cases`, `public.case_episodes`, `public.guarantees_of_payment`, or operator-entered milestones. The path from operational reality → research metric involves three documented projections:

1. **Status projection** (`mapStatus`) — 19 operational statuses → 3 research states (open / active / closed)
2. **Severity projection** (`mapPriority`) — 4 operational priorities → 4 research severities (1-4)
3. **Event-of-type selection** (`findEvent`) — when multiple events of the same type exist, the earliest by `occurred_at` is used

Each projection is lossy by design and reviewer-defensible only when documented.

---

## 2. Status projection: `mapStatus`

| Operational status (`public.cases.status`) | Research state | Rationale |
|---|---|---|
| `intake` | open | Case logged, no operational work started |
| `pending` | open | Awaiting next step |
| `pending_info` | open | Awaiting information before triage |
| `pending_authorization` | open | Awaiting payer authorization |
| `pending_external` | open | Awaiting external party action |
| `needs_review` | open | Queued for operator review |
| `verified` | open | Verified, awaiting next action |
| `rejected` | open | Initial rejection; case still requires coordination |
| `active` | active | Generic active state |
| `in_progress` | active | Work actively in progress |
| `in_treatment` | active | Patient in clinical care |
| `transport_arranged` | active | Transport scheduled / patient in transit |
| `triage` | active | Triage assessment in progress |
| `discharged` | closed | Terminal: patient discharged |
| `resolved` | closed | Terminal: case operationally resolved |
| `billing` | closed | Post-care: in billing |
| `claims` | closed | Post-care: in claims processing |
| `closed` | closed | Explicit terminal |
| `cancelled` | closed | Terminal: case withdrawn |

Unknown future enum values default to `"open"` with a `[SOSPHD:UNKNOWN_STATUS]` console warning so drift is detectable in production logs.

**Methods-section paraphrase**: "Operational case status was projected to a three-state research model (open / active / closed). Statuses representing intake or queue states were mapped to *open* (n=8 source values); statuses representing active work to *active* (n=5); and terminal or post-care states to *closed* (n=6). The full mapping table is given in Supplementary Material S1."

---

## 3. Severity projection: `mapPriority`

| Operational priority (`public.cases.priority`) | Research severity | Label |
|---|---|---|
| `low` | 1 | Low |
| `normal` | 2 | Normal |
| `high` | 3 | High |
| `critical` | 4 | Critical |

The TypeScript `Severity` type is `1 | 2 | 3 | 4` to match the operational enum's cardinality exactly. No synthetic level 5 — the operational `priority` enum does not provide that distinction. If the `acuity_level` text column on `public.cases` ever becomes a structured source of finer-grained severity, this projection can be widened to use it.

Unknown values default to 2 (normal) with a `[SOSPHD:UNKNOWN_PRIORITY]` warning.

**Methods-section paraphrase**: "Severity was projected from the operational case `priority` enum (low/normal/high/critical) to a four-point clinical severity scale (1–4). The mapping is monotonic: low → 1, normal → 2, high → 3, critical → 4. The scale does not include a fifth level because the source enum does not provide one."

---

## 4. Event-of-type selection: `findEvent`

For TTTA (Time to Transport Activation), TTGP (Time to Guaranteed Payment), and TTDC (Time to Definitive Care), the computation is:

```
metric = to.occurred_at − from.occurred_at
```

where `from` is the FIRST_CONTACT event and `to` is the event of the target type. When multiple events of the same type exist for a case, the earliest is used (events array is sorted by `occurred_at` ascending in upstream queries).

**Multi-leg journey assumption**: a case that transits through two facilities — for example, a tourist evacuated from a remote clinic to a tertiary hospital — has two `FACILITY_ARRIVAL` events. The metric uses the first. This is reinforced by the DB trigger dedup at `(case_id, event_type)` in `supabase/migrations/20260402_003_auto_sync_triggers.sql`, which only emits one event per type per case in the first place.

**Methods-section paraphrase**: "When multiple events of a given type were recorded for a case, the earliest by `occurred_at` was used for metric computation. For example, a case with two `FACILITY_ARRIVAL` events (initial clinic and subsequent tertiary facility) contributed only the first to its TTDC calculation. This assumption is enforced both at the database trigger level (deduplication on `(case_id, event_type)`) and at the application level (linear scan returning the first match in chronologically-sorted event arrays)."

---

## 5. Running-clock handling

A case where `FIRST_CONTACT` exists but the target milestone has not yet occurred is classified as "running":

```ts
if (!to) {
  return { value_ms: Date.now() - from.occurred_at, is_running: true };
}
```

Running cases are **excluded from average and median statistics** in `lib/data/analytics.ts` (`if (value_ms !== null && !is_running)`). They appear on per-case detail pages with a "currently elapsed" indicator but never contribute to aggregate distributions.

**Edge case**: a case that closes without reaching the target milestone (e.g., patient declined transport, walked out, was discharged before payment was guaranteed) has `is_running: true` indefinitely. These cases are silently excluded from the metric's denominator. The "missingness rate" disclosure in Paper 1 must report this exclusion explicitly.

**Methods-section paraphrase**: "Cases that did not reach the target milestone within the observation window were classified as right-censored and excluded from mean/median calculations. The proportion of right-censored cases per metric is reported separately as the missingness rate; this provides a transparent denominator for each statistic."

---

## 6. Event taxonomy (the seven milestones)

The seven event types Paper 1 measures over, defined in `lib/data/types.ts:EVENT_TYPES`:

| Event | Source (operational) | Trigger |
|---|---|---|
| `FIRST_CONTACT` | `public.cases.intake_date` | DB trigger on case INSERT |
| `TRIAGE_COMPLETE` | `public.cases.triage_at` | DB trigger on UPDATE of triage_at (added 2026-05-19) |
| `TRANSPORT_ACTIVATED` | case status → `transport_arranged` OR `case_episodes.start_date` for transport_* | DB trigger on case status / episode status |
| `FACILITY_ARRIVAL` | `case_episodes.start_date` for hospitalization/surgery/emergency_visit | DB trigger on episode status |
| `GUARANTEED_PAYMENT` | `guarantees_of_payment.issued_date` | DB trigger on GOP status change |
| `DEFINITIVE_CARE_START` | case status → `in_treatment` | DB trigger on case status |
| `DISCHARGE` | case status → `discharged` OR `resolved` | DB trigger on case status |

`NOTE` is a non-milestone event type used for operator commentary and structured payloads (e.g., `kind=rec_decision` for AI recommendation decisions in Paper 2).

---

## 7. What this doc is NOT

- Not the intervention specification — see `/protocol` and `app/protocol/page.tsx` for that.
- Not the agent strategy — see `docs/agent-strategy.md`.
- Not the data layer audit plan — see `docs/audit-action-plan.md`.
- Not a complete Paper 1 methods section — it's the source material for the methods section. The paper will quote and contextualize this.

---

## 8. Update policy

This document changes when any of the projections change. Bumping the version in the header (currently v0.1) signals a measurement-affecting change and Paper 1's methods section must be updated to match.

Material changes include:
- Adding / removing a case from the status projection table (e.g., a new operational enum value)
- Widening or narrowing the Severity type
- Changing the `findEvent` first-match rule
- Changing the running-clock exclusion policy

Non-material edits (typos, prose polish) do not require a version bump.
