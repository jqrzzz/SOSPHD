# SOSPRO — Claude Code Context

## What This Is

Professional tools for medical providers and clinic partners within the **Tourist SOS ecosystem** (tourist-sos.com). Portal for hospitals, clinics, and medical facilities to manage their relationship with Tourist SOS.

**Owner**: Juan Quiroz Jr. (juanquirozjr@gmail.com)
**Roles**: `partner` role users (providers/clinics use this portal, not SOSCOMMAND)

## Shared Supabase Database

This repo connects to a **shared Supabase instance** used by 6 projects:

| Project | Repo | Purpose |
|---------|------|---------|
| SOSWEBSITE | jqrzzz/soswebsite | Public site |
| SOSTRAVEL | jqrzzz/sostravel | Travel health & safety |
| SOSCOMMAND | jqrzzz/soscommand | Operations command center |
| **SOSPRO** | jqrzzz/sospro | **This repo** — professional/clinic tools |
| SOSSAFE | jqrzzz/sossafe | Insurance / payment |
| SOSPHD | jqrzzz/sosphd | PhD research automation |

### Database Details

- **Project ref**: `jnbxkvlkqmwnqlmetknj`
- **URL**: `https://jnbxkvlkqmwnqlmetknj.supabase.co`
- **MCP connector**: "SOS SUPABASE" (configured in Claude account-level settings)

### SOSPRO's Tables

This project reads from SOSCOMMAND-owned provider tables (`providers`, `provider_capabilities`, etc.) and may own clinic-specific tables. Check the database for any tables specific to this project.

### CRITICAL: Database Boundaries

- **DO NOT modify tables owned by other projects:**
  - `phd_*` tables → owned by SOSPHD
  - `cases`, `claims`, `payers`, billing tables → owned by SOSCOMMAND
  - `medical_*`, `health_*`, `emergency_*`, `chat_*` → owned by SOSTRAVEL
- May READ from `providers`, `provider_capabilities`, `provider_specialties` (owned by SOSCOMMAND).
- All projects share `auth.users` and `profiles` for authentication.
- Super admin: `juanquirozjr@gmail.com`

## Rules

- **No overbuilding** — this project handles professional/clinic tools only.
- **Clean, cohesive design** — Tourist SOS brand.
- **Respect the shared database** — only modify your own tables.
