import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ store: vi.fn(), load: vi.fn(), save: vi.fn(), invalidate: vi.fn() }));
vi.mock("@/lib/data/doc-revision-store", () => ({ getRevisionStore: mocks.store, hashRevision: (text: string) => text }));
vi.mock("@/lib/docs/revision-service", () => ({ loadRevisionSource: mocks.load, saveSectionDraft: mocks.save }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.invalidate }));
import { loadSectionRevisionAction, saveSectionRevisionAction } from "@/lib/doc-revision-actions";
import { RevisionError } from "../section-revision";
beforeEach(() => { vi.clearAllMocks(); mocks.store.mockResolvedValue({ store: {}, owner: "owner" }); });
it("auth failure prevents any draft operation", async () => {
  mocks.store.mockRejectedValue(new Error("AUTH_PRIVATE_CANARY"));
  const result = await saveSectionRevisionAction({});
  expect(result.ok).toBe(false); expect(mocks.save).not.toHaveBeenCalled(); expect(JSON.stringify(result)).not.toContain("AUTH_PRIVATE_CANARY");
});
it("source-load errors return no content or fallback", async () => {
  mocks.load.mockRejectedValue(new Error("CONTENT_CANARY"));
  const result = await loadSectionRevisionAction("source");
  expect(result.ok).toBe(false); expect(result).not.toHaveProperty("source"); expect(JSON.stringify(result)).not.toContain("CONTENT_CANARY");
});
it("stale source is explained without invalidation", async () => {
  mocks.save.mockRejectedValue(new RevisionError("stale_source", "Reload the source."));
  expect(await saveSectionRevisionAction({})).toEqual({ ok: false, code: "stale_source", error: "Reload the source." });
  expect(mocks.invalidate).not.toHaveBeenCalled();
});
it("only confirmed persistence is labelled saved", async () => {
  mocks.save.mockResolvedValue({ doc_id: "draft", replayed: false });
  expect(await saveSectionRevisionAction({})).toEqual({ ok: true, doc_id: "draft", replayed: false });
  expect(mocks.invalidate).toHaveBeenCalledWith("/docs");
});
it("cache failure cannot turn a saved draft into a claimed failed write", async () => {
  mocks.save.mockResolvedValue({ doc_id: "draft", replayed: true }); mocks.invalidate.mockImplementation(() => { throw new Error("cache failed"); });
  expect(await saveSectionRevisionAction({})).toEqual({ ok: true, doc_id: "draft", replayed: true });
});
