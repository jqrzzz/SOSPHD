/* ─── Production environment guard ─────────────────────────────────────
 *  Three code paths treat "Supabase env vars are absent" as development
 *  mode and skip authentication entirely (middleware route protection,
 *  requireAuthenticatedUser's dev_user fallback, and /api/agent through
 *  it). That is intentional for clean dev checkouts — but in a deployed
 *  environment the same condition would silently serve an open,
 *  unauthenticated app with unmetered LLM spend.
 *
 *  This guard makes that state impossible: in production, a missing
 *  required variable throws before any request is served. In dev/test
 *  it is a no-op, so the documented degraded mode keeps working.
 *
 *  Call sites: lib/supabase/proxy.ts (covers every routed request via
 *  middleware) and lib/ai/config.ts:requireAuthenticatedUser (covers
 *  every AI surface and /api/agent even if middleware is bypassed).
 * ────────────────────────────────────────────────────────────────────── */

const REQUIRED_IN_PRODUCTION = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

export class MissingProductionEnvError extends Error {
  status = 500;
  constructor(missing: readonly string[]) {
    super(
      `Production deployment is missing required environment variables: ${missing.join(", ")}. ` +
        `Refusing to serve — without them, authentication is silently disabled. ` +
        `Set them in the deployment environment (see .env.example).`,
    );
    this.name = "MissingProductionEnvError";
  }
}

/**
 * Throws MissingProductionEnvError when NODE_ENV is "production" and a
 * required variable is absent. No-op in development and test.
 */
export function assertProductionEnv(): void {
  if (process.env.NODE_ENV !== "production") return;
  const missing = REQUIRED_IN_PRODUCTION.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new MissingProductionEnvError(missing);
  }
}
