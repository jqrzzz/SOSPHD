/* ─── Intervention Protocol — version metadata ───────────────────────
 *  Single source of truth for the protocol version SOSPHD operates
 *  under. The full protocol document lives at /app/protocol/page.tsx
 *  (rendered at /protocol); this module exists so non-page modules
 *  (rec generator, dashboard, paper builder) can cite the current
 *  version without importing a Next.js page component.
 *
 *  Bump PROTOCOL_VERSION when a MATERIAL change is made to the
 *  protocol document — see §6 of the protocol for the rule.
 * ────────────────────────────────────────────────────────────────────── */

export const PROTOCOL_VERSION = "v0.1";
export const PROTOCOL_EFFECTIVE_DATE = "2026-05-16";
