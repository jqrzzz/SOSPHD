# SOSTRAVEL — Claude Code Context

## What This Is

Travel health and safety tools for tourists within the **Tourist SOS ecosystem** (tourist-sos.com). Manages medical profiles, health records, emergency cases, AI health chat (SOSA), facility directory, and WhatsApp integration.

**Owner**: Juan Quiroz Jr. (juanquirozjr@gmail.com)

## Shared Supabase Database

This repo connects to a **shared Supabase instance** used by 6 projects:

| Project | Repo | Purpose |
|---------|------|---------|
| SOSWEBSITE | jqrzzz/soswebsite | Public site |
| **SOSTRAVEL** | jqrzzz/sostravel | **This repo** — travel health & safety |
| SOSCOMMAND | jqrzzz/soscommand | Operations command center |
| SOSPRO | jqrzzz/sospro | Professional/clinic tools |
| SOSSAFE | jqrzzz/sossafe | Insurance / payment |
| SOSPHD | jqrzzz/sosphd | PhD research automation |

### Database Details

- **Project ref**: `jnbxkvlkqmwnqlmetknj`
- **URL**: `https://jnbxkvlkqmwnqlmetknj.supabase.co`
- **MCP connector**: "SOS SUPABASE" (configured in Claude account-level settings)

### SOSTRAVEL's Tables

This project owns the patient-facing data tables:

- `profiles`, `medical_profiles` — user identity and medical info
- `allergies`, `medications`, `medical_conditions` — health data
- `vital_signs` — time-series health readings
- `emergency_contacts` — family/medical emergency contacts
- `insurance_policies` — coverage information
- `documents`, `health_records`, `health_record_documents` — medical documents
- `emergency_cases`, `emergency_responders` — active incidents
- `chat_sessions`, `chat_messages` — SOSA AI assistant
- `photo_analyses` — AI medical image assessment
- `facilities`, `facility_visits` — hospital/clinic directory
- `whatsapp_sessions` — OpenClaw WhatsApp integration
- `sosa_projects` — AI assistant task tracking

### CRITICAL: Database Boundaries

- **DO NOT modify tables owned by other projects:**
  - `phd_*` tables → owned by SOSPHD
  - `cases`, `claims`, `providers`, `payers`, `partners`, billing tables → owned by SOSCOMMAND
- All projects share `auth.users` and `profiles` for authentication.
- Super admin: `juanquirozjr@gmail.com`

## Rules

- **No overbuilding** — this project handles travel health tools only.
- **Clean, cohesive design** — Tourist SOS brand, teal accents.
- **Respect the shared database** — only modify your own tables.
