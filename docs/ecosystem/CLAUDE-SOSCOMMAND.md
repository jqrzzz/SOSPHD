# SOSCOMMAND — Claude Code Context

## What This Is

The internal operations command center for **Tourist SOS** (tourist-sos.com). Manages cases, claims, billing, provider network, payer relationships, partner distribution, and team operations. This is the operational core of the ecosystem.

**Owner**: Juan Quiroz Jr. (juanquirozjr@gmail.com)
**Roles**: `super_admin`, `admin` (rejects `partner` role — they use SOSPRO)

## Shared Supabase Database

This repo connects to a **shared Supabase instance** used by 6 projects:

| Project | Repo | Purpose |
|---------|------|---------|
| SOSWEBSITE | jqrzzz/soswebsite | Public site |
| SOSTRAVEL | jqrzzz/sostravel | Travel health & safety |
| **SOSCOMMAND** | jqrzzz/soscommand | **This repo** — operations command center |
| SOSPRO | jqrzzz/sospro | Professional/clinic tools |
| SOSSAFE | jqrzzz/sossafe | Insurance / payment |
| SOSPHD | jqrzzz/sosphd | PhD research automation |

### Database Details

- **Project ref**: `jnbxkvlkqmwnqlmetknj`
- **URL**: `https://jnbxkvlkqmwnqlmetknj.supabase.co`
- **MCP connector**: "SOS SUPABASE" (configured in Claude account-level settings)
- **Full schema docs**: see `INTERNAL_DATABASE.md` in this repo

### SOSCOMMAND's Tables

This project owns the operational/business tables:

**Cases & Episodes**: `cases`, `case_episodes`, `case_parties`
**Providers**: `providers`, `provider_capabilities`, `provider_specialties`, `provider_contacts`, `capabilities_catalog`, `specialties_catalog`
**Payers**: `payers`, `payer_plans`, `payer_contacts`
**Partners**: `partners`, `partner_memberships`
**Financial**: `claims`, `guarantees_of_payment`, `invoices`, `payments`, `receivables`
**Operations**: `teams`, `team_members`, `documents`, `document_versions`, `notes`, `comm_logs`, `tasks`, `escalations`, `inquiries`
**Agreements**: `agreements`, `agreement_types`, `agreement_documents`, `agreement_status_history`, `certifications`, `certification_submissions`, `signatures`, `signers`

### CRITICAL: Database Boundaries

- **DO NOT modify tables owned by other projects:**
  - `phd_*` tables → owned by SOSPHD
  - `medical_*`, `health_*`, `emergency_*`, `chat_*`, `facilities` → owned by SOSTRAVEL
- All projects share `auth.users` and `profiles` for authentication.
- Super admin: `juanquirozjr@gmail.com`

## Rules

- **No overbuilding** — this project handles operations only.
- **Clean, cohesive design** — Tourist SOS brand.
- **Respect the shared database** — only modify your own tables.
- **Coordinate schema changes** — see `INTERNAL_DATABASE.md` before modifying shared tables.
