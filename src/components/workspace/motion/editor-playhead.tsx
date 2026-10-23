"use client";

// The editor's running-line highlight, as one bar that glides from line to
// line (a spring) instead of a decoration that jumps. It lives in a layer
// under Monaco's text (the editor background is transparent), follows
// scrolling exactly, and springs only when the line changes.

import type { editor } from "monaco-editor";
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { easeOut, spring } from "@/src/lib/motion";

const MINT = "#7fe0b8";

/** The layer under Monaco's text, or null when the editor has no real DOM (tests). */
export function usePlayheadLayer(instance: editor.IStandaloneCodeEditor | null): HTMLDivElement | null {
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const guard = instance?.getDomNode?.()?.querySelector(".overflow-guard");
    if (!guard) return;
    const el = document.createElement("div");
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = "position:absolute;inset:0;overflow:hidden;pointer-events:none;";
    // First child: painted under the margin and the text.
    guard.insertBefore(el, guard.firstChild);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the layer is a DOM node Monaco creates on mount
    setLayer(el);
    return () => {
      el.remove();
      setLayer(null);
    };
  }, [instance]);
  return layer;
}

export function EditorPlayhead({
  instance,
  layer,
  line,
  lineHeight,
}: {
  instance: editor.IStandaloneCodeEditor;
  layer: HTMLDivElement;
  line: number | null;
  lineHeight: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  const reduced = useReducedMotion();
  const [layout, setLayout] = useState(() => instance.getLayoutInfo());
  const shownRef = useRef<number | null>(null);

  // Scrolling moves the bar 1:1 (no spring), and layout changes re-measure.
  useEffect(() => {
    const sync = () => {
      const el = scrollRef.current;
      if (el) el.style.transform = `translateY(${-instance.getScrollTop()}px)`;
    };
    sync();
    const scroll = instance.onDidScrollChange(sync);
    const resize = instance.onDidLayoutChange((info) => setLayout(info));
    return () => {
      scroll.dispose();
      resize.dispose();
    };
  }, [instance]);

  // A new line: spring there; the first line of a run appears in place.
  useLayoutEffect(() => {
    if (line === null) {
      shownRef.current = null;
      return;
    }
    const top = instance.getTopForLineNumber(line);
    const fresh = shownRef.current === null;
    shownRef.current = line;
    if (fresh || reduced) {
      y.jump(top);
      return;
    }
    const controls = animate(y, top, spring.snappy);
    return () => controls.stop();
  }, [instance, line, lineHeight, reduced, y]);

  const dot = 7;
  return createPortal(
    <div ref={scrollRef} style={{ position: "absolute", left: 0, top: 0, right: 0, willChange: "transform" }}>
      <motion.div
        animate={{ opacity: line === null ? 0 : 1 }}
        initial={false}
        style={{ position: "absolute", left: 0, right: 0, top: 0, height: lineHeight, y }}
        transition={{ duration: 0.2, ease: easeOut }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: layout.contentLeft,
            right: 0,
            background: "linear-gradient(90deg, rgba(127, 224, 184, 0.17), rgba(127, 224, 184, 0.03))",
            boxShadow: `inset 2px 0 0 ${MINT}`,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: (lineHeight - dot) / 2,
            left: layout.glyphMarginLeft + 8,
            width: dot,
            height: dot,
            borderRadius: 999,
            background: MINT,
            boxShadow: `0 0 8px ${MINT}`,
          }}
        />
      </motion.div>
    </div>,
    layer
  );
}

/**
 * A one-time "wrong password" shake on an error's line (~6px, 3 oscillations),
 * and/or its squiggle fading in. Finds the rendered line by position, so it is a
 * no-op off screen or without layout (tests).
 */
export function shakeEditorLine(
  instance: editor.IStandaloneCodeEditor,
  line: number,
  lineHeight: number,
  { shake, fade }: { shake: boolean; fade: boolean }
) {
  const root = instance.getDomNode?.();
  if (!root || typeof root.getBoundingClientRect !== "function") return;
  const box = root.getBoundingClientRect();
  if (box.height === 0) return;
  const top = box.top + instance.getTopForLineNumber(line) - instance.getScrollTop();
  const within = (el: Element) => {
    const rect = el.getBoundingClientRect();
    const middle = rect.top + rect.height / 2;
    return middle >= top && middle < top + lineHeight;
  };
  if (fade) {
    root.querySelectorAll(".squiggly-error").forEach((el) => {
      if (within(el)) el.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: "ease-out" });
    });
  }
  if (!shake) return;
  const text = [...root.querySelectorAll(".view-lines .view-line")].find(within);
  text?.animate?.(
    [0, -6, 6, -5, 5, -3, 3, 0].map((x) => ({ transform: `translateX(${x}px)` })),
    { duration: 460, easing: "ease-out" }
  );
}
