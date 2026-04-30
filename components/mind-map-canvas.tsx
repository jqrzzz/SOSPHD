"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveMindMapAction } from "@/lib/workspace-actions";
import type {
  MindMapNode,
  MindMapEdge,
  MindMapNodeType,
} from "@/lib/data/workspace-types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* ── Constants ────────────────────────────────────────────────────── */

const NODE_COLORS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#f97316", // orange
  "#14b8a6", // teal (brand-adjacent)
  "#6366f1", // indigo
];

const NODE_TYPE_LABELS: Record<MindMapNodeType, string> = {
  idea: "Idea",
  paper: "Paper",
  data: "Data Source",
  method: "Method",
  question: "Question",
  milestone: "Milestone",
};

const NODE_TYPE_SHAPES: Record<MindMapNodeType, string> = {
  idea: "circle",
  paper: "rounded-rect",
  data: "diamond",
  method: "hexagon",
  question: "circle-dashed",
  milestone: "star",
};

const GRID_SIZE = 20;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
const UNDO_LIMIT = 50;

/* ── Types ────────────────────────────────────────────────────────── */

interface UndoState {
  nodes: MindMapNode[];
  edges: MindMapEdge[];
}

interface Props {
  id: string;
  title: string;
  initialNodes: MindMapNode[];
  initialEdges: MindMapEdge[];
}

/* ── Helpers ──────────────────────────────────────────────────────── */

function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

function renderNodeShape(
  node: MindMapNode,
  isSelected: boolean,
  isConnecting: boolean,
) {
  const nodeType = node.nodeType || "idea";
  const glowColor = isConnecting ? "#f59e0b" : "#3b82f6";

  const glow = (isSelected || isConnecting) && (
    <circle
      cx={node.x}
      cy={node.y}
      r={node.radius + 6}
      fill="none"
      stroke={glowColor}
      strokeWidth="2"
      strokeDasharray={isConnecting ? "6 3" : "none"}
      opacity={0.6}
    />
  );

  let shape: React.ReactNode;

  switch (NODE_TYPE_SHAPES[nodeType]) {
    case "rounded-rect": {
      const w = node.radius * 2;
      const h = node.radius * 1.4;
      shape = (
        <rect
          x={node.x - w / 2}
          y={node.y - h / 2}
          width={w}
          height={h}
          rx={8}
          fill={node.color}
          opacity={0.85}
        />
      );
      break;
    }
    case "diamond": {
      const r = node.radius;
      const points = `${node.x},${node.y - r} ${node.x + r},${node.y} ${node.x},${node.y + r} ${node.x - r},${node.y}`;
      shape = <polygon points={points} fill={node.color} opacity={0.85} />;
      break;
    }
    case "circle-dashed":
      shape = (
        <circle
          cx={node.x}
          cy={node.y}
          r={node.radius}
          fill={node.color}
          opacity={0.85}
          strokeDasharray="4 3"
          stroke="white"
          strokeWidth="1.5"
        />
      );
      break;
    default:
      shape = (
        <circle
          cx={node.x}
          cy={node.y}
          r={node.radius}
          fill={node.color}
          opacity={0.85}
        />
      );
  }

  return (
    <>
      {glow}
      {shape}
    </>
  );
}

/* ── Component ────────────────────────────────────────────────────── */

export function MindMapCanvas({
  id,
  title,
  initialNodes,
  initialEdges,
}: Props) {
  // ── State ─────────────────────────────────────────────────────
  const [nodes, setNodes] = useState<MindMapNode[]>(initialNodes);
  const [edges, setEdges] = useState<MindMapEdge[]>(initialEdges);
  const [mapTitle, setMapTitle] = useState(title);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editNode, setEditNode] = useState<MindMapNode | null>(null);
  const [editEdge, setEditEdge] = useState<MindMapEdge | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Zoom & pan
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);

  // Undo
  const [undoStack, setUndoStack] = useState<UndoState[]>([]);
  const [redoStack, setRedoStack] = useState<UndoState[]>([]);

  // Refs
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });
  const nextNodeId = useRef(initialNodes.length + 1);

  // ── Undo helpers ──────────────────────────────────────────────
  function pushUndo() {
    setUndoStack((prev) => {
      const next = [
        ...prev,
        { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) },
      ];
      if (next.length > UNDO_LIMIT) next.shift();
      return next;
    });
    setRedoStack([]);
  }

  function undo() {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) }]);
    setUndoStack((u) => u.slice(0, -1));
    setNodes(prev.nodes);
    setEdges(prev.edges);
    setDirty(true);
  }

  function redo() {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u, { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) }]);
    setRedoStack((r) => r.slice(0, -1));
    setNodes(next.nodes);
    setEdges(next.edges);
    setDirty(true);
  }

  // ── Screen <-> SVG coordinate conversion ──────────────────────
  function screenToSvg(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  }

  // ── Save ──────────────────────────────────────────────────────
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

  // ── Add node ──────────────────────────────────────────────────
  function addNode() {
    pushUndo();
    const selected = nodes.find((n) => n.id === selectedId);
    const baseX = selected ? selected.x + selected.radius * 3 : 400;
    const baseY = selected ? selected.y : 250;
    const newId = `n${nextNodeId.current++}`;
    const newNode: MindMapNode = {
      id: newId,
      x: snapToGrid(baseX),
      y: snapToGrid(baseY),
      label: "New idea",
      color: NODE_COLORS[nodes.length % NODE_COLORS.length],
      radius: 30,
      nodeType: "idea",
    };
    setNodes((prev) => [...prev, newNode]);
    setDirty(true);
    setSelectedId(newId);
  }

  // ── Delete selected ───────────────────────────────────────────
  function deleteSelected() {
    if (!selectedId) return;
    pushUndo();
    setNodes((prev) => prev.filter((n) => n.id !== selectedId));
    setEdges((prev) =>
      prev.filter((e) => e.from !== selectedId && e.to !== selectedId),
    );
    setSelectedId(null);
    setDirty(true);
  }

  // ── Export as PNG ─────────────────────────────────────────────
  function exportPng() {
    const svg = svgRef.current;
    if (!svg) return;

    // Compute bounds of all nodes
    if (nodes.length === 0) return;
    const padding = 60;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x - n.radius);
      minY = Math.min(minY, n.y - n.radius);
      maxX = Math.max(maxX, n.x + n.radius);
      maxY = Math.max(maxY, n.y + n.radius);
    }
    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;

    // Clone SVG and set viewBox
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("viewBox", `${minX - padding} ${minY - padding} ${width} ${height}`);
    clone.setAttribute("width", String(width * 2));
    clone.setAttribute("height", String(height * 2));
    // Remove the transform group's transform so nodes are at their real positions
    const g = clone.querySelector("g[data-canvas]");
    if (g) g.removeAttribute("transform");

    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(clone);
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * 2;
      canvas.height = height * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#0f1318";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const a = document.createElement("a");
      a.download = `${mapTitle || "mindmap"}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
      toast.success("Exported as PNG");
    };
    img.src = url;
  }

  // ── Pointer handlers (drag nodes) ─────────────────────────────
  function handleNodePointerDown(e: ReactPointerEvent, nodeId: string) {
    e.preventDefault();
    e.stopPropagation();

    if (connectingFrom) {
      if (connectingFrom !== nodeId) {
        const edgeExists = edges.some(
          (ed) =>
            (ed.from === connectingFrom && ed.to === nodeId) ||
            (ed.from === nodeId && ed.to === connectingFrom),
        );
        if (!edgeExists) {
          pushUndo();
          setEdges((prev) => [
            ...prev,
            { id: `e${Date.now()}`, from: connectingFrom, to: nodeId },
          ]);
          setDirty(true);
        }
      }
      setConnectingFrom(null);
      return;
    }

    const svg = svgRef.current;
    if (!svg) return;
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const pos = screenToSvg(e.clientX, e.clientY);
    dragOffset.current = { x: pos.x - node.x, y: pos.y - node.y };
    setDraggingId(nodeId);
    setSelectedId(nodeId);
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: ReactPointerEvent) {
    if (panning) {
      setPan({
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y,
      });
      return;
    }

    if (!draggingId) return;
    const pos = screenToSvg(e.clientX, e.clientY);
    const x = snapToGrid(pos.x - dragOffset.current.x);
    const y = snapToGrid(pos.y - dragOffset.current.y);

    setNodes((prev) =>
      prev.map((n) => (n.id === draggingId ? { ...n, x, y } : n)),
    );
    setDirty(true);
  }

  function handlePointerUp() {
    if (draggingId) {
      // Push undo after drag completes
      pushUndo();
    }
    setDraggingId(null);
    setPanning(false);
  }

  // ── Pan (middle click or background drag) ─────────────────────
  function handleSvgPointerDown(e: ReactPointerEvent) {
    // Middle mouse button or ctrl+click for panning
    if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
      e.preventDefault();
      setPanning(true);
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }
  }

  function handleSvgClick() {
    if (!connectingFrom) {
      setSelectedId(null);
    }
    setConnectingFrom(null);
  }

  // ── Zoom (scroll wheel) ───────────────────────────────────────
  function handleWheel(e: ReactWheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((prev) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev * delta)));
  }

  // ── Edge click ────────────────────────────────────────────────
  function handleEdgeClick(e: React.MouseEvent, edge: MindMapEdge) {
    e.stopPropagation();
    setEditEdge({ ...edge });
  }

  // ── Keyboard shortcuts ────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const inInput =
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA";

      if (e.key === "Delete" || e.key === "Backspace") {
        if (inInput) return;
        deleteSelected();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (dirty) save();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // ── Edit node dialog save ─────────────────────────────────────
  function saveEditNode() {
    if (!editNode) return;
    pushUndo();
    setNodes((prev) =>
      prev.map((n) =>
        n.id === editNode.id
          ? {
              ...n,
              label: editNode.label,
              color: editNode.color,
              radius: editNode.radius,
              nodeType: editNode.nodeType,
            }
          : n,
      ),
    );
    setEditNode(null);
    setDirty(true);
  }

  // ── Edit edge dialog save ─────────────────────────────────────
  function saveEditEdge() {
    if (!editEdge) return;
    pushUndo();
    setEdges((prev) =>
      prev.map((e) =>
        e.id === editEdge.id ? { ...e, label: editEdge.label } : e,
      ),
    );
    setEditEdge(null);
    setDirty(true);
  }

  function deleteEdge() {
    if (!editEdge) return;
    pushUndo();
    setEdges((prev) => prev.filter((e) => e.id !== editEdge.id));
    setEditEdge(null);
    setDirty(true);
  }

  // ── Zoom controls ─────────────────────────────────────────────
  function zoomIn() {
    setZoom((prev) => Math.min(MAX_ZOOM, prev * 1.2));
  }
  function zoomOut() {
    setZoom((prev) => Math.max(MIN_ZOOM, prev * 0.8));
  }
  function resetView() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <Input
          value={mapTitle}
          onChange={(e) => {
            setMapTitle(e.target.value);
            setDirty(true);
          }}
          className="max-w-xs text-sm font-medium"
          aria-label="Mind map title"
        />

        <div className="h-4 w-px bg-border" />

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

        <div className="h-4 w-px bg-border" />

        {/* Undo/Redo */}
        <Button
          size="sm"
          variant="ghost"
          onClick={undo}
          disabled={undoStack.length === 0}
          title="Undo (Ctrl+Z)"
          className="px-2"
        >
          <UndoIcon className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={redo}
          disabled={redoStack.length === 0}
          title="Redo (Ctrl+Shift+Z)"
          className="px-2"
        >
          <RedoIcon className="h-4 w-4" />
        </Button>

        <div className="h-4 w-px bg-border" />

        {/* Zoom */}
        <Button size="sm" variant="ghost" onClick={zoomOut} title="Zoom out" className="px-2">
          <MinusIcon className="h-4 w-4" />
        </Button>
        <button
          onClick={resetView}
          className="min-w-[3rem] text-center font-mono text-xs text-muted-foreground hover:text-foreground"
          title="Reset view"
        >
          {Math.round(zoom * 100)}%
        </button>
        <Button size="sm" variant="ghost" onClick={zoomIn} title="Zoom in" className="px-2">
          <PlusIcon className="h-4 w-4" />
        </Button>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={exportPng} title="Export as PNG" className="px-2">
            <DownloadIcon className="h-4 w-4" />
          </Button>
          {dirty && (
            <span className="text-xs text-amber-400">Unsaved</span>
          )}
          <Button size="sm" onClick={save} disabled={saving || !dirty}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden bg-card"
        onWheel={handleWheel}
      >
        <svg
          ref={svgRef}
          className={cn(
            "h-full w-full",
            panning ? "cursor-grabbing" : "cursor-crosshair",
          )}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerDown={handleSvgPointerDown}
          onClick={handleSvgClick}
          role="img"
          aria-label={`Mind map: ${mapTitle}`}
        >
          {/* Grid pattern */}
          <defs>
            <pattern
              id="grid"
              width={GRID_SIZE}
              height={GRID_SIZE}
              patternUnits="userSpaceOnUse"
              patternTransform={`translate(${pan.x},${pan.y}) scale(${zoom})`}
            >
              <circle cx="1" cy="1" r="0.5" fill="hsl(220 15% 18%)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Transformed group for zoom/pan */}
          <g
            data-canvas
            transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}
          >
            {/* Edges */}
            {edges.map((edge) => {
              const fromNode = nodes.find((n) => n.id === edge.from);
              const toNode = nodes.find((n) => n.id === edge.to);
              if (!fromNode || !toNode) return null;
              const mx = (fromNode.x + toNode.x) / 2;
              const my = (fromNode.y + toNode.y) / 2;
              return (
                <g key={edge.id}>
                  {/* Clickable wider invisible line for easy selection */}
                  <line
                    x1={fromNode.x}
                    y1={fromNode.y}
                    x2={toNode.x}
                    y2={toNode.y}
                    stroke="transparent"
                    strokeWidth="12"
                    className="cursor-pointer"
                    onClick={(e) => handleEdgeClick(e, edge)}
                  />
                  <line
                    x1={fromNode.x}
                    y1={fromNode.y}
                    x2={toNode.x}
                    y2={toNode.y}
                    stroke="hsl(215 14% 35%)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    pointerEvents="none"
                  />
                  {/* Edge label */}
                  {edge.label && (
                    <g onClick={(e) => handleEdgeClick(e, edge)} className="cursor-pointer">
                      <rect
                        x={mx - edge.label.length * 3.2 - 4}
                        y={my - 8}
                        width={edge.label.length * 6.4 + 8}
                        height={16}
                        rx={4}
                        fill="hsl(220 18% 10%)"
                        stroke="hsl(220 15% 20%)"
                        strokeWidth="1"
                      />
                      <text
                        x={mx}
                        y={my}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="hsl(0 0% 60%)"
                        fontSize="9"
                        fontFamily="var(--font-inter), system-ui, sans-serif"
                        pointerEvents="none"
                        style={{ userSelect: "none" }}
                      >
                        {edge.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const isSelected = selectedId === node.id;
              const isConnecting = connectingFrom === node.id;
              const lines = node.label.split("\n");
              const typeLabel = node.nodeType
                ? NODE_TYPE_LABELS[node.nodeType]
                : null;
              return (
                <g
                  key={node.id}
                  onPointerDown={(e) => handleNodePointerDown(e, node.id)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditNode({ ...node });
                  }}
                  className="cursor-grab active:cursor-grabbing"
                  role="button"
                  tabIndex={0}
                  aria-label={`Node: ${node.label}`}
                >
                  {renderNodeShape(node, isSelected, isConnecting)}
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
                  {/* Node type indicator */}
                  {typeLabel && (
                    <text
                      x={node.x}
                      y={node.y + node.radius + 12}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="hsl(0 0% 50%)"
                      fontSize="8"
                      fontFamily="var(--font-inter), system-ui, sans-serif"
                      pointerEvents="none"
                      style={{ userSelect: "none" }}
                    >
                      {typeLabel}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Empty hint */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Click &ldquo;Add Node&rdquo; to start your mind map
            </p>
          </div>
        )}

        {/* Zoom hint */}
        <div className="absolute bottom-3 left-3 text-[10px] text-muted-foreground/40">
          Scroll to zoom · Ctrl+click to pan · Double-click to edit
        </div>
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
                <Textarea
                  id="node-label"
                  value={editNode.label}
                  onChange={(e) =>
                    setEditNode({ ...editNode, label: e.target.value })
                  }
                  rows={2}
                  placeholder="Enter label (use Enter for new lines)"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Type</Label>
                <Select
                  value={editNode.nodeType || "idea"}
                  onValueChange={(v) =>
                    setEditNode({
                      ...editNode,
                      nodeType: v as MindMapNodeType,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(NODE_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {NODE_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={cn(
                        "h-7 w-7 rounded-full transition-all",
                        editNode.color === color &&
                          "ring-2 ring-primary ring-offset-2 ring-offset-card",
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => setEditNode({ ...editNode, color })}
                      aria-label={`Select color ${color}`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="node-size">Size: {editNode.radius}px</Label>
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

      {/* Edit Edge Dialog */}
      <Dialog open={!!editEdge} onOpenChange={() => setEditEdge(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Connection</DialogTitle>
          </DialogHeader>
          {editEdge && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="edge-label">Label</Label>
                <Input
                  id="edge-label"
                  value={editEdge.label || ""}
                  onChange={(e) =>
                    setEditEdge({ ...editEdge, label: e.target.value })
                  }
                  placeholder="e.g. feeds into, supports, blocks..."
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={saveEditEdge} className="flex-1">
                  Apply
                </Button>
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={deleteEdge}
                >
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Inline Icons ─────────────────────────────────────────────────── */

function UndoIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </svg>
  );
}

function RedoIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
    </svg>
  );
}

function MinusIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14" /><path d="M12 5v14" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}
