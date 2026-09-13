import { describe, expect, it, vi } from "vitest";
import { saveJournalCapture, type JournalCaptureRow, type JournalCaptureStore } from "../journal-capture";
import type { JournalEntry } from "@/lib/data/fieldwork-types";

const OWNER = "10000000-0000-4000-8000-000000000001";
const ID = "20000000-0000-4000-8000-000000000001";
const row = (): JournalCaptureRow => ({
  id: ID, user_id: OWNER, entry_type: "idea", title: "Synthetic reflection", content: "Synthetic details ລາວ",
  location: null, corridor: null, tags: [], contact_ids: [], linked_case_id: null, attachments: [], is_pinned: false,
  consent_status: "not_required", consent_method: null, consent_jurisdiction: null, consent_captured_at: null,
});
function fixture() {
  const rows = new Map<string, JournalEntry>();
  const store: JournalCaptureStore = {
    read: vi.fn(async (id) => rows.get(id) ?? null),
    insert: vi.fn(async (value) => {
      if (rows.has(value.id)) throw new Error("duplicate");
      rows.set(value.id, { ...structuredClone(value), created_at: "2030-01-01T00:00:00Z", updated_at: "2030-01-01T00:00:00Z" });
    }),
  };
  return { rows, store };
}

describe("confirmed journal capture", () => {
  it("reads the full saved entry back before reporting success", async () => {
    const { store } = fixture();
    const result = await saveJournalCapture(store, row());
    expect(result.entry.content).toBe(row().content);
    expect(result.replayed).toBe(false);
    expect(store.read).toHaveBeenCalledTimes(2);
    expect(store.insert).toHaveBeenCalledOnce();
  });
  it("recovers identical retries without a second insert", async () => {
    const { store } = fixture();
    await saveJournalCapture(store, row());
    expect((await saveJournalCapture(store, row())).replayed).toBe(true);
    expect(store.insert).toHaveBeenCalledOnce();
  });
  it.each(["title", "content", "entry_type", "consent_status", "location", "user_id"])("does not overwrite changed %s", async (key) => {
    const { store, rows } = fixture();
    await saveJournalCapture(store, row());
    const existing = rows.get(ID)!;
    (existing as unknown as Record<string, unknown>)[key] = "CHANGED";
    await expect(saveJournalCapture(store, row())).rejects.toMatchObject({ code: "request_conflict" });
    expect(store.insert).toHaveBeenCalledOnce();
    expect((rows.get(ID) as unknown as Record<string, unknown>)[key]).toBe("CHANGED");
  });
  it("recovers an insert whose response failed after persistence", async () => {
    const { store, rows } = fixture();
    const insert = store.insert;
    store.insert = vi.fn(async (value) => { await insert(value); throw new Error("response lost"); });
    expect((await saveJournalCapture(store, row())).replayed).toBe(true);
    expect(rows.size).toBe(1);
  });
  it("does not write when the preliminary read is unavailable", async () => {
    const { store } = fixture();
    store.read = vi.fn().mockRejectedValue(new Error("PRIVATE_ERROR"));
    await expect(saveJournalCapture(store, row())).rejects.toMatchObject({ code: "unconfirmed" });
    expect(store.insert).not.toHaveBeenCalled();
  });
  it("reports an unconfirmed readback, then safely recovers the same ID", async () => {
    const { store, rows } = fixture();
    const read = store.read;
    store.read = vi.fn().mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("down"));
    await expect(saveJournalCapture(store, row())).rejects.toMatchObject({ code: "unconfirmed" });
    expect(rows.size).toBe(1);
    store.read = read;
    expect((await saveJournalCapture(store, row())).replayed).toBe(true);
    expect(store.insert).toHaveBeenCalledOnce();
  });
  it("does not mistake an absent readback for a save", async () => {
    const { store } = fixture();
    store.insert = vi.fn().mockResolvedValue(undefined);
    await expect(saveJournalCapture(store, row())).rejects.toMatchObject({ code: "unconfirmed" });
  });
  it("never forwards raw insert errors", async () => {
    const { store } = fixture();
    store.insert = vi.fn().mockRejectedValue(new Error("PRIVATE_CANARY"));
    await expect(saveJournalCapture(store, row())).rejects.not.toThrow("PRIVATE_CANARY");
  });
  it("two concurrent identical requests produce one record", async () => {
    const { store, rows } = fixture();
    const results = await Promise.all([saveJournalCapture(store, row()), saveJournalCapture(store, row())]);
    expect(results.every((r) => r.entry.id === ID)).toBe(true);
    expect(rows.size).toBe(1);
  });
  it("pinning and receipt timestamps do not invalidate an identical retry", async () => {
    const { store, rows } = fixture();
    await saveJournalCapture(store, row());
    rows.get(ID)!.is_pinned = true;
    rows.get(ID)!.updated_at = "2030-01-02T00:00:00Z";
    expect((await saveJournalCapture(store, row())).replayed).toBe(true);
  });
  it("rejects malformed IDs before touching storage", async () => {
    const { store } = fixture();
    await expect(saveJournalCapture(store, { ...row(), id: "not-a-uuid" })).rejects.toMatchObject({ code: "invalid_input" });
    expect(store.read).not.toHaveBeenCalled();
  });
});
