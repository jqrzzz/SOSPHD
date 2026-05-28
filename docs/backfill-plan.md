# SOSPHD — Historical Backfill Plan (843 cases, 2018–2023)

> Scoping for Phase 1 / Step 5a (`phd-spine.ts`): ingest the historical operational spreadsheet so Paper 1 has descriptive stats to compute over. This doc is the architecture decision + task plan. It does NOT change schema yet — it surfaces the decision that must be made first.

**Status**: SCOPING (2026-05-28). Awaiting architecture decision (§4) and SD-001 resolution.

---

## 1. Ground truth (verified against live DB `jnbxkvlkqmwnqlmetknj`, 2026-05-28)

| Table | Rows | Meaning |
|---|---|---|
| `research.case_events` | 2 | Effectively empty — trigger test data, not real cases |
| `research.recommendations` | 0 | Empty |
| `public.cases` | 2 | Effectively empty — the 843 historical cases are NOT here |
| `public.guarantees_of_payment` | 0 | Empty |
| `public.case_episodes` | 0 | Empty |

**The 843 historical cases live in an external spreadsheet, not in any DB table.** Nothing has been ingested. The spine's "research.case_events is empty" note is accurate (the 2 rows are test artifacts).

---

## 2. The hard constraint: we cannot write the operational tables

`public.cases` has two `NOT NULL`-without-default columns: `case_number` and **`patient_id`**. Verified FKs:

- `public.cases.patient_id` → `public.patients.id` **(NOT NULL)**
- `public.cases.insurer_id` → `public.insurers.id`
- `public.cases.provider_id` → `public.organizations.id`

Two independent reasons this blocks "just backfill into `public.cases`":

1. **Write boundary** — SOSPHD owns only `research.*` and is read-only on `public.*` (CLAUDE.md). Writing `public.cases` / `public.patients` is SOSCOMMAND's job, not ours. This is exactly why `createCase` was deleted in Phase 1 (Decision C): it minted a placeholder `patient_id` that violated this FK.
2. **PHI minimization** — creating 843 `public.cases` rows requires 843 `public.patients` rows carrying names + DOB. That forces five years of research-only PHI into the shared *operational* database, visible to every SOS app, for data that only the research schema needs. That is the opposite of what an IRB wants.

**Conclusion:** the operational-table path is closed. Backfill must land in `research.*`.

---

## 3. The gap that dictates everything: analytics is coupled to `public.cases`

`research.case_events.case_id` is `uuid NOT NULL` but has **no foreign key** — so we *can* mint synthetic case_ids and insert events directly. But that alone doesn't work, because of how the read layer is wired:

Every aggregate starts from `getCases()` (which reads **`public.cases`**), then looks up events by `case_id`:

- `getDashboardSummary()` → `getCases()` + `getAllCaseEvents()`, iterates `for (const c of allCases)`
- `getCaseMetricRows()` → same
- `computePaper2Coordination()` → indexes recs by `caseById` built from `getCases()`
- `buildContextSnapshot()` (advisor) → `getCases()` first

**So an event whose `case_id` is not in `public.cases` is invisible to every dashboard, every metric table, and the advisor.** Backfilled events would physically exist and render *nowhere*. TTTA/TTGP/TTDC would still compute over an empty case list.

This means the backfill is not "insert 843×N events." It requires a **research-native case dimension** that the read layer treats as a first-class case source.

---

## 4. DECISION — where historical cases live

### Option A — Push into `public.cases` via SOSCOMMAND
Coordinate with SOSCOMMAND to load 843 historical cases + patients; triggers materialize `research.case_events`.
- ❌ Forces research PHI into the operational DB (§2.2).
- ❌ Pollutes SOSCOMMAND's live operational console / claims with 843 closed 2018–2023 cases.
- ❌ Outside our control; depends on another team's table.
- ✅ Zero new SOSPHD schema; triggers do the work.

### Option B — Insert events directly into `research.case_events` with synthetic case_ids
Mint UUIDs, tag `actor_id = 'historical_backfill'`, insert events.
- ✅ Within our write boundary; no PHI in operational DB.
- ❌ **Invisible to all analytics** (§3) unless we also unify the read layer.
- ❌ No home for case-level dimensions (severity, corridor, payer category, diagnosis bucket).

### Option C — New `research.cases` dimension table (RECOMMENDED)
A SOSPHD-owned case dimension holding the *research* projection of each historical case — pseudonymized, no raw PHI — plus the read layer unified to merge it with the live `public.cases` projection.
- ✅ Within write boundary (it's `research.*`).
- ✅ PHI-minimal: store `patient_ref` pseudonym + research dimensions, never name/DOB.
- ✅ Gives `case_events` a real parent and gives payer-normalization / diagnosis-bucketing a home.
- ✅ Makes backfilled data first-class in analytics once `getCases()` reads the union.
- ✅ Reproducible: a reviewer can see exactly what the research case set is, independent of operational churn.
- ⚠️ Real work: new table + RLS + read-layer refactor so `getCases()` returns `public.cases` projection ∪ `research.cases`. Both already map to the same `Case` type, so the merge point is `toCase()` + one union in `getCases()`/`getCaseById()`.

**Recommendation: Option C.** It's the only option that is simultaneously boundary-clean, PHI-minimal, analytics-visible, and reviewer-defensible. The cost is a contained read-layer refactor, not a sprawl.

---

## 5. What Option C entails (build plan, once approved)

1. **Migration — `research.cases`** (SOSPHD-owned):
   - `id uuid pk`, `source text` (`'backfill_2018_2023'` | `'prospective'`), `external_ref text` (spreadsheet row id, for audit),
   - research dimensions: `status`, `severity` (1–4), `corridor`, `payer_entity` (normalized), `diagnosis_bucket`, `country`, `incident_summary` (de-identified), `patient_ref` (pseudonym),
   - `occurred_window` (`intake_date` / `closed_date`), `created_at`, `ingested_at`, `ingest_batch_id`,
   - RLS scoped per SD-001 outcome.
2. **Ingestion provenance on `research.case_events`** — add `ingest_batch_id uuid NULL` + `inserted_at timestamptz DEFAULT now()` so backfilled rows are auditable and distinguishable from live trigger rows (see §6.D). Backfill caller uses `INSERT … ON CONFLICT ON CONSTRAINT case_events_dedup_unique DO NOTHING` (the constraint comment already anticipates a backfill script).
3. **Read-layer union** — `getCases()` / `getCaseById()` return `public.cases` projection ∪ `research.cases`. `Case` type already fits both; add a `source` discriminator so the UI can badge "historical".
4. **Ingestion script** (`scripts/` or a one-off server action, server-only, idempotent):
   - parse spreadsheet → normalize insurers (448 → ~30 lookup) → bucket diagnoses → map status/severity (separate mapping from the operational `mapStatus`/`mapPriority`, because the spreadsheet vocabulary differs) → emit `research.cases` rows + `research.case_events` rows (FIRST_CONTACT, and whichever milestones the historical record supports).
   - deterministic `occurred_at` + fixed `actor_id` so re-runs are idempotent under the dedup constraint.
   - emit a **missingness log** per metric (which milestones are absent) — Paper 1 needs this denominator anyway.
5. **Verify** — descriptive stats render on `/dashboard`; missingness rates match the ingestion log.

---

## 6. Things worth catching before data lands

**A. MCP connector points at TWO different projects — wrong-project footgun.**
Two Supabase MCP connectors are configured. `get_project_url` shows:
- `01a40bce-…` → `mdamwgtdtrvvnskqdoon` (NOT SOSPHD — likely another SOS project)
- `29ec0a3a-…` → `jnbxkvlkqmwnqlmetknj` (SOSPHD ✓)

Applying any migration or `execute_sql` through the `01a40bce` connector would hit the **wrong database**. Before the backfill (which involves DDL + bulk inserts), this must be unambiguous. **Always use the `29ec0a3a` connector for SOSPHD.** Recommend documenting this in CLAUDE.md and double-checking `get_project_url` before any write.

**B. `public.cases.patient_id` NOT NULL FK** (§2) — confirmed; this is what makes Option C the data-minimization-correct choice, not just the convenient one.

**C. `measurement-projection.md` is now internally inconsistent on dedup.**
Migration 006 set the dedup key to the 4-tuple `(case_id, event_type, occurred_at, actor_id)` — replacing the old `(case_id, event_type)` "one per type per case" rule. But `docs/measurement-projection.md` §4 still says the trigger dedup "only emits one event per type per case in the first place," while the *same* section's multi-leg example assumes two `FACILITY_ARRIVAL` events. Under the current schema the multi-leg version is correct and the "one per type" sentence is stale. **The doc needs a one-line fix**, and the backfill should expect/allow multiple same-type events per case (multi-leg journeys), relying on `findEvent`'s first-by-`occurred_at` rule.

**D. `research.case_events` has no ingestion timestamp.**
It has `occurred_at` (when the event happened) but no `inserted_at` / batch id. For 843 backfilled rows spanning 2018–2023, you cannot currently audit *when* a row entered the research DB or distinguish backfilled from live-trigger rows. Paper 1 reproducibility ("how do we know this wasn't silently edited?") wants this. Folded into §5.2.

**E. No structured home for payer-normalization or diagnosis buckets.**
The 448→~30 insurer normalization and diagnosis bucketing are Paper 1 dimensions with nowhere to live today (`public.cases.payer_name` is free text; `case_events.payload` is opaque text). Option C's `research.cases` gives them typed columns. Without Option C they're stranded.

**F. SD-001 (cross-project RLS) should be resolved as part of this.**
Today `research.case_events` / `research.recommendations` use `USING (true)` — any authenticated SOS-ecosystem user can read them. While the tables are empty that's theoretical; **the moment real research data lands it becomes a live exposure.** Even pseudonymized, the case set + decision audit is sensitive. Recommend resolving SD-001 (lean Option B: `research.allowed_users` allowlist) in the same migration train as the backfill schema. New `research.cases` should ship with the chosen policy from day one, not `USING (true)`.

---

## 7. Decisions needed before build

1. **Architecture (§4): confirm Option C** (research.cases dimension + read-layer union), or pick A/B.
2. **SD-001 (§6.F): allowlist vs status quo** — determines the RLS on the new table.
3. **Spreadsheet access + shape** — column inventory of the 843-case sheet, so the ingestion mapping (§5.4) can be written against real headers rather than assumed ones.

Once 1–3 are settled, §5 is a ~1–2 day build (migration + read-layer union + ingestion script + verify), gated by tsc/lint/test/build as usual.
