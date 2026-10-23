"use client";

// Live counters over the flowchart: the variables the program just touched,
// big enough to read from across a classroom. Each change rolls in like an
// odometer, so you see the value move while the marble moves.

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import type { VariableSnapshot } from "@/src/engine/types";
import { spring } from "@/src/lib/motion";
import { formatValue } from "./panels";

const MAX = 3;

export function VariableDock({
  variables,
  changed,
  step,
}: {
  /** Variables at the step on screen. */
  variables: VariableSnapshot[];
  /** Names that changed on this step. */
  changed: Set<string>;
  step: number;
}) {
  // Remember the most recently changed names, so a step that touches nothing
  // doesn't empty the dock; the newest change goes first. Rewinding clears it.
  const [recent, setRecent] = useState<{ step: number; names: string[] }>({ step: -1, names: [] });
  let current = recent;
  if (step !== recent.step) {
    const kept = step < recent.step ? [] : recent.names;
    current = {
      step,
      names: changed.size ? [...changed, ...kept.filter((n) => !changed.has(n))].slice(0, MAX) : kept,
    };
    setRecent(current);
  }
  const shown = current.names
    .map((name) => variables.find((v) => v.name === name))
    .filter((v): v is VariableSnapshot => !!v && v.initialized && !Array.isArray(v.value) && typeof v.value !== "object");
  if (!shown.length) return null;

  return (
    <div className="pointer-events-none absolute right-3 bottom-3 z-10 flex gap-2" aria-hidden>
      <AnimatePresence initial={false} mode="popLayout">
        {shown.map((v) => {
          const hot = changed.has(v.name);
          const text = formatValue(v.value);
          return (
            <motion.div
              key={v.name}
              layout
              animate={{ opacity: 1, scale: 1 }}
              className={`min-w-[64px] rounded-[12px] px-3 py-1.5 backdrop-blur-md transition-colors duration-300 ${
                hot ? "bg-[#7FE0B8]/[0.12] ring-1 ring-[#7FE0B8]/35" : "bg-[#1D2124]/85 ring-1 ring-white/[0.06]"
              }`}
              exit={{ opacity: 0, scale: 0.9 }}
              initial={{ opacity: 0, scale: 0.9 }}
              transition={spring.snappy}
            >
              <div className="font-sans text-[11.5px] text-white/50">{v.name}</div>
              <div className="relative h-[24px] overflow-hidden">
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.div
                    key={text}
                    animate={{ y: 0, opacity: 1 }}
                    className={`max-w-[150px] truncate font-mono text-[18px] leading-[24px] font-semibold ${hot ? "text-[#C9FBE5]" : "text-white/85"}`}
                    exit={{ y: -20, opacity: 0 }}
                    initial={{ y: 20, opacity: 0 }}
                    transition={spring.snappy}
                  >
                    {text}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
