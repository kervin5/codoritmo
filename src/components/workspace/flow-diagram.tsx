"use client";

// Live flowchart: dark, soft palette; the block that is running glows,
// visited blocks stay lit, the rest dim. Uses the shared model + layout from
// src/diagram; only the rendering is specific to the workspace.
//
// Motion (the signature moment: watching the program run):
// - a mint light travels the routed connectors from one block to the next,
//   back up the loop line on each iteration; the next block lights up as it arrives
// - a decision's chosen way out (Sí / No) pops and brightens as the light leaves on it
// - at the end of a run, Fin fills mint and sends out one ripple
// - a new chart draws itself in top to bottom; edits ease blocks to their new places

import {
  Background,
  BackgroundVariant,
  Handle,
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
import { animate, useReducedMotion } from "motion/react";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

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
  type PositionedFlowRoutineDiagram,
} from "@/src/diagram";
import { estimateEdgeLabelWidth, LABEL_FONT_FAMILY, LABEL_FONT_SIZE, LABEL_LINE_HEIGHT } from "@/src/diagram/label";
import { Parser, type EngineSettings } from "@/src/engine";
import { easeOut, prefersReducedMotion, stagger } from "@/src/lib/motion";

import { FlowLight, type FlowLightHandle, type FlowRipple } from "./motion/flow-light";
import styles from "./motion/flow-motion.module.css";
import { findRoute, MIN_TRAVEL_MS, travelDuration, travelPath } from "./motion/flow-path";

type NodeState = "active" | "visited" | "idle" | "dim" | "finished";
type FlowNodeViewData = {
  node: FlowNode;
  state: NodeState;
  line?: number;
  /** Increments when the light arrives: the block gives a small spring "catch". */
  arrival?: number;
  /** Seconds to wait before drawing in (first appearance only). */
  introDelay?: number;
};
type FlowNodeView = Node<FlowNodeViewData>;
type RoutedEdgeData = { points: Point[]; labelPosition?: Point; introDelay?: number };
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
  const { node, state, arrival } = data;
  const colors = darkPaletteForFlowNodeKind(node.kind);
  const lit = state === "active" || state === "finished";
  const active = state === "active";
  const { width, height } = node.size;
  const shape = shapeGeometry(SHAPE_FOR_KIND[node.kind], width, height);
  const stroke = lit ? DARK_ACTIVE_COLOR : colors.stroke;
  const tooltip = node.truncated || node.title !== node.label ? node.title : undefined;
  const reduced = useReducedMotion();
  const bodyRef = useRef<HTMLDivElement>(null);

  // Appear: staggered draw-in for a new chart, a quick fade for a block an edit added.
  const [introDelay] = useState(data.introDelay);
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    body.style.opacity = "0";
    const controls = introDelay !== undefined
      ? animate(body, reduced ? { opacity: [0, 1] } : { opacity: [0, 1], scale: [0.94, 1] }, { duration: 0.34, delay: introDelay, ease: easeOut })
      : animate(body, { opacity: [0, 1] }, { duration: 0.2, ease: easeOut });
    return () => controls.stop();
  }, [introDelay, reduced]);

  // The light arrives: a small spring "catch", 1 → 1.04 → 1.
  useEffect(() => {
    const body = bodyRef.current;
    if (!arrival || !body || reduced) return;
    const controls = animate(body, { scale: [1, 1.04, 1] }, { duration: 0.36, times: [0, 0.35, 1], ease: ["easeOut", [0.34, 1.4, 0.64, 1]] });
    return () => controls.stop();
  }, [arrival, reduced]);

  return (
    <div
      className="relative h-full w-full transition-opacity duration-300"
      style={{ opacity: state === "dim" ? 0.42 : 1 }}
      title={tooltip}
    >
      {HANDLES}
      <div ref={bodyRef} className="absolute inset-0">
        <svg className="absolute inset-0 overflow-visible" height={height} width={width}>
          {/* The glow: a blurred mint outline that eases in and out (opacity only). */}
          {node.kind !== "junction" && (
            <path
              d={shape.outline}
              fill="none"
              stroke={DARK_ACTIVE_COLOR}
              strokeWidth={5}
              style={{
                filter: "blur(6px)",
                opacity: lit ? (state === "finished" ? 0.7 : 0.55) : 0,
                transition: `opacity ${lit ? 320 : 420}ms cubic-bezier(0.22, 1, 0.36, 1)`,
              }}
            />
          )}
          <path
            className={styles.shape}
            d={shape.outline}
            style={{
              fill: node.kind === "junction" ? stroke : state === "finished" ? "#1F3A30" : active ? DARK_ACTIVE_FILL : colors.fill,
              stroke,
              strokeWidth: node.kind === "junction" ? 0 : lit ? 2 : 1.4,
            }}
          />
          {shape.details && <path className={styles.shape} d={shape.details} fill="none" style={{ stroke }} strokeWidth={1.3} />}
          {(node.kind === "input" || node.kind === "output") && (
            <path
              className={styles.shape}
              d={ioMarkerPath(node.kind, width, height)}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              style={{ stroke }}
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
                    className={styles.token}
                    style={{
                      color: token.type === "identifier" && lit
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
    </div>
  );
});

/** Opts a path out of React Flow's marching dashes on animated (loop) edges. */
const SOLID = { strokeDasharray: "none", animation: "none" } as const;

/** Closed arrowhead at the end of a connector, drawn per edge so it can arrive with its line. */
function arrowHead(points: Point[], size = 9): string {
  const tip = points[points.length - 1];
  const from = points[points.length - 2] ?? tip;
  const length = Math.hypot(tip.x - from.x, tip.y - from.y) || 1;
  const ux = (tip.x - from.x) / length;
  const uy = (tip.y - from.y) / length;
  const bx = tip.x - ux * size;
  const by = tip.y - uy * size;
  const half = size * 0.5;
  const r = (n: number) => Math.round(n * 100) / 100;
  return `M ${r(tip.x)} ${r(tip.y)} L ${r(bx - uy * half)} ${r(by + ux * half)} L ${r(bx + uy * half)} ${r(by - ux * half)} Z`;
}

function RoutedEdge({ id, data, label, style }: EdgeProps<RoutedEdgeView>) {
  const pathRef = useRef<SVGPathElement>(null);
  const arrowRef = useRef<SVGPathElement>(null);
  const labelRef = useRef<SVGGElement>(null);
  const [introDelay] = useState(data?.introDelay);
  const reduced = useReducedMotion();

  // Draw in along the line (stroke-dashoffset) the first time the chart appears,
  // the arrowhead and label landing as the line reaches them; fade in otherwise.
  useLayoutEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const extras = [arrowRef.current, labelRef.current].filter((el): el is SVGPathElement | SVGGElement => el !== null);
    const all = [path, ...extras];
    if (introDelay === undefined || reduced || typeof path.getTotalLength !== "function" || typeof path.animate !== "function") {
      const controls = all.map((el) => animate(el, { opacity: [0, 1] }, { duration: 0.22, delay: introDelay ?? 0, ease: easeOut }));
      return () => controls.forEach((c) => c.stop());
    }
    const length = path.getTotalLength();
    const draw = Math.min(520, 200 + length * 1.4);
    const delay = introDelay * 1000 + 60;
    const animations = [
      path.animate(
        [
          { strokeDasharray: `${length} ${length}`, strokeDashoffset: length },
          { strokeDasharray: `${length} ${length}`, strokeDashoffset: 0 },
        ],
        { duration: draw, delay, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards" }
      ),
      ...extras.map((el) =>
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, delay: delay + draw * 0.55, easing: "ease-out", fill: "backwards" })
      ),
    ];
    return () => animations.forEach((a) => a.cancel());
  }, [introDelay, reduced]);

  if (!data) return null;
  const d = polylinePath(data.points);
  const stroke = String(style?.stroke ?? "#5A666C");
  const text = typeof label === "string" ? label : undefined;
  const labelWidth = text ? estimateEdgeLabelWidth(text) : 0;
  return (
    <>
      <path ref={pathRef} className={`react-flow__edge-path ${styles.edgePath}`} d={d} fill="none" id={id} style={style} />
      <path
        ref={arrowRef}
        className={styles.edgePath}
        d={arrowHead(data.points)}
        fill={stroke}
        stroke={stroke}
        strokeLinejoin="round"
        strokeWidth={1}
        style={SOLID}
      />
      {/* Brightens when the light leaves along this connector (see pulseEdge). */}
      <path
        d={d}
        data-flow-glow=""
        fill="none"
        stroke={DARK_ACTIVE_COLOR}
        strokeLinecap="round"
        strokeWidth={2.4}
        style={{ ...SOLID, opacity: 0 }}
      />
      {text && data.labelPosition && (
        <g ref={labelRef}>
          <g className={styles.edgeLabel} style={{ transform: `translate(${data.labelPosition.x}px, ${data.labelPosition.y}px)` }}>
            <g data-flow-label="" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
              <rect fill="#161B1E" height={18} rx={9} stroke={stroke} strokeOpacity={0.5} width={labelWidth} x={-labelWidth / 2} y={-9} />
              <text dominantBaseline="central" fill="#C3CCC8" fontSize={11} fontWeight={600} textAnchor="middle">
                {text}
              </text>
            </g>
          </g>
        </g>
      )}
    </>
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
  /**
   * Index of the step being shown (player.viewIndex). Lets the light run a
   * loop whose body is one block (the same line twice), and skip travelling
   * when scrubbing backwards. Optional.
   */
  step?: number;
  /** ms between steps while playing, or null when paused/stepping. Optional: measured otherwise. */
  stepMs?: number | null;
  /** The run reached the end. Optional: inferred from "no active line but visited lines". */
  finished?: boolean;
}

/**
 * React Flow ids that survive edits. The diagram's own ids include source
 * positions, so typing a line above a block would remount it; keying blocks
 * by kind + label (+ occurrence) lets them glide to their new place instead.
 */
function stableIds(routine: PositionedFlowRoutineDiagram) {
  const nodeIds = new Map<string, string>();
  const seen = new Map<string, number>();
  for (const node of routine.nodes) {
    const base = node.id.endsWith(":start") ? "start" : node.id.endsWith(":end") ? "end" : `${node.kind}|${node.label}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    nodeIds.set(node.id, `${base}#${count}`);
  }
  const edgeIds = new Map<string, string>();
  const seenEdges = new Map<string, number>();
  for (const edge of routine.edges) {
    const base = `${nodeIds.get(edge.source)}>${nodeIds.get(edge.target)}|${edge.sourceHandle}|${edge.targetHandle}`;
    const count = seenEdges.get(base) ?? 0;
    seenEdges.set(base, count + 1);
    edgeIds.set(edge.id, `${base}#${count}`);
  }
  return { nodeIds, edgeIds };
}

const INTRO_MS = 1400;

function Canvas({
  source,
  settings,
  activeLine,
  visitedLines,
  routineName,
  onPickLine,
  onRoutineChange,
  step,
  stepMs,
  finished,
}: FlowDiagramProps) {
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
  // Routine ids include source positions; the name is what stays put while editing.
  const routineKey = routine ? routine.name.toLowerCase() : null;
  useEffect(() => {
    if (routine) onRoutineChange?.(routine.id);
  }, [onRoutineChange, routine]);

  const ids = useMemo(() => (routine ? stableIds(routine) : null), [routine]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const lightRef = useRef<FlowLightHandle>(null);

  /* ---------- first appearance ---------- */
  const [introFor, setIntroFor] = useState<string | null>(null);
  const [introOn, setIntroOn] = useState(false);
  if (routineKey !== null && routineKey !== introFor) {
    setIntroFor(routineKey);
    setIntroOn(true);
  }
  useEffect(() => {
    if (!introOn) return;
    const timer = window.setTimeout(() => setIntroOn(false), INTRO_MS);
    return () => window.clearTimeout(timer);
  }, [introOn, introFor]);

  /* ---------- playback ---------- */
  const isFinished = finished ?? (activeLine === null && visitedLines.size > 0);
  /** While the light travels, the highlight waits: no block is active, visited stays as it was. */
  const [held, setHeld] = useState<Set<number> | null>(null);
  const [arrival, setArrival] = useState<{ nodeId: string; key: number } | null>(null);
  const [finishedShown, setFinishedShown] = useState(isFinished);
  const [ripple, setRipple] = useState<FlowRipple | null>(null);
  const lastRef = useRef<{
    line: number | null;
    step: number | undefined;
    routineKey: string | null;
    nodeId: string | null;
    time: number;
    visited: Set<number>;
    finished: boolean;
  }>({ line: activeLine, step, routineKey, nodeId: null, time: 0, visited: visitedLines, finished: isFinished });
  const counterRef = useRef(0);

  useLayoutEffect(() => {
    const last = lastRef.current;
    const now = performance.now();
    const lineChanged = activeLine !== last.line || (step !== undefined && last.step !== undefined && step !== last.step && activeLine !== null);
    const finishChanged = isFinished !== last.finished;
    const target = activeLine !== null ? routine?.nodes.find((n) => n.traceLine === activeLine) : undefined;
    const sameRoutine = routineKey === last.routineKey;
    const previousNode = sameRoutine ? last.nodeId : null;
    const interval = last.time ? now - last.time : Infinity;
    const visitedBefore = last.visited;

    lastRef.current = {
      line: activeLine,
      step,
      routineKey,
      nodeId: target?.id ?? (activeLine === null ? null : previousNode),
      time: lineChanged ? now : last.time,
      visited: visitedLines,
      finished: isFinished,
    };
    if (!routine || (!lineChanged && !finishChanged)) return;

    const light = lightRef.current;
    const nodeById = new Map(routine.nodes.map((n) => [n.id, n]));
    const centerOf = (id: string) => {
      const n = nodeById.get(id);
      return n ? { x: n.position.x + n.size.width / 2, y: n.position.y + n.size.height / 2 } : undefined;
    };
    const reduced = prefersReducedMotion();
    const budget = stepMs ?? (Number.isFinite(interval) ? interval : null);
    const tooFast = budget !== null && budget < MIN_TRAVEL_MS;
    const backwards = step !== undefined && last.step !== undefined && step < last.step;

    const arrive = (nodeId: string) => {
      counterRef.current += 1;
      setHeld(null);
      setArrival({ nodeId, key: counterRef.current });
    };
    const celebrate = () => {
      setFinishedShown(true);
      const end = routine.nodes.find((n) => n.id.endsWith(":end"));
      if (!end || reduced) return;
      counterRef.current += 1;
      setRipple({ key: counterRef.current, x: end.position.x, y: end.position.y, width: end.size.width, height: end.size.height });
    };

    /** Runs the light from one block to another; false when there is no way to show it. */
    const travel = (from: string | null, to: string, onArrive: () => void): boolean => {
      if (!light || reduced || tooFast || backwards || !from) return false;
      const route = findRoute(routine, from, to);
      if (!route) {
        const center = centerOf(to);
        if (center) light.blink(center);
        return false;
      }
      const path = travelPath(route, centerOf);
      light.travel(path, travelDuration(path.length, budget), {
        onPass: (index) => {
          const edge = route[index];
          if (edge.label && edge.kind === "branch") pulseEdge(wrapperRef.current, ids?.edgeIds.get(edge.id));
        },
        onArrive: (interrupted) => (interrupted ? setHeld(null) : onArrive()),
      });
      // After light.travel, which releases any trip it interrupted.
      setHeld(visitedBefore);
      return true;
    };

    if (finishChanged && !isFinished) {
      setFinishedShown(false);
      setRipple(null);
    }

    if (activeLine === null) {
      if (!(finishChanged && isFinished)) {
        light?.cancel();
        setHeld(null);
        return;
      }
      // The run ended: the light makes its last trip to Fin, which fills and ripples.
      const end = routine.nodes.find((n) => n.id.endsWith(":end"));
      const travelled = end && travel(previousNode, end.id, () => {
        arrive(end.id);
        celebrate();
      });
      if (!travelled) {
        light?.cancel();
        setHeld(null);
        celebrate();
      }
      return;
    }

    if (!target) return;
    // The very first step leaves from the start block.
    const from = previousNode ?? (last.line === null && sameRoutine ? routine.nodes.find((n) => n.id.endsWith(":start"))?.id ?? null : null);
    const travelled = travel(from, target.id, () => arrive(target.id));
    if (!travelled) {
      light?.cancel();
      setHeld(null);
      if (!tooFast && !reduced) arrive(target.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLine, step, isFinished, routineKey]);

  const shownActive = held ? null : activeLine;
  const shownVisited = held ?? visitedLines;
  const hasRun = shownVisited.size > 0;

  // Rank blocks top to bottom for the draw-in stagger.
  const introDelays = useMemo(() => {
    if (!routine || !introOn) return null;
    const order = [...routine.nodes].sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
    return new Map(order.map((n, index) => [n.id, stagger(index, 0.035, 0.45)]));
  }, [introOn, routine]);

  const nodes = useMemo<FlowNodeView[]>(() => {
    if (!routine || !ids) return [];
    return routine.nodes.map((node) => {
      const line = node.sourceSpan?.start.line;
      const visitLine = node.visitLine ?? node.traceLine;
      const state: NodeState =
        finishedShown && node.id.endsWith(":end")
          ? "finished"
          : node.traceLine !== undefined && node.traceLine === shownActive
            ? "active"
            : visitLine !== undefined && shownVisited.has(visitLine)
              ? "visited"
              : hasRun && node.kind !== "terminator" && node.kind !== "junction"
                ? "dim"
                : "idle";
      return {
        id: ids.nodeIds.get(node.id) ?? node.id,
        type: "flow",
        position: node.position,
        draggable: false,
        style: { width: node.size.width, height: node.size.height },
        data: {
          node,
          state,
          line,
          arrival: arrival?.nodeId === node.id ? arrival.key : undefined,
          introDelay: introDelays?.get(node.id),
        },
      };
    });
  }, [arrival, finishedShown, hasRun, ids, introDelays, routine, shownActive, shownVisited]);

  const edges = useMemo<RoutedEdgeView[]>(() => {
    if (!routine || !ids) return [];
    return routine.edges.map((edge) => {
      const color = DARK_EDGE_COLORS[edge.kind];
      return {
        id: ids.edgeIds.get(edge.id) ?? edge.id,
        source: ids.nodeIds.get(edge.source) ?? edge.source,
        target: ids.nodeIds.get(edge.target) ?? edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        label: edge.label,
        type: "routed",
        data: { points: edge.points, labelPosition: edge.labelPosition, introDelay: introDelays?.get(edge.source) },
        // Loops stay dashed (static: the travelling light is the only thing that moves).
        style: { stroke: color, strokeWidth: edge.kind === "loop" ? 1.8 : 1.5, strokeDasharray: edge.kind === "loop" ? "5 4" : undefined },
      };
    });
  }, [ids, introDelays, routine]);

  // Open at a readable zoom: fit the width (never below 55%), anchored at the top.
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
  }, [routineKey, nodes.length]);

  // Follow the running block (as soon as the step happens, so the light stays in view).
  useEffect(() => {
    if (activeLine === null || !routine) return;
    const node = routine.nodes.find((n) => n.traceLine === activeLine);
    if (!node) return;
    void flow.setCenter(node.position.x + node.size.width / 2, node.position.y + node.size.height / 2, {
      zoom: Math.max(flow.getZoom(), 0.75),
      duration: 350,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLine]);

  return (
    <div ref={wrapperRef} className={`relative h-full w-full ${styles.canvas}`}>
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
        <FlowLight handleRef={lightRef} ripple={ripple} />
      </ReactFlow>
    </div>
  );
}

/** A decision's chosen way out: its Sí/No label pops and the connector brightens as the light leaves on it. */
function pulseEdge(root: HTMLElement | null, edgeId: string | undefined) {
  if (!root || !edgeId) return;
  const edge = [...root.querySelectorAll<SVGGElement>(".react-flow__edge")].find((el) => el.dataset.id === edgeId);
  if (!edge) return;
  const glow = edge.querySelector<SVGPathElement>("[data-flow-glow]");
  const label = edge.querySelector<SVGGElement>("[data-flow-label]");
  glow?.animate?.([{ opacity: 0 }, { opacity: 0.85, offset: 0.2 }, { opacity: 0 }], { duration: 760, easing: "ease-out" });
  label?.animate?.(
    [{ transform: "scale(1)" }, { transform: "scale(1.28)", offset: 0.3 }, { transform: "scale(1)" }],
    { duration: 420, easing: "cubic-bezier(0.34, 1.4, 0.64, 1)" }
  );
  const rect = label?.querySelector("rect");
  rect?.animate?.([{ stroke: DARK_ACTIVE_COLOR, strokeOpacity: 1 }, { stroke: DARK_ACTIVE_COLOR, strokeOpacity: 1, offset: 0.5 }, {}], { duration: 700, easing: "ease-out" });
}

export default function FlowDiagram(props: FlowDiagramProps) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
