import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  modelNameFor,
  parseModelId,
  providerFor,
  modelFor,
  requireAIKey,
  MissingAIKeyError,
  UnknownProviderError,
  ProviderNotInstalledError,
} from "../config";

/* ─── Model resolution ─────────────────────────────────────────────────
 *  modelFor() used to wrap whatever modelNameFor() returned in openai(),
 *  unconditionally — while the surface env overrides were documented as
 *  the mechanism for Paper 2's engine comparison. Pointing a surface at a
 *  non-OpenAI model therefore built a request to OpenAI for a model it has
 *  never heard of, and the failure appeared at the vendor API rather than
 *  at the config that caused it. These cover the routing that replaced it.
 * ────────────────────────────────────────────────────────────────────── */

const TOUCHED = [
  "SOSPHD_MODEL_DEFAULT",
  "SOSPHD_MODEL_ADVISOR",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
] as const;

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(TOUCHED.map((k) => [k, process.env[k]]));
  for (const k of TOUCHED) delete process.env[k];
});

afterEach(() => {
  for (const k of TOUCHED) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("modelNameFor", () => {
  it("falls back to the built-in default", () => {
    expect(modelNameFor("advisor")).toBe("openai:gpt-4o-mini");
  });

  it("prefers the surface override over the catch-all", () => {
    process.env.SOSPHD_MODEL_DEFAULT = "openai:gpt-4o";
    process.env.SOSPHD_MODEL_ADVISOR = "openai:gpt-4o-mini";
    expect(modelNameFor("advisor")).toBe("openai:gpt-4o-mini");
    expect(modelNameFor("categorize")).toBe("openai:gpt-4o");
  });
});

describe("parseModelId", () => {
  it("treats a bare name as openai — pre-existing config keeps working", () => {
    expect(parseModelId("advisor", "gpt-4o-mini")).toEqual({
      provider: "openai",
      model: "gpt-4o-mini",
    });
  });

  it("splits provider:model", () => {
    expect(parseModelId("advisor", "anthropic:claude-sonnet-4-5")).toEqual({
      provider: "anthropic",
      model: "claude-sonnet-4-5",
    });
  });

  it("splits on the FIRST colon only, so model names may contain colons", () => {
    // The shape a local-model tag takes, e.g. ollama's `llama3:8b`.
    expect(parseModelId("advisor", "openai:ft:gpt-4o:acme:1")).toEqual({
      provider: "openai",
      model: "ft:gpt-4o:acme:1",
    });
  });

  it("rejects an unknown provider instead of silently calling OpenAI", () => {
    expect(() => parseModelId("advisor", "gemini:pro")).toThrow(
      UnknownProviderError,
    );
    // The message has to name the offending value to be actionable.
    expect(() => parseModelId("advisor", "gemini:pro")).toThrow(/gemini/);
  });
});

describe("providerFor", () => {
  it("reports the provider a surface will actually call", () => {
    expect(providerFor("advisor")).toBe("openai");
    process.env.SOSPHD_MODEL_ADVISOR = "anthropic:claude-sonnet-4-5";
    expect(providerFor("advisor")).toBe("anthropic");
    // ...and only that surface moved.
    expect(providerFor("categorize")).toBe("openai");
  });
});

describe("modelFor", () => {
  it("builds a handle for an installed provider", () => {
    expect(() => modelFor("advisor")).not.toThrow();
  });

  it("fails loudly for a recognised-but-uninstalled provider", () => {
    process.env.SOSPHD_MODEL_ADVISOR = "anthropic:claude-sonnet-4-5";
    expect(() => modelFor("advisor")).toThrow(ProviderNotInstalledError);
    // Must tell the reader exactly what to run.
    expect(() => modelFor("advisor")).toThrow(/@ai-sdk\/anthropic/);
  });
});

describe("requireAIKey", () => {
  it("checks the key for the RESOLVED provider, not always OpenAI", () => {
    process.env.SOSPHD_MODEL_ADVISOR = "anthropic:claude-sonnet-4-5";

    // An OpenAI key must NOT wave through a request bound for Anthropic —
    // that was the pre-fix behaviour, and it pushed the failure out to the
    // vendor API instead of reporting it here.
    process.env.OPENAI_API_KEY = "sk-test";
    expect(() => requireAIKey("advisor")).toThrow(MissingAIKeyError);
    expect(() => requireAIKey("advisor")).toThrow(/ANTHROPIC_API_KEY/);

    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    expect(() => requireAIKey("advisor")).not.toThrow();
  });

  it("still gates OpenAI surfaces on OPENAI_API_KEY", () => {
    expect(() => requireAIKey("categorize")).toThrow(MissingAIKeyError);
    expect(() => requireAIKey("categorize")).toThrow(/OPENAI_API_KEY/);

    process.env.OPENAI_API_KEY = "sk-test";
    expect(() => requireAIKey("categorize")).not.toThrow();
  });
});
