# SOSSAFE — Claude Code Context

> ⚠️ **DATED SNAPSHOT — not the source of truth.**
> This is a frozen copy of another repository's `CLAUDE.md`, kept so SOSPHD can
> reason about its data sources offline. It drifts the moment that repo changes,
> and it has: audited 2026-08-04 and found describing a homepage and product
> names that were retired months earlier. Treat it as orientation only — for
> anything load-bearing (table names, ownership, schema), read the live
> `CLAUDE.md` in **SOSSAFE** itself.
>
> Snapshot last reconciled: never. Audited: 2026-08-04.

## What This Is

Insurance and payment tools within the **Tourist SOS ecosystem** (tourist-sos.com). Handles insurance verification, payment processing, claims interfaces, and financial safety nets for tourists.

**Owner**: Juan Quiroz Jr. (juanquirozjr@gmail.com)

## Shared Supabase Database

This repo connects to a **shared Supabase instance** used by 6 projects:

| Project | Repo | Purpose |
|---------|------|---------|
| SOSWEBSITE | jqrzzz/soswebsite | Public site |
| SOSTRAVEL | jqrzzz/sostravel | Travel health & safety |
| SOSCOMMAND | jqrzzz/soscommand | Operations command center |
| SOSPRO | jqrzzz/sospro | Professional/clinic tools |
| **SOSSAFE** | jqrzzz/sossafe | **This repo** — insurance / payment |
| SOSPHD | jqrzzz/sosphd | PhD research automation |

### Database Details

- **Project ref**: `jnbxkvlkqmwnqlmetknj`
- **URL**: `https://jnbxkvlkqmwnqlmetknj.supabase.co`
- **MCP connector**: "SOS SUPABASE" (configured in Claude account-level settings)

### SOSSAFE's Tables

This project works with insurance and payment data. It may read from SOSCOMMAND-owned financial tables (`claims`, `guarantees_of_payment`, `invoices`, `payments`, `payers`, `payer_plans`) and SOSTRAVEL's `insurance_policies`. Check the database for any tables specific to this project.

### CRITICAL: Database Boundaries

- **DO NOT modify tables owned by other projects:**
  - `research.*` schema → owned by SOSPHD
  - `cases`, `providers`, `partners`, teams/ops tables → owned by SOSCOMMAND
  - `medical_*`, `health_*`, `emergency_*`, `chat_*` → owned by SOSTRAVEL
- May READ from `claims`, `payers`, `invoices`, `payments` (owned by SOSCOMMAND) and `insurance_policies` (owned by SOSTRAVEL).
- All projects share `auth.users` and `profiles` for authentication.
- Super admin: `juanquirozjr@gmail.com`

## Rules

- **No overbuilding** — this project handles insurance/payment only.
- **Clean, cohesive design** — Tourist SOS brand.
- **Respect the shared database** — only modify your own tables.
