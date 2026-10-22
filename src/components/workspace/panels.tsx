"use client";

// Panel contents for the workspace: console, desk check, and code translation.

import { Check, Copy, CornerDownLeft } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { generateExport, Parser, type EngineSettings, type ExportLanguage } from "@/src/engine";
import type { VariableSnapshot } from "@/src/engine/types";
import type { Dictionary } from "@/src/i18n/types";
import type { Player } from "./use-player";

export function formatValue(value: VariableSnapshot["value"]): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "VERDADERO" : "FALSO";
  if (typeof value === "string") return `"${value}"`;
  if (Array.isArray(value)) return `[${value.map(formatValue).join(", ")}]`;
  return String(value);
}

/* ---------------- Console ---------------- */

export function ConsolePanel({ player, dictionary }: { player: Player; dictionary: Dictionary }) {
  const t = dictionary.studio;
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const asking = player.status === "input" && !player.scrubbing;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
    if (asking) inputRef.current?.focus();
  }, [player.consoleLines.length, asking]);

  return (
    <div className="workspace-scroll h-full overflow-auto px-5 py-4 font-mono text-[14px] leading-7 text-[#DCE3E0]">
      {player.consoleLines.length === 0 && !asking && <p className="font-sans text-[13px] text-[#5E6A66]">{t.consoleEmpty}</p>}
      {player.consoleLines.map((line, index) =>
        line.kind === "in" ? (
          <div key={index} className="flex justify-end">
            <span className="my-0.5 rounded-full bg-[#86F0C4]/15 px-3 text-[#A9F5D5]">{line.text}</span>
          </div>
        ) : line.kind === "sys" ? (
          <div key={index} className="mt-1 font-sans text-[12px] text-[#5E6A66]">
            {line.text}
          </div>
        ) : line.kind === "err" ? (
          <div key={index} className="mt-2 rounded-lg bg-[#F08A6C]/10 px-3 py-2 font-sans text-[13px] text-[#F5A68E]">
            {line.text}
          </div>
        ) : (
          <div key={index} className="whitespace-pre-wrap">
            {line.text || " "}
          </div>
        )
      )}
      {asking && (
        <form
          className="mt-1 flex justify-end"
          onSubmit={(event) => {
            event.preventDefault();
            player.submitInput(draft);
            setDraft("");
          }}
        >
          <div className="flex items-center gap-2 rounded-full bg-[#86F0C4]/10 px-3 py-0.5 shadow-[0_0_24px_rgba(134,240,196,0.18)] ring-1 ring-[#86F0C4]/60">
            <input
              ref={inputRef}
              aria-label={t.inputPlaceholder}
              className="w-44 bg-transparent font-mono text-[#EEF3F0] outline-none placeholder:text-[#5E8A78]"
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t.inputPlaceholder}
              value={draft}
            />
            <CornerDownLeft className="text-[#86F0C4]" size={13} />
          </div>
        </form>
      )}
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
            return (
              <tr
                key={row.step}
                ref={last ? endRef : undefined}
                className={`cursor-default border-b border-white/[0.06] ${last ? "bg-[#1F7A5C]/25" : "hover:bg-white/[0.03]"}`}
                onClick={() => onPickStep?.(row.step)}
              >
                <td className="px-3 py-1.5 text-white/40">{row.step + 1}</td>
                <td className="px-3 py-1.5 text-white/40">{row.line}</td>
                {names.map((name) => {
                  const variable = row.variables.find((v) => v.name === name);
                  const before = previous?.variables.find((v) => v.name === name);
                  const changed = variable?.initialized && JSON.stringify(variable.value) !== JSON.stringify(before?.value);
                  return (
                    <td key={name} className={`px-3 py-1.5 ${changed ? "font-semibold text-[#86F0C4]" : ""}`}>
                      {variable?.initialized ? formatValue(variable.value) : ""}
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
