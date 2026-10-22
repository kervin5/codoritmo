"use client";

// PROTOTYPE — Variant E "Nativo": the playback model from D, packaged like a
// desktop app. Real menu bar with working menus and shortcuts, document tabs,
// resizable panes, the reference docked and context-aware, ⌘K palette, and a
// compact transport bar.

import { BookOpen, Pause, Play, Rabbit, Search, SkipBack, SkipForward, Square, Turtle, X } from "lucide-react";
import type { editor } from "monaco-editor";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { examplePrograms, generateExport, Parser, type ExportLanguage } from "@/src/engine";
import { CommandPalette } from "./command-palette";
import MellowDiagram from "./mellow-diagram";
import { MenuBar, type Menu } from "./native-menu";
import { PlayerConsole, TranslationPane } from "./player-panels";
import PrototypeEditor from "./prototype-editor";
import { DeskCheckTable } from "./prototype-parts";
import { prototypeProfiles, type VariantProps } from "./prototype-root";
import { ReferenceInspector, useReferenceCatalog, type ReferenceEntry } from "./reference-inspector";
import { formatValue } from "./use-prototype-run";
import { SPEEDS, usePlayer } from "./use-player";

type View = "diagrama" | "traduccion" | "prueba";

const LANGS: { id: string; name: string; ext: string }[] = [
  { id: "c", name: "C", ext: "c" },
  { id: "cpp", name: "C++", ext: "cpp" },
  { id: "javascript", name: "JavaScript", ext: "js" },
];
const SOON = ["Java", "Python", "C#", "PHP", "Pascal", "Visual Basic", "QBasic", "MatLab"];

const NEW_PROGRAM = `Algoritmo SinTitulo

FinAlgoritmo
`;

function useIsMac() {
  const [mac, setMac] = useState(true);
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);
  return mac;
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/** Drag handle that resizes a neighbouring pane. */
function Divider({ axis, onDrag }: { axis: "x" | "y"; onDrag: (delta: number) => void }) {
  return (
    <div
      className={`group relative z-10 shrink-0 ${axis === "x" ? "w-px cursor-col-resize" : "h-px cursor-row-resize"} bg-white/[0.07]`}
      onPointerDown={(event) => {
        event.preventDefault();
        let last = axis === "x" ? event.clientX : event.clientY;
        const move = (e: PointerEvent) => {
          const now = axis === "x" ? e.clientX : e.clientY;
          onDrag(now - last);
          last = now;
        };
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          document.body.style.cursor = "";
        };
        document.body.style.cursor = axis === "x" ? "col-resize" : "row-resize";
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      }}
    >
      <div className={`absolute ${axis === "x" ? "inset-y-0 -left-[3px] w-[7px]" : "inset-x-0 -top-[3px] h-[7px]"} group-hover:bg-[#4FB892]/40`} />
    </div>
  );
}

export default function VariantE({ dictionary, source, setSource, settings, profileId, setProfileId }: VariantProps) {
  const mac = useIsMac();
  const k = (key: string, shift = false, alt = false) =>
    mac ? `${alt ? "⌥" : ""}${shift ? "⇧" : ""}⌘${key}` : `Ctrl+${alt ? "Alt+" : ""}${shift ? "Shift+" : ""}${key}`;

  const player = usePlayer(source, settings);
  const catalog = useReferenceCatalog(dictionary, settings);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState("Promedio.psc");
  const [savedSource, setSavedSource] = useState(source);
  const [view, setView] = useState<View>("diagrama");
  const [language, setLanguage] = useState<ExportLanguage>("c" as ExportLanguage);
  const [showReference, setShowReference] = useState(true);
  const [showConsole, setShowConsole] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [fontSize, setFontSize] = useState(15);
  const [cursorWord, setCursorWord] = useState<string | null>(null);
  const [linkLine, setLinkLine] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [middleWidth, setMiddleWidth] = useState(440);
  const [referenceWidth, setReferenceWidth] = useState(300);
  const [consoleHeight, setConsoleHeight] = useState(230);

  const dirty = source !== savedSource;
  const showPlayhead = player.live || player.scrubbing;
  const activeLine = showPlayhead ? player.frame?.line ?? null : null;
  const errorCount = player.parseDiagnostics.filter((d) => d.severity === "error").length;
  const diagnostics = player.runtimeError ? [...player.parseDiagnostics, player.runtimeError] : player.parseDiagnostics;
  const sourceLines = useMemo(() => source.split("\n"), [source]);
  const langName = LANGS.find((l) => l.id === language)?.name ?? "C";

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((t) => (t === message ? null : t)), 1800);
  }, []);

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

  /* ---------- actions ---------- */
  const editorAction = (id: string) => {
    editorRef.current?.focus();
    editorRef.current?.trigger("menu", id, null);
  };
  const insert = (text: string) => {
    const instance = editorRef.current;
    const selection = instance?.getSelection();
    if (!instance || !selection) return;
    instance.executeEdits("referencia", [{ range: selection, text, forceMoveMarkers: true }]);
    instance.focus();
  };
  const loadProgram = (name: string, text: string) => {
    player.stop();
    setSource(text);
    setSavedSource(text);
    setFileName(name);
  };
  const save = () => {
    download(fileName, source);
    setSavedSource(source);
    notify(`Guardado ${fileName}`);
  };
  const exportAs = (id: string) => {
    const lang = LANGS.find((l) => l.id === id)!;
    const parsed = new Parser(source, { settings }).parse();
    if (!parsed.program) return notify("Corrige los errores antes de exportar");
    const code = generateExport(parsed.program, id as ExportLanguage, { settings }).code;
    if (code) {
      download(fileName.replace(/\.psc$/i, `.${lang.ext}`), code);
      notify(`Exportado a ${lang.name}`);
    }
  };
  const togglePlay = () => (player.wantPlay ? player.pause() : player.play());

  const insertItems = ["SI", "PARA", "MIENTRAS", "REPETIR", "SEGUN", "LEER", "ESCRIBIR", "DEFINIR"]
    .map((word) => catalog.lookup(word))
    .filter((e): e is ReferenceEntry => !!e)
    .map((entry) => ({ label: entry.label, onSelect: () => insert(entry.example) }));

  const menus: Menu[] = [
    {
      label: "Archivo",
      items: [
        { label: "Nuevo", shortcut: k("N"), onSelect: () => loadProgram("SinTitulo.psc", NEW_PROGRAM) },
        { label: "Abrir…", shortcut: k("O"), onSelect: () => fileInputRef.current?.click() },
        {
          label: "Abrir ejemplo",
          submenu: examplePrograms.map((example) => ({
            label: example.label,
            onSelect: () => loadProgram(`${example.label.replace(/\s+/g, "")}.psc`, example.source),
          })),
        },
        { separator: true },
        { label: "Guardar", shortcut: k("S"), onSelect: save },
        {
          label: "Exportar como",
          submenu: [
            ...LANGS.map((l) => ({ label: `${l.name} (.${l.ext})`, onSelect: () => exportAs(l.id) })),
            { separator: true },
            { label: "Diagrama como imagen", disabled: true, hint: "pronto" },
          ],
        },
        { separator: true },
        { label: "Compartir enlace…", disabled: true, hint: "pronto" },
      ],
    },
    {
      label: "Editar",
      items: [
        { label: "Deshacer", shortcut: k("Z"), onSelect: () => editorAction("undo") },
        { label: "Rehacer", shortcut: k("Z", true), onSelect: () => editorAction("redo") },
        { separator: true },
        { label: "Buscar…", shortcut: k("F"), onSelect: () => editorAction("actions.find") },
        { label: "Reemplazar…", shortcut: k("F", false, true), onSelect: () => editorAction("editor.action.startFindReplaceAction") },
        { separator: true },
        { label: "Comentar línea", shortcut: k("/"), onSelect: () => editorAction("editor.action.commentLine") },
        { label: "Insertar", submenu: insertItems },
      ],
    },
    {
      label: "Ejecutar",
      items: [
        { label: player.live && !player.wantPlay ? "Continuar" : "Ejecutar", shortcut: k("↵"), onSelect: player.play, disabled: player.wantPlay },
        { label: "Pausar", shortcut: "Espacio", onSelect: player.pause, disabled: !player.wantPlay },
        { label: "Paso siguiente", shortcut: "F10", onSelect: player.stepForward },
        { label: "Paso anterior", shortcut: "⇧F10", onSelect: player.stepBack, disabled: player.frameCount === 0 },
        { label: "Detener", shortcut: "Esc", onSelect: player.stop, disabled: !player.live },
        { separator: true },
        {
          label: "Velocidad",
          submenu: SPEEDS.map((speed, index) => ({
            label: speed.label,
            checked: index === player.speedIndex,
            onSelect: () => player.setSpeedIndex(index),
          })),
        },
        {
          label: "Perfil del lenguaje",
          submenu: [
            ...prototypeProfiles.map((profile) => ({
              label: profile.id === "desktop-default" ? "Flexible" : profile.label,
              checked: profile.id === profileId,
              onSelect: () => setProfileId(profile.id),
            })),
            { separator: true },
            { label: "463 perfiles de instituciones…", disabled: true },
          ],
        },
      ],
    },
    {
      label: "Ver",
      items: [
        { label: "Diagrama de flujo", shortcut: k("1"), checked: view === "diagrama", onSelect: () => setView("diagrama") },
        { label: `Código ${langName}`, shortcut: k("2"), checked: view === "traduccion", onSelect: () => setView("traduccion") },
        { label: "Prueba de escritorio", shortcut: k("3"), checked: view === "prueba", onSelect: () => setView("prueba") },
        { separator: true },
        { label: "Referencia", shortcut: k("R", true), checked: showReference, onSelect: () => setShowReference((v) => !v) },
        { label: "Consola", shortcut: k("J"), checked: showConsole, onSelect: () => setShowConsole((v) => !v) },
        { separator: true },
        {
          label: "Traducir a",
          submenu: [
            ...LANGS.map((l) => ({
              label: l.name,
              checked: l.id === language,
              onSelect: () => {
                setLanguage(l.id as ExportLanguage);
                setView("traduccion");
              },
            })),
            { separator: true },
            ...SOON.map((name) => ({ label: name, disabled: true, hint: "pronto" })),
          ],
        },
        { separator: true },
        { label: "Aumentar texto", shortcut: k("+"), onSelect: () => setFontSize((s) => Math.min(22, s + 1)) },
        { label: "Reducir texto", shortcut: k("−"), onSelect: () => setFontSize((s) => Math.max(12, s - 1)) },
        {
          label: "Pantalla completa",
          shortcut: mac ? "⌃⌘F" : "F11",
          onSelect: () =>
            document.fullscreenElement ? void document.exitFullscreen() : void document.documentElement.requestFullscreen(),
        },
      ],
    },
    {
      label: "Ayuda",
      items: [
        { label: "Buscar acciones y comandos…", shortcut: k("K"), onSelect: () => setPaletteOpen(true) },
        { label: "Atajos de teclado", shortcut: k("?"), onSelect: () => setShortcutsOpen(true) },
        { separator: true },
        { label: "Acerca de Codoritmo", onSelect: () => notify("Codoritmo · prototipo de interfaz") },
        { label: "Sitio oficial de PSeInt", onSelect: () => window.open("https://pseint.sourceforge.net", "_blank") },
      ],
    },
  ];

  /* ---------- global shortcuts (beat the browser's own) ---------- */
  const menusRef = useRef(menus);
  menusRef.current = menus;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = mac ? event.metaKey : event.ctrlKey;
      const target = (event.target instanceof Element ? event.target : document.body) as HTMLElement;
      const inEditor = !!target.closest(".monaco-editor");
      const typing = inEditor || !!target.closest("input, textarea");
      const key = event.key.toLowerCase();
      const handled = (fn: () => void) => {
        event.preventDefault();
        event.stopPropagation();
        fn();
      };
      if (mod && key === "k") return handled(() => setPaletteOpen((v) => !v));
      if (mod && key === "s") return handled(save);
      if (mod && key === "o") return handled(() => fileInputRef.current?.click());
      if (mod && key === "n") return handled(() => loadProgram("SinTitulo.psc", NEW_PROGRAM));
      if (mod && key === "enter") return handled(() => (player.wantPlay ? player.pause() : player.play()));
      if (mod && event.shiftKey && key === "r") return handled(() => setShowReference((v) => !v));
      if (mod && key === "j") return handled(() => setShowConsole((v) => !v));
      if (mod && ["1", "2", "3"].includes(key))
        return handled(() => setView((["diagrama", "traduccion", "prueba"] as View[])[Number(key) - 1]));
      if (mod && (key === "=" || key === "+")) return handled(() => setFontSize((s) => Math.min(22, s + 1)));
      if (mod && key === "-") return handled(() => setFontSize((s) => Math.max(12, s - 1)));
      if (mod && key === "?") return handled(() => setShortcutsOpen(true));
      if (event.key === "F10") return handled(event.shiftKey ? player.stepBack : player.stepForward);
      if (event.key === "Escape" && player.live && !paletteOpen) return handled(player.stop);
      if (typing) return;
      if (event.key === " ") return handled(togglePlay);
      if (event.key === "ArrowRight") return handled(player.stepForward);
      if (event.key === "ArrowLeft") return handled(player.stepBack);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  const nowText = activeLine ? sourceLines[activeLine - 1]?.trim() : null;
  const statusLabel = player.scrubbing
    ? `Rebobinado · paso ${player.viewIndex + 1}`
    : { idle: "Listo", playing: "Ejecutando", paused: "En pausa", input: "Esperando tu respuesta", done: "Terminado", error: "Error en ejecución", stopped: "Detenido" }[player.status];

  return (
    <div
      className="flex h-screen flex-col overflow-hidden bg-[#141719] text-[#E6ECE9] select-none"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", var(--font-geist-sans), sans-serif' }}
    >
      <style>{`
        .proto-play-line { background: linear-gradient(90deg, rgba(127,224,184,0.17), rgba(127,224,184,0.03)); box-shadow: inset 2px 0 0 #7FE0B8; }
        .proto-play-glyph { background: #7FE0B8; border-radius: 999px; width: 7px !important; height: 7px !important; margin: 9px 0 0 8px; box-shadow: 0 0 8px #7FE0B8; }
        .proto-range { -webkit-appearance: none; appearance: none; height: 3px; border-radius: 999px; outline: none; }
        .proto-range::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; border-radius: 999px; background: #F2F7F4; box-shadow: 0 1px 4px rgba(0,0,0,.5); }
        .proto-range:disabled { opacity: .45; }
      `}</style>
      <input
        ref={fileInputRef}
        accept=".psc,.txt"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          const bytes = new Uint8Array(await file.arrayBuffer());
          let text = new TextDecoder("utf-8").decode(bytes);
          if (text.includes("�")) text = new TextDecoder("iso-8859-1").decode(bytes); // PSeInt saves Latin-1
          loadProgram(file.name, text.replace(/\r\n/g, "\n"));
          notify(`Abierto ${file.name}`);
        }}
        type="file"
      />

      {/* Menu bar */}
      <div className="relative flex h-[34px] shrink-0 items-center border-b border-black/40 bg-[#1D2124] px-2 shadow-[inset_0_-1px_0_rgba(255,255,255,0.04)]">
        <MenuBar
          leading={
            <div className="mr-1.5 ml-1 grid h-[18px] w-[18px] place-items-center rounded-[5px] bg-gradient-to-br from-[#7FE0B8] to-[#2F8F6E] text-[10.5px] font-bold text-[#0E1214]">
              C
            </div>
          }
          menus={menus}
        />
        <div className="pointer-events-none absolute inset-x-0 text-center text-[12.5px] text-white/55">
          {fileName.replace(/\.psc$/i, "")}
          {dirty && <span className="text-white/35"> — Editado</span>}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            className="flex h-[24px] items-center gap-2 rounded-[6px] border border-white/[0.07] bg-black/20 px-2 text-[12px] text-white/45 hover:text-white/75"
            onClick={() => setPaletteOpen(true)}
            type="button"
          >
            <Search size={12} /> Buscar
            <span className="text-white/30">{k("K")}</span>
          </button>
          <button
            className={`grid h-[24px] w-[26px] place-items-center rounded-[6px] ${showReference ? "bg-white/[0.1] text-white" : "text-white/45 hover:text-white/80"}`}
            onClick={() => setShowReference((v) => !v)}
            title={`Referencia (${k("R", true)})`}
            type="button"
          >
            <BookOpen size={14} />
          </button>
        </div>
      </div>

      {/* Workspace */}
      <div className="flex min-h-0 flex-1">
        {/* Editor */}
        <div className="flex min-w-[320px] flex-1 flex-col">
          <div className="flex h-[32px] shrink-0 items-end gap-px border-b border-white/[0.06] bg-[#181B1D] px-2">
            <div className="flex h-[28px] items-center gap-2 rounded-t-[7px] border border-b-0 border-white/[0.07] bg-[#141719] pr-2 pl-3 text-[12.5px]">
              {fileName}
              {dirty ? (
                <span className="h-[7px] w-[7px] rounded-full bg-white/50" title="Sin guardar" />
              ) : (
                <X className="text-white/30" size={12} />
              )}
            </div>
            <div className="ml-auto flex h-full items-center gap-2 pr-1 text-[11.5px]">
              <span className={`flex items-center gap-1.5 ${errorCount ? "text-[#F0A48C]" : "text-white/40"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${errorCount ? "bg-[#F08A6C]" : "bg-[#7FE0B8]"}`} />
                {errorCount ? `${errorCount} error${errorCount > 1 ? "es" : ""}` : "Sin errores"}
              </span>
              <span className="text-white/25">·</span>
              <span className="text-white/40">{prototypeProfiles.find((p) => p.id === profileId)?.id === "desktop-default" ? "Perfil flexible" : prototypeProfiles.find((p) => p.id === profileId)?.label}</span>
            </div>
          </div>
          <div className="min-h-0 flex-1 select-text">
            <PrototypeEditor
              currentLine={activeLine}
              diagnostics={diagnostics}
              fontSize={fontSize}
              highlightLine={linkLine}
              onChange={setSource}
              onReady={(instance) => {
                editorRef.current = instance;
                instance.onDidChangeCursorPosition((event) => {
                  const word = instance.getModel()?.getWordAtPosition(event.position)?.word ?? null;
                  setCursorWord(word);
                });
              }}
              readOnly={player.live}
              theme="mellow"
              value={source}
            />
          </div>
        </div>

        <Divider axis="x" onDrag={(d) => setMiddleWidth((w) => Math.min(760, Math.max(300, w - d)))} />

        {/* Views + console */}
        <div className="flex shrink-0 flex-col" style={{ width: middleWidth }}>
          <div className="flex h-[32px] shrink-0 items-center gap-0.5 border-b border-white/[0.06] bg-[#181B1D] px-2">
            {(
              [
                ["diagrama", "Diagrama"],
                ["traduccion", `Código ${langName}`],
                ["prueba", "Prueba de escritorio"],
              ] as [View, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                className={`h-[22px] rounded-[5px] px-2.5 text-[12px] ${view === id ? "bg-white/[0.1] text-white" : "text-white/50 hover:text-white/80"}`}
                onClick={() => setView(id)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 bg-[#121517]">
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
            {view === "traduccion" && (
              <div className="h-full select-text">
                <TranslationPane language={language} settings={settings} source={source} />
              </div>
            )}
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
          {showConsole && (
            <>
              <Divider axis="y" onDrag={(d) => setConsoleHeight((h) => Math.min(520, Math.max(120, h - d)))} />
              <div className="flex shrink-0 flex-col bg-[#141719]" style={{ height: consoleHeight }}>
                <div className="flex h-[28px] shrink-0 items-center gap-2 border-b border-white/[0.05] px-3 text-[11px] font-semibold tracking-[0.06em] text-white/40 uppercase">
                  Consola
                  {player.status === "input" && !player.scrubbing && (
                    <span className="rounded-[4px] bg-[#7FE0B8]/15 px-1.5 py-px tracking-normal text-[#A9F0D2] normal-case">
                      Tu programa te pregunta algo
                    </span>
                  )}
                </div>
                <div className="min-h-0 flex-1 select-text">
                  <PlayerConsole player={player} />
                </div>
              </div>
            </>
          )}
        </div>

        {showReference && (
          <>
            <Divider axis="x" onDrag={(d) => setReferenceWidth((w) => Math.min(480, Math.max(240, w - d)))} />
            <div className="flex shrink-0 flex-col bg-[#181B1D]" style={{ width: referenceWidth }}>
              <div className="flex h-[32px] shrink-0 items-center justify-between border-b border-white/[0.06] px-3">
                <span className="text-[12px] font-semibold text-white/80">Referencia</span>
                <button className="rounded p-0.5 text-white/35 hover:text-white/80" onClick={() => setShowReference(false)} type="button">
                  <X size={13} />
                </button>
              </div>
              <div className="min-h-0 flex-1">
                <ReferenceInspector catalog={catalog} cursorWord={cursorWord} onInsert={insert} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Transport bar */}
      <div className="grid h-[58px] shrink-0 grid-cols-[minmax(0,1fr)_minmax(320px,1.2fr)_minmax(0,1fr)] items-center gap-5 border-t border-black/50 bg-[#1D2124] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="min-w-0">
          <div className="text-[10.5px] font-semibold tracking-[0.08em] text-white/40 uppercase">{statusLabel}</div>
          <div className="truncate font-mono text-[13px] text-white/90">
            {nowText ?? (player.status === "done" ? "Programa terminado" : "Pulsa ▶ para ejecutar")}
            {activeLine && <span className="ml-2 font-sans text-[11.5px] text-white/35">línea {activeLine}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            {[
              { icon: <SkipBack fill="currentColor" size={14} />, label: "Paso anterior (⇧F10)", onClick: player.stepBack, disabled: player.frameCount === 0 },
            ].map((b) => (
              <button key={b.label} className="grid h-8 w-8 place-items-center rounded-full text-white/70 hover:bg-white/[0.07] hover:text-white disabled:opacity-30" disabled={b.disabled} onClick={b.onClick} title={b.label} type="button">
                {b.icon}
              </button>
            ))}
            <button
              aria-label={player.wantPlay ? "Pausar" : "Ejecutar"}
              className="mx-1 grid h-9 w-9 place-items-center rounded-full bg-[#F2F7F4] text-[#0E1214] shadow-[0_2px_8px_rgba(0,0,0,0.4)] active:scale-95"
              onClick={togglePlay}
              title={`${player.wantPlay ? "Pausar" : "Ejecutar"} (${k("↵")})`}
              type="button"
            >
              {player.wantPlay ? <Pause fill="currentColor" size={15} /> : <Play className="ml-0.5" fill="currentColor" size={15} />}
            </button>
            <button className="grid h-8 w-8 place-items-center rounded-full text-white/70 hover:bg-white/[0.07] hover:text-white" onClick={player.stepForward} title="Paso siguiente (F10)" type="button">
              <SkipForward fill="currentColor" size={14} />
            </button>
            <button className="grid h-8 w-8 place-items-center rounded-full text-white/70 hover:bg-white/[0.07] hover:text-white disabled:opacity-30" disabled={!player.live} onClick={player.stop} title="Detener (Esc)" type="button">
              <Square fill="currentColor" size={12} />
            </button>
          </div>
          <span className="w-8 text-right text-[11px] text-white/40 tabular-nums">{player.frameCount ? player.viewIndex + 1 : 0}</span>
          <input
            className="proto-range min-w-0 flex-1"
            disabled={player.frameCount < 2}
            max={Math.max(0, player.frameCount - 1)}
            min={0}
            onChange={(event) => player.seek(Number(event.target.value))}
            style={{
              background: `linear-gradient(90deg, #7FE0B8 ${player.frameCount > 1 ? (player.viewIndex / (player.frameCount - 1)) * 100 : 0}%, rgba(255,255,255,0.13) 0)`,
            }}
            type="range"
            value={Math.max(0, player.viewIndex)}
          />
          <span className="w-8 text-[11px] text-white/40 tabular-nums">{player.frameCount}</span>
        </div>
        <div className="flex min-w-0 items-center justify-end gap-4">
          <div className="flex min-w-0 gap-1.5 overflow-hidden">
            {[...player.changed].slice(0, 3).map((name) => {
              const now = player.frame?.variables.find((v) => v.name === name);
              const before = player.previous?.variables.find((v) => v.name === name);
              return (
                <span key={name} className="shrink-0 rounded-[5px] bg-[#7FE0B8]/10 px-2 py-0.5 font-mono text-[11.5px] text-[#CFF5E4]">
                  {name} <span className="text-white/35">{before?.initialized ? formatValue(before.value) : "∅"}→</span>
                  {now ? formatValue(now.value) : ""}
                </span>
              );
            })}
          </div>
          <div className="flex shrink-0 items-center gap-1.5 text-white/40" title={`Velocidad: ${SPEEDS[player.speedIndex].label}`}>
            <Turtle size={13} />
            {SPEEDS.map((speed, index) => (
              <button
                key={speed.id}
                aria-label={speed.label}
                className={`rounded-full ${index === player.speedIndex ? "h-2 w-2 bg-[#7FE0B8]" : "h-1.5 w-1.5 bg-white/25 hover:bg-white/50"}`}
                onClick={() => player.setSpeedIndex(index)}
                type="button"
              />
            ))}
            <Rabbit size={13} />
          </div>
        </div>
      </div>

      {toast && (
        <div className="pointer-events-none fixed bottom-[74px] left-1/2 z-[250] -translate-x-1/2 rounded-[8px] border border-white/10 bg-[#2A3033]/95 px-3.5 py-2 text-[12.5px] text-white shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur">
          {toast}
        </div>
      )}

      {paletteOpen && (
        <CommandPalette
          menus={menus}
          onClose={() => setPaletteOpen(false)}
          onPickReference={(entry) => {
            setShowReference(true);
            insert(entry.example);
          }}
          reference={catalog.entries}
        />
      )}

      {shortcutsOpen && (
        <div className="fixed inset-0 z-[300] grid place-items-center bg-black/40" onMouseDown={() => setShortcutsOpen(false)}>
          <div className="w-[520px] rounded-[12px] border border-white/10 bg-[#23282B] p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
            <div className="mb-3 text-[15px] font-semibold">Atajos de teclado</div>
            {[
              ["Ejecutar / pausar", k("↵")],
              ["Paso siguiente / anterior", "F10 / ⇧F10"],
              ["Pausar (fuera del editor)", "Espacio"],
              ["Detener", "Esc"],
              ["Buscar acciones y comandos", k("K")],
              ["Mostrar referencia", k("R", true)],
              ["Diagrama · Código · Prueba", `${k("1")} ${k("2")} ${k("3")}`],
              ["Guardar / Abrir / Nuevo", `${k("S")} ${k("O")} ${k("N")}`],
            ].map(([label, keys]) => (
              <div key={label} className="flex justify-between border-b border-white/[0.05] py-2 text-[13px]">
                <span className="text-white/75">{label}</span>
                <span className="text-white/45">{keys}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
