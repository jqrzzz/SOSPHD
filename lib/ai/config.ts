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
