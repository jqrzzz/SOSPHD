/* ─── Minimal markdown parser ──────────────────────────────────────────
 *  Parses the markdown subset the research papers actually use into a
 *  token tree that React renders as elements. Deliberately dependency-
 *  free and HTML-free: nothing here ever produces raw HTML, so there is
 *  no dangerouslySetInnerHTML anywhere in the reading path and no XSS
 *  surface even though agents write into these documents.
 *
 *  Supported: ATX headings, paragraphs, bullet/ordered lists, block
 *  quotes, GFM tables, horizontal rules, fenced code, and inline
 *  code/strong/emphasis/links.
 *
 *  Deliberately NOT supported: underscore emphasis. Research prose is
 *  full of identifiers like FIRST_CONTACT, research.case_events, and
 *  ingest_batch_id — treating `_` as emphasis would mangle them.
 * ────────────────────────────────────────────────────────────────────── */

export type InlineNode =
  | { type: "text"; value: string }
  | { type: "code"; value: string }
  | { type: "strong"; children: InlineNode[] }
  | { type: "em"; children: InlineNode[] }
  | { type: "link"; href: string; children: InlineNode[] };

export type Block =
  | { type: "heading"; level: number; id: string; children: InlineNode[]; text: string }
  | { type: "paragraph"; children: InlineNode[] }
  | { type: "list"; ordered: boolean; items: InlineNode[][] }
  | { type: "quote"; children: InlineNode[] }
  | { type: "table"; header: InlineNode[][]; rows: InlineNode[][][] }
  | { type: "code"; value: string }
  | { type: "hr" };

/**
 * Allow only safe link schemes. Content is self-authored or
 * agent-authored, but "trusted author" is not a security model —
 * javascript: and data: URLs are dropped to plain text.
 */
export function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (!href) return null;
  if (/^(https?:\/\/|mailto:|#|\/)/i.test(href)) return href;
  return null;
}

/** Stable heading anchor: lowercase, non-alphanumerics to hyphens. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// Order matters: code spans first (they suppress other formatting),
// then links, then strong (**) before emphasis (*).
//
// Built fresh per call, never shared: parseInline recurses into its own
// matches, and a module-level /g regex would have its lastIndex reset by
// the inner call, restarting the outer scan forever.
const inlineMatcher = () =>
  /`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*\n]+)\*/g;

export function parseInline(src: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  const re = inlineMatcher();
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(src)) !== null) {
    if (m.index > last) {
      nodes.push({ type: "text", value: src.slice(last, m.index) });
    }
    if (m[1] !== undefined) {
      nodes.push({ type: "code", value: m[1] });
    } else if (m[2] !== undefined) {
      const href = safeHref(m[3]);
      // Unsafe scheme → render the label as plain text, drop the link.
      if (href) nodes.push({ type: "link", href, children: parseInline(m[2]) });
      else nodes.push({ type: "text", value: m[2] });
    } else if (m[4] !== undefined) {
      nodes.push({ type: "strong", children: parseInline(m[4]) });
    } else if (m[5] !== undefined) {
      nodes.push({ type: "em", children: parseInline(m[5]) });
    }
    last = m.index + m[0].length;
  }

  if (last < src.length) {
    nodes.push({ type: "text", value: src.slice(last) });
  }
  return nodes;
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

const TABLE_DIVIDER_RE = /^\|?[\s:-]*-[\s|:-]*$/;

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // blank
    if (!line.trim()) {
      i += 1;
      continue;
    }

    // fenced code
    if (/^```/.test(line.trim())) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1; // closing fence
      blocks.push({ type: "code", value: body.join("\n") });
      continue;
    }

    // horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      blocks.push({ type: "hr" });
      i += 1;
      continue;
    }

    // heading
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const text = heading[2].trim();
      blocks.push({
        type: "heading",
        level: heading[1].length,
        id: slugify(text),
        text: text.replace(/[*`]/g, ""),
        children: parseInline(text),
      });
      i += 1;
      continue;
    }

    // table: a pipe row followed by a divider row
    if (
      line.trim().startsWith("|") &&
      i + 1 < lines.length &&
      TABLE_DIVIDER_RE.test(lines[i + 1].trim())
    ) {
      const header = splitTableRow(line).map(parseInline);
      i += 2;
      const rows: InlineNode[][][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(splitTableRow(lines[i]).map(parseInline));
        i += 1;
      }
      blocks.push({ type: "table", header, rows });
      continue;
    }

    // blockquote (consecutive > lines join into one quote)
    if (/^>\s?/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        body.push(lines[i].replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push({ type: "quote", children: parseInline(body.join(" ")) });
      continue;
    }

    // lists
    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || ordered) {
      const isOrdered = Boolean(ordered);
      // Collect each item's RAW text first (wrapped continuation lines
      // appended), then parse inline once per item. Parsing line by line
      // would break any span that wraps — "**single-corridor\nsample**"
      // would render its asterisks literally.
      const raw: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(
          isOrdered ? /^\s*\d+[.)]\s+(.*)$/ : /^\s*[-*+]\s+(.*)$/,
        );
        if (!m) {
          // continuation line (indented, non-empty, not a new item)
          if (
            raw.length > 0 &&
            /^\s+\S/.test(lines[i]) &&
            !/^\s*([-*+]|\d+[.)])\s/.test(lines[i])
          ) {
            raw[raw.length - 1] += ` ${lines[i].trim()}`;
            i += 1;
            continue;
          }
          break;
        }
        raw.push(m[1]);
        i += 1;
      }
      blocks.push({
        type: "list",
        ordered: isOrdered,
        items: raw.map(parseInline),
      });
      continue;
    }

    // Paragraph: always consume the current line first, then continue
    // until a blank line or a line that opens another block. Consuming
    // unconditionally is what guarantees forward progress — a line that
    // no branch above claimed (e.g. a lone "|" row with no divider)
    // would otherwise leave the cursor parked and loop forever.
    const para: string[] = [lines[i].trim()];
    i += 1;
    while (i < lines.length && lines[i].trim()) {
      const l = lines[i];
      if (
        /^(#{1,6})\s/.test(l) ||
        /^>\s?/.test(l) ||
        /^\s*([-*+]|\d+[.)])\s/.test(l) ||
        /^```/.test(l.trim()) ||
        /^(-{3,}|\*{3,}|_{3,})$/.test(l.trim()) ||
        l.trim().startsWith("|")
      ) {
        break;
      }
      para.push(l.trim());
      i += 1;
    }
    blocks.push({ type: "paragraph", children: parseInline(para.join(" ")) });
  }

  return blocks;
}

/** Headings that make up a document's table of contents (h2/h3). */
export function tableOfContents(
  blocks: Block[],
): { id: string; text: string; level: number }[] {
  return blocks
    .filter(
      (b): b is Extract<Block, { type: "heading" }> =>
        b.type === "heading" && (b.level === 2 || b.level === 3),
    )
    .map((h) => ({ id: h.id, text: h.text, level: h.level }));
}

/** Word count over the raw markdown, ignoring fences and markup noise. */
export function wordCount(src: string): number {
  const words = src
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#*`>|_-]/g, " ")
    .split(/\s+/)
    .filter((w) => /[a-zA-Z0-9]/.test(w));
  return words.length;
}

/** Reading time in minutes at ~220 wpm, floored at 1. */
export function readingMinutes(src: string): number {
  return Math.max(1, Math.round(wordCount(src) / 220));
}
