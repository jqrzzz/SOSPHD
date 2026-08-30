import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("SOSPHD_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SOSPHD_SUPABASE_ANON_KEY", "anon-test-key");
  vi.stubEnv("SOSPHD_EMAIL", "owner@example.test");
  vi.stubEnv("SOSPHD_PASSWORD", "test-password");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getSession allowlist revocation", () => {
  it("rechecks a cached MCP session and clears it when access is revoked", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { user: { id: "owner" } },
      error: null,
    });
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: false, error: null });
    const client = {
      auth: { signInWithPassword },
      schema: vi.fn().mockReturnValue({ rpc }),
    };
    createClientMock.mockReturnValue(client);

    const { getSession } = await import("../supabase.js");

    await expect(getSession()).resolves.toMatchObject({ userId: "owner" });
    await expect(getSession()).rejects.toThrow(
      "SOSPHD MCP: research access denied",
    );
    expect(signInWithPassword).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
