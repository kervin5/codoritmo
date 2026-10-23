"use client";

// Evaluar: type an expression and see its value at the step on screen, as
// PSeInt's step-by-step debugger offers. The value follows you as you step
// or scrub; "Seguir en la tabla" turns the expression into a desk-check
// column. Evaluation goes through the real engine on a copy of the step's
// variables (see src/engine/evaluate.ts), so it never changes the run.

import { CornerDownLeft, Plus, SquareFunction } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { formatRuntimeValue, type EvaluationResult } from "@/src/engine";
import type { VariableSnapshot, VariableSnapshotValue } from "@/src/engine/types";
import { formatDiagnostic } from "@/src/i18n/diagnostics";
import type { Dictionary } from "@/src/i18n/types";
import { duration, easeOut, spring } from "@/src/lib/motion";
import type { Player } from "./use-player";

/** A value as the desk check shows it: text in quotes, arrays in brackets, numbers as PSeInt prints them. */
export function formatEvaluated(value: VariableSnapshotValue): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return `"${value}"`;
  if (Array.isArray(value)) return `[${value.map(formatEvaluated).join(", ")}]`;
  return formatRuntimeValue(value);
}

/** The result's text, or its error in the dictionary's language. */
export function evaluationText(result: EvaluationResult, dictionary: Dictionary): string {
  return result.ok ? formatEvaluated(result.value) : formatDiagnostic(result.diagnostic, dictionary);
}

/** Evaluates `expression` against the step on screen and re-evaluates as the step changes. */
function useEvaluation(player: Player, expression: string | null, variables: VariableSnapshot[], routine: string | null) {
  const [result, setResult] = useState<{ expression: string; result: EvaluationResult } | null>(null);
  const { canEvaluate, evaluate } = player;
  useEffect(() => {
    if (!expression || !canEvaluate) return;
    let cancelled = false;
    void evaluate(expression, variables, routine).then((next) => {
      if (!cancelled) setResult({ expression, result: next });
    });
    return () => {
      cancelled = true;
    };
  }, [canEvaluate, evaluate, expression, routine, variables]);
  return expression && canEvaluate && result?.expression === expression ? result.result : null;
}

export function EvalField({
  player,
  dictionary,
  onWatch,
  autoFocus = false,
}: {
  player: Player;
  dictionary: Dictionary;
  /** Adds the typed expression as a desk-check column. */
  onWatch?: (expression: string) => void;
  autoFocus?: boolean;
}) {
  const t = dictionary.studio.evaluate;
  const [draft, setDraft] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const result = useEvaluation(player, submitted, player.variables, player.frame?.routine ?? null);
  const stale = submitted !== null && draft.trim() !== submitted;
  const pending = draft.trim() !== "" && draft.trim() !== submitted;
  const message = submitted && !player.canEvaluate ? t.unavailable : null;

  return (
    <form
      className="flex min-w-0 flex-1 items-center gap-2 font-sans"
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(draft.trim() || null);
      }}
    >
      <label className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-[8px] bg-white/[0.04] px-2 transition-colors focus-within:bg-white/[0.07] sm:max-w-[340px]">
        <SquareFunction aria-hidden className="shrink-0 text-white/35" size={14} />
        <input
          aria-label={t.label}
          autoFocus={autoFocus}
          className="min-w-0 flex-1 bg-transparent font-mono text-[13px] text-[#EEF3F0] caret-[#86F0C4] outline-none placeholder:font-sans placeholder:text-white/30"
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t.placeholder}
          spellCheck={false}
          title={t.hint}
          value={draft}
        />
        {pending && <CornerDownLeft aria-hidden className="shrink-0 text-white/30" size={12} />}
      </label>
      <output aria-live="polite" className="min-w-0 flex-1 truncate text-[13px]" data-testid="eval-result">
        <AnimatePresence initial={false} mode="popLayout">
          {(result || message) && (
            <motion.span
              key={result ? evaluationText(result, dictionary) : message}
              animate={{ opacity: stale ? 0.45 : 1, y: 0 }}
              className={`inline-flex max-w-full items-baseline gap-1.5 ${
                message ? "text-white/40" : result && !result.ok ? "text-[#F5A68E]" : "font-mono text-white/90"
              }`}
              exit={{ opacity: 0, transition: { duration: duration.fast, ease: easeOut } }}
              initial={{ opacity: 0, y: 4 }}
              transition={spring.snappy}
            >
              {result?.ok && <span className="text-white/35">=</span>}
              <span className="truncate" title={result ? evaluationText(result, dictionary) : undefined}>
                {result ? evaluationText(result, dictionary) : message}
              </span>
            </motion.span>
          )}
        </AnimatePresence>
      </output>
      {onWatch && (
        <button
          className="flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-[12px] text-[#B5C0BB] transition-colors hover:bg-white/[0.07] disabled:opacity-40 disabled:hover:bg-transparent"
          disabled={!draft.trim()}
          onClick={() => {
            const expression = draft.trim();
            if (!expression) return;
            onWatch(expression);
            setSubmitted(expression);
          }}
          title={t.hint}
          type="button"
        >
          <Plus size={13} /> {t.addWatch}
        </button>
      )}
    </form>
  );
}
