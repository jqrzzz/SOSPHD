/* ─── Prompt-context sanitizers ────────────────────────────────────────
 *  User-authored text (note content, case chief-complaint, doc bodies)
 *  is embedded inside delimited envelopes — <context>…</context>,
 *  <case>…</case>, <document>…</document> — so the model can tell
 *  instructions from data. These helpers neutralize any matching tags
 *  *inside* the user text so a crafted string can't close the envelope
 *  early and inject post-envelope instructions.
 *
 *  Extracted from the advisor / recommendations / docs routes (Phase 7)
 *  so the logic has one home and is unit-testable in isolation — it is
 *  the only line of defense against context-envelope breakout.
 * ────────────────────────────────────────────────────────────────────── */

/**
 * Replace `<tag>` / `</tag>` (case-insensitive) inside `text` with an
 * underscored, inert variant. `tag` is expected to be a simple
 * alphanumeric envelope name (context / case / document).
 */
export function neutralizeTag(text: string, tag: string): string {
  const close = new RegExp(`</${tag}>`, "gi");
  const open = new RegExp(`<${tag}>`, "gi");
  return text.replace(close, `</_${tag}>`).replace(open, `<_${tag}>`);
}

/** Neutralize <context> tags. Used by the advisor context builder. */
export function sanitizeForContext(s: string | null | undefined): string {
  if (!s) return "";
  return neutralizeTag(s, "context");
}

/**
 * Neutralize <case> tags and clip to `maxLen` chars. Used by the
 * recommendation engine for operator-authored free text (chief
 * complaint, notes, event payloads) before it enters the <case>
 * envelope. The clip bounds how much adversarial content can reach
 * the model in one call.
 */
export function safeFreeText(
  value: string | null | undefined,
  maxLen = 2000,
): string {
  if (!value) return "";
  return neutralizeTag(value.slice(0, maxLen), "case");
}

/** Neutralize <document> tags. Used by the docs AI route. */
export function sanitizeForDocument(s: string | null | undefined): string {
  if (!s) return "";
  return neutralizeTag(s, "document");
}
