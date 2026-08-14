/* ─── Corridor derivation ──────────────────────────────────────────────
 *  Maps free-text geography (province, branch/location, clinic name) to
 *  one of the six research corridors. These are EXACTLY the rules the
 *  836 backfilled cases were assigned with (batches c201c6c2 + b3264682)
 *  — documented in docs/paper1-baseline-findings.md §7. Corridor is a
 *  derived variable, not operator-assigned; unmatched geography (and
 *  Indonesia, which has no Thailand corridor) returns null.
 * ────────────────────────────────────────────────────────────────────── */

const CORRIDOR_KEYWORDS: { corridor: string; keywords: string[] }[] = [
  { corridor: "Krabi → Bangkok", keywords: ["krabi", "phi phi", "ao nang", "lanta", "railay"] },
  { corridor: "Koh Samui → Bangkok", keywords: ["samui", "phangan", "koh tao", "surat"] },
  { corridor: "Phuket → Bangkok", keywords: ["phuket"] },
  { corridor: "Chiang Mai → Bangkok", keywords: ["chiang mai", "mae hong son", "pai"] },
  { corridor: "Pattaya → Bangkok", keywords: ["pattaya", "chonburi", "chon buri"] },
  { corridor: "Bangkok Hub", keywords: ["bangkok"] },
];

/**
 * Derive a corridor from any set of geography fragments. Indonesia
 * (Lombok/Gili) short-circuits to null — outside the Thailand corridor
 * set. First keyword match wins, in the declared order.
 */
export function deriveCorridor(
  parts: Array<string | null | undefined>,
): string | null {
  const hay = parts
    .map((p) => (p ?? "").toString().toLowerCase())
    .join(" ");
  if (hay.includes("lombok") || hay.includes("gili")) return null;
  for (const { corridor, keywords } of CORRIDOR_KEYWORDS) {
    if (keywords.some((k) => hay.includes(k))) return corridor;
  }
  return null;
}
