/* ─── AI Model Configuration ──────────────────────────────────────────
 *  Single source of truth for which AI model SOSPHD uses where.
 *  Centralizing this means:
 *  - Provider/model swap is one edit, not four routes
 *  - Paper 2's engine comparison can parameterize via env vars
 *  - One consistent error message when keys are missing
 * ────────────────────────────────────────────────────────────────────── */

import { openai } from "@ai-sdk/openai";
import { assertProductionEnv } from "@/lib/env";

export type AISurface =
  | "recommendations"
  | "advisor"
  | "paper_builder"
  | "doc_assistant"
  | "categorize";

const DEFAULT_MODEL = "openai:gpt-4o-mini";

/* ─── Providers ────────────────────────────────────────────────────────
 *  A model id is `provider:model` — `openai:gpt-4o-mini`,
 *  `anthropic:claude-sonnet-4-5`. A bare name with no colon means openai,
 *  so every value that worked before this change still works.
 *
 *  WHY THIS EXISTS. modelFor() previously wrapped the resolved name in
 *  openai() unconditionally, while the override above was documented as
 *  the mechanism for "Paper 2's engine comparison" and the note on
 *  modelFor said to add routing "when we introduce Anthropic / local-model
 *  comparisons". Those two facts contradicted each other: setting
 *  SOSPHD_MODEL_ADVISOR to a non-OpenAI model produced openai("claude-…"),
 *  i.e. a request to OpenAI for a model it has never heard of. The env var
 *  promised cross-engine comparison and could only deliver same-vendor
 *  comparison — and it failed at the API, far from the config that caused
 *  it. Routing is now explicit and unknown providers fail immediately.
 * ────────────────────────────────────────────────────────────────────── */

/** A provider we know how to name, whether or not its SDK is installed. */
type ProviderId = "openai" | "anthropic";

interface ProviderEntry {
  /** Env var holding this provider's credential. */
  envKey: string;
  /**
   * Model factory. Absent when the provider is understood but its SDK is
   * not a dependency yet — we still want to name it so the error can say
   * exactly what to install rather than "unknown provider".
   */
  create?: (model: string) => ReturnType<typeof openai>;
  /** Package to add when `create` is absent. */
  pkg: string;
}

const PROVIDERS: Record<ProviderId, ProviderEntry> = {
  openai: {
    envKey: "OPENAI_API_KEY",
    create: (model) => openai(model),
    pkg: "@ai-sdk/openai",
  },
  // Named but not wired: adding it is `pnpm add @ai-sdk/anthropic`, an
  // import, and `create: (model) => anthropic(model)` here. Left
  // deliberately un-added rather than shipping an unused dependency —
  // but named, so requesting it produces an actionable error instead of a
  // silent OpenAI call.
  anthropic: {
    envKey: "ANTHROPIC_API_KEY",
    pkg: "@ai-sdk/anthropic",
  },
};

function isProviderId(v: string): v is ProviderId {
  return Object.prototype.hasOwnProperty.call(PROVIDERS, v);
}

export class UnknownProviderError extends Error {
  status = 500;
  constructor(surface: AISurface, raw: string, provider: string) {
    super(
      `AI surface "${surface}" is configured as "${raw}", but "${provider}" is not a known provider. ` +
        `Use one of: ${Object.keys(PROVIDERS).join(", ")} — e.g. "openai:gpt-4o-mini".`,
    );
    this.name = "UnknownProviderError";
  }
}

export class ProviderNotInstalledError extends Error {
  status = 500;
  constructor(surface: AISurface, provider: ProviderId) {
    super(
      `AI surface "${surface}" requests provider "${provider}", which is recognised but not installed. ` +
        `Run \`pnpm add ${PROVIDERS[provider].pkg}\`, then register it in lib/ai/config.ts.`,
    );
    this.name = "ProviderNotInstalledError";
  }
}

/**
 * Resolve the raw model id for a surface. Env override lets us compare
 * engines in Paper 2 without code changes.
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
 * Split a raw model id into provider + model. A bare name is openai, so
 * pre-existing config keeps working untouched.
 *
 * Only the FIRST colon separates; model names may contain colons (Ollama
 * tags like `llama3:8b` are the obvious future case).
 */
export function parseModelId(
  surface: AISurface,
  raw: string,
): { provider: ProviderId; model: string } {
  const sep = raw.indexOf(":");
  if (sep === -1) return { provider: "openai", model: raw };

  const provider = raw.slice(0, sep);
  const model = raw.slice(sep + 1);
  if (!isProviderId(provider)) {
    throw new UnknownProviderError(surface, raw, provider);
  }
  return { provider, model };
}

/** Which provider a surface will actually call. */
export function providerFor(surface: AISurface): ProviderId {
  return parseModelId(surface, modelNameFor(surface)).provider;
}

/** Get the AI SDK model handle for a surface. */
export function modelFor(surface: AISurface) {
  const { provider, model } = parseModelId(surface, modelNameFor(surface));
  const entry = PROVIDERS[provider];
  if (!entry.create) throw new ProviderNotInstalledError(surface, provider);
  return entry.create(model);
}

export class MissingAIKeyError extends Error {
  status = 503;
  constructor(
    public surface: AISurface,
    envKey: string = "OPENAI_API_KEY",
  ) {
    super(
      `AI features for "${surface}" require a ${envKey} environment variable. Add it to your .env.local file.`,
    );
    this.name = "MissingAIKeyError";
  }
}

/**
 * Throws MissingAIKeyError if the credential for the surface's RESOLVED
 * provider is absent. Routes should catch and translate to a 503.
 *
 * This used to check OPENAI_API_KEY unconditionally, which meant the gate
 * asked the wrong question the moment a surface pointed anywhere else: an
 * OpenAI key present would wave through a request destined for another
 * vendor, and the failure would surface as an auth error from that vendor
 * instead of a clear 503 here.
 */
export function requireAIKey(surface: AISurface): void {
  const { provider } = parseModelId(surface, modelNameFor(surface));
  const { envKey } = PROVIDERS[provider];
  if (!process.env[envKey]) {
    throw new MissingAIKeyError(surface, envKey);
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
 * return a fake user. This keeps `pnpm dev` usable in clean
 * checkouts where no Supabase project is wired up yet. In production
 * assertProductionEnv throws before the dev_user path can be reached,
 * so a misconfigured deployment fails loudly instead of serving an
 * unauthenticated app with unmetered LLM spend.
 */
export async function requireAuthenticatedUser(): Promise<{ id: string }> {
  assertProductionEnv();
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
