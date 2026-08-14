/* ─── Mind maps ────────────────────────────────────────────────────────
 *  research.mind_maps stores nodes/edges as JSONB arrays, so agents can
 *  grow a map without any migration. Agent nodes get `ag-` ids (outside
 *  the canvas's `n<N>` namespace), native palette colors, grid-snapped
 *  placement near their anchor, and `origin: "agent"` for provenance.
 *  Nodes can be referenced by id OR by label (unique / unique prefix).
 * ────────────────────────────────────────────────────────────────────── */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  fail,
  newAgentId,
  nodeColor,
  ok,
  okJson,
  placeNode,
  resolveNodeRef,
  type EdgeLike,
  type NodeLike,
} from "../helpers.js";
import { research } from "../supabase.js";

const NODE_TYPES = ["idea", "paper", "data", "method", "question", "milestone"] as const;

interface MapNode extends NodeLike {
  label: string;
  color: string;
  nodeType?: string;
  origin?: string;
}
interface MapEdge extends EdgeLike {
  id: string;
  label?: string;
}

async function fetchMap(mapId: string): Promise<
  | { map: { id: string; title: string; nodes: MapNode[]; edges: MapEdge[] } }
  | { error: string }
> {
  const { q } = await research("mind_maps");
  const { data, error } = await q
    .select("id, title, nodes, edges")
    .eq("id", mapId)
    .single();
  if (error) return { error: `Mind map ${mapId} not found: ${error.message}` };
  const row = data as { id: string; title: string; nodes: MapNode[]; edges: MapEdge[] };
  return { map: { ...row, nodes: row.nodes ?? [], edges: row.edges ?? [] } };
}

function labelIndex(nodes: MapNode[]): string {
  return nodes
    .slice(0, 20)
    .map((n) => `"${n.label}" (${n.id})`)
    .join(", ");
}

export function registerMindMapTools(server: McpServer): void {
  server.tool(
    "list_mind_maps",
    "List mind maps with their nodes (id, label, type) so nodes can be linked to by label.",
    {},
    async () => {
      const { q } = await research("mind_maps");
      const { data, error } = await q
        .select("id, title, updated_at, nodes, edges")
        .order("updated_at", { ascending: false })
        .limit(25);
      if (error) return fail(`list_mind_maps failed: ${error.message}`);
      const maps = (data as {
        id: string;
        title: string;
        updated_at: string;
        nodes: MapNode[] | null;
        edges: MapEdge[] | null;
      }[]).map((m) => ({
        id: m.id,
        title: m.title,
        updated_at: m.updated_at,
        edge_count: (m.edges ?? []).length,
        nodes: (m.nodes ?? []).slice(0, 60).map((n) => ({
          id: n.id,
          label: n.label,
          type: n.nodeType ?? "idea",
        })),
      }));
      return okJson({ mind_maps: maps });
    },
  );

  server.tool(
    "add_mind_map_node",
    "Add a node to a mind map (visible in /workspace), optionally linked to an existing " +
      "node. link_to accepts a node id or a label (case-insensitive; unique prefix works). " +
      "Placement, color, and grid snap match nodes created in the app.",
    {
      mind_map_id: z.string().uuid().describe("From list_mind_maps"),
      label: z.string().min(1).max(120),
      node_type: z.enum(NODE_TYPES).optional().describe("Default 'idea'"),
      link_to: z.string().optional().describe("Existing node id or label to connect from"),
      edge_label: z.string().optional().describe("Optional label on the connecting edge"),
    },
    async ({ mind_map_id, label, node_type, link_to, edge_label }) => {
      const res = await fetchMap(mind_map_id);
      if ("error" in res) return fail(res.error);
      const { map } = res;

      let anchor: MapNode | null = null;
      if (link_to) {
        anchor = resolveNodeRef(map.nodes, link_to) as MapNode | null;
        if (!anchor) {
          return fail(
            `link_to "${link_to}" doesn't match exactly one node. Nodes: ${labelIndex(map.nodes)}`,
          );
        }
      }

      const pos = placeNode(map.nodes, map.edges, anchor?.id);
      const node: MapNode = {
        id: newAgentId(),
        x: pos.x,
        y: pos.y,
        label,
        color: nodeColor(map.nodes.length),
        radius: 30,
        nodeType: node_type ?? "idea",
        origin: "agent",
      };
      const nodes = [...map.nodes, node];
      const edges = anchor
        ? [
            ...map.edges,
            {
              id: newAgentId(),
              from: anchor.id,
              to: node.id,
              ...(edge_label ? { label: edge_label } : {}),
            },
          ]
        : map.edges;

      const { q } = await research("mind_maps");
      const { error } = await q
        .update({ nodes, edges, updated_at: new Date().toISOString() })
        .eq("id", mind_map_id);
      if (error) return fail(`add_mind_map_node failed: ${error.message}`);
      return ok(
        `Added "${label}" (${node.id}) to "${map.title}"` +
          (anchor ? `, linked from "${anchor.label}".` : "."),
      );
    },
  );

  server.tool(
    "link_mind_map_nodes",
    "Connect two existing mind-map nodes with an edge. Both ends accept node id or label.",
    {
      mind_map_id: z.string().uuid(),
      from: z.string().min(1).describe("Node id or label"),
      to: z.string().min(1).describe("Node id or label"),
      edge_label: z.string().optional(),
    },
    async ({ mind_map_id, from, to, edge_label }) => {
      const res = await fetchMap(mind_map_id);
      if ("error" in res) return fail(res.error);
      const { map } = res;

      const a = resolveNodeRef(map.nodes, from) as MapNode | null;
      const b = resolveNodeRef(map.nodes, to) as MapNode | null;
      if (!a || !b) {
        return fail(
          `Couldn't resolve ${!a ? `"${from}"` : `"${to}"`} to exactly one node. ` +
            `Nodes: ${labelIndex(map.nodes)}`,
        );
      }
      if (a.id === b.id) return fail("from and to resolve to the same node.");
      if (map.edges.some((e) => e.from === a.id && e.to === b.id)) {
        return ok(`Edge "${a.label}" → "${b.label}" already exists — nothing to do.`);
      }

      const edges = [
        ...map.edges,
        { id: newAgentId(), from: a.id, to: b.id, ...(edge_label ? { label: edge_label } : {}) },
      ];
      const { q } = await research("mind_maps");
      const { error } = await q
        .update({ edges, updated_at: new Date().toISOString() })
        .eq("id", mind_map_id);
      if (error) return fail(`link_mind_map_nodes failed: ${error.message}`);
      return ok(`Linked "${a.label}" → "${b.label}" in "${map.title}".`);
    },
  );
}
