"use client";

// PROTOTYPE — Variant B "Cuaderno": a single calm column that reads like a
// lesson. Title → code → run → conversation → desk-check, top to bottom.
// No side panels; insertion is a row of friendly chips, views swap in place.

import { useState } from "react";

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

type View = "codigo" | "diagrama" | "c";

const inserts: { label: string; hint: string; text: string }[] = [
  { label: "Escribir", hint: "mostrar un mensaje", text: 'Escribir "Hola"' },
  { label: "Leer", hint: "pedir un dato", text: "Leer x" },
  { label: "Si", hint: "decidir", text: "Si x > 0 Entonces\n\t\nFinSi" },
  { label: "Para", hint: "repetir n veces", text: "Para i <- 1 Hasta 10 Hacer\n\t\nFinPara" },
  { label: "Mientras", hint: "repetir mientras…", text: "Mientras x > 0 Hacer\n\t\nFinMientras" },
  { label: "Definir", hint: "crear variable", text: "Definir x Como Entero" },
];

export default function VariantB({ dictionary, source, setSource, settings, profileId, setProfileId, run }: VariantProps) {
  const [view, setView] = useState<View>("codigo");
  const [linkLine, setLinkLine] = useState<number | null>(null);
  useRunShortcuts(run);

  const lineCount = source.split("\n").length;
  const diagnostics = run.runtimeError ? [...run.parseDiagnostics, run.runtimeError] : run.parseDiagnostics;
  const firstError = run.parseDiagnostics.find((d) => d.severity === "error");
  const stepping = run.trace.length > 0 && run.active;
  const title = /^\s*(?:Algoritmo|Proceso)\s+(\S+)/im.exec(source)?.[1] ?? "Sin título";

  return (
    <div className="min-h-screen bg-[#F6F6F2] pb-32 text-[#1D2420]">
      {/* Quiet header */}
      <header className="sticky top-0 z-30 border-b border-[#E9E9E3] bg-[#F6F6F2]/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[920px] items-center gap-3 px-6">
          <div className="grid h-7 w-7 place-items-center rounded-full bg-[#1F7A5C] text-[12px] font-bold text-white">C</div>
          <nav className="flex items-center gap-1 text-[13px] text-[#6B716C]">
            <span>Mis algoritmos</span>
            <span className="opacity-50">/</span>
            <span className="font-medium text-[#1D2420]">{title}</span>
          </nav>
          <div className="flex-1" />
          <span className="text-[12px] text-[#8A8F89]">Guardado</span>
          <ProfileChip profileId={profileId} setProfileId={setProfileId} />
        </div>
      </header>

      <div className="mx-auto max-w-[920px] px-6">
        <h1 className="mt-10 text-[34px] font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-[15px] text-[#6B716C]">
          Pide varias notas y calcula su promedio. <span className="text-[#A3A8A2]">Añade una descripción…</span>
        </p>

        {/* Insert chips */}
        <div className="mt-8 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[12px] font-medium uppercase tracking-wide text-[#A3A8A2]">Insertar</span>
          {inserts.map((item) => (
            <button
              key={item.label}
              className="group rounded-full border border-[#E1E1DA] bg-white px-3 py-1 text-[13px] hover:border-[#1F7A5C] hover:text-[#1F7A5C]"
              onClick={() => setSource(source.replace(/\n(\s*)(FinAlgoritmo|FinProceso)/i, `\n\t${item.text.replace(/\n/g, "\n\t")}\n$1$2`))}
              title={item.hint}
              type="button"
            >
              {item.label}
              <span className="ml-1.5 hidden text-[#A3A8A2] group-hover:inline">{item.hint}</span>
            </button>
          ))}
          <span className="ml-auto text-[12px] text-[#A3A8A2]">
            o escribe <Kbd>/</Kbd> en el código
          </span>
        </div>

        {/* The code block */}
        <section className="mt-3 overflow-hidden rounded-2xl border border-[#E5E5DF] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-1 border-b border-[#F0F0EA] px-3 py-2">
            {(
              [
                ["codigo", "Pseudocódigo"],
                ["diagrama", "Diagrama de flujo"],
                ["c", "En C"],
              ] as [View, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                className={`rounded-lg px-3 py-1 text-[13px] ${view === id ? "bg-[#F1F1EC] font-medium" : "text-[#8A8F89] hover:text-[#3C4641]"}`}
                onClick={() => setView(id)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ height: view === "codigo" ? Math.max(260, lineCount * 26 + 40) : 480 }}>
            {view === "codigo" && (
              <PrototypeEditor
                currentLine={run.currentLine}
                diagnostics={diagnostics}
                highlightLine={linkLine}
                onChange={setSource}
                readOnly={run.active}
                value={source}
              />
            )}
            {view === "diagrama" && (
              <DiagramPane
                dictionary={dictionary}
                onRevealLine={(line) => {
                  setLinkLine(line);
                  setView("codigo");
                }}
                settings={settings}
                source={source}
              />
            )}
            {view === "c" && <TranslationView settings={settings} source={source} />}
          </div>
          {firstError && (
            <div className="flex items-start gap-3 border-t border-[#F6D9CF] bg-[#FDF3EF] px-5 py-3 text-[14px]">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#C2410C] text-[11px] font-bold text-white">
                !
              </span>
              <div>
                <b>Línea {firstError.line}:</b> {firstError.message}
                <div className="mt-0.5 text-[13px] text-[#9A5B45]">
                  Pista: revisa que cada estructura que abres (Si, Para, Mientras) tenga su cierre.
                </div>
              </div>
            </div>
          )}
          {/* Run strip, attached to the block like a notebook cell */}
          <div className="flex items-center gap-2 border-t border-[#F0F0EA] bg-[#FAFAF7] px-3 py-2.5">
            {run.active ? (
              <button
                className="flex items-center gap-2 rounded-full bg-[#1D2420] px-4 py-1.5 text-[14px] font-medium text-white"
                onClick={run.stop}
                type="button"
              >
                ■ Detener
              </button>
            ) : (
              <button
                className="flex items-center gap-2 rounded-full bg-[#1F7A5C] px-5 py-1.5 text-[14px] font-semibold text-white hover:bg-[#19674D]"
                onClick={() => void run.run()}
                type="button"
              >
                ▶ Ejecutar
              </button>
            )}
            {!run.active && (
              <button
                className="rounded-full px-4 py-1.5 text-[14px] text-[#3C4641] hover:bg-[#EFEFE9]"
                onClick={() => void run.debug()}
                type="button"
              >
                Paso a paso
              </button>
            )}
            <span className="ml-2 text-[12px] text-[#A3A8A2]">
              <Kbd>⌘↵</Kbd> ejecutar · <Kbd>F10</Kbd> paso a paso
            </span>
          </div>
        </section>

        {/* Output flows right under the code */}
        {(run.lines.length > 0 || run.active) && (
          <section className="mt-8">
            <h2 className="mb-2 text-[12px] font-medium uppercase tracking-wide text-[#A3A8A2]">Lo que hizo tu programa</h2>
            <div className="max-h-[420px] overflow-hidden rounded-2xl border border-[#E5E5DF] bg-white">
              <ConversationConsole run={run} />
            </div>
          </section>
        )}

        {run.trace.length > 0 && (
          <section className="mt-8 grid grid-cols-[1fr_280px] gap-6">
            <div>
              <h2 className="mb-2 text-[12px] font-medium uppercase tracking-wide text-[#A3A8A2]">Prueba de escritorio</h2>
              <div className="h-[320px] overflow-hidden rounded-2xl border border-[#E5E5DF] bg-white">
                <DeskCheckTable onPickLine={setLinkLine} trace={run.trace} />
              </div>
            </div>
            <div>
              <h2 className="mb-2 text-[12px] font-medium uppercase tracking-wide text-[#A3A8A2]">Ahora mismo</h2>
              <div className="h-[320px] overflow-hidden rounded-2xl border border-[#E5E5DF] bg-white">
                <VariablesList run={run} />
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Floating step dock while debugging */}
      {stepping && (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full bg-[#1D2420] p-1.5 pl-4 text-[13px] text-white shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
          <span className="mr-2 opacity-70">
            {run.mode === "input" ? "Responde en la consola" : `Línea ${run.currentLine ?? "—"}`}
          </span>
          <button className="rounded-full bg-[#1F7A5C] px-4 py-1.5 font-semibold" onClick={run.step} type="button">
            Siguiente paso
          </button>
          <button className="rounded-full px-3 py-1.5 hover:bg-white/10" onClick={run.resume} type="button">
            Continuar
          </button>
          <button className="rounded-full px-3 py-1.5 hover:bg-white/10" onClick={run.stop} type="button">
            Detener
          </button>
        </div>
      )}
    </div>
  );
}
