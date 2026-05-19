# SOSPHD Audit — Phased Action Plan

> Companion to [`docs/agent-strategy.md`](./agent-strategy.md). The strategy doc is the long arc (Paper 2 → credentialed agent → revenue). This plan is the cleanup that has to happen first so the rest of the story is honest.

**Audit date**: 2026-05-19
**Audit coverage**: 7 of 17 sections deep-reviewed before stopping. We have enough to act on; the remaining sections (UI pages, components, hooks, tests, docs) would mostly surface issues that cascade from the data-layer problems below.

---

## 1. Where we actually stand, in one paragraph

The Paper 2 surface (cases, recommendations, decisions, the protocol) works correctly. **Almost nothing else does.** The journal, contacts, docs editor, notes, tasks, mind maps, file uploads, and advisor chat history all silently fail to save in production because their database tables were defined in migration 001 but never applied to the live DB. The `createCase` button fails on a foreign-key constraint. The SOSCOMMAND-to-research sync has a typo'd column name (`intake_at` should be `intake_date`) that silently disables half of it. And we have BOTH database triggers AND application sync doing the same job — they don't know about each other and will produce duplicate events the moment real operational data flows. None of this hurts today because the live database is empty for research data. **The bugs are dormant.** They activate the moment data appears.

The honest summary: **the architecture is sound, the wiring is half-done, and the seed-data fallback patterns have been hiding the symptoms.**

---

## 2. Four decisions you need to make (everything else hangs off these)

Nothing past Phase 1 can proceed without these. Each is binary or near-binary.

### Decision A — Schema home: `phd_*` or `research.*`?

We have two parallel schema designs for the same data (docs, notes, tasks, mind maps, uploads, advisor sessions/messages).

- `phd_*` is defined in `supabase/migrations/001_initial_schema.sql` but **never applied to the live DB**
- `research.*` is the live schema (applied via migrations 002–005)
- The code mixes both — `lib/data/store.ts` uses `research.*` (works); `fieldwork-store`, `docs-store`, `advisor-store`, `workspace-store` use `phd_*` (broken)

**Options:**

1. **Apply migration 001** → both schemas coexist forever, code unchanged. Confusing long-term, doubles the surface to maintain.
2. **Migrate code from `phd_*` to `research.*`** → one source of truth. Requires renaming queries in 4 store files. Plus a small migration to add `journal_entries`, `contacts`, `protocols` to the `research` schema (these aren't there yet — they're only in migration 001).
3. **Hybrid** — keep the split. Maintains confusion.

**Recommendation: Option 2.** The live DB already says `research.*` is the home. `CLAUDE.md` is the only thing claiming `phd_*` is canonical, and `CLAUDE.md` is editable. The work is mechanical.

**Your decision**: _________________________________

### Decision B — DB triggers or app sync (or both)?

We have two parallel sync systems for SOSCOMMAND→research events.

- **DB triggers** (live, in migration 003): emit on operational table writes. Working for 5 of 7 event types. Dedup is `(case_id, event_type)` — drops multi-leg journey data.
- **App sync** (`lib/data/sync.ts`): runs on case detail page load. Has the `intake_at` column-name bug. Dedup filters on `actor_id = 'soscommand_sync'` only, so it doesn't see trigger-emitted events. Once data flows, the two will produce duplicate events for 4 event types.

**Options:**

1. **Keep triggers, delete app sync.** Triggers fire reliably without UI traffic. Simpler. Need new triggers for `TRIAGE_COMPLETE` and multi-leg arrivals.
2. **Keep app sync, delete triggers.** App-side logic is easier to refine. Only fires on page visits.
3. **Keep both, reconcile dedup.** Defense in depth. More complexity.

**Recommendation: Option 1.** Triggers are already live; app sync is more code without producing better data. We'd lose `lib/data/sync.ts` (~324 lines) and the SyncOperationalButton, gain a few new triggers.

**Your decision**: _________________________________

### Decision C — `createCase` direction

The function inserts into SOSCOMMAND's `public.cases` with placeholder `patient_id = '00000000-...'`, which violates the FK constraint to `public.patients`. Every call fails today. Even if the FK weren't there, it would pollute SOSCOMMAND's table with fake-patient cases.

**Options:**

1. **Delete the function and the `/cases/new` UI.** Per CLAUDE.md, "SOSPHD is read-mostly — cases originate in SOSCOMMAND."
2. **Fix it to route through a real patient lookup/creation flow.** Significant work; not in Paper 1 path.

**Recommendation: Option 1.** It's a leftover from early development. Removing it is one PR.

**Your decision**: _________________________________

### Decision D — Geographic scope: Thailand or Indonesia?

The PhD spine (`lib/data/phd-spine.ts`) describes an **Indonesia** pilot (Penida, Lembongan, Ubud, Gili, Lombok → Denpasar). The rest of the codebase — `APP_CONFIG.research.corridors`, `lib/agent/domain.ts`, the agent strategy doc, CLAUDE.md, tourist-sos.com — is **Thailand**-focused (Koh Samui, Phuket, Chiang Mai, Pattaya, Krabi, Bangkok).

**Options:**

1. Update `phd-spine.ts` to Thailand (align spine with everything else).
2. Update `APP_CONFIG` + agent domain to Indonesia (align everything else with spine).
3. Document both — Thailand active, Indonesia future expansion.

**Recommendation: Option 1 with a future-expansion note.** Tourist SOS is Thailand. The agent strategy doc already calls Indonesia/Vietnam "24-month expansion." Make the spine reflect that — Thailand is the pilot, Indonesia is on the roadmap.

**Your decision**: _________________________________

---

## 3. The phases

Once the four decisions are made, everything else is sequenced.

### Phase 1 — Stop the bleeding (1–2 days · CRITICAL · blocks Paper 1 data integrity)

These bugs activate the moment real operational data flows. Must fix before any backfill.

- [ ] **Fix `lib/data/sync.ts:178`** — rename `intake_at` → `intake_date` in the SELECT and the `OperationalRows` interface
- [ ] **Reconcile triggers vs app sync** per Decision B
- [ ] **Add UNIQUE constraint** on `(case_id, event_type, occurred_at, actor_id)` for `research.case_events` so concurrent inserts can't duplicate
- [ ] **Add a TRIAGE_COMPLETE emission path** — either a new DB trigger on `cases.triage_at` updates, or a kept-and-fixed app sync (depends on Decision B)
- [ ] **Delete `createCase` and `/cases/new`** per Decision C

**Effort**: half a day for the column fix + UNIQUE constraint, half a day for the trigger/sync reconciliation, half a day for `createCase` removal. One day of testing.

### Phase 2 — Schema reconciliation (1–3 days · depends on Decision A)

If A = Option 2 (migrate to `research.*`):

- [ ] Write new migration adding `research.journal_entries`, `research.contacts`, `research.protocols` tables
- [ ] Apply migration to live DB
- [ ] Update `phd_X` → `research.X` table references in:
  - `lib/data/fieldwork-store.ts` (3 tables)
  - `lib/data/docs-store.ts` (2 tables)
  - `lib/data/advisor-store.ts` (4 tables)
  - `lib/data/workspace-store.ts` (2 tables)
- [ ] Move `supabase/migrations/001_initial_schema.sql` to `archive/` (or delete)
- [ ] Delete `scripts/00X-create-tables.sql` (dead schemas)
- [ ] Update `CLAUDE.md` to reflect `research.*` as canonical
- [ ] Verify with a real query against each store

If A = Option 1 (apply migration 001): just run the migration. Code works as-is.

**Effort**: 1 day for the migration writing/applying, 1–2 days for code updates and testing.

### Phase 3 — Auth + write paths (2–3 days · depends on Phase 2)

Half the writes in the app silently fail because they use the browser client server-side and target tables that don't exist. With Phase 2 done, the tables exist; now make the writes actually work.

- [ ] **Split `advisor-store.ts`** → `advisor-store.ts` (reads only) + `advisor-mutations.ts` (writes, uses `requireAuthOrThrow`)
- [ ] **Split `workspace-store.ts`** same way
- [ ] **Split `docs-store.ts`** same way (matches fieldwork pattern)
- [ ] **Convert all 13+ write functions** to throw on auth failure instead of returning null
- [ ] **Update server actions** to handle the new throwing signatures (try/catch + return `{error}`)
- [ ] **Delete `lib/auth.ts`** — 76 lines of dead code
- [ ] **Converge dev-mode auth policy** — pick one rule across middleware + route handlers + mutations (recommend: throw in dev with no env)
- [ ] **Add `warnDegradedMode` instrumentation** to the 5+ silent read fallbacks in fieldwork/advisor/workspace

**Effort**: ~2 days. Mechanical refactor following the existing `fieldwork-mutations.ts` template.

### Phase 4 — Measurement integrity for Paper 1 (2–4 days · blocks Paper 1 publication)

The runtime mappings in `store.ts` ARE the measurement methodology Paper 1 will publish. They need to be intentional, documented, and reviewer-defensible.

- [ ] **Fix `mapStatus`** — explicitly handle `in_progress`, `triage`, `resolved` instead of defaulting them all to `"open"`
- [ ] **Fix `mapPriority` Severity-5 unreachability** — either widen the operational `priority` enum or narrow TS `Severity` to 1-4
- [ ] **Document `mapStatus`, `mapPriority`, `findEvent`** in Paper 1's methods section — these ARE the measurement projection from operational reality to research data
- [ ] **Update `phd-spine.ts` geography** per Decision D
- [ ] **Update `step-5a` status** in phd-spine to match reality (data isn't backfilled yet)
- [ ] **Answer `oq-7`** (baseline vs intervention boundary) — the most-Paper-2-relevant unanswered question in the spine

**Effort**: half a day code changes; rest is writing methods-section copy.

### Phase 5 — Performance (1–2 days · not blocking but cheap wins)

These will become visible the moment real operational data exists.

- [ ] **Fix `getEventCountByCaseId` N+1** on the cases list page — group counts in a single query
- [ ] **Fix `buildContextSnapshot` N+1** in context-builder — use `getAllCaseEvents` once, group in memory
- [ ] **Fix `buildPaperContext`** — share 3-query batch with the two dashboard functions instead of sequential 6 queries
- [ ] **`getCases` should paginate + project columns** instead of `*` and unlimited

**Effort**: ~1 day total. Small, contained changes.

### Phase 6 — Hygiene (1 day · do whenever)

Low-risk cleanup so the codebase doesn't accumulate fossils:

- [ ] Delete `styles/globals.css` (dead, 90 lines, never imported)
- [ ] Delete `Site` and `Profile` TypeScript interfaces (orphan types, no DB counterpart)
- [ ] Remove `site_id` from `Doc`, `ResearchNote`, `ResearchTask` interfaces (phantom field)
- [ ] Pseudonymize seed contacts (Dr. Somchai → Dr. A. Sample, etc.) — privacy by default
- [ ] Update all `// Mirror the target Postgres schema exactly` comments — they lie
- [ ] Reconcile corridor list across `APP_CONFIG`, `lib/agent/domain.ts`, `CLAUDE.md`
- [ ] Add `packageManager: "pnpm@10"` field to `package.json` so CI and Vercel agree
- [ ] Remove `@tailwindcss/postcss` dev dep (unused; v4 leftover from v3 install)

**Effort**: ~1 day of careful deletes and small edits.

### Phase 7 — Agent-economy foundation (4–8 weeks · the long arc)

This is what [`docs/agent-strategy.md`](./agent-strategy.md) lays out as **Phase 1 of that doc**: service tokens, provenance receipts, PHI redaction, MCP wrap, agent-card. **Do not start until Phases 1–4 of THIS plan are done.** External agents calling a broken data layer is worse than no external agents.

The strategy doc is the canonical reference. This audit doesn't change its content — it just adds the prerequisite that the data layer be sound first.

---

## 4. What we're explicitly NOT fixing (so we stay focused)

These came up in the audit but are NOT in the plan. Worth knowing they exist; not worth doing now.

- **Remove all `any` types** — cosmetic, 19 ESLint warnings, no behavior change
- **Add Prettier** — DX nice-to-have, no functional impact
- **`formatDate` 24-hour mode + UTC marker** — minor; matters for paper figures, easy to fix later
- **Migration to ES2022 TypeScript target** — minor bundle-size win, no behavior change
- **Mind map / journal attachment JSONB shape versioning** — premature; revisit when shapes evolve
- **Bundle-size audit of `components/ui/`** — most are shadcn, unmodified, low-priority
- **Deep audit of pages / components / hooks / tests** (the remaining 10 sections from the original 17-section audit plan) — deferred. Most issues there cascade from the data layer; fixing the data layer first reduces what's left to fix downstream.
- **Generate Supabase types via `scripts/generate-types.sh`** — would catch schema/code drift but adds a build step. Revisit after Phase 2.

---

## 5. How to use this plan

This is a living doc. Update the **Status** column below as phases complete. Add new findings to the appropriate phase. Don't reshuffle without rethinking dependencies.

### Suggested order of operations

1. **Today**: read this. Make Decisions A–D. Update the "Decisions" section above with your choices.
2. **This week**: Phase 1 (stop the bleeding) — half a sprint
3. **Next week**: Phase 2 (schema reconciliation) — half a sprint
4. **Following week**: Phase 3 (auth + writes) + Phase 4 (measurement integrity) in parallel
5. **Mid-month**: Phase 5 (perf) + Phase 6 (hygiene) as time allows
6. **Then**: Phase 7 per the agent strategy doc

### Living log

| Date | Phase | Status | Notes |
|---|---|---|---|
| 2026-05-19 | — | Plan drafted | Awaiting decisions A–D |

---

## 6. How this ties to your goals

Three goals were stated over the audit conversation:

1. **"Help me get a PhD"** — Phases 1, 2, 4 are critical-path for Paper 1 publication. Without these, the methods section is indefensible (the measurement projection is implicit and the data layer is half-broken). Phase 7 supports Paper 2's "intervention is a real, peer-reviewed thing" claim.

2. **"Make AI smart and ready"** — Phase 7 (per agent strategy doc) is the direct answer. But it depends on Phases 1–4 producing a reliable data layer first. An AI agent answering questions from a broken data layer is worse than no agent.

3. **"Don't ruin other projects"** — Decision C (delete `createCase`) directly addresses the only mechanism by which SOSPHD writes into SOSCOMMAND's tables. After Phase 1, SOSPHD is truly read-only against the operational schema. Verified during audit that no other code path writes to non-`research.*` tables.

---

## 7. Effort summary

| Phase | Effort | Blocks |
|---|---|---|
| Decisions A–D | 1 hour of owner time | Everything |
| Phase 1 — Stop the bleeding | 1–2 days | Paper 1 |
| Phase 2 — Schema reconciliation | 1–3 days | All app writes |
| Phase 3 — Auth + write paths | 2–3 days | Multi-user / agent use |
| Phase 4 — Measurement integrity | 2–4 days | Paper 1 publication |
| Phase 5 — Performance | 1–2 days | Scale |
| Phase 6 — Hygiene | 1 day | Nothing |
| Phase 7 — Agent economy | 4–8 weeks | Year-1 revenue |

**Total for Phases 1–6**: roughly **10–15 working days**. Phase 7 is the strategy doc's territory.

---

## 8. Source audit reference

This plan derives from the 2026-05-19 audit. 7 of 17 planned sections were deep-reviewed:

- §1 Project configuration & tooling
- §2 Database (migrations + scripts) — **headline findings: phd_* tables missing live, dual sync systems**
- §3 Supabase client layer — **headline: middleware redirects API requests to `/`**
- §4 Auth, app config, protocol, utilities — **headline: `lib/auth.ts` is dead code**
- §5 Data type definitions — **headline: `Case` interface doesn't match `public.cases` schema**
- §6 Data layer core path — **headline: `createCase` broken, sync column bug, dual emission**
- §7 Feature stores — **headline: 8+ writes silently fail**

Findings totals: **6 Critical, 22 High, 35 Medium, 26 Low, 12 Nit** = 101 findings logged.

Sections deferred: §8–§17 (AI config, recommendation engine, agent subsystem, server actions, API routes, page routes, components, hooks, tests, docs). These can be re-opened after the data-layer phases land, when the cascading effects from §6/§7 are resolved.
