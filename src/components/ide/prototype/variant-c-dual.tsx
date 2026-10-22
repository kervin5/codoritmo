"use client";

// PROTOTYPE — Variant C "Doble vista": PSeInt's identity is pseudocode AND
// flowchart, so show both side by side, linked. Dark focus mode, an icon rail
// for everything secondary, a floating command pill, and a console drawer
// that rises when the program runs.

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

type Right = "diagrama" | "c";
type Drawer = "consola" | "prueba" | "variables";

const railItems = [
  { icon: "▤", label: "Archivos" },
  { icon: "✦", label: "Ejemplos" },
  { icon: "?", label: "Ayuda" },
];

export default function VariantC({ dictionary, source, setSource, settings, profileId, setProfileId, run }: VariantProps) {
  const [right, setRight] = useState<Right>("diagrama");
  const [drawer, setDrawer] = useState<Drawer>("consola");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [linkLine, setLinkLine] = useState<number | null>(null);
  useRunShortcuts(run);

  useEffect(() => {
    if (run.active) setDrawerOpen(true);
    if (run.trace.length > 0) setDrawer((d) => (d === "consola" && run.mode === "input" ? "consola" : d));
  }, [run.active, run.trace.length, run.mode]);

  const diagnostics = run.runtimeError ? [...run.parseDiagnostics, run.runtimeError] : run.parseDiagnostics;
  const errorCount = run.parseDiagnostics.filter((d) => d.severity === "error").length;

  return (
    <div className="flex h-screen bg-[#0F1214] text-[#E8EDEA]">
      {/* Icon rail */}
      <aside className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-white/5 py-3">
        <div className="mb-3 grid h-8 w-8 place-items-center rounded-lg bg-[#1F7A5C] text-[13px] font-bold">C</div>
        {railItems.map((item) => (
          <button
            key={item.label}
            className="group relative grid h-10 w-10 place-items-center rounded-lg text-[16px] text-[#7F8A85] hover:bg-white/5 hover:text-white"
            type="button"
          >
            {item.icon}
            <span className="pointer-events-none absolute left-12 z-50 hidden rounded-md bg-[#1B2124] px-2 py-1 text-[12px] whitespace-nowrap text-white group-hover:block">
              {item.label}
            </span>
          </button>
        ))}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Thin header */}
        <header className="flex h-12 shrink-0 items-center gap-3 px-4">
          <span className="text-[14px] font-medium">Promedio.psc</span>
          <span className={`text-[12px] ${errorCount ? "text-[#F08A6C]" : "text-[#5E9E86]"}`}>
            {errorCount ? `● ${errorCount} error${errorCount > 1 ? "es" : ""}` : "● listo"}
          </span>
          <div className="flex-1" />
          <ProfileChip dark profileId={profileId} setProfileId={setProfileId} />
        </header>

        {/* Dual pane */}
        <div className="flex min-h-0 flex-1 gap-2 px-2">
          <section className="min-w-0 flex-1 overflow-hidden rounded-xl border border-white/5 bg-[#14181A]">
            <PrototypeEditor
              currentLine={run.currentLine}
              diagnostics={diagnostics}
              fontSize={15}
              highlightLine={linkLine}
              onChange={setSource}
              readOnly={run.active}
              theme="ink"
              value={source}
            />
          </section>
          <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/5 bg-[#F6F6F2] text-[#1D2420]">
            <div className="flex shrink-0 items-center gap-1 border-b border-[#E5E5DF] bg-white px-2 py-1.5">
              {(
                [
                  ["diagrama", "Diagrama de flujo"],
                  ["c", "C / C++ / JS"],
                ] as [Right, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  className={`rounded-md px-3 py-1 text-[13px] ${right === id ? "bg-[#1D2420] font-medium text-white" : "text-[#6B716C] hover:bg-[#F1F1EC]"}`}
                  onClick={() => setRight(id)}
                  type="button"
                >
                  {label}
                </button>
              ))}
              <span className="ml-auto pr-2 text-[11px] text-[#A3A8A2]">Haz clic en un bloque para ver su línea</span>
            </div>
            <div className="min-h-0 flex-1">
              {right === "diagrama" ? (
                <DiagramPane dictionary={dictionary} onRevealLine={setLinkLine} settings={settings} source={source} />
              ) : (
                <TranslationView settings={settings} source={source} />
              )}
            </div>
          </section>
        </div>

        {/* Console drawer */}
        <div
          className="mx-2 mt-2 mb-2 shrink-0 overflow-hidden rounded-xl border border-white/5 bg-[#14181A] transition-[height] duration-300"
          style={{ height: drawerOpen ? 300 : 40 }}
        >
          <div className="flex h-10 items-center gap-1 px-2">
            {(
              [
                ["consola", "Consola"],
                ["prueba", "Prueba de escritorio"],
                ["variables", "Variables"],
              ] as [Drawer, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                className={`rounded-md px-3 py-1 text-[13px] ${drawer === id && drawerOpen ? "bg-white/10 text-white" : "text-[#7F8A85] hover:text-white"}`}
                onClick={() => {
                  setDrawer(id);
                  setDrawerOpen(true);
                }}
                type="button"
              >
                {label}
                {id === "consola" && run.mode === "input" && (
                  <span className="ml-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#5FD3A5]" />
                )}
              </button>
            ))}
            <div className="flex-1" />
            <button
              className="rounded-md px-2 py-1 text-[13px] text-[#7F8A85] hover:text-white"
              onClick={() => setDrawerOpen((v) => !v)}
              type="button"
            >
              {drawerOpen ? "▾" : "▴"}
            </button>
          </div>
          {drawerOpen && (
            <div className="h-[260px] border-t border-white/5">
              {drawer === "consola" && <ConversationConsole dark run={run} />}
              {drawer === "prueba" && <DeskCheckTable dark onPickLine={setLinkLine} trace={run.trace} />}
              {drawer === "variables" && <VariablesList dark run={run} />}
            </div>
          )}
        </div>
      </div>

      {/* Floating command pill */}
      <div className="fixed top-2.5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-[#1B2124]/95 p-1 text-[13px] shadow-[0_10px_30px_rgba(0,0,0,0.4)] backdrop-blur">
        {run.active ? (
          <>
            {run.mode === "paused" && (
              <button className="rounded-full bg-[#1F7A5C] px-4 py-1.5 font-semibold" onClick={run.step} type="button">
                ⤵ Siguiente <Kbd dark>F10</Kbd>
              </button>
            )}
            {run.trace.length > 0 && (
              <button className="rounded-full px-3 py-1.5 hover:bg-white/10" onClick={run.resume} type="button">
                Continuar
              </button>
            )}
            <button className="rounded-full px-3 py-1.5 text-[#F08A6C] hover:bg-white/10" onClick={run.stop} type="button">
              ■ Detener
            </button>
          </>
        ) : (
          <>
            <button
              className="rounded-full bg-[#1F7A5C] px-4 py-1.5 font-semibold hover:bg-[#25906C]"
              onClick={() => void run.run()}
              type="button"
            >
              ▶ Ejecutar <Kbd dark>⌘↵</Kbd>
            </button>
            <button
              className="rounded-full px-3 py-1.5 hover:bg-white/10"
              onClick={() => {
                setDrawer("prueba");
                void run.debug();
              }}
              type="button"
            >
              Paso a paso
            </button>
            <span className="mx-1 h-4 w-px bg-white/10" />
            <button className="rounded-full px-3 py-1.5 text-[#9AA5A0] hover:bg-white/10" type="button">
              <Kbd dark>⌘K</Kbd>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
