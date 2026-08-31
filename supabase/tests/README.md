# Disposable database contracts

This harness replays the SOSPHD migration chain against synthetic PostgreSQL
databases. It never connects to the hosted Supabase project and contains no
copied production rows, API keys, passwords, or service-role credentials.

## Run

Prerequisites:

- Node.js 22
- pnpm 10.33.0
- Docker Compose v2

From the repository root:

```sh
pnpm test:db
```

The command starts one digest-pinned PostgreSQL 15 container without publishing
a host port, creates isolated `fresh`, `upgrade`, and constraint-drift guard
databases, applies the fixture and migrations with `ON_ERROR_STOP`, runs the SQL
contracts, writes a
sanitized summary to `test-results/db-contract-summary.json`, and always removes
the container and its volume.

The historical migration filenames reuse date prefixes, so the runner applies
complete filenames in lexical order instead of treating the leading date as a
unique Supabase migration version. Do not rename the historical files.

## What the fixture represents

The fixture supplies only the platform contracts the migrations require:

- the `anon`, `authenticated`, and `service_role` roles;
- `auth.uid()` backed by synthetic JWT claim settings;
- minimal Storage tables and `storage.foldername()`;
- minimal, synthetic versions of the three sibling-owned `public.*` tables
  that already carry SOSPHD research triggers in the shared project.

Those `public.*` and `storage.*` objects exist only inside the disposable test
container. SOSPHD migrations remain restricted to `research.*` changes.

The contracts cover fresh replay, preservation of representative pre-existing
rows during an upgrade, RLS for ordinary and allowlisted identities, privileged
function ACLs and search paths, operational trigger behavior, exact-duplicate
deduplication, repeatable same-type events, recommendation immutability, and
fail-closed rejection when the live dedup constraint has drifted.

## Deliberate limits

This is a PostgreSQL contract harness, not a full local Supabase stack. It does
not emulate PostgREST schema exposure, GoTrue sign-in, Storage APIs, Realtime, or
the full schemas owned by sibling SOS applications. Those services are not
needed to prove the migration, RLS, function, trigger, and privilege behavior in
this change.

Passing these contracts does not authorize a hosted migration. Before any live
apply, perform a read-only catalog census of the exact project, compare function
owners/signatures/ACLs and trigger attachments, review a dry run, and obtain a
separate explicit approval.
