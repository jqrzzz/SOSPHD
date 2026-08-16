import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client, or null when env is not configured.
 *
 * The null branch is not decoration. createBrowserClient THROWS on
 * missing env, and this factory is called from the app shell that wraps
 * every page — so before 2026-08-16, running without .env.local did not
 * produce the documented [SOSPHD:DEGRADED] experience, it produced a
 * full-app crash screen on every route. The server side already had
 * this contract (getServerSupabase returns null); the browser side now
 * matches it. Callers must handle null; the return type makes tsc
 * enforce that.
 *
 * Production is unaffected either way — middleware's
 * assertProductionEnv fails every request loudly if env is missing
 * there, which is the correct behaviour for prod and the wrong one for
 * a dev checkout.
 */
export function createClient() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return null;
  }
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
