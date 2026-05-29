# SOSPHD — Quality & Debt Audit Plan

> Cross-cutting audit after Phases 1–9. Six read-only agents swept UI/UX, accessibility, frontend resilience, test coverage, technical debt, and the Phase 9 union's blast radius. This doc records the findings (each verified against source — agent claims that didn't hold up are marked) and a prioritized remediation plan.

**Status**: IN PROGRESS (2026-05-28). **P0 + P2-2 DONE** (`claude/quality-p0`, 91 tests). **QD-1 decided** (Allow but tag) + **P1 DONE** (`claude/quality-p1`, 95 tests). Next: P2 remainder. P3 remains.

---

## What came back clean / better than feared

- **Phase 9 union is correct across all consumers.** Case detail, event counts, analytics, advisor context, agent tools all handle historical cases properly. No double-counting, no drops. The `getOperationalContext` panel degrades gracefully (`has_data:false`) for historical ids.
- **`app/error.tsx` and `app/not-found.tsx` exist**; `[id]` pages call `notFound()` correctly. (Only *per-route* error boundaries are absent — low priority.)
- **`SeverityBadge` is not color-only** — it renders the number + label ("Low/Normal/High/Critical"). Agent overstated; corrected.
- **No TODO/FIXME/HACK** anywhere; migrations are idempotent and well-ordered.
- **Loading/pending states** on `useActionState` forms disable buttons (no double-submit). `revalidatePath` wired; no stale-view bugs found.

---

## Findings (verified) → prioritized plan

### P0 — Correctness & research integrity (do first) — ✅ DONE

> Shipped on `claude/quality-p0`. Tests 49 → 91 (+42). `mapStatus`/`mapPriority`/`toResearchCase`/`mergeAndFilterCases`/`OP_STATUSES_BY_RESEARCH_BUCKET` exported and covered; sanitizers extracted to `lib/ai/sanitize.ts` and covered; advisor chat now surfaces stream/429 errors with retry + has `role="log"`/`aria-live` (P2-2 folded in). All gates green.

**P0-1 · Test the measurement projection + Phase 9 union.** *(quick, high value)* ✅
`mapStatus` / `mapPriority` (`lib/data/store.ts`) ARE Paper 1's methodology and have **zero tests** — a silent change here corrupts every sample count and the thesis. Same for the freshest code: `getCases()` union (merge/sort/search), `getCaseById()` operational→research fallback, `toResearchCase`, and the `OP_STATUSES_BY_RESEARCH_BUCKET` ↔ `mapStatus` symmetry (if a status is added to one and not the other, the DB filter silently returns wrong rows). All pure or mockable. Effort: **S** (~1.5h, ~8 suites).

**P0-2 · Test the prompt-injection sanitizers.** *(quick, security)*
`sanitizeForContext` (advisor route) and `safeFreeText` (recommendations) are the only line of defense against context-envelope breakout, and both are untested 3–10 line pure functions. Effort: **S** (~20 min).

**P0-3 · Surface advisor stream/429 errors.** *(confirmed regression from Phase 8)*
`components/advisor-chat.tsx` destructures `useChat()` without `error`/`onError`. When the stream 500s or the **Phase-8 rate-limit 429** fires, the "thinking…" dots vanish and the user's message sits unanswered with **no feedback**. We added the 429 but the client can't show it. Add `error` handling + a retry affordance + surface the `Retry-After`. Effort: **S–M**.

### P1 — One decision + the Phase 9 UX gap — ✅ DONE

> Shipped on `claude/quality-p1`. Tests 91 → 95. **QD-1 decided: Allow but tag.** Historical recs get an `/historical` `engine_version` suffix; `HistoricalCaseBadge` rendered on `/cases` + `/cases/[id]`; methods-section paraphrase added to `measurement-projection.md` §6.5.

**QD-1 (DECISION) ✅ Allow but tag.** When `generateRecommendationsForCase` runs against a `source = "historical"` case, the persisted row's `engine_version` is suffixed `…/historical` (e.g. `llm-paper2-v0.1/transport/historical`). Paper 2's intervention set = recs WITHOUT this suffix; the full set is in the same `llm-paper2-v0.1/%` lineage. Already integrates with the existing by-engine analytics breakdown — no further analytics work needed.

**P1-1 · `HistoricalCaseBadge` ✅.** Small purple badge rendered when `Case.source === "historical"` on the cases list (next to patient_ref) and the case detail header. Operational cases stay visually clean.

### P2 — Resilience & accessibility (user-facing robustness)

**P2-1 · Consistent error surfacing.** Error envelopes are shown inline in some forms, toasted in others (8 `toast.error` sites), and dropped in at least one (the contacts new-contact dialog captures `result.error` but never renders it — verify + fix). Pick one pattern (inline for forms, toast for fire-and-forget) and apply uniformly. Effort: **M**.

**P2-2 · Advisor chat `aria-live`.** The message log has no `role="log"`/`aria-live="polite"`, so streamed responses are silent to screen readers. Pairs with P0-3 (same component). Effort: **S**.

**P2-3 · `server-only` enforcement.** The server/client boundary (`lib/supabase/server-auth.ts` etc.) is convention-only — `server-only` is not installed. Add the package + `import "server-only"` to server-auth and the mutation modules so an accidental client import becomes a build error, not a silent bundle leak. Effort: **S**.

**P2-4 · a11y baseline.** Skip-to-content link in `app-shell`; `aria-describedby` linking form errors to inputs; `aria-label` on icon-only + hover-revealed buttons (quick-links edit/delete); keyboard handlers (Enter/Space) on mind-map SVG nodes; labels on quick-links inputs; tighten the worst `text-muted-foreground/40–/50` contrast. Effort: **M** (spread across components).

### P3 — Technical debt (maintainability, no rush)

**P3-1 · `site_id` phantom field.** Declared on `Case`, `ResearchNote`, `ResearchTask`, `Doc`; no DB column; coerced to null on read; seed data still sets it; `Case.site_id` is actually assigned from `country` (a naming lie). Decide: remove, or rename `Case.site_id → country`. Effort: **M**.

**P3-2 · Extract `withDegradedFallback` helper.** ~15 copies of the `if (sb) { try {…} catch { warnDegradedMode } } else { warnDegradedMode }` envelope across `*-store.ts`. One generic wrapper. Effort: **M**.

**P3-3 · Dedupe `mapDbDoc`/`mapDbVersion`** (copied between docs-store and docs-mutations) and reduce the `as unknown as Doc` cast. Effort: **S–M**.

**P3-4 · Loading skeletons for `/contacts` and `/fieldwork`** (client-fetch flicker: empty state flashes before data arrives). Effort: **S**.

**P3-5 · Minor UI consistency.** Extract repeated status colors (`text-[hsl(213_94%_56%)]` etc.) into CSS vars; `overflow-x-auto` on the protocol table; confirm destructive deletes (note/task/contact/doc) have confirmation. Effort: **S–M**.

---

## Recommended sequence

1. **P0 batch** (tests + advisor error handling) — protects the thesis methodology and fixes a live regression. ~half a day, all gated.
2. **QD-1 decision** → **P1** (rec guard/tag + historical badge).
3. **P2** (error surfacing, aria-live, server-only, a11y baseline) — one focused pass.
4. **P3** as background cleanup, no rush.

Each batch ships on its own branch, gated by tsc/lint/test/build, same as Phases 1–9.

## Corrections to the raw agent output (for the record)
- "No error boundaries" → false; `error.tsx`/`not-found.tsx` exist.
- "Severity badges color-only" → false for `SeverityBadge`; only minor dashboard action-dots.
- "Zero error toasts" → false; 8 `toast.error` sites exist (the issue is *inconsistency*, not absence).
