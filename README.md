# SOSPHD

PhD research automation tool for **Juan Quiroz Jr.**, part of the [Tourist SOS](https://tourist-sos.com) ecosystem.

**Thesis.** *This research tests whether prospectively instrumented,
human-in-the-loop coordination can reduce measurable delay and access friction
in tourist emergencies across heterogeneous health systems.*

This app is the research workbench: it captures the field data, runs the AI intervention that Paper 2 measures, and produces the figures that go into the manuscripts.

**Current execution:** [Outcome Portfolio — 2026-08-31](docs/outcome-portfolio-2026-08-31.md)

---

## Where SOSPHD fits

SOSPHD is **one of six apps** sharing a single Supabase project (`jnbxkvlkqmwnqlmetknj`). It owns the `research.*` schema only; it reads from but does not write to the other apps' tables.

| App | Role | What SOSPHD does with it |
|---|---|---|
| **SOSPHD** | This repo. Research workbench. | Owns `research.*` (case_events, recommendations, docs, notes, tasks, journal_entries, contacts, protocols, …) |
| SOSCOMMAND | Ops command center | SOSPHD **reads** `public.cases`, `case_status_history`, `case_transport`, `guarantees_of_payment`, `claims`, `case_episodes`, `insurer_interactions` |
| SOSWEBSITE | Public site + ops console | shared `cases` schema |
| SOSTRAVEL | Traveler app | shared incident / facility tables |
| SOSPRO | Clinic tools | shared clinic tables |
| SOSSAFE | Insurance / payment | shared payer tables |

**Boundary rule:** SOSPHD only creates/updates rows in `research.*`. Reads from `public.*` are read-only. The legacy `public.phd_*` schema mentioned in earlier docs was never applied to the live database and has been retired.

---

## What the app does

| Route | What you can do |
|---|---|
| `/spine` | PhD phase tracker. Where I am in the program. |
| `/cases` | Operational cases (SOSCOMMAND) unioned with historical research cases, with TTTA/TTGP/TTDC computed per case. |
| `/cases/[id]` | Single-case detail: timeline, metrics, operational context, AI recommendations + decisions. The Paper 2 surface. |
| `/dashboard` | Phase 1 (Paper 1) dashboard. Distributions of TTTA, TTGP, TTDC across all cases. |
| `/dashboard/paper2` | Phase 2 (Paper 2) dashboard. Acceptance rate, confidence calibration, engine breakdown, override reasons. |
| `/protocol` | Intervention Protocol v0.1 — the formal spec the recommendation engine cites. |
| `/fieldwork` | Field journal: site visits, conversations, observations. |
| `/contacts` | Research network CRM (doctors, fixers, academics). |
| `/docs` | Markdown document editor (papers, methods, lit notes) with version history. |
| `/workspace` | Mind maps, uploads, notes, tasks. |
| `/advisor` | Streaming AI research assistant with case + metric context. |

The **central paper-2 mechanism** is at `/cases/[id]`: an AI recommendation engine surfaces 1–3 coordination suggestions per case, and the operator accepts or overrides each one (overrides require a written reason). The action commits the decision to `research.recommendations` first, then mirrors it to `research.case_events` as an immutable NOTE. These are sequential rather than transactional writes; the recommendation row is authoritative if the NOTE insert fails, and the missing mirror requires reconciliation.

---

## Key concepts

- **TTTA** = Time to Transport Activation (`FIRST_CONTACT` → `TRANSPORT_ACTIVATED`)
- **TTGP** = Time to Guaranteed Payment (`FIRST_CONTACT` → `GUARANTEED_PAYMENT`)
- **TTDC** = Time to Definitive Care (`FIRST_CONTACT` → `DEFINITIVE_CARE_START`)

Event timestamps come from two sources, distinguishable by `actor_id`:
1. **Operator-entered** events (`actor_id` = the signed-in user's UUID) — typed via the case detail event form.
2. **SOSCOMMAND-synced** events (`actor_id = 'soscommand_sync'`) — materialized by **database triggers** in `supabase/migrations/20260402_003_auto_sync_triggers.sql` and `20260519_006_case_events_dedup_and_triage.sql`. Writes to the configured fields on `public.cases`, `public.guarantees_of_payment`, or `public.case_episodes` emit the corresponding `research.case_events` row, dedup'd at `(case_id, event_type, occurred_at, actor_id)`.

---

## Bootstrap (development)

Requires Node 22+ and pnpm 10 (`corepack enable` or `npm i -g pnpm`).

```bash
git clone https://github.com/jqrzzz/SOSPHD.git
cd SOSPHD
pnpm install --frozen-lockfile
```

### Environment variables

Create `.env.local`:

```bash
# Required for the data layer
NEXT_PUBLIC_SUPABASE_URL=https://jnbxkvlkqmwnqlmetknj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-from-supabase-dashboard>

# Required for AI surfaces (recommendations, advisor, paper builder, doc assistant)
OPENAI_API_KEY=sk-...

# Optional: per-surface model overrides (default: gpt-4o-mini)
SOSPHD_MODEL_RECOMMENDATIONS=gpt-4o
SOSPHD_MODEL_DEFAULT=gpt-4o-mini
```

**Dev without Supabase.** If `NEXT_PUBLIC_SUPABASE_*` is missing, the app runs in degraded mode: the request proxy skips auth redirects, AI route handlers return `dev_user`, server actions throw `AuthRequiredError`, and read paths emit `[SOSPHD:DEGRADED]` warnings to console. You'll see seed/empty data in the UI. This is intentional for clean checkouts; in production builds `lib/env.ts:assertProductionEnv` refuses to serve requests until the Supabase vars are set.

**Private deployment.** In Supabase Dashboard → Authentication → General
Configuration, disable **Allow new users to sign up**. The app exposes no signup
form, but the hosted Auth setting is the server-side control that blocks direct
signup API calls.

```bash
pnpm dev    # http://localhost:3000
```

### Run the gates

```bash
pnpm run lint         # ESLint v9 flat config
pnpm exec tsc --noEmit  # TypeScript strict check
pnpm run build        # production build
pnpm test             # Vitest unit tests
pnpm run test:db      # disposable PostgreSQL contracts (Docker required)
```

CI runs all five on every push and PR (`.github/workflows/ci.yml`).

---

## Database

The schema lives in `supabase/migrations/`. The files that matter most for SOSPHD specifically:

- `20260516_004_research_schema_snapshot.sql` — full DDL for the `research.*` schema (10 tables, 7 enums, RLS policies, indexes). Authoritative; idempotent. A fresh clone applying repository migrations in order reaches the repository-intended research schema; the hosted shared project may lag until later migrations are separately reviewed and applied.
- `20260516_005_recommendations_decision_audit.sql` — adds `decided_by` + `decided_at` to `research.recommendations` with a CHECK constraint enforcing the pending/decided invariant.
- `20260519_006_case_events_dedup_and_triage.sql` — the `(case_id, event_type, occurred_at, actor_id)` dedup constraint + the TRIAGE_COMPLETE trigger.
- `20260528_008_research_cases_allowlist.sql` — `research.cases` dimension + the SD-001 `allowed_users` allowlist gating the research spine.
- `20260813_009` … `20260813_013` — grants normalization, decision immutability, consent fields, frozen analysis snapshots, and the private `research-uploads` storage bucket.

The shared Supabase project has 400+ other migrations owned by SOSCOMMAND, SOSWEBSITE, etc. They live in those repos.

---

## Architecture notes

- **Server actions** (`lib/*-actions.ts`) — zod-validated, call mutation functions, revalidate paths. Auth-gated, return `{ error }` envelopes on failure.
- **Reads** (`lib/data/*-store.ts`) — typed wrappers over Supabase queries. Reads can fall back to seed data in dev (with a `[SOSPHD:DEGRADED]` log).
- **Writes** (`lib/data/*-mutations.ts`) — server-only mutation paths using `requireAuthOrThrow`. Surface errors loudly via thrown exceptions; no silent failure.
- **Analytics** (`lib/data/analytics.ts`) — pure aggregators use bounded batched reads rather than per-row queries; current main paths use two or three database round-trips regardless of dataset size. Pure `computeDashboardSummary` / `computeCaseMetricRows` allow callers to share a single batch across multiple aggregators (e.g. `buildPaperContext`).
- **Sync** — handled by **database triggers** (migration `20260402_003_auto_sync_triggers.sql`), not application code. SOSCOMMAND writes → `research.case_events` is automatic.
- **AI config** (`lib/ai/config.ts`) — single source of truth for model selection + auth-gate helpers for LLM endpoints. Per-surface env overrides for Paper 2 engine comparison.
- **Protocol** (`lib/protocol.ts`) — `PROTOCOL_VERSION` constant. The full prose lives at `/protocol`.

For the longer story (design decisions, ecosystem ownership rules, table conventions) see `CLAUDE.md`.

---

## License

Research tool — not for redistribution. Owner: juanquirozjr@gmail.com.
