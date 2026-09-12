# Fieldwork reliability: Codex handoff

## Scope and baseline

Based on main `7709e6d917d5218df2fc73ff18b92c96bed015b4`. Repair the existing
Field Journal, not a new Laos module or study. The separate consent/research-use
PR follows this work. PR #32 is independent and not silently incorporated.

## Changes

- The journal reads an explicit authenticated, allowlisted owner page. Search,
  exact-tag, entry-type and pinned filters execute before offset paging. Matching
  inventory counts are exact for that read; site/corridor counters say "on this page".
- Unavailable/unauthorized/malformed reads are not successful empty journals.
  Contacts and checklist support have a separate error state and visible bounds.
  Legacy store getters remain unchanged for compatibility.
- New-entry forms unmount after confirmed success and refresh the newest list.
  Normal submit handling prevents uncontrolled-form clearing on failed saves.
- A client-held UUID identifies each submitted entry. An INSERT is followed by
  an owner-scoped readback. Identical retries recover saved content; conflicting
  content is never overwritten. No UPDATE, upsert or deduplication is introduced
  in journal creation. Database primary-key uniqueness resolves concurrent retries.
- Unconfirmed submissions retain their exact payload and ID in the tab. The user
  may retry or explicitly export a private working copy. Inputs lock while the
  outcome is uncertain; closing/reloading still needs care and is warned about.
- Pin and checklist actions return controlled failures. Checklist save keeps local
  progress and existing notes on failure. Creation failure requires refreshing and
  reviewing the active list before deliberately starting another checklist.

The existing visual structure and tables are retained. No new schema, packages,
AI calls, study definitions or source records. Item-note editors, mobile checklist
picker and Laos-specific fields are deferred. No historical row is relabelled.

## Boundaries worth challenging

This is a live paginated inventory, not a frozen research census. Concurrent inserts
can move offset pages; refresh and repeat a search rather than treating page traversal
as a snapshot. Unexpected short responses fail visibly instead of skipping records.
Contact/template/active lists are limited to 100 with declared counts.

Journal retry identity excludes database receipt timestamps and subsequent pin state.
The legacy consent timestamp is still stamped by the prior action in this PR; the
follow-up consent contract corrects that separately. Other submitted fields must match.
A private export is not a database save or automatic restore/import feature.
Checklist creation is not idempotent: its recovery is deliberately manual review, not
an automatic second INSERT. Existing journal update/delete paths are not made
version-preserving by these changes and no bulk editing surface is added.

The strict read path confirms authentication and the research allowlist, then adds an
owner predicate. Existing database RLS remains necessary; mock tests do not validate it.

## Verification procedure

Run `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm lint` and `pnpm build`.
The new suites under `lib/fieldwork/__tests__` cover capture identity, readback,
concurrency, owner filtering, paged queries, malformed data and action failures.

`python scripts/browser/fieldwork_acceptance.py` runs the actual Next page/actions
against fictional loopback auth and REST persistence. It refuses local environment
files and external targets. Test two consecutive saves, reload, older search/pins,
failed and interrupted saves, identical retry, unavailable reads and checklist failure.
Its browser results establish UI/integration behavior only, not real Supabase Auth,
PostgREST semantics, database constraints or RLS. A true isolated database acceptance
pass remains separate. Never use private live field notes for mutation tests.

An exact source archive and locked dependencies were temporarily staged through
read-only GitHub Actions for the egress-restricted session container. Those temporary
workflow steps were removed; final CI uploads only synthetic test receipts/screenshots.
Local browser navigation was blocked by the container's browser policy; no bypass was
attempted. Exact completed local/CI results belong in the PR against its final head.

## Preserve and hand off

Manual owner merge. No live research database, source ledger, manuscript, permissions
or production configuration changed during implementation. Standard Git preview
integration may run. Reverting the code requires no schema rollback; preserve any
newly captured journal records. Do not confuse this reliability work with research
consent clearance or scholarly validation.
