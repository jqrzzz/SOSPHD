/* ─── Pure text categorization ─────────────────────────────────────────
 *  Safe to import from client components — no DB or server-only code.
 *  Used by the fieldwork journal form to suggest type/tags/corridor.
 * ────────────────────────────────────────────────────────────────────── */

import { RESEARCH_DOMAIN } from "./domain";

export interface CategorizationResult {
  suggestedType: string;
  suggestedTags: string[];
  suggestedCorridor: string | null;
  detectedMetrics: string[];
  detectedContacts: string[];
}

export function categorizeText(text: string): CategorizationResult {
  const lower = text.toLowerCase();
  const result: CategorizationResult = {
    suggestedType: "observation",
    suggestedTags: [],
    suggestedCorridor: null,
    detectedMetrics: [],
    detectedContacts: [],
  };

  if (
    lower.includes("interview") ||
    lower.includes("spoke with") ||
    lower.includes("meeting")
  ) {
    result.suggestedType = "conversation";
  } else if (
    lower.includes("visited") ||
    lower.includes("walked into") ||
    lower.includes("clinic") ||
    lower.includes("hospital")
  ) {
    result.suggestedType = "site_visit";
  } else if (
    lower.includes("idea") ||
    lower.includes("what if") ||
    lower.includes("could we")
  ) {
    result.suggestedType = "idea";
  } else if (
    lower.includes("conference") ||
    lower.includes("workshop") ||
    lower.includes("presentation")
  ) {
    result.suggestedType = "event";
  }

  for (const corridor of RESEARCH_DOMAIN.corridors) {
    const nameWords = corridor.name.toLowerCase().split(/[\s→]+/);
    if (nameWords.some((w) => lower.includes(w) && w.length > 3)) {
      result.suggestedCorridor = corridor.name;
      break;
    }
  }

  for (const [key, metric] of Object.entries(RESEARCH_DOMAIN.metrics)) {
    if (
      lower.includes(key.toLowerCase()) ||
      lower.includes(metric.name.toLowerCase())
    ) {
      result.detectedMetrics.push(key);
    }
  }

  const tagPatterns: Record<string, string[]> = {
    insurance: [
      "insurance",
      "pre-auth",
      "coverage",
      "claim",
      "payer",
      "allianz",
      "axa",
    ],
    transport: ["ambulance", "helicopter", "medevac", "transfer", "dispatch"],
    "language-barrier": [
      "translate",
      "language",
      "english-speaking",
      "interpreter",
    ],
    "payment-delay": [
      "payment delay",
      "ttgp",
      "guaranteed payment",
      "financial clearance",
    ],
    methodology: [
      "stepped-wedge",
      "rct",
      "study design",
      "sample size",
      "power calculation",
    ],
    ethics: ["irb", "ethics", "consent", "de-identify", "anonymize"],
    "data-source": [
      "data sharing",
      "anonymized data",
      "case data",
      "historical cases",
    ],
  };

  for (const [tag, patterns] of Object.entries(tagPatterns)) {
    if (patterns.some((p) => lower.includes(p))) {
      result.suggestedTags.push(tag);
    }
  }

  return result;
}

export async function autoCategorize(
  text: string,
): Promise<CategorizationResult | null> {
  if (!text || text.length < 10) return null;
  return categorizeText(text);
}
