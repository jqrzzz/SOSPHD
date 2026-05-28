/* ─── Historical Backfill — normalization (v1) ─────────────────────────
 *  Deterministic, pure mappers from messy spreadsheet vocabulary to the
 *  research model. These are v1 implementations with explicit extension
 *  seams — the real 448-distinct-insurer map and the diagnosis keyword
 *  lists get widened once the actual sheet is in hand (docs/backfill-plan.md
 *  §5.4). They are intentionally conservative: unknown input falls back
 *  to a documented default rather than guessing.
 * ────────────────────────────────────────────────────────────────────── */

import type { CaseStatus, Severity } from "../types";

/** Collapse whitespace + uppercase for stable matching. */
function canon(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toUpperCase();
}

// Seed alias map: canon(raw) → normalized payer entity. The 448 → ~30
// collapse is built by extending this from the distinct payer strings in
// the source sheet. Seeded with a couple of illustrative multi-string
// entities so the shape is clear.
const PAYER_ALIASES: Record<string, string> = {
  "ALLIANZ": "Allianz",
  "ALLIANZ PARTNERS": "Allianz",
  "ALLIANZ GLOBAL ASSISTANCE": "Allianz",
  "AXA": "AXA",
  "AXA PARTNERS": "AXA",
  "SELF PAY": "Self-pay",
  "SELF-PAY": "Self-pay",
  "CASH": "Self-pay",
};

/**
 * Normalize a raw payer string to a canonical entity. Falls back to a
 * title-cased version of the cleaned input (so unknown payers still
 * group by exact string) rather than dropping to "Unknown" — this keeps
 * the long tail visible for the next round of alias-map curation.
 */
export function normalizePayer(raw?: string | null): string | null {
  if (!raw || !raw.trim()) return null;
  const key = canon(raw);
  if (PAYER_ALIASES[key]) return PAYER_ALIASES[key];
  // Title-case the cleaned string as the provisional entity.
  return key
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Coarse diagnosis buckets via keyword match. v1 keyword lists; widen
// from the real free-text diagnoses. Order matters — first match wins.
const DIAGNOSIS_BUCKETS: { bucket: string; keywords: string[] }[] = [
  { bucket: "cardiac", keywords: ["cardiac", "heart", "mi ", "infarct", "angina", "arrhythm"] },
  { bucket: "trauma", keywords: ["trauma", "fracture", "fall", "accident", "rta", "injury", "laceration"] },
  { bucket: "neuro", keywords: ["stroke", "cva", "seizure", "neuro", "head injury", "tbi"] },
  { bucket: "respiratory", keywords: ["respiratory", "pneumonia", "asthma", "copd", "breath"] },
  { bucket: "infectious", keywords: ["infection", "sepsis", "dengue", "malaria", "fever", "covid"] },
  { bucket: "diving", keywords: ["diving", "dcs", "decompression", "scuba", "bends"] },
  { bucket: "gastro", keywords: ["gastro", "appendic", "abdominal", "diarrh", "vomit"] },
];

/**
 * Bucket a free-text diagnosis into a coarse category. Returns "other"
 * for non-empty unmatched text, null for empty input.
 */
export function bucketDiagnosis(raw?: string | null): string | null {
  if (!raw || !raw.trim()) return null;
  const hay = raw.toLowerCase();
  for (const { bucket, keywords } of DIAGNOSIS_BUCKETS) {
    if (keywords.some((k) => hay.includes(k))) return bucket;
  }
  return "other";
}

/**
 * Map a raw historical status token to the research model. Historical
 * cases (2018–2023) are overwhelmingly terminal, so unknown/empty
 * defaults to "closed".
 */
export function mapHistoricalStatus(raw?: string | null): CaseStatus {
  if (!raw) return "closed";
  const k = canon(raw);
  if (["OPEN", "INTAKE", "NEW", "PENDING"].includes(k)) return "open";
  if (["ACTIVE", "IN PROGRESS", "IN TREATMENT", "ONGOING"].includes(k))
    return "active";
  return "closed";
}

/**
 * Map a raw severity token to the 1–4 scale (1=low … 4=critical).
 * Accepts numeric strings ("1".."4"/"5"→4) and words. Unknown → 2.
 */
export function mapHistoricalSeverity(raw?: string | null): Severity | null {
  if (!raw || !raw.trim()) return null;
  const k = canon(raw);
  if (["1", "LOW", "MINOR"].includes(k)) return 1;
  if (["2", "NORMAL", "MODERATE", "MEDIUM"].includes(k)) return 2;
  if (["3", "HIGH", "SERIOUS", "SEVERE"].includes(k)) return 3;
  if (["4", "5", "CRITICAL", "LIFE-THREATENING", "EMERGENT"].includes(k))
    return 4;
  return 2;
}
