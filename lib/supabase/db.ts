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

/**
 * Emits a one-shot warning when a store function takes the seed /
 * empty fallback path. Helps catch the case where production is
 * silently serving demo data because of a misconfigured client.
 *
 * Lifetime: the dedup Map lives in module scope. In a Vercel
 * serverless model that's per-worker — fresh on every cold start.
 * In `next dev`, it lasts the lifetime of the dev server. Neither
 * is cross-request-globally-perfect; that's by design — we want one
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
