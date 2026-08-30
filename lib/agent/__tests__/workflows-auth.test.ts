import { beforeEach, describe, expect, it, vi } from "vitest";

const { executeAgentMock, requireResearchUserMock } = vi.hoisted(() => ({
  executeAgentMock: vi.fn(),
  requireResearchUserMock: vi.fn(),
}));

vi.mock("../core", () => ({
  executeAgent: executeAgentMock,
}));

vi.mock("@/lib/auth/research-user", () => ({
  requireResearchUser: requireResearchUserMock,
}));

import { handleAgentContract } from "../workflows";

beforeEach(() => {
  vi.clearAllMocks();
  requireResearchUserMock.mockResolvedValue({ id: "owner" });
  executeAgentMock.mockResolvedValue({ success: true });
});

describe("handleAgentContract", () => {
  it("checks research authorization before caller validation or execution", async () => {
    requireResearchUserMock.mockRejectedValue(
      new Error("Research access required"),
    );

    await expect(
      handleAgentContract({
        action: "research_status",
        caller: { system: "user" },
      }),
    ).rejects.toThrow("Research access required");
    expect(executeAgentMock).not.toHaveBeenCalled();
  });

  it("executes a valid contract only after research authorization", async () => {
    await expect(
      handleAgentContract({
        action: "research_status",
        params: { scope: "summary" },
        caller: { system: "user", context: "dashboard" },
      }),
    ).resolves.toEqual({ success: true });

    expect(requireResearchUserMock).toHaveBeenCalledOnce();
    expect(executeAgentMock).toHaveBeenCalledWith({
      action: "research_status",
      params: { scope: "summary" },
      caller: { system: "user", context: "dashboard" },
    });
  });
});
