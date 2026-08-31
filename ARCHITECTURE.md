# SOSPHD — Architecture

Reference document for the SOSPHD codebase. Written to be searched: every section
names real files, real tables, and real functions. Where something could not be
verified from the source, it says so.

Companion documents that this file does **not** duplicate:

- `README.md` — bootstrap, env vars, how to run the gates.
- `CLAUDE.md` — ecosystem ownership rules and database boundaries.
- `docs/measurement-projection.md` — the reviewer-facing writeup of the metric projections.
- `docs/security-decisions.md` — SD-001/002/003, the deliberate security trade-offs.
- `docs/audit-action-plan.md`, `docs/backfill-plan.md`, `docs/quality-audit-plan.md` — historical audit records.
- `docs/agent-strategy.md` — the long-term product plan for the agent endpoint.

---

## 1. What this is

SOSPHD is a single-user research workbench for a PhD about tourist medical
emergencies in Southeast Asia. The thesis it supports is: *"Human-AI coordination
reduces measurable delay and access friction in tourist emergencies across
heterogeneous health systems."* The app does four things. It reads emergency-case
data produced by the operational Tourist SOS systems. It computes three time
metrics per case — TTTA (first contact → transport activated), TTGP (first contact
→ payment guaranteed), TTDC (first contact → definitive care started). It runs an
LLM recommendation engine over live cases and records whether a human operator
accepted or overrode each recommendation, which is the *intervention* the research
measures. And it holds the researcher's own working material: field journal,
contact network, markdown documents with version history, notes, tasks, mind maps,
and an AI advisor chat.

The user is one person: Juan Quiroz Jr. (`juanquirozjr@gmail.com`, hardcoded in
`lib/config.ts`). Everything is scoped to that assumption — the rate limiter is
in-process, the landing page says "Single-user research environment", and the
row-level-security allowlist is seeded with exactly one user id. The problem it
solves is that the raw evidence for a three-paper dissertation (case timestamps,
AI decisions, field notes) would otherwise live scattered across an operational
database, a spreadsheet, and a notes app, with no reproducible chain from
operational event to published number.

SOSPHD is **one of six apps sharing a single Supabase project**
(`jnbxkvlkqmwnqlmetknj`). It owns the `research.*` schema and is read-only against
`public.*`, which belongs to the operational apps (SOSCOMMAND, SOSWEBSITE,
SOSTRAVEL, SOSPRO, SOSSAFE). It does not create cases; cases originate in
SOSCOMMAND.

---

## 2. Stack

| Layer | Choice | Version (from `package.json`) |
|---|---|---|
| Framework | Next.js App Router | `next` 16.3.3 |
| UI runtime | React | 19.2.3 |
| Language | TypeScript, `strict: true` | 5.7.3 |
| Styling | Tailwind CSS + shadcn/ui over Radix | tailwindcss 3.4.17 |
| Database + auth | Supabase (Postgres) | `@supabase/supabase-js` 2.49, `@supabase/ssr` 0.6.1 |
| LLM | Vercel AI SDK | `ai` ^6.0.0, `@ai-sdk/openai` ^3.0.49, `@ai-sdk/react` ^3.0.0 |
| Validation | zod | ^3.24.1 |
| Charts | recharts | 2.15.0 |
| Animation | framer-motion | ^12.38.0 |
| Toasts | sonner | ^1.7.1 |
| Tests | Vitest (node environment) | ^4.1.2 |
| Package manager | pnpm | 10.33.0 |

`next.config.mjs` is empty — no custom webpack, redirects, headers, or image
config. CI (`.github/workflows/ci.yml`) runs Node 22 and four gates on every push
and PR: `pnpm run lint`, `pnpm exec tsc --noEmit`, `pnpm run build`, `pnpm test`.

**Hosting is not declared anywhere in the repository** — there is no
`vercel.json`, `Dockerfile`, or deploy workflow. Comments strongly imply Vercel
(`lib/ai/rate-limit.ts` says "owner-operated single-region Vercel deployment";
`lib/data/workspace-types.ts` says "Vercel Blob URL"), but the actual deployment
target is unclear — needs checking outside the repo.

---

## 3. Top-level layout

| Path | What lives there |
|---|---|
| `app/` | All routes. Pages are React Server Components unless marked `"use client"`; five API route handlers under `app/api/`. |
| `components/` | Feature components (case timeline, recommendation card, advisor chat, mind map canvas, dashboard widgets). |
| `components/ui/` | 49 shadcn/ui primitive files. Mostly generated; many are unused. |
| `components/motion/` | Four framer-motion wrappers: `count-up`, `fade-in`, `progress-ring`, `stagger`. |
| `hooks/` | `use-mobile.tsx` (used by `components/ui/sidebar.tsx`). |
| `lib/` | Everything non-visual: config, server actions, data layer, AI layer, agent layer, Supabase clients. |
| `lib/data/` | Read stores (`*-store.ts`), write paths (`*-mutations.ts`), types, metric math, analytics, backfill pipeline. |
| `lib/ai/` | Model routing, the auth/key/rate-limit gate, prompt sanitizers, advisor prompt assembly. |
| `lib/agent/` | The "PhD agent" — deterministic, non-LLM: typed domain knowledge, tools, an action dispatcher, workflows. |
| `lib/supabase/` | Four Supabase entry points: browser client, server client, middleware proxy, server-side auth helper. |
| `supabase/migrations/` | Thirteen SQL files: the `research` schema, triggers on `public.*`, grants, consent, snapshots, and the storage bucket. |
| `docs/` | Planning and audit markdown, plus `docs/ecosystem/` — copies of the five sibling repos' `CLAUDE.md`. |
| `scripts/` | `generate-types.sh` (Supabase type generation; its output directory `lib/types/` is not committed). |
| `public/` | PWA icons and `manifest.json`. |

---

## 4. Main flows

This is the core of the document. Each flow is traced from entry point to database.

### Flow 4.1 — Private sign-in and route protection

**Entry:** `app/page.tsx` (the only truly public page) links only to
`/auth/login`.

`app/auth/login/page.tsx` is a client component. It builds a browser Supabase
client via `lib/supabase/client.ts:createClient()` and calls
`supabase.auth.signInWithPassword({ email, password })` directly from the browser.
On success it does `router.push("/spine")` and `router.refresh()`. There is no
server action and no session endpoint — the Supabase JS client writes the auth
cookies itself.

`app/auth/sign-up/page.tsx` is a static closed-registration page and
`/auth/sign-up-success` redirects to sign-in. The application exposes no
`supabase.auth.signUp` call or owner-email placeholder. Hosted deployments must
also disable **Allow new users to sign up** in Supabase Auth settings; removing the
UI does not disable direct calls to the hosted Auth API. Even if that external
setting drifts, the research allowlist and RLS still deny research data (see §7).

Every request then passes through `proxy.ts`, which delegates to
`lib/supabase/proxy.ts:updateSession()`. That function refreshes the Supabase
session, then: if the path is not `/` and not under `/auth/`, and there is no
user, it redirects to `/`; if the path is `/` and there *is* a user, it redirects
to `/spine`. The matcher in `proxy.ts` excludes only `_next/static`,
`_next/image`, `favicon.ico`, and image extensions — so API routes and server
actions are covered too.

**Critical branch:** `updateSession` returns early *without any auth check* when
`NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is missing. See §8.1.

Sign-out lives in `components/app-shell.tsx:handleSignOut` — browser client
`signOut()`, then `router.push("/")`.

### Flow 4.2 — Listing cases (the unified read layer)

**Entry:** `app/cases/page.tsx`, an async server component.

It calls `lib/data/store.ts:getCases({ status, search })`. That function fans out
to two sources in parallel and merges them:

1. `getOperationalCases(status)` — `SELECT` from `public.cases` using the explicit
   column list `CASE_COLUMNS` (never `SELECT *`, deliberately, to avoid pulling
   PHI-adjacent columns). Rows are mapped by `toCase()`, which applies two lossy
   projections: `mapStatus()` collapses 19 operational statuses into
   `open | active | closed`, and `mapPriority()` collapses 4 priorities into
   `Severity` 1–4. When a status filter is supplied it is pushed to the database
   via `OP_STATUSES_BY_RESEARCH_BUCKET`, the hand-maintained inverse of
   `mapStatus`. `source` is set to `"operational"`.
2. `getResearchCases(status)` — `SELECT` from `research.cases`, mapped by
   `toResearchCase()`. These rows already use the research model, so the filter
   pushes down directly. `source` is set to `"historical"`.

`mergeAndFilterCases()` concatenates, sorts newest-first by `created_at`, and
applies the free-text search over `patient_ref` and `chief_complaint` **in
memory**. Both reads go through `lib/data/retry.ts:withSupabaseRetry`, which
retries up to 3 times with jittered backoff on 5xx/408/network errors and never
on 4xx.

The page then calls `getEventCountsByCaseIds(ids)` — one query against
`research.case_events` selecting only `case_id`, grouped in memory into a `Map`.
This replaced an N+1 count-per-case loop.

`mapStatus` and `mapPriority` are the measurement methodology Paper 1 cites. They
are documented in `docs/measurement-projection.md` and tested in
`lib/data/__tests__/store-projections.test.ts`.

### Flow 4.3 — Operational events flowing into the research spine (database triggers, no app code)

This flow has **no TypeScript in it at all**. It is entirely Postgres triggers,
defined in `supabase/migrations/20260402_003_auto_sync_triggers.sql` and
`supabase/migrations/20260519_006_case_events_dedup_and_triage.sql`.

When SOSCOMMAND (or any other app) writes to the operational tables, these
`SECURITY DEFINER` triggers fire and materialize rows into
`research.case_events`:

| Trigger | Fires on | Emits |
|---|---|---|
| `trg_case_created_to_research` | `AFTER INSERT ON public.cases` | `FIRST_CONTACT` at `intake_date` (fallback `created_at`) |
| `trg_case_status_to_research` | `AFTER UPDATE ON public.cases` | `DEFINITIVE_CARE_START` on `in_treatment`; `TRANSPORT_ACTIVATED` on `transport_arranged`; `DISCHARGE` on `discharged` |
| `trg_case_triage_to_research` | `AFTER UPDATE OF triage_at ON public.cases` | `TRIAGE_COMPLETE` at `triage_at` |
| `trg_gop_approved_to_research` | `AFTER UPDATE ON public.guarantees_of_payment` | `GUARANTEED_PAYMENT` when status becomes `approved`/`partially_approved` |
| `trg_episode_started_to_research` | `AFTER UPDATE ON public.case_episodes` | `FACILITY_ARRIVAL` for hospitalization/surgery/emergency episodes; `TRANSPORT_ACTIVATED` for transport/repatriation episodes |

All of them go through `research.upsert_case_event()`, which since migration 006
uses `INSERT ... ON CONFLICT ON CONSTRAINT case_events_dedup_unique DO NOTHING`.
The constraint is `UNIQUE (case_id, event_type, occurred_at, actor_id)`. Because
the functions are `SECURITY DEFINER`, they bypass RLS — which is why tightening
the `research.case_events` policies in migration 008 did not break the sync.
Migration `20260830100628` restores that atomic writer after migration 020
temporarily regressed it, gives all six internal writers an empty `search_path`,
and removes direct execution from `PUBLIC`, `anon`, and `authenticated`. Trigger
execution still works; Data API clients cannot call the writers as RPCs.

Trigger-written rows carry `actor_id` = the case owner's UUID or the literal
`'system'`. Backfilled rows carry `actor_id = 'historical_backfill'`. Operator-typed
rows carry the signed-in user's UUID. That field is how you tell the three
provenance sources apart.

### Flow 4.4 — An operator adds a timeline event by hand

**Entry:** `components/event-form.tsx` on `/cases/[id]`, a client component using
`useActionState(addEventAction, null)`.

`lib/actions.ts:addEventAction` parses the FormData with `addEventSchema` (zod:
`case_id`, `event_type` from the `EVENT_TYPES` enum, `occurred_at`, `payload`),
then calls `lib/data/store.ts:addEvent()`. `addEvent` creates a cookie-aware
server client, resolves the actor with
`data.actor_id ?? userData.user?.id ?? "system"`, and inserts into
`research.case_events`. The action then calls `revalidatePath("/cases/${id}")`
and returns `{ success: true }`.

Two things about this path are worth knowing before you touch it: it performs
**no explicit auth check** (it relies on middleware plus the RLS policy
`Allowed users insert case_events`), and it has **no try/catch** — so a database
error thrown by `addEvent` escapes as an unhandled server-action exception
instead of the `{ error }` envelope the form is written to render.

### Flow 4.5 — Generating AI recommendations for a case (Paper 2, part 1)

There are two entry points into the same engine. Both use the same research-user,
provider-key, and rate-limit gates before the engine can receive an issued usage
grant.

**Path A — the button.** `components/generate-recommendations-button.tsx` calls
the server action `lib/actions.ts:generateRecommendationsAction(caseId, count)`.
The action checks the research allowlist, validates arguments, checks provider
configuration/rate budget, then calls
`lib/recommendations.ts:generateRecommendationsForCase` with the issued grant.

**Path B — HTTP.** `POST /api/recommendations/generate`
(`app/api/recommendations/generate/route.ts`) checks the research allowlist,
reads at most 32 KiB of JSON, validates the body, then checks provider
configuration/rate budget and calls the same engine with the issued grant.

Inside `generateRecommendationsForCase` (`lib/recommendations.ts`):

1. `assertAIUsageGrant(..., "recommendations")` rejects accidental internal
   callers that bypass the centralized gate.
2. `getCaseById(caseId)` and `getEventsByCaseId(caseId)` from `lib/data/store.ts`.
3. `formatCaseContext()` builds a bounded markdown block: case header, at most
   20 earliest/latest events with `occurred_at`, and the three computed metrics from
   `lib/data/metrics.ts:computeAllMetrics`. All operator-authored free text
   (`chief_complaint`, `notes`, event `payload`) goes through
   `lib/ai/sanitize.ts:safeFreeText`, which clips to 2000 chars and neutralizes
   `<case>` / `</case>` tags so a crafted string cannot break out of the prompt
   envelope.
4. `generateText()` from the AI SDK with `model: modelFor("recommendations")`,
   `Output.object({ schema: recommendationSchema })`, an explicit output cap, and
   `SYSTEM_PROMPT`, which quotes SOSPHD Intervention Protocol `PROTOCOL_VERSION`
   (`lib/protocol.ts`, currently `v0.1`) verbatim — the allowed categories and the
   confidence policy.
5. The AI SDK validates the structured response with `recommendationSchema`
   (1–5 items, bounded text, confidence 0–1, category enum). Invalid output becomes
   a controlled 502. Logs contain only an error code, never raw model text, case ID,
   or parser text.
6. Each item is persisted by `createRecommendation()` into
   `research.recommendations` with
   `engine_version = "llm-paper2-v0.1/${category}"` — plus a `/historical`
   suffix when `caseRow.source === "historical"`. That suffix is decision QD-1:
   Paper 2's intervention set is defined as recommendations *without* it. Pinned
   by `lib/__tests__/recommendations-tagging.test.ts`.

New rows land with `accepted = null` (pending).

### Flow 4.6 — Operator accepts or overrides a recommendation (Paper 2, the core mechanism)

**Entry:** `components/recommendation-card.tsx` on `/cases/[id]`. "Accept" fires
immediately; "Override…" opens a dialog that requires a written reason before the
submit button enables.

`lib/actions.ts:decideRecommendationAction(recommendationId, decision, reason)`:

1. Re-reads the recommendation with `getRecommendationById`; refuses if it is
   missing or already decided.
2. Refuses an override with an empty reason.
3. Resolves the authenticated user via the server Supabase client. If there is no
   user it returns an error explicitly citing Paper 2 provenance — this action
   will not write a decision without a real operator id.
4. Calls `lib/data/store.ts:decideRecommendation(id, accepted, reason, actorId, decidedAt)`.
   The `UPDATE` carries `.eq("id", id).is("accepted", null)` — an **atomic
   check-and-set**. Two concurrent decisions cannot both win; the loser gets zero
   rows back and throws `RecommendationAlreadyDecidedError`.
5. Calls `addEvent()` to write a second, immutable record: a `NOTE` event on
   `research.case_events` whose `payload` is JSON with
   `kind: "rec_decision"`, the recommendation id, engine type/version, confidence,
   the decision, the override reason, and the recommendation text.
6. `revalidatePath("/cases/${case_id}")`.

The same fact is therefore stored twice on purpose: denormalized columns
(`accepted`, `override_reason`, `decided_by`, `decided_at`) for querying, and the
`NOTE` event for the immutable timeline. Migration
`20260516_005_recommendations_decision_audit.sql` added the columns, backfilled
them from existing `NOTE` payloads, and added a CHECK constraint enforcing the
invariant: either all three of `accepted`/`decided_by`/`decided_at` are NULL, or
none of them are.

### Flow 4.7 — Paper 1 dashboard and CSV export

**Entry:** `app/dashboard/page.tsx`, an async server component.

It awaits five things in parallel: `getDashboardSummary()` and
`getCaseMetricRows()` from `lib/data/analytics.ts`, plus `getResearchPulse()`,
`suggestNextActions(5)`, and `detectGaps()` from `lib/agent`.

`lib/data/analytics.ts` carries an explicit performance contract stated in its
header: **every aggregator uses exactly three database round-trips regardless of
dataset size** — `getCases()`, `getAllCaseEvents()`, `getAllRecommendations()`.
Everything after that is in-memory grouping by `case_id`. The pure halves
(`computeDashboardSummary`, `computeCaseMetricRows`, `computePaper2Coordination`)
are exported separately so a single fetched batch can feed several aggregators;
`buildPaperContext()` uses that to avoid re-querying.

Metric math lives in `lib/data/metrics.ts` and is deliberately simple for
auditability. `findEvent()` returns the **first** event of a type (the array is
sorted `occurred_at` ascending upstream), so for multi-leg journeys only the first
leg counts — a documented measurement assumption. `computeInterval()` returns
`value_ms: null` when the start milestone is missing, and when the *end* is
missing it returns elapsed-so-far with `is_running: true`.

Aggregators exclude `is_running` rows from means and medians.

`components/dashboard-export.tsx` turns `CaseMetricRow[]` into a client-side CSV
download (minutes, not milliseconds).

`app/dashboard/paper2/page.tsx` calls `getPaper2Coordination()`, which produces
the Paper 2 figure set: overall accept rate, mean/median time-to-decision
(`decided_at - created_at`), a breakdown by `engine_version`, four confidence
calibration buckets (0–25/25–50/50–75/75–100%), a severity breakdown, and the 20
most recent override reasons.

### Flow 4.8 — The AI advisor chat

**Entry:** `components/advisor-chat.tsx`, using `useChat({ id: sessionId })`
from `@ai-sdk/react` with a `DefaultChatTransport` pointed at `/api/advisor`.
The request body carries only the chat ID and messages; the session ID scopes
ephemeral client state and is not persisted by the route.

`app/api/advisor/route.ts:POST`:

1. Checks authentication plus `research.is_allowed_user()`.
2. Reads at most 32 KiB, validates the UI-message envelope, then checks the
   provider key and 30/min process-local budget.
3. Builds four context sources in parallel: `buildContextSnapshot()`
   (`lib/data/context-builder.ts`), `getResearchPulse()`, `suggestNextActions(5)`,
   `detectGaps()`.
4. `buildContextSnapshot` itself is 4 queries flat: `getCases()`,
   `getAllCaseEvents()`, `getTasks({limit:5})`, `getNotes(5)`. It groups events by
   case in memory, computes metrics for the active case, and derives
   missing-milestone lists for every non-closed case.
5. `lib/ai/advisor-prompt.ts:formatContextForPrompt` and `formatAgentInsights`
   render those into text. **Every human- or model-authored string is passed
   through `sanitizeForContext`** — chief complaints, task titles, note titles and
   bodies, gap strings. That module exists as its own file specifically so it can
   be unit-tested (`lib/ai/__tests__/advisor-prompt.test.ts`); Next.js route
   handlers can only export HTTP verbs, so the functions were untestable while
   they lived in the route.
6. The prompt includes at most 20 illustrative missing-milestone rows and the
   complete evidence block is capped at 64 KiB.
7. `streamText()` uses an explicit output cap and the request abort signal, then
   returns `toUIMessageStreamResponse`. There is no `onFinish` callback:
   streaming text is provisional and creates no task, assistant-message row, or
   stored context snapshot.

### Flow 4.9 — Paper builder (drafting a paper section from live data)

**Entry:** `components/paper-builder.tsx` → `fetch("/api/paper-builder")`.

`app/api/paper-builder/route.ts` checks the research allowlist, enforces the
32-KiB request cap and 4,000-character custom-instruction cap, then applies the
tightest rate limit (5/min) before calling
`lib/data/analytics.ts:buildPaperContext()`. Aggregate facts remain complete;
only 20 rows may be included as illustrations, the evidence block is capped at
64 KiB, and generation has an explicit output ceiling.

`buildPaperContext` returns both raw `rows` and a `formatted` block of
pre-written English sentences — sample size, metric summary, payment-delay
finding, provenance summary, severity distribution — computed from the same three
queries. The route interpolates those plus a per-case raw metric table into the
prompt, alongside one of five section prompts (`methods`, `results`,
`discussion`, `abstract`, `full_draft`).

Researcher-supplied `custom_instructions` are wrapped in
`<user_suggestions>…</user_suggestions>` after `neutralizeTag`, and the system
prompt contains an explicit instruction hierarchy: user suggestions are style
preferences only and may never override the section structure, the numbers, or
the no-fabrication rule.

### Flow 4.10 — Writing and versioning a research document

**Entry:** `/docs` (`app/docs/page.tsx`) lists documents from
`lib/data/docs-store.ts:getDocs()`. `/docs/new` posts to
`lib/docs-actions.ts:createDocAction`, which slugifies the title, calls
`lib/data/docs-mutations.ts:createDoc` (auth via `requireAuthOrThrow`), and
`redirect()`s to the new document.

`/docs/[id]` renders `components/doc-editor.tsx` (a client component that
debounces edits by 1500ms and calls `updateDocAction`), plus
`components/doc-ai-tools.tsx` and `components/doc-versions.tsx` in a sidebar.

Versions are **explicit, not automatic**: `saveVersionAction` snapshots the
document's *current* `content_md` into `research.doc_versions`.
`restoreVersionAction` first snapshots the current state (note:
`"Auto-saved before version restore"`) and then overwrites `content_md`.

`components/doc-ai-tools.tsx` posts to `/api/docs/ai`
(`app/api/docs/ai/route.ts`) with `{ doc_id, mode, selection_text? }`. Five modes:
`summarize`, `rewrite`, `outline`, `extract_tasks`, `one_pager`. Title and content
go through `sanitizeForDocument` and into a `<document title="…">…</document>`
envelope. Requests are capped at 32 KiB, document evidence at 64 KiB, and model
output explicitly. `extract_tasks` uses `Output.object` for schema validation
and returns provisional suggestions only; it never inserts an operational task.

### Flow 4.11 — Field journal capture (a browser-side read path)

`app/fieldwork/page.tsx` and `app/contacts/page.tsx` are the only two **client**
pages that read data. They call `lib/data/fieldwork-store.ts` functions directly
from the browser in a `useEffect`, which works because that store uses the browser
Supabase client and the browser has the session cookies.

Writing goes the other way: `lib/fieldwork-actions.ts:createJournalAction`
zod-validates, splits comma-separated tags and contact ids, and calls
`lib/data/fieldwork-mutations.ts:createJournalEntry`, which uses
`requireAuthOrThrow` and inserts into `research.journal_entries`.

Before submitting, the form calls `lib/agent/categorize.ts:autoCategorize` on
blur. That is a **pure keyword matcher, not an LLM** — it suggests an entry type,
a corridor (matched against `RESEARCH_DOMAIN.corridors`), and tags from a
hardcoded pattern table (insurance, transport, language-barrier, payment-delay,
methodology, ethics, data-source).

### Flow 4.12 — The agent API (`/api/agent`)

`app/api/agent/route.ts` exposes the deterministic agent to external callers.
`GET` returns `getAgentCapabilities()` — thesis, action list, tool schemas,
corridor names, metric keys, and a `contractProtocol` descriptor. `POST` takes
`{ action, params?, caller? }`, validated against a 10-value action enum. Both
verbs require a signed-in `research.allowed_users` member; POST also enforces
the shared 32-KiB request limit before action validation/execution.

`lib/agent/core.ts:executeAgent` maps the action to one or more tool names via
`ACTION_TOOL_MAP`, executes them, and attaches a human summary and follow-up
suggestions. There is **no LLM in this path** — `lib/agent/tools.ts` is eight
plain async functions over the data layer (`get_research_status`,
`identify_research_gaps`, `compute_case_metrics`, `categorize_text`,
`create_task`, `create_note`, `analyze_corridor_coverage`,
`generate_weekly_digest`). `lib/agent/domain.ts` is typed constant data: the
thesis, the three papers with their data needs, the three metric definitions, the
six corridors with characteristics and known bottlenecks, and the event taxonomy.

`lib/agent/workflows.ts` wraps `executeAgent` for in-app use: `detectGaps`,
`getResearchPulse` (a 0–100 health score), `suggestNextActions`,
`getCorridorBriefing`. These are consumed by `/dashboard`, `/dashboard/corridors`,
`/dashboard/digest`, `/spine`, and `/advisor`.

### Flow 4.13 — Historical backfill (built, not wired up)

`lib/data/backfill/` implements the ingest half of importing 843 historical cases
(2018–2023) that currently live in an external spreadsheet:

- `types.ts` — `HistoricalCaseInput`, the contract a future spreadsheet parser
  must satisfy. It carries no PHI by design; `patient_ref` is a pseudonym.
- `normalize.ts` — pure mappers: `normalizePayer` (a seed alias map intended to
  collapse 448 insurer strings to ~30), `bucketDiagnosis` (keyword → coarse
  category), `mapHistoricalStatus`, `mapHistoricalSeverity`.
- `transform.ts` — `historicalCaseToRows()`, pure: one `research.cases` row plus
  one derived `case_event` per present milestone timestamp, plus a `missing[]`
  list feeding the missingness log. Tested in `__tests__/transform.test.ts`.
- `ingest.ts` — `ingestHistoricalCases()`, server-only, idempotent. It dedups
  cases on `(source, external_ref)` with a pre-check and dedups events by
  upserting with `onConflict: "case_id,event_type,occurred_at,actor_id",
  ignoreDuplicates: true`.

**`ingestHistoricalCases` has no caller.** There is no route, no server action, no
CLI script that invokes it. The missing piece is the spreadsheet parser, as
documented in `docs/backfill-plan.md`.

---

## 5. AI configuration and gating

`lib/ai/config.ts` is the single source of truth for which model each surface
uses. Five surfaces: `recommendations`, `advisor`, `paper_builder`,
`doc_assistant`, `categorize`.

Resolution order is `SOSPHD_MODEL_<SURFACE>` → `SOSPHD_MODEL_DEFAULT` → the
built-in default `openai:gpt-4o-mini`. Model ids are `provider:model`; only the
**first** colon splits, so fine-tune ids like `ft:gpt-4o:acme:1` work. A bare name
with no colon means `openai`. The per-surface env var names are **constructed at
runtime** from the surface id, so grepping the source for
`SOSPHD_MODEL_RECOMMENDATIONS` finds nothing — `.env.example` is the authoritative
list.

The `PROVIDERS` table names two providers. `openai` is wired. `anthropic` is
*named but has no `create` function* — requesting it throws
`ProviderNotInstalledError` with the exact `pnpm add @ai-sdk/anthropic` command,
rather than silently building an OpenAI request for a Claude model (which is what
the code did before). `requireAIKey(surface)` checks the credential for the
**resolved** provider, not `OPENAI_API_KEY` unconditionally.

`lib/auth/research-user.ts:requireResearchUser()` authenticates once, then calls
the database-owned `research.is_allowed_user()` function. Missing sessions return
401, non-allowlisted sessions 403, and lookup failures fail closed with 503.
`lib/ai/gate.ts` deliberately separates `gateResearchRequest()` from
`gateAIUsage()` so bounded body parsing and schema validation happen before
provider/key resolution or rate-budget consumption. The latter issues a
surface-bound grant required by the recommendation library.

`lib/ai/request-policy.ts` owns the 32-KiB streamed request limit, 4,000-character
custom-instruction limit, 20-row/64-KiB evidence limits, and explicit per-surface
output ceilings. It measures actual UTF-8 stream bytes rather than trusting
`Content-Length`.

`lib/ai/rate-limit.ts` is a sliding-window limiter in a module-level `Map` keyed
by `userId|surface`. Limits per minute: advisor 30, recommendations 15,
paper_builder 5, doc_assistant 30, categorize 60. Dead buckets are swept every 500
calls. The file documents its own limitation: state resets on cold start and is
not shared across regions or instances.

`lib/ai/sanitize.ts` holds the only defense against prompt-envelope breakout:
`neutralizeTag(text, tag)` rewrites `<tag>` / `</tag>` to `<_tag>` / `</_tag>`,
with three named wrappers — `sanitizeForContext` (advisor), `safeFreeText` (case
data, also clips to 2000 chars), `sanitizeForDocument` (docs).

---

## 6. Data model

SOSPHD owns the `research` schema. It reads `public.*` but never writes it.

### 6.1 The provenance spine — `research.case_events`

The most important table in the system. Columns: `id`, `case_id` (uuid — FK to `public.cases` existed undocumented from the original April migration until migration 015 dropped it on 2026-08-13; now deliberately **no foreign key**), `occurred_at`, `event_type` (enum), `actor_id` (text),
`payload` (text), plus `inserted_at` and `ingest_batch_id` added by migration 008.

`event_type` is an eight-value enum: `FIRST_CONTACT`, `TRIAGE_COMPLETE`,
`TRANSPORT_ACTIVATED`, `FACILITY_ARRIVAL`, `GUARANTEED_PAYMENT`,
`DEFINITIVE_CARE_START`, `DISCHARGE`, `NOTE`. All three metrics are intervals
between two of these. `NOTE` carries JSON audit records, including recommendation
decisions.

`actor_id` distinguishes provenance: a user UUID (operator-typed), the case
owner's UUID or `'system'` (trigger-synced), or `'historical_backfill'`.
`inserted_at` versus `occurred_at` distinguishes when a row entered the database
from when the event happened.

Unique constraint `case_events_dedup_unique` on
`(case_id, event_type, occurred_at, actor_id)`. Index on `(case_id, occurred_at)`.

### 6.2 The AI decision record — `research.recommendations`

Columns: `id`, `case_id` (uuid, no FK), `created_at`, `engine_type` (enum:
`rule_based | ml_model | llm`), `engine_version` (text — carries the category and
the `/historical` tag), `confidence_type` (`probability | categorical`),
`confidence_value` (double), `recommendation`, `explanation`, `accepted`
(boolean, NULL = pending), `override_reason`, `decided_by` (text), `decided_at`.

CHECK constraint `recommendations_decision_audit_check`: either
`accepted`/`decided_by`/`decided_at` are all NULL, or all non-NULL. Partial index
on `decided_at WHERE decided_at IS NOT NULL`.

Time-to-decision, which Paper 2 reports, is `decided_at - created_at`.

### 6.3 The research case dimension — `research.cases`

Added by migration 008 so historical data need not pollute the operational
database. Columns: `id`, `source` (enum `backfill_2018_2023 | prospective`),
`external_ref` (spreadsheet row id, for audit), `patient_ref` (pseudonym, never
PHI), `status` (CHECK: open/active/closed), `severity` (CHECK 1–4), `corridor`,
`payer_entity`, `diagnosis_bucket`, `country`, `incident_summary` (de-identified),
`intake_date`, `closed_date`, `created_at`, `ingested_at`, `ingest_batch_id`.

The read layer unions this with `public.cases` — see Flow 4.2.

### 6.4 The access allowlist — `research.allowed_users`

`(user_id uuid PK, note, added_at)`. RLS is enabled with **no application-facing
policy** — only the service role and `SECURITY DEFINER` functions can touch it.
`research.is_allowed_user()` is `STABLE SECURITY DEFINER SET search_path = ''` and
returns whether `auth.uid()` is in the table. This is SD-001 Option B.

### 6.5 Researcher-owned tables (all user-scoped by `auth.uid() = user_id`)

| Table | Holds |
|---|---|
| `research.docs` | Markdown documents: `title`, `slug`, `folder`, `tags[]`, `content_md`, `status` enum, `linked_case_id` |
| `research.doc_versions` | Snapshots, FK to `docs` with `ON DELETE CASCADE` |
| `research.notes` | Quick notes: `title`, `content`, `tags[]`, `linked_case_id` |
| `research.tasks` | `status` enum (`todo/doing/done`), `priority` int (1 = highest), `due_date`, `linked_case_id` |
| `research.mind_maps` | `title` plus `nodes` and `edges` as JSONB |
| `research.uploads` | File **metadata only**: filename, mime, size, category enum, `url`, tags, links |
| `research.advisor_sessions` | Chat sessions |
| `research.advisor_messages` | `role` enum, `content`, `context_snapshot` JSONB; FK to sessions, CASCADE |
| `research.journal_entries` | Fieldwork: `entry_type` enum, title, content, location, corridor, tags[], `contact_ids[]`, `attachments` JSONB, `is_pinned` |
| `research.contacts` | Research network: name, `role` enum (11 values), org, contact channels including WhatsApp, corridor, `linked_journal_ids[]` |
| `research.protocols` | Field checklists: `status` enum (`template/in_progress/completed`), `sections` JSONB, `template_id` |

`research.advisor_messages` is the exception to the simple pattern: its policy
checks that `session_id` belongs to a session owned by `auth.uid()`.

### 6.6 Operational tables SOSPHD reads (owned elsewhere, never migrated here)

`lib/data/store.ts:getOperationalContext(caseId)` fires six parallel reads:
`public.case_status_history`, `public.case_activity_log` (last 10),
`public.case_transport` (most recent 1), `public.guarantees_of_payment`,
`public.insurer_interactions` (last 10), `public.claims` (last 5). Results feed
`components/operational-context-panel.tsx` on the case detail page. Errors are
swallowed (`.data ?? []`) and the panel reports `has_data: false`.

`getCases`/`getCaseById` additionally read `public.cases` joined to
`public.patients` for `medical_id`.

### 6.7 Migrations, in order

| File | What it does |
|---|---|
| `20260402_002_create_research_schema.sql` | A **stub**. Declares the schema and the enums, then describes the tables in comments only. |
| `20260402_003_auto_sync_triggers.sql` | `upsert_case_event()` and four triggers on `public.*`. |
| `20260516_004_research_schema_snapshot.sql` | The authoritative DDL: 10 tables, 7 enums, indexes, RLS policies, grants. Idempotent. |
| `20260516_005_recommendations_decision_audit.sql` | `decided_by`/`decided_at`, backfill from `NOTE` payloads, CHECK constraint. |
| `20260519_006_case_events_dedup_and_triage.sql` | Unique dedup constraint, `ON CONFLICT` upsert, `TRIAGE_COMPLETE` trigger. |
| `20260519_007_research_journal_contacts_protocols.sql` | `journal_entries`, `contacts`, `protocols` + their enums and policies. |
| `20260528_008_research_cases_allowlist.sql` | `allowed_users`, `is_allowed_user()`, `research.cases`, ingest provenance columns, RLS tightened from `USING(true)` to the allowlist. |

---

## 7. Auth and permissions

### 7.1 Authentication

Supabase Auth, email + password only. No OAuth, no magic links, no MFA. There is
one role in the application's own vocabulary — `"researcher"`, hardcoded in
`lib/config.ts` and in the advisor's context snapshot. There is **no roles table
and no role column anywhere**. Authorization is entirely: are you signed in, and
are you in `research.allowed_users`.

Four Supabase entry points, and which one you use matters:

| File | Client | Session source | Safe to import from |
|---|---|---|---|
| `lib/supabase/client.ts` | `createBrowserClient` | Browser cookies | Client components |
| `lib/supabase/server.ts` | `createServerClient` | `next/headers` cookies | Server components, actions, routes |
| `lib/supabase/proxy.ts` | `createServerClient` | Request cookies | `proxy.ts` only |
| `lib/supabase/db.ts` | Wraps `client.ts` | Browser cookies | Client components (`warnDegradedMode` moved to `lib/data/degraded.ts`) |

`lib/supabase/server-auth.ts` is the server-side gatekeeper. `requireAuthOrThrow()`
returns `{ supabase, userId }` or throws `AuthRequiredError` (status 401). Its file
header warns that importing it from anything reachable by a client component
poisons the client bundle with `next/headers`; that warning is the reason the
codebase splits every module into `*-store.ts` (reads) and `*-mutations.ts`
(writes).

### 7.2 Where enforcement actually lives

Four layers, in order of encounter:

1. **`proxy.ts` → `lib/supabase/proxy.ts:updateSession`.** Redirects any
   unauthenticated request away from any path that is not `/` or `/auth/*`.
2. **Server-side auth helpers.** Every function in `lib/data/*-mutations.ts` and
   `lib/data/backfill/ingest.ts` starts with `await requireAuthOrThrow()`.
   Every AI route, the recommendation server action, `/api/agent`, the external
   agent-contract handler, and the MCP session use the database-owned research
   allowlist before provider calls or research actions. Cached MCP sessions
   recheck membership on every tool call and clear the cache on denial.
3. **Postgres RLS.** RLS is enabled on all 13 `research` tables. Two patterns:
   - **Shared research spine** (`case_events`, `recommendations`, `cases`):
     `USING (research.is_allowed_user())`. Set by migration 008, which replaced the
     earlier `USING (true)`. `research.allowed_users` currently holds one row,
     seeded in the migration.
   - **User-scoped** (docs, doc_versions, notes, tasks, mind_maps, uploads,
     advisor_sessions, journal_entries, contacts, protocols):
     `FOR ALL USING (auth.uid() = user_id)`.
4. **Defense-in-depth query bounds.** Every user-scoped `UPDATE` and `DELETE` in
   the mutation files also appends `.eq("user_id", userId)`, so a misconfigured
   policy alone would not permit a cross-user write.

`SECURITY DEFINER` functions deliberately bypass RLS for two narrow reasons. The
five `research.on_*` trigger functions and `research.upsert_case_event` form an
internal-only operational sync chain. `research.is_allowed_user` is the one
authenticated RPC and returns only the current session's membership result.

Migration 009 replaced migration 004's broad grants with app-shaped DML grants
and removed anonymous table access. Migration `20260830100628` also revokes all
client table privileges on `research.allowed_users`; authenticated code reaches
that table only through `research.is_allowed_user()`.

There is deliberately **no `SUPABASE_SERVICE_ROLE_KEY`** anywhere in the codebase.
`.env.example` states this and says not to add one, because it would bypass every
policy above.

---

## 8. Rough edges

Read this section before changing anything. Nothing here is fixed in this
document — it is a description of what exists.

### 8.1 A missing env var silently disables all authentication — FIXED 2026-08-13

**Status: fixed.** `lib/env.ts:assertProductionEnv()` now throws in production
when `NEXT_PUBLIC_SUPABASE_*` is missing, called from
`lib/supabase/proxy.ts:updateSession` (every routed request) and
`lib/ai/config.ts:requireAuthenticatedUser` (every AI surface and `/api/agent`).
Dev/test keep the documented degraded mode. Original issue for the record:
three separate places treated "Supabase env vars are absent" as "development
mode, allow everything":

- `lib/supabase/proxy.ts:updateSession` returns before checking auth, so
  proxy stops redirecting.
- `lib/ai/config.ts:requireAuthenticatedUser` returns `{ id: "dev_user" }`, so
  `gateAIRequest` passes and every LLM endpoint becomes callable by anyone.
- `/api/agent` uses that same helper for both GET and POST.

Each site documents this as intentional for clean checkouts, and the comment says
"In production the env vars MUST be set, so this path is never reached." That is
an assumption, not an enforcement — nothing fails the build or the boot if
`NEXT_PUBLIC_SUPABASE_URL` is missing in a deployed environment. The result would
be an open, unauthenticated app with unbounded LLM spend, and the rate limiter
would key everything to the single bucket `dev_user`.

### 8.2 Four read stores use the browser Supabase client, including on the server — FIXED 2026-08-13

**Status: fixed.** `docs-store`, `advisor-store`, and `workspace-store` now use
the cookie-aware server client (`getServerSupabase`) and carry
`import "server-only"`, so any future client import is a build error.
`fieldwork-store` stays client-safe (it is imported by the `/fieldwork` and
`/contacts` client pages) and every read function accepts an optional trailing
`client` param; its server callers (`lib/agent/tools.ts`,
`lib/data/fieldwork-mutations.ts:createProtocolFromTemplate`) pass a server
client explicitly. Original issue for the record:

`lib/supabase/db.ts:getSupabase()` returns `createBrowserClient(...)`, which reads
its session from browser cookies. Four stores use it:
`lib/data/advisor-store.ts`, `lib/data/docs-store.ts`,
`lib/data/fieldwork-store.ts`, `lib/data/workspace-store.ts`. Only
`lib/data/store.ts` (cases, events, recommendations) uses the cookie-aware server
client.

For the two client pages (`/fieldwork`, `/contacts`) that is correct. But those
same stores are imported by **async server components** — `app/workspace/page.tsx`,
`app/docs/page.tsx`, `app/docs/[id]/page.tsx`, `app/advisor/page.tsx`,
`app/workspace/mindmap/[id]/page.tsx` — and by server-side code in
`lib/agent/tools.ts` (which `getResearchStatus`, `identifyResearchGaps`,
`analyzeCorridorCoverage`, and `generateWeeklyDigest` all run through) and by
`lib/data/fieldwork-mutations.ts:createProtocolFromTemplate`. On the server there
is no `document.cookie`, so those queries would carry no session and reach
Postgres as `anon`, which cannot satisfy `auth.uid() = user_id`.

If that is what happens, the consequences are: server-rendered `/workspace`,
`/docs`, and `/advisor` show empty lists; the agent's "research health score" and
gap analysis count zero journal entries, contacts, and docs; and "start protocol
from template" cannot find its template. **The import split is unambiguous in the
source; the exact runtime behaviour was not executed and needs checking before
acting on it.**

### 8.3 Seed data can be served as if it were real research data — FIXED 2026-08-13

**Status: fixed.** `lib/data/degraded.ts:seedOrEmpty` now returns EMPTY in
production and seed only in development, applied to every fallback return in
all four stores — including the by-id functions, whose silent
`catch { /* fall through */ }` blocks now emit `[SOSPHD:DEGRADED]` warnings.
Fabricated seed content can no longer render in a deployed environment.
Original issue for the record:

Every store carries a hardcoded seed array (`seedNotes`, `seedTasks`, `seedDocs`,
`seedJournal`, `seedContacts`, `seedProtocols`, `seedUploads`, `seedMindMaps`) —
fabricated PhD content including a full fake Paper 1 draft in
`lib/data/docs-store.ts`. List functions log `[SOSPHD:DEGRADED]` before falling
back. **The by-id functions do not.** `getDocById`, `getMindMapById`,
`getProtocolById`, `getContactById`, `getJournalEntryById`, and `getVersionById`
all use a bare `catch { /* fall through */ }` with no warning, then search the seed
array. A `.single()` query returning no rows produces an error, so any failed
lookup lands in the seed path silently. In a tool whose output feeds a
dissertation, a silent substitution of invented content for real content is a
data-integrity hazard, not just a dev convenience.

### 8.4 Raw search input is interpolated into PostgREST filter strings — FIXED 2026-08-16

Four places built an `.or()` filter by string interpolation
(`lib/data/docs-store.ts:getDocs`, `lib/data/workspace-store.ts:getUploads`,
`lib/data/fieldwork-store.ts:getJournalEntries` and `getContacts`). Not SQL
injection — PostgREST parses the string — but a search term containing a comma
or parenthesis changed the filter tree, and a crafted term could inject
additional predicates. RLS bounded the blast radius to the caller's own rows;
the filter was still attacker-controlled text.

Fixed with PostgREST's own escape hatch: values are double-quoted with `\"` and
`\\` escaping, built by `lib/data/pgrst.ts` (`orIlikeContains`), which is now
the only place these strings are constructed. The output format is pinned by
exact-string unit tests, and `scripts/verify-security-invariants.mjs` carries
matching parse probes against the live API — the unit tests pin helper→string,
the probes pin string→PostgREST, and a change to either side requires re-running
the other. The probes could not be run from the agent's container (egress-blocked
to supabase.co): **run `pnpm verify:security` once from a machine with access
before trusting search in production.** If a genuinely new search surface needs a
different filter shape, extend `pgrst.ts` and its tests — never interpolate.

### 8.5 The two paths into the recommendation engine are gated differently — FIXED 2026-08-13

**Status: fixed.** `generateRecommendationsAction` now applies the same
research-user, provider-key, and rate-limit gates as the HTTP route, and
`addEventAction` resolves the
operator explicitly (no more `actor_id = "system"` mislabeling for
unauthenticated callers) and returns `{ error }` envelopes instead of throwing
unhandled. Original issue for the record: the UI-button path reached the paid
LLM with no explicit auth check and no rate limit, relying entirely on the
request proxy.

### 8.6 The rate limiter does not work on serverless

`lib/ai/rate-limit.ts` stores state in a module-level `Map`. On any platform that
runs more than one instance, or that cold-starts frequently, the effective limit
is per-instance, not per-user. The file says so itself and suggests Upstash Redis
behind the same API. For an owner-operated single-user deployment this is
acceptable; it is not a control you can rely on.

### 8.7 `research.case_events.case_id` and `recommendations.case_id` have no foreign key

**Correction 2026-08-13:** `case_events.case_id` actually DID have an
undocumented FK to `public.cases` (with ON DELETE CASCADE) from the original
April migration — the repo snapshot omitted it and this document repeated the
omission. It surfaced during the first real backfill and was dropped by
migration `20260813_015` (it foreclosed research-native events and would have
cascaded operational deletions into research provenance). The no-FK design
below is now true by decision rather than by accident.

Deliberate — it allows research-native case ids that do not exist in
`public.cases`. The cost is silent data loss in analytics:
`computePaper2Coordination` does `const c = caseById.get(rec.case_id); if (!c) continue;`
and drops any recommendation whose case is not in the merged case list. Nothing
counts or reports those drops. Orphan events are likewise invisible.

### 8.8 `mapStatus` and `OP_STATUSES_BY_RESEARCH_BUCKET` must be edited together

`lib/data/store.ts` holds both the forward projection (19 operational statuses → 3
research states) and its hand-written inverse, used to push status filters down to
the database. They are kept in lockstep by a comment. If SOSCOMMAND adds a status
and only one is updated, filtered case lists silently return the wrong rows and
Paper 1's sample counts shift. Unknown statuses fall through to `"open"` with a
`[SOSPHD:UNKNOWN_STATUS]` console warning — a log line nobody may be reading.
`lib/data/__tests__/store-projections.test.ts` covers the symmetry.

### 8.9 A running metric's value is non-deterministic

`lib/data/metrics.ts:computeInterval` returns `Date.now() - start` when the end
milestone is missing, flagged `is_running: true`. Aggregators correctly exclude
those from means and medians — but `computeCaseMetricRows` puts the running value
into `ttta_ms`/`ttgp_ms`/`ttdc_ms` regardless, and
`components/dashboard-export.tsx` writes those straight to the CSV. Two exports
taken an hour apart will differ for open cases. The companion `*_complete` boolean
is the field to filter on.

### 8.10 The "Research Health" score is arbitrary

`lib/agent/workflows.ts:getResearchPulse` computes a 0–100 score as
`50 + min(20, entries*2) + min(15, coverage*15) + min(15, contacts*3) - highGaps*5`.
It is displayed as a large gauge on `/dashboard` and `/spine` and is fed into the
advisor's system prompt as "Research Health". It is not a validated measure of
anything and should not appear in a paper.

Relatedly, `lib/agent/domain.ts` hardcodes
`historicalData: { caseCount: 843, status: "pending_import" }`. Because that is a
constant rather than a database read, `identifyResearchGaps` emits a permanent
"843 historical cases not yet imported" high-severity gap that will never clear on
its own, even after a successful backfill.

### 8.11 Documentation and UI that describe a system that no longer exists — FIXED 2026-08-13

**Status: fixed.** `/guide` rewritten to match the real app (read-only cases,
consent-gated fieldwork, snapshots; renamed from "ResearchOS" to "SOS PHD");
`docs/agent-strategy.md`'s dead `lib/data/sync.ts` claim replaced with the
trigger migrations; the "when Supabase is connected" / "swap for Supabase
later" header comments corrected across `lib/data/*-types.ts`; the
`metrics.ts` dedup comment now states the real `(case_id, event_type,
occurred_at, actor_id)` constraint; README converted to pnpm and its
migration list completed; CLAUDE.md's wrong `lib/data/server-auth.ts` path
fixed. Original issue for the record:

- `app/guide/page.tsx` walks the user through "Click 'New Case' and fill in the
  details." `createCase` and the `/cases/new` route were deliberately deleted
  (audit Decision C — the placeholder `patient_id` violated a foreign key into
  SOSCOMMAND's `public.patients`). The guide was not updated.
- `docs/agent-strategy.md` lists `lib/data/sync.ts` as "✓ Live". That file was
  deleted when sync moved to database triggers.
- `lib/data/types.ts` opens with "When Supabase is connected, these become the Row
  types." Supabase is connected.
- `docs/audit-action-plan.md` carries a large banner explaining that its own body
  describes a repository that no longer exists. The banner is correct; read it
  before the body.

### 8.12 Unwired and duplicated code

- `lib/data/backfill/ingest.ts:ingestHistoricalCases` has no caller anywhere.
- `lib/agent/workflows.ts:handleAgentContract` — which validates that the calling
  system is one of the six SOS apps and now checks the research allowlist first —
  is exported and never used. `/api/agent` accepts `caller` as metadata.
- ~~`hooks/use-mobile.tsx` and `components/ui/use-mobile.tsx` are byte-identical.~~
  Fixed 2026-08-13: the unused `components/ui/use-mobile.tsx` copy is deleted.
- ~~Two toast systems ship.~~ Fixed 2026-08-13: the unused
  `hooks/use-toast.ts` + `components/ui/toast.tsx` + `components/ui/toaster.tsx`
  trio is deleted; sonner (mounted in `app/layout.tsx`) is the only one.
- ~~`next-themes` is a dependency that is never imported.~~ Fixed 2026-08-13:
  `next-themes` and the equally unused `@tailwindcss/postcss` are removed from
  package.json (`server-only` is now used by the three server-only stores). Dark
  mode is hardcoded as `<html className="dark">` in `app/layout.tsx`; there is no
  light theme and no toggle.
- `scripts/generate-types.sh` writes to `lib/types/`, which does not exist in the
  repo. No generated Supabase types are committed, so every row mapping in
  `lib/data/` is a hand-written `as` cast — a schema change will typecheck cleanly
  and fail at runtime.
- `Doc`, `ResearchNote`, and `ResearchTask` all carry a `site_id` field that no
  `research` table has. `lib/data/docs-store.ts:mapDbDoc` coerces it to `null`.

### 8.13 File uploads do not upload files — FIXED 2026-08-13

**Status: fixed.** Migration `20260813_013` created the private
`research-uploads` bucket with owner-folder RLS; `components/workspace-uploads.tsx`
now uploads the file first and only then persists metadata with the storage
path as `url` (legacy `"#"` rows are flagged as metadata-only), with downloads
via short-lived signed URLs. Original issue for the record:

`components/workspace-uploads.tsx` reads a `File` from the input, extracts its
name, mime type and size into hidden fields, and posts a hardcoded
`<input type="hidden" name="url" value="#" />`. Only metadata is stored. The UI
says so ("File content is not uploaded"), but `research.uploads.url` is `NOT NULL`
and every row's value is `"#"`. No storage bucket is configured anywhere.

### 8.14 Smaller things a new person would get wrong on day one

- **Install with pnpm, not npm.** `README.md` says
  `npm install --legacy-peer-deps`; CI uses `pnpm install --frozen-lockfile`, and
  only `pnpm-lock.yaml` is committed. The CI file explains at length why.
- **There is more than one Supabase MCP connector configured.** `CLAUDE.md` warns
  to confirm `get_project_url` returns `jnbxkvlkqmwnqlmetknj.supabase.co` before
  applying any migration — the other connector points at a different SOS project.
- **Migration `20260402_002` is a stub.** Its body describes the tables in
  comments. `20260516_004` is the real snapshot. A fresh bootstrap depends on that.
- ~~`/protocol` and `/guide` have no `layout.tsx`.~~ Fixed 2026-08-13: both now
  wrap children in `AppShell` like every other authenticated route.
- ~~`package.json` is still named `"my-project"`.~~ Fixed 2026-08-13: renamed to `"sosphd"`.
- **Migration 008 commits a real user UUID** (`bb8a6e83-…`) into git as the seeded
  allowlist entry. Not a credential, but it is an identifier in version control.
- **`anon` grants on `research` — FIXED 2026-08-13** by migration
  `20260813_009_research_grants_normalization.sql`: `anon` now holds nothing in
  `research`, `authenticated` holds exactly SELECT/INSERT/UPDATE/DELETE (the
  original `GRANT ALL` had included TRUNCATE, which RLS does not govern — a
  table-wipe primitive for any authenticated user in the shared project). The
  same migration fixed a live bug: migrations 007/008 had never granted
  `journal_entries`, `contacts`, `protocols`, or `cases` to `authenticated` at
  all, so every fieldwork query failed at the grant layer and fell back to seed
  data. Migration `20260813_010` additionally makes decided recommendations
  immutable at the DB layer via a `BEFORE UPDATE` trigger.

### 8.15 PostgREST exposed schemas — the missing switch (found 2026-08-14)

**Every REST call to `.schema("research")` returns 406 until `research` is added
to the project's Exposed schemas list** (Supabase Dashboard → Project Settings →
Data API → "Exposed schemas"). Grants and RLS were verified correct; the API edge
logs showed all research-table requests (journal_entries, contacts, cases, notes,
tasks, docs, …) failing with 406 while public-schema requests returned 200 —
PostgREST refuses to address a schema it has not been told to serve. This was the
true root cause of "the app shows nothing real": dev masked it with seed
fallbacks, production rendered empty states. Diagnosing store code, grants, or
RLS for empty reads is wasted effort until this switch is checked. The setting is
platform config (not in the database), so no migration can fix it — it is a
one-time Dashboard action per project.

**Do not try to fix this from SQL.** PostgREST's in-database configuration
(`ALTER ROLE authenticator SET pgrst.db_schemas = …` + `NOTIFY pgrst, 'reload
config'`) was attempted on 2026-08-14 and had **no effect** — Supabase serves
the exposed-schema list from platform config, and the override was reverted
rather than left as dangling state. The Dashboard toggle is the only path.

The app now detects this itself: `lib/data/health.ts` probes the research
schema, `/api/research-health` exposes the verdict, and
`components/research-api-banner.tsx` renders it at the top of every page.
PGRST106 gets the exact fix text. Zeros everywhere with no banner means a
genuinely empty database; zeros *with* the banner means this setting.

### 8.16 Test coverage

There are 32 Vitest files. In addition to measurement, analytics, prompt, retry,
and projection tests, the suite now covers the research-user gate, byte/evidence
limits, provider-zero-call rejection ordering, AI route and server-action
containment, provisional Advisor/Docs behavior, safe-log canaries, and MCP/agent
allowlist checks. These are mocked application contracts: there are still **no
live database contract tests, component tests, or end-to-end browser tests**.

### 8.17 Not every timestamp in `case_events` is a measurement (found 2026-08-16)

An event's `occurred_at` can mean three different things, and until migration
020 nothing recorded which. `research.case_events.resolution` now does:

- `measured` — an operational time of when the event happened (`cases.triage_at`,
  `case_episodes.start_date`, `cases.closed_date`).
- `entry` — `now()` at the moment a record was written. A real timestamp, of the
  data entry rather than the event. `TRANSPORT_ACTIVATED` and
  `DEFINITIVE_CARE_START` from a case-status change are both this.
- `date` — day resolution only. The entire 2018–2020 backfill, all 842 rows.

**Never difference two events without checking this.** Use
`research.case_intervals`, which returns NULL for any interval whose endpoints
are not both finer than a calendar day. Over the current registry it yields 835
rows and zero computable intervals — which is Paper 1's central result, and is
asserted by `scripts/verify-paper-figures.mjs`.

The audit that produced this found a live defect worth knowing about: the GOP
trigger read `COALESCE(NEW.issued_date::timestamptz, now())`, and
`guarantees_of_payment.issued_date` is a `date`, so it actively preferred
midnight over the timestamp it already had. TTGP would have been recorded at day
resolution and looked populated. Nothing had fired, so no data was affected.
Full detail, including two things deliberately *not* fixed here, is in
`docs/prospective-clock-audit.md`.

### 8.18 A bare catch was turning every data page into a static empty shell (found + fixed 2026-08-16)

`getServerSupabase` wrapped `createClient()` in `try { … } catch { return null }`.
`createClient()` awaits `cookies()`, and during `next build` the framework's way
of saying "this page must render per-request" is to **throw** from `cookies()` —
so the catch swallowed the signal, `getServerSupabase` returned null, the page
rendered its degraded-empty state, and Next happily prerendered that as static
HTML. Every store-backed page (`/apply`, `/dashboard/*`, `/spine`, `/funding`,
`/papers`, `/advisor`, `/workspace`) built as `○ static` and would serve an
empty shell in production — while looking perfectly healthy under `next dev`,
where everything renders per-request. The classic shape of this bug: invisible
in exactly the environment you develop in.

Two traps for whoever touches this next:

- **A local build cannot show you the bug or the fix.** Without `.env.local`,
  the env-var guard returns null before `cookies()` is reached, so every page
  is legitimately static-degraded locally. Verify with dummy env:
  `NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy pnpm build`
  and check the route table shows `ƒ` for data pages.
- **Do not re-add the catch.** The missing-env case is already handled
  explicitly above it; there is no other legitimate error to defend against,
  and the "defensive" catch was the entire bug.

`/contacts` and `/fieldwork` remain `○` on purpose — they are `"use client"`
pages that fetch in the browser, so a static shell is their design.

---

## 9. Where to start

| If you want to change… | Open first |
|---|---|
| What TTTA / TTGP / TTDC mean, or how they are computed | `lib/data/metrics.ts`, then `docs/measurement-projection.md` |
| How operational statuses map to open/active/closed | `lib/data/store.ts` (`mapStatus`, `mapPriority`, `OP_STATUSES_BY_RESEARCH_BUCKET`) |
| Which cases appear in the app | `lib/data/store.ts` (`getCases`, `getOperationalCases`, `getResearchCases`, `mergeAndFilterCases`) |
| What the AI recommends, or the engine prompt | `lib/recommendations.ts` (`SYSTEM_PROMPT`, `formatCaseContext`, `ENGINE_VERSION`) |
| The accept/override flow and its audit trail | `lib/actions.ts:decideRecommendationAction` → `lib/data/store.ts:decideRecommendation` |
| Which model any AI surface uses | `lib/ai/config.ts`; the env var names are listed in `.env.example` |
| Auth, key, or rate-limit behaviour on an AI endpoint | `lib/ai/gate.ts`, then `lib/ai/config.ts` and `lib/ai/rate-limit.ts` |
| Prompt-injection defenses | `lib/ai/sanitize.ts` and `lib/ai/advisor-prompt.ts` |
| Dashboard numbers, or a new aggregate figure | `lib/data/analytics.ts` — keep the three-round-trip contract |
| The Paper 2 figure set | `lib/data/analytics.ts:computePaper2Coordination` and `app/dashboard/paper2/page.tsx` |
| The advisor's context or system prompt | `app/api/advisor/route.ts` and `lib/data/context-builder.ts` |
| Route protection or the public/private boundary | `lib/supabase/proxy.ts` (`isPublic`), then `proxy.ts` |
| Who can read the research spine | `supabase/migrations/20260528_008_research_cases_allowlist.sql` and `research.allowed_users` |
| The database schema | `supabase/migrations/20260516_004_research_schema_snapshot.sql` (the snapshot), then the later migrations in order |
| Operational→research event sync | `supabase/migrations/20260402_003_auto_sync_triggers.sql`, `…_006_case_events_dedup_and_triage.sql`, `…_020_case_event_clock_resolution.sql` — **not** application code |
| Whether a coordination interval is real | `research.case_intervals` and the `resolution` column (§8.17); never difference `case_events` by hand |
| Search-term escaping for PostgREST or-filters | `lib/data/pgrst.ts` — the only place these strings are built (§8.4); verify with `pnpm verify:security` |
| Whether RLS / the allowlist / the security_invoker view still hold | `pnpm verify:security` — live behavioral probes, run after any migration touching RLS, grants, views, or triggers |
| What a school requires that nobody has established | `lib/data/admissions-coverage.ts` (`CANONICAL_REQUIREMENTS`) — a code taxonomy on purpose; per-school facts stay in the DB with `source_url`/`verified_at`. Findings in `docs/admissions-blindspots.md` |
| Which application work is shared vs repeated per school | the `scope` field on each canonical item, rolled up by `portfolioRollup` — one CV serves every school, one fee does not |
| Sidebar navigation | `components/app-shell.tsx` (`NAV_ITEMS`) |
| Dashboard sub-tabs | `components/dashboard-nav.tsx` (`TABS`) |
| The PhD phase tracker on `/spine` | `lib/data/phd-spine.ts` — plain data, `PHD_PHASES` and `OPEN_QUESTIONS` |
| The intervention protocol text | `app/protocol/page.tsx`; bump `PROTOCOL_VERSION` in `lib/protocol.ts` for material changes |
| Corridors, papers, or agent domain knowledge | `lib/agent/domain.ts` (`RESEARCH_DOMAIN`); corridor names are duplicated in `lib/config.ts` |
| Owner identity, app name, version | `lib/config.ts` (`APP_CONFIG`) |
| Adding an agent action or tool | `lib/agent/tools.ts` (`AGENT_TOOLS`), then `lib/agent/core.ts` (`ACTION_TOOL_MAP`, `AgentAction`) and `app/api/agent/route.ts` (`VALID_ACTIONS`) |
| Historical spreadsheet import | `lib/data/backfill/` — the parser is the missing piece; see `docs/backfill-plan.md` |
| Colors, spacing, dark mode | `app/globals.css` (HSL custom properties) and `tailwind.config.ts` |
