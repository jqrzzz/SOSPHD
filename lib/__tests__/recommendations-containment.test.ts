import { beforeEach, describe, expect, it, vi } from "vitest";
import { NoObjectGeneratedError } from "ai";
import type { AIUsageGrant } from "@/lib/ai/gate";

const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
  modelFor: vi.fn(),
  assertAIUsageGrant: vi.fn(),
  getCaseById: vi.fn(),
  getEventsByCaseId: vi.fn(),
  createRecommendation: vi.fn(),
}));

vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return { ...actual, generateText: mocks.generateText };
});

vi.mock("@/lib/ai/config", () => ({
  modelFor: mocks.modelFor,
}));

vi.mock("@/lib/ai/gate", () => ({
  assertAIUsageGrant: mocks.assertAIUsageGrant,
}));

vi.mock("@/lib/data/store", () => ({
  getCaseById: mocks.getCaseById,
  getEventsByCaseId: mocks.getEventsByCaseId,
  createRecommendation: mocks.createRecommendation,
}));

import {
  generateRecommendationsForCase,
  RecommendationError,
} from "../recommendations";

const grant = { test: true } as unknown as AIUsageGrant<"recommendations">;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.modelFor.mockReturnValue({ modelId: "test-model" });
  mocks.getCaseById.mockResolvedValue({
    id: "case-1",
    patient_ref: "CASE-001",
    status: "active",
    severity: 2,
    chief_complaint: "de-identified complaint",
    created_at: "2026-08-30T00:00:00.000Z",
    notes: "",
    site_id: "site-1",
    source: "operational",
  });
  mocks.getEventsByCaseId.mockResolvedValue([]);
});

describe("recommendation provider boundary", () => {
  it("uses schema-validated structured output with an explicit token cap", async () => {
    mocks.generateText.mockResolvedValue({
      output: {
        recommendations: [
          {
            recommendation: "Confirm transport availability.",
            explanation: "Transport activation is not yet recorded.",
            confidence: 0.6,
            category: "transport",
          },
        ],
      },
    });
    mocks.createRecommendation.mockResolvedValue({
      id: "rec-1",
      case_id: "case-1",
    });

    const result = await generateRecommendationsForCase({
      caseId: "case-1",
      count: 1,
      grant,
    });

    expect(result).toHaveLength(1);
    expect(mocks.assertAIUsageGrant).toHaveBeenCalledWith(
      grant,
      "recommendations",
    );
    expect(mocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        maxOutputTokens: 1_536,
        output: expect.anything(),
      }),
    );
  });

  it("never writes or logs raw malformed model output", async () => {
    const canary = "SOSPHD_CANARY_SECRET";
    mocks.generateText.mockRejectedValue(
      new NoObjectGeneratedError({
        message: `invalid output containing ${canary}`,
        text: `raw provider text ${canary}`,
        response: {} as never,
        usage: {} as never,
        finishReason: "error",
      }),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    let thrown: unknown;
    try {
      await generateRecommendationsForCase({
        caseId: "case-1",
        count: 1,
        grant,
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(RecommendationError);
    expect(thrown).toMatchObject({
      status: 502,
      detail: { code: "invalid_model_json" },
    });
    expect(mocks.createRecommendation).not.toHaveBeenCalled();
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(canary);
    expect(JSON.stringify(thrown)).not.toContain(canary);
    errorSpy.mockRestore();
  });
});
