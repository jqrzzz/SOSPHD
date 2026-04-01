# SOSPRO — Claude Code Context

## What This Is

The professional operations portal ("Patient Central") for **Tourist SOS** (tourist-sos.com). Serves clinics, transport providers, and command centers. Manages patients, cases, transfers, fleet/vehicle tracking, and crew assignments.

**Owner**: Juan Quiroz Jr. (juanquirozjr@gmail.com)
**Roles**: admin, manager, staff, viewer (per organization)

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
- **Migrations**: in `scripts/` directory (not `supabase/migrations/`)

### SOSPRO's Tables (unprefixed)

**Core (001_core_schema.sql)**:
- `organizations` — clinics, transport providers, command centers
- `profiles` — user profiles extending auth.users, linked to org
- `organization_members` — many-to-many org membership with roles

**Clinical (002_patients_and_cases.sql)**:
- `patients` — central patient records (MRN, demographics, insurance, allergies)
- `cases` — core work unit with status pipeline (new → triage → active → ... → closed)
- `transfers` — patient movements between facilities with timestamps
- `case_activities` — audit log of all actions on a case

**Fleet (003_transport_and_vehicles.sql)**:
- `vehicles` — ambulances, helicopters, boats with GPS coordinates
- `crew_members` — drivers, paramedics, nurses, pilots, EMTs
- `vehicle_assignments` — links crew to vehicles per shift/trip

### CRITICAL: Database Boundaries

- **DO NOT modify tables owned by other projects:**
  - `phd_*` tables → owned by SOSPHD (PhD research — reads from your cases/transfers for metrics)
  - `claims`, `guarantees_of_payment`, `invoices`, `payments`, `payers` → owned by SOSCOMMAND
  - `medical_*`, `health_*`, `emergency_*`, `chat_*`, `facilities` → owned by SOSTRAVEL
- All projects share `auth.users` and `profiles` for authentication.
- Super admin: `juanquirozjr@gmail.com`

### Cross-project data flow

SOSPHD (PhD research) may READ from `cases`, `case_activities`, and `transfers` to compute research metrics:
- **TTTA** (Time to Transport Activation) — from `transfers` timestamps
- **TTGP** (Time to Guaranteed Payment) — from `cases.gop_status` transitions
- **TTDC** (Time to Definitive Care) — from `transfers.delivered_at`

This is read-only research access. SOSPHD never writes to SOSPRO tables.

## Rules

- **No overbuilding** — this project handles professional ops tools only.
- **Clean, cohesive design** — Tourist SOS brand.
- **Respect the shared database** — only modify your own tables.
