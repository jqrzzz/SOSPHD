import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
const browser = vi.hoisted(() => ({ getSupabase: vi.fn(() => null) }));
vi.mock("@/lib/supabase/db", () => browser);
import { getJournalPage, getFieldworkSupport, parseJournalQuery } from "@/lib/data/fieldwork-reader";

const OWNER = "10000000-0000-4000-8000-000000000001";
function clientFixture(reply = { data: [] as any[], error: null as unknown, count: 0 as number | null }) {
  const calls: Array<[string, unknown[]]> = [];
  const q: any = {};
  for (const name of ["select", "eq", "order", "or", "contains", "range", "limit"]) {
    q[name] = vi.fn((...args) => { calls.push([name, args]); return q; });
  }
  q.then = (resolve: (v: unknown) => unknown) => Promise.resolve(reply).then(resolve);
  const db = { from: vi.fn(() => q), rpc: vi.fn(async () => ({ data: true, error: null })) };
  const sb = { auth: { getUser: vi.fn(async () => ({ data: { user: { id: OWNER } }, error: null })) }, schema: vi.fn(() => db) };
  return { client: sb as unknown as SupabaseClient, sb, db, q, calls, reply };
}
const minimalRow = { id: "20000000-0000-4000-8000-000000000001", user_id: OWNER, title: "Title", content: "Details", tags: [], contact_ids: [], attachments: [] };

describe("explicit paged fieldwork reads", () => {
  it("distinguishes successful empty from unavailable", async () => {
    const f = clientFixture();
    expect(await getJournalPage({}, f.client)).toMatchObject({ ok: true, data: { entries: [], total: 0, has_more: false } });
    f.reply.error = { message: "PRIVATE_DATABASE_ERROR" };
    const unavailable = await getJournalPage({}, f.client);
    expect(unavailable.ok).toBe(false);
    expect(JSON.stringify(unavailable)).not.toContain("PRIVATE_DATABASE_ERROR");
    expect(unavailable).not.toHaveProperty("data");
  });
  it("filters older searches and pins before the range, with stable ordering", async () => {
    const f = clientFixture({ data: Array.from({ length: 21 }, (_, i) => ({ ...minimalRow, id: `row-${i}` })), error: null, count: 121 });
    const r = await getJournalPage({ page: 2, search: 'x,title.eq.y', entry_type: "interview", pinned_only: true, tag: "laos" }, f.client);
    expect(r).toMatchObject({ ok: true, data: { page: 2, total: 121, has_more: false } });
    expect(f.q.eq).toHaveBeenCalledWith("user_id", OWNER);
    expect(f.q.eq).toHaveBeenCalledWith("entry_type", "interview");
    expect(f.q.eq).toHaveBeenCalledWith("is_pinned", true);
    expect(f.q.contains).toHaveBeenCalledWith("tags", ["laos"]);
    expect(f.q.or).toHaveBeenCalledWith('title.ilike."%x,title.eq.y%",content.ilike."%x,title.eq.y%",location.ilike."%x,title.eq.y%"');
    expect(f.calls.at(-1)).toEqual(["range", [100, 149]]);
    expect(f.q.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(f.q.order).toHaveBeenCalledWith("id", { ascending: false });
  });
  it("rejects unexpected partial pages instead of skipping unreturned rows", async () => {
    const f = clientFixture({ data: [minimalRow], error: null, count: 121 });
    expect((await getJournalPage({ page: 2 }, f.client)).ok).toBe(false);
  });
  it("does not turn a missing exact count into zero", async () => {
    const f = clientFixture({ data: [], error: null, count: null });
    expect((await getJournalPage({}, f.client)).ok).toBe(false);
  });
  it("fails closed on malformed or wrong-owner results", async () => {
    for (const data of [[{}], [{ ...minimalRow, user_id: "someone-else" }]]) {
      const f = clientFixture({ data, error: null, count: 1 });
      expect((await getJournalPage({}, f.client)).ok).toBe(false);
    }
  });
  it("an explicit null client does not fall through to browser defaults", async () => {
    browser.getSupabase.mockClear();
    expect((await getJournalPage({}, null)).ok).toBe(false);
    expect(browser.getSupabase).not.toHaveBeenCalled();
  });
  it("checks the allowlist before reading journal rows", async () => {
    const f = clientFixture();
    f.db.rpc.mockResolvedValue({ data: false, error: null });
    expect((await getJournalPage({}, f.client)).ok).toBe(false);
    expect(f.db.from).not.toHaveBeenCalled();
  });
  it("handles thrown authentication failures without empty data", async () => {
    const f = clientFixture();
    f.sb.auth.getUser.mockRejectedValue(new Error("PRIVATE_AUTH_ERROR"));
    expect((await getJournalPage({}, f.client)).ok).toBe(false);
    expect(f.db.from).not.toHaveBeenCalled();
  });
  it.each([{ page: -1 }, { page: 0.5 }, { page: 10001 }, { search: "a".repeat(101) }, { entry_type: "unknown" }, { tag: "\0" }, { pinned_only: "yes" }])("rejects invalid filter %j", async (input) => {
    const f = clientFixture();
    expect((await getJournalPage(input as any, f.client)).ok).toBe(false);
    expect(f.sb.auth.getUser).not.toHaveBeenCalled();
  });
  it("keeps inputs unchanged and does not silently truncate", () => {
    const input = { search: "  plain  ", page: 0 };
    expect(parseJournalQuery(input).search).toBe("plain");
    expect(input.search).toBe("  plain  ");
    expect(() => parseJournalQuery({ tag: "t".repeat(101) })).toThrow();
  });
  it("makes support-list failures explicit", async () => {
    const f = clientFixture();
    expect(await getFieldworkSupport(f.client)).toMatchObject({ ok: true, data: { contacts: [], contact_total: 0 } });
    f.reply.error = "down";
    expect((await getFieldworkSupport(f.client)).ok).toBe(false);
  });
});
