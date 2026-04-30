/* ─── Auth Helpers ─────────────────────────────────────────────────────
 *  Resolve the current authenticated user from Supabase session.
 *  Falls back to owner config for local dev when not authenticated.
 * ────────────────────────────────────────────────────────────────────── */

import { APP_CONFIG } from "./config";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

/**
 * Get the current user from Supabase auth (client-side).
 * Returns the authenticated user or falls back to owner config for dev.
 */
export async function getClientUser(): Promise<AppUser> {
  try {
    const { createClient } = await import("./supabase/client");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      return {
        id: user.id,
        email: user.email ?? APP_CONFIG.owner.email,
        name: user.user_metadata?.full_name ?? APP_CONFIG.owner.name,
        role: APP_CONFIG.owner.role,
      };
    }
  } catch {
    // Supabase not available (local dev without network)
  }

  return devFallbackUser();
}

/**
 * Get the current user from Supabase auth (server-side).
 * Returns the authenticated user or falls back to owner config for dev.
 */
export async function getServerUser(): Promise<AppUser> {
  try {
    const { createClient } = await import("./supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      return {
        id: user.id,
        email: user.email ?? APP_CONFIG.owner.email,
        name: user.user_metadata?.full_name ?? APP_CONFIG.owner.name,
        role: APP_CONFIG.owner.role,
      };
    }
  } catch {
    // Supabase not available (local dev without network)
  }

  return devFallbackUser();
}

/**
 * Dev fallback — uses owner config so the app works without auth.
 * The ID is deterministic so in-memory stores stay consistent.
 */
function devFallbackUser(): AppUser {
  return {
    id: "user_demo",
    email: APP_CONFIG.owner.email,
    name: APP_CONFIG.owner.name,
    role: APP_CONFIG.owner.role,
  };
}
