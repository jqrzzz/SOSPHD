# SOSWEBSITE — Claude Code Context

## What This Is

The public-facing website for **Tourist SOS** (tourist-sos.com). Marketing, landing pages, and public information about the tourist medical emergency coordination service.

**Owner**: Juan Quiroz Jr. (juanquirozjr@gmail.com)

## Shared Supabase Database

This repo connects to a **shared Supabase instance** used by 6 projects:

| Project | Repo | Purpose |
|---------|------|---------|
| **SOSWEBSITE** | jqrzzz/soswebsite | **This repo** — public site |
| SOSTRAVEL | jqrzzz/sostravel | Travel health & safety tools |
| SOSCOMMAND | jqrzzz/soscommand | Operations command center |
| SOSPRO | jqrzzz/sospro | Professional/clinic tools |
| SOSSAFE | jqrzzz/sossafe | Insurance / payment |
| SOSPHD | jqrzzz/sosphd | PhD research automation |

### Database Details

- **Project ref**: `jnbxkvlkqmwnqlmetknj`
- **URL**: `https://jnbxkvlkqmwnqlmetknj.supabase.co`
- **MCP connector**: "SOS SUPABASE" (configured in Claude account-level settings)

### CRITICAL: Database Boundaries

- **SOSWEBSITE** uses shared core tables (profiles, auth).
- **DO NOT modify tables owned by other projects:**
  - `phd_*` tables → owned by SOSPHD
  - `cases`, `claims`, `providers`, `payers`, `partners`, billing tables → owned by SOSCOMMAND
  - `medical_*`, `health_*`, `emergency_*`, `chat_*`, `facilities` → owned by SOSTRAVEL
- All projects share `auth.users` and `profiles` for authentication.
- Super admin: `juanquirozjr@gmail.com`

## Rules

- **No overbuilding** — this project handles the public site only.
- **Clean, cohesive design** — Tourist SOS brand, teal accents.
- **Respect the shared database** — don't touch other projects' tables.
