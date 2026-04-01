/* ─── Supabase Database Helper ─────────────────────────────────────────
 *  Wraps the browser client for use in store modules.
 *  All phd_* table queries go through this.
 * ────────────────────────────────────────────────────────────────────── */

import { createClient } from "./client";

/** Get the Supabase browser client. Returns null if env vars are missing. */
export function getSupabase() {
  try {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      return null;
    }
    return createClient();
  } catch {
    return null;
  }
}

/** Get the authenticated user's ID. Returns null if not signed in. */
export async function getCurrentUserId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}
