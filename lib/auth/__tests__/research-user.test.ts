import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import {
  requireResearchUser,
  ResearchAccessDeniedError,
  ResearchAuthenticationError,
  ResearchAuthorizationUnavailableError,
} from "../research-user";

function mockClient(options: {
  userId?: string;
  authError?: unknown;
  isAllowed?: boolean;
  allowlistError?: unknown;
}) {
  const getUser = vi.fn().mockResolvedValue({
    data: { user: options.userId ? { id: options.userId } : null },
    error: options.authError ?? null,
  });
  const rpc = vi.fn().mockResolvedValue({
    data: options.isAllowed ?? false,
    error: options.allowlistError ?? null,
  });
  const schema = vi.fn().mockReturnValue({ rpc });

  createClientMock.mockResolvedValue({
    auth: { getUser },
    schema,
  });

  return { getUser, schema, rpc };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-test-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("requireResearchUser", () => {
  it("uses the non-production dev user only when Supabase is unconfigured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    await expect(requireResearchUser()).resolves.toEqual({ id: "dev_user" });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("rejects a missing session before the allowlist lookup", async () => {
    const { schema } = mockClient({});

    await expect(requireResearchUser()).rejects.toBeInstanceOf(
      ResearchAuthenticationError,
    );
    expect(schema).not.toHaveBeenCalled();
  });

  it("rejects an authenticated user who is not allowlisted", async () => {
    const { schema, rpc } = mockClient({ userId: "ordinary-user" });

    await expect(requireResearchUser()).rejects.toBeInstanceOf(
      ResearchAccessDeniedError,
    );
    expect(schema).toHaveBeenCalledWith("research");
    expect(rpc).toHaveBeenCalledWith("is_allowed_user");
  });

  it("fails closed when the allowlist RPC is unavailable", async () => {
    mockClient({
      userId: "owner",
      allowlistError: new Error("database unavailable"),
    });

    await expect(requireResearchUser()).rejects.toBeInstanceOf(
      ResearchAuthorizationUnavailableError,
    );
  });

  it("returns the authenticated id only when the database allows it", async () => {
    const { schema, rpc } = mockClient({
      userId: "owner",
      isAllowed: true,
    });

    await expect(requireResearchUser()).resolves.toEqual({ id: "owner" });
    expect(schema).toHaveBeenCalledWith("research");
    expect(rpc).toHaveBeenCalledWith("is_allowed_user");
  });
});
