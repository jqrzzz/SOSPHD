/* ─── Supabase Database Helper (client-side) ───────────────────────────
 *  Browser-context wrapper around the Supabase client.
 *  Safe to import from client components.
 *
 *  Server-side auth + the server client live in
 *  ./server-auth.ts — DO NOT import that file from anything reachable
 *  by a client component, or Turbopack will try to bundle next/headers
 *  into the client and the build will fail.
 * ────────────────────────────────────────────────────────────────────── */

import { createClient } from "./client";

/** Browser-only Supabase client. Returns null if env vars are missing. */
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

/** Browser-only auth check. Returns null when not signed in. */
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

// warnDegradedMode and the seed-vs-empty policy moved to
// lib/data/degraded.ts so server-only stores don't have to import this
// browser-client module to reach them.
