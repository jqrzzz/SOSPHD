import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireResearchUserMock,
  requireAIKeyMock,
  requireWithinAILimitMock,
} = vi.hoisted(() => ({
  requireResearchUserMock: vi.fn(),
  requireAIKeyMock: vi.fn(),
  requireWithinAILimitMock: vi.fn(),
}));

vi.mock("@/lib/auth/research-user", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/auth/research-user")
  >("@/lib/auth/research-user");
  return { ...actual, requireResearchUser: requireResearchUserMock };
});

vi.mock("../config", async () => {
  const actual = await vi.importActual<typeof import("../config")>("../config");
  return { ...actual, requireAIKey: requireAIKeyMock };
});

vi.mock("../rate-limit", async () => {
  const actual = await vi.importActual<typeof import("../rate-limit")>(
    "../rate-limit",
  );
  return {
    ...actual,
    requireWithinAILimit: requireWithinAILimitMock,
  };
});

import {
  ResearchAccessDeniedError,
  ResearchAuthenticationError,
  ResearchAuthorizationUnavailableError,
} from "@/lib/auth/research-user";
import { AIRateLimitError } from "../rate-limit";
import {
  assertAIUsageGrant,
  gateAIUsage,
  gateResearchRequest,
  type AIUsageGrant,
  type ResearchAccessGrant,
} from "../gate";

beforeEach(() => {
  vi.clearAllMocks();
  requireResearchUserMock.mockResolvedValue({ id: "owner" });
});

describe("research authorization ordering", () => {
  it.each([
    [new ResearchAuthenticationError(), 401],
    [new ResearchAccessDeniedError(), 403],
    [new ResearchAuthorizationUnavailableError(), 503],
  ])("returns %s before provider or rate lookup", async (error, status) => {
    requireResearchUserMock.mockRejectedValue(error);

    const result = await gateResearchRequest();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected rejected gate");
    expect(result.response.status).toBe(status);
    expect(requireAIKeyMock).not.toHaveBeenCalled();
    expect(requireWithinAILimitMock).not.toHaveBeenCalled();
  });

  it("uses the same allowlist-only gate for non-provider surfaces", async () => {
    const result = await gateResearchRequest();

    expect(result).toMatchObject({ ok: true, userId: "owner" });
    expect(requireAIKeyMock).not.toHaveBeenCalled();
    expect(requireWithinAILimitMock).not.toHaveBeenCalled();
  });

  it("checks research access, then provider key, then rate budget", async () => {
    const order: string[] = [];
    requireResearchUserMock.mockImplementation(async () => {
      order.push("research");
      return { id: "owner" };
    });
    requireAIKeyMock.mockImplementation(() => {
      order.push("key");
    });
    requireWithinAILimitMock.mockImplementation(() => {
      order.push("rate");
    });

    const research = await gateResearchRequest();
    if (!research.ok) throw new Error("expected accepted research gate");
    const result = gateAIUsage(research.grant, "recommendations");
    expect(result.ok).toBe(true);
    expect(order).toEqual(["research", "key", "rate"]);
  });
});

describe("AI usage grants", () => {
  it("issues a surface-bound grant after research, key, and rate checks", async () => {
    const research = await gateResearchRequest();
    if (!research.ok) throw new Error("expected accepted research gate");
    const result = gateAIUsage(research.grant, "recommendations");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected accepted gate");

    expect(() =>
      assertAIUsageGrant(result.grant, "recommendations"),
    ).not.toThrow();
  });

  it("rejects a forged research grant before key or rate checks", () => {
    const forged = { userId: "owner" } as ResearchAccessGrant;

    expect(() => gateAIUsage(forged, "recommendations")).toThrow(
      /Missing research access grant/,
    );
    expect(requireAIKeyMock).not.toHaveBeenCalled();
    expect(requireWithinAILimitMock).not.toHaveBeenCalled();
  });

  it("rejects a forged grant at the provider library boundary", () => {
    const forged = {
      surface: "recommendations",
      userId: "owner",
    } as AIUsageGrant<"recommendations">;

    expect(() =>
      assertAIUsageGrant(forged, "recommendations"),
    ).toThrow(/Missing AI usage grant/);
  });

  it("returns Retry-After metadata when the rate budget is exhausted", async () => {
    requireWithinAILimitMock.mockImplementation(() => {
      throw new AIRateLimitError("paper_builder", 1_500);
    });

    const research = await gateResearchRequest();
    if (!research.ok) throw new Error("expected accepted research gate");
    const result = gateAIUsage(research.grant, "paper_builder");

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected rejected gate");
    expect(result.response.status).toBe(429);
    expect(result.response.headers.get("Retry-After")).toBe("2");
    await expect(result.response.json()).resolves.toMatchObject({
      retry_after_ms: 1_500,
    });
  });
});
