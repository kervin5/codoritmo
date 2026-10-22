"use client";

// PROTOTYPE — flowchart restyled for the "player" direction: dark, soft
// palette; the block that is playing glows, visited blocks stay lit, the rest
// dim. Reuses the real model + layout (src/diagram), only rendering differs.

import {
  Background,
  BackgroundVariant,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { memo, useEffect, useMemo, useRef, useState } from "react";

import { buildFlowDiagram, layoutFlowDiagram, type FlowNodeKind, type PositionedFlowDiagram } from "@/src/diagram";
import { Parser, type EngineSettings } from "@/src/engine";

type MellowNodeData = { label: string; kind: FlowNodeKind; state: "active" | "visited" | "idle" | "dim"; line?: number };
type MellowNode = Node<MellowNodeData>;

const palette: Record<FlowNodeKind, { fill: string; stroke: string; text: string }> = {
  terminator: { fill: "#1B2723", stroke: "#3F7C66", text: "#BFE6D4" },
  io: { fill: "#18222C", stroke: "#4E7EA3", text: "#BED7EC" },
  decision: { fill: "#272217", stroke: "#A88546", text: "#EAD3A5" },
  loop: { fill: "#192620", stroke: "#58A684", text: "#C5EAD9" },
  switch: { fill: "#261C25", stroke: "#9C7596", text: "#E6CDE1" },
  branch: { fill: "#1C1F22", stroke: "#5B6266", text: "#C9D0CD" },
  process: { fill: "#1B1F22", stroke: "#3D464B", text: "#DCE3E0" },
} as Record<FlowNodeKind, { fill: string; stroke: string; text: string }>;

const ACTIVE = "#86F0C4";

const MellowNodeCard = memo(function MellowNodeCard({ data }: NodeProps<MellowNode>) {
  const colors = palette[data.kind] ?? palette.process;
  const active = data.state === "active";
  const opacity = data.state === "dim" ? 0.42 : 1;
  const stroke = active ? ACTIVE : colors.stroke;
  const glow = active ? `0 0 0 1.5px ${ACTIVE}, 0 0 28px rgba(134,240,196,0.38)` : "none";
  const handles = (
    <>
      <Handle id="top" position={Position.Top} style={{ opacity: 0 }} type="target" />
      <Handle id="left-in" position={Position.Left} style={{ opacity: 0 }} type="target" />
      <Handle id="right-in" position={Position.Right} style={{ opacity: 0 }} type="target" />
      <Handle id="left" position={Position.Left} style={{ opacity: 0 }} type="source" />
      <Handle id="right" position={Position.Right} style={{ opacity: 0 }} type="source" />
      <Handle id="bottom" position={Position.Bottom} style={{ opacity: 0 }} type="source" />
    </>
  );
  const label = (
    <div className="text-center text-[13px] leading-5 font-medium" style={{ color: active ? "#F2FFF9" : colors.text }}>
      {data.label}
    </div>
  );

  if (data.kind === "decision") {
    return (
      <div className="relative h-full w-full transition-opacity duration-300" style={{ opacity, filter: active ? "drop-shadow(0 0 14px rgba(134,240,196,0.45))" : undefined }}>
        {handles}
        <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 212 132">
          <path d="M106 4 L208 66 L106 128 L4 66 Z" fill={colors.fill} stroke={stroke} strokeWidth={active ? 2 : 1.3} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center px-10">{label}</div>
      </div>
    );
  }

  const shape: React.CSSProperties =
    data.kind === "terminator"
      ? { borderRadius: 999 }
      : data.kind === "io"
        ? { borderRadius: 10, transform: "skewX(-12deg)" }
        : data.kind === "loop"
          ? { borderRadius: 22 }
          : data.kind === "branch"
            ? { borderRadius: 14, borderStyle: "dashed" }
            : { borderRadius: 14 };

  return (
    <div className="relative h-full w-full transition-opacity duration-300" style={{ opacity }}>
      {handles}
      <div
        className="flex h-full w-full items-center justify-center border px-5 py-3 transition-[box-shadow,border-color] duration-300"
        style={{ ...shape, background: colors.fill, borderColor: stroke, boxShadow: glow }}
      >
        <div style={data.kind === "io" ? { transform: "skewX(12deg)" } : undefined}>{label}</div>
      </div>
    </div>
  );
});

const nodeTypes = { mellow: MellowNodeCard };

interface MellowDiagramProps {
  source: string;
  settings: EngineSettings;
  activeLine: number | null;
  visitedLines: Set<number>;
  routineName: string | null;
  onPickLine?: (line: number) => void;
}

function Canvas({ source, settings, activeLine, visitedLines, routineName, onPickLine }: MellowDiagramProps) {
  const [diagram, setDiagram] = useState<PositionedFlowDiagram | null>(null);
  const [pickedRoutine, setPickedRoutine] = useState<string | null>(null);
  const flow = useReactFlow();

  useEffect(() => {
    const parsed = new Parser(source, { settings }).parse();
    if (!parsed.program) return;
    let cancelled = false;
    void layoutFlowDiagram(buildFlowDiagram(parsed.program)).then((result) => {
      if (!cancelled) setDiagram(result);
    });
    return () => {
      cancelled = true;
    };
  }, [settings, source]);

  const routines = diagram?.routines ?? [];
  const playingRoutine = routineName
    ? routines.find((r) => r.label.toLowerCase().includes(routineName.toLowerCase()))
    : undefined;
  const routine = playingRoutine ?? routines.find((r) => r.id === pickedRoutine) ?? routines[0];
  const hasRun = visitedLines.size > 0;

  const nodes = useMemo<MellowNode[]>(() => {
    if (!routine) return [];
    return routine.nodes.map((node) => {
      const line = node.sourceSpan?.start.line;
      const state: MellowNodeData["state"] =
        line !== undefined && line === activeLine
          ? "active"
          : line !== undefined && visitedLines.has(line)
            ? "visited"
            : hasRun && node.kind !== "terminator"
              ? "dim"
              : "idle";
      return {
        id: node.id,
        type: "mellow",
        position: node.position,
        draggable: false,
        style: { width: node.size.width, height: node.size.height },
        data: { label: node.label, kind: node.kind, state, line },
      };
    });
  }, [activeLine, hasRun, routine, visitedLines]);

  const edges = useMemo<Edge[]>(() => {
    if (!routine) return [];
    return routine.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      label: edge.label,
      type: "smoothstep",
      animated: edge.kind === "loop",
      pathOptions: edge.kind === "loop" ? { offset: 36, borderRadius: 18 } : { borderRadius: 14 },
      style: {
        stroke: edge.kind === "loop" ? "#3F7C66" : "#384146",
        strokeWidth: 1.5,
        ...(edge.kind === "loop" ? { strokeDasharray: "6 6" } : {}),
      },
      labelStyle: { fill: "#AEB8B4", fontSize: 11, fontWeight: 600 },
      labelBgStyle: { fill: "#161B1E", fillOpacity: 1 },
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 999,
    }));
  }, [routine]);

  // Open at a readable zoom: fit the width (never below 55%), anchored at the top.
  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!nodes.length) return;
    const frame = requestAnimationFrame(() => {
      const box = wrapperRef.current?.getBoundingClientRect();
      if (!box) return;
      let minX = Infinity, minY = Infinity, maxX = -Infinity;
      for (const n of nodes) {
        minX = Math.min(minX, n.position.x);
        minY = Math.min(minY, n.position.y);
        maxX = Math.max(maxX, n.position.x + Number(n.style?.width ?? 0));
      }
      const zoom = Math.min(1, Math.max(0.55, (box.width - 48) / (maxX - minX)));
      void flow.setViewport(
        { x: (box.width - (maxX - minX) * zoom) / 2 - minX * zoom, y: 28 - minY * zoom, zoom },
        { duration: 250 }
      );
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routine?.id, nodes.length]);

  useEffect(() => {
    if (activeLine === null) return;
    const node = nodes.find((n) => n.data.state === "active");
    if (!node) return;
    const width = Number(node.style?.width ?? 0);
    const height = Number(node.style?.height ?? 0);
    void flow.setCenter(node.position.x + width / 2, node.position.y + height / 2, {
      zoom: Math.max(flow.getZoom(), 0.75),
      duration: 350,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLine]);

  return (
    <div ref={wrapperRef} className="relative h-full w-full">
      {routines.length > 1 && (
        <div className="absolute top-3 left-3 z-10 flex gap-1 rounded-full bg-black/30 p-1 backdrop-blur">
          {routines.map((r) => (
            <button
              key={r.id}
              className={`rounded-full px-3 py-1 text-[12px] ${r.id === routine?.id ? "bg-white/12 text-white" : "text-[#8E9A95] hover:text-white"}`}
              onClick={() => setPickedRoutine(r.id)}
              type="button"
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
      <ReactFlow
        colorMode="dark"
        edges={edges}
        maxZoom={1.6}
        minZoom={0.2}
        nodeTypes={nodeTypes}
        nodes={nodes}
        nodesConnectable={false}
        nodesDraggable={false}
        onNodeClick={(_event, node) => node.data.line && onPickLine?.(node.data.line)}
        proOptions={{ hideAttribution: true }}
        style={{ background: "transparent" }}
      >
        <Background color="#22292D" gap={22} size={1.4} variant={BackgroundVariant.Dots} />
      </ReactFlow>
    </div>
  );
}

export default function MellowDiagram(props: MellowDiagramProps) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
