import { beforeEach, describe, expect, it, vi } from "vitest";
const calls = vi.hoisted(() => ({ createJournalEntry: vi.fn(), updateJournalEntry: vi.fn(),
  createProtocolFromTemplate: vi.fn(), updateProtocol: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: calls.revalidatePath }));
vi.mock("@/lib/data/fieldwork-mutations", () => ({ ...calls, deleteJournalEntry: vi.fn(), createContact: vi.fn(),
  updateContact: vi.fn(), deleteContact: vi.fn(), recordContactEmail: vi.fn() }));
import { createJournalAction, startProtocolAction, updateProtocolAction, togglePinAction } from "@/lib/fieldwork-actions";
import { JournalCaptureError } from "../journal-capture";
const ID = "20000000-0000-4000-8000-000000000001";
function form() {
  const f = new FormData();
  Object.entries({ request_id: ID, entry_type: "idea", title: "Synthetic", content: "Synthetic note", corridor: "__none", consent_status: "not_required" })
    .forEach(([k, v]) => f.set(k, v));
  return f;
}
beforeEach(() => { vi.resetAllMocks(); calls.createJournalEntry.mockResolvedValue({ id: ID }); });

describe("fieldwork action failure contracts", () => {
  it("forwards the stable ID and maps the explicit None selector to null", async () => {
    expect(await createJournalAction(null, form())).toMatchObject({ success: true, id: ID });
    expect(calls.createJournalEntry).toHaveBeenCalledWith(expect.objectContaining({ request_id: ID, corridor: null }));
  });
  it("rejects invalid input without clearing it or attempting a write", async () => {
    const f = form(); f.set("content", "  ");
    expect(await createJournalAction(null, f)).toMatchObject({ code: "invalid_input" });
    expect(calls.createJournalEntry).not.toHaveBeenCalled();
    expect(f.get("content")).toBe("  ");
  });
  it("does not expose raw database or auth errors", async () => {
    calls.createJournalEntry.mockRejectedValue(new Error("PRIVATE_CANARY"));
    const result = await createJournalAction(null, form());
    expect(result).toMatchObject({ code: "unconfirmed" });
    expect(JSON.stringify(result)).not.toContain("PRIVATE_CANARY");
  });
  it("preserves recoverable error codes", async () => {
    calls.createJournalEntry.mockRejectedValue(new JournalCaptureError("request_conflict", "Different saved content"));
    expect(await createJournalAction(null, form())).toMatchObject({ code: "request_conflict" });
  });
  it("cache failure does not change a confirmed persistence result", async () => {
    calls.revalidatePath.mockImplementation(() => { throw new Error("cache unavailable"); });
    expect(await createJournalAction(null, form())).toMatchObject({ success: true });
  });
  it.each(["start", "update", "pin"])("returns a controlled %s failure", async (kind) => {
    calls.createProtocolFromTemplate.mockRejectedValue(new Error("PRIVATE_CANARY"));
    calls.updateProtocol.mockRejectedValue(new Error("PRIVATE_CANARY"));
    calls.updateJournalEntry.mockRejectedValue(new Error("PRIVATE_CANARY"));
    const result = kind === "start" ? await startProtocolAction(ID, {}) : kind === "update" ? await updateProtocolAction(ID, {}) : await togglePinAction(ID, true);
    expect(result).toHaveProperty("error");
    expect(result).not.toHaveProperty("success");
    expect(JSON.stringify(result)).not.toContain("PRIVATE_CANARY");
  });
});
