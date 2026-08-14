/* ─── Pure helpers — no imports, unit-tested by the root vitest run ─────
 *  Everything here is deterministic given its inputs (newNodeId takes an
 *  injectable RNG) so tests need no Supabase, no MCP SDK, no env.
 * ────────────────────────────────────────────────────────────────────── */

/** Every agent-created row carries this tag (AGENTS.md rule 6). */
export const AGENT_TAG = "agent";

/** Merge caller tags with the mandatory agent tag, deduped, order kept. */
export function withAgentTag(tags?: string[]): string[] {
  const out: string[] = [];
  for (const t of [...(tags ?? []), AGENT_TAG]) {
    const clean = t.trim();
    if (clean && !out.includes(clean)) out.push(clean);
  }
  return out;
}

/**
 * Make free text safe for interpolation into a PostgREST `.or(...ilike...)`
 * filter: commas/parens/dots are filter-syntax metacharacters, % and _ are
 * LIKE wildcards. Collapse them to spaces so user text can't change the
 * filter's shape.
 */
export function sanitizeSearch(query: string): string {
  return query
    .replace(/[,().%_\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Agent-created node/edge ids: `ag-xxxxxxxx`, outside the app's `n<N>`
 *  id namespace so they can never collide with canvas-created nodes. */
export function newAgentId(random: () => number = Math.random): string {
  let hex = "";
  for (let i = 0; i < 8; i++) hex += Math.floor(random() * 16).toString(16);
  return `ag-${hex}`;
}

// Mirrors NODE_COLORS in components/mind-map-canvas.tsx — keep in sync so
// agent-added nodes look native in the canvas palette.
const NODE_COLORS = [
  "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#f97316", "#14b8a6", "#6366f1",
];

export function nodeColor(existingCount: number): string {
  return NODE_COLORS[existingCount % NODE_COLORS.length];
}

// Mirrors GRID_SIZE / snapToGrid in components/mind-map-canvas.tsx.
const GRID_SIZE = 20;
export function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

export interface NodeLike {
  id: string;
  x: number;
  y: number;
  radius: number;
  label?: string;
}
export interface EdgeLike {
  from: string;
  to: string;
}

/**
 * Choose a position for a new node, mirroring the canvas's own placement
 * feel (near the linked node at ~3 radii, else a sane default):
 *  - linked: ring around the anchor, angle stepped by how many edges the
 *    anchor already has, so successive children fan out instead of stacking
 *  - no link, empty map: the canvas default spawn point (400, 250)
 *  - no link, non-empty map: to the right of the rightmost node
 */
export function placeNode(
  nodes: NodeLike[],
  edges: EdgeLike[],
  linkToId?: string,
): { x: number; y: number } {
  const anchor = linkToId ? nodes.find((n) => n.id === linkToId) : undefined;
  if (anchor) {
    const degree = edges.filter(
      (e) => e.from === anchor.id || e.to === anchor.id,
    ).length;
    const angle = (degree * 60 * Math.PI) / 180;
    const dist = anchor.radius * 3 + 30;
    return {
      x: snapToGrid(anchor.x + Math.cos(angle) * dist),
      y: snapToGrid(anchor.y + Math.sin(angle) * dist),
    };
  }
  if (nodes.length === 0) return { x: 400, y: 250 };
  const rightmost = nodes.reduce((a, b) => (b.x > a.x ? b : a));
  return { x: snapToGrid(rightmost.x + 140), y: snapToGrid(rightmost.y) };
}

/**
 * Resolve a node reference that may be an id or a label: exact id match
 * first, then case-insensitive exact label, then unique label prefix.
 * Returns null when nothing (or more than one prefix candidate) matches.
 */
export function resolveNodeRef(
  nodes: NodeLike[],
  ref: string,
): NodeLike | null {
  const byId = nodes.find((n) => n.id === ref);
  if (byId) return byId;
  const needle = ref.trim().toLowerCase();
  if (!needle) return null;
  const byLabel = nodes.filter((n) => (n.label ?? "").toLowerCase() === needle);
  if (byLabel.length === 1) return byLabel[0];
  if (byLabel.length > 1) return null;
  const byPrefix = nodes.filter((n) =>
    (n.label ?? "").toLowerCase().startsWith(needle),
  );
  return byPrefix.length === 1 ? byPrefix[0] : null;
}

/** Count occurrences of each value, sorted descending — for baseline stats. */
export function countBy(values: (string | null | undefined)[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const v of values) {
    const key = v && v.trim() ? v : "(unassigned)";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries(
    [...counts.entries()].sort((a, b) => b[1] - a[1]),
  );
}

/** A short excerpt of `text` around the first hit of `query` (case-insensitive). */
export function snippetAround(text: string, query: string, radius = 80): string {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return text.slice(0, radius * 2) + (text.length > radius * 2 ? "…" : "");
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + query.length + radius);
  return (
    (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "")
  );
}

// ── MCP tool result builders ─────────────────────────────────────────

export interface ToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
  [key: string]: unknown;
}

export function ok(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

export function okJson(value: unknown): ToolResult {
  return ok(JSON.stringify(value, null, 2));
}

export function fail(text: string): ToolResult {
  return { content: [{ type: "text", text }], isError: true };
}
