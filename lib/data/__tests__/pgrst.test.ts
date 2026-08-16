import { describe, expect, it } from "vitest";
import { ilikeContainsPattern, orIlikeContains } from "../pgrst";

/* The output string IS the contract — PostgREST parses it, so these
 * tests assert exact strings rather than properties. If one of these
 * changes, the live parse probes in verify-security-invariants.mjs must
 * be re-run before the change ships. */

describe("ilikeContainsPattern", () => {
  it("wraps an ordinary term in a quoted contains pattern", () => {
    expect(ilikeContainsPattern("dengue")).toBe('"%dengue%"');
  });

  it("neutralises commas and parentheses by quoting, not stripping", () => {
    // The §8.4 injection shape: a comma splits conditions, a paren closes
    // a group. Inside double quotes both are just characters — and the
    // user's actual search text survives verbatim.
    expect(ilikeContainsPattern("x,title.eq.y")).toBe('"%x,title.eq.y%"');
    expect(ilikeContainsPattern("a)b(c")).toBe('"%a)b(c%"');
  });

  it("escapes embedded double quotes", () => {
    expect(ilikeContainsPattern('say "hi"')).toBe('"%say \\"hi\\"%"');
  });

  it("escapes backslashes, and does so before quote-escaping", () => {
    // A term ending in a backslash must not swallow the closing quote,
    // and escaping in the wrong order would double the escapes' own
    // backslashes: `\"` in, `\\\"` out — not `\\\\"`.
    expect(ilikeContainsPattern("a\\")).toBe('"%a\\\\%"');
    expect(ilikeContainsPattern('\\"')).toBe('"%\\\\\\"%"');
  });

  it("trims and caps the term length", () => {
    expect(ilikeContainsPattern("  fever  ")).toBe('"%fever%"');
    const long = "x".repeat(500);
    expect(ilikeContainsPattern(long)).toBe(`"%${"x".repeat(100)}%"`);
  });

  it("keeps LIKE wildcards live — a search box, not an exact matcher", () => {
    expect(ilikeContainsPattern("50%")).toBe('"%50%%"');
  });
});

describe("orIlikeContains", () => {
  it("builds one condition per column around a single quoted pattern", () => {
    expect(orIlikeContains(["title", "content_md"], "monkey bite")).toBe(
      'title.ilike."%monkey bite%",content_md.ilike."%monkey bite%"',
    );
  });

  it("carries a hostile term inertly through every condition", () => {
    // The only comma the grammar can see is the separator between the two
    // conditions; the term's own comma sits inside a quoted region.
    expect(orIlikeContains(["name", "notes"], "a,(b.eq.c")).toBe(
      'name.ilike."%a,(b.eq.c%",notes.ilike."%a,(b.eq.c%"',
    );
  });
});
