"use client";

// Panel contents for the workspace: console, desk check, and code translation.

import { Check, Copy, CornerDownLeft, RotateCcw } from "lucide-react";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { generateExport, Parser, type EngineSettings, type ExportLanguage } from "@/src/engine";
import type { Diagnostic, VariableSnapshot } from "@/src/engine/types";
import { formatDiagnostic } from "@/src/i18n/diagnostics";
import { formatPlural } from "@/src/i18n/format";
import type { Dictionary } from "@/src/i18n/types";
import { duration, easeOut, spring } from "@/src/lib/motion";
import consoleMotion from "./motion/console-motion.module.css";
import { useFreshFrom } from "./motion/panel-fresh";
import panelMotion from "./motion/panel-motion.module.css";
import type { Player } from "./use-player";

export function formatValue(value: VariableSnapshot["value"]): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "VERDADERO" : "FALSO";
  if (typeof value === "string") return `"${value}"`;
  if (Array.isArray(value)) return `[${value.map(formatValue).join(", ")}]`;
  return String(value);
}

/* ---------------- Console ---------------- */

/** "Línea 3: División por cero." in the dictionary's language. */
function runtimeErrorText(diagnostic: Diagnostic, dictionary: Dictionary): string {
  const prefix = dictionary.studio.line.replace("{n}", String(diagnostic.line));
  return `${prefix[0].toUpperCase()}${prefix.slice(1)}: ${formatDiagnostic(diagnostic, dictionary)}`;
}

/** Where the typed answer was on screen when Enter was pressed, so its echo can fly from there. */
interface AnswerFlight {
  text: string;
  /** Console length at submit time: the echo is the first "in" line at or after it. */
  after: number;
  /** Where the typed text started and its top edge, in viewport pixels. */
  left: number;
  top: number;
}

/** The echoed answer: settles into the console from where it was typed. */
function EchoLine({ text, flight, fresh }: { text: string; flight: AnswerFlight | null; fresh: boolean }) {
  const [scope, animate] = useAnimate<HTMLSpanElement>();
  const reduceMotion = useReducedMotion();
  useLayoutEffect(() => {
    if (!flight || !scope.current) return;
    const rect = scope.current.getBoundingClientRect();
    // Line the echoed text up with where it was typed.
    const dx = flight.left - rect.left;
    const dy = flight.top - rect.top;
    if (reduceMotion || (Math.abs(dx) < 1 && Math.abs(dy) < 1)) return;
    const controls = animate(scope.current, { x: [dx, 0], y: [dy, 0], scale: [1.06, 1] }, spring.smooth);
    return () => controls.stop();
    // Fly once, when the echo first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    // Your answer sits where you typed it, under the question, like a terminal.
    <div className={`flex items-baseline gap-2 ${fresh && !flight ? consoleMotion.lineEnter : ""}`}>
      <span aria-hidden className="text-[#86F0C4]/70">›</span>
      <span ref={scope} className="inline-block text-[#A9F5D5]">
        {text || " "}
      </span>
    </div>
  );
}

/** The end of a run: a clear, kind confirmation with a way to go again. */
function FinishedCard({
  fresh,
  onRun,
  steps,
  t,
}: {
  fresh: boolean;
  onRun?: () => void;
  steps: number;
  t: Dictionary["studio"];
}) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="mt-3 flex w-fit max-w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-[12px] bg-[#7FE0B8]/[0.08] py-2 pr-2 pl-3 font-sans ring-1 ring-[#7FE0B8]/20"
      initial={fresh ? { opacity: 0, y: 8, scale: 0.97 } : false}
      transition={spring.bouncy}
    >
      <motion.span
        animate={{ scale: 1, rotate: 0 }}
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#7FE0B8] text-[#0B2A20]"
        initial={fresh ? { scale: 0, rotate: -45 } : false}
        transition={{ ...spring.bouncy, delay: 0.08 }}
      >
        <Check size={14} strokeWidth={3} />
      </motion.span>
      <span className="text-[13.5px] leading-5">
        <span className="font-medium text-white/90">{t.finishedTitle}</span>
        <span className="ml-2 text-white/45">{formatPlural(t.stepsRun, steps)}</span>
      </span>
      {onRun && (
        <button
          className="flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] whitespace-nowrap text-[#A9F0D2] transition-colors hover:bg-white/[0.06]"
          onClick={onRun}
          type="button"
        >
          <RotateCcw size={12} /> {t.runAgain}
        </button>
      )}
    </motion.div>
  );
}

export function ConsolePanel({
  player,
  dictionary,
  onRun,
}: {
  player: Player;
  dictionary: Dictionary;
  /** Starts the program from the empty console's invitation. */
  onRun?: () => void;
}) {
  const t = dictionary.studio;
  const [draft, setDraft] = useState("");
  const [flight, setFlight] = useState<AnswerFlight | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const asking = player.status === "input" && !player.scrubbing;
  const lines = player.consoleLines;
  const freshFrom = useFreshFrom(lines.length);
  const echoIndex = flight ? lines.findIndex((line, index) => index >= flight.after && line.kind === "in") : -1;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
    if (asking) inputRef.current?.focus();
  }, [lines.length, asking]);

  return (
    <div className="workspace-scroll relative h-full overflow-auto px-5 py-4 font-mono text-[14px] leading-7 text-[#DCE3E0]">
      {lines.length === 0 && !asking && (
        <div className="font-sans">
          <p className="text-[14px] text-white/75">{t.consoleInvite}</p>
          <p className="mt-0.5 text-[13px] text-white/40">{t.consoleEmpty}</p>
        </div>
      )}
      {lines.map((line, index) => {
        const fresh = index >= freshFrom;
        return line.kind === "in" ? (
          <EchoLine key={index} flight={index === echoIndex ? flight : null} fresh={fresh} text={line.text} />
        ) : line.kind === "sys" && line.text === t.endOfProgram ? (
          <FinishedCard key={index} fresh={fresh} onRun={onRun} steps={player.frameCount} t={t} />
        ) : line.kind === "sys" ? (
          <div key={index} className={`mt-1 font-sans text-[12px] text-[#5E6A66] ${fresh ? consoleMotion.lineEnter : ""}`}>
            {line.text}
          </div>
        ) : line.kind === "err" ? (
          <div
            key={index}
            className={`mt-2 rounded-lg bg-[#F08A6C]/10 px-3 py-2 font-sans text-[13px] text-[#F5A68E] ${consoleMotion.error} ${
              fresh ? `${consoleMotion.lineEnter} ${consoleMotion.errorEnter}` : ""
            }`}
          >
            {line.diagnostic ? runtimeErrorText(line.diagnostic, dictionary) : line.text}
          </div>
        ) : (
          <div key={index} className={`whitespace-pre-wrap ${fresh ? consoleMotion.lineEnter : ""}`}>
            {line.text || " "}
          </div>
        );
      })}
      <AnimatePresence initial={false} mode="popLayout">
        {asking && (
          <motion.form
            key="answer"
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="flex origin-left items-center gap-2"
            exit={{ opacity: 0, scale: 0.97, transition: { duration: duration.fast, ease: easeOut } }}
            initial={{ opacity: 0, y: 10, scale: 0.94 }}
            onSubmit={(event) => {
              event.preventDefault();
              const box = inputRef.current?.getBoundingClientRect();
              if (box) setFlight({ text: draft, after: lines.length, left: box.left, top: box.top });
              player.submitInput(draft);
              setDraft("");
            }}
            transition={spring.bouncy}
          >
            <span aria-hidden className="text-[#86F0C4]">›</span>
            <div
              className={`flex min-w-0 flex-1 items-center gap-2 rounded-[8px] bg-[#86F0C4]/[0.06] px-2 sm:max-w-[360px] ${consoleMotion.waiting}`}
            >
              <input
                ref={inputRef}
                aria-label={t.inputPlaceholder}
                className="min-w-0 flex-1 bg-transparent font-mono text-[#EEF3F0] caret-[#86F0C4] outline-none placeholder:text-[#5E8A78]"
                onChange={(event) => setDraft(event.target.value)}
                placeholder={t.inputPlaceholder}
                value={draft}
              />
              <CornerDownLeft className="shrink-0 text-[#86F0C4]/70" size={13} />
            </div>
          </motion.form>
        )}
      </AnimatePresence>
      <div ref={endRef} />
    </div>
  );
}

/* ---------------- Prueba de escritorio ---------------- */

export interface TraceRow {
  step: number;
  line: number;
  variables: VariableSnapshot[];
}

export function DeskCheckPanel({
  trace,
  dictionary,
  onPickStep,
}: {
  trace: TraceRow[];
  dictionary: Dictionary;
  onPickStep?: (step: number) => void;
}) {
  const t = dictionary.studio;
  const names = useMemo(() => {
    const seen: string[] = [];
    for (const row of trace) for (const v of row.variables) if (!seen.includes(v.name)) seen.push(v.name);
    return seen;
  }, [trace]);
  const endRef = useRef<HTMLTableRowElement>(null);
  const freshFrom = useFreshFrom(trace.length);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [trace.length]);

  if (trace.length === 0) return <p className="px-5 py-4 text-[13px] text-[#5E6A66]">{t.deskCheckEmpty}</p>;

  return (
    <div className="workspace-scroll h-full overflow-auto">
      <table className="w-full border-collapse font-mono text-[13px] text-[#DCE3E0]">
        <thead className="sticky top-0 bg-[#141719]">
          <tr className="border-b border-white/10 text-left">
            <th className="px-3 py-2 font-sans text-[11px] font-medium tracking-wide text-white/40 uppercase">{t.stepColumn}</th>
            <th className="px-3 py-2 font-sans text-[11px] font-medium tracking-wide text-white/40 uppercase">{t.lineColumn}</th>
            {names.map((name) => (
              <th key={name} className="px-3 py-2 font-semibold">
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trace.map((row, index) => {
            const previous = trace[index - 1];
            const last = index === trace.length - 1;
            const fresh = index >= freshFrom && index > 0;
            return (
              <tr
                key={row.step}
                ref={last ? endRef : undefined}
                className={`cursor-default border-b border-white/[0.06] transition-colors duration-300 ${last ? "bg-[#1F7A5C]/25" : "hover:bg-white/[0.03]"} ${
                  fresh ? panelMotion.rowEnter : ""
                }`}
                onClick={() => onPickStep?.(row.step)}
              >
                <td className="px-3 py-1.5 text-white/40">{row.step + 1}</td>
                <td className="px-3 py-1.5 text-white/40">{row.line}</td>
                {names.map((name) => {
                  const variable = row.variables.find((v) => v.name === name);
                  const before = previous?.variables.find((v) => v.name === name);
                  const changed = variable?.initialized && JSON.stringify(variable.value) !== JSON.stringify(before?.value);
                  const text = variable?.initialized ? formatValue(variable.value) : "";
                  // A freshly written value rolls in like an odometer, pushing the old one up and out.
                  const roll = changed && fresh;
                  return (
                    <td key={name} className={`px-3 py-1.5 ${changed ? "font-semibold text-[#86F0C4]" : ""}`}>
                      {roll ? (
                        <span className={panelMotion.glow}>
                          <span className={panelMotion.roll} data-old={before?.initialized ? formatValue(before.value) : ""}>
                            <span className={`font-semibold text-[#86F0C4] ${panelMotion.rollValue}`}>{text}</span>
                          </span>
                        </span>
                      ) : (
                        text
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Translation to a real language ---------------- */

export function TranslationPanel({
  source,
  settings,
  language,
  dictionary,
}: {
  source: string;
  settings: EngineSettings;
  language: ExportLanguage;
  dictionary: Dictionary;
}) {
  const t = dictionary.studio;
  const [copied, setCopied] = useState(false);
  const code = useMemo(() => {
    const parsed = new Parser(source, { settings }).parse();
    return parsed.program ? generateExport(parsed.program, language, { settings }).code : null;
  }, [language, settings, source]);

  return (
    <div className="relative h-full">
      <button
        className="absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 text-[12px] text-[#B5C0BB] hover:bg-white/10"
        onClick={async () => {
          if (!code) return;
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          } catch {
            // Clipboard can be blocked (permissions, unfocused document); selection still works.
          }
        }}
        type="button"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? t.copied : t.copy}
      </button>
      <pre className="workspace-scroll h-full overflow-auto px-6 py-5 font-mono text-[13px] leading-6 text-[#CFD8D4] select-text">
        {code ?? t.translationNeedsFix}
      </pre>
    </div>
  );
}
