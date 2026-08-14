# AGENTS.md — rules for any AI agent touching the SOSPHD database

This is a **single-user personal research system**. The only human is the
owner (super admin, `juanquirozjr@gmail.com`). Agents act on the owner's
behalf only — there is no multi-user story, and none should be built.

The preferred interface is the **SOSPHD MCP server** in `mcp/` (see
`mcp/README.md`) — typed tools, RLS-scoped, no raw SQL needed. This file
exists for agents that reach the database another way (e.g. a Supabase SQL
connector) and as the contract both paths follow.

## Hard rules (non-negotiable)

1. **Write to `research.*` only.** The Supabase project is shared by six SOS
   apps. Never INSERT/UPDATE/DELETE/DDL outside the `research` schema — not
   `public.*`, not `storage.*` config, not `auth.*`.
2. **`public.*` is read-only** (operational cases, status history, GOPs) and
   only for research analysis. SOSPHD never creates operational cases.
3. **No PHI, ever.** Patient names, dates of birth, passport numbers, and
   contact details of patients never enter the database, prompts, or logs.
   Cases are identified by `patient_ref` pseudonyms (file numbers). If source
   material contains PHI, strip it before writing.
4. **No schema changes.** Migrations go through the repo
   (`supabase/migrations/`) with owner review — never ad-hoc DDL.
5. **Never use or request a service-role key.** All access is as the
   authenticated owner; RLS is the enforcement layer.
6. **Tag what you write.** Every agent-created row carries `'agent'` in its
   `tags` array; agent-created mind-map nodes carry `"origin": "agent"` in
   their JSON. The owner must always be able to tell their own writing from
   an agent's.

## Consent (journal entries and uploads)

`consent_status` is one of:

- `not_required` — self-authored notes/reflections (most agent writes)
- `pending` — third-party material, consent not yet captured
- `obtained` — consent captured; set `consent_method`
  (`verbal`/`written`/`recorded_verbal`) and `consent_jurisdiction`
  (ISO country code, e.g. `TH`)
- `declined` — must NOT be used as research data

If unsure, use `pending` — never guess `obtained`.

## The tables agents may write

All are in schema `research`, all have RLS `auth.uid() = user_id`, so
`user_id` must be the authenticated user's id.

| Table | Columns you set | Notes |
|---|---|---|
| `notes` | `user_id, title?, content, tags[]` | Quick capture. |
| `tasks` | `user_id, title, description?, priority (1–3, default 2), due_date?` | `status` defaults `'todo'`; complete = `status='done'`. |
| `journal_entries` | `user_id, entry_type, title, content, location?, corridor?, tags[], consent_status, consent_method?, consent_jurisdiction?` | `entry_type` ∈ observation, conversation, interview, site_visit, event, idea, media. |
| `contacts` | `user_id, name, role, organization?, title?, email?, phone?, location?, corridor?, notes?, tags[]` | `role` ∈ doctor, nurse, hospital_admin, insurance, embassy, transport, government, academic, ngo, fixer, other. |
| `mind_maps` | update `nodes` / `edges` (JSONB arrays), `updated_at` | Node: `{id, x, y, label, color, radius, nodeType?, origin?}`. Edge: `{id, from, to, label?}`. Never replace the arrays wholesale — append/modify. Agent node ids use an `ag-` prefix. |
| `docs` + `doc_versions` | append to `docs.content_md`, bump `updated_at`; insert a `doc_versions` row (`doc_id, user_id, content_md, note`) with the new full content | Never overwrite a doc's content destructively. |
| `doc_annotations` | READ open annotations before revising a doc (`quote` = the passage, `comment` = what to change). Do not resolve or delete them — resolution is the owner's judgement in the app. | The paper-revision loop: annotate → revise → new version → owner resolves. |
| `institutions`, `institution_requirements` | `source_url` is REQUIRED on every row. Set `verified_at` ONLY after reading the official page for the **current** admissions cycle — a date inferred from a previous year stays NULL and the UI marks it unverified. | A wrong deadline costs a whole application cycle. Same discipline as the `[REF:]` placeholders in the papers: never state what you have not checked. |
| `outreach` | Write DRAFTS only (`status='draft'`). Never set `status='sent'` or send mail on the owner's behalf. | First contact with a prospective supervisor is a one-shot impression; the owner reviews and sends. |

Corridor values (free text, but use these canonical six):
`Koh Samui → Bangkok`, `Phuket → Bangkok`, `Chiang Mai → Bangkok`,
`Pattaya → Bangkok`, `Krabi → Bangkok`, `Bangkok Hub`.

## Read-only research tables

`research.cases` (836-case historical baseline + research-native cases),
`research.case_events` (provenance spine), `research.recommendations`
(Paper 2 decisions — **frozen once decided**, never update),
`research.analysis_snapshots` (append-only; created via the app, not ad hoc).

## Safe patterns (SQL connector path)

```sql
-- Quick note
INSERT INTO research.notes (user_id, title, content, tags)
VALUES (auth.uid(), 'From the Cowork call', '…', ARRAY['agent']);

-- Task
INSERT INTO research.tasks (user_id, title, priority, due_date)
VALUES (auth.uid(), 'Follow up Krabi clinic agreement', 1, '2026-08-22');

-- Journal entry (self-authored reflection)
INSERT INTO research.journal_entries
  (user_id, entry_type, title, content, corridor, tags, consent_status)
VALUES
  (auth.uid(), 'idea', '…', '…', 'Krabi → Bangkok', ARRAY['agent'], 'not_required');
```

If the connector runs with admin rights (`auth.uid()` is NULL), you must not
write at all — admin-path writes bypass RLS and violate rule 5's spirit. Use
the MCP server instead.
