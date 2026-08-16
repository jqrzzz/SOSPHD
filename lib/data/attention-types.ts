/* ─── Attention types + banding ────────────────────────────────────────
 *  Pure half of the attention module: the shape of an item and the rule
 *  for which band it falls into. Deliberately free of `server-only` so
 *  the panel can render it, and so the banding rule can be unit-tested
 *  without a database.
 * ────────────────────────────────────────────────────────────────────── */

export type AttentionKind = "deadline" | "task" | "blocked" | "unverified";

export interface AttentionItem {
  id: string;
  kind: AttentionKind;
  title: string;
  detail: string;
  /** Days until it matters. Negative = already passed. Null = undated. */
  days: number | null;
  href: string;
  /** Sort weight — lower surfaces first. */
  weight: number;
}

export interface AttentionBands {
  overdue: AttentionItem[];
  blocked: AttentionItem[];
  soon: AttentionItem[];
  ahead: AttentionItem[];
}

/**
 * Split items into the bands the panel renders.
 *
 * Blockers are pulled out regardless of date: something that is ready
 * except for one missing piece gates everything downstream of it, which
 * makes it more actionable than a dated item further out. A blocker is
 * therefore never also counted as overdue or soon.
 */
export function bandAttention(items: AttentionItem[]): AttentionBands {
  const blocked = items.filter((i) => i.kind === "blocked");
  const dated = items.filter((i) => i.kind !== "blocked");
  return {
    overdue: dated.filter((i) => i.days !== null && i.days < 0),
    blocked,
    soon: dated.filter((i) => i.days !== null && i.days >= 0 && i.days <= 30),
    ahead: dated.filter((i) => i.days !== null && i.days > 30 && i.days <= 120),
  };
}
