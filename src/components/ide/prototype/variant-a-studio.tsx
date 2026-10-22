"use client";

// PROTOTYPE — Variant A "Estudio": code is the hero. One top bar, full-height
// editor, a single tabbed side panel, and a status bar that becomes the
// debugger controls while stepping.

import { useEffect, useState } from "react";

import PrototypeEditor from "./prototype-editor";
import {
  ConversationConsole,
  DeskCheckTable,
  DiagramPane,
  Kbd,
  TranslationView,
  VariablesList,
} from "./prototype-parts";
import { ProfileChip, useRunShortcuts, type VariantProps } from "./prototype-root";

type Panel = "consola" | "variables" | "prueba" | "diagrama" | "traduccion";

const panels: { id: Panel; label: string }[] = [
  { id: "consola", label: "Consola" },
  { id: "variables", label: "Variables" },
  { id: "prueba", label: "Prueba de escritorio" },
  { id: "diagrama", label: "Diagrama" },
  { id: "traduccion", label: "Ver en C" },
];

export default function VariantA({ dictionary, source, setSource, settings, profileId, setProfileId, run }: VariantProps) {
  const [panel, setPanel] = useState<Panel>("consola");
  const [cursorLine, setCursorLine] = useState(1);
  const [linkLine, setLinkLine] = useState<number | null>(null);
  useRunShortcuts(run);

  const diagnostics = run.runtimeError ? [...run.parseDiagnostics, run.runtimeError] : run.parseDiagnostics;
  const errorCount = run.parseDiagnostics.filter((d) => d.severity === "error").length;
  const stepping = run.mode === "paused" || (run.active && run.trace.length > 0);

  // Running jumps to the console; stepping shows the desk-check alongside.
  useEffect(() => {
    if (run.mode === "running" && run.trace.length === 0) setPanel("consola");
  }, [run.mode, run.trace.length]);

  return (
    <div className="flex h-screen flex-col bg-[#F6F6F2] text-[#1D2420]">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[#E5E5DF] bg-white px-4">
        <div className="flex items-center gap-2 pr-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#1D2420] text-[13px] font-bold text-white">C</div>
          <span className="text-[15px] font-semibold tracking-tight">Codoritmo</span>
        </div>
        <div className="h-5 w-px bg-[#E5E5DF]" />
        <div className="flex items-center gap-1">
          <button className="flex items-center gap-2 rounded-lg bg-[#F1F1EC] px-3 py-1.5 text-[13px] font-medium" type="button">
            Promedio.psc
            <span className="h-1.5 w-1.5 rounded-full bg-[#C9A23A]" title="Sin guardar" />
          </button>
          <button className="rounded-lg px-2.5 py-1.5 text-[13px] text-[#8A8F89] hover:bg-[#F1F1EC]" type="button">
            Tarea 2.psc
          </button>
          <button className="rounded-lg px-2 py-1.5 text-[15px] text-[#8A8F89] hover:bg-[#F1F1EC]" title="Nuevo" type="button">
            +
          </button>
        </div>
        <div className="flex-1" />
        <button className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] text-[#6B716C] hover:bg-[#F1F1EC]" type="button">
          Buscar o insertar… <Kbd>⌘K</Kbd>
        </button>
        <ProfileChip profileId={profileId} setProfileId={setProfileId} />
        {!run.active && (
          <button
            className="rounded-lg border border-[#E1E1DA] bg-white px-3 py-2 text-[13px] font-medium hover:bg-[#F7F7F3]"
            onClick={() => {
              setPanel("prueba");
              void run.debug();
            }}
            type="button"
          >
            Paso a paso
          </button>
        )}
        {run.active ? (
          <button
            className="flex items-center gap-2 rounded-lg bg-[#B4432B] px-4 py-2 text-[14px] font-semibold text-white shadow-sm hover:bg-[#9E3A25]"
            onClick={run.stop}
            type="button"
          >
            <span className="h-2.5 w-2.5 rounded-[2px] bg-white" /> Detener <Kbd dark>Esc</Kbd>
          </button>
        ) : (
          <button
            className="flex items-center gap-2 rounded-lg bg-[#1F7A5C] px-4 py-2 text-[14px] font-semibold text-white shadow-sm hover:bg-[#19674D]"
            onClick={() => void run.run()}
            type="button"
          >
            ▶ Ejecutar <Kbd dark>⌘↵</Kbd>
          </button>
        )}
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 bg-white">
          <PrototypeEditor
            currentLine={run.currentLine}
            diagnostics={diagnostics}
            highlightLine={linkLine}
            onChange={setSource}
            onCursorLine={setCursorLine}
            readOnly={run.active}
            value={source}
          />
        </main>
        <aside className="flex w-[440px] shrink-0 flex-col border-l border-[#E5E5DF] bg-white">
          <nav className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-[#ECECE6] px-2 pt-2">
            {panels.map((item) => (
              <button
                key={item.id}
                className={`relative whitespace-nowrap rounded-t-md px-3 pt-1.5 pb-2.5 text-[13px] ${
                  panel === item.id ? "font-semibold text-[#1D2420]" : "text-[#8A8F89] hover:text-[#3C4641]"
                }`}
                onClick={() => setPanel(item.id)}
                type="button"
              >
                {item.label}
                {item.id === "consola" && run.mode === "input" && (
                  <span className="ml-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#1F7A5C]" />
                )}
                {panel === item.id && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#1F7A5C]" />}
              </button>
            ))}
          </nav>
          <div className="min-h-0 flex-1">
            {panel === "consola" && <ConversationConsole run={run} />}
            {panel === "variables" && <VariablesList run={run} />}
            {panel === "prueba" && (
              <div className="flex h-full flex-col">
                <div className="min-h-0 flex-1">
                  <DeskCheckTable onPickLine={setLinkLine} trace={run.trace} />
                </div>
                {run.lines.length > 0 && (
                  <div className="h-[38%] shrink-0 border-t border-[#ECECE6]">
                    <ConversationConsole run={run} />
                  </div>
                )}
              </div>
            )}
            {panel === "diagrama" && (
              <DiagramPane dictionary={dictionary} onRevealLine={setLinkLine} settings={settings} source={source} />
            )}
            {panel === "traduccion" && <TranslationView settings={settings} source={source} />}
          </div>
        </aside>
      </div>

      {/* Status bar = debugger while stepping */}
      <footer
        className={`flex h-9 shrink-0 items-center gap-4 border-t px-4 text-[12px] ${
          stepping ? "border-[#1F7A5C] bg-[#1F7A5C] text-white" : "border-[#E5E5DF] bg-[#FAFAF7] text-[#6B716C]"
        }`}
      >
        {stepping ? (
          <>
            <span className="font-semibold">Paso a paso</span>
            <button className="rounded px-2 py-0.5 hover:bg-white/15" onClick={run.step} type="button">
              ⤵ Siguiente <Kbd dark>F10</Kbd>
            </button>
            <button className="rounded px-2 py-0.5 hover:bg-white/15" onClick={run.resume} type="button">
              ▶ Continuar
            </button>
            <button className="rounded px-2 py-0.5 hover:bg-white/15" onClick={run.stop} type="button">
              ■ Detener
            </button>
            <span className="opacity-80">
              {run.mode === "input" ? "Esperando tu respuesta en la consola" : `Detenido en la línea ${run.currentLine ?? "—"}`}
            </span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${errorCount ? "bg-[#C2410C]" : "bg-[#1F7A5C]"}`} />
              {errorCount ? `${errorCount} error${errorCount > 1 ? "es" : ""}` : "Sin errores"}
            </span>
            <span>
              {run.mode === "done" ? "Última ejecución: correcta" : run.mode === "error" ? "Última ejecución: con error" : ""}
            </span>
          </>
        )}
        <div className="flex-1" />
        <span>Arreglos desde 1</span>
        <span>Ln {cursorLine}</span>
      </footer>
    </div>
  );
}
