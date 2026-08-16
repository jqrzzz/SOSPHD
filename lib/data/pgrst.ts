/* ─── PostgREST filter-value escaping ──────────────────────────────────
 *  The .or() method on the Supabase client takes a RAW PostgREST filter
 *  string — commas separate conditions, parentheses group them, and a
 *  value is only a value until one of those characters appears. Four
 *  stores used to interpolate the user's search term straight into that
 *  grammar, so a search for `x,title.eq.y` did not search for
 *  `x,title.eq.y` — it appended a second condition (ARCHITECTURE §8.4).
 *  RLS bounded the blast radius to the user's own rows, but the filter
 *  tree was attacker-influenceable text.
 *
 *  PostgREST's own escape hatch is the fix: a value wrapped in double
 *  quotes is opaque to the grammar, with `\"` and `\\` for embedded
 *  quotes and backslashes. Every or-filter that carries user text now
 *  goes through here, and nowhere else builds these strings by hand.
 *
 *  Verification note: the quoting rules are per the PostgREST docs
 *  (tables/views → horizontal filtering). This environment cannot reach
 *  the live PostgREST to probe them (egress-blocked), so the invariant
 *  script (scripts/verify-security-invariants.mjs) includes parse
 *  probes that confirm the exact output format of these helpers against
 *  the real API — run it once from a machine with access before
 *  trusting search in production.
 *
 *  Pure functions, no imports — unit-tested exactly, because the output
 *  string IS the contract.
 * ────────────────────────────────────────────────────────────────────── */

/**
 * Longest search term worth sending. Anything past this is not a search,
 * and unbounded interpolation into a URL is its own small problem.
 */
const MAX_TERM_LENGTH = 100;

/**
 * A user-supplied string as a PostgREST *contains* pattern, quoted so the
 * grammar cannot see into it: `%term%` wrapped in double quotes, with
 * backslashes and embedded quotes escaped (backslash first — escaping
 * quotes first would double the escapes' own backslashes).
 *
 * `%` and `_` inside the term keep their LIKE-wildcard meaning. That is
 * deliberate and unchanged from the previous behaviour: this is a search
 * box, and a user typing `%` gets a wildcard, not a literal.
 */
export function ilikeContainsPattern(term: string): string {
  const cleaned = term
    .trim()
    .slice(0, MAX_TERM_LENGTH)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
  return `"%${cleaned}%"`;
}

/**
 * The full .or() argument for "any of these columns contains the term".
 * Column names are code-supplied literals, never user input — the only
 * untrusted part of the output is the quoted pattern.
 */
export function orIlikeContains(columns: readonly string[], term: string): string {
  const pattern = ilikeContainsPattern(term);
  return columns.map((c) => `${c}.ilike.${pattern}`).join(",");
}
