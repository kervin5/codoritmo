"use client";

// The run as a timeline instead of an empty/full bar. Every recorded step is
// a thin slice tinted like its block in the flowchart (input, output,
// decision, loop, plain step), so loops show up as a rhythm and the moments
// your program asked you something get a marker. The part you rewound past is
// dimmer. A native range input sits on top, invisible, so dragging, keys and
// screen readers keep working exactly as before.

import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { spring } from "@/src/lib/motion";
import type { Frame } from "./use-player";

type StepKind = "input" | "output" | "decision" | "loop" | "step";

// Muted versions of the flowchart strokes (src/diagram/theme.ts): present, never loud.
const COLOR: Record<StepKind, string> = {
  input: "rgba(90, 143, 196, 0.85)",
  output: "rgba(79, 163, 168, 0.85)",
  decision: "rgba(196, 154, 78, 0.85)",
  loop: "rgba(93, 187, 143, 0.85)",
  step: "rgba(255, 255, 255, 0.2)",
};
// When a slice covers several steps, show the most telling one.
const PRIORITY: StepKind[] = ["input", "output", "decision", "loop", "step"];

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function kindOf(line: string | undefined): StepKind {
  const text = normalize(line ?? "").trim();
  const word = text.split(/[\s(]/)[0];
  if (word === "leer") return "input";
  if (word === "escribir" || word === "mostrar" || word === "imprimir" || word === "informar") return "output";
  if (word === "si" || word === "sino" || word === "segun" || /^de\s+otro\s+modo/.test(text) || /^[^"']*:/.test(text)) return "decision";
  if (word === "mientras" || word === "para" || word === "repetir" || word === "hasta" || word === "finpara" || word === "finmientras") return "loop";
  return "step";
}

export function RunTimeline({
  frames,
  frameCount,
  viewIndex,
  sourceLines,
  label,
  stepLabel,
  disabled,
  onSeek,
}: {
  frames: Frame[];
  frameCount: number;
  viewIndex: number;
  sourceLines: string[];
  /** Accessible name of the slider. */
  label: string;
  /** Hover readout, e.g. "Paso {step}, línea {line}". */
  stepLabel: (step: number, line: number) => string;
  disabled: boolean;
  onSeek: (index: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<{ index: number; x: number } | null>(null);

  useEffect(() => {
    const el = trackRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The player grows one frames array in place, so frameCount is what signals new steps.
  const kinds = useMemo(
    () => frames.slice(0, frameCount).map((f) => kindOf(sourceLines[f.line - 1])),
    [frames, frameCount, sourceLines]
  );

  // One slice per step, or per group of steps when there isn't room (≥ 3px each).
  const slices = useMemo(() => {
    const count = Math.max(0, Math.min(frameCount, kinds.length));
    if (!count) return [];
    const columns = Math.max(1, Math.min(count, Math.floor((width || 300) / 3)));
    const per = count / columns;
    return Array.from({ length: columns }, (_, column) => {
      const from = Math.floor(column * per);
      const to = Math.max(from + 1, Math.floor((column + 1) * per));
      let best: StepKind = "step";
      for (let i = from; i < to; i++) if (PRIORITY.indexOf(kinds[i]) < PRIORITY.indexOf(best)) best = kinds[i];
      return { from, to, kind: best };
    });
  }, [frameCount, kinds, width]);

  // Where the program stopped to ask you something: worth a marker of its own.
  const inputs = useMemo(() => {
    const marks: number[] = [];
    kinds.forEach((kind, index) => {
      if (kind === "input" && index < frameCount) marks.push(index);
    });
    return marks.length > 40 ? [] : marks;
  }, [frameCount, kinds]);

  const position = (index: number) => (frameCount > 1 ? (index / (frameCount - 1)) * 100 : 0);
  const hoveredLine = hover ? frames[hover.index]?.line : undefined;

  return (
    <div
      className="relative h-7 min-w-[60px] flex-1"
      onMouseLeave={() => setHover(null)}
      onMouseMove={(event) => {
        const box = trackRef.current?.getBoundingClientRect();
        if (!box || frameCount < 2) return;
        const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
        setHover({ index: Math.round(ratio * (frameCount - 1)), x: ratio * box.width });
      }}
    >
      <input
        aria-label={label}
        className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
        disabled={disabled}
        max={Math.max(0, frameCount - 1)}
        min={0}
        onChange={(event) => onSeek(Number(event.target.value))}
        type="range"
        value={Math.max(0, viewIndex)}
      />
      <div
        ref={trackRef}
        className="absolute inset-x-0 top-1/2 flex h-[10px] -translate-y-1/2 gap-px overflow-hidden rounded-full bg-white/[0.07] peer-focus-visible:ring-2 peer-focus-visible:ring-white/60"
      >
        {slices.map((slice, index) => (
          <span
            key={index}
            className="h-full flex-1 transition-opacity duration-200"
            style={{ background: COLOR[slice.kind], opacity: slice.from > viewIndex ? 0.3 : 1 }}
          />
        ))}
      </div>
      {inputs.map((index) => (
        <span
          key={index}
          aria-hidden
          className="pointer-events-none absolute top-0 h-[5px] w-[5px] -translate-x-1/2 rounded-full bg-[#9CC4E4]"
          style={{ left: `${position(index)}%` }}
        />
      ))}
      {frameCount > 0 && (
        <motion.span
          aria-hidden
          animate={{ left: `${position(Math.max(0, viewIndex))}%` }}
          className="pointer-events-none absolute top-1/2 h-[22px] w-[4px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#F2F7F4] shadow-[0_0_0_3px_#1D2124]"
          initial={false}
          transition={spring.snappy}
        />
      )}
      {hover && hoveredLine && (
        <div
          className="pointer-events-none absolute bottom-[calc(100%+6px)] z-20 max-w-[260px] -translate-x-1/2 truncate rounded-[10px] bg-[#2B3134] px-2.5 py-1.5 text-[12px] text-white/80 shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
          style={{ left: Math.min(Math.max(hover.x, 60), width - 60) }}
        >
          <span className="text-white/50">{stepLabel(hover.index + 1, hoveredLine)}</span>
          <span className="ml-2 font-mono text-white/85">{(sourceLines[hoveredLine - 1] ?? "").trim()}</span>
        </div>
      )}
    </div>
  );
}
