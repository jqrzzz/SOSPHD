/* ─── Research-user authorization ────────────────────────────────────
 * Authentication alone is insufficient in the shared Supabase project:
 * only members of research.allowed_users may reach SOSPHD's research or
 * AI surfaces. This helper checks the database-owned allowlist before any
 * provider configuration or credential is resolved.
 * ───────────────────────────────────────────────────────────────────── */

import { assertProductionEnv } from "@/lib/env";

export class ResearchAuthenticationError extends Error {
  status = 401;

  constructor() {
    super("Authentication required");
    this.name = "ResearchAuthenticationError";
  }
}

export class ResearchAccessDeniedError extends Error {
  status = 403;

  constructor() {
    super("Research access required");
    this.name = "ResearchAccessDeniedError";
  }
}

export class ResearchAuthorizationUnavailableError extends Error {
  status = 503;

  constructor() {
    super("Research authorization is temporarily unavailable");
    this.name = "ResearchAuthorizationUnavailableError";
  }
}

/**
 * Authenticate the current request and verify the database-owned research
 * allowlist. In a clean non-production checkout, preserve the documented
 * dev_user fallback; production still fails closed through assertProductionEnv.
 */
export async function requireResearchUser(): Promise<{ id: string }> {
  assertProductionEnv();

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return { id: "dev_user" };
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    throw new ResearchAuthenticationError();
  }

  const { data: isAllowed, error: allowlistError } = await supabase
    .schema("research")
    .rpc("is_allowed_user");

  if (allowlistError) {
    throw new ResearchAuthorizationUnavailableError();
  }
  if (isAllowed !== true) {
    throw new ResearchAccessDeniedError();
  }

  return { id: authData.user.id };
}
