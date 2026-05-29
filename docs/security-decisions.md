# SOSPHD — Open Security Decisions

Decisions that affect production security posture but require explicit owner input. Each entry lists the issue, the options, the recommendation, and the threat model question that determines the answer.

---

## SD-001 — Cross-project access to `research.case_events` and `research.recommendations`

**Status**: ✅ RESOLVED via Option B (2026-05-28, migration `20260528_008`). An allowlist table `research.allowed_users` + `research.is_allowed_user()` (SECURITY DEFINER) now gates SELECT/INSERT/UPDATE on `case_events`, `recommendations`, and the new `cases` table. Owner seeded; the trigger sync path is unaffected (SECURITY DEFINER bypasses RLS). Verified with simulated-role transactions: allowlisted user sees rows, non-allowlisted user sees zero. Original analysis retained below for the record.

---

### Original analysis (Phase 7 audit, 2026-05-28)

### The issue

The RLS policies on `research.case_events` and `research.recommendations` are intentionally permissive:

```sql
CREATE POLICY "Authenticated read case_events" ON research.case_events
  FOR SELECT USING (true);
CREATE POLICY "Authenticated insert case_events" ON research.case_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated read recs" ON research.recommendations
  FOR SELECT USING (true);
CREATE POLICY "Authenticated insert recs" ON research.recommendations
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated update recs" ON research.recommendations
  FOR UPDATE USING (true);
```

These tables are intentionally "research-wide" — they're the provenance spine that Paper 1 and Paper 2 measure over, so the design assumes any researcher should see any case's events.

But the Supabase project is shared with 5 other apps (SOSCOMMAND, SOSWEBSITE, SOSTRAVEL, SOSPRO, SOSSAFE). Anyone with a valid `auth.users` row from any of those apps would currently pass the `USING (true)` policy and be able to read or write `research.*`. The DB-level auto-sync triggers also write `research.case_events` rows on every SOSCOMMAND case mutation — those rows are tagged `actor_id = 'soscommand_sync'` rather than a real user UUID, so locking the policies to `auth.uid() = actor_id` would silently break the trigger path.

### Threat model question

Which of these is the SOSPHD trust boundary?

1. **The Supabase project**: any signed-in SOS-ecosystem user is trusted to read/write research data. (Status quo.)
2. **The research instance**: only allowlisted researchers can read/write research data. Other SOS-app users (operators, payers, clinicians) must be excluded even if their auth token would otherwise pass `auth.uid() IS NOT NULL`.

### Options

#### Option A — Status quo (do nothing)

Accept that operational users in SOSCOMMAND/SOSWEBSITE/etc. could in principle read `research.case_events`. Document the trust boundary as "the Supabase project". No code change.

**When this is fine**: SOSPHD is owner-operated and the only humans who can sign into any SOS app are the researcher and operators known to the researcher. Effectively a single-tenant trust boundary today.

#### Option B — Allowlist via `research.allowed_users` table

Add a lookup table `research.allowed_users (user_id uuid primary key)`. Tighten the policies to:

```sql
USING (EXISTS (SELECT 1 FROM research.allowed_users WHERE user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM research.allowed_users WHERE user_id = auth.uid()))
```

The auto-sync triggers run as `SECURITY DEFINER` so they bypass RLS — they keep working unchanged. SOSCOMMAND/etc. users without an `allowed_users` row are excluded from research reads.

**When this is best**: there will eventually be multiple SOS apps with non-researcher users, and the research data must stay separated.

#### Option C — Per-user research tagging

Add `created_by_research_user uuid` to `research.recommendations` (decisions are already a user-scoped operation). Tighten the recommendations UPDATE policy to `USING (created_by_research_user = auth.uid())`. Leave `case_events` as research-wide because it's a shared provenance log.

**When this is best**: protecting the *decision* audit (who accepted/overrode what) is more important than restricting *visibility* of events.

### Recommendation

**Option B** if there's any chance of multi-researcher or future SOS-app expansion; **Option A** if the deployment stays owner-operated and the bar is just "everyone with a Supabase login here is trusted".

The migration for Option B is small (one new table + four policy updates) and reversible. Cost is one extra row per researcher to maintain.

### Why this isn't fixed automatically

The trigger context is `SECURITY DEFINER` so locking the policies down won't break the SOSCOMMAND→research sync — that part is safe. But picking Option B vs A is a judgment about the deployment's expected user population, which is outside the codebase. The decision lives here so it's visible and dateable.

---

## SD-002 — Idempotency keys on mutations

**Status**: DEFERRED (Phase 7 audit, 2026-05-28)

A network blip between client and server can lead the client to retry a `POST /api/recommendations/generate` or a server action like `createTaskAction`, producing duplicate rows. There's currently no application-layer idempotency.

This is deferred because:
1. The current clients don't auto-retry — every form submission is a single shot, every server action is awaited synchronously.
2. Fixing it requires (a) adding an `idempotency_key` column to each mutation table, (b) a UNIQUE constraint, (c) client-side key generation, (d) request-header plumbing.
3. The cost of an occasional duplicate row in research data is low (the user notices and deletes one).

Revisit when (a) any client gains automatic retry logic, or (b) the user reports duplicate writes in practice.

---

## SD-003 — PHI redaction on `recent_notes.content` before sending to LLM

**Status**: DEFERRED (Phase 7 audit, 2026-05-28)

The advisor route passes researcher-authored note `content` (truncated to 200 chars) into the LLM context. The notes could in principle contain incidental clinical detail. A redaction pass (regex strip of dates, names, ID-shaped strings) would limit what reaches the model.

This is deferred because:
1. Notes are explicitly researcher-authored — the trust boundary is the researcher themselves. They control what they type.
2. Phase 7 already added a sanitization step that wraps note content in `<context>` and neuters closing tags. That blocks prompt-injection. It doesn't redact PHI but PHI in researcher notes is a methodology question, not a security question.
3. A real redactor would need a maintained pattern set and would still leak edge cases.

Revisit if the SOSPHD note-creation surface is ever extended to non-researcher authors, or if IRB requires evidence of LLM PHI-redaction.
