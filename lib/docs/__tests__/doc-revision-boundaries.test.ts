import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ allowed: vi.fn(), auth: vi.fn(), result: { data: null as unknown, error: null as unknown }, calls: [] as unknown[][] }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/research-user", () => ({ requireResearchUser: mocks.allowed }));
vi.mock("@/lib/supabase/server-auth", () => ({ requireAuthOrThrow: mocks.auth }));
import { getRevisionStore } from "@/lib/data/doc-revision-store";

function client() {
  const q = {
    select: (...args: unknown[]) => { mocks.calls.push(["select", ...args]); return q; },
    eq: (...args: unknown[]) => { mocks.calls.push(["eq", ...args]); return q; },
    order: (...args: unknown[]) => { mocks.calls.push(["order", ...args]); return q; },
    limit: async (...args: unknown[]) => { mocks.calls.push(["limit", ...args]); return mocks.result; },
    maybeSingle: async () => mocks.result,
    insert: async (...args: unknown[]) => { mocks.calls.push(["insert", ...args]); return mocks.result; },
  };
  return { schema: (schema: string) => { mocks.calls.push(["schema", schema]); return {
    from: (table: string) => { mocks.calls.push(["from", table]); return q; },
  }; } };
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.calls = []; mocks.result = { data: null, error: null };
  mocks.allowed.mockResolvedValue({ id: "owner" }); mocks.auth.mockResolvedValue({ userId: "owner", supabase: client() });
});
describe("section revision database boundary", () => {
  it("checks the allowlist before resolving the authenticated client", async () => {
    mocks.allowed.mockRejectedValue(new Error("denied"));
    await expect(getRevisionStore()).rejects.toThrow(); expect(mocks.auth).not.toHaveBeenCalled();
  });
  it("does not permit an allowlist/client identity mismatch", async () => {
    mocks.allowed.mockResolvedValue({ id: "someone-else" });
    await expect(getRevisionStore()).rejects.toMatchObject({ code: "unavailable" }); expect(mocks.calls).toEqual([]);
  });
  it("does not turn a missing authenticated session into dev seed data", async () => {
    mocks.auth.mockRejectedValue(new Error("no session")); await expect(getRevisionStore()).rejects.toThrow();
    expect(mocks.calls).toEqual([]);
  });
  it.each(["readDoc", "readVersion"] as const)("%s uses research tables and both identifier/owner filters", async (method) => {
    const { store } = await getRevisionStore(); await store[method]("record-id");
    expect(mocks.calls).toContainEqual(["schema", "research"]);
    expect(mocks.calls).toContainEqual(["eq", "id", "record-id"]);
    expect(mocks.calls).toContainEqual(["eq", "user_id", "owner"]);
  });
  it("limits notes to the correct document and owner without omitting excess notes", async () => {
    mocks.result = { data: Array(201).fill({}), error: null };
    const { store } = await getRevisionStore();
    await expect(store.readAnnotations("document-id")).rejects.toMatchObject({ code: "unavailable" });
    expect(mocks.calls).toContainEqual(["eq", "doc_id", "document-id"]);
    expect(mocks.calls).toContainEqual(["eq", "user_id", "owner"]);
    expect(mocks.calls).toContainEqual(["eq", "resolved", false]);
  });
  it("query errors fail closed without private errors in messages", async () => {
    mocks.result = { data: null, error: { message: "PRIVATE_CANARY" } };
    const { store } = await getRevisionStore();
    await expect(store.readDoc("record-id")).rejects.not.toThrow("PRIVATE_CANARY");
  });
  it("absence is returned as absence, not a seed manuscript", async () => {
    const { store } = await getRevisionStore(); expect(await store.readDoc("record-id")).toBeNull();
  });
  it("an insert with a foreign owner is rejected before a table write", async () => {
    const { store } = await getRevisionStore();
    await expect(store.insertVersion({ id: "v", doc_id: "d", user_id: "other", content_md: "text", note: "note" })).rejects.toThrow();
    expect(mocks.calls.filter((c) => c[0] === "insert")).toHaveLength(0);
  });
  it("inserts an archived base into research.doc_versions without update or upsert", async () => {
    const { store } = await getRevisionStore();
    await store.insertVersion({ id: "v", doc_id: "d", user_id: "owner", content_md: "text", note: "note" });
    expect(mocks.calls).toContainEqual(["from", "doc_versions"]);
    expect(mocks.calls.filter((c) => c[0] === "insert")).toHaveLength(1);
  });
});
