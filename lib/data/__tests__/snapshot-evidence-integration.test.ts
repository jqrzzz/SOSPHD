import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  requireAuthOrThrow: vi.fn(),
  getServerSupabase: vi.fn(),
  loadPaper1Evidence: vi.fn(),
  getCases: vi.fn(),
  getAllCaseEvents: vi.fn(),
  getAllRecommendations: vi.fn(),
  computeDashboardSummary: vi.fn(),
  computeCaseMetricRows: vi.fn(),
  computeMissingness: vi.fn(),
  classifyAllInterventions: vi.fn(),
}));
vi.mock("@/lib/supabase/server-auth", () => ({
  requireAuthOrThrow: mocks.requireAuthOrThrow,
  getServerSupabase: mocks.getServerSupabase,
}));
vi.mock("../paper1-snapshot", () => ({ loadPaper1Evidence: mocks.loadPaper1Evidence }));
vi.mock("../store", () => ({
  getCases: mocks.getCases,
  getAllCaseEvents: mocks.getAllCaseEvents,
  getAllRecommendations: mocks.getAllRecommendations,
}));
vi.mock("../analytics", () => ({
  computeDashboardSummary: mocks.computeDashboardSummary,
  computeCaseMetricRows: mocks.computeCaseMetricRows,
  computeMissingness: mocks.computeMissingness,
}));
vi.mock("../intervention", () => ({ classifyAllInterventions: mocks.classifyAllInterventions }));

import { createAnalysisSnapshot } from "../snapshots";

const owner = "00000000-0000-4000-8000-000000000001";
const paper1 = { version: 1, source: "backfill_2018_2023", syntheticEvidence: true };
const cases = [{ id: "synthetic-case-1" }, { id: "synthetic-case-2" }];
const events = [{ id: "synthetic-event-1" }];
const recommendations = [{ id: "synthetic-recommendation-1" }];
const meta = {
  id: "00000000-0000-4000-8000-000000000002",
  created_at: "2026-09-05T02:00:00Z",
  created_by: owner,
  label: "paper1-baseline-v1",
  note: "Synthetic test note",
  case_count: 2,
  event_count: 1,
  rec_count: 1,
};

function ownerClient() {
  const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
  const single = vi.fn().mockResolvedValue({ data: meta, error: null });
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  const from = vi.fn().mockReturnValue({ insert });
  const schema = vi.fn().mockReturnValue({ rpc, from });
  return { sb: { schema }, rpc, from, insert, select, single };
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.loadPaper1Evidence.mockResolvedValue(paper1);
  mocks.getCases.mockResolvedValue(cases);
  mocks.getAllCaseEvents.mockResolvedValue(events);
  mocks.getAllRecommendations.mockResolvedValue(recommendations);
  mocks.computeDashboardSummary.mockReturnValue({ synthetic: "summary" });
  mocks.computeCaseMetricRows.mockReturnValue([{ synthetic: "row" }]);
  mocks.computeMissingness.mockReturnValue({ synthetic: "missingness" });
  mocks.classifyAllInterventions.mockReturnValue([{ synthetic: "intervention" }]);
});

describe("Paper 1 evidence in analysis snapshots", () => {
  it("uses the authenticated owner client and inserts the computed evidence with the existing analysis", async () => {
    const client = ownerClient();
    mocks.requireAuthOrThrow.mockResolvedValue({ supabase: client.sb, userId: owner });

    const result = await createAnalysisSnapshot("paper1-baseline-v1", "Synthetic test note");

    expect(result).toEqual(meta);
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith("is_allowed_user");
    expect(mocks.loadPaper1Evidence).toHaveBeenCalledExactlyOnceWith(client.sb);
    expect(client.sb.schema.mock.calls.every(([schema]) => schema === "research")).toBe(true);
    expect(client.from).toHaveBeenCalledExactlyOnceWith("analysis_snapshots");
    expect(client.insert).toHaveBeenCalledOnce();
    const inserted = client.insert.mock.calls[0][0];
    expect(inserted).toMatchObject({
      created_by: owner,
      label: "paper1-baseline-v1",
      note: "Synthetic test note",
      case_count: 2,
      event_count: 1,
      rec_count: 1,
      payload: {
        paper1,
        summary: { synthetic: "summary" },
        rows: [{ synthetic: "row" }],
        missingness: { synthetic: "missingness" },
        interventions: [{ synthetic: "intervention" }],
      },
    });
    expect(inserted.payload.paper1).toBe(paper1);
    expect(Number.isFinite(Date.parse(inserted.payload.generated_at))).toBe(true);
    expect(mocks.computeDashboardSummary).toHaveBeenCalledWith(cases, events, recommendations);
    expect(mocks.computeCaseMetricRows).toHaveBeenCalledWith(cases, events, recommendations);
    expect(mocks.computeMissingness).toHaveBeenCalledWith(cases, events);
    expect(mocks.classifyAllInterventions).toHaveBeenCalledWith(cases.map((row) => row.id), events, recommendations);
    expect(mocks.loadPaper1Evidence.mock.invocationCallOrder[0]).toBeGreaterThan(client.rpc.mock.invocationCallOrder[0]);
    for (const storeRead of [mocks.getCases, mocks.getAllCaseEvents, mocks.getAllRecommendations]) {
      expect(storeRead.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.loadPaper1Evidence.mock.invocationCallOrder[0]);
      expect(client.insert.mock.invocationCallOrder[0]).toBeGreaterThan(storeRead.mock.invocationCallOrder[0]);
    }
    expect(mocks.getServerSupabase).not.toHaveBeenCalled();
  });

  it.each([
    { data: false, error: null },
    { data: null, error: null },
    { data: true, error: { message: "SYNTHETIC_PRIVATE_ERROR" } },
  ])("requires a positive allowlist result before any data read: %j", async (access) => {
    const client = ownerClient();
    client.rpc.mockResolvedValue(access);
    mocks.requireAuthOrThrow.mockResolvedValue({ supabase: client.sb, userId: owner });

    await expect(createAnalysisSnapshot("paper1-baseline-v1")).rejects.toThrow(/^Research access required to freeze a snapshot\.$/);

    expect(mocks.loadPaper1Evidence).not.toHaveBeenCalled();
    expect(mocks.getCases).not.toHaveBeenCalled();
    expect(mocks.getAllCaseEvents).not.toHaveBeenCalled();
    expect(mocks.getAllRecommendations).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
    expect(client.insert).not.toHaveBeenCalled();
  });

  it("sanitizes a rejected allowlist request before any data read", async () => {
    const client = ownerClient();
    client.rpc.mockRejectedValue(new Error("SYNTHETIC_PRIVATE_ERROR"));
    mocks.requireAuthOrThrow.mockResolvedValue({ supabase: client.sb, userId: owner });
    await expect(createAnalysisSnapshot("paper1-baseline-v1")).rejects.toThrow(/^Research access required to freeze a snapshot\.$/);
    expect(mocks.loadPaper1Evidence).not.toHaveBeenCalled();
    expect(mocks.getCases).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
  });

  it("fails authentication before accessing the client or evidence", async () => {
    const client = ownerClient();
    mocks.requireAuthOrThrow.mockRejectedValue(new Error("Authentication required"));
    await expect(createAnalysisSnapshot("paper1-baseline-v1")).rejects.toThrow("Authentication required");
    expect(client.sb.schema).not.toHaveBeenCalled();
    expect(mocks.getServerSupabase).not.toHaveBeenCalled();
    expect(mocks.loadPaper1Evidence).not.toHaveBeenCalled();
    expect(mocks.getCases).not.toHaveBeenCalled();
    expect(client.insert).not.toHaveBeenCalled();
  });

  it("does not insert or run dashboard reads when complete evidence cannot be captured", async () => {
    const client = ownerClient();
    mocks.requireAuthOrThrow.mockResolvedValue({ supabase: client.sb, userId: owner });
    mocks.loadPaper1Evidence.mockRejectedValue(new Error("Paper 1 events read is incomplete. No evidence was frozen."));
    await expect(createAnalysisSnapshot("paper1-baseline-v1")).rejects.toThrow("read is incomplete");
    expect(mocks.getCases).not.toHaveBeenCalled();
    expect(mocks.getAllCaseEvents).not.toHaveBeenCalled();
    expect(mocks.getAllRecommendations).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
    expect(client.insert).not.toHaveBeenCalled();
  });
});
