"use client";

// The "+" on a flowchart connector and the small palette it opens: every
// statement the diagram can insert, each with its flowchart symbol.

import { motion } from "motion/react";
import { useLayoutEffect, useRef, type KeyboardEvent } from "react";

import {
  darkPaletteForFlowNodeKind,
  FLOW_INSERT_KINDS,
  SHAPE_FOR_KIND,
  shapeGeometry,
  type FlowInsertKind,
  type FlowNodeKind,
} from "@/src/diagram";
import { spring } from "@/src/lib/motion";

import { focusSoon, type FlowEditCopy } from "./flow-edit-editor";

const SYMBOL: Record<FlowInsertKind, FlowNodeKind> = {
  write: "output",
  read: "input",
  assign: "process",
  define: "process",
  if: "decision",
  ifElse: "decision",
  switch: "switch",
  while: "decision",
  repeat: "decision",
  for: "loop",
  call: "call",
};

function KindSymbol({ kind }: { kind: FlowNodeKind }) {
  const colors = darkPaletteForFlowNodeKind(kind);
  const width = 26;
  const height = kind === "decision" || kind === "switch" ? 16 : 13;
  const shape = shapeGeometry(SHAPE_FOR_KIND[kind], width, height);
  return (
    <svg aria-hidden className="shrink-0 overflow-visible" height={16} viewBox={`0 ${(height - 16) / 2} ${width} 16`} width={width}>
      <path d={shape.outline} fill={colors.fill} stroke={colors.stroke} strokeWidth={1.2} />
      {shape.details && <path d={shape.details} fill="none" stroke={colors.stroke} strokeWidth={1} />}
    </svg>
  );
}

export function FlowEditPalette({
  copy,
  onPick,
  onClose,
}: {
  copy: FlowEditCopy;
  onPick: (kind: FlowInsertKind) => void;
  onClose: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => focusSoon(() => listRef.current?.querySelector<HTMLButtonElement>("button")), []);

  // Arrow keys move through the two columns; Escape closes.
  const onKeyDown = (event: KeyboardEvent) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    const buttons = [...(listRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 2, ArrowUp: -2 }[event.key];
    if (step === undefined || index < 0) return;
    event.preventDefault();
    buttons[Math.min(buttons.length - 1, Math.max(0, index + step))]?.focus();
  };

  return (
    <motion.div
      animate={{ opacity: 1, scale: 1 }}
      aria-label={copy.insertTitle}
      className="nodrag nopan nowheel w-[264px] origin-top rounded-[14px] bg-[#1B2124] p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.45),inset_0_0_0_1px_rgba(255,255,255,0.08)]"
      initial={{ opacity: 0, scale: 0.94 }}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => event.stopPropagation()}
      role="menu"
      transition={spring.snappy}
    >
      <div className="px-2 pt-1 pb-1.5 text-[11px] font-medium text-[#8E9A95]">{copy.insertTitle}</div>
      <div ref={listRef} className="grid grid-cols-2 gap-0.5">
        {FLOW_INSERT_KINDS.map((kind) => (
          <button
            key={kind}
            className="flex h-8 items-center gap-2 rounded-[9px] px-2 text-left text-[12px] text-[#DCE4E0] outline-none hover:bg-white/[0.07] focus-visible:bg-white/[0.09] focus-visible:shadow-[inset_0_0_0_1.5px_rgba(134,240,196,0.55)]"
            onClick={() => onPick(kind)}
            role="menuitem"
            type="button"
          >
            <KindSymbol kind={SYMBOL[kind]} />
            <span className="truncate">{copy.kinds[kind]}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
