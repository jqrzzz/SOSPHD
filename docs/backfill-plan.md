# SOSPHD — Historical Backfill Plan (843 cases, 2018–2023)

> Scoping for Phase 1 / Step 5a (`phd-spine.ts`): ingest the historical operational spreadsheet so Paper 1 has descriptive stats to compute over. This doc is the architecture decision + task plan. It does NOT change schema yet — it surfaces the decision that must be made first.

**Status**: FIRST BATCH INGESTED (2026-08-13). Batch
`c201c6c2-3f5d-41db-8f06-40bfdef82b82`: **665 cases + 674 events**
(665 FIRST_CONTACT, 9 TRANSPORT_ACTIVATED) from the canonical source
`TouristSOS_Master_Claims_Ledger` → "Patient Central Database" sheet in
Google Drive (same registry as `TouristSOS_Master_Spreadsheet_FIVERR_2023`).
Year distribution: 2018=62, 2019=328, 2020=275. De-identification: patient_ref
= File Number (pseudonym); names/DOB never left the local ETL. Normalization:
387 raw insurer strings → 268 entities (MOP=Self-pay takes precedence over a
named insurer, 197 cases); diagnosis keyword buckets incl. new animal_bite /
marine / derm / ent; corridor derived from Province/Branch keywords (Krabi 513,
Chiang Mai 10, none/Indonesia 142). 16 duplicate file numbers disambiguated
with `#N` suffixes; 1 junk row ("FIND WHAT IS MISSING") excluded. Timestamps
stored as date at 00:00 Asia/Bangkok (+07:00) — date-only source precision,
document in Paper 1 methods. Discovered + fixed during ingest: migration 015
dropped a previously undocumented FK research.case_events → public.cases
(ON DELETE CASCADE) that the original April migration created, the repo
snapshot omitted, and §3 below wrongly denied — it foreclosed research-native
events AND would have cascaded operational deletions into research provenance.
NOT yet ingested: the 54-row transport ledger's unmatched rows (40), the
earlier MasterDatabase_a/b/c + Patient_Database + FirstLanta versions (per the
folder README, versions to reconcile), and the claimed 843-case total — the
canonical consolidated registry holds 666 rows; reconcile the remaining ~177
against the older versions when convenient.

Previous status (2026-05-28): FOUNDATIONS BUILT. Architecture decision = **Option C** (§4). SD-001 = **resolved, Option B** (allowlist). Migration `20260528_008` applied live + verified. Read-layer union, normalization, pure transform, and idempotent writer are implemented and tested. **Remaining: the spreadsheet parser** (HistoricalCaseInput[] from the real 843-case sheet) + running the ingest — both blocked on access to the sheet headers/data.

### What's built (Phase 9)
- `research.cases` dimension + `research.allowed_users` allowlist + `is_allowed_user()` + ingestion-provenance columns on `case_events` (migration `20260528_008`, applied + verified).
- Read-layer union: `getCases()` / `getCaseById()` merge `public.cases` ∪ `research.cases`; new `getResearchCases()`. `Case.source` discriminator added.
- Backfill module `lib/data/backfill/`: typed `HistoricalCaseInput` (the parser's contract), `normalize.ts` (payer/diagnosis/status/severity v1 mappers), pure `historicalCaseToRows` transform (unit-tested), idempotent server-side `ingestHistoricalCases` writer.
- SD-001 closed; `measurement-projection.md` dedup wording corrected; CLAUDE.md MCP-connector warning added.

### What remains (needs the spreadsheet)
- A parser: 843-case sheet → `HistoricalCaseInput[]`, written against the real headers.
- Widening the `PAYER_ALIASES` map (448 distinct strings → ~30) and diagnosis keyword lists from the actual data.
- Running `ingestHistoricalCases` and reconciling the missingness log against expectations.

---

### Original scoping (retained for the record)

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

`research.case_events.case_id` is `uuid NOT NULL` and ~~has no foreign key~~ (WRONG — the original April migration created an FK to public.cases that migration 015 dropped on 2026-08-13) — so we *can* mint synthetic case_ids and insert events directly. But that alone doesn't work, because of how the read layer is wired:

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
