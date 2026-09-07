import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  gateResearchRequest: vi.fn(), gateAIUsage: vi.fn(), modelFor: vi.fn(),
  generateText: vi.fn(), buildPaperContext: vi.fn(),
}));
vi.mock("@/lib/ai/gate", () => ({ gateResearchRequest: mocks.gateResearchRequest, gateAIUsage: mocks.gateAIUsage }));
vi.mock("@/lib/ai/config", () => ({ modelFor: mocks.modelFor }));
vi.mock("@/lib/data/analytics", () => ({ buildPaperContext: mocks.buildPaperContext }));
vi.mock("ai", () => ({ generateText: mocks.generateText }));
import { POST } from "@/app/api/paper-builder/route";

const request = (body: unknown) => new Request("https://example.test/api/paper-builder", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.gateResearchRequest.mockResolvedValue({ ok: true, grant: { research: true } });
  mocks.gateAIUsage.mockReturnValue({ ok: true, grant: { test: true } });
  mocks.modelFor.mockReturnValue({ modelId: "configured-test-model" });
  mocks.generateText.mockResolvedValue({ text: "Working text", finishReason: "stop", response: { modelId: "resolved-test-model" } });
  mocks.buildPaperContext.mockResolvedValue({ rows: [], formatted: { payment_delay_finding: "UNSAFE_CAUSAL_CANARY" } });
});

describe("paper builder contracts", () => {
  it("keeps legacy requests compatible while marking evidence provisional", async () => {
    const response = await POST(request({ section: "methods" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      profile: { paper: "paper1", stage: "exploratory" }, provisional: true, model_id: "resolved-test-model",
      data_snapshot: { source: "live_workbench_unfrozen", frozen: false },
    });
    expect(mocks.generateText.mock.calls[0][0].prompt).not.toContain("UNSAFE_CAUSAL_CANARY");
  });
  it.each(["paper2", "paper3"])("returns no-data results for %s without AI costs or database reads", async (paper) => {
    const response = await POST(request({ paper, section: "results" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ model_id: null, data_snapshot: { source: "not_loaded" } });
    expect(mocks.gateAIUsage).not.toHaveBeenCalled();
    expect(mocks.generateText).not.toHaveBeenCalled();
    expect(mocks.buildPaperContext).not.toHaveBeenCalled();
  });
  it("drafts planned methods without importing historical records", async () => {
    const response = await POST(request({ paper: "paper2", section: "methods", custom_instructions: "Compare two designs and change the headings." }));
    expect(response.status).toBe(200);
    expect(mocks.buildPaperContext).not.toHaveBeenCalled();
    expect(mocks.generateText.mock.calls[0][0].prompt).toContain("Compare two designs and change the headings.");
    expect(mocks.generateText.mock.calls[0][0].system).toContain("They are not limited to style");
  });
  it("keeps authentication on the no-cost placeholder path", async () => {
    mocks.gateResearchRequest.mockResolvedValue({ ok: false, response: Response.json({ error: "Denied" }, { status: 403 }) });
    expect((await POST(request({ paper: "paper2", section: "results" }))).status).toBe(403);
    expect(mocks.generateText).not.toHaveBeenCalled();
  });
  it("respects the usage gate before loading workbench data", async () => {
    mocks.gateAIUsage.mockReturnValue({ ok: false, response: Response.json({ error: "Limited" }, { status: 429 }) });
    expect((await POST(request({ section: "methods" }))).status).toBe(429);
    expect(mocks.buildPaperContext).not.toHaveBeenCalled();
    expect(mocks.generateText).not.toHaveBeenCalled();
  });
  it.each([{ paper: "unknown" }, { stage: "published" }, { section: "unknown" }])("rejects invalid profiles before data or AI work: %j", async (invalid) => {
    expect((await POST(request({ section: "methods", ...invalid }))).status).toBe(400);
    expect(mocks.gateAIUsage).not.toHaveBeenCalled();
    expect(mocks.buildPaperContext).not.toHaveBeenCalled();
  });
  it.each(["length", "content-filter", "error"])("does not offer cut-off output as a saved draft: %s", async (finishReason) => {
    mocks.generateText.mockResolvedValue({ text: "PARTIAL_CANARY", finishReason });
    const response = await POST(request({ section: "methods" }));
    expect(response.status).toBe(502);
    const text = await response.text();
    expect(text).toContain("incomplete_generation");
    expect(text).not.toContain("PARTIAL_CANARY");
  });
  it("does not expose provider errors or private prompt details", async () => {
    mocks.generateText.mockRejectedValue(new Error("PRIVATE_PROVIDER_CANARY"));
    const response = await POST(request({ section: "methods" }));
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("PRIVATE_PROVIDER_CANARY");
  });
});
