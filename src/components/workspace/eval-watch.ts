"use client";

// Watch expressions for the desk check: each chosen expression becomes a
// column, evaluated with the variables recorded at every row's step.
// Results are cached per run, so stepping only evaluates the new rows.

import { useEffect, useRef, useState } from "react";

import type { EvaluationResult } from "@/src/engine";
import type { VariableSnapshot } from "@/src/engine/types";

export interface WatchRow {
  step: number;
  variables: VariableSnapshot[];
  routine?: string | null;
}

type Evaluate = (expression: string, variables: VariableSnapshot[], routine?: string | null) => Promise<EvaluationResult>;

export const watchKey = (step: number, expression: string) => `${step}\u0000${expression}`;

/** Adds an expression to the list once (ignoring blanks and repeats). */
export function addWatch(watches: string[], expression: string): string[] {
  const trimmed = expression.trim();
  return !trimmed || watches.includes(trimmed) ? watches : [...watches, trimmed];
}

export function useWatchValues(rows: WatchRow[], watches: string[], evaluate: Evaluate, runId: number) {
  const cacheRef = useRef<{ runId: number; values: Map<string, EvaluationResult> }>({ runId, values: new Map() });
  const [values, setValues] = useState<Map<string, EvaluationResult>>(() => new Map());

  useEffect(() => {
    if (cacheRef.current.runId !== runId) cacheRef.current = { runId, values: new Map() };
    const cache = cacheRef.current;
    const missing: [WatchRow, string][] = [];
    for (const row of rows) for (const expression of watches) if (!cache.values.has(watchKey(row.step, expression))) missing.push([row, expression]);
    if (missing.length === 0) {
      setValues(cache.values);
      return;
    }
    let cancelled = false;
    void (async () => {
      for (const [row, expression] of missing) {
        const result = await evaluate(expression, row.variables, row.routine ?? null);
        if (cancelled || cacheRef.current !== cache) return;
        cache.values.set(watchKey(row.step, expression), result);
      }
      if (!cancelled) setValues(new Map(cache.values));
    })();
    return () => {
      cancelled = true;
    };
  }, [evaluate, rows, runId, watches]);

  return values;
}
