# SOS PHD — Claude Code Context

## What This Is

SOS PHD is a PhD research automation tool within the **Tourist SOS ecosystem** (tourist-sos.com). It helps structure, plan, and automate PhD research around tourist medical emergency coordination in Southeast Asia.

**Owner**: Juan Quiroz Jr. (juanquirozjr@gmail.com)
**Thesis**: "Human-AI coordination reduces measurable delay and access friction in tourist emergencies across heterogeneous health systems."

## Ecosystem

This repo shares a **Supabase database** with 5 other projects:

| Project | Repo | Purpose |
|---------|------|---------|
| SOSWEBSITE | jqrzzz/soswebsite | Public site (tourist-sos.com) |
| SOSTRAVEL | jqrzzz/sostravel | Travel safety tools |
| SOSCOMMAND | jqrzzz/soscommand | Operations command center |
| SOSPRO | jqrzzz/sospro | Professional tools |
| SOSSAFE | jqrzzz/sossafe | Insurance / payment |
| **SOSPHD** | jqrzzz/sosphd | **This repo** — PhD research |

All SOSPHD tables are prefixed with `phd_` to avoid collisions.

## Supabase

- **Project ref**: `jnbxkvlkqmwnqlmetknj`
- **URL**: `https://jnbxkvlkqmwnqlmetknj.supabase.co`
- **Credentials**: in `.env.local` (gitignored)
- **Tables**: all prefixed `phd_*` — see `supabase/migrations/001_initial_schema.sql`
- **RLS**: enabled on all tables, scoped to `auth.uid()`

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
- **AI automation preferred** — lean into AI for categorization, analysis, guidance.
- **Swap-for-Supabase pattern** — in-memory stores are scaffolding, function signatures match Supabase queries.
