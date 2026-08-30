/* ─── Unified AI Endpoint Gate ─────────────────────────────────────────
 *  Every cost-bearing AI route uses the same ordered boundary:
 *    1. Auth + research allowlist (gateResearchRequest)
 *    2. Bounded request parsing + route validation
 *    3. Provider/key readiness + rate limit (gateAIUsage)
 *  Keeping the phases separate ensures invalid/oversized requests do not
 *  resolve provider configuration or consume rate budget.
 * ────────────────────────────────────────────────────────────────────── */

import {
  AISurface,
  requireAIKey,
  MissingAIKeyError,
  UnknownProviderError,
  ProviderNotInstalledError,
} from "./config";
import { requireWithinAILimit, AIRateLimitError } from "./rate-limit";
import {
  requireResearchUser,
  ResearchAuthenticationError,
  ResearchAccessDeniedError,
  ResearchAuthorizationUnavailableError,
} from "@/lib/auth/research-user";

const researchAccessGrantBrand: unique symbol = Symbol("researchAccessGrant");
const aiUsageGrantBrand: unique symbol = Symbol("aiUsageGrant");

export type ResearchAccessGrant = {
  readonly userId: string;
  readonly [researchAccessGrantBrand]: true;
};

export type AIUsageGrant<S extends AISurface = AISurface> = {
  readonly surface: S;
  readonly userId: string;
  readonly [aiUsageGrantBrand]: true;
};

export type ResearchGateResult =
  | { ok: true; userId: string; grant: ResearchAccessGrant }
  | { ok: false; response: Response };

export type AIGateResult<S extends AISurface = AISurface> =
  | { ok: true; userId: string; grant: AIUsageGrant<S> }
  | { ok: false; response: Response };

function errorResponse(error: unknown): Response | null {
  if (
    error instanceof ResearchAuthenticationError ||
    error instanceof ResearchAccessDeniedError ||
    error instanceof ResearchAuthorizationUnavailableError ||
    error instanceof MissingAIKeyError ||
    error instanceof AIRateLimitError ||
    error instanceof UnknownProviderError ||
    error instanceof ProviderNotInstalledError
  ) {
    const body: Record<string, unknown> = { error: error.message };
    const headers: Record<string, string> = {};
    if (error instanceof AIRateLimitError) {
      body.retry_after_ms = error.retry_after_ms;
      headers["Retry-After"] = String(
        Math.ceil(error.retry_after_ms / 1000),
      );
    }
    return Response.json(body, { status: error.status, headers });
  }
  return null;
}

/** Authenticate and enforce the research allowlist, without touching AI config. */
export async function gateResearchRequest(): Promise<ResearchGateResult> {
  try {
    const user = await requireResearchUser();
    return {
      ok: true,
      userId: user.id,
      grant: { userId: user.id, [researchAccessGrantBrand]: true },
    };
  } catch (error) {
    const response = errorResponse(error);
    if (response) return { ok: false, response };
    throw error;
  }
}

/** Resolve provider/key readiness and consume one process-local rate slot. */
export function gateAIUsage<S extends AISurface>(
  researchGrant: ResearchAccessGrant,
  surface: S,
): AIGateResult<S> {
  if (
    !researchGrant ||
    researchGrant[researchAccessGrantBrand] !== true
  ) {
    throw new Error("Missing research access grant");
  }
  const userId = researchGrant.userId;
  try {
    requireAIKey(surface);
    requireWithinAILimit(userId, surface);
    return {
      ok: true,
      userId,
      grant: { surface, userId, [aiUsageGrantBrand]: true },
    };
  } catch (error) {
    const response = errorResponse(error);
    if (response) return { ok: false, response };
    throw error;
  }
}

/** Runtime guard for provider libraries that require an issued usage grant. */
export function assertAIUsageGrant<S extends AISurface>(
  grant: AIUsageGrant<S>,
  surface: S,
): void {
  if (
    !grant ||
    grant.surface !== surface ||
    grant[aiUsageGrantBrand] !== true
  ) {
    throw new Error(`Missing AI usage grant for surface "${surface}"`);
  }
}
