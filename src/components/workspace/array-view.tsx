"use client";

// Array visualiser: every array in the current step, drawn as bars (numbers),
// boxes (text, logic) or a heat grid (matrices). Cells used on the line about
// to run are outlined and labelled with their index expression (v[j+1]);
// cells that changed since the previous step glow. Works for any program,
// and follows the player, so scrubbing replays the algorithm.

import { motion, stagger, useAnimate, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

import { easeOut, spring } from "@/src/lib/motion";
import type { ExecutionMetrics, VariableSnapshot, VariableSnapshotValue } from "@/src/engine/types";
import { formatMessage } from "@/src/i18n/format";
import type { Dictionary } from "@/src/i18n/types";
import { advanceTrack, createTrack, isSorted, type ArrayTrack } from "./motion/array-identity";
import { formatValue } from "./panels";

const MAX_CELLS = 256;

interface Access {
  /** Flat cell indices (0-based) touched on the current line. */
  cells: Map<number, string>;
}

/* ---------- tiny evaluator for index expressions like j+1, (izq+der)/2 ---------- */

function evaluateIndex(text: string, scalars: Map<string, number>): number | null {
  const tokens = text.match(/[\p{L}_][\p{L}\p{N}_]*|\d+(?:\.\d+)?|[-+*/()%]/gu);
  if (!tokens) return null;
  let position = 0;
  const peek = () => tokens[position];
  const next = () => tokens[position++];
  const primary = (): number | null => {
    const token = next();
    if (token === undefined) return null;
    if (token === "(") {
      const value = sum();
      next();
      return value;
    }
    if (token === "-") {
      const value = primary();
      return value === null ? null : -value;
    }
    if (/^\d/.test(token)) return Number(token);
    if (/^trunc$/i.test(token) && peek() === "(") {
      const inner = primary();
      return inner === null ? null : Math.trunc(inner);
    }
    const value = scalars.get(token.toLowerCase());
    return value === undefined ? null : value;
  };
  const product = (): number | null => {
    let value = primary();
    while (value !== null && (peek() === "*" || peek() === "/" || peek() === "%")) {
      const op = next();
      const right = primary();
      if (right === null) return null;
      value = op === "*" ? value * right : op === "/" ? value / right : value % right;
    }
    return value;
  };
  const sum = (): number | null => {
    let value = product();
    while (value !== null && (peek() === "+" || peek() === "-")) {
      const op = next();
      const right = product();
      if (right === null) return null;
      value = op === "+" ? value + right : value - right;
    }
    return value;
  };
  const result = sum();
  return result === null || position < tokens.length || !Number.isFinite(result) ? null : Math.trunc(result);
}

/** Splits "a[i, j+1]" index text on top-level commas. */
function splitIndices(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of text) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else current += char;
  }
  parts.push(current);
  return parts.map((p) => p.trim());
}

function accessesOnLine(
  line: string,
  name: string,
  dims: number[],
  scalars: Map<string, number>,
  base: number
): Access {
  const cells = new Map<number, string>();
  const pattern = /([\p{L}_][\p{L}\p{N}_]*)\s*\[([^\]]+)\]/gu;
  for (const match of line.replace(/"[^"]*"|'[^']*'|\/\/.*$/g, "").matchAll(pattern)) {
    if (match[1].toLowerCase() !== name.toLowerCase()) continue;
    const parts = splitIndices(match[2]);
    if (parts.length !== dims.length) continue;
    const indices = parts.map((part) => evaluateIndex(part, scalars));
    if (indices.some((i) => i === null)) continue;
    let flat = 0;
    let valid = true;
    indices.forEach((index, d) => {
      const zero = (index as number) - base;
      if (zero < 0 || zero >= dims[d]) valid = false;
      flat = flat * dims[d] + zero;
    });
    if (valid && !cells.has(flat)) cells.set(flat, parts.join(","));
  }
  return { cells };
}

/* ---------- shape helpers ---------- */

function dimensionsOf(value: VariableSnapshotValue): number[] {
  const dims: number[] = [];
  let current: VariableSnapshotValue = value;
  while (Array.isArray(current)) {
    dims.push(current.length);
    current = current[0] ?? null;
  }
  return dims;
}

function flatten(value: VariableSnapshotValue): VariableSnapshotValue[] {
  return Array.isArray(value) ? value.flatMap((item) => (Array.isArray(item) ? flatten(item) : [item])) : [value];
}

/* ---------- views ---------- */

/** Keeps each cell's identity across steps (see motion/array-identity), so swaps animate as bars crossing. */
function useArrayTrack(values: VariableSnapshotValue[]): ArrayTrack {
  const [track, setTrack] = useState(() => createTrack(values));
  const next = advanceTrack(track, values);
  // Adjusting state while rendering: React re-renders immediately, without committing the stale ids.
  if (next !== track) setTrack(next);
  return next;
}

/**
 * Fires once per run when the array ends the run sorted after having been
 * unsorted at some point in it. Returns a counter that bumps on each celebration.
 */
function useSortedCelebration(values: VariableSnapshotValue[], steps: number, finished: boolean): number {
  const sorted = isSorted(values);
  const [run, setRun] = useState({ steps, sawUnsorted: false, done: false, wave: 0 });
  let next = run;
  // Steps going backwards means a new run (or a scrub back): start watching again.
  if (steps < run.steps) next = { ...next, sawUnsorted: false, done: false };
  if (steps !== next.steps) next = { ...next, steps };
  if (!sorted && !next.sawUnsorted) next = { ...next, sawUnsorted: true };
  if (finished && sorted && next.sawUnsorted && !next.done) next = { ...next, done: true, wave: next.wave + 1 };
  if (next !== run) setRun(next);
  return next.wave;
}

function Bars({
  values,
  previous,
  access,
  base,
  steps,
  finished,
}: {
  values: VariableSnapshotValue[];
  previous: VariableSnapshotValue[] | null;
  access: Access;
  base: number;
  steps: number;
  finished: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const track = useArrayTrack(values);
  const wave = useSortedCelebration(values, steps, finished);
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const numbers = values.map((v) => (typeof v === "number" ? v : 0));
  const max = Math.max(1, ...numbers.map(Math.abs));
  const hasNegative = numbers.some((n) => n < 0);
  const showLabels = values.length <= 40;
  // Layout-animating hundreds of bars every frame costs more than it explains.
  const animateLayout = values.length <= 128;

  // The sorted wave: left to right, each bar hops and tints mint, then settles.
  useEffect(() => {
    if (wave === 0 || !scope.current) return;
    const count = scope.current.querySelectorAll("[data-hop]").length;
    const step = Math.min(0.045, 0.75 / Math.max(1, count));
    const tint = animate("[data-tint]", { opacity: [0, 1, 0] }, { duration: 0.75, delay: stagger(step), ease: "easeInOut" });
    const hop = reduceMotion
      ? null
      : animate("[data-hop]", { y: [0, -12, 1.5, 0] }, { duration: 0.55, times: [0, 0.4, 0.75, 1], delay: stagger(step), ease: "easeOut" });
    return () => {
      tint.stop();
      hop?.stop();
    };
    // Only a new celebration restarts the wave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wave]);

  return (
    <div ref={scope}>
      <div className="flex items-end gap-[3px] pt-5" style={{ height: showLabels ? 136 : 150 }}>
        {values.map((value, i) => {
          const n = numbers[i];
          const height = Math.max(3, (Math.abs(n) / max) * (hasNegative ? 55 : 100));
          const active = access.cells.get(i);
          const changed = previous !== null && previous[i] !== undefined && JSON.stringify(previous[i]) !== JSON.stringify(value);
          const writes = track.writes[i];
          return (
            <motion.div
              key={track.ids[i]}
              className="relative flex h-full min-w-[3px] flex-1 flex-col items-center justify-end"
              layout={animateLayout ? "position" : false}
              title={`[${i + base}] = ${formatValue(value)}`}
              transition={spring.travel}
            >
              <div className="flex h-full w-full flex-col items-center justify-end" data-hop>
                <motion.div
                  animate={{ y: active !== undefined && !reduceMotion ? -4 : 0 }}
                  className="flex h-full w-full flex-col items-center justify-end"
                  initial={false}
                  transition={spring.snappy}
                >
                  {active !== undefined && (
                    <span className="absolute -top-0.5 z-10 rounded bg-[#E8BE8C] px-1 font-mono text-[10px] leading-[14px] text-[#14181A]">{active}</span>
                  )}
                  {showLabels && <span className="mb-0.5 font-mono text-[10px] text-white/55">{value === null ? "" : formatValue(value)}</span>}
                  <motion.div
                    animate={{ height: `${height}%` }}
                    className={`relative w-full overflow-hidden rounded-t-[3px] transition-[background-color,box-shadow] duration-200 ${
                      active !== undefined
                        ? "bg-[#F2CFA4] shadow-[0_0_12px_rgba(232,190,140,0.45)]"
                        : changed
                          ? "bg-[#86F0C4] shadow-[0_0_10px_rgba(134,240,196,0.6)]"
                          : n < 0
                            ? "bg-[#F08A6C]/70"
                            : "bg-[#4E8E78]"
                    }`}
                    initial={false}
                    transition={spring.smooth}
                  >
                    {writes > 0 && (
                      <motion.span
                        key={writes}
                        animate={{ opacity: 0 }}
                        aria-hidden
                        className="pointer-events-none absolute inset-0 bg-white"
                        initial={{ opacity: 0.7 }}
                        transition={{ duration: 0.45, ease: easeOut }}
                      />
                    )}
                    <span aria-hidden className="pointer-events-none absolute inset-0 bg-[#86F0C4] opacity-0 shadow-[0_0_14px_rgba(134,240,196,0.7)]" data-tint />
                  </motion.div>
                </motion.div>
              </div>
            </motion.div>
          );
        })}
      </div>
      {showLabels && (
        <div className="flex gap-[3px]">
          {values.map((_, i) => (
            <span key={i} className="mt-0.5 min-w-[3px] flex-1 text-center font-mono text-[9.5px] text-white/30">
              {i + base}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Boxes({
  values,
  previous,
  access,
  base,
}: {
  values: VariableSnapshotValue[];
  previous: VariableSnapshotValue[] | null;
  access: Access;
  base: number;
}) {
  const track = useArrayTrack(values);
  return (
    <div className="flex flex-wrap gap-1 pt-4">
      {values.map((value, i) => {
        const active = access.cells.get(i);
        const changed = previous !== null && previous[i] !== undefined && JSON.stringify(previous[i]) !== JSON.stringify(value);
        return (
          <motion.div key={track.ids[i]} className="relative flex flex-col items-center" layout={values.length <= 128 ? "position" : false} transition={spring.travel}>
            {active !== undefined && (
              <span className="absolute -top-4 rounded bg-[#E8BE8C] px-1 font-mono text-[10px] leading-[14px] text-[#14181A]">{active}</span>
            )}
            <motion.div
              animate={{ y: active !== undefined ? -3 : 0 }}
              initial={false}
              transition={spring.snappy}
              className={`relative min-w-[44px] max-w-[160px] truncate rounded-[6px] border px-2 py-1 text-center font-mono text-[12.5px] transition-[background-color,border-color,box-shadow] duration-200 ${
                active !== undefined
                  ? "border-[#E8BE8C] bg-[#E8BE8C]/15 text-white"
                  : changed
                    ? "border-[#86F0C4] bg-[#86F0C4]/15 text-white shadow-[0_0_10px_rgba(134,240,196,0.4)]"
                    : "border-white/10 bg-white/[0.03] text-white/80"
              }`}
            >
              {value === null ? "·" : formatValue(value)}
              {track.writes[i] > 0 && (
                <motion.span
                  key={track.writes[i]}
                  animate={{ opacity: 0 }}
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-[6px] bg-white/40"
                  initial={{ opacity: 1 }}
                  transition={{ duration: 0.45, ease: easeOut }}
                />
              )}
            </motion.div>
            <span className="font-mono text-[9.5px] text-white/30">{i + base}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

function Grid({
  values,
  previous,
  access,
  dims,
  base,
}: {
  values: VariableSnapshotValue[];
  previous: VariableSnapshotValue[] | null;
  access: Access;
  dims: number[];
  base: number;
}) {
  const [rows, cols] = dims;
  const numbers = values.filter((v): v is number => typeof v === "number");
  const min = numbers.length ? Math.min(...numbers) : 0;
  const max = numbers.length ? Math.max(...numbers) : 1;
  return (
    <div className="overflow-auto pt-2">
      <table className="border-separate border-spacing-[3px] font-mono text-[12px]">
        <thead>
          <tr>
            <th />
            {Array.from({ length: cols }, (_, c) => (
              <th key={c} className="text-[9.5px] font-normal text-white/30">
                {c + base}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              <td className="pr-1 text-right text-[9.5px] text-white/30">{r + base}</td>
              {Array.from({ length: cols }, (_, c) => {
                const i = r * cols + c;
                const value = values[i];
                const active = access.cells.get(i);
                const changed = previous !== null && JSON.stringify(previous[i]) !== JSON.stringify(value);
                const heat = typeof value === "number" && max > min ? (value - min) / (max - min) : 0;
                return (
                  <td
                    key={c}
                    className={`min-w-[38px] rounded-[4px] px-1.5 py-1 text-center ${
                      active !== undefined ? "outline outline-2 outline-[#E8BE8C]" : changed ? "outline outline-2 outline-[#86F0C4]" : ""
                    }`}
                    style={{ background: `rgba(78, 142, 120, ${0.08 + heat * 0.55})` }}
                    title={active}
                  >
                    {value === null ? "·" : formatValue(value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ArrayView({
  dictionary,
  variables,
  previous,
  line,
  metrics,
  baseZero,
}: {
  dictionary: Dictionary;
  variables: VariableSnapshot[];
  previous: VariableSnapshot[] | null;
  /** Source text of the line about to run, if any. */
  line: string | null;
  metrics: ExecutionMetrics | null;
  baseZero: boolean;
}) {
  const t = dictionary.studio.visualizer;
  const base = baseZero ? 0 : 1;

  const scalars = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of variables) if (typeof v.value === "number") map.set(v.name.toLowerCase(), v.value);
    return map;
  }, [variables]);

  const arrays = variables.filter((v) => Array.isArray(v.value));

  return (
    <div className="workspace-scroll h-full overflow-auto px-5 py-3">
      {metrics && (
        <div className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-[11.5px] text-white/45">
          <span>
            {t.steps}: <b className="font-mono font-medium text-white/80">{metrics.steps}</b>
          </span>
          <span>
            {t.comparisons}: <b className="font-mono font-medium text-white/80">{metrics.comparisons}</b>
          </span>
          <span>
            {t.reads}: <b className="font-mono font-medium text-white/80">{metrics.arrayReads}</b>
          </span>
          <span>
            {t.writes}: <b className="font-mono font-medium text-white/80">{metrics.arrayWrites}</b>
          </span>
          <span className="ml-auto flex items-center gap-3">
            <span className="flex items-center gap-1">
              <i className="inline-block h-2 w-2 rounded-sm bg-[#E8BE8C]" /> {t.legendActive}
            </span>
            <span className="flex items-center gap-1">
              <i className="inline-block h-2 w-2 rounded-sm bg-[#86F0C4]" /> {t.legendChanged}
            </span>
          </span>
        </div>
      )}
      {arrays.length === 0 && <p className="py-2 text-[13px] text-white/40">{metrics ? t.noArrays : t.empty}</p>}
      {arrays.map((variable) => {
        const dims = dimensionsOf(variable.value);
        const values = flatten(variable.value);
        const before = previous?.find((p) => p.name === variable.name);
        const previousValues = before && Array.isArray(before.value) ? flatten(before.value) : null;
        const access = line ? accessesOnLine(line, variable.name, dims, scalars, base) : { cells: new Map<number, string>() };
        const tooBig = values.length > MAX_CELLS;
        const shown = tooBig ? values.slice(0, MAX_CELLS) : values;
        const numeric = shown.every((v) => v === null || typeof v === "number") && shown.some((v) => typeof v === "number");
        return (
          <section key={variable.name} className="mb-4">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[13px] font-semibold text-white/90">{variable.name}</span>
              <span className="text-[11px] text-white/35">
                {dims.join(" × ")}
                {variable.dataType ? ` · ${variable.dataType}` : ""}
              </span>
            </div>
            {dims.length === 2 && !tooBig ? (
              <Grid access={access} base={base} dims={dims} previous={previousValues} values={values} />
            ) : dims.length === 1 && numeric ? (
              <Bars
                access={access}
                base={base}
                finished={line === null && metrics !== null}
                previous={previousValues}
                steps={metrics?.steps ?? 0}
                values={shown}
              />
            ) : (
              <Boxes access={access} base={base} previous={previousValues} values={shown} />
            )}
            {tooBig && <p className="mt-1 text-[11.5px] text-white/35">{formatMessage(t.truncated, { shown: MAX_CELLS, total: values.length })}</p>}
          </section>
        );
      })}
    </div>
  );
}

/** Exposed for tests. */
export const __testing = { evaluateIndex, accessesOnLine };
