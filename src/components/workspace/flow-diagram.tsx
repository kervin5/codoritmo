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
//
// Editing (when not running): the chart is also an editor, like PSeInt's
// psdraw. Double-click / Enter edits a block's text, the "+" on a connector
// inserts a statement there, Delete removes a block. Every edit is a source
// transformation from src/diagram/edit.ts handed to onEdit, so it lands in
// the code editor's history (⌘Z works from here too, through onUndo/onRedo).

import {
  Background,
  BackgroundVariant,
  EdgeLabelRenderer,
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
import { animate, motion, useReducedMotion } from "motion/react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { createContext, memo, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import {
  applyIoShapes,
  buildFlowDiagram,
  DARK_ACTIVE_COLOR,
  DARK_ACTIVE_FILL,
  DARK_ACTIVE_TEXT,
  DARK_EDGE_COLORS,
  DARK_TOKEN_COLORS,
  darkPaletteForFlowNodeKind,
  describeNode,
  findNodeIdByRef,
  insertStatement,
  ioMarkerPath,
  layoutFlowDiagram,
  polylinePath,
  removeStatement,
  replaceStatementText,
  SHAPE_FOR_KIND,
  shapeGeometry,
  tokenColor,
  type FlowEditField,
  type FlowEditResult,
  type FlowFieldKey,
  type FlowInsertKind,
  type FlowNode,
  type FlowNodeEditRef,
  type IoShapeStyle,
  type Point,
  type PositionedFlowDiagram,
  type PositionedFlowRoutineDiagram,
} from "@/src/diagram";
import { estimateEdgeLabelWidth, LABEL_FONT_FAMILY, LABEL_FONT_SIZE, LABEL_LINE_HEIGHT } from "@/src/diagram/label";
import { Parser, type Diagnostic, type EngineSettings } from "@/src/engine";
import { formatMessage } from "@/src/i18n/format";
import { easeOut, prefersReducedMotion, spring, stagger } from "@/src/lib/motion";

import { FlowEditConfirmDelete, FlowEditEditor, focusSoon, type FlowEditCopy } from "./flow-edit-editor";
import { FlowEditPalette } from "./flow-edit-palette";
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
type RoutedEdgeData = {
  points: Point[];
  labelPosition?: Point;
  introDelay?: number;
  /** The diagram's own edge id (React Flow's is a stable alias). */
  modelId: string;
  /** Where the "+" sits, for connectors a block can be inserted on. */
  plus?: Point;
};

/** What blocks and connectors need to offer editing (one context, so memoised blocks stay cheap). */
interface FlowEditState {
  canEdit: boolean;
  copy: FlowEditCopy | null;
  selectedId: string | null;
  /** Gets the keyboard focus (roving tabindex): the selected block, else Inicio. */
  focusId: string | null;
  editing: { nodeId: string; fields: FlowEditField[]; error: string | null; errorField?: FlowFieldKey; key: number } | null;
  confirming: { nodeId: string; nested: number } | null;
  paletteEdge: string | null;
  /** Connectors whose "+" shows (hovered, below the selected block, or the only one). */
  plusEdges: Set<string>;
  select: (nodeId: string | null) => void;
  startEdit: (nodeId: string) => void;
  commit: (values: Partial<Record<FlowFieldKey, string>>) => void;
  cancel: () => void;
  requestDelete: (nodeId: string) => void;
  confirmDelete: (keepBody: boolean) => void;
  openPalette: (edgeId: string | null) => void;
  insert: (kind: FlowInsertKind) => void;
  hoverEdge: (edgeId: string | null) => void;
  onNodeKey: (event: ReactKeyboardEvent, nodeId: string) => void;
}

const FlowEditContext = createContext<FlowEditState | null>(null);
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
  const shape = shapeGeometry(node.shape ?? SHAPE_FOR_KIND[node.kind], width, height);
  const stroke = lit ? DARK_ACTIVE_COLOR : colors.stroke;
  const tooltip = node.truncated || node.title !== node.label ? node.title : undefined;
  const reduced = useReducedMotion();
  const bodyRef = useRef<HTMLDivElement>(null);
  const edit = useContext(FlowEditContext);
  const navigable = node.kind !== "junction";
  const selected = !!edit && edit.selectedId === node.id;
  const editing = selected && edit?.editing?.nodeId === node.id ? edit.editing : null;
  const confirming = selected && edit?.confirming?.nodeId === node.id ? edit.confirming : null;
  const showTools = selected && !!edit?.canEdit && !!node.edit && !editing && !confirming;

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
      aria-describedby={navigable && edit?.copy ? "flow-edit-hint" : undefined}
      aria-label={navigable && edit?.copy ? formatMessage(edit.copy.blockLabel, { label: node.title }) : undefined}
      className="relative h-full w-full outline-none transition-opacity duration-300"
      data-flow-node={navigable ? node.id : undefined}
      onFocus={(event) => {
        if (event.target === event.currentTarget && navigable && !selected) edit?.select(node.id);
      }}
      onKeyDown={navigable && edit ? (event) => edit.onNodeKey(event, node.id) : undefined}
      role={navigable && edit?.copy ? "button" : undefined}
      style={{ opacity: state === "dim" && !selected ? 0.42 : 1 }}
      tabIndex={navigable && edit ? (edit.focusId === node.id ? 0 : -1) : undefined}
      title={editing || confirming ? undefined : tooltip}
    >
      {HANDLES}
      <div ref={bodyRef} className="absolute inset-0">
        <svg className="absolute inset-0 overflow-visible" height={height} width={width}>
          {/* Selected (for editing): a quiet light halo, never mint (mint means running). */}
          {navigable && (
            <path
              d={shape.outline}
              fill="none"
              stroke="#E4EAE7"
              strokeWidth={node.kind === "junction" ? 0 : 5}
              style={{ opacity: selected ? 0.22 : 0, transition: "opacity 160ms ease-out" }}
            />
          )}
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
      {showTools && edit?.copy && (
        <div className="nodrag nopan absolute -top-[30px] right-0 flex gap-1" onDoubleClick={(event) => event.stopPropagation()}>
          <ToolButton icon={Pencil} label={edit.copy.edit} onClick={() => edit.startEdit(node.id)} />
          {node.edit?.part !== "routine" && <ToolButton icon={Trash2} label={edit.copy.delete} onClick={() => edit.requestDelete(node.id)} />}
        </div>
      )}
      {editing && edit?.copy && (
        <div className="absolute top-full left-1/2 z-10 mt-2 -translate-x-1/2">
          <FlowEditEditor
            key={editing.key}
            copy={edit.copy}
            error={editing.error}
            errorField={editing.errorField}
            fields={editing.fields}
            onCancel={edit.cancel}
            onCommit={edit.commit}
          />
        </div>
      )}
      {confirming && edit?.copy && (
        <div className="absolute top-full left-1/2 z-10 mt-2 -translate-x-1/2">
          <FlowEditConfirmDelete copy={edit.copy} nested={confirming.nested} onCancel={edit.cancel} onDelete={edit.confirmDelete} />
        </div>
      )}
    </div>
  );
});

function ToolButton({ icon: Icon, label, onClick }: { icon: typeof Pencil; label: string; onClick: () => void }) {
  return (
    <button
      aria-label={label}
      className="grid size-[24px] place-items-center rounded-full bg-[#232A2D] text-[#C9D3CF] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] hover:bg-[#2C3437] hover:text-white focus-visible:outline-2 focus-visible:outline-[#86F0C4]/60"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      onPointerDown={(event) => event.stopPropagation()}
      tabIndex={-1}
      title={label}
      type="button"
    >
      <Icon size={13} strokeWidth={2} />
    </button>
  );
}

/** Where a connector's "+" goes: the middle of its run into the next block (or out of the last one). */
function plusPoint(points: Point[], intoTarget: boolean): Point | undefined {
  if (points.length < 2) return undefined;
  const segments = points.slice(1).map((to, index) => ({ from: points[index], to }));
  const ordered = intoTarget ? [...segments].reverse() : segments;
  const segment = ordered.find((s) => Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y) >= 24) ?? ordered[0];
  return { x: (segment.from.x + segment.to.x) / 2, y: (segment.from.y + segment.to.y) / 2 };
}

function EdgePlus({ edgeId, at }: { edgeId: string; at: Point }) {
  const edit = useContext(FlowEditContext);
  if (!edit?.canEdit || !edit.copy) return null;
  const open = edit.paletteEdge === edgeId;
  const shown = open || edit.plusEdges.has(edgeId);
  return (
    <EdgeLabelRenderer>
      <div
        className="nodrag nopan absolute"
        onMouseEnter={() => edit.hoverEdge(edgeId)}
        onMouseLeave={() => edit.hoverEdge(null)}
        style={{ transform: `translate(-50%, -50%) translate(${at.x}px, ${at.y}px)`, pointerEvents: "all", zIndex: open ? 1001 : 5 }}
      >
        <button
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={edit.copy.insertHere}
          className={`grid size-[20px] place-items-center rounded-full transition-[opacity,transform,background-color] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#86F0C4] ${
            open ? "bg-[#86F0C4] text-[#0D1A14]" : "bg-[#2A3337] text-[#DCE4E0] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] hover:bg-[#86F0C4] hover:text-[#0D1A14]"
          }`}
          data-flow-plus={edgeId}
          onClick={(event) => {
            event.stopPropagation();
            edit.openPalette(open ? null : edgeId);
          }}
          style={{ opacity: shown ? 1 : 0, transform: `scale(${shown ? 1 : 0.6}) rotate(${open ? 45 : 0}deg)` }}
          tabIndex={shown ? 0 : -1}
          title={edit.copy.insertHere}
          type="button"
        >
          <Plus size={13} strokeWidth={2.4} />
        </button>
        {open && (
          <div className="absolute top-[26px] left-1/2 -translate-x-1/2">
            <FlowEditPalette copy={edit.copy} onClose={() => edit.openPalette(null)} onPick={edit.insert} />
          </div>
        )}
      </div>
    </EdgeLabelRenderer>
  );
}

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
      {data.plus && <EdgePlus at={data.plus} edgeId={data.modelId} />}
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
  /** PSeInt's classic or alternative Leer / Escribir symbols. */
  ioShapes?: IoShapeStyle;
  /** Editing from the diagram is allowed (not while a program runs or is being replayed). */
  editable?: boolean;
  /** Applies an edited source (as one undoable change). Without it the diagram is view-only. */
  onEdit?: (source: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  /** Strings for editing (dictionary.flowEdit). */
  editCopy?: FlowEditCopy;
  /** Puts an engine diagnostic into words, for a refused edit. */
  describeError?: (diagnostic: Diagnostic) => string;
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
  ioShapes,
  editable = true,
  onEdit,
  onUndo,
  onRedo,
  editCopy,
  describeError,
}: FlowDiagramProps) {
  const [diagram, setDiagram] = useState<PositionedFlowDiagram | null>(null);
  /** The source the diagram on screen was built from (edits only apply to what is shown). */
  const [diagramSource, setDiagramSource] = useState<string | null>(null);
  const [pickedRoutine, setPickedRoutine] = useState<string | null>(null);
  const flow = useReactFlow();

  useEffect(() => {
    const parsed = new Parser(source, { settings }).parse();
    if (!parsed.program) return;
    let cancelled = false;
    void layoutFlowDiagram(applyIoShapes(buildFlowDiagram(parsed.program), ioShapes)).then((result) => {
      if (cancelled) return;
      setDiagram(result);
      setDiagramSource(source);
    });
    return () => {
      cancelled = true;
    };
  }, [ioShapes, settings, source]);

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

  /* ---------- editing ---------- */
  const canEdit = editable && !!onEdit && !!editCopy && activeLine === null && diagramSource === source;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<FlowEditState["editing"]>(null);
  const [confirming, setConfirming] = useState<FlowEditState["confirming"]>(null);
  const [paletteEdge, setPaletteEdge] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ text: string; key: number; info?: boolean } | null>(null);
  /** After an edit: the block to select (and maybe edit) once the new chart is on screen. */
  const [pending, setPending] = useState<{ ref: FlowNodeEditRef; open: boolean; source: string } | null>(null);
  const hoverTimer = useRef<number | null>(null);
  const editKey = useRef(0);

  const nodeById = useMemo(() => new Map(routine?.nodes.map((n) => [n.id, n]) ?? []), [routine]);
  const selected = selectedId && nodeById.has(selectedId) ? selectedId : null;
  const startId = routine?.nodes.find((n) => n.id.endsWith(":start"))?.id ?? null;

  const say = useCallback((text: string, info = false) => {
    counterRef.current += 1;
    setFlash({ text, key: counterRef.current, info });
  }, []);
  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 2800);
    return () => window.clearTimeout(timer);
  }, [flash]);

  const errorText = useCallback(
    (result: Extract<FlowEditResult, { ok: false }>) => {
      if (!editCopy) return "";
      const detail = result.diagnostic ? (describeError?.(result.diagnostic) ?? result.diagnostic.message) : "";
      return formatMessage(editCopy.errors[result.error], { message: detail });
    },
    [describeError, editCopy]
  );

  const focusNode = useCallback((nodeId: string) => {
    focusSoon(() => wrapperRef.current?.querySelector<HTMLElement>(`[data-flow-node="${CSS.escape(nodeId)}"]`));
  }, []);

  /** Pans just enough to bring a rectangle (in chart coordinates) into view. */
  const ensureVisible = useCallback(
    (rect: { x: number; y: number; width: number; height: number }) => {
      const box = wrapperRef.current?.getBoundingClientRect();
      if (!box) return;
      const { x, y, zoom } = flow.getViewport();
      const margin = 24;
      const left = rect.x * zoom + x;
      const top = rect.y * zoom + y;
      const right = left + rect.width * zoom;
      const bottom = top + rect.height * zoom;
      let dx = 0;
      let dy = 0;
      if (right > box.width - margin) dx = box.width - margin - right;
      if (left + dx < margin) dx = margin - left;
      if (bottom > box.height - margin) dy = box.height - margin - bottom;
      if (top + dy < margin) dy = margin - top;
      if (dx || dy) void flow.setViewport({ x: x + dx, y: y + dy, zoom }, { duration: 260 });
    },
    [flow]
  );

  /** A block, with room for its editor below it when it is open. */
  const reveal = useCallback(
    (nodeId: string, withEditor: boolean) => {
      const node = nodeById.get(nodeId);
      if (!node) return;
      const cx = node.position.x + node.size.width / 2;
      const width = Math.max(node.size.width, withEditor ? 290 : 0);
      ensureVisible({ x: cx - width / 2, y: node.position.y - 32, width, height: node.size.height + 32 + (withEditor ? 190 : 0) });
    },
    [ensureVisible, nodeById]
  );

  const apply = useCallback(
    (result: FlowEditResult, open: boolean) => {
      if (!result.ok) return false;
      if (result.source !== source) onEdit?.(result.source);
      if (result.select) setPending({ ref: result.select, open, source: result.source });
      return true;
    },
    [onEdit, source]
  );

  const startEdit = useCallback(
    (nodeId: string) => {
      if (!canEdit) {
        if (editCopy && activeLine !== null) say(editCopy.runningHint, true);
        return;
      }
      const description = describeNode(source, settings, nodeId);
      if (!description || description.fields.length === 0) return;
      setSelectedId(nodeId);
      setConfirming(null);
      setPaletteEdge(null);
      editKey.current += 1;
      setEditing({ nodeId, fields: description.fields, error: null, key: editKey.current });
    },
    [activeLine, canEdit, editCopy, say, settings, source]
  );

  const closeOverlays = useCallback((refocus: boolean) => {
    const target = editing?.nodeId ?? confirming?.nodeId ?? null;
    setEditing(null);
    setConfirming(null);
    setPaletteEdge(null);
    if (refocus && target) focusNode(target);
  }, [confirming, editing, focusNode]);

  const commit = useCallback(
    (values: Partial<Record<FlowFieldKey, string>>) => {
      if (!editing) return;
      const result = replaceStatementText(source, settings, editing.nodeId, values);
      if (!result.ok) {
        setEditing({ ...editing, error: errorText(result), errorField: result.field });
        return;
      }
      apply(result, false);
      setEditing(null);
      if (result.source === source) focusNode(editing.nodeId);
    },
    [apply, editing, errorText, focusNode, settings, source]
  );

  const remove = useCallback(
    (nodeId: string, keepBody: boolean) => {
      const result = removeStatement(source, settings, nodeId, { keepBody });
      setConfirming(null);
      if (!result.ok) return say(errorText(result));
      setSelectedId(null);
      apply(result, false);
      if (!result.select) focusNode(startId ?? nodeId);
    },
    [apply, errorText, focusNode, say, settings, source, startId]
  );

  const requestDelete = useCallback(
    (nodeId: string) => {
      if (!canEdit || !editCopy) return;
      const description = describeNode(source, settings, nodeId);
      if (!description) return;
      if (!description.deletable) return say(editCopy.errors["not-deletable"]);
      setEditing(null);
      setPaletteEdge(null);
      if (description.nested > 0) setConfirming({ nodeId, nested: description.nested });
      else remove(nodeId, false);
    },
    [canEdit, editCopy, remove, say, settings, source]
  );

  const insert = useCallback(
    (kind: FlowInsertKind) => {
      if (!paletteEdge) return;
      const result = insertStatement(source, settings, paletteEdge, kind);
      setPaletteEdge(null);
      if (!result.ok) return say(errorText(result));
      apply(result, true);
    },
    [apply, errorText, paletteEdge, say, settings, source]
  );

  // The new chart is on screen: select (and maybe open) the block the edit pointed at.
  useEffect(() => {
    if (!pending || !diagram || diagramSource !== pending.source) return;
    const found = findNodeIdByRef(diagram.routines, pending.ref);
    setPending(null);
    if (!found) return;
    if (!routineName) setPickedRoutine(found.routineId);
    setSelectedId(found.nodeId);
    if (pending.open) {
      const description = describeNode(pending.source, settings, found.nodeId);
      if (description?.fields.length) {
        editKey.current += 1;
        setEditing({ nodeId: found.nodeId, fields: description.fields, error: null, key: editKey.current });
      }
    } else {
      focusNode(found.nodeId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagram, diagramSource, pending]);

  // A new or moved block may be off screen: bring the selection (and its editor) into view.
  useEffect(() => {
    if (selected) reveal(selected, editing?.nodeId === selected || confirming?.nodeId === selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, routine, editing?.nodeId, confirming?.nodeId]);

  // The palette opens below its "+": make room for it.
  useEffect(() => {
    if (!paletteEdge || !routine) return;
    const edge = routine.edges.find((e) => e.id === paletteEdge);
    const at = edge?.slot ? plusPoint(edge.points, edge.slot.index === 0 && edge.kind !== "loop") : undefined;
    if (at) ensureVisible({ x: at.x - 124, y: at.y - 14, width: 248, height: 250 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paletteEdge]);

  // Running (or replaying) closes any editor.
  const [wasEditable, setWasEditable] = useState(canEdit);
  if (wasEditable !== canEdit) {
    setWasEditable(canEdit);
    if (!canEdit) {
      setEditing(null);
      setConfirming(null);
      setPaletteEdge(null);
    }
  }

  /** The connector right below a block: where "insert after it" goes (Fin: the one into it). */
  const afterEdge = useCallback(
    (nodeId: string): string | null => {
      if (!routine) return null;
      const withSlot = routine.edges.filter((e) => e.slot);
      const fromJunction = withSlot.find((e) => e.source === `${nodeId}:merge` || e.source === `${nodeId}:exit`);
      if (fromJunction) return fromJunction.id;
      const node = nodeById.get(nodeId);
      const own = withSlot.filter((e) => e.source === nodeId);
      const out = node?.kind === "decision" && node.edit?.part === "statement" ? own.find((e) => e.kind !== "branch") : own[0];
      return out?.id ?? own[0]?.id ?? withSlot.find((e) => e.target === nodeId)?.id ?? null;
    },
    [nodeById, routine]
  );

  /** Arrow keys: the nearest block in that direction (the flow runs down; branches sit side by side). */
  const neighbour = useCallback(
    (nodeId: string, key: string): string | null => {
      const from = nodeById.get(nodeId);
      if (!routine || !from) return null;
      const cx = from.position.x + from.size.width / 2;
      const cy = from.position.y + from.size.height / 2;
      let best: { id: string; score: number } | null = null;
      for (const n of routine.nodes) {
        if (n.id === nodeId || n.kind === "junction") continue;
        const dx = n.position.x + n.size.width / 2 - cx;
        const dy = n.position.y + n.size.height / 2 - cy;
        const along = key === "ArrowDown" ? dy : key === "ArrowUp" ? -dy : key === "ArrowRight" ? dx : -dx;
        const across = key === "ArrowDown" || key === "ArrowUp" ? Math.abs(dx) : Math.abs(dy);
        if (along <= 4) continue;
        const score = along + across * 2.5;
        if (!best || score < best.score) best = { id: n.id, score };
      }
      return best?.id ?? null;
    },
    [nodeById, routine]
  );

  const onNodeKey = useCallback(
    (event: ReactKeyboardEvent, nodeId: string) => {
      if (event.target !== event.currentTarget) return;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key;
      const handled = () => {
        event.preventDefault();
        event.stopPropagation();
      };
      if (key.startsWith("Arrow")) {
        const next = neighbour(nodeId, key);
        handled();
        if (next) {
          setSelectedId(next);
          focusNode(next);
        }
      } else if (key === "Enter" || key === "F2") {
        handled();
        startEdit(nodeId);
      } else if ((key === "Delete" || key === "Backspace") && !mod) {
        handled();
        requestDelete(nodeId);
      } else if ((key === "+" || key === "Insert") && canEdit) {
        handled();
        setEditing(null);
        setPaletteEdge(afterEdge(nodeId));
      } else if (key === "Escape") {
        handled();
        setSelectedId(null);
        (event.currentTarget as HTMLElement).blur();
      }
    },
    [afterEdge, canEdit, focusNode, neighbour, requestDelete, startEdit]
  );

  const hoverEdge = useCallback((edgeId: string | null) => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    if (edgeId) setHoveredEdge(edgeId);
    // Leaving waits a moment, so the pointer can travel from the line onto its "+".
    else hoverTimer.current = window.setTimeout(() => setHoveredEdge(null), 160);
  }, []);

  const plusEdges = useMemo(() => {
    const shown = new Set<string>();
    if (hoveredEdge) shown.add(hoveredEdge);
    if (selected) {
      const below = afterEdge(selected);
      if (below) shown.add(below);
    }
    // An empty routine: Inicio → Fin is the only place to start, so its "+" always shows.
    if (routine && routine.nodes.length === 2) routine.edges.forEach((e) => e.slot && shown.add(e.id));
    return shown;
  }, [afterEdge, hoveredEdge, routine, selected]);

  const editState = useMemo<FlowEditState>(
    () => ({
      canEdit,
      copy: editCopy ?? null,
      selectedId: selected,
      focusId: selected ?? startId,
      editing,
      confirming,
      paletteEdge,
      plusEdges,
      select: setSelectedId,
      startEdit,
      commit,
      cancel: () => closeOverlays(true),
      requestDelete,
      confirmDelete: (keepBody: boolean) => confirming && remove(confirming.nodeId, keepBody),
      openPalette: (edgeId: string | null) => {
        setEditing(null);
        setConfirming(null);
        setPaletteEdge(edgeId);
      },
      insert,
      hoverEdge,
      onNodeKey,
    }),
    [canEdit, closeOverlays, commit, confirming, editCopy, editing, hoverEdge, insert, onNodeKey, paletteEdge, plusEdges, remove, requestDelete, selected, startEdit, startId]
  );

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
      const raised = node.id === selected || node.id === editing?.nodeId;
      return {
        id: ids.nodeIds.get(node.id) ?? node.id,
        type: "flow",
        position: node.position,
        draggable: false,
        zIndex: raised ? 1000 : undefined,
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
  }, [arrival, editing?.nodeId, finishedShown, hasRun, ids, introDelays, routine, selected, shownActive, shownVisited]);

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
        data: {
          points: edge.points,
          labelPosition: edge.labelPosition,
          introDelay: introDelays?.get(edge.source),
          modelId: edge.id,
          plus: edge.slot ? plusPoint(edge.points, edge.slot.index === 0 && edge.kind !== "loop") : undefined,
        },
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
    <FlowEditContext.Provider value={editState}>
    <div
      ref={wrapperRef}
      className={`relative h-full w-full ${styles.canvas}`}
      onKeyDown={(event) => {
        // ⌘Z / ⌘⇧Z from the diagram go to the code editor's history.
        const target = event.target as HTMLElement;
        if (!(event.metaKey || event.ctrlKey) || target.closest("input, textarea, .monaco-editor")) return;
        const key = event.key.toLowerCase();
        if (key === "z" || key === "y") {
          event.preventDefault();
          event.stopPropagation();
          setEditing(null);
          setConfirming(null);
          setPaletteEdge(null);
          if (key === "y" || event.shiftKey) onRedo?.();
          else onUndo?.();
        }
      }}
    >
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
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        disableKeyboardA11y
        deleteKeyCode={null}
        selectionKeyCode={null}
        multiSelectionKeyCode={null}
        zoomOnDoubleClick={false}
        onEdgeMouseEnter={(_event, edge) => edge.data?.plus && hoverEdge(edge.data.modelId)}
        onEdgeMouseLeave={() => hoverEdge(null)}
        onNodeClick={(_event, node) => {
          const id = node.data.node.id;
          if (node.data.node.kind !== "junction" && editCopy) {
            setSelectedId(id);
            setPaletteEdge(null);
          }
          if (node.data.line) onPickLine?.(node.data.line);
          // Picking the line focuses the code editor; keep the keyboard here.
          if (node.data.node.kind !== "junction" && editCopy) focusNode(id);
        }}
        onNodeDoubleClick={(_event, node) => node.data.node.edit && startEdit(node.data.node.id)}
        onPaneClick={() => {
          setSelectedId(null);
          closeOverlays(false);
        }}
        proOptions={{ hideAttribution: true }}
        style={{ background: "transparent" }}
      >
        <Background color="#22292D" gap={22} size={1.4} variant={BackgroundVariant.Dots} />
        <FlowLight handleRef={lightRef} ripple={ripple} />
      </ReactFlow>
      {editCopy && (
        <p className="sr-only" id="flow-edit-hint">
          {editCopy.keyboardHint}
        </p>
      )}
      {editCopy && canEdit && selected && !editing && !confirming && !paletteEdge && (
        <div className="pointer-events-none absolute top-3 right-3 z-10 max-w-[min(62%,420px)] truncate rounded-full bg-black/40 px-3 py-1 text-[11px] text-[#8E9A95] backdrop-blur">
          {editCopy.keyboardHint}
        </div>
      )}
      {flash && (
        <motion.div
          key={flash.key}
          animate={{ opacity: 1, y: 0 }}
          className={`pointer-events-none absolute bottom-16 left-1/2 z-20 max-w-[90%] -translate-x-1/2 rounded-[12px] px-3 py-2 text-[12px] shadow-[0_8px_24px_rgba(0,0,0,0.4)] ${
            flash.info
              ? "bg-[#222A2D] text-[#C9D3CF] shadow-[0_8px_24px_rgba(0,0,0,0.4),inset_0_0_0_1px_rgba(255,255,255,0.1)]"
              : "bg-[#2A2224] text-[#F4C4C4] shadow-[0_8px_24px_rgba(0,0,0,0.4),inset_0_0_0_1px_rgba(240,138,138,0.25)]"
          }`}
          initial={{ opacity: 0, y: 6 }}
          role="status"
          transition={spring.snappy}
        >
          {flash.text}
        </motion.div>
      )}
    </div>
    </FlowEditContext.Provider>
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
