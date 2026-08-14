# Agent Integration Plan — driving SOSPHD from Claude, Cowork, and OpenClaw

**Status**: Phases 1 + 2 GREENLIT (owner, 2026-08-14) and built — see `AGENTS.md`
(the agent contract) and `mcp/` (the server + setup in `mcp/README.md`).
Scope locked as **single-user by design**: the server is stdio-only, runs on
the owner's machines, signs in as the owner. Phase 3 (remote endpoint) stays
parked indefinitely.
**Date**: 2026-08-14

## The idea in one paragraph

The web app stays the human surface. Everything an agent needs — notes, journal,
tasks, contacts, mind maps, docs, the 836-case baseline — already lives in the
`research.*` schema behind RLS. So instead of building per-tool integrations, we
expose that schema once through **MCP** (Model Context Protocol), the one
standard that Claude.ai, Claude Cowork, Claude Code, and OpenClaw all already
speak. One small server, every agent surface plugged in.

## What already works today (zero build)

Your Claude account has the **SOS SUPABASE** MCP connector. From Claude.ai or
Cowork you can already say "add a note to my research database" and Claude can
run the SQL. Two caveats:

1. That connector has admin-level power over the *whole* shared database — all
   six SOS apps. It works, but one wrong query touches operational tables.
2. Raw SQL is a bad agent interface — every request re-derives the schema, and
   there's nothing stopping a malformed write.

Verdict: fine for you personally in a pinch; not the system.

## Phase 1 — `AGENTS.md` agent guide (one file, ~1 hour)

A single repo file any agent reads before touching the database:

- Schema map: the 15 `research.*` tables, what each is for, the exact columns.
- Hard rules restated for agents: `research.*` writes only, `public.*`
  read-only, PHI never enters the database, consent fields on journal/uploads.
- Copy-paste-safe SQL patterns for the common actions: add note, add journal
  entry (with consent fields), add task, add/link mind map node, search docs.
- Tagging convention: agent-created rows get `"agent"` in their `tags` array
  (notes, journal, uploads) so you can always tell what you wrote vs. what an
  agent wrote. Mind map nodes get `origin: "agent"` in their JSON — nodes are
  free-form JSONB, so **no migration needed**.

This makes the today-path (SOS SUPABASE connector from Cowork/Claude.ai) safe
and immediately useful while Phase 2 gets built.

## Phase 2 — SOSPHD MCP server (the real interface, 1–2 sessions)

A small TypeScript server in `mcp/` using the official MCP SDK, run locally
(stdio). It signs in to Supabase **as you** — credentials from a gitignored env
file — so RLS applies to every query and the service-role key is never involved.

Proposed tools (~14, all thin wrappers over the existing data layer):

| Area | Tools |
|---|---|
| Notes | `create_note`, `search_notes` |
| Journal | `add_journal_entry` (consent fields required), `list_recent_journal` |
| Tasks | `add_task`, `complete_task`, `list_open_tasks` |
| Contacts | `search_contacts`, `add_contact` |
| Mind maps | `list_mind_maps`, `add_mind_map_node` (auto-placed, typed, linkable in one call), `link_mind_map_nodes` |
| Docs | `search_docs`, `append_to_doc` (creates a version, never overwrites) |
| Baseline (read-only) | `get_baseline_stats` (counts, corridors, payers, missingness) |

How each surface connects:

- **Claude Code**: `.mcp.json` in the repo — works the moment you open the repo.
- **Cowork**: add as a custom connector (command + args pointing at the server).
- **OpenClaw**: register in its MCP server config; then "note this down" from
  WhatsApp/Telegram lands in `research.notes`, tagged `agent`, visible in
  `/workspace` next time you open the app.
- **Claude.ai web**: needs Phase 3 (remote), or keeps using the SQL connector
  with the Phase 1 guide.

Small UI additions in the same phase: an "agent" badge on notes/journal
entries/mind-map nodes carrying the tag, so agent-written content is visible at
a glance in the app.

## Phase 3 — remote endpoint (optional, only if Phase 2 proves out)

Host the same tools over streamable HTTP at `/api/mcp` on the deployed app,
bearer-token auth. That unlocks claude.ai web and phone use with no laptop
running. Real auth-hardening work — do it only once Phase 2 is habit.

## What this unlocks, concretely

- From Cowork while writing: *"Pull this week's journal entries and draft the
  field-log section; add a task to chase the Krabi clinic agreement."*
- From OpenClaw on your phone after a meeting: *"Met Dr. Somchai, ED head at
  Bangkok Hospital Samui — add to contacts, corridor Koh Samui → Bangkok, task
  to follow up Friday."*
- Mind maps become a live thinking surface: *"Add what we just discussed as
  question nodes under 'Paper 2 — operator trust' and link them to the
  intervention-classifier node."*
- Weekly: *"Summarize journal + baseline movement into the weekly digest doc."*

## Guardrails (unchanged, non-negotiable)

- Writes to `research.*` only; `public.*` stays read-only; SOSPHD never creates
  operational cases.
- PHI rules hold for agents exactly as for the app: no patient names/DOB ever.
- No `SUPABASE_SERVICE_ROLE_KEY` anywhere — the MCP server authenticates as
  you, so RLS is the enforcement, not politeness.
- Agent-created content is always tagged (`tags: ["agent"]` / `origin: "agent"`).

## Decision needed from you

1. Greenlight Phase 1 + 2 as scoped? (Phase 3 stays parked.)
2. Which surface do you want wired first — Cowork or OpenClaw? That decides
   which connection config gets written and tested first.
