"use client";

// PROTOTYPE — throwaway building blocks shared by the layout variants.
// Variants own their layout; these are just the panel contents.

import { useEffect, useMemo, useRef, useState } from "react";

import {
  generateExport,
  Parser,
  type EngineSettings,
  type ExportLanguage,
} from "@/src/engine";
import type { DiagramNodeOffset, DiagramViewport } from "@/src/components/ide/types";
import type { Dictionary } from "@/src/i18n/types";
import DiagramView from "../diagram-view";
import { formatValue, type PrototypeRun, type TraceRow } from "./use-prototype-run";

export const protoTokens = {
  bg: "#F6F6F2",
  surface: "#FFFFFF",
  line: "#E5E5DF",
  text: "#1D2420",
  muted: "#6B716C",
  accent: "#1F7A5C",
  accentSoft: "#E4F1EB",
};

export function ProtoStyles() {
  return (
    <style>{`
      .proto-step-line { background: rgba(31,122,92,0.14); box-shadow: inset 3px 0 0 #1F7A5C; }
      .proto-step-glyph { background: #1F7A5C; border-radius: 999px; width: 8px !important; height: 8px !important; margin: 8px 0 0 6px; }
      .proto-link-line { background: rgba(214,160,60,0.16); }
      .proto-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
      .proto-scroll::-webkit-scrollbar-thumb { background: #DADAD3; border-radius: 8px; }
      @keyframes proto-blink { 50% { opacity: 0; } }
      .proto-caret { animation: proto-blink 1s step-end infinite; }
      /* Hide the production diagram toolbar: the variants own their chrome. */
      .proto-diagram .bg-workspace-toolbar-chrome { display: none !important; }
      .proto-diagram { height: 100%; }
      .proto-diagram > * { height: 100%; }
    `}</style>
  );
}

export function Kbd({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <kbd
      className={`rounded-[5px] px-1.5 py-px font-mono text-[11px] ${
        dark ? "bg-white/15 text-white/85" : "border border-[#E1E1DA] bg-[#F7F7F3] text-[#6B716C]"
      }`}
    >
      {children}
    </kbd>
  );
}

/* ---------- Console: the program "talks", the student answers inline ---------- */

export function ConversationConsole({
  run,
  dark,
  emptyHint = "Pulsa Ejecutar para ver tu programa en acción.",
}: {
  run: PrototypeRun;
  dark?: boolean;
  emptyHint?: string;
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
    if (run.mode === "input") inputRef.current?.focus();
  }, [run.lines, run.mode]);

  const text = dark ? "text-[#E8EDEA]" : "text-[#1D2420]";
  const muted = dark ? "text-[#7F8A85]" : "text-[#8A8F89]";

  return (
    <div className={`proto-scroll h-full overflow-auto px-5 py-4 font-mono text-[14px] leading-7 ${text}`}>
      {run.lines.length === 0 && run.mode === "idle" && <p className={`font-sans text-sm ${muted}`}>{emptyHint}</p>}
      {run.lines.map((line, index) => {
        if (line.kind === "in") {
          return (
            <div key={index} className="flex justify-end">
              <span className="my-0.5 rounded-full bg-[#1F7A5C] px-3 py-0.5 text-white">{line.text}</span>
            </div>
          );
        }
        if (line.kind === "sys") {
          return (
            <div key={index} className={`mt-2 font-sans text-xs ${muted}`}>
              — {line.text} —
            </div>
          );
        }
        if (line.kind === "err") {
          return (
            <div key={index} className="mt-2 rounded-lg bg-[#FDECE7] px-3 py-2 font-sans text-[13px] text-[#9A3412]">
              {line.text}
            </div>
          );
        }
        return (
          <div key={index} className="whitespace-pre-wrap">
            {line.text || " "}
          </div>
        );
      })}
      {run.mode === "input" && (
        <form
          className="mt-1 flex justify-end"
          onSubmit={(event) => {
            event.preventDefault();
            run.submitInput(draft);
            setDraft("");
          }}
        >
          <div className="flex items-center gap-2 rounded-full border-2 border-[#1F7A5C] bg-white px-3 py-0.5 shadow-[0_0_0_4px_rgba(31,122,92,0.12)]">
            <input
              ref={inputRef}
              className="w-40 bg-transparent font-mono text-[#1D2420] outline-none placeholder:text-[#A3A8A2]"
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Escribe y pulsa Enter"
              value={draft}
            />
            <span className="text-xs text-[#1F7A5C]">↵</span>
          </div>
        </form>
      )}
      {run.mode === "running" && <span className={`proto-caret ${muted}`}>▍</span>}
      <div ref={endRef} />
    </div>
  );
}

/* ---------- Variables ---------- */

export function VariablesList({ run, dark }: { run: PrototypeRun; dark?: boolean }) {
  const muted = dark ? "text-[#7F8A85]" : "text-[#8A8F89]";
  if (run.variables.length === 0) {
    return (
      <p className={`px-5 py-4 text-sm ${muted}`}>
        Las variables aparecerán aquí mientras tu programa se ejecuta. Usa <b>Paso a paso</b> para verlas cambiar.
      </p>
    );
  }
  return (
    <div className="proto-scroll h-full overflow-auto px-3 py-2">
      {run.variables.map((variable) => (
        <div
          key={variable.name}
          className={`flex items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 ${dark ? "hover:bg-white/5" : "hover:bg-[#F4F4EF]"}`}
        >
          <span className="font-mono text-[14px] font-medium">{variable.name}</span>
          <span className={`flex-1 truncate text-right text-[11px] uppercase tracking-wide ${muted}`}>
            {variable.dataType ?? ""}
          </span>
          <span className="min-w-[64px] text-right font-mono text-[14px]">
            {variable.initialized ? formatValue(variable.value) : <span className={muted}>sin valor</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Prueba de escritorio: one row per step ---------- */

export function DeskCheckTable({
  trace,
  dark,
  onPickLine,
}: {
  trace: TraceRow[];
  dark?: boolean;
  onPickLine?: (line: number) => void;
}) {
  const names = useMemo(() => {
    const seen: string[] = [];
    for (const row of trace) for (const v of row.variables) if (!seen.includes(v.name)) seen.push(v.name);
    return seen;
  }, [trace]);
  const endRef = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [trace.length]);
  const muted = dark ? "text-[#7F8A85]" : "text-[#8A8F89]";
  const border = dark ? "border-white/10" : "border-[#ECECE6]";

  if (trace.length === 0) {
    return (
      <p className={`px-5 py-4 text-sm ${muted}`}>
        La <b>prueba de escritorio</b> se llena sola: pulsa <b>Paso a paso</b> y cada fila mostrará el valor de tus
        variables en ese momento.
      </p>
    );
  }

  return (
    <div className="proto-scroll h-full overflow-auto">
      <table className="w-full border-collapse font-mono text-[13px]">
        <thead className={`sticky top-0 ${dark ? "bg-[#14181A]" : "bg-white"}`}>
          <tr className={`border-b ${border} text-left`}>
            <th className={`px-3 py-2 font-sans text-[11px] font-medium uppercase tracking-wide ${muted}`}>Paso</th>
            <th className={`px-3 py-2 font-sans text-[11px] font-medium uppercase tracking-wide ${muted}`}>Línea</th>
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
            return (
              <tr
                key={row.step}
                ref={last ? endRef : undefined}
                className={`cursor-pointer border-b ${border} ${last ? (dark ? "bg-[#1F7A5C]/25" : "bg-[#E4F1EB]") : ""}`}
                onClick={() => onPickLine?.(row.line)}
              >
                <td className={`px-3 py-1.5 ${muted}`}>{index + 1}</td>
                <td className={`px-3 py-1.5 ${muted}`}>{row.line}</td>
                {names.map((name) => {
                  const variable = row.variables.find((v) => v.name === name);
                  const before = previous?.variables.find((v) => v.name === name);
                  const value = variable?.initialized ? formatValue(variable.value) : "";
                  const changed =
                    variable?.initialized && JSON.stringify(variable.value) !== JSON.stringify(before?.value);
                  return (
                    <td key={name} className={`px-3 py-1.5 ${changed ? "font-semibold text-[#1F7A5C]" : ""}`}>
                      {value}
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

/* ---------- Ver en C / C++ / JavaScript ---------- */

const languageLabels: Record<string, string> = { c: "C", cpp: "C++", javascript: "JavaScript" };

export function TranslationView({
  source,
  settings,
  dark,
}: {
  source: string;
  settings: EngineSettings;
  dark?: boolean;
}) {
  const [language, setLanguage] = useState<ExportLanguage>("c" as ExportLanguage);
  const [copied, setCopied] = useState(false);
  const code = useMemo(() => {
    const parsed = new Parser(source, { settings }).parse();
    if (!parsed.program) return null;
    return generateExport(parsed.program, language, { settings }).code;
  }, [language, settings, source]);

  return (
    <div className="flex h-full flex-col">
      <div className={`flex items-center gap-1 border-b px-3 py-2 ${dark ? "border-white/10" : "border-[#ECECE6]"}`}>
        {(["c", "cpp", "javascript"] as ExportLanguage[]).map((id) => (
          <button
            key={id}
            className={`rounded-md px-2.5 py-1 text-[13px] ${
              language === id
                ? dark
                  ? "bg-white/10 font-medium"
                  : "bg-[#1D2420] font-medium text-white"
                : dark
                  ? "text-[#9AA5A0] hover:bg-white/5"
                  : "text-[#6B716C] hover:bg-[#F1F1EC]"
            }`}
            onClick={() => setLanguage(id)}
            type="button"
          >
            {languageLabels[id]}
          </button>
        ))}
        <div className="flex-1" />
        <button
          className={`rounded-md px-2.5 py-1 text-[13px] ${dark ? "text-[#9AA5A0] hover:bg-white/5" : "text-[#6B716C] hover:bg-[#F1F1EC]"}`}
          onClick={() => {
            if (code) void navigator.clipboard?.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          type="button"
        >
          {copied ? "¡Copiado!" : "Copiar"}
        </button>
      </div>
      <pre
        className={`proto-scroll flex-1 overflow-auto px-5 py-4 font-mono text-[13px] leading-6 ${dark ? "text-[#DDE4E0]" : "text-[#2B332F]"}`}
      >
        {code ?? "Corrige los errores para ver la traducción."}
      </pre>
    </div>
  );
}

/* ---------- Diagram: wraps the real flowchart with local view state ---------- */

export function DiagramPane({
  dictionary,
  source,
  settings,
  onRevealLine,
}: {
  dictionary: Dictionary;
  source: string;
  settings: EngineSettings;
  onRevealLine?: (line: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [offsets, setOffsets] = useState<Record<string, DiagramNodeOffset>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [viewport, setViewport] = useState<DiagramViewport | null>(null);
  const [routine, setRoutine] = useState<string | null>(null);
  const diagnostics = useMemo(() => new Parser(source, { settings }).parse().diagnostics, [settings, source]);

  return (
    <div className="proto-diagram">
    <DiagramView
      dictionary={dictionary}
      isExpanded={expanded}
      nodeOffsets={offsets}
      onExpandedChange={setExpanded}
      onNodeOffsetChange={(id, offset) => setOffsets((current) => ({ ...current, [id]: offset }))}
      onResetLayout={() => setOffsets({})}
      onRevealSource={(span) => onRevealLine?.(span.start.line)}
      onRoutineChange={setRoutine}
      onSelectedNodeChange={setSelected}
      onViewportChange={setViewport}
      selectedNodeId={selected}
      settings={settings}
      source={source}
      viewport={viewport}
      visibleDiagnostics={diagnostics}
      visibleRoutineId={routine}
    />
    </div>
  );
}
