import { describe, expect, it } from "vitest";
import {
  countBy,
  newAgentId,
  nodeColor,
  placeNode,
  resolveNodeRef,
  sanitizeSearch,
  snapToGrid,
  snippetAround,
  withAgentTag,
} from "../helpers.js";

describe("withAgentTag", () => {
  it("appends 'agent' to caller tags", () => {
    expect(withAgentTag(["krabi"])).toEqual(["krabi", "agent"]);
  });
  it("dedupes and trims", () => {
    expect(withAgentTag([" agent ", "x", "x"])).toEqual(["agent", "x"]);
  });
  it("handles no tags", () => {
    expect(withAgentTag()).toEqual(["agent"]);
  });
});

describe("sanitizeSearch", () => {
  it("strips PostgREST filter metacharacters so input can't reshape the .or() filter", () => {
    expect(sanitizeSearch("a,b.ilike.(x)%_c")).toBe("a b ilike x c");
  });
  it("collapses whitespace", () => {
    expect(sanitizeSearch("  monkey   bite ")).toBe("monkey bite");
  });
});

describe("newAgentId", () => {
  it("emits ag-<8 hex> outside the canvas n<N> namespace", () => {
    expect(newAgentId(() => 0.5)).toMatch(/^ag-[0-9a-f]{8}$/);
  });
});

describe("nodeColor", () => {
  it("cycles the 10-color canvas palette", () => {
    expect(nodeColor(0)).toBe("#3b82f6");
    expect(nodeColor(10)).toBe("#3b82f6");
    expect(nodeColor(3)).toBe(nodeColor(13));
  });
});

describe("snapToGrid", () => {
  it("snaps to the canvas 20px grid", () => {
    expect(snapToGrid(407)).toBe(400);
    expect(snapToGrid(411)).toBe(420);
  });
});

describe("placeNode", () => {
  const anchor = { id: "n1", x: 400, y: 200, radius: 30, label: "Root" };

  it("uses the canvas default spawn point on an empty map", () => {
    expect(placeNode([], [])).toEqual({ x: 400, y: 250 });
  });

  it("places to the right of the rightmost node when unlinked", () => {
    const pos = placeNode([anchor], []);
    expect(pos).toEqual({ x: snapToGrid(400 + 140), y: 200 });
  });

  it("rings around the anchor, fanning by existing degree", () => {
    const first = placeNode([anchor], [], "n1");
    // degree 0 → angle 0 → straight right at 3r+30 = 120px
    expect(first).toEqual({ x: 520, y: 200 });
    const second = placeNode([anchor], [{ from: "n1", to: "x" }], "n1");
    expect(second).not.toEqual(first); // 60° fan, not stacking
  });

  it("results are always grid-snapped", () => {
    const pos = placeNode([anchor], [{ from: "n1", to: "x" }], "n1");
    expect(pos.x % 20).toBe(0);
    expect(pos.y % 20).toBe(0);
  });
});

describe("resolveNodeRef", () => {
  const nodes = [
    { id: "n1", x: 0, y: 0, radius: 30, label: "Payer friction" },
    { id: "n2", x: 0, y: 0, radius: 30, label: "Paper 2" },
    { id: "ag-abc12345", x: 0, y: 0, radius: 30, label: "Paper 3" },
  ];

  it("matches by exact id first", () => {
    expect(resolveNodeRef(nodes, "ag-abc12345")?.label).toBe("Paper 3");
  });
  it("matches by case-insensitive label", () => {
    expect(resolveNodeRef(nodes, "payer FRICTION")?.id).toBe("n1");
  });
  it("matches a unique prefix", () => {
    expect(resolveNodeRef(nodes, "payer")?.id).toBe("n1");
  });
  it("rejects ambiguous prefixes", () => {
    expect(resolveNodeRef(nodes, "paper")).toBeNull();
  });
  it("rejects unknown refs", () => {
    expect(resolveNodeRef(nodes, "nope")).toBeNull();
  });
});

describe("countBy", () => {
  it("counts, sorts descending, and buckets empties as (unassigned)", () => {
    expect(countBy(["a", "b", "a", null, "", "a"])).toEqual({
      a: 3,
      "(unassigned)": 2,
      b: 1,
    });
  });
});

describe("snippetAround", () => {
  it("excerpts around the first case-insensitive hit", () => {
    const text = `${"x".repeat(200)}MONKEY BITE${"y".repeat(200)}`;
    const s = snippetAround(text, "monkey");
    expect(s).toContain("MONKEY BITE");
    expect(s.startsWith("…")).toBe(true);
    expect(s.endsWith("…")).toBe(true);
    expect(s.length).toBeLessThan(200);
  });
  it("falls back to the head of the text when there is no hit", () => {
    expect(snippetAround("short text", "zzz")).toBe("short text");
  });
});
