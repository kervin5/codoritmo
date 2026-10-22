"use client";

// Measures how a program's work grows with n and names its complexity.
// Every Leer gets n; the chart shows statements executed (time) or memory
// cells used (space), the fitted curve, and optionally a second algorithm
// for comparison. Theory from the example library is shown when known.

import { Gauge, Square } from "lucide-react";
import { useMemo, useRef, useState } from "react";

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

type Measure = "time" | "space";

const theoryOf = (example: ExampleProgram | undefined) => example?.complexity;

const COLORS = { main: "#86F0C4", fit: "#86F0C4", compare: "#E8BE8C" };

function Chart({
  samples,
  compare,
  measure,
  fitClass,
  labels,
}: {
  samples: ComplexitySample[];
  compare: ComplexitySample[] | null;
  measure: Measure;
  fitClass: string | null;
  labels: { n: string; y: string };
}) {
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

  // Fitted curve scaled through the last measured point.
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
  return (
    <svg className="w-full max-w-[640px]" role="img" viewBox={`0 0 ${W} ${H}`}>
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
      {fitPath && <path d={fitPath} fill="none" stroke={COLORS.fit} strokeDasharray="4 4" strokeOpacity="0.45" strokeWidth="1.5" />}
      {compare && compare.length > 0 && (
        <>
          <path d={path(compare)} fill="none" stroke={COLORS.compare} strokeWidth="2" />
          {compare.map((s) => (
            <circle key={`c${s.n}`} cx={x(s.n)} cy={y(value(s.metrics))} fill={COLORS.compare} r="3" />
          ))}
        </>
      )}
      <path d={path(samples)} fill="none" stroke={COLORS.main} strokeWidth="2" />
      {samples.map((s) => (
        <circle key={s.n} cx={x(s.n)} cy={y(value(s.metrics))} fill={COLORS.main} r="3" />
      ))}
    </svg>
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

  const comparable = useMemo(() => examplePrograms.filter((e) => theoryOf(e)), []);
  const theory = theoryOf(examplePrograms.find((e) => e.id === exampleId));
  const stale = report !== null && measuredSource !== source;

  const run = async () => {
    stopRef.current = false;
    setRunning(true);
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
  const fit = report ? (measure === "time" ? report.time : report.space) : null;
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

      {samples.length > 0 && (
        <div className="mt-3 flex flex-wrap items-start gap-6">
          <div className="min-w-[280px] flex-1">
            <Chart
              compare={compareReport?.samples ?? null}
              fitClass={fit?.best ?? null}
              labels={{ n: "n", y: measure === "time" ? t.yTime : t.ySpace }}
              measure={measure}
              samples={samples}
            />
            {compareReport && (
              <div className="mt-1 flex gap-4 text-[11.5px] text-white/50">
                <span className="flex items-center gap-1.5">
                  <i className="inline-block h-[3px] w-4 rounded bg-[#86F0C4]" /> {t.thisProgram}
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="inline-block h-[3px] w-4 rounded bg-[#E8BE8C]" />
                  {titleOf(comparable.find((e) => e.id === compareId)!)}{" "}
                  {(measure === "time" ? compareReport.time.best : compareReport.space.best) ?? ""}
                </span>
              </div>
            )}
          </div>
          {report && (
            <div className="w-[260px] shrink-0 space-y-3">
              {(["time", "space"] as Measure[]).map((m) => {
                const f = m === "time" ? report.time : report.space;
                return (
                  <div key={m} className={`rounded-[10px] border p-3 ${measure === m ? "border-[#86F0C4]/40 bg-[#86F0C4]/[0.05]" : "border-white/[0.07]"}`}>
                    <div className="text-[11px] font-semibold tracking-[0.06em] text-white/40 uppercase">{m === "time" ? t.time : t.space}</div>
                    <div className="mt-0.5 font-mono text-[20px] font-semibold text-white">{f.best ?? "—"}</div>
                    <div className="text-[11.5px] text-white/45">
                      {f.best ? formatMessage(t.confidence, { pct: Math.round(f.confidence * 100) }) : t.notEnough}
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
