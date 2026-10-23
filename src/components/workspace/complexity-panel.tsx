"use client";

// Measures how a program's work grows with n and names its complexity.
// Every Leer gets n; the chart shows statements executed (time) or memory
// cells used (space), the fitted curve, and optionally a second algorithm
// for comparison. Theory from the example library is shown when known.

import { Gauge, Square } from "lucide-react";
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import {
  examplePrograms,
  GROWTH,
  measureComplexity,
  normalizeEngineSettings,
  spaceOf,
  timeOf,
  type ComplexityReport,
  type ComplexitySample,
  type EngineSettings,
  type ExampleProgram,
} from "@/src/engine";
import { formatMessage } from "@/src/i18n/format";
import type { Dictionary } from "@/src/i18n/types";
import { duration, easeOut, spring, stagger } from "@/src/lib/motion";

type Measure = "time" | "space";

const theoryOf = (example: ExampleProgram | undefined) => example?.complexity;

const COLORS = { main: "#86F0C4", fit: "#86F0C4", compare: "#E8BE8C" };

/** A measured point; ghosts are the previous measurement, shown until re-measuring replaces them. */
type ChartSample = ComplexitySample & { ghost?: boolean };

/** A number that counts up to its value (and between values when re-measured). */
function CountUp({ value }: { value: number }) {
  const reduceMotion = useReducedMotion();
  const count = useMotionValue(value);
  const text = useTransform(count, (v) => String(Math.round(v)));
  const shown = useRef(false);
  useEffect(() => {
    if (reduceMotion) {
      count.set(value);
      return;
    }
    // The first appearance counts up from zero; later changes count from where it was.
    if (!shown.current) count.set(0);
    shown.current = true;
    const controls = animate(count, value, { duration: 0.7, ease: easeOut });
    return () => controls.stop();
  }, [count, reduceMotion, value]);
  return <motion.span>{text}</motion.span>;
}

function Chart({
  samples,
  compare,
  measure,
  fitClass,
  labels,
}: {
  samples: ChartSample[];
  compare: ComplexitySample[] | null;
  measure: Measure;
  fitClass: string | null;
  labels: { n: string; y: string };
}) {
  const clipId = useId();
  const value = measure === "time" ? timeOf : spaceOf;
  const all = [...samples, ...(compare ?? [])];
  if (all.length === 0) return null;
  const maxN = Math.max(...all.map((s) => s.n));
  const maxY = Math.max(1, ...all.map((s) => value(s.metrics)));
  const W = 560;
  const H = 220;
  const pad = { l: 56, r: 12, t: 12, b: 30 };
  const x = (n: number) => pad.l + (n / maxN) * (W - pad.l - pad.r);
  const y = (v: number) => H - pad.b - (v / maxY) * (H - pad.t - pad.b);
  const path = (points: ComplexitySample[]) =>
    points.map((s, i) => `${i ? "L" : "M"}${x(s.n).toFixed(1)},${y(value(s.metrics)).toFixed(1)}`).join(" ");

  // Fitted curve scaled through the last measured point. Always 41 points, so a
  // new fit (or switching time/space) morphs the curve rather than redrawing it.
  let fitPath = "";
  if (fitClass && fitClass in GROWTH && samples.length >= 3) {
    const g = GROWTH[fitClass as keyof typeof GROWTH];
    const last = samples[samples.length - 1];
    const k = value(last.metrics) / Math.max(1e-9, g(last.n));
    const pts: string[] = [];
    for (let i = 0; i <= 40; i += 1) {
      const n = Math.max(1, (last.n * i) / 40);
      pts.push(`${pts.length ? "L" : "M"}${x(n).toFixed(1)},${y(Math.min(maxY * 1.05, k * g(n))).toFixed(1)}`);
    }
    fitPath = pts.join(" ");
  }

  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const draw = { pathLength: { duration: 0.9, ease: easeOut }, d: spring.smooth };
  const point = (delay: number) => ({
    default: spring.smooth,
    scale: { ...spring.bouncy, delay },
    opacity: { duration: duration.fast, delay },
  });
  return (
    <svg className="w-full max-w-[640px]" role="img" viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <clipPath id={clipId}>
          {/* Wipes the fitted curve in left to right whenever the fitted class changes. */}
          <motion.rect
            key={fitClass ?? ""}
            animate={{ width: W }}
            height={H}
            initial={{ width: 0 }}
            transition={{ duration: 0.8, ease: easeOut }}
            x={0}
            y={0}
          />
        </clipPath>
      </defs>
      {ticks.map((f) => (
        <g key={f}>
          <line stroke="rgba(255,255,255,0.06)" x1={pad.l} x2={W - pad.r} y1={y(maxY * f)} y2={y(maxY * f)} />
          <text fill="rgba(255,255,255,0.35)" fontSize="10" textAnchor="end" x={pad.l - 6} y={y(maxY * f) + 3}>
            {Math.round(maxY * f).toLocaleString()}
          </text>
          <text fill="rgba(255,255,255,0.35)" fontSize="10" textAnchor="middle" x={x(maxN * f)} y={H - pad.b + 14}>
            {Math.round(maxN * f)}
          </text>
        </g>
      ))}
      <text fill="rgba(255,255,255,0.45)" fontSize="10" x={W - pad.r} y={H - 4} textAnchor="end">
        {labels.n}
      </text>
      <text fill="rgba(255,255,255,0.45)" fontSize="10" x={4} y={10}>
        {labels.y}
      </text>
      {fitPath && (
        <g clipPath={`url(#${clipId})`}>
          <motion.path
            animate={{ d: fitPath }}
            fill="none"
            initial={false}
            stroke={COLORS.fit}
            strokeDasharray="4 4"
            strokeOpacity="0.45"
            strokeWidth="1.5"
            transition={spring.smooth}
          />
        </g>
      )}
      {compare && compare.length > 0 && (
        <>
          <motion.path
            animate={{ d: path(compare), pathLength: 1 }}
            fill="none"
            initial={{ d: path(compare), pathLength: 0 }}
            stroke={COLORS.compare}
            strokeWidth="2"
            transition={draw}
          />
          {compare.map((s, i) => (
            <motion.circle
              key={`c${s.n}`}
              animate={{ cx: x(s.n), cy: y(value(s.metrics)), scale: 1, opacity: 1 }}
              fill={COLORS.compare}
              initial={{ cx: x(s.n), cy: y(value(s.metrics)), scale: 0, opacity: 0 }}
              r="3"
              transition={point(stagger(i, 0.05, 0.6))}
            />
          ))}
        </>
      )}
      <motion.path
        animate={{ d: path(samples), pathLength: 1 }}
        fill="none"
        initial={{ d: path(samples), pathLength: 0 }}
        stroke={COLORS.main}
        strokeWidth="2"
        transition={draw}
      />
      {/* Measured points stream in one at a time, so each pops as it arrives. */}
      {samples.map((s) => (
        <motion.circle
          key={s.n}
          animate={{ cx: x(s.n), cy: y(value(s.metrics)), scale: 1, opacity: s.ghost ? 0.3 : 1 }}
          fill={COLORS.main}
          initial={{ cx: x(s.n), cy: y(value(s.metrics)), scale: 0, opacity: 0 }}
          r="3"
          transition={point(0)}
        />
      ))}
    </svg>
  );
}

/** "Ajuste: 92%" with the number counting up. */
function Confidence({ template, pct }: { template: string; pct: number }) {
  const [before, after = ""] = formatMessage(template, { pct: "\u0000" }).split("\u0000");
  return (
    <>
      {before}
      <CountUp value={pct} />
      {after}
    </>
  );
}

export function ComplexityPanel({
  dictionary,
  source,
  settings,
  exampleId,
}: {
  dictionary: Dictionary;
  source: string;
  settings: EngineSettings;
  exampleId?: string;
}) {
  const t = dictionary.studio.visualizer;
  const [report, setReport] = useState<ComplexityReport | null>(null);
  const [progress, setProgress] = useState<ComplexitySample[]>([]);
  const [running, setRunning] = useState(false);
  const [measure, setMeasure] = useState<Measure>("time");
  const [compareId, setCompareId] = useState<string>("");
  const [compareReport, setCompareReport] = useState<ComplexityReport | null>(null);
  const stopRef = useRef(false);
  const [measuredSource, setMeasuredSource] = useState<string | null>(null);
  /** The last results, kept on screen while re-measuring so the chart and cards morph instead of flashing. */
  const [previous, setPrevious] = useState<{ report: ComplexityReport; compare: ComplexityReport | null } | null>(null);

  const comparable = useMemo(() => examplePrograms.filter((e) => theoryOf(e)), []);
  const theory = theoryOf(examplePrograms.find((e) => e.id === exampleId));
  const stale = report !== null && measuredSource !== source;

  const run = async () => {
    stopRef.current = false;
    setRunning(true);
    setPrevious(report ? { report, compare: compareReport } : null);
    setProgress([]);
    setReport(null);
    setCompareReport(null);
    setMeasuredSource(source);
    const result = await measureComplexity({
      source,
      settings,
      onSample: (sample) => setProgress((current) => [...current, sample]),
      shouldStop: () => stopRef.current,
    });
    setReport(result);
    const other = comparable.find((e) => e.id === compareId);
    if (other && !stopRef.current) {
      setCompareReport(
        await measureComplexity({ source: other.source, settings: normalizeEngineSettings(other.settings), shouldStop: () => stopRef.current })
      );
    }
    setRunning(false);
  };

  const samples = report?.samples ?? progress;
  const held = running ? previous : null;
  const shownReport = report ?? held?.report ?? null;
  const shownCompare = compareReport ?? held?.compare ?? null;
  // While re-measuring, old points stay (faded) until their n is measured again.
  const chartSamples: ChartSample[] = held
    ? [...samples, ...held.report.samples.filter((old) => !samples.some((s) => s.n === old.n)).map((old) => ({ ...old, ghost: true }))].sort(
        (a, b) => a.n - b.n
      )
    : samples;
  const fit = shownReport ? (measure === "time" ? shownReport.time : shownReport.space) : null;
  const titleOf = (e: ExampleProgram) => dictionary.examples[e.id]?.label ?? e.label;

  return (
    <div className="workspace-scroll h-full overflow-auto px-5 py-3 text-[13px]">
      <div className="flex flex-wrap items-center gap-2">
        {running ? (
          <button
            className="flex h-[28px] items-center gap-1.5 rounded-[7px] bg-white/[0.08] px-3 text-white/85 hover:bg-white/[0.12]"
            onClick={() => {
              stopRef.current = true;
            }}
            type="button"
          >
            <Square fill="currentColor" size={10} /> {t.stop}
          </button>
        ) : (
          <button
            className="flex h-[28px] items-center gap-1.5 rounded-[7px] bg-[#2F8F6E] px-3 font-medium text-white hover:bg-[#35A27C]"
            onClick={() => void run()}
            type="button"
          >
            <Gauge size={13} /> {report ? t.measureAgain : t.measure}
          </button>
        )}
        <div className="flex rounded-[7px] bg-black/20 p-0.5" role="radiogroup">
          {(["time", "space"] as Measure[]).map((m) => (
            <button
              key={m}
              aria-checked={measure === m}
              className={`h-[24px] rounded-[5px] px-2.5 text-[12px] ${measure === m ? "bg-white/[0.1] text-white" : "text-white/50"}`}
              onClick={() => setMeasure(m)}
              role="radio"
              type="button"
            >
              {m === "time" ? t.time : t.space}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-[12px] text-white/50">
          {t.compareWith}
          <select
            className="h-[26px] rounded-[6px] border border-white/[0.08] bg-[#1B1F22] px-1.5 text-[12px] text-white/80"
            onChange={(event) => setCompareId(event.target.value)}
            value={compareId}
          >
            <option value="">—</option>
            {comparable.map((e) => (
              <option key={e.id} value={e.id}>
                {titleOf(e)}
              </option>
            ))}
          </select>
        </label>
        {running && <span className="text-[12px] text-white/45">{formatMessage(t.progress, { n: samples[samples.length - 1]?.n ?? "…" })}</span>}
      </div>

      {!report && !running && <p className="mt-3 max-w-[64ch] leading-[20px] text-white/50">{t.intro}</p>}

      {report?.issue === "no-input" && <p className="mt-3 text-[#F5A68E]">{t.needsInput}</p>}
      {report?.issue === "error" && (
        <p className="mt-3 text-[#F5A68E]">
          {t.failed} {report.errorMessage}
        </p>
      )}
      {report?.issue === "too-slow" && <p className="mt-3 text-[#E8C47A]">{t.tooSlow}</p>}
      {stale && <p className="mt-3 text-[12px] text-white/45">{t.stale}</p>}

      {chartSamples.length > 0 && (
        <div className="mt-3 flex flex-wrap items-start gap-6">
          <div className="min-w-[280px] flex-1">
            <Chart
              compare={shownCompare?.samples ?? null}
              fitClass={fit?.best ?? null}
              labels={{ n: "n", y: measure === "time" ? t.yTime : t.ySpace }}
              measure={measure}
              samples={chartSamples}
            />
            {shownCompare && (
              <div className="mt-1 flex gap-4 text-[11.5px] text-white/50">
                <span className="flex items-center gap-1.5">
                  <i className="inline-block h-[3px] w-4 rounded bg-[#86F0C4]" /> {t.thisProgram}
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="inline-block h-[3px] w-4 rounded bg-[#E8BE8C]" />
                  {titleOf(comparable.find((e) => e.id === compareId)!)}{" "}
                  {(measure === "time" ? shownCompare.time.best : shownCompare.space.best) ?? ""}
                </span>
              </div>
            )}
          </div>
          {shownReport && (
            <div className={`w-[260px] shrink-0 space-y-3 transition-opacity duration-300 ${report ? "" : "opacity-50"}`}>
              {(["time", "space"] as Measure[]).map((m) => {
                const f = m === "time" ? shownReport.time : shownReport.space;
                return (
                  <div
                    key={m}
                    className={`rounded-[10px] border p-3 transition-colors duration-300 ${
                      measure === m ? "border-[#86F0C4]/40 bg-[#86F0C4]/[0.05]" : "border-white/[0.07]"
                    }`}
                  >
                    <div className="text-[11px] font-semibold tracking-[0.06em] text-white/40 uppercase">{m === "time" ? t.time : t.space}</div>
                    {/* The fitted class settles in with a small pop; a new class replaces the old one in place. */}
                    <div className="relative mt-0.5 h-[30px] font-mono text-[20px] font-semibold text-white">
                      <AnimatePresence initial={true} mode="popLayout">
                        <motion.div
                          key={f.best ?? "none"}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          className="origin-left"
                          exit={{ opacity: 0, scale: 0.9, y: -8, transition: { duration: duration.fast, ease: easeOut } }}
                          initial={{ opacity: 0, scale: 0.82, y: 8 }}
                          transition={spring.bouncy}
                        >
                          {f.best ?? "—"}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                    <div className="text-[11.5px] text-white/45">
                      {f.best ? <Confidence pct={Math.round(f.confidence * 100)} template={t.confidence} /> : t.notEnough}
                    </div>
                    {f.best && <p className="mt-1.5 text-[12px] leading-[17px] text-white/60">{t.explain[f.best] ?? ""}</p>}
                  </div>
                );
              })}
              {theory && (
                <div className="rounded-[10px] border border-white/[0.07] p-3 text-[12px] text-white/60">
                  <div className="mb-1 text-[11px] font-semibold tracking-[0.06em] text-white/40 uppercase">{t.theory}</div>
                  {theory.best && <div>{t.best}: <b className="font-mono text-white/85">{theory.best}</b></div>}
                  {theory.average && <div>{t.average}: <b className="font-mono text-white/85">{theory.average}</b></div>}
                  {theory.worst && <div>{t.worst}: <b className="font-mono text-white/85">{theory.worst}</b></div>}
                  {theory.space && <div>{t.space}: <b className="font-mono text-white/85">{theory.space}</b></div>}
                  <p className="mt-1.5 text-[11.5px] text-white/40">{t.theoryNote}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {samples.length > 0 && (
        <table className="mt-4 w-full max-w-[640px] font-mono text-[12px]">
          <thead>
            <tr className="text-left text-[10.5px] tracking-wide text-white/35 uppercase">
              <th className="py-1 font-sans font-medium">n</th>
              <th className="font-sans font-medium">{t.steps}</th>
              <th className="font-sans font-medium">{t.comparisons}</th>
              <th className="font-sans font-medium">{t.reads}</th>
              <th className="font-sans font-medium">{t.writes}</th>
              <th className="font-sans font-medium">{t.memory}</th>
            </tr>
          </thead>
          <tbody>
            {samples.map((s) => (
              <tr key={s.n} className="border-t border-white/[0.05] text-white/75">
                <td className="py-1">{s.n}</td>
                <td>{s.metrics.steps.toLocaleString()}</td>
                <td>{s.metrics.comparisons.toLocaleString()}</td>
                <td>{s.metrics.arrayReads.toLocaleString()}</td>
                <td>{s.metrics.arrayWrites.toLocaleString()}</td>
                <td>{spaceOf(s.metrics).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
