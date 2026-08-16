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

  it("gives undated non-blockers their own band instead of dropping them", () => {
    // These used to vanish. An undated task and a school whose deadline
    // nobody has established are both real work; being unassessable is
    // worse than being distant, not better.
    const b = bandAttention([mk({ id: "undated", days: null })]);
    expect(b.undated.map((i) => i.id)).toEqual(["undated"]);
    expect(b.overdue.length + b.soon.length + b.ahead.length + b.blocked.length).toBe(0);
  });

  it("keeps an undated blocker in the blocked band, not the undated one", () => {
    const b = bandAttention([mk({ id: "blk", kind: "blocked", days: null })]);
    expect(b.blocked.map((i) => i.id)).toEqual(["blk"]);
    expect(b.undated).toHaveLength(0);
  });

  it("excludes undated items from the dated bands", () => {
    const b = bandAttention([
      mk({ id: "undated", days: null }),
      mk({ id: "soon", days: 5 }),
    ]);
    expect(b.soon.map((i) => i.id)).toEqual(["soon"]);
    expect(b.ahead).toHaveLength(0);
    expect(b.overdue).toHaveLength(0);
  });
});
