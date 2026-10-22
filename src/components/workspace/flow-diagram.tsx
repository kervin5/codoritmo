"use client";

// Live flowchart: dark, soft palette; the block that is running glows,
// visited blocks stay lit, the rest dim. Uses the shared model + layout from
// src/diagram; only the rendering is specific to the workspace.

import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { memo, useEffect, useMemo, useRef, useState } from "react";

import {
  buildFlowDiagram,
  DARK_ACTIVE_COLOR,
  DARK_ACTIVE_FILL,
  DARK_ACTIVE_TEXT,
  DARK_EDGE_COLORS,
  DARK_TOKEN_COLORS,
  darkPaletteForFlowNodeKind,
  ioMarkerPath,
  layoutFlowDiagram,
  polylinePath,
  SHAPE_FOR_KIND,
  shapeGeometry,
  tokenColor,
  type FlowNode,
  type Point,
  type PositionedFlowDiagram,
} from "@/src/diagram";
import { LABEL_FONT_FAMILY, LABEL_FONT_SIZE, LABEL_LINE_HEIGHT } from "@/src/diagram/label";
import { Parser, type EngineSettings } from "@/src/engine";

type FlowNodeViewData = {
  node: FlowNode;
  state: "active" | "visited" | "idle" | "dim";
  line?: number;
};
type FlowNodeView = Node<FlowNodeViewData>;
type RoutedEdgeData = { points: Point[]; labelPosition?: Point };
type RoutedEdgeView = Edge<RoutedEdgeData>;

// Every connector is routed by src/diagram (same as the PNG/SVG export), so
// these handles only give React Flow something to attach edges to; each
// edge names its source and target handle explicitly.
const hiddenHandle = { opacity: 0, pointerEvents: "none" as const };
const HANDLES = (
  <>
    <Handle id="top" position={Position.Top} style={hiddenHandle} type="target" />
    <Handle id="left-in" position={Position.Left} style={hiddenHandle} type="target" />
    <Handle id="right-in" position={Position.Right} style={hiddenHandle} type="target" />
    <Handle id="bottom" position={Position.Bottom} style={hiddenHandle} type="source" />
    <Handle id="left" position={Position.Left} style={hiddenHandle} type="source" />
    <Handle id="right" position={Position.Right} style={hiddenHandle} type="source" />
  </>
);

const FlowNodeViewCard = memo(function FlowNodeViewCard({ data }: NodeProps<FlowNodeView>) {
  const { node, state } = data;
  const colors = darkPaletteForFlowNodeKind(node.kind);
  const active = state === "active";
  const { width, height } = node.size;
  const shape = shapeGeometry(SHAPE_FOR_KIND[node.kind], width, height);
  const stroke = active ? DARK_ACTIVE_COLOR : colors.stroke;
  const tooltip = node.truncated || node.title !== node.label ? node.title : undefined;

  return (
    <div
      className="relative h-full w-full transition-opacity duration-300"
      style={{ opacity: state === "dim" ? 0.42 : 1 }}
      title={tooltip}
    >
      {HANDLES}
      <svg
        className="absolute inset-0 overflow-visible transition-[filter] duration-300"
        height={height}
        style={{ filter: active ? "drop-shadow(0 0 10px rgba(134,240,196,0.5))" : undefined }}
        width={width}
      >
        <path
          d={shape.outline}
          fill={node.kind === "junction" ? stroke : active ? DARK_ACTIVE_FILL : colors.fill}
          stroke={stroke}
          strokeWidth={node.kind === "junction" ? 0 : active ? 2 : 1.4}
        />
        {shape.details && <path d={shape.details} fill="none" stroke={stroke} strokeWidth={1.3} />}
        {(node.kind === "input" || node.kind === "output") && (
          <path
            d={ioMarkerPath(node.kind, width, height)}
            fill="none"
            stroke={stroke}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
          />
        )}
      </svg>
      {node.lines.length > 0 && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center whitespace-pre"
          style={{ fontFamily: LABEL_FONT_FAMILY, fontSize: LABEL_FONT_SIZE, lineHeight: `${LABEL_LINE_HEIGHT}px` }}
        >
          {node.lines.map((line, lineIndex) => (
            <div key={lineIndex}>
              {line.map((token, tokenIndex) => (
                <span
                  key={tokenIndex}
                  style={{
                    color: token.type === "identifier" && active
                      ? DARK_ACTIVE_TEXT
                      : tokenColor(token.type, colors, DARK_TOKEN_COLORS),
                    fontWeight: token.type === "keyword" ? 600 : 400,
                  }}
                >
                  {token.text}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

function RoutedEdge({ id, data, label, markerEnd, style }: EdgeProps<RoutedEdgeView>) {
  if (!data) return null;
  return (
    <BaseEdge
      id={id}
      label={label}
      labelBgBorderRadius={999}
      labelBgPadding={[6, 3]}
      labelBgStyle={{ fill: "#161B1E", fillOpacity: 1, stroke: String(style?.stroke ?? "#5A666C"), strokeOpacity: 0.5 }}
      labelStyle={{ fill: "#C3CCC8", fontSize: 11, fontWeight: 600 }}
      labelX={data.labelPosition?.x}
      labelY={data.labelPosition?.y}
      markerEnd={markerEnd}
      path={polylinePath(data.points)}
      style={style}
    />
  );
}

const nodeTypes = { flow: FlowNodeViewCard };
const edgeTypes = { routed: RoutedEdge };

interface FlowDiagramProps {
  source: string;
  settings: EngineSettings;
  activeLine: number | null;
  visitedLines: Set<number>;
  routineName: string | null;
  onPickLine?: (line: number) => void;
  /** Reports the routine on screen (for exporting exactly what you see). */
  onRoutineChange?: (routineId: string) => void;
}

function Canvas({ source, settings, activeLine, visitedLines, routineName, onPickLine, onRoutineChange }: FlowDiagramProps) {
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
    ? routines.find((r) => r.name.toLowerCase() === routineName.toLowerCase())
    : undefined;
  const routine = playingRoutine ?? routines.find((r) => r.id === pickedRoutine) ?? routines[0];
  const hasRun = visitedLines.size > 0;
  useEffect(() => {
    if (routine) onRoutineChange?.(routine.id);
  }, [onRoutineChange, routine]);

  const nodes = useMemo<FlowNodeView[]>(() => {
    if (!routine) return [];
    return routine.nodes.map((node) => {
      const line = node.sourceSpan?.start.line;
      const visitLine = node.visitLine ?? node.traceLine;
      const state: FlowNodeViewData["state"] =
        node.traceLine !== undefined && node.traceLine === activeLine
          ? "active"
          : visitLine !== undefined && visitedLines.has(visitLine)
            ? "visited"
            : hasRun && node.kind !== "terminator" && node.kind !== "junction"
              ? "dim"
              : "idle";
      return {
        id: node.id,
        type: "flow",
        position: node.position,
        draggable: false,
        style: { width: node.size.width, height: node.size.height },
        data: { node, state, line },
      };
    });
  }, [activeLine, hasRun, routine, visitedLines]);

  const edges = useMemo<RoutedEdgeView[]>(() => {
    if (!routine) return [];
    return routine.edges.map((edge) => {
      const color = DARK_EDGE_COLORS[edge.kind];
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        label: edge.label,
        type: "routed",
        animated: edge.kind === "loop",
        data: { points: edge.points, labelPosition: edge.labelPosition },
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
        style: { stroke: color, strokeWidth: edge.kind === "loop" ? 1.8 : 1.5 },
      };
    });
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
        edgeTypes={edgeTypes}
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

export default function FlowDiagram(props: FlowDiagramProps) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
