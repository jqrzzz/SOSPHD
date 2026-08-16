/* ─── Superseded-figure detection ──────────────────────────────────────
 *  Pure helpers for the stale-figure scan in verify-paper-figures.mjs.
 *
 *  Split out from the script for one reason: the script talks to a live
 *  database on import, so nothing inside it can be unit-tested. These two
 *  functions carry all the judgement in the check — which text counts as
 *  an error and which counts as a correction being documented — and
 *  getting that judgement wrong in either direction is costly. A check
 *  that misses a stale figure is useless; one that fires on its own audit
 *  trail trains you to ignore it, which is worse.
 * ────────────────────────────────────────────────────────────────────── */

/**
 * Figures corrected once that must never reappear as bare assertions.
 *
 * The data checks in verify-paper-figures.mjs verify Paper 1 against the
 * registry. They cannot catch the other failure mode: a figure corrected
 * in Paper 1 that quietly survives in a sibling document. That has now
 * happened twice — "Five-Year Baseline" reached a title before being
 * caught, and Paper 2 was still carrying "67 nationalities" a day after
 * Paper 1 was corrected to 68.
 */
export const SUPERSEDED = [
  { wrong: "67 nationalities", right: "68 nationalities" },
  { wrong: "Five-Year Baseline", right: "Sixteen-Month Baseline" },
  { wrong: "five-year baseline", right: "sixteen-month baseline" },
  { wrong: "40 evacuations", right: "42 evacuations" },
  { wrong: "trauma 179", right: "trauma 170" },
  { wrong: "109 animal", right: "114 animal" },
];

/**
 * Strip the revision log before scanning.
 *
 * A correction record has to name what it corrected — Paper 1's log says
 * "trauma 179 → 170" and "Five-Year → Sixteen-Month" precisely because
 * those were the errors. Everything from the first revision-log heading
 * to the end of the document is excluded: body text is what ships, the
 * log is the record of how it got there.
 */
export function bodyOnly(md) {
  const m = md.match(/^##+\s+(Revision log|Version history)\s*$/im);
  return m ? md.slice(0, m.index) : md;
}

/**
 * Is this occurrence a bare assertion, or part of a documented correction?
 *
 * Paper 1's Methods says "trauma 179 → 170" while describing the audit
 * that produced the change, and that must be allowed to stand — a methods
 * section documenting a reclassification has to state what it
 * reclassified. What must not stand is the old figure asserted alone, as
 * though it were current. The distinction is the arrow.
 */
export function isBareAssertion(body, index, wrong) {
  const after = body.slice(index + wrong.length, index + wrong.length + 12);
  return !/^\s*(→|->|—>)/.test(after);
}

/**
 * Scan one document. Returns at most one hit per superseded figure — a
 * document that repeats the same stale number four times has one problem,
 * not four.
 */
export function scanDocument(title, contentMd, superseded = SUPERSEDED) {
  const body = bodyOnly(contentMd ?? "");
  const hits = [];
  for (const { wrong, right } of superseded) {
    for (let i = body.indexOf(wrong); i !== -1; i = body.indexOf(wrong, i + 1)) {
      if (isBareAssertion(body, i, wrong)) {
        hits.push({ title, wrong, right });
        break;
      }
    }
  }
  return hits;
}
