# SOSCOMMAND — Claude Code Context

## What This Is

The internal operations command center for **Tourist SOS** (tourist-sos.com). Manages emergency cases, insurance verification (Stedi EDI), claims processing, guarantees of payment, medical transport coordination, and provider/insurer relationships. This is the operational core of the ecosystem.

**Owner**: Juan Quiroz Jr. (juanquirozjr@gmail.com)
**Roles**: `super_admin` (full access), `admin` (internal ops). Rejects `partner` role — partners use SOSPRO.

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

### SOSCOMMAND's Tables (unprefixed)

**Core**:
- `profiles` — user profiles (shared with all projects via auth.users)
- `organizations` — healthcare provider organizations
- `insurers` — insurer directory with contract terms

**Cases**:
- `cases` — core case records (patient, insurance, status, urgency, assignments)
- `case_activity_log` — audit log of all case actions with timestamps
- `case_communications` — phone/email/fax logs per case
- `case_tasks` — task tracking per case
- `case_transport` — medical transport coordination (`actual_departure`, `actual_arrival`)
- `case_gop` — guarantee of payment records (`issued_at`, `settled_at`)
- `case_medical_reviews` — medical review/approval records
- `case_financial_entries` — financial ledger per case
- `case_invoices` — medical billing invoices

**Insurance/Claims**:
- `claims` — insurance claims (professional/institutional)
- `claim_lines` — individual line items within claims
- `verification_attempts` — Stedi EDI eligibility checks
- `billing_usage` — API/billing usage tracking

**Provider Network** (see also INTERNAL_DATABASE.md):
- `providers`, `provider_capabilities`, `provider_specialties`, `provider_contacts`
- `payers`, `payer_plans`, `payer_contacts`
- `partners`, `partner_memberships`

**Supporting**: `teams`, `team_members`, `documents`, `document_versions`, `notes`, `comm_logs`, `tasks`, `escalations`, `inquiries`, `agreements`, `certifications`, `signatures`

### CRITICAL: Database Boundaries

- **DO NOT modify tables owned by other projects:**
  - `phd_*` tables → owned by SOSPHD
  - `medical_*`, `health_*`, `emergency_*`, `chat_*`, `facilities` → owned by SOSTRAVEL
  - `organizations`, `patients`, `vehicles`, `crew_members`, `vehicle_assignments` → owned by SOSPRO
- All projects share `auth.users` and `profiles` for authentication.
- Super admin: `juanquirozjr@gmail.com`

### Cross-project data flow

SOSPHD (PhD research) may READ from SOSCOMMAND tables to compute research metrics:
- **TTTA** — from `case_transport.actual_departure` timestamps
- **TTGP** — from `case_gop.issued_at` / `case_gop.settled_at`
- **TTDC** — from `case_transport.actual_arrival` at definitive care facility
- **Case timeline** — from `case_activity_log` timestamps

This is read-only research access. SOSPHD never writes to SOSCOMMAND tables.

## Rules

- **No overbuilding** — this project handles operations only.
- **Clean, cohesive design** — Tourist SOS brand.
- **Respect the shared database** — only modify your own tables. See `INTERNAL_DATABASE.md`.
- **Coordinate schema changes** — document any changes in `INTERNAL_DATABASE.md`.
