/** Exact Markdown ranges. No database, model, HTML rendering or automatic edits. */
export const MAX_MANUSCRIPT_BYTES = 1024 * 1024;
export const MAX_REPLACEMENT_BYTES = 128 * 1024;
export const MAX_REVISION_NOTE = 2000;
export interface ManuscriptSection {
  key: string;
  label: string;
  level: number;
  start: number;
  end: number;
}
export class RevisionError extends Error {
  constructor(public readonly code: "invalid_input" | "unavailable" | "not_found" | "stale_source" | "request_conflict" | "save_failed", message: string) {
    super(message);
    this.name = "RevisionError";
  }
}

export function utf8Bytes(text: string): number {
  // Browser/Node-compatible; no TextEncoder dependency or large intermediate array.
  let size = 0;
  for (const char of text) {
    const cp = char.codePointAt(0)!;
    if (cp >= 0xd800 && cp <= 0xdfff) {
      throw new RevisionError("invalid_input", "Text contains an incomplete Unicode character.");
    }
    size += cp <= 0x7f ? 1 : cp <= 0x7ff ? 2 : cp <= 0xffff ? 3 : 4;
  }
  return size;
}

export function validateManuscript(text: string): void {
  if (typeof text !== "string" || text.includes("\0") || utf8Bytes(text) > MAX_MANUSCRIPT_BYTES) {
    throw new RevisionError("invalid_input", "The manuscript is invalid or exceeds the 1 MiB working limit.");
  }
}

/** ATX headings only. Fenced code and HTML comments cannot define section boundaries. */
export function manuscriptSections(text: string): ManuscriptSection[] {
  validateManuscript(text);
  const headings: { label: string; level: number; headingStart: number; bodyStart: number }[] = [];
  let fence: { char: string; length: number } | null = null;
  let inComment = false;
  let offset = 0;
  for (const raw of text.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
    const line = raw.replace(/\r?\n$/, "");
    const next = offset + raw.length;
    if (fence) {
      const close = line.match(/^ {0,3}(`+|~+)[ \t]*$/);
      if (close && close[1][0] === fence.char && close[1].length >= fence.length) fence = null;
    } else if (inComment) {
      if (line.includes("-->")) inComment = false;
    } else if (line.includes("<!--")) {
      inComment = line.lastIndexOf("<!--") > line.lastIndexOf("-->");
    } else {
      const open = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
      if (open && !(open[1][0] === "`" && open[2].includes("`"))) {
        fence = { char: open[1][0], length: open[1].length };
      } else {
        const heading = line.match(/^ {0,3}(#{1,6})(?:[ \t]+(.*?)|[ \t]*)$/);
        if (heading) headings.push({
          level: heading[1].length,
          label: (heading[2] ?? "").replace(/[ \t]+#+[ \t]*$/, "").trim() || "Untitled section",
          headingStart: offset,
          bodyStart: next,
        });
      }
    }
    offset = next;
  }
  if (headings.length > 500) throw new RevisionError("invalid_input", "Too many sections for this revision view.");
  return headings.flatMap((h, index) => {
    // Do not offer a whole-manuscript title when it contains more precise sections.
    if (h.level === 1 && headings.slice(index + 1).some((n) => n.level > 1)) return [];
    const boundary = headings.slice(index + 1).find((n) => n.level <= h.level)?.headingStart ?? text.length;
    return [{ key: `${h.bodyStart}:${boundary}`, label: h.label, level: h.level, start: h.bodyStart, end: boundary }];
  });
}

/** Replace only a server-recomputed range; the selected heading and outside text stay exact. */
export function replaceSection(text: string, key: string, replacement: string): string {
  const section = manuscriptSections(text).find((s) => s.key === key);
  if (!section || typeof replacement !== "string" || !replacement.trim() || replacement.includes("\0") || utf8Bytes(replacement) > MAX_REPLACEMENT_BYTES) {
    throw new RevisionError("invalid_input", "Choose a supported section and a nonempty replacement of at most 128 KiB.");
  }
  // Preserve what was typed; only ensure the following heading starts on its own line.
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const joined = section.end < text.length && !replacement.endsWith("\n") ? replacement + eol + eol : replacement;
  const separator = section.start > 0 && text[section.start - 1] !== "\n" ? eol : "";
  const result = text.slice(0, section.start) + separator + joined + text.slice(section.end);
  validateManuscript(result);
  if (result === text) throw new RevisionError("invalid_input", "The proposed section is unchanged.");
  return result;
}
