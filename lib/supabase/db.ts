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

/**
 * Throws AuthRequiredError when Supabase or auth aren't available.
 * Use in write paths so the UI surfaces a real error instead of
 * silently treating a no-op as success.
 */
export class AuthRequiredError extends Error {
  status = 401;
  constructor(message: string = "Sign in required to perform this action.") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

export async function requireAuthOrThrow(): Promise<{
  supabase: NonNullable<ReturnType<typeof getSupabase>>;
  userId: string;
}> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new AuthRequiredError(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.",
    );
  }
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new AuthRequiredError();
  }
  return { supabase, userId };
}

/**
 * Logs once per (key, reason) pair when a store function takes the
 * seed/empty fallback path. Helps catch the case where production
 * is silently serving demo data because of a misconfigured client.
 */
const _warnedKeys = new Set<string>();
export function warnDegradedMode(key: string, reason: string) {
  const tag = `${key}:${reason}`;
  if (_warnedKeys.has(tag)) return;
  _warnedKeys.add(tag);
  // eslint-disable-next-line no-console
  console.warn(
    `[SOSPHD:DEGRADED] ${key} — ${reason}. Returning fallback/empty data.`,
  );
}
