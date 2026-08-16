import { describe, expect, it } from "vitest";
import { bodyOnly, isBareAssertion, scanDocument, SUPERSEDED } from "../superseded.mjs";

describe("bodyOnly", () => {
  it("drops everything from the revision log onward", () => {
    const md = "## Results\n\ntrauma 179 cases.\n\n## Revision log\n\n- trauma 179 was wrong.";
    expect(bodyOnly(md)).toBe("## Results\n\ntrauma 179 cases.\n\n");
  });

  it("also recognises a version-history heading", () => {
    const md = "Body text.\n\n## Version history\n\n- v0.1";
    expect(bodyOnly(md)).toBe("Body text.\n\n");
  });

  it("matches the heading at any level and any case", () => {
    expect(bodyOnly("Body.\n\n### revision log\n\nold")).toBe("Body.\n\n");
  });

  it("returns the whole document when there is no log", () => {
    expect(bodyOnly("Just a body.")).toBe("Just a body.");
  });
});

describe("isBareAssertion", () => {
  const bare = "The registry holds trauma 179 cases.";
  const documented = "Effect on reported figures: trauma 179 → 170, animal bite 109 → 114.";

  it("flags a figure stated on its own", () => {
    expect(isBareAssertion(bare, bare.indexOf("trauma 179"), "trauma 179")).toBe(true);
  });

  it("allows a figure written as a correction with an arrow", () => {
    expect(isBareAssertion(documented, documented.indexOf("trauma 179"), "trauma 179"))
      .toBe(false);
  });

  it("accepts the ASCII arrow too", () => {
    const s = "trauma 179 -> 170";
    expect(isBareAssertion(s, 0, "trauma 179")).toBe(false);
  });

  it("does not treat a distant arrow as a correction", () => {
    // An arrow later in the sentence is about something else entirely.
    const s = "trauma 179 cases, and the corridor Krabi → Bangkok dominates.";
    expect(isBareAssertion(s, 0, "trauma 179")).toBe(true);
  });
});

describe("scanDocument", () => {
  it("finds a stale figure in body text", () => {
    const hits = scanDocument("Paper 2", "The baseline showed 67 nationalities.");
    expect(hits).toEqual([
      { title: "Paper 2", wrong: "67 nationalities", right: "68 nationalities" },
    ]);
  });

  it("ignores the same figure inside a revision log", () => {
    const md = "Body is clean.\n\n## Revision log\n\n- Nationalities: 67 nationalities was wrong.";
    expect(scanDocument("Paper 1", md)).toEqual([]);
  });

  it("ignores a figure written as a documented correction", () => {
    // Paper 1's Methods legitimately records the audit this way.
    const md = "**Audit 2.** Effect on reported figures: trauma 179 → 170.";
    expect(scanDocument("Paper 1", md)).toEqual([]);
  });

  it("reports a repeated stale figure once, not once per occurrence", () => {
    const md = "67 nationalities here. And 67 nationalities again. And again: 67 nationalities.";
    expect(scanDocument("Doc", md)).toHaveLength(1);
  });

  it("still catches a bare assertion in a document that also documents it properly", () => {
    // The dangerous case: corrected in one place, left stale in another.
    const md = "Across 67 nationalities.\n\nLater: trauma 179 → 170 was fixed.";
    expect(scanDocument("Doc", md).map((h: { wrong: string }) => h.wrong))
      .toEqual(["67 nationalities"]);
  });

  it("returns nothing for a clean document", () => {
    expect(scanDocument("Clean", "68 nationalities, trauma 170, 42 evacuations.")).toEqual([]);
  });

  it("has a well-formed superseded list", () => {
    for (const entry of SUPERSEDED) {
      expect(entry.wrong, JSON.stringify(entry)).toBeTruthy();
      expect(entry.right, JSON.stringify(entry)).toBeTruthy();
      expect(entry.wrong).not.toBe(entry.right);
    }
  });
});
