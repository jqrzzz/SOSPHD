/* ─── AI Model Configuration ──────────────────────────────────────────
 *  Single source of truth for which AI model SOSPHD uses where.
 *  Centralizing this means:
 *  - Provider/model swap is one edit, not four routes
 *  - Paper 2's engine comparison can parameterize via env vars
 *  - One consistent error message when keys are missing
 * ────────────────────────────────────────────────────────────────────── */

import { openai } from "@ai-sdk/openai";

export type AISurface =
  | "recommendations"
  | "advisor"
  | "paper_builder"
  | "doc_assistant"
  | "categorize";

const DEFAULT_MODEL = "gpt-4o-mini";

/**
 * Resolve the model name for a given surface. Env override lets us
 * compare engine versions in Paper 2 without code changes.
 *
 * Override env vars:
 *   SOSPHD_MODEL_RECOMMENDATIONS
 *   SOSPHD_MODEL_ADVISOR
 *   SOSPHD_MODEL_PAPER_BUILDER
 *   SOSPHD_MODEL_DOC_ASSISTANT
 *   SOSPHD_MODEL_CATEGORIZE
 *   SOSPHD_MODEL_DEFAULT      (catch-all)
 */
export function modelNameFor(surface: AISurface): string {
  const surfaceKey = `SOSPHD_MODEL_${surface.toUpperCase()}`;
  return (
    process.env[surfaceKey] ??
    process.env.SOSPHD_MODEL_DEFAULT ??
    DEFAULT_MODEL
  );
}

/**
 * Get the configured AI SDK model handle for a surface.
 * Currently always OpenAI; add provider routing here when we
 * introduce Anthropic / local-model comparisons for Paper 2.
 */
export function modelFor(surface: AISurface) {
  return openai(modelNameFor(surface));
}

export class MissingAIKeyError extends Error {
  status = 503;
  constructor(public surface: AISurface) {
    super(
      `AI features for "${surface}" require an OPENAI_API_KEY environment variable. Add it to your .env.local file.`,
    );
    this.name = "MissingAIKeyError";
  }
}

/**
 * Throws MissingAIKeyError if the required key is absent. Routes
 * should catch and translate to a 503 response.
 */
export function requireAIKey(surface: AISurface): void {
  if (!process.env.OPENAI_API_KEY) {
    throw new MissingAIKeyError(surface);
  }
}

export class UnauthenticatedError extends Error {
  status = 401;
  constructor(message: string = "Authentication required") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

/**
 * Gate every LLM-cost endpoint behind authentication so the OpenAI
 * budget can't be drained by unauthenticated callers. Throws
 * UnauthenticatedError when no session is present.
 *
 * Throws (rather than returns) so routes can use a single try/catch
 * block alongside the AI-key check and other validation.
 *
 * Mirrors the middleware's local-dev pattern (lib/supabase/proxy.ts):
 * when Supabase env vars are not configured, treat as dev mode and
 * return a fake user. This keeps `npm run dev` usable in clean
 * checkouts where no Supabase project is wired up yet. In production
 * the env vars MUST be set, so this path is never reached.
 */
export async function requireAuthenticatedUser(): Promise<{ id: string }> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return { id: "dev_user" };
  }
  // Dynamic import — keeps this module callable from non-Next contexts
  // (e.g. test runners) where '@/lib/supabase/server' isn't available.
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    throw new UnauthenticatedError();
  }
  return { id: data.user.id };
}
