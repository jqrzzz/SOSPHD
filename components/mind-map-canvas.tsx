"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { saveMindMapAction } from "@/lib/workspace-actions";
import type { MindMapNode, MindMapEdge } from "@/lib/data/workspace-types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const NODE_COLORS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#f97316", // orange
];

interface Props {
  id: string;
  title: string;
  initialNodes: MindMapNode[];
  initialEdges: MindMapEdge[];
}

export function MindMapCanvas({ id, title, initialNodes, initialEdges }: Props) {
  const [nodes, setNodes] = useState<MindMapNode[]>(initialNodes);
  const [edges, setEdges] = useState<MindMapEdge[]>(initialEdges);
  const [mapTitle, setMapTitle] = useState(title);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editNode, setEditNode] = useState<MindMapNode | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  let nextNodeId = useRef(nodes.length + 1);

  // ── Save ─────────────────────────────────────────────────────────
  const save = useCallback(async () => {
    setSaving(true);
    const result = await saveMindMapAction(id, {
      title: mapTitle,
      nodes,
      edges,
    });
    setSaving(false);
    if (result.success) {
      setDirty(false);
      toast.success("Mind map saved");
    }
  }, [id, mapTitle, nodes, edges]);

  // ── Add node ─────────────────────────────────────────────────────
  function addNode() {
    const newId = `n${nextNodeId.current++}`;
    const newNode: MindMapNode = {
      id: newId,
      x: 300 + Math.random() * 200,
      y: 200 + Math.random() * 150,
      label: "New idea",
      color: NODE_COLORS[nodes.length % NODE_COLORS.length],
      radius: 30,
    };
    setNodes((prev) => [...prev, newNode]);
    setDirty(true);
    setSelectedId(newId);
  }

  // ── Delete selected ──────────────────────────────────────────────
  function deleteSelected() {
    if (!selectedId) return;
    setNodes((prev) => prev.filter((n) => n.id !== selectedId));
    setEdges((prev) =>
      prev.filter((e) => e.from !== selectedId && e.to !== selectedId),
    );
    setSelectedId(null);
    setDirty(true);
  }

  // ── Pointer handlers ────────────────────────────────────────────
  function handlePointerDown(e: ReactPointerEvent, nodeId: string) {
    e.preventDefault();
    e.stopPropagation();

    if (connectingFrom) {
      // Complete connection
      if (connectingFrom !== nodeId) {
        const edgeExists = edges.some(
          (ed) =>
            (ed.from === connectingFrom && ed.to === nodeId) ||
            (ed.from === nodeId && ed.to === connectingFrom),
        );
        if (!edgeExists) {
          setEdges((prev) => [
            ...prev,
            {
              id: `e${Date.now()}`,
              from: connectingFrom,
              to: nodeId,
            },
          ]);
          setDirty(true);
        }
      }
      setConnectingFrom(null);
      return;
    }

    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    dragOffset.current = {
      x: e.clientX - rect.left - node.x,
      y: e.clientY - rect.top - node.y,
    };

    setDraggingId(nodeId);
    setSelectedId(nodeId);
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: ReactPointerEvent) {
    if (!draggingId) return;
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left - dragOffset.current.x;
    const y = e.clientY - rect.top - dragOffset.current.y;

    setNodes((prev) =>
      prev.map((n) => (n.id === draggingId ? { ...n, x, y } : n)),
    );
    setDirty(true);
  }

  function handlePointerUp() {
    setDraggingId(null);
  }

  function handleSvgClick() {
    if (!connectingFrom) {
      setSelectedId(null);
    }
    setConnectingFrom(null);
  }

  // ── Keyboard shortcuts ───────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (
          document.activeElement?.tagName === "INPUT" ||
          document.activeElement?.tagName === "TEXTAREA"
        )
          return;
        deleteSelected();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // ── Edit node dialog save ────────────────────────────────────────
  function saveEditNode() {
    if (!editNode) return;
    setNodes((prev) =>
      prev.map((n) =>
        n.id === editNode.id
          ? { ...n, label: editNode.label, color: editNode.color, radius: editNode.radius }
          : n,
      ),
    );
    setEditNode(null);
    setDirty(true);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2">
        <Input
          value={mapTitle}
          onChange={(e) => {
            setMapTitle(e.target.value);
            setDirty(true);
          }}
          className="max-w-xs text-sm font-medium"
          aria-label="Mind map title"
        />
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={addNode}>
            Add Node
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (selectedId) {
                setConnectingFrom(selectedId);
                toast.info("Click another node to connect");
              } else {
                toast.info("Select a node first");
              }
            }}
            className={cn(connectingFrom && "border-primary text-primary")}
          >
            {connectingFrom ? "Connecting..." : "Connect"}
          </Button>
          {selectedId && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const node = nodes.find((n) => n.id === selectedId);
                  if (node) setEditNode({ ...node });
                }}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={deleteSelected}
              >
                Delete
              </Button>
            </>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {dirty && (
            <span className="text-xs text-amber-400">Unsaved changes</span>
          )}
          <Button size="sm" onClick={save} disabled={saving || !dirty}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative flex-1 overflow-hidden bg-card">
        <svg
          ref={svgRef}
          className="h-full w-full cursor-crosshair"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={handleSvgClick}
          role="img"
          aria-label={`Mind map: ${mapTitle}`}
        >
          {/* Grid pattern */}
          <defs>
            <pattern
              id="grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1" cy="1" r="0.5" fill="hsl(240 4% 18%)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Edges */}
          {edges.map((edge) => {
            const fromNode = nodes.find((n) => n.id === edge.from);
            const toNode = nodes.find((n) => n.id === edge.to);
            if (!fromNode || !toNode) return null;
            return (
              <line
                key={edge.id}
                x1={fromNode.x}
                y1={fromNode.y}
                x2={toNode.x}
                y2={toNode.y}
                stroke="hsl(215 14% 35%)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const isSelected = selectedId === node.id;
            const isConnecting = connectingFrom === node.id;
            const lines = node.label.split("\n");
            return (
              <g
                key={node.id}
                onPointerDown={(e) => handlePointerDown(e, node.id)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditNode({ ...node });
                }}
                className="cursor-grab active:cursor-grabbing"
                role="button"
                tabIndex={0}
                aria-label={`Node: ${node.label}`}
              >
                {/* Glow when selected */}
                {(isSelected || isConnecting) && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.radius + 6}
                    fill="none"
                    stroke={isConnecting ? "#f59e0b" : "#3b82f6"}
                    strokeWidth="2"
                    strokeDasharray={isConnecting ? "6 3" : "none"}
                    opacity={0.6}
                  />
                )}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.radius}
                  fill={node.color}
                  opacity={0.85}
                />
                {lines.map((line, i) => (
                  <text
                    key={i}
                    x={node.x}
                    y={
                      node.y +
                      (i - (lines.length - 1) / 2) * 13
                    }
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="white"
                    fontSize="11"
                    fontWeight="600"
                    fontFamily="var(--font-inter), system-ui, sans-serif"
                    pointerEvents="none"
                    style={{ userSelect: "none" }}
                  >
                    {line}
                  </text>
                ))}
              </g>
            );
          })}
        </svg>

        {/* Hint */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Click "Add Node" to start your mind map
            </p>
          </div>
        )}
      </div>

      {/* Edit Node Dialog */}
      <Dialog open={!!editNode} onOpenChange={() => setEditNode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Node</DialogTitle>
          </DialogHeader>
          {editNode && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="node-label">Label</Label>
                <Input
                  id="node-label"
                  value={editNode.label}
                  onChange={(e) =>
                    setEditNode({ ...editNode, label: e.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {NODE_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={cn(
                        "h-8 w-8 rounded-full transition-all",
                        editNode.color === color && "ring-2 ring-primary ring-offset-2 ring-offset-card",
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => setEditNode({ ...editNode, color })}
                      aria-label={`Select color ${color}`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="node-size">
                  Size: {editNode.radius}px
                </Label>
                <input
                  id="node-size"
                  type="range"
                  min={20}
                  max={60}
                  value={editNode.radius}
                  onChange={(e) =>
                    setEditNode({
                      ...editNode,
                      radius: Number(e.target.value),
                    })
                  }
                  className="w-full accent-primary"
                />
              </div>
              <Button onClick={saveEditNode}>Apply</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
