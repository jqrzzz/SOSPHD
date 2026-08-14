# SOS PHD — Claude Code Context

## What This Is

SOS PHD is a PhD research automation tool within the **Tourist SOS ecosystem** (tourist-sos.com). It helps structure, plan, and automate PhD research around tourist medical emergency coordination in Southeast Asia.

**Owner**: Juan Quiroz Jr. (juanquirozjr@gmail.com)
**Thesis**: "Human-AI coordination reduces measurable delay and access friction in tourist emergencies across heterogeneous health systems."

## Ecosystem

This repo shares a **Supabase database** with 5 other projects:

| Project | Repo | Purpose | Table prefix/ownership |
|---------|------|---------|----------------------|
| SOSWEBSITE | jqrzzz/soswebsite | Public site + operational console | 39 core tables: cases, providers, payers, patients, financials, agreements, documents |
| SOSTRAVEL | jqrzzz/sostravel | Travel health & safety tools | medical_*, health_*, emergency_*, chat_*, facilities, whatsapp_sessions |
| SOSCOMMAND | jqrzzz/soscommand | Operations command center | cases, claims, providers, payers, partners, invoices, payments, teams, agreements, certifications |
| SOSPRO | jqrzzz/sospro | Professional/clinic tools | clinic-related tables |
| SOSSAFE | jqrzzz/sossafe | Insurance / payment | insurance/payment tables |
| **SOSPHD** | jqrzzz/sosphd | **This repo** — PhD research | The `research.*` schema ONLY |

### CRITICAL: Database Boundaries

- **SOSPHD owns ONLY the `research.*` schema.** Never create, modify, or delete any table outside it.
- **SOSPHD may READ from `public.*` tables** (e.g. `cases`, `case_status_history`, `case_transport`, `guarantees_of_payment`) for research analysis, but never write to them.
- **SOSPHD does NOT create cases.** Cases originate in SOSCOMMAND; SOSPHD is read-only against operational tables. See `docs/audit-action-plan.md` Decision C.
- **SOSCOMMAND is the operational core** — it owns cases, claims, providers, payers, billing, and team management.
- **SOSTRAVEL owns patient-facing data** — medical profiles, health records, emergency cases, AI chat, facility directory.
- All projects share `auth.users` and `profiles` for authentication.
- Super admin: `juanquirozjr@gmail.com`

### Migration history

The legacy `public.phd_*` schema (migration 001) was **never applied** to the live DB and has been removed from the repo. Earlier versions of this doc and the codebase mentioned phd_* tables; those are historical and all data now lives in `research.*`.

## Supabase

- **Project ref**: `jnbxkvlkqmwnqlmetknj`
- **URL**: `https://jnbxkvlkqmwnqlmetknj.supabase.co`
- **MCP connector**: "SOS SUPABASE" (configured in Claude account-level settings). ⚠️ **More than one Supabase MCP connector may be configured. Before any `apply_migration` / `execute_sql`, confirm `get_project_url` returns `jnbxkvlkqmwnqlmetknj.supabase.co` — another connector points at a different SOS project and applying SOSPHD migrations there would corrupt the wrong database.**
- **Credentials**: in `.env.local` (gitignored)
- **SOSPHD tables**: all in the `research` schema — see `supabase/migrations/20260516_004_research_schema_snapshot.sql` (core) + `20260519_007_research_journal_contacts_protocols.sql` (fieldwork) + `20260528_008_research_cases_allowlist.sql` (case dimension + allowlist)
- **RLS**: enabled on all tables. User-scoped tables use `auth.uid() = user_id`; the shared research spine (`case_events`, `recommendations`, `cases`) is gated by the `research.allowed_users` allowlist via `research.is_allowed_user()` (SD-001).

### SOSPHD Tables (`research.*` schema)

| Table | Purpose |
|-------|---------|
| `research.cases` | SOSPHD-owned case dimension — historical backfill + research-native cases (de-identified). Unified with `public.cases` in the read layer. |
| `research.case_events` | The provenance spine — operational milestones |
| `research.recommendations` | AI recommendations + operator decisions (Paper 2 core) |
| `research.allowed_users` | SD-001 allowlist gating the shared research spine |
| `research.journal_entries` | Field observations, conversations, site visits |
| `research.contacts` | Research network (doctors, fixers, academics) |
| `research.protocols` | Field visit checklists (templates + active) |
| `research.mind_maps` | Visual research mapping (nodes + edges as JSONB) |
| `research.uploads` | File metadata for research documents |
| `research.notes` | Quick research notes |
| `research.tasks` | Research task tracking |
| `research.advisor_sessions` | AI advisor chat sessions |
| `research.advisor_messages` | Chat messages with context snapshots |
| `research.docs` | Research papers, field logs, methods docs |
| `research.doc_versions` | Document version history |

## Tech Stack

- Next.js (App Router), React 19, TypeScript
- Supabase (auth + postgres + storage)
- CSS variables with HSL (shadcn/ui pattern)
- Brand color: teal `hsl(170 50% 38%)`
- Dark mode: blue-tinted backgrounds `hsl(220 20% 6%)`

## Agent Access

- **`AGENTS.md`** (repo root) is the contract for ANY AI agent writing to the
  database — research-schema-only, PHI rules, consent semantics, `'agent'`
  tagging. Follow it when writing rows on the owner's behalf.
- **`mcp/`** is the personal SOSPHD MCP server (single-user, stdio, RLS-scoped
  via owner sign-in) used by Claude Code / Cowork / OpenClaw. Registered for
  Claude Code via the root `.mcp.json`. Setup: `mcp/README.md`; plan history:
  `docs/agent-integration-plan.md`.

## Key Architecture

- **Read paths** (`lib/data/*-store.ts`) — typed wrappers over Supabase queries. Seed-data fallback in dev with `[SOSPHD:DEGRADED]` warnings.
- **Write paths** (`lib/data/*-mutations.ts`) — server-only mutation files. All use `requireAuthOrThrow` from `lib/supabase/server-auth.ts`; errors are thrown loudly (no silent failure).
- **Server actions** (`lib/*-actions.ts`) — zod-validated, call mutation functions, revalidate paths. Return `{ error }` envelopes on failure.
- **Config** (`lib/config.ts`) — single source of truth for owner, corridors, thesis, app metadata.
- **Auth** — server-side via `lib/supabase/server-auth.ts:requireAuthOrThrow` (used by mutations). Browser-side via `lib/supabase/db.ts:getCurrentUserId`. Middleware in `middleware.ts` handles route protection.

## App Pages

| Route | Feature |
|-------|---------|
| `/spine` | PhD phase tracker (landing page) |
| `/fieldwork` | Field journal — capture observations, conversations, site visits |
| `/contacts` | Research network CRM |
| `/cases` | Emergency case tracking with TTTA/TTGP/TTDC metrics |
| `/docs` | Markdown document editor with versioning |
| `/workspace` | Mind maps, uploads, notes, tasks |
| `/dashboard` | Analytics dashboard |
| `/advisor` | AI research advisor chat |
| `/protocol` | Intervention Protocol (versioned, citable — Paper 2's spec) |
| `/guide` | Onboarding walkthrough of the app's surfaces |

## PhD Metrics

- **TTTA** = Time to Transport Activation (FIRST_CONTACT → TRANSPORT_ACTIVATED)
- **TTGP** = Time to Guaranteed Payment (FIRST_CONTACT → GUARANTEED_PAYMENT)
- **TTDC** = Time to Definitive Care (FIRST_CONTACT → DEFINITIVE_CARE_START)

## Research Corridors

- Koh Samui → Bangkok
- Phuket → Bangkok
- Chiang Mai → Bangkok
- Pattaya → Bangkok
- Krabi → Bangkok
- Bangkok Hub

## Rules

- **No overbuilding** — each SOS project does its own job. SOSPHD handles research only.
- **Clean, cohesive design** — match Tourist SOS brand, teal accents, dark mode.
- **No errors, no complexity** — keep it simple and functional.
- **Respect the shared database** — only write to the `research.*` schema, never modify other projects' tables.
- **Read-only access to operational data** — SOSPHD can read from other projects' tables for research but never writes to them. Key data sources:
  - SOSPRO: `cases` (status pipeline, gop_status), `case_activities` (timestamped audit log), `transfers` (picked_up_at, delivered_at) — clinic/transport-level metrics
  - SOSWEBSITE: `cases`, `case_status_history` (full audit trail), `case_episodes` (treatment events with timestamps), `guarantees_of_payment`, `insurer_interactions`, `providers`, `payers`, `patients` — the 39-table core operational schema (shared `cases` spine with SOSCOMMAND; the sync triggers read these tables for TTTA/TTGP/TTDC milestones)
  - SOSCOMMAND: `cases`, `case_activity_log`, `case_transport` (actual_departure/arrival), `case_gop` (issued_at/settled_at), `claims` — extended operational data
  - SOSTRAVEL: `emergency_cases`, `facilities` — patient-facing incident data
- **AI automation preferred** — lean into AI for categorization, analysis, guidance.
- **Supabase is live — there are no in-memory stores.** This rule previously read
  "in-memory stores are scaffolding, function signatures match Supabase queries",
  which stopped being true when the `research.*` migration landed. Every store in
  `lib/data/` queries Supabase directly. What remains is a *seed-data fallback*:
  when a query fails or credentials are missing, the store logs
  `[SOSPHD:DEGRADED]` and returns empty/seed data rather than crashing the page.
  That is a resilience path, not scaffolding — if you see that warning in a log,
  something is genuinely wrong and the data on screen is not real.
