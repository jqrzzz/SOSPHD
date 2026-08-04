/* ─── Per-User AI Rate Limiter (in-memory) ────────────────────────────
 *  Sliding-window rate limit per (user_id, surface) keyed pair.
 *  Cost-bearing AI endpoints call requireWithinAILimit(userId, surface)
 *  before invoking the model. If the user is over budget the helper
 *  throws AIRateLimitError, which routes translate to a 429.
 *
 *  Deployment notes:
 *   - State lives in a module-level Map. Resets on cold start and is
 *     not shared across regions. For an owner-operated single-region
 *     Vercel deployment that's adequate; for multi-region or scale
 *     swap the backing store for Upstash Redis behind the same API.
 *   - Limits are intentionally generous because the legitimate user is
 *     the researcher themselves — the goal is to stop a buggy retry
 *     loop or a compromised credential from draining the OpenAI
 *     budget, not to throttle normal use.
 * ────────────────────────────────────────────────────────────────────── */

import type { AISurface } from "./config";

export class AIRateLimitError extends Error {
  status = 429;
  retry_after_ms: number;
  constructor(surface: AISurface, retryAfterMs: number) {
    super(
      `Rate limit exceeded for AI surface "${surface}". Try again in ${Math.ceil(
        retryAfterMs / 1000,
      )} seconds.`,
    );
    this.name = "AIRateLimitError";
    this.retry_after_ms = retryAfterMs;
  }
}

interface SurfaceLimit {
  windowMs: number;
  max: number;
}

// Per-surface limits. `recommendations` and `paper_builder` are the
// most expensive calls (longest outputs), so they get the lowest
// per-window allowance.
const LIMITS: Record<AISurface, SurfaceLimit> = {
  advisor: { windowMs: 60_000, max: 30 },
  recommendations: { windowMs: 60_000, max: 15 },
  paper_builder: { windowMs: 60_000, max: 5 },
  doc_assistant: { windowMs: 60_000, max: 30 },
  categorize: { windowMs: 60_000, max: 60 },
};

// userId|surface → ringbuffer of recent request timestamps (ms epoch).
// Each VALUE is bounded to LIMITS.max by the per-call prune below.
//
// The number of KEYS was not. Pruning only ever touched the bucket being
// read, so a user who made one request and never came back left their
// timestamps in the map for the lifetime of the process — nothing revisits
// a key that is no longer being queried. On an owner-operated deployment
// that is five keys and harmless, which is why it went unnoticed; it grows
// with the allowlist (SD-001 explicitly anticipates more researchers) and
// leaks for as long as a warm serverless instance survives.
const buckets = new Map<string, number[]>();

// A bucket whose newest timestamp has aged out of its window can never
// block a future request, so it is dead weight. Sweeping every N calls
// keeps the amortized cost at O(1) per request rather than scanning the
// whole map on every one.
const SWEEP_EVERY_N_CALLS = 500;
let callsSinceSweep = 0;

function keyFor(userId: string, surface: AISurface): string {
  return `${userId}|${surface}`;
}

/** Drop buckets that can no longer affect any decision. */
function sweepExpiredBuckets(now: number): void {
  for (const [key, stamps] of buckets) {
    // Surface is the segment after the final separator; surface names never
    // contain one, so this holds even if a user id somehow does.
    const surface = key.slice(key.lastIndexOf("|") + 1) as AISurface;
    const windowMs = LIMITS[surface]?.windowMs ?? 60_000;
    const newest = stamps[stamps.length - 1];
    if (newest === undefined || newest <= now - windowMs) {
      buckets.delete(key);
    }
  }
}

/**
 * Throws AIRateLimitError if (userId, surface) is over its
 * configured per-minute budget. Otherwise records the request and
 * returns nothing.
 *
 * Call this immediately after authenticating the request, before any
 * paid LLM invocation.
 */
export function requireWithinAILimit(
  userId: string,
  surface: AISurface,
): void {
  const limit = LIMITS[surface];
  const now = Date.now();
  const cutoff = now - limit.windowMs;
  const key = keyFor(userId, surface);

  // Amortized cleanup of keys nobody is querying any more. Runs before the
  // decision below so a sweep can never evict the bucket we are about to
  // read — the key is re-read from the map immediately after.
  if (++callsSinceSweep >= SWEEP_EVERY_N_CALLS) {
    callsSinceSweep = 0;
    sweepExpiredBuckets(now);
  }

  const stamps = buckets.get(key) ?? [];
  // Prune anything outside the sliding window. Cheap because stamps is
  // capped at limit.max and ordered chronologically.
  const fresh = stamps.filter((t) => t > cutoff);

  if (fresh.length >= limit.max) {
    const oldest = fresh[0];
    const retryAfterMs = oldest + limit.windowMs - now;
    // Persist the pruned list so memory doesn't grow even when over
    // limit (no new stamp added — caller's request is rejected).
    buckets.set(key, fresh);
    throw new AIRateLimitError(surface, Math.max(retryAfterMs, 0));
  }

  fresh.push(now);
  buckets.set(key, fresh);
}

/** Visible for tests — clears all in-memory state. */
export function _resetRateLimitState(): void {
  buckets.clear();
  callsSinceSweep = 0;
}

/** Visible for tests — how many buckets are currently retained. */
export function _bucketCount(): number {
  return buckets.size;
}

/** Visible for tests — force the amortized sweep to run now. */
export function _sweepNow(now: number = Date.now()): void {
  sweepExpiredBuckets(now);
}
