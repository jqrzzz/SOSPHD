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
  /**
   * Real work with no date to schedule it against. Its own band because
   * an undated item is not less urgent than a dated one — it is
   * unassessable, which is worse. A school whose deadline nobody has
   * established is invisible to every date-ordered view precisely when
   * it most needs looking at.
   */
  undated: AttentionItem[];
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
 *
 * Undated non-blockers used to be dropped entirely, on the reasoning that
 * the panel shows a 120-day window and an undated item has no place in
 * one. That silently swallowed two real cases — an undated task the owner
 * created, and a school with no deadline on file — so they now get a band
 * rather than a hole.
 */
export function bandAttention(items: AttentionItem[]): AttentionBands {
  const blocked = items.filter((i) => i.kind === "blocked");
  const dated = items.filter((i) => i.kind !== "blocked");
  return {
    overdue: dated.filter((i) => i.days !== null && i.days < 0),
    blocked,
    undated: dated.filter((i) => i.days === null),
    soon: dated.filter((i) => i.days !== null && i.days >= 0 && i.days <= 30),
    ahead: dated.filter((i) => i.days !== null && i.days > 30 && i.days <= 120),
  };
}
