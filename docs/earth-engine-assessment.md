# Google Earth Engine — can it serve the PhD?

Assessment of SOSCOMMAND's `EARTH_ENGINE_PLAN.md` (PROPOSED v0.1, unratified,
HEAD `d6b61fc`) against the needs of Papers 1–3. Written 2026-08-16.

**Verdict: yes, but narrowly — one covariate, one figure, and one design input.
Not a pipeline, and nothing built in this repo.**

The temptation with a tool this powerful is to find work for it. The honest
finding is that most of what makes Earth Engine valuable to SOSCOMMAND —
ridge-crossing altitudes for aeromedical gating, coordinate verification across
94,618 rows, hazard footprints — has no bearing on this thesis. What follows is
the part that does.

---

## 1. The real use: an accessibility covariate for Papers 2 and 3

### The problem it solves

The largest threat to Papers 2 and 3 is confounding by physical geography. When
coordination delay is compared across corridors — or before and after an
intervention during which case mix shifts between corridors — nothing currently
distinguishes:

> *this coordination got faster* from *these cases moved to easier terrain.*

Paper 3's feasibility analysis makes this acute rather than theoretical. The
baseline is 79.7% Krabi → Bangkok, 11 cases Chiang Mai, 4 Koh Samui, and three
corridors at zero. Any corridor-level comparison is being made across wildly
unequal physical settings, and the paper currently has no way to adjust for it.

The obvious in-house answer does not work. SOSCOMMAND's own ground ETA is:

```ts
// lib/worldview-mission-resolver.ts:888-895
const GROUND_ROAD_FACTOR = 1.3;
const GROUND_SPEED_KMH  = 55;
```

`haversine × 1.3 ÷ 55` is a deterministic function of straight-line distance. It
carries **no information beyond distance itself**, so adjusting a model for it is
identical to adjusting for distance, and reviewers will say so. Its own source
comment concedes the point: *"A heuristic (there is no routing engine)."*

### What Earth Engine actually provides

`projects/malariaatlasproject/accessibility/friction_surface/2019_v5_1` — the
Malaria Atlas Project friction surface, min/m at ~927 m, CC-BY-4.0 — run through
`ee.Image.cumulativeCost` from an incident location yields **modelled travel time
to each candidate facility**. This is the published method behind MAP's own
accessibility rasters, it is peer-reviewed, and the licence permits academic
publication with attribution.

That is a genuine covariate: derived from terrain and road-network friction, not
from our own distance primitive, and independently citable.

**Recommended use: a pre-specified covariate in the Papers 2 and 3 analysis
plans, named in the protocol before any outcome data is seen.** Pre-specifying
matters more than the number itself — a geography adjustment chosen after seeing
results is not an adjustment, it is a degree of freedom.

### The limits, which are severe and must travel with it

1. **It is not routing.** A 1 km least-cost raster: no turn restrictions, no
   one-ways, no ferry timetables, no traffic. Good for *comparative* statements
   ("A is 40 min, B is 3 h"), never for an ETA.
2. **2019 vintage.** For Paper 1's baseline (Dec 2018 – Mar 2020) this is a
   virtue — the raster is contemporaneous with the data. For Papers 2 and 3,
   running 2026 onward, it is seven years stale and blind to roads built since.
3. **Land only — and this is the hard one.** Krabi and Koh Samui involve sea
   legs. The corridors that carry 80%+ of the caseload are exactly where a
   land-friction surface has least to say. Any accessibility covariate must be
   declared as *ground-segment only*, with the marine leg unmodelled.
4. **No roads as geometry.** Earth Engine has no global road dataset at all
   (§9 of the plan: the only road asset is US-only TIGER 2016). The roads are
   baked into the friction surface as cost and cannot be recovered.

Limit 3 is the one that decides scope. It means the covariate is defensible as
*one adjustment among several*, and indefensible as *the* geography measure.
State it that way or not at all.

---

## 2. A one-figure addition to Paper 1

Paper 1 establishes that the registry recorded a calendar date where hours were
needed. A reviewer will reasonably ask: *how much did that cost — is day
resolution merely coarse, or actually fatal?*

A modelled ground travel time for the Krabi → Bangkok corridor answers it with a
number instead of an assertion. If the modelled transit is on the order of
half a day, then the registry's 24-hour quantisation is of the same order as the
entire transport leg — which converts "the resolution is too coarse" into a
quantified claim about how much of the process a single date can hide.

It also sharpens the v0.9 provenance finding. The two cases whose apparent TTTA
is exactly 24 hours cannot be distinguished from a genuine next-day transport
*precisely because* one day is comparable to the corridor's own transit time.

Cost: one batch query, one figure, one paragraph in §6.2. Labelled `◐ modelled,
not measured` throughout — it is an independent geographic estimate, not a
recovered timestamp, and Paper 1 must not appear to walk back its own negative
result.

---

## 3. A design input for Paper 3

`JRC/GSW1_4` band `seasonality` counts, per 30 m pixel, how many months a year
it holds water. Sampled along a corridor it gives a measured monsoon-closure
score with no modelling. `NOAA/IBTrACS/v4` gives every tropical cyclone track
since 1842.

For a stepped-wedge design this is a **scheduling input, not a result**: it says
which months a corridor is physically degraded, which is exactly what you need
to avoid confounding a step change with a monsoon. Worth one table in the
Paper 3 protocol. Not worth a figure.

---

## 4. What to decline

**Do not build an Earth Engine pipeline in SOSPHD.** Four reasons, any one
sufficient:

- The plan is SOSCOMMAND's, at PROPOSED v0.1, and unratified. Building against
  an unratified spec means rebuilding.
- Google Cloud Service Specific Terms §5.b (modified 2026-07-29) forbids letting
  end users touch Earth Engine APIs without their own GCP accounts. The
  compliant shape is: SOSCOMMAND runs it server-side and materialises derived
  values into Postgres. SOSPHD then *reads a derived table* — which is exactly
  the read-only posture it already holds toward operational data, and needs no
  new infrastructure here.
- SOSPHD's remit is research. A geospatial ingest pipeline is not research.
- The research need is a handful of per-corridor numbers that change roughly
  never. That is a one-off batch job someone runs and records, not a system.

**Do not use it to fill Paper 1's gap.** No amount of geospatial modelling
recovers a timestamp that was never written. Paper 1's contribution *is* the
absence; dressing it with modelled estimates would weaken the strongest thing in
the programme.

---

## 5. Recommendation

| Action | Where | Effort |
|---|---|---|
| Name a pre-specified ground-accessibility covariate in the Papers 2/3 analysis plans, with the four limits above stated | Paper 2 §methods, Paper 3 protocol | Writing only |
| Request per-corridor MAP travel-time values from SOSCOMMAND once their plan is ratified | Cross-project ask | One batch job, theirs |
| Add the modelled-transit paragraph to Paper 1 §6.2 when those values exist | Paper 1 | One paragraph |
| Record corridor seasonality months as a stepped-wedge scheduling constraint | Paper 3 protocol | One table |

Everything here is blocked on SOSCOMMAND ratifying its own plan. Nothing is
blocked on SOSPHD, and nothing needs building in this repo.

---

## Provenance

Read from `/workspace/soscommand` at `d6b61fc`: `EARTH_ENGINE_PLAN.md` §0, §1,
§5 (angles A, C, D), §7.1, §9. Constants quoted from
`lib/worldview-route-geometry.ts:85-91` and
`lib/worldview-mission-resolver.ts:888-895` as cited in that plan. Dataset IDs
and licences are as stated in the plan and have **not** been independently
verified against Google's catalogue — confirm before citing in a paper.
