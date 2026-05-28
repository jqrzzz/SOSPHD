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
- **MCP connector**: "SOS SUPABASE" (configured in Claude account-level settings)
- **Credentials**: in `.env.local` (gitignored)
- **SOSPHD tables**: all in the `research` schema — see `supabase/migrations/20260516_004_research_schema_snapshot.sql` (core) + `20260519_007_research_journal_contacts_protocols.sql` (fieldwork)
- **RLS**: enabled on all tables, scoped to `auth.uid()`

### SOSPHD Tables (`research.*` schema)

| Table | Purpose |
|-------|---------|
| `research.case_events` | The provenance spine — operational milestones |
| `research.recommendations` | AI recommendations + operator decisions (Paper 2 core) |
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

## Key Architecture

- **In-memory stores** (`lib/data/*-store.ts`) — designed to swap for Supabase. Each store has seed data for local dev and exports functions with signatures that map 1:1 to Supabase queries.
- **Server actions** (`lib/*-actions.ts`) — zod-validated, call store functions, revalidate paths.
- **Config** (`lib/config.ts`) — single source of truth for owner, corridors, thesis, app metadata.
- **Auth** (`lib/auth.ts`) — resolves real Supabase user, falls back to config for local dev.

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
  - SOSWEBSITE: `cases`, `case_status_history` (full audit trail), `case_episodes` (treatment events with timestamps), `guarantees_of_payment`, `insurer_interactions`, `providers`, `payers`, `patients` — the 39-table core operational schema and primary data source for TTTA/TTGP/TTDC
  - SOSCOMMAND: `cases`, `case_activity_log`, `case_transport` (actual_departure/arrival), `case_gop` (issued_at/settled_at), `claims` — extended operational data
  - SOSTRAVEL: `emergency_cases`, `facilities` — patient-facing incident data
- **AI automation preferred** — lean into AI for categorization, analysis, guidance.
- **Swap-for-Supabase pattern** — in-memory stores are scaffolding, function signatures match Supabase queries.
