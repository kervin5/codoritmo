"use client";

// PROTOTYPE — Variant D "Reproductor": execution as playback. A mellow dark
// workspace (code + synced flowchart), a reference library you can always
// find in the rail, and a music-player bar: transport, scrubber, speed, and
// "now playing" with the variables that just changed.

import {
  BookOpen,
  Files,
  Pause,
  Play,
  Rabbit,
  Settings2,
  SkipBack,
  SkipForward,
  Sparkles,
  Square,
  Turtle,
} from "lucide-react";
import type { editor } from "monaco-editor";
import { useEffect, useMemo, useRef, useState } from "react";

import { examplePrograms, type ExportLanguage } from "@/src/engine";
import MellowDiagram from "./mellow-diagram";
import { LanguagePicker, PlayerConsole, ReferenceLibrary, TranslationPane } from "./player-panels";
import PrototypeEditor from "./prototype-editor";
import { DeskCheckTable } from "./prototype-parts";
import { ProfileChip, type VariantProps } from "./prototype-root";
import { formatValue } from "./use-prototype-run";
import { SPEEDS, usePlayer } from "./use-player";

type Flyout = "referencia" | "ejemplos" | "archivos" | null;
type View = "diagrama" | "traduccion" | "prueba";

export default function VariantD({ dictionary, source, setSource, settings, profileId, setProfileId }: VariantProps) {
  const player = usePlayer(source, settings);
  const [flyout, setFlyout] = useState<Flyout>(null);
  const [view, setView] = useState<View>("diagrama");
  const [language, setLanguage] = useState<ExportLanguage>("c" as ExportLanguage);
  const [linkLine, setLinkLine] = useState<number | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const showPlayhead = player.live || player.scrubbing;
  const activeLine = showPlayhead ? player.frame?.line ?? null : null;
  const errorCount = player.parseDiagnostics.filter((d) => d.severity === "error").length;
  const diagnostics = player.runtimeError ? [...player.parseDiagnostics, player.runtimeError] : player.parseDiagnostics;
  const sourceLines = useMemo(() => source.split("\n"), [source]);
  const title = /^\s*(?:Algoritmo|Proceso)\s+(\S+)/im.exec(source)?.[1] ?? "SinTitulo";

  const visitedLines = useMemo(() => {
    const set = new Set<number>();
    const upto = showPlayhead || player.status === "done" ? player.viewIndex : -1;
    for (let i = 0; i <= upto && i < player.frames.length; i += 1) set.add(player.frames[i].line);
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.viewIndex, player.frameCount, showPlayhead, player.status]);

  const trace = useMemo(
    () =>
      player.frames
        .slice(0, player.viewIndex + 1)
        .map((frame, index) => ({ step: index, line: frame.line, variables: frame.variables }))
        .filter((row) => row.variables.length > 0)
        .slice(-400),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [player.viewIndex, player.frameCount]
  );

  // Keyboard: space play/pause, ←/→ step, ⌘↵ play, Esc stop (outside text fields).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = !!target.closest("input, textarea, [contenteditable], .monaco-editor");
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        if (player.wantPlay) player.pause();
        else player.play();
        return;
      }
      if (event.key === "Escape" && player.live) player.stop();
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setFlyout((f) => (f === "referencia" ? null : "referencia"));
      }
      if (typing || event.altKey) return;
      if (event.key === " ") {
        event.preventDefault();
        if (player.wantPlay) player.pause();
        else player.play();
      }
      if (event.key === "ArrowRight") player.stepForward();
      if (event.key === "ArrowLeft") player.stepBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [player]);

  const insert = (text: string) => {
    const instance = editorRef.current;
    if (!instance) return;
    const selection = instance.getSelection();
    if (!selection) return;
    instance.executeEdits("referencia", [{ range: selection, text, forceMoveMarkers: true }]);
    instance.focus();
  };

  const statusLabel = player.scrubbing
    ? `Rebobinado · paso ${player.viewIndex + 1}`
    : {
        idle: "Listo",
        playing: "Reproduciendo",
        paused: "En pausa",
        input: "Esperando tu respuesta",
        done: "Terminado",
        error: "Se detuvo por un error",
        stopped: "Detenido",
      }[player.status];

  const nowText = activeLine ? sourceLines[activeLine - 1]?.trim() : null;

  return (
    <div
      className="flex h-screen text-[#E4EAE7]"
      style={{
        background:
          "radial-gradient(1100px 620px at 12% -12%, #1A2A25 0%, transparent 60%), radial-gradient(900px 520px at 105% -5%, #1C2130 0%, transparent 55%), #0D1113",
      }}
    >
      <style>{`
        .proto-play-line { background: linear-gradient(90deg, rgba(134,240,196,0.16), rgba(134,240,196,0.03)); box-shadow: inset 2px 0 0 #86F0C4; }
        .proto-play-glyph { background: #86F0C4; border-radius: 999px; width: 7px !important; height: 7px !important; margin: 9px 0 0 8px; box-shadow: 0 0 10px #86F0C4; }
        .proto-range { -webkit-appearance: none; appearance: none; height: 4px; border-radius: 999px; outline: none; cursor: pointer; }
        .proto-range::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 999px; background: #EEF8F3; box-shadow: 0 0 0 4px rgba(134,240,196,0.22), 0 2px 6px rgba(0,0,0,.4); transition: transform .15s; }
        .proto-range:hover::-webkit-slider-thumb { transform: scale(1.15); }
        .proto-range:disabled { cursor: default; opacity: .5; }
      `}</style>

      {/* Rail: everything secondary lives here, always labelled */}
      <aside className="flex w-[68px] shrink-0 flex-col items-center gap-1 py-4">
        <div className="mb-4 grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#86F0C4] to-[#3F9C7A] text-[15px] font-bold text-[#0D1113] shadow-[0_6px_20px_rgba(134,240,196,0.25)]">
          C
        </div>
        {(
          [
            ["archivos", Files, "Archivos"],
            ["ejemplos", Sparkles, "Ejemplos"],
            ["referencia", BookOpen, "Referencia"],
          ] as const
        ).map(([id, Icon, label]) => (
          <button
            key={id}
            className={`flex w-14 flex-col items-center gap-1 rounded-xl py-2 text-[10.5px] ${
              flyout === id ? "bg-white/[0.08] text-white" : "text-[#7F8A85] hover:bg-white/[0.04] hover:text-[#DCE3E0]"
            }`}
            onClick={() => setFlyout((f) => (f === id ? null : id))}
            type="button"
          >
            <Icon size={18} strokeWidth={1.7} />
            {label}
          </button>
        ))}
        <div className="flex-1" />
        <button className="flex w-14 flex-col items-center gap-1 rounded-xl py-2 text-[10.5px] text-[#7F8A85] hover:text-[#DCE3E0]" type="button">
          <Settings2 size={18} strokeWidth={1.7} />
          Ajustes
        </button>
      </aside>

      {/* Flyout */}
      <div
        className="shrink-0 overflow-hidden transition-[width] duration-300 ease-out"
        style={{ width: flyout ? 340 : 0 }}
      >
        <div className="my-3 mr-1 h-[calc(100%-24px)] w-[328px] overflow-hidden rounded-2xl bg-[#141A1D]/90 ring-1 ring-white/[0.06] backdrop-blur">
          {flyout === "referencia" && (
            <ReferenceLibrary dictionary={dictionary} onClose={() => setFlyout(null)} onInsert={insert} settings={settings} />
          )}
          {flyout === "ejemplos" && (
            <div className="p-5">
              <div className="text-[11px] font-semibold tracking-[0.14em] text-[#6E7B76] uppercase">Ejemplos</div>
              <div className="mb-4 text-[17px] font-semibold">Para empezar</div>
              {examplePrograms.map((example) => (
                <button
                  key={example.id}
                  className="mb-1.5 block w-full rounded-xl px-3 py-2.5 text-left hover:bg-white/[0.05]"
                  onClick={() => {
                    player.stop();
                    setSource(example.source);
                    setFlyout(null);
                  }}
                  type="button"
                >
                  <div className="text-[14px] font-medium">{example.label}</div>
                  <div className="text-[12px] text-[#7F8A85]">{example.description}</div>
                </button>
              ))}
            </div>
          )}
          {flyout === "archivos" && (
            <div className="p-5 text-[13px] text-[#7F8A85]">
              <div className="text-[11px] font-semibold tracking-[0.14em] text-[#6E7B76] uppercase">Archivos</div>
              <div className="mb-4 text-[17px] font-semibold text-[#E4EAE7]">Mis algoritmos</div>
              {["Promedio.psc", "Tarea2.psc", "TaTeTi.psc"].map((name, i) => (
                <div key={name} className={`mb-1 rounded-xl px-3 py-2 ${i === 0 ? "bg-white/[0.06] text-white" : ""}`}>
                  {name}
                </div>
              ))}
              <p className="mt-4">(Maqueta: abrir, subir .psc y compartir irían aquí.)</p>
            </div>
          )}
        </div>
      </div>

      {/* Stage */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 px-4">
          <div className="text-[15px] font-semibold">{title}</div>
          <button
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] ${
              errorCount ? "bg-[#F08A6C]/12 text-[#F5A68E]" : "text-[#6FB59A]"
            }`}
            onClick={() => {
              const first = player.parseDiagnostics[0];
              if (first) editorRef.current?.revealLineInCenter(first.line);
            }}
            type="button"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${errorCount ? "bg-[#F08A6C]" : "bg-[#86F0C4]"}`} />
            {errorCount ? `${errorCount} error${errorCount > 1 ? "es" : ""}` : "Sin errores"}
          </button>
          <div className="flex-1" />
          <ProfileChip dark profileId={profileId} setProfileId={setProfileId} />
          <LanguagePicker
            onChange={(id) => {
              setLanguage(id);
              setView("traduccion");
            }}
            value={language}
          />
        </header>

        <div className="flex min-h-0 flex-1 gap-3 px-3">
          {/* Code */}
          <section className="min-w-0 flex-[1.15] overflow-hidden rounded-2xl bg-white/[0.025] ring-1 ring-white/[0.06]">
            <PrototypeEditor
              currentLine={activeLine}
              diagnostics={diagnostics}
              fontSize={15}
              highlightLine={linkLine}
              onChange={setSource}
              onReady={(instance) => {
                editorRef.current = instance;
              }}
              readOnly={player.live}
              theme="mellow"
              value={source}
            />
          </section>

          {/* Right column: view + console */}
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <section className="flex min-h-0 flex-[1.4] flex-col overflow-hidden rounded-2xl bg-white/[0.025] ring-1 ring-white/[0.06]">
              <div className="flex shrink-0 items-center gap-1 px-3 pt-3">
                {(
                  [
                    ["diagrama", "Diagrama"],
                    ["traduccion", `Código ${language === "cpp" ? "C++" : language === "javascript" ? "JS" : "C"}`],
                    ["prueba", "Prueba de escritorio"],
                  ] as [View, string][]
                ).map(([id, label]) => (
                  <button
                    key={id}
                    className={`rounded-full px-3 py-1 text-[12.5px] ${
                      view === id ? "bg-white/[0.09] text-white" : "text-[#7F8A85] hover:text-[#DCE3E0]"
                    }`}
                    onClick={() => setView(id)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="min-h-0 flex-1">
                {view === "diagrama" && (
                  <MellowDiagram
                    activeLine={activeLine}
                    onPickLine={(line) => {
                      setLinkLine(line);
                      editorRef.current?.revealLineInCenter(line);
                    }}
                    routineName={showPlayhead ? player.frame?.routine ?? null : null}
                    settings={settings}
                    source={source}
                    visitedLines={visitedLines}
                  />
                )}
                {view === "traduccion" && <TranslationPane language={language} settings={settings} source={source} />}
                {view === "prueba" && (
                  <DeskCheckTable
                    dark
                    onPickLine={(line) => {
                      const index = player.frames.findIndex((f, i) => i <= player.viewIndex && f.line === line);
                      if (index >= 0) player.seek(index);
                    }}
                    trace={trace}
                  />
                )}
              </div>
            </section>

            <section
              className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl ring-1 transition-[box-shadow] duration-300 ${
                player.status === "input" && !player.scrubbing
                  ? "bg-[#86F0C4]/[0.04] shadow-[0_0_40px_rgba(134,240,196,0.10)] ring-[#86F0C4]/30"
                  : "bg-white/[0.025] ring-white/[0.06]"
              }`}
            >
              <div className="flex shrink-0 items-center gap-2 px-5 pt-3 text-[11px] font-semibold tracking-[0.14em] text-[#6E7B76] uppercase">
                Consola
                {player.status === "input" && !player.scrubbing && (
                  <span className="rounded-full bg-[#86F0C4]/15 px-2 py-0.5 tracking-normal text-[#A9F5D5] normal-case">
                    Tu programa te pregunta algo
                  </span>
                )}
              </div>
              <div className="min-h-0 flex-1">
                <PlayerConsole player={player} />
              </div>
            </section>
          </div>
        </div>

        {/* The player */}
        <footer className="m-3 grid h-[92px] shrink-0 grid-cols-[1fr_1.25fr_1fr] items-center gap-6 rounded-2xl bg-gradient-to-b from-[#182125] to-[#12181B] px-5 shadow-[0_18px_50px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.07]">
          {/* Now playing */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-[#6E7B76] uppercase">
              {player.wantPlay && player.status !== "input" && <Equalizer />}
              {statusLabel}
            </div>
            <div className="mt-1 truncate font-mono text-[15px] text-[#F2F7F4]">
              {nowText ?? (player.status === "done" ? "Programa terminado" : `${title}.psc`)}
            </div>
            <div className="mt-0.5 truncate text-[12px] text-[#7F8A85]">
              {activeLine
                ? `Línea ${activeLine} · ${player.frame?.routine ?? "Algoritmo principal"}`
                : player.status === "idle"
                  ? "Pulsa ▶ o la barra espaciadora"
                  : `${player.frameCount} pasos ejecutados`}
            </div>
          </div>

          {/* Transport + scrubber */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-3">
              <TransportButton disabled={player.frameCount === 0} label="Paso atrás (←)" onClick={player.stepBack}>
                <SkipBack size={18} fill="currentColor" />
              </TransportButton>
              <button
                aria-label={player.wantPlay ? "Pausar" : "Reproducir"}
                className="grid h-11 w-11 place-items-center rounded-full bg-[#EEF8F3] text-[#0D1113] shadow-[0_0_0_6px_rgba(134,240,196,0.10),0_6px_18px_rgba(0,0,0,0.4)] transition-transform hover:scale-105 active:scale-95"
                onClick={player.wantPlay ? player.pause : player.play}
                type="button"
              >
                {player.wantPlay ? (
                  <Pause size={18} fill="currentColor" />
                ) : (
                  <Play className="ml-0.5" size={18} fill="currentColor" />
                )}
              </button>
              <TransportButton label="Siguiente paso (→)" onClick={player.stepForward}>
                <SkipForward size={18} fill="currentColor" />
              </TransportButton>
              <TransportButton disabled={!player.live} label="Detener (Esc)" onClick={player.stop}>
                <Square size={15} fill="currentColor" />
              </TransportButton>
            </div>
            <div className="flex w-full items-center gap-3 text-[11px] text-[#6E7B76] tabular-nums">
              <span className="w-10 text-right">{player.frameCount ? player.viewIndex + 1 : 0}</span>
              <input
                className="proto-range flex-1"
                disabled={player.frameCount < 2}
                max={Math.max(0, player.frameCount - 1)}
                min={0}
                onChange={(event) => player.seek(Number(event.target.value))}
                style={{
                  background: `linear-gradient(90deg, #86F0C4 ${
                    player.frameCount > 1 ? (player.viewIndex / (player.frameCount - 1)) * 100 : 0
                  }%, rgba(255,255,255,0.12) 0)`,
                }}
                type="range"
                value={Math.max(0, player.viewIndex)}
              />
              <span className="w-10">{player.frameCount}</span>
            </div>
          </div>

          {/* What changed + speed */}
          <div className="flex min-w-0 items-center justify-end gap-5">
            <div className="flex min-w-0 flex-1 flex-wrap justify-end gap-1.5">
              {[...player.changed].slice(0, 3).map((name) => {
                const now = player.frame?.variables.find((v) => v.name === name);
                const before = player.previous?.variables.find((v) => v.name === name);
                return (
                  <span key={name} className="rounded-full bg-[#86F0C4]/10 px-2.5 py-1 font-mono text-[12px] text-[#CFF8E6] ring-1 ring-[#86F0C4]/20">
                    {name}{" "}
                    <span className="text-[#6E9E8A]">{before?.initialized ? formatValue(before.value) : "∅"} →</span>{" "}
                    <b>{now ? formatValue(now.value) : ""}</b>
                  </span>
                );
              })}
              {player.changed.size === 0 && showPlayhead && (
                <button className="text-[12px] text-[#5E6A66] hover:text-[#B5C0BB]" onClick={() => setView("prueba")} type="button">
                  Ver todas las variables →
                </button>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-center gap-1">
              <div className="flex items-center gap-2 text-[#6E7B76]">
                <Turtle size={14} />
                {SPEEDS.map((speed, index) => (
                  <button
                    key={speed.id}
                    aria-label={speed.label}
                    className={`rounded-full transition-all ${
                      index === player.speedIndex ? "h-2.5 w-2.5 bg-[#86F0C4] shadow-[0_0_8px_#86F0C4]" : "h-1.5 w-1.5 bg-white/25 hover:bg-white/50"
                    }`}
                    onClick={() => player.setSpeedIndex(index)}
                    title={speed.label}
                    type="button"
                  />
                ))}
                <Rabbit size={14} />
              </div>
              <span className="text-[10.5px] text-[#6E7B76]">{SPEEDS[player.speedIndex].label}</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function TransportButton({
  children,
  onClick,
  label,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-full text-[#B5C0BB] hover:bg-white/[0.06] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function Equalizer() {
  return (
    <span className="flex h-3 items-end gap-[2px]">
      <style>{`@keyframes proto-eq { 0%,100% { height: 30% } 50% { height: 100% } }`}</style>
      {[0, 0.2, 0.4].map((delay) => (
        <span
          key={delay}
          className="w-[3px] rounded-full bg-[#86F0C4]"
          style={{ animation: `proto-eq 0.9s ease-in-out ${delay}s infinite` }}
        />
      ))}
    </span>
  );
}
