# SOSWEBSITE — Claude Code Context

## What This Is

The public-facing website (tourist-sos.com) AND the operational console for **Tourist SOS**. Serves two audiences: public visitors (marketing pages) and internal staff (auth-protected `/console` with case management, intake, and the SOSA AI front-door chatbot).

**Owner**: Juan Quiroz Jr. (juanquirozjr@gmail.com)

## Shared Supabase Database

This repo connects to a **shared Supabase instance** used by 6 projects:

| Project | Repo | Purpose |
|---------|------|---------|
| **SOSWEBSITE** | jqrzzz/soswebsite | **This repo** — public site + operational console |
| SOSTRAVEL | jqrzzz/sostravel | Travel health & safety |
| SOSCOMMAND | jqrzzz/soscommand | Operations command center |
| SOSPRO | jqrzzz/sospro | Professional/clinic tools |
| SOSSAFE | jqrzzz/sossafe | Insurance / payment |
| SOSPHD | jqrzzz/sosphd | PhD research automation |

### Database Details

- **Project ref**: `jnbxkvlkqmwnqlmetknj`
- **URL**: `https://jnbxkvlkqmwnqlmetknj.supabase.co`
- **MCP connector**: "SOS SUPABASE" (configured in Claude account-level settings)

### SOSWEBSITE's Tables (unprefixed — 39 tables across 8 migration phases)

**Phase 1 — Foundation**:
`countries`, `teams`, `users`, `team_members`, `specialties_catalog`, `capabilities_catalog`, `document_types`, `agreement_types`

**Phase 2 — Patients & Providers**:
`patients`, `patient_reps`, `providers`, `provider_contacts`, `provider_capabilities`, `provider_specialties`, `provider_onboarding`, `provider_intelligence`

**Phase 3 — Payers**:
`payers`, `payer_contacts`, `payer_plans`

**Phase 4 — Cases Core**:
`cases` (auto-numbered SOS-YYYY-NNNNN), `case_financial_modes`, `case_parties`, `case_episodes`, `case_assignments`, `case_status_history`

**Phase 5 — Case Operations**:
`tasks`, `notes`, `escalations`, `comm_logs`, `insurer_interactions`

**Phase 6 — Documents & Signatures**:
`documents`, `document_versions`, `signers`, `signatures`

**Phase 7 — Agreements**:
`agreements`, `agreement_documents`, `agreement_status_history`

**Phase 8 — Financials**:
`invoices`, `claims`, `payments`, `receivables`, `guarantees_of_payment`

**Additional**: `inquiries` (SOSA AI chatbot intake queue)

### CRITICAL: Database Boundaries

- **DO NOT modify tables owned by other projects:**
  - `phd_*` tables → owned by SOSPHD
  - `medical_*`, `health_*`, `emergency_*`, `chat_*`, `facilities` → owned by SOSTRAVEL
  - `organizations`, `vehicles`, `crew_members`, `vehicle_assignments` → owned by SOSPRO
- All projects share `auth.users` and `profiles` for authentication.
- Super admin: `juanquirozjr@gmail.com`

### Cross-project data flow

SOSPHD (PhD research) may READ from SOSWEBSITE tables to compute research metrics:
- **TTTA** — from `case_episodes` (transport events) and `case_status_history` timestamps
- **TTGP** — from `guarantees_of_payment` and `insurer_interactions` timing
- **TTDC** — from `case_episodes` (definitive care arrival)
- **Case timeline** — from `case_status_history` (full status audit trail)

This is read-only research access. SOSPHD never writes to SOSWEBSITE tables.

## Rules

- **No overbuilding** — this project handles the public site and operational console.
- **Clean, cohesive design** — Tourist SOS brand, teal accents.
- **Respect the shared database** — only modify your own tables.
- **RLS is permissive** — all authenticated users get full CRUD. Be careful with role checks in app code.
