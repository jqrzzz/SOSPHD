import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  gateResearchRequest: vi.fn(),
  gateAIUsage: vi.fn(),
  generateRecommendationsForCase: vi.fn(),
  revalidatePath: vi.fn(),
  addEvent: vi.fn(),
  decideRecommendation: vi.fn(),
  getRecommendationById: vi.fn(),
}));

vi.mock("@/lib/ai/gate", () => ({
  gateResearchRequest: mocks.gateResearchRequest,
  gateAIUsage: mocks.gateAIUsage,
}));

vi.mock("@/lib/recommendations", () => ({
  RecommendationError: class RecommendationError extends Error {},
  generateRecommendationsForCase: mocks.generateRecommendationsForCase,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/data/store", () => ({
  addEvent: mocks.addEvent,
  decideRecommendation: mocks.decideRecommendation,
  getRecommendationById: mocks.getRecommendationById,
}));

import {
  addEventAction,
  decideRecommendationAction,
  generateRecommendationsAction,
} from "../actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.gateResearchRequest.mockResolvedValue({
    ok: true,
    userId: "owner",
    grant: { research: true },
  });
  mocks.gateAIUsage.mockReturnValue({
    ok: true,
    userId: "owner",
    grant: { test: true },
  });
  mocks.generateRecommendationsForCase.mockResolvedValue([
    { id: "rec-1" },
  ]);
});

describe("generateRecommendationsAction containment", () => {
  it.each([
    [401, "Authentication required"],
    [403, "Research access required"],
  ])("does not call the engine when research access returns %i", async (status, error) => {
    mocks.gateResearchRequest.mockResolvedValue({
      ok: false,
      response: Response.json({ error }, { status }),
    });

    const result = await generateRecommendationsAction("case-1", 3);

    expect(result).toEqual({ error });
    expect(mocks.gateAIUsage).not.toHaveBeenCalled();
    expect(mocks.generateRecommendationsForCase).not.toHaveBeenCalled();
  });

  it("validates action arguments before provider configuration or rate use", async () => {
    const result = await generateRecommendationsAction("", 9);

    expect(result.error).toBeTruthy();
    expect(mocks.gateAIUsage).not.toHaveBeenCalled();
    expect(mocks.generateRecommendationsForCase).not.toHaveBeenCalled();
  });

  it("does not call the engine when AI usage is rejected", async () => {
    mocks.gateAIUsage.mockReturnValue({
      ok: false,
      response: Response.json(
        { error: "Rate limit exceeded" },
        { status: 429 },
      ),
    });

    const result = await generateRecommendationsAction("case-1", 3);

    expect(result).toEqual({ error: "Rate limit exceeded" });
    expect(mocks.generateRecommendationsForCase).not.toHaveBeenCalled();
  });

  it("passes the issued grant to the engine on the allowed path", async () => {
    const result = await generateRecommendationsAction("case-1", 2);

    expect(result).toEqual({ success: true, count: 1 });
    expect(mocks.generateRecommendationsForCase).toHaveBeenCalledWith({
      caseId: "case-1",
      count: 2,
      grant: { test: true },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/cases/case-1");
  });
});

describe("shared research mutation containment", () => {
  it("denies addEventAction before reading form fields into a store write", async () => {
    mocks.gateResearchRequest.mockResolvedValue({
      ok: false,
      response: Response.json(
        { error: "Research access required" },
        { status: 403 },
      ),
    });
    const formData = new FormData();
    formData.set("case_id", "case-1");
    formData.set("event_type", "NOTE");
    formData.set("occurred_at", "2026-08-30T00:00:00.000Z");

    const result = await addEventAction(null, formData);

    expect(result).toEqual({ error: "Research access required" });
    expect(mocks.addEvent).not.toHaveBeenCalled();
  });

  it("denies decision access before recommendation lookup", async () => {
    mocks.gateResearchRequest.mockResolvedValue({
      ok: false,
      response: Response.json(
        { error: "Research access required" },
        { status: 403 },
      ),
    });

    const result = await decideRecommendationAction("rec-1", "accept");

    expect(result).toEqual({ error: "Research access required" });
    expect(mocks.getRecommendationById).not.toHaveBeenCalled();
    expect(mocks.decideRecommendation).not.toHaveBeenCalled();
    expect(mocks.addEvent).not.toHaveBeenCalled();
  });
});
