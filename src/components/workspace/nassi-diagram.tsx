"use client";

// Live Nassi-Shneiderman diagram: the structured chart PSeInt offers next to
// the classic flowchart. Same model as the flowchart (src/diagram), laid out
// as nested boxes by src/diagram/nassi.ts; the same playback language: the
// box that is running glows mint, visited boxes stay lit, the rest dim, and
// clicking a box jumps to its line.

import { LocateFixed, Minus, Plus } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  buildFlowDiagram,
  buildNassiDiagram,
  DARK_ACTIVE_COLOR,
  DARK_ACTIVE_FILL,
  DARK_ACTIVE_TEXT,
  DARK_TOKEN_COLORS,
  darkPaletteForFlowNodeKind,
  tokenColor,
  type NassiCell,
  type NassiDiagram as NassiDiagramModel,
  type NassiRoutine,
} from "@/src/diagram";
import { EDGE_LABEL_FONT_SIZE, LABEL_FONT_FAMILY, LABEL_FONT_SIZE, LABEL_LINE_HEIGHT } from "@/src/diagram/label";
import { NASSI_DARK_EMPTY, NASSI_DARK_GRID, nassiFirstLineY } from "@/src/diagram/nassi-export";
import { Parser, type EngineSettings } from "@/src/engine";
import { easeOut, spring, stagger } from "@/src/lib/motion";

type CellState = "active" | "visited" | "idle" | "dim" | "finished";

export interface NassiDiagramProps {
  source: string;
  settings: EngineSettings;
  activeLine: number | null;
  visitedLines: Set<number>;
  /** Routine the run is in (it takes over the picker while playing). */
  routineName: string | null;
  onPickLine?: (line: number) => void;
  /** Reports the routine on screen (for exporting exactly what you see). */
  onRoutineChange?: (routineId: string) => void;
  /** Index of the step being shown; a box that runs twice in a row pulses again. */
  step?: number;
  /** The run reached the end. Optional: inferred from "no active line but visited lines". */
  finished?: boolean;
  /** Labels for the zoom controls. */
  zoomLabels?: { in: string; out: string; fit: string };
}

/** Room above the diagram for the routine picker. */
const TOP_GUTTER = 52;
const SIDE_GUTTER = 24;
const MIN_SCALE = 0.55;
/** How far the student can zoom with the wheel, pinch or buttons. */
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.5;
/** Pointer travel (px) before a press becomes a drag instead of a click on a box. */
const DRAG_THRESHOLD = 4;

interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
const FINISHED_FILL = "#1F3A30";
const TAG_COLOR = "#9AA6A1";

/**
 * Keys that survive edits: cell ids include source positions, so typing a line
 * above a box would remount it. Keyed by kind + text (+ occurrence) instead.
 */
function stableKeys(routine: NassiRoutine): string[] {
  const seen = new Map<string, number>();
  return routine.cells.map((cell) => {
    const text = cell.text?.lines.map((line) => line.map((t) => t.text).join("")).join(" ") ?? "";
    const base = cell.id.endsWith(":start") ? "start" : cell.id.endsWith(":end") ? "end" : `${cell.kind}|${text}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return `${base}#${count}`;
  });
}

function cellState(
  cell: NassiCell,
  activeLine: number | null,
  visitedLines: Set<number>,
  finished: boolean,
): CellState {
  if (cell.kind === "empty") return "idle";
  if (finished && cell.id.endsWith(":end")) return "finished";
  if (cell.traceLine !== undefined && cell.traceLine === activeLine) return "active";
  const visit = cell.visitLine ?? cell.traceLine;
  if (visit !== undefined && visitedLines.has(visit)) return "visited";
  if (visitedLines.size > 0 && cell.kind !== "terminator") return "dim";
  return "idle";
}

function CellView({
  cell,
  state,
  introDelay,
  hovered,
  onHover,
  onPick,
}: {
  cell: NassiCell;
  state: CellState;
  introDelay: number | undefined;
  hovered: boolean;
  onHover: (id: string | null) => void;
  onPick?: (line: number) => void;
}) {
  const palette = cell.tone ? darkPaletteForFlowNodeKind(cell.tone) : null;
  const lit = state === "active" || state === "finished";
  const fill = !palette
    ? NASSI_DARK_EMPTY
    : state === "finished"
      ? FINISHED_FILL
      : state === "active"
        ? DARK_ACTIVE_FILL
        : palette.fill;
  const clickable = cell.line !== undefined && !!onPick;
  const tooltip = cell.title && (cell.truncated || cell.kind !== "simple") ? cell.title : undefined;
  // First appearance: the boxes settle in top to bottom (opacity, plus a 4px drop when motion is allowed).
  const [initial] = useState(() => (introDelay === undefined ? false : { opacity: 0, y: -4 }));

  return (
    <motion.g
      animate={{ opacity: state === "dim" ? 0.42 : 1, y: 0 }}
      initial={initial}
      onClick={clickable ? () => onPick?.(cell.line!) : undefined}
      onPointerEnter={clickable ? () => onHover(cell.id) : undefined}
      onPointerLeave={clickable ? () => onHover(null) : undefined}
      style={{ cursor: clickable ? "pointer" : undefined }}
      transition={{ opacity: { duration: 0.3, delay: introDelay ?? 0, ease: easeOut }, y: { ...spring.smooth, delay: introDelay ?? 0 } }}
    >
      {tooltip && <title>{tooltip}</title>}
      <path
        d={cell.outline}
        style={{
          fill,
          stroke: NASSI_DARK_GRID,
          strokeWidth: 1.2,
          strokeLinejoin: "round",
          transition: "fill 320ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      />
      {cell.details && <path d={cell.details} fill="none" stroke={NASSI_DARK_GRID} strokeWidth={1.2} />}
      {hovered && !lit && <path d={cell.outline} fill="rgba(255,255,255,0.035)" stroke="rgba(255,255,255,0.28)" strokeWidth={1.2} />}
      {cell.text && palette && (
        <text
          dominantBaseline="central"
          style={{ fontFamily: LABEL_FONT_FAMILY, fontSize: LABEL_FONT_SIZE, whiteSpace: "pre" }}
          textAnchor={cell.text.anchor}
        >
          {cell.text.lines.map((line, index) => (
            <tspan key={index} x={cell.text!.x} y={nassiFirstLineY(cell.text!) + index * LABEL_LINE_HEIGHT}>
              {line.map((token, tokenIndex) => (
                <tspan
                  key={tokenIndex}
                  fill={token.type === "identifier" && lit ? DARK_ACTIVE_TEXT : tokenColor(token.type, palette, DARK_TOKEN_COLORS)}
                  fontWeight={token.type === "keyword" ? 600 : 400}
                  style={{ transition: "fill 320ms cubic-bezier(0.22, 1, 0.36, 1)" }}
                >
                  {token.text}
                </tspan>
              ))}
            </tspan>
          ))}
        </text>
      )}
      {cell.tags?.map((tag) => (
        <text
          key={tag.text}
          dominantBaseline="central"
          fill={TAG_COLOR}
          fontSize={EDGE_LABEL_FONT_SIZE}
          fontWeight={600}
          textAnchor={tag.anchor}
          x={tag.x}
          y={tag.y}
        >
          {tag.text}
        </text>
      ))}
    </motion.g>
  );
}

/** The mint outline of the running box, drawn above the grid so its edges are not covered by neighbours. */
function Highlight({ cell, finished, pulse }: { cell: NassiCell | undefined; finished: boolean; pulse: number }) {
  const reduced = useReducedMotion();
  if (!cell) return null;
  return (
    <g pointerEvents="none">
      <path d={cell.outline} fill="none" stroke={DARK_ACTIVE_COLOR} strokeWidth={5} style={{ filter: "blur(6px)", opacity: finished ? 0.7 : 0.55 }} />
      <motion.path
        // Remounts on every step, so a box that runs again catches the light again.
        key={pulse}
        animate={{ opacity: 1 }}
        d={cell.outline}
        fill="none"
        initial={{ opacity: reduced ? 1 : 0.2 }}
        stroke={DARK_ACTIVE_COLOR}
        strokeLinejoin="round"
        strokeWidth={2}
        transition={{ duration: 0.32, ease: easeOut }}
      />
    </g>
  );
}

export default function NassiDiagram({
  source,
  settings,
  activeLine,
  visitedLines,
  routineName,
  onPickLine,
  onRoutineChange,
  step,
  finished,
  zoomLabels = { in: "Acercar", out: "Alejar", fit: "Ajustar a la vista" },
}: NassiDiagramProps) {
  const [diagram, setDiagram] = useState<NassiDiagramModel | null>(null);
  const [pickedRoutine, setPickedRoutine] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  const [boxHeight, setBoxHeight] = useState(0);
  /** null until the student pans or zooms; until then the diagram fits the panel's width. */
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const drag = useRef<{ startX: number; startY: number; origin: Viewport; moved: boolean; pointer: number } | null>(null);
  const swallowClick = useRef(false);
  /** Glide for fit, buttons and following the run; follow the pointer exactly for drag and wheel. */
  const [smooth, setSmooth] = useState(false);
  const reduced = useReducedMotion();

  // Rebuild on every edit; a program that does not parse keeps the last good diagram.
  useEffect(() => {
    const parsed = new Parser(source, { settings }).parse();
    if (!parsed.program) return;
    setDiagram(buildNassiDiagram(buildFlowDiagram(parsed.program)));
  }, [settings, source]);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const measure = () => {
      setBoxWidth(element.clientWidth);
      setBoxHeight(element.clientHeight);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const routines = diagram?.routines ?? [];
  const playingRoutine = routineName
    ? routines.find((r) => r.name.toLowerCase() === routineName.toLowerCase())
    : undefined;
  const routine = playingRoutine ?? routines.find((r) => r.id === pickedRoutine) ?? routines[0];
  const routineKey = routine ? routine.name.toLowerCase() : null;
  useEffect(() => {
    if (routine) onRoutineChange?.(routine.id);
  }, [onRoutineChange, routine]);

  // Draw in top to bottom when a routine first appears (not on every edit).
  const [introFor, setIntroFor] = useState<string | null>(null);
  const introOn = routineKey !== null && routineKey !== introFor;
  useEffect(() => {
    if (introOn) setIntroFor(routineKey);
  }, [introOn, routineKey]);

  const keys = useMemo(() => (routine ? stableKeys(routine) : []), [routine]);
  const introDelays = useMemo(() => {
    if (!routine || !introOn) return null;
    const order = routine.cells
      .map((cell, index) => ({ cell, index }))
      .sort((a, b) => a.cell.y - b.cell.y || a.cell.x - b.cell.x);
    const delays = new Map<number, number>();
    order.forEach(({ index }, rank) => delays.set(index, stagger(rank, 0.03, 0.45)));
    return delays;
  }, [introOn, routine]);

  const isFinished = finished ?? (activeLine === null && visitedLines.size > 0);
  const states = useMemo(
    () => routine?.cells.map((cell) => cellState(cell, activeLine, visitedLines, isFinished)) ?? [],
    [activeLine, isFinished, routine, visitedLines],
  );
  const activeCell = routine?.cells.find((_, index) => states[index] === "active");
  const finishedCell = routine?.cells.find((_, index) => states[index] === "finished");

  // The fitted view: the whole width visible (never above 100%, never below MIN_SCALE), anchored at the top.
  const fitZoom = routine && boxWidth ? Math.min(1, Math.max(MIN_SCALE, (boxWidth - SIDE_GUTTER * 2) / routine.width)) : 1;
  const fitted: Viewport = {
    zoom: fitZoom,
    x: routine ? Math.max(SIDE_GUTTER, (boxWidth - routine.width * fitZoom) / 2) : SIDE_GUTTER,
    y: TOP_GUTTER,
  };
  const view = viewport ?? fitted;

  // A new routine (or switching routines) starts from the fitted view; edits keep the student's view.
  const [viewFor, setViewFor] = useState<string | null>(null);
  if (routineKey !== viewFor) {
    setViewFor(routineKey);
    if (viewport) setViewport(null);
  }

  const zoomAround = (factor: number, cx: number, cy: number) =>
    setViewport((current) => {
      const from = current ?? fitted;
      const zoom = clampZoom(from.zoom * factor);
      const ratio = zoom / from.zoom;
      return { zoom, x: cx - (cx - from.x) * ratio, y: cy - (cy - from.y) * ratio };
    });
  const zoomFromCenter = (factor: number) => {
    setSmooth(true);
    zoomAround(factor, boxWidth / 2, boxHeight / 2);
  };
  const fitView = () => {
    setSmooth(true);
    setViewport(null);
  };

  // Wheel and trackpad pinch zoom around the pointer, as in the flowchart. A native
  // listener, because React's onWheel is passive and can't stop the page from scrolling.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const box = element.getBoundingClientRect();
      // Pinch arrives as ctrl+wheel with small deltas; a mouse wheel as larger steps.
      const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0018));
      setSmooth(false);
      zoomAround(factor, event.clientX - box.left, event.clientY - box.top);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
    // zoomAround only reads state through the updater; re-binding on every render isn't needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routineKey, boxWidth]);

  // Follow the running box: pan it into view when it is off screen.
  useEffect(() => {
    if (!activeCell || !boxHeight) return;
    const top = view.y + activeCell.y * view.zoom;
    const bottom = top + activeCell.height * view.zoom;
    const left = view.x + activeCell.x * view.zoom;
    const right = left + activeCell.width * view.zoom;
    const fitsVertically = top >= 8 && Math.min(bottom, top + boxHeight * 0.6) <= boxHeight - 8;
    const fitsHorizontally = left >= 0 && right <= boxWidth;
    if (fitsVertically && fitsHorizontally) return;
    setSmooth(!reduced);
    setViewport({
      zoom: view.zoom,
      x: fitsHorizontally ? view.x : boxWidth / 2 - (activeCell.x + activeCell.width / 2) * view.zoom,
      y: fitsVertically ? view.y : boxHeight * 0.35 - activeCell.y * view.zoom,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCell?.id, step]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    drag.current = { startX: event.clientX, startY: event.clientY, origin: view, moved: false, pointer: event.pointerId };
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (!current.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      current.moved = true;
      setSmooth(false);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setViewport({ zoom: current.origin.zoom, x: current.origin.x + dx, y: current.origin.y + dy });
  };
  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.moved) swallowClick.current = true;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    drag.current = null;
  };

  const control =
    "grid h-[26px] min-w-[26px] place-items-center rounded-[6px] px-1 text-white/55 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-2 focus-visible:outline-[#86F0C4]";

  return (
    <div className="relative h-full w-full">
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
      <div
        ref={scrollRef}
        className={`h-full w-full touch-none overflow-hidden select-none ${drag.current?.moved ? "cursor-grabbing" : "cursor-grab"}`}
        data-testid="nassi-diagram"
        onClickCapture={(event) => {
          // A drag that ends over a box must not also count as a click on it.
          if (swallowClick.current) {
            swallowClick.current = false;
            event.stopPropagation();
          }
        }}
        onPointerCancel={onPointerUp}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          backgroundImage: "radial-gradient(circle, #22292D 1.4px, transparent 1.5px)",
          backgroundSize: `${22 * view.zoom}px ${22 * view.zoom}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
        }}
      >
        {routine && (
          <svg
            aria-label={routine.label}
            height="100%"
            role="img"
            style={{ display: "block", overflow: "visible" }}
            width="100%"
          >
            <g
              style={{
                transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
                transformOrigin: "0 0",
                transition: smooth && !reduced ? "transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)" : "none",
              }}
            >
              {routine.cells.map((cell, index) => (
                <CellView
                  key={keys[index]}
                  cell={cell}
                  hovered={hovered === cell.id}
                  introDelay={introDelays?.get(index)}
                  onHover={setHovered}
                  onPick={onPickLine}
                  state={states[index]}
                />
              ))}
              <rect fill="none" height={routine.height} pointerEvents="none" stroke="#56636A" strokeWidth={1.6} width={routine.width} />
              <Highlight cell={activeCell ?? finishedCell} finished={!activeCell && !!finishedCell} pulse={step ?? 0} />
            </g>
          </svg>
        )}
      </div>
      {routine && (
        <div className="absolute right-3 bottom-3 z-10 flex items-center gap-px rounded-[8px] bg-black/30 p-[2px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur">
          <button aria-label={zoomLabels.out} className={control} onClick={() => zoomFromCenter(1 / 1.2)} title={zoomLabels.out} type="button">
            <Minus size={13} />
          </button>
          <button
            aria-label={zoomLabels.fit}
            className={`${control} text-[11px] tabular-nums`}
            onClick={fitView}
            title={zoomLabels.fit}
            type="button"
          >
            {Math.round(view.zoom * 100)}%
          </button>
          <button aria-label={zoomLabels.in} className={control} onClick={() => zoomFromCenter(1.2)} title={zoomLabels.in} type="button">
            <Plus size={13} />
          </button>
          <button aria-label={zoomLabels.fit} className={control} onClick={fitView} title={zoomLabels.fit} type="button">
            <LocateFixed size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

export interface DiagramKindToggleProps {
  value: "flowchart" | "nassi";
  onChange: (value: "flowchart" | "nassi") => void;
  labels: { group: string; flowchart: string; nassi: string; altShapes: string; altShapesHint: string };
  /** Leer / Escribir drawn with PSeInt's alternative symbols (flowchart only). */
  altShapes: boolean;
  onAltShapesChange: (on: boolean) => void;
}

/** The Diagrama panel's switch between the classic flowchart and Nassi-Shneiderman. */
export function DiagramKindToggle({ value, onChange, labels, altShapes, onAltShapesChange }: DiagramKindToggleProps) {
  return (
    <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 whitespace-nowrap">
      {value === "flowchart" && (
        <motion.button
          aria-label={labels.altShapesHint}
          aria-pressed={altShapes}
          className={`flex h-[26px] items-center gap-1.5 rounded-[7px] bg-black/30 px-2 text-[11.5px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur transition-colors ${
            altShapes ? "text-white" : "text-white/45 hover:text-white/85"
          }`}
          onClick={() => onAltShapesChange(!altShapes)}
          title={labels.altShapesHint}
          type="button"
          whileTap={{ scale: 0.95 }}
        >
          <svg aria-hidden height={12} viewBox="0 0 22 12" width={22}>
            <path d="M1 4 L9 1 L9 11 L1 11 Z" fill="none" stroke="currentColor" strokeWidth={1.3} />
            <path d="M13 6 L15.5 1 L18 1 A3 5 0 0 1 18 11 L15.5 11 Z" fill="none" stroke="currentColor" strokeWidth={1.3} />
          </svg>
          <span>{labels.altShapes}</span>
        </motion.button>
      )}
      <div
        aria-label={labels.group}
        className="flex rounded-[7px] bg-black/30 p-[2px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur"
        role="radiogroup"
      >
        {(
          [
            ["flowchart", labels.flowchart],
            ["nassi", labels.nassi],
          ] as const
        ).map(([kind, label]) => {
          const on = value === kind;
          return (
            <motion.button
              key={kind}
              aria-checked={on}
              className={`relative flex h-[22px] items-center rounded-[5px] px-2 text-[11.5px] transition-colors ${
                on ? "text-white" : "text-white/45 hover:text-white/85"
              }`}
              onClick={() => onChange(kind)}
              role="radio"
              type="button"
              whileTap={{ scale: 0.95 }}
            >
              {on && (
                <motion.span
                  className="absolute inset-0 rounded-[5px] bg-white/[0.12] shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
                  layoutId="diagram-kind-thumb"
                  transition={spring.snappy}
                />
              )}
              <span className="relative">{label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
