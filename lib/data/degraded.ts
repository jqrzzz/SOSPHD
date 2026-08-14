/* ─── Degraded-mode helpers ────────────────────────────────────────────
 *  Context-free (no Supabase imports) so both server-only stores and
 *  the client-safe fieldwork store can share them.
 *
 *  Policy: in DEVELOPMENT a failed or unconfigured read may fall back to
 *  seed data so clean checkouts render something. In PRODUCTION it must
 *  not — a research tool silently substituting fabricated content for
 *  real content is a data-integrity hazard (fake contacts, fake journal
 *  entries, a fake Paper 1 draft). Production gets empty results plus
 *  the [SOSPHD:DEGRADED] warning, and the UI's empty states do the rest.
 * ────────────────────────────────────────────────────────────────────── */

/**
 * Emits a one-shot warning when a store function takes the seed /
 * empty fallback path. Helps catch the case where production is
 * silently serving no data because of a misconfigured client.
 *
 * Lifetime: the dedup Map lives in module scope. In a serverless
 * model that's per-worker — fresh on every cold start. In `next dev`,
 * it lasts the lifetime of the dev server. Neither is
 * cross-request-globally-perfect; that's by design — we want one
 * warning per worker per (key, reason), not one ever.
 *
 * Pass a positive `ttlMs` for stricter throttling: the same
 * (key, reason) won't warn again until that many ms have elapsed.
 */
const _warnedKeys = new Map<string, number>();
const DEFAULT_TTL_MS = 0; // 0 = once-per-worker

export function warnDegradedMode(
  key: string,
  reason: string,
  ttlMs: number = DEFAULT_TTL_MS,
) {
  const tag = `${key}:${reason}`;
  const now = Date.now();
  const last = _warnedKeys.get(tag);
  if (last !== undefined && (ttlMs === 0 || now - last < ttlMs)) return;
  _warnedKeys.set(tag, now);
  console.warn(
    `[SOSPHD:DEGRADED] ${key} — ${reason}. Returning fallback/empty data.`,
  );
}

/**
 * Seed data in development, empty in production. Every fallback return
 * in the stores goes through this so fabricated seed content can never
 * be mistaken for research data in a deployed environment. Callers are
 * responsible for calling warnDegradedMode first — this helper only
 * picks the payload.
 */
export function seedOrEmpty<T>(seed: T, empty: T): T {
  return process.env.NODE_ENV === "production" ? empty : seed;
}
