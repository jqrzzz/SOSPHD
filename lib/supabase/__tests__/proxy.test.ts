import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { createServerClientMock, getUserMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

import { MissingProductionEnvError } from "@/lib/env";
import { updateSession } from "../proxy";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-test-key");
  getUserMock.mockResolvedValue({ data: { user: null } });
  createServerClientMock.mockReturnValue({
    auth: { getUser: getUserMock },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function request(path: string, headers?: HeadersInit): NextRequest {
  return new NextRequest(`https://example.test${path}`, { headers });
}

describe("updateSession route protection", () => {
  it("redirects an unauthenticated protected-page request to the public root", async () => {
    const response = await updateSession(request("/spine"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.test/");
  });

  it("also rejects a crafted RSC prefetch request for a protected page", async () => {
    const response = await updateSession(
      request("/dashboard", {
        RSC: "1",
        "Next-Router-Prefetch": "1",
        "Next-Router-State-Tree": "%5B%22%22%5D",
      }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.test/");
  });

  it("keeps authentication pages public", async () => {
    const response = await updateSession(request("/auth/login"));

    expect(response.status).toBe(200);
  });

  it("redirects an authenticated root request into the workspace", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "owner" } },
    });

    const response = await updateSession(request("/"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://example.test/spine",
    );
  });

  it("preserves the documented unconfigured development fallback", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    const response = await updateSession(request("/spine"));

    expect(response.status).toBe(200);
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it("fails closed when production is missing Supabase configuration", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    await expect(updateSession(request("/spine"))).rejects.toBeInstanceOf(
      MissingProductionEnvError,
    );
    expect(createServerClientMock).not.toHaveBeenCalled();
  });
});
