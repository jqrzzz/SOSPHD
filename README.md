# SOSPHD

PhD research automation tool for **Juan Quiroz Jr.**, part of the [Tourist SOS](https://tourist-sos.com) ecosystem.

**Thesis.** *Human-AI coordination reduces measurable delay and access friction in tourist emergencies across heterogeneous health systems.*

This app is the research workbench: it captures the field data, runs the AI intervention that Paper 2 measures, and produces the figures that go into the manuscripts.

---

## Where SOSPHD fits

SOSPHD is **one of six apps** sharing a single Supabase project (`jnbxkvlkqmwnqlmetknj`). It owns the `research.*` schema and the `phd_*` tables in `public`; it reads from but does not write to the other apps' tables.

| App | Role | What SOSPHD does with it |
|---|---|---|
| **SOSPHD** | This repo. Research workbench. | Owns `research.*` (case_events, recommendations, docs, notes, tasks, …) + `phd_*` tables |
| SOSCOMMAND | Ops command center | SOSPHD **reads** `public.cases`, `case_status_history`, `case_transport`, `guarantees_of_payment`, `claims`, `case_episodes`, `insurer_interactions` |
| SOSWEBSITE | Public site + ops console | shared `cases` schema |
| SOSTRAVEL | Traveler app | shared incident / facility tables |
| SOSPRO | Clinic tools | shared clinic tables |
| SOSSAFE | Insurance / payment | shared payer tables |

**Boundary rule:** SOSPHD only creates/updates rows in `research.*` or `phd_*`. Reads from `public.*` are read-only.

---

## What the app does

| Route | What you can do |
|---|---|
| `/spine` | PhD phase tracker. Where I am in the program. |
| `/cases` | Operational cases (sourced from SOSCOMMAND), with TTTA/TTGP/TTDC metrics computed per case. |
| `/cases/[id]` | Single-case detail: timeline, metrics, operational context, AI recommendations + decisions. The Paper 2 surface. |
| `/dashboard` | Phase 1 (Paper 1) dashboard. Distributions of TTTA, TTGP, TTDC across all cases. |
| `/dashboard/paper2` | Phase 2 (Paper 2) dashboard. Acceptance rate, confidence calibration, engine breakdown, override reasons. |
| `/protocol` | Intervention Protocol v0.1 — the formal spec the recommendation engine cites. |
| `/fieldwork` | Field journal: site visits, conversations, observations. |
| `/contacts` | Research network CRM (doctors, fixers, academics). |
| `/docs` | Markdown document editor (papers, methods, lit notes) with version history. |
| `/workspace` | Mind maps, uploads, notes, tasks. |
| `/advisor` | Streaming AI research assistant with case + metric context. |

The **central paper-2 mechanism** is at `/cases/[id]`: an AI recommendation engine surfaces 1–3 coordination suggestions per case, the operator accepts or overrides each one (overrides require a written reason), and every decision lands in both `research.recommendations` (denormalized columns) and `research.case_events` (immutable NOTE event) so the provenance chain is queryable two ways.

---

## Key concepts

- **TTTA** = Time to Transport Activation (`FIRST_CONTACT` → `TRANSPORT_ACTIVATED`)
- **TTGP** = Time to Guaranteed Payment (`FIRST_CONTACT` → `GUARANTEED_PAYMENT`)
- **TTDC** = Time to Definitive Care (`FIRST_CONTACT` → `DEFINITIVE_CARE_START`)

Event timestamps come from two sources, distinguishable by `actor_id`:
1. **Operator-entered** events (`actor_id` = the signed-in user's UUID) — typed via the case detail event form.
2. **SOSCOMMAND-synced** events (`actor_id = 'soscommand_sync'`) — materialized from `public.cases.{intake_at, triage_at, …}` + `case_transport.*` + `guarantees_of_payment.*` + `case_episodes.*`. The sync is idempotent and runs lazily on case page load; there's a "Sync from SOSCOMMAND" button on `/dashboard/paper2` for bulk backfill.

---

## Bootstrap (development)

Requires Node 22+.

```bash
git clone https://github.com/jqrzzz/sosphd.git
cd sosphd
npm install --legacy-peer-deps
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

**Dev without Supabase.** If `NEXT_PUBLIC_SUPABASE_*` is missing, the app runs in degraded mode: middleware skips auth redirects, server actions return `dev_user`, and read paths emit `[SOSPHD:DEGRADED]` warnings to console. You'll see seed/empty data in the UI. This is intentional for clean checkouts but **must** be configured for any deployment.

```bash
npm run dev    # http://localhost:3000
```

### Run the gates

```bash
npm run lint        # ESLint v9 flat config
npx tsc --noEmit    # TypeScript strict check
npm run build       # production build
npm test            # Vitest unit tests
```

CI runs all four on every push and PR (`.github/workflows/ci.yml`).

---

## Database

The schema lives in `supabase/migrations/`. The two files that matter for SOSPHD specifically:

- `20260516_004_research_schema_snapshot.sql` — full DDL for the `research.*` schema (10 tables, 7 enums, RLS policies, indexes). Authoritative; idempotent. A fresh clone applying migrations in order reaches the same state the live project has.
- `20260516_005_recommendations_decision_audit.sql` — adds `decided_by` + `decided_at` to `research.recommendations` with a CHECK constraint enforcing the pending/decided invariant.

The shared Supabase project has 400+ other migrations owned by SOSCOMMAND, SOSWEBSITE, etc. They live in those repos.

---

## Architecture notes

- **Server actions** (`lib/*-actions.ts`) — zod-validated, call store functions, revalidate paths. Auth-gated.
- **Stores** (`lib/data/*-store.ts`) — typed wrappers over Supabase queries. Reads can fall back to seed data in dev (with a `[SOSPHD:DEGRADED]` log); writes throw `AuthRequiredError` when auth is missing.
- **Analytics** (`lib/data/analytics.ts`) — pure aggregators with a strict performance contract: every aggregator uses exactly **three** database round-trips regardless of dataset size. Per-case loop fetches are forbidden in this file.
- **Sync** (`lib/data/sync.ts`) — pure mapper + idempotent runtime that materializes SOSCOMMAND timestamps as `research.case_events` rows.
- **AI config** (`lib/ai/config.ts`) — single source of truth for model selection + auth-gate helpers for LLM endpoints. Per-surface env overrides for Paper 2 engine comparison.
- **Protocol** (`lib/protocol.ts`) — `PROTOCOL_VERSION` constant. The full prose lives at `/protocol`.

For the longer story (design decisions, ecosystem ownership rules, table conventions) see `CLAUDE.md`.

---

## License

Research tool — not for redistribution. Owner: juanquirozjr@gmail.com.
