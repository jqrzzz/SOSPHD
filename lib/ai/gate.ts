/* ─── Unified AI Endpoint Gate ─────────────────────────────────────────
 *  Every cost-bearing AI route has the same three gates:
 *    1. Auth (requireAuthenticatedUser)
 *    2. Key present (requireAIKey)
 *    3. Within rate limit (requireWithinAILimit)
 *  Plus a uniform error → Response translation. This helper bundles
 *  the three into one call so each route reads as a single guarded
 *  step rather than 15 lines of repeated try/catch.
 * ────────────────────────────────────────────────────────────────────── */

import {
  AISurface,
  requireAIKey,
  MissingAIKeyError,
  requireAuthenticatedUser,
  UnauthenticatedError,
} from "./config";
import { requireWithinAILimit, AIRateLimitError } from "./rate-limit";

export type GateResult =
  | { ok: true; userId: string }
  | { ok: false; response: Response };

/**
 * Run the auth → key → rate-limit gate sequence for an AI route.
 * On success returns the authenticated user id. On failure returns
 * a Response the caller should return directly.
 *
 * Usage in a route:
 *
 *   const gate = await gateAIRequest("advisor");
 *   if (!gate.ok) return gate.response;
 *   // ... proceed with gate.userId
 */
export async function gateAIRequest(surface: AISurface): Promise<GateResult> {
  try {
    const user = await requireAuthenticatedUser();
    requireAIKey(surface);
    requireWithinAILimit(user.id, surface);
    return { ok: true, userId: user.id };
  } catch (err) {
    if (
      err instanceof UnauthenticatedError ||
      err instanceof MissingAIKeyError ||
      err instanceof AIRateLimitError
    ) {
      const body: Record<string, unknown> = { error: err.message };
      const headers: Record<string, string> = {};
      if (err instanceof AIRateLimitError) {
        body.retry_after_ms = err.retry_after_ms;
        headers["Retry-After"] = String(Math.ceil(err.retry_after_ms / 1000));
      }
      return {
        ok: false,
        response: Response.json(body, { status: err.status, headers }),
      };
    }
    throw err;
  }
}
