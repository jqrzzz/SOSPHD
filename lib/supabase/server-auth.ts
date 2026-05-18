/* ─── Server-side Supabase auth helpers ────────────────────────────────
 *  SERVER-ONLY. Do NOT import from any file that can be reached by a
 *  client component — Turbopack will pull `next/headers` into the
 *  client bundle and the build will fail with:
 *
 *    "You're importing a component that needs 'next/headers'."
 *
 *  Safe to import from:
 *    - Server actions (lib/*-actions.ts)
 *    - Route handlers (app/api/**)
 *    - Server components (no "use client" directive)
 *    - Server-only data modules (e.g. lib/data/*-mutations.ts)
 *
 *  Not safe to import from:
 *    - Anything with "use client"
 *    - Files imported (directly or transitively) by client components
 * ────────────────────────────────────────────────────────────────────── */

import { createClient } from "./server";
import type { SupabaseClient } from "@supabase/supabase-js";

export class AuthRequiredError extends Error {
  status = 401;
  constructor(message: string = "Sign in required to perform this action.") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

/**
 * Server-side Supabase client (reads auth cookies via Next.js headers).
 * Returns null if env vars are missing.
 */
export async function getServerSupabase(): Promise<SupabaseClient | null> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return null;
  }
  try {
    return (await createClient()) as SupabaseClient;
  } catch {
    return null;
  }
}

/**
 * Throws AuthRequiredError when Supabase or auth aren't available.
 * Use in server-side write paths so the UI surfaces a real error
 * instead of silently treating a no-op as success.
 */
export async function requireAuthOrThrow(): Promise<{
  supabase: SupabaseClient;
  userId: string;
}> {
  const supabase = await getServerSupabase();
  if (!supabase) {
    throw new AuthRequiredError(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.",
    );
  }
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    throw new AuthRequiredError();
  }
  return { supabase, userId: data.user.id };
}
