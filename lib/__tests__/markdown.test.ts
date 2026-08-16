import { describe, expect, it } from "vitest";
import {
  parseInline,
  parseMarkdown,
  readingMinutes,
  safeHref,
  slugify,
  tableOfContents,
  wordCount,
  type Block,
} from "../markdown";

function blockTypes(src: string): string[] {
  return parseMarkdown(src).map((b) => b.type);
}

describe("safeHref", () => {
  it("allows http(s), mailto, anchors, and root-relative", () => {
    expect(safeHref("https://example.org")).toBe("https://example.org");
    expect(safeHref("mailto:a@b.com")).toBe("mailto:a@b.com");
    expect(safeHref("#section-1")).toBe("#section-1");
    expect(safeHref("/docs/1")).toBe("/docs/1");
  });

  it("rejects script-bearing schemes", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,<script>")).toBeNull();
    expect(safeHref("  ")).toBeNull();
  });
});

describe("parseInline", () => {
  it("parses strong, emphasis, code, and links", () => {
    expect(parseInline("**bold**")).toEqual([
      { type: "strong", children: [{ type: "text", value: "bold" }] },
    ]);
    expect(parseInline("*soft*")).toEqual([
      { type: "em", children: [{ type: "text", value: "soft" }] },
    ]);
    expect(parseInline("`code`")).toEqual([{ type: "code", value: "code" }]);
    expect(parseInline("[label](https://x.org)")).toEqual([
      {
        type: "link",
        href: "https://x.org",
        children: [{ type: "text", value: "label" }],
      },
    ]);
  });

  it("leaves underscores alone — identifiers must survive verbatim", () => {
    const nodes = parseInline("FIRST_CONTACT and research.case_events");
    expect(nodes).toEqual([
      { type: "text", value: "FIRST_CONTACT and research.case_events" },
    ]);
  });

  it("does not format inside code spans", () => {
    expect(parseInline("`a **b** c`")).toEqual([
      { type: "code", value: "a **b** c" },
    ]);
  });

  it("degrades an unsafe link to its plain label", () => {
    expect(parseInline("[click](javascript:void)")).toEqual([
      { type: "text", value: "click" },
    ]);
  });

  it("never emits a link node for an unsafe scheme", () => {
    // The href pattern stops at the first ")", so a parenthesised payload
    // leaves a stray ")" as text — cosmetic. The invariant that matters is
    // that no link node is produced, whatever the payload looks like.
    for (const src of [
      "[click](javascript:alert(1))",
      "[x](data:text/html,<script>)",
      "[y](vbscript:msgbox)",
    ]) {
      expect(parseInline(src).some((n) => n.type === "link")).toBe(false);
    }
  });

  it("keeps surrounding text", () => {
    expect(parseInline("see **this** now")).toEqual([
      { type: "text", value: "see " },
      { type: "strong", children: [{ type: "text", value: "this" }] },
      { type: "text", value: " now" },
    ]);
  });
});

describe("parseMarkdown", () => {
  it("parses headings with slug ids", () => {
    const [h] = parseMarkdown("## 5.6 The central finding");
    expect(h).toMatchObject({
      type: "heading",
      level: 2,
      id: "5-6-the-central-finding",
      text: "5.6 The central finding",
    });
  });

  it("joins wrapped paragraph lines and separates on blank lines", () => {
    const blocks = parseMarkdown("one two\nthree\n\nsecond para");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ type: "paragraph" });
    expect((blocks[0] as Extract<Block, { type: "paragraph" }>).children).toEqual([
      { type: "text", value: "one two three" },
    ]);
  });

  it("parses bullet and ordered lists", () => {
    const bullets = parseMarkdown("- a\n- b");
    expect(bullets[0]).toMatchObject({ type: "list", ordered: false });
    expect((bullets[0] as Extract<Block, { type: "list" }>).items).toHaveLength(2);

    const ordered = parseMarkdown("1. first\n2. second");
    expect(ordered[0]).toMatchObject({ type: "list", ordered: true });
    expect((ordered[0] as Extract<Block, { type: "list" }>).items).toHaveLength(2);
  });

  it("joins wrapped list continuation lines before parsing inline spans", () => {
    // Emphasis that wraps across a continuation line must still render —
    // parsing each line separately would leave the asterisks literal.
    const src = "- The baseline is effectively a **single-corridor\n  sample** — scope accordingly.";
    const [list] = parseMarkdown(src);
    const items = (list as Extract<Block, { type: "list" }>).items;
    expect(items).toHaveLength(1);
    expect(items[0].some((n) => n.type === "strong")).toBe(true);
    const flat = JSON.stringify(items[0]);
    expect(flat).not.toContain("**");
  });

  it("parses GFM tables with header and rows", () => {
    const src = "| Milestone | Present |\n|---|---|\n| FIRST_CONTACT | 835 |\n| DISCHARGE | 0 |";
    const [table] = parseMarkdown(src);
    expect(table.type).toBe("table");
    const t = table as Extract<Block, { type: "table" }>;
    expect(t.header).toHaveLength(2);
    expect(t.rows).toHaveLength(2);
    expect(t.rows[0][0]).toEqual([{ type: "text", value: "FIRST_CONTACT" }]);
  });

  it("handles the alignment syntax the papers actually use", () => {
    // Paper 1's Results tables are right-aligned (|---:|) and one is
    // centre-aligned. A divider the parser rejects would silently render
    // the whole table as paragraphs in the reading view.
    for (const divider of ["|---|---:|---:|", "|:---:|:---:|:---:|", "|:---|---:|---|"]) {
      const src = `| A | B | C |\n${divider}\n| 1 | 2 | 3 |`;
      const [block] = parseMarkdown(src);
      expect(block.type, `divider ${divider} should parse as a table`).toBe("table");
      const t = block as Extract<Block, { type: "table" }>;
      expect(t.header).toHaveLength(3);
      expect(t.rows).toHaveLength(1);
    }
  });

  it("does not mistake a pipe paragraph for a table without a divider", () => {
    expect(blockTypes("| not | a table |\njust text")).toEqual(["paragraph"]);
  });

  it("parses quotes, rules, and fenced code", () => {
    expect(blockTypes("> quoted\n> more")).toEqual(["quote"]);
    expect(blockTypes("---")).toEqual(["hr"]);
    const [code] = parseMarkdown("```\nSELECT 1;\n```");
    expect(code).toEqual({ type: "code", value: "SELECT 1;" });
  });

  it("keeps code fence contents unparsed", () => {
    const [code] = parseMarkdown("```\n# not a heading\n- not a list\n```");
    expect(code).toEqual({ type: "code", value: "# not a heading\n- not a list" });
  });

  it("handles a paper-shaped document end to end", () => {
    const src = [
      "# Paper 1",
      "",
      "**Draft v0.3** · numbers live.",
      "",
      "## 1. Introduction",
      "",
      "A tourist who breaks a leg is *rarely* in danger.",
      "",
      "- one",
      "- two",
      "",
      "## 2. Results",
      "",
      "| Milestone | Present |",
      "|---|---|",
      "| FIRST_CONTACT | 835 |",
    ].join("\n");
    const blocks = parseMarkdown(src);
    expect(blockTypes(src)).toEqual([
      "heading",
      "paragraph",
      "heading",
      "paragraph",
      "list",
      "heading",
      "table",
    ]);
    expect(tableOfContents(blocks)).toEqual([
      { id: "1-introduction", text: "1. Introduction", level: 2 },
      { id: "2-results", text: "2. Results", level: 2 },
    ]);
  });
});

describe("wordCount / readingMinutes", () => {
  it("counts words and ignores markup and fences", () => {
    expect(wordCount("# Title\n\n**two** words")).toBe(3);
    expect(wordCount("text\n```\nignored code here\n```")).toBe(1);
  });

  it("floors reading time at one minute", () => {
    expect(readingMinutes("short")).toBe(1);
    expect(readingMinutes(Array(440).fill("word").join(" "))).toBe(2);
  });
});

describe("slugify", () => {
  it("makes stable anchors", () => {
    expect(slugify("6.2 Why the timestamps are missing")).toBe(
      "6-2-why-the-timestamps-are-missing",
    );
  });
});
