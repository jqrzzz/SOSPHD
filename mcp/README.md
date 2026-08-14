# SOSPHD MCP server

Your personal bridge between the research database and any MCP-speaking
agent — Claude Code, Claude Cowork, OpenClaw, Claude Desktop. Single-user by
design: it signs in to Supabase **as you**, so RLS enforces every boundary
and no service-role key exists anywhere.

23 tools.

*Research workspace* — `create_note`, `search_notes`, `add_task`,
`list_open_tasks`, `complete_task`, `add_journal_entry`,
`list_recent_journal`, `add_contact`, `search_contacts`, `list_mind_maps`,
`add_mind_map_node`, `link_mind_map_nodes`, `search_docs`,
`list_doc_annotations`, `append_to_doc`, `get_baseline_stats`.

*Admissions* — `list_institutions`, `get_institution`, `add_institution`,
`add_requirement`, `update_institution_stage`, `draft_outreach`,
`list_outreach`. Requirements demand a `source_url`; `verified` may only be
set after reading the official page for the current cycle. Outreach is saved
as a draft — the server has no send capability by design.

*Funding* — `list_funding`, `add_funding_opportunity`, `update_funding_stage`,
`draft_funder_outreach`. Every opportunity is classified by eligibility
(`a_open_now` / `c_company_eligible` / `b_needs_affiliation`) because most
research funding requires an academic host institution the owner does not yet
have. Funder approaches are drafts too.

Everything an agent writes is tagged (`tags: ['agent']`, mind-map nodes get
`origin: "agent"`) so you can always tell your writing from an agent's. The
rules all agents follow are in the repo root `AGENTS.md`.

## Setup (one time, ~2 minutes)

```bash
cd mcp
pnpm install
cp .env.example .env.local     # then fill in:
```

`.env.local` needs four values (the file is gitignored — it never leaves
your machine):

- `SOSPHD_SUPABASE_URL` + `SOSPHD_SUPABASE_ANON_KEY` — same values as the
  app's `NEXT_PUBLIC_SUPABASE_*` pair. If the repo root `.env.local` already
  has them, you can leave these two blank — the server falls back to reading
  the root file.
- `SOSPHD_EMAIL` + `SOSPHD_PASSWORD` — your SOSPHD login. This is how the
  server acts *as you* (RLS-scoped) instead of as an admin.

Verify without touching the database:

```bash
pnpm run smoke      # boots the server, checks the 15 tools respond
```

Then a real end-to-end check: connect a client (below) and say
*"create a note saying MCP is live"* — it should appear in `/workspace`.

## Connecting clients

**Claude Code** — nothing to do. The repo root `.mcp.json` registers the
server; open the repo and approve it when prompted.

**Claude Cowork / Claude Desktop** — Settings → Connectors (or Developer →
Edit Config) → add a local MCP server:

```json
{
  "mcpServers": {
    "sosphd": {
      "command": "pnpm",
      "args": ["--dir", "/ABSOLUTE/PATH/TO/SOSPHD/mcp", "run", "start"]
    }
  }
}
```

**OpenClaw** — add the same command under its MCP servers config, e.g.:

```json
{
  "mcpServers": {
    "sosphd": {
      "command": "pnpm",
      "args": ["--dir", "/ABSOLUTE/PATH/TO/SOSPHD/mcp", "run", "start"]
    }
  }
}
```

(Exact config location depends on your OpenClaw install; it speaks standard
MCP stdio, so any client that can launch a command works.)

## What it will refuse / never do

- No writes outside `research.*` — the signed-in role plus RLS make
  operational tables unreachable for writes, not just discouraged.
- No PHI — tool descriptions instruct agents to never pass patient names,
  DOBs, or passport numbers; case identity is `patient_ref` pseudonyms.
- No consent guessing — journal entries require an explicit
  `consent_status`; `obtained` additionally requires the method.
- No doc overwrites — `append_to_doc` only appends and snapshots a version.
- No remote endpoint — stdio only, runs on your machine, dies with it.

## Development

```bash
pnpm run typecheck   # tsc over src/
pnpm run smoke       # protocol-level smoke test, no credentials needed
```

Pure helpers (`src/helpers.ts` — placement, tagging, search sanitizing) are
unit-tested by the repo root test run (`pnpm test` at the root).
