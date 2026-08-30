import { describe, expect, it, vi } from "vitest";

vi.mock("../tools", () => ({
  AGENT_TOOLS: [],
  getToolByName: vi.fn(),
}));

import { getAgentCapabilities } from "../core";

describe("getAgentCapabilities", () => {
  it("advertises both authentication and research allowlist requirements", () => {
    expect(getAgentCapabilities().contractProtocol.auth).toBe(
      "supabase-jwt + research.allowed_users",
    );
  });
});
