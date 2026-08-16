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
// Widened 2026-08-13 from the real registry ingest (batches c201c6c2 +
// b3264682) — these are the aliases the 836 backfilled rows were
// normalized with. Keep in lockstep with docs/backfill-plan.md.
const PAYER_ALIASES: Record<string, string> = {
  "ALLIANZ": "Allianz",
  "ALLIANZ PARTNERS": "Allianz",
  "ALLIANZ GLOBAL ASSISTANCE": "Allianz",
  "ALLIANZ TRAVEL": "Allianz",
  "MONDIAL": "Allianz",
  "AXA": "AXA",
  "AXA UK/INTER PARTNER": "AXA",
  "AXA ASSISTANCE": "AXA",
  "INTER PARTNER": "AXA",
  "INTER PARTNER ASSISTANCE": "AXA",
  "AIG": "AIG",
  "AIG TRAVEL GUARD": "AIG",
  "TRAVEL GUARD": "AIG",
  "WORLD NOMADS": "World Nomads",
  "WORLDNOMADS": "World Nomads",
  "ASSIST CARD": "Assist Card",
  "ASSISTCARD": "Assist Card",
  "BLUE CROSS BLUE SHIELD": "Blue Cross Blue Shield",
  "BCBS": "Blue Cross Blue Shield",
  "ADAC": "ADAC",
  "PZU": "PZU",
  "GJENSIDIGE": "Gjensidige",
  "RESEBEVIS": "Resebevis",
  "VIRGIN MONEY": "Virgin Money",
  "EUROP ASSISTANCE": "Europ Assistance",
  "EUROPE ASSISTANCE": "Europ Assistance",
  "SOS INTERNATIONAL": "SOS International",
  "INTERNATIONAL SOS": "International SOS",
  "ERV": "ERV",
  "ERGO": "ERGO",
  "HANSE MERKUR": "HanseMerkur",
  "HANSEMERKUR": "HanseMerkur",
  "TRUE TRAVELLER": "True Traveller",
  "STAYSURE": "Staysure",
  "INSUREANDGO": "InsureAndGo",
  "INSURE AND GO": "InsureAndGo",
  "SELF PAY": "Self-pay",
  "SELF-PAY": "Self-pay",
  "SELFPAY": "Self-pay",
  "CASH": "Self-pay",
  "SELF": "Self-pay",
  "NONE": "Self-pay",
  "NO INSURANCE": "Self-pay",
  "N/A": "Self-pay",
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
// Widened 2026-08-13 from the real registry's 487 distinct diagnosis
// strings. ORDER MATTERS — first match wins; the 836 backfilled rows
// were bucketed with exactly these rules.
// ORDER RATIONALE — mechanism outranks anatomy.
//
// marine and animal_bite sit ABOVE trauma deliberately. Both describe a
// specific mechanism ("monkey", "sea urchin", "coral"), while trauma's
// list contains generic wound vocabulary and bare body parts ("wound",
// "cut", "knee", "shoulder"). With trauma evaluated first, a record
// reading "monkey bite, right knee" matched "knee" and was filed as
// trauma. An audit on 2026-08-15 found nine such rows — five monkey
// bites and four sea-urchin/coral injuries — every one a genuine
// mechanism case captured by an anatomical keyword.
//
// The general rule this encodes: a keyword naming HOW the injury
// happened is stronger evidence of category than one naming WHERE it
// landed, so mechanism buckets are evaluated first. gastro stays at the
// top; it shares no vocabulary with either mechanism bucket.
const DIAGNOSIS_BUCKETS: { bucket: string; keywords: string[] }[] = [
  { bucket: "gastro", keywords: ["age", "gastro", "diarr", "vomit", "abdominal", "appendic", "food pois", "stomach", "dehydrat", "nausea"] },
  { bucket: "marine", keywords: ["sea urchin", "jellyfish", "coral", "marine", "sting ray", "stingray", "fish", "lionfish", "stonefish"] },
  { bucket: "animal_bite", keywords: ["monkey", "dog bite", "cat bite", "bite", "rabies", "snake", "scorpion"] },
  { bucket: "trauma", keywords: ["trauma", "fracture", "fall", "accident", "rta", "injury", "lacerat", "abrasion", "wound", "sprain", "dislocat", "motorbike", "motorcycle", "bike", "burn", "cut", "contusion", "ankle", "knee", "shoulder"] },
  { bucket: "infectious", keywords: ["infect", "sepsis", "dengue", "malaria", "fever", "covid", "flu", "virus", "tonsil", "uti", "urinary"] },
  { bucket: "respiratory", keywords: ["respirat", "pneumonia", "asthma", "copd", "breath", "bronch", "cough"] },
  { bucket: "neuro", keywords: ["stroke", "cva", "seizure", "neuro", "head injury", "tbi", "concussion", "headache", "migraine"] },
  { bucket: "cardiac", keywords: ["cardiac", "heart", "infarct", "angina", "arrhythm", "chest pain", "hypertens"] },
  { bucket: "diving", keywords: ["diving", "dcs", "decompression", "scuba", "bends", "barotrauma"] },
  { bucket: "derm", keywords: ["rash", "allerg", "skin", "derm", "sunburn", "insect"] },
  { bucket: "ent", keywords: ["ear", "otitis", "eye", "conjunctiv", "sinus", "throat"] },
];

// Short tokens that are substrings of unrelated words ("cut" ⊂ "acute",
// "age" ⊂ "haemorrhage", "mi" ⊂ "vomit") must match as WHOLE WORDS.
// Longer keywords stay substring matches so prefixes keep working
// ("diarr" → diarrhea/diarrhoea, "vomit" → vomiting).
const WHOLE_WORD_KEYWORDS = new Set(["cut", "age", "mi", "rta", "fall", "bite", "flu"]);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function keywordMatches(hay: string, keyword: string): boolean {
  if (WHOLE_WORD_KEYWORDS.has(keyword)) {
    return new RegExp(`\\b${escapeRegExp(keyword)}\\b`).test(hay);
  }
  return hay.includes(keyword);
}

/**
 * Bucket a free-text diagnosis into a coarse category. Returns "other"
 * for non-empty unmatched text, null for empty input.
 */
export function bucketDiagnosis(raw?: string | null): string | null {
  if (!raw || !raw.trim()) return null;
  const hay = raw.toLowerCase();
  for (const { bucket, keywords } of DIAGNOSIS_BUCKETS) {
    if (keywords.some((k) => keywordMatches(hay, k))) return bucket;
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
