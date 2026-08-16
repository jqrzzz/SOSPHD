import { describe, expect, it } from "vitest";
import { bandAttention, type AttentionItem } from "../attention-types";

const mk = (o: Partial<AttentionItem>): AttentionItem => ({
  id: "x", kind: "deadline", title: "t", detail: "", days: 10, href: "/", weight: 10, ...o,
});

describe("bandAttention", () => {
  it("bands dated items by days remaining", () => {
    const b = bandAttention([
      mk({ id: "past", days: -3 }),
      mk({ id: "soon", days: 12 }),
      mk({ id: "edge30", days: 30 }),
      mk({ id: "ahead", days: 31 }),
      mk({ id: "edge120", days: 120 }),
      mk({ id: "far", days: 400 }),
    ]);
    expect(b.overdue.map((i) => i.id)).toEqual(["past"]);
    expect(b.soon.map((i) => i.id)).toEqual(["soon", "edge30"]);
    expect(b.ahead.map((i) => i.id)).toEqual(["ahead", "edge120"]);
  });

  it("keeps blockers out of the dated bands even when they carry a date", () => {
    // A blocker gates everything downstream, so it is surfaced on its own
    // rather than being double-counted as overdue or soon.
    const b = bandAttention([mk({ id: "blk", kind: "blocked", days: -5 })]);
    expect(b.blocked.map((i) => i.id)).toEqual(["blk"]);
    expect(b.overdue).toHaveLength(0);
    expect(b.soon).toHaveLength(0);
  });

  it("drops undated non-blockers from every band", () => {
    const b = bandAttention([mk({ id: "undated", days: null })]);
    expect(b.overdue.length + b.soon.length + b.ahead.length + b.blocked.length).toBe(0);
  });
});
