# SOS PHD — Claude Code Context

## What This Is

SOS PHD is a PhD research automation tool within the **Tourist SOS ecosystem** (tourist-sos.com). It helps structure, plan, and automate PhD research around tourist medical emergency coordination in Southeast Asia.

**Owner**: Juan Quiroz Jr. (juanquirozjr@gmail.com)
**Thesis**: "Human-AI coordination reduces measurable delay and access friction in tourist emergencies across heterogeneous health systems."

## Ecosystem

This repo shares a **Supabase database** with 5 other projects:

| Project | Repo | Purpose | Table prefix/ownership |
|---------|------|---------|----------------------|
| SOSWEBSITE | jqrzzz/soswebsite | Public site (tourist-sos.com) | Shared core tables (profiles, etc.) |
| SOSTRAVEL | jqrzzz/sostravel | Travel health & safety tools | medical_*, health_*, emergency_*, chat_*, facilities, whatsapp_sessions |
| SOSCOMMAND | jqrzzz/soscommand | Operations command center | cases, claims, providers, payers, partners, invoices, payments, teams, agreements, certifications |
| SOSPRO | jqrzzz/sospro | Professional/clinic tools | clinic-related tables |
| SOSSAFE | jqrzzz/sossafe | Insurance / payment | insurance/payment tables |
| **SOSPHD** | jqrzzz/sosphd | **This repo** — PhD research | `phd_*` prefixed tables ONLY |

### CRITICAL: Database Boundaries

- **SOSPHD owns ONLY `phd_*` tables.** Never create, modify, or delete any other table.
- **SOSPHD may READ from other tables** (e.g. `cases`, `profiles`) for research analysis, but never write to them.
- **SOSCOMMAND is the operational core** — it owns cases, claims, providers, payers, billing, and team management.
- **SOSTRAVEL owns patient-facing data** — medical profiles, health records, emergency cases, AI chat, facility directory.
- All projects share `auth.users` and `profiles` for authentication.
- Super admin: `juanquirozjr@gmail.com`

## Supabase

- **Project ref**: `jnbxkvlkqmwnqlmetknj`
- **URL**: `https://jnbxkvlkqmwnqlmetknj.supabase.co`
- **MCP connector**: "SOS SUPABASE" (configured in Claude account-level settings)
- **Credentials**: in `.env.local` (gitignored)
- **SOSPHD tables**: all prefixed `phd_*` — see `supabase/migrations/001_initial_schema.sql`
- **RLS**: enabled on all tables, scoped to `auth.uid()`

### SOSPHD Tables (phd_* prefix)

| Table | Purpose |
|-------|---------|
| `phd_journal_entries` | Field observations, conversations, site visits |
| `phd_contacts` | Research network (doctors, fixers, academics) |
| `phd_protocols` | Field visit checklists (templates + active) |
| `phd_mind_maps` | Visual research mapping (nodes + edges as JSONB) |
| `phd_uploads` | File metadata for research documents |
| `phd_notes` | Quick research notes |
| `phd_tasks` | Research task tracking |
| `phd_advisor_sessions` | AI advisor chat sessions |
| `phd_advisor_messages` | Chat messages with context snapshots |
| `phd_docs` | Research papers, field logs, methods docs |
| `phd_doc_versions` | Document version history |

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
- **Respect the shared database** — use `phd_` prefix, never modify other projects' tables.
- **Read-only access to operational data** — SOSPHD can read from other projects' tables for research but never writes to them. Key data sources:
  - SOSPRO: `cases` (status pipeline, gop_status), `case_activities` (timestamped audit log), `transfers` (picked_up_at, delivered_at) — primary source for TTTA/TTGP/TTDC metrics
  - SOSCOMMAND: `cases`, `claims`, `providers`, `payers` — operational context
  - SOSTRAVEL: `emergency_cases`, `facilities` — patient-facing incident data
- **AI automation preferred** — lean into AI for categorization, analysis, guidance.
- **Swap-for-Supabase pattern** — in-memory stores are scaffolding, function signatures match Supabase queries.
