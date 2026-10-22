"use client";

// The Codoritmo workspace: a desktop-style IDE that degrades gracefully.
//
// • Menu bar (Archivo/Editar/Ejecutar/Ver/Ayuda) with native menu behaviour and
//   shortcuts that take precedence over the browser's (⌘S saves the program).
// • Editor first: it always keeps its space. The bottom panel holds Consola /
//   Prueba de escritorio / Problemas; the side panel holds Diagrama / Código /
//   Referencia and docks when wide, floats over the editor when narrow.
// • Execution as playback: play/pause, step, rewind through recorded steps,
//   speed — with the flowchart and editor following along.

import {
  BookOpen,
  ChevronDown,
  Code,
  PanelBottom,
  Pause,
  Play,
  Plus,
  Rabbit,
  Search,
  SkipBack,
  SkipForward,
  Square,
  Turtle,
  Workflow,
  X,
} from "lucide-react";
import type { editor } from "monaco-editor";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { buildFlowDiagram, exportRoutineToPng, exportRoutineToSvg, layoutFlowDiagram } from "@/src/diagram";
import {
  examplePrograms,
  exportLanguages,
  generateExport,
  normalizeEngineSettings,
  Parser,
  settingsEqual,
  type EngineSettings,
  type ExportLanguage,
} from "@/src/engine";
import type { Locale } from "@/src/i18n/config";
import { formatMessage, formatPlural } from "@/src/i18n/format";
import type { Dictionary } from "@/src/i18n/types";
import { isExamplesNewWorkspaceTabIntent } from "@/src/lib/workspace-deeplink";
import CodeEditor from "./code-editor";
import { CommandPalette } from "./command-palette";
import {
  buildShareUrl,
  createDocument,
  decodeProgramFile,
  defaultPrefs,
  downloadText,
  downloadUrl,
  loadWorkspace,
  nameFromSource,
  profileSettings,
  readSharedDocument,
  saveWorkspace,
  type WorkspaceDocument,
  type WorkspacePrefs,
} from "./documents";
import FlowDiagram from "./flow-diagram";
import { registerLanguageServices, type LanguageCatalog } from "./language-services";
import { MenuBar, type Menu, type MenuItem } from "./menu-bar";
import { ConsolePanel, DeskCheckPanel, formatValue, TranslationPanel, type TraceRow } from "./panels";
import { profileLabel, ProfileDialog } from "./profile-dialog";
import { ReferencePanel, useReferenceCatalog, type ReferenceEntry } from "./reference-panel";
import { SPEEDS, usePlayer } from "./use-player";

type SideTab = WorkspacePrefs["sideTab"];
type BottomTab = WorkspacePrefs["bottomTab"];

const LANGUAGE_NAMES: Record<string, string> = { c: "C", cpp: "C++", javascript: "JavaScript", python: "Python", java: "Java" };
const SOON = ["C#", "PHP", "Pascal", "Visual Basic", "QBasic", "MatLab"];
const LANGUAGES = Object.keys(exportLanguages).map((id) => ({
  id: id as ExportLanguage,
  name: LANGUAGE_NAMES[id] ?? id.toUpperCase(),
  ext: exportLanguages[id as ExportLanguage].fileExtension,
}));

/** Below this workspace width the side panel floats over the editor instead of docking. */
const DOCK_MIN_WIDTH = 1100;
const EDITOR_MIN_WIDTH = 460;

const BLANK_PROGRAM = `Algoritmo SinTitulo

FinAlgoritmo
`;

const noSubscribe = () => () => {};

/** ⌘ on Apple platforms, Ctrl elsewhere; the server renders the Mac glyphs. */
function useIsMac() {
  return useSyncExternalStore(
    noSubscribe,
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => true
  );
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(1400);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

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

function Tabs<T extends string>({ tabs, value, onChange }: { tabs: [T, string, number?][]; value: T | null; onChange: (id: T) => void }) {
  return (
    <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none]" role="tablist">
      {tabs.map(([id, label, badge]) => (
        <button
          key={id}
          aria-selected={value === id}
          className={`flex h-[22px] shrink-0 items-center gap-1.5 rounded-[5px] px-2.5 text-[12px] whitespace-nowrap ${
            value === id ? "bg-white/[0.1] text-white" : "text-white/50 hover:text-white/80"
          }`}
          onClick={() => onChange(id)}
          role="tab"
          type="button"
        >
          {label}
          {!!badge && <span className="rounded-full bg-[#F08A6C]/80 px-1.5 text-[10px] leading-4 text-white">{badge}</span>}
        </button>
      ))}
    </div>
  );
}

export default function Workspace({ dictionary, locale }: { dictionary: Dictionary; locale: Locale }) {
  const t = dictionary.studio;
  const router = useRouter();
  const mac = useIsMac();
  const k = (key: string, shift = false, alt = false) =>
    mac ? `${alt ? "⌥" : ""}${shift ? "⇧" : ""}⌘${key}` : `Ctrl+${alt ? "Alt+" : ""}${shift ? "Shift+" : ""}${key}`;

  /* ---------- documents & preferences ---------- */
  const [documents, setDocuments] = useState<WorkspaceDocument[]>(() => [
    createDocument(nameFromSource(examplePrograms[0].source, "Programa.psc"), examplePrograms[0].source),
  ]);
  const [activeId, setActiveId] = useState(documents[0].id);
  const [prefs, setPrefs] = useState<WorkspacePrefs>(defaultPrefs);
  const [hydrated, setHydrated] = useState(false);
  const doc = documents.find((d) => d.id === activeId) ?? documents[0];
  const { source, settings } = doc;

  const updatePrefs = useCallback((patch: Partial<WorkspacePrefs>) => setPrefs((p) => ({ ...p, ...patch })), []);
  const updateDoc = useCallback(
    (id: string, patch: Partial<WorkspaceDocument>) => setDocuments((docs) => docs.map((d) => (d.id === id ? { ...d, ...patch } : d))),
    []
  );
  const setSource = (value: string) => updateDoc(doc.id, { source: value });

  const [toast, setToast] = useState<string | null>(null);
  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 2400);
  }, []);

  /* ---------- layout ---------- */
  const [workspaceRef, workspaceWidth] = useWidth<HTMLDivElement>();
  const [overlayOpen, setOverlayOpen] = useState(false);
  const docked = workspaceWidth >= DOCK_MIN_WIDTH;
  const sideOpen = docked ? prefs.sidePanelOpen : overlayOpen;
  const setSideOpen = (open: boolean) => (docked ? updatePrefs({ sidePanelOpen: open }) : setOverlayOpen(open));
  const sideWidth = docked
    ? Math.max(300, Math.min(prefs.sideWidth, workspaceWidth - 40 - EDITOR_MIN_WIDTH))
    : Math.min(460, Math.max(280, workspaceWidth - 100));
  const narrow = workspaceWidth < 760;
  const phone = workspaceWidth < 560;

  /* ---------- engine ---------- */
  const player = usePlayer(source, settings, { endOfProgram: t.endOfProgram, stopped: t.stoppedLine, pressEnter: t.pressEnter, line: t.line });
  const catalog = useReferenceCatalog(dictionary, settings);
  const catalogRef = useRef<LanguageCatalog>(catalog);
  catalogRef.current = catalog;
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const routineRef = useRef<string | null>(null);

  const [paletteQuery, setPaletteQuery] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [cursorWord, setCursorWord] = useState<string | null>(null);
  const [linkLine, setLinkLine] = useState<number | null>(null);

  const language = (exportLanguages[prefs.language as ExportLanguage] ? prefs.language : "c") as ExportLanguage;
  const langName = LANGUAGE_NAMES[language] ?? language;
  const dirty = doc.source !== doc.savedSource;
  const customized = !settingsEqual(settings, profileSettings(doc.profileId));
  const showPlayhead = player.live || player.scrubbing;
  const activeLine = showPlayhead ? player.frame?.line ?? null : null;
  const errors = player.parseDiagnostics.filter((d) => d.severity === "error");
  const diagnostics = player.runtimeError ? [...player.parseDiagnostics, player.runtimeError] : player.parseDiagnostics;
  const sourceLines = useMemo(() => source.split("\n"), [source]);
  const asking = player.status === "input" && !player.scrubbing;
  const speedLabel = t.run.speeds[SPEEDS[player.speedIndex].id];

  /* ---------- restore, persist, shared links ---------- */
  useEffect(() => {
    const restored = loadWorkspace();
    let docs = restored?.documents ?? null;
    let active = restored?.activeId ?? null;
    if (restored) setPrefs(restored.prefs);
    if (docs) {
      setDocuments(docs);
      setActiveId(active!);
    }
    const hash = window.location.hash;
    void readSharedDocument(hash).then((shared) => {
      if (shared) {
        docs = [...(docs ?? []), shared];
        active = shared.id;
        setDocuments(docs);
        setActiveId(shared.id);
        notify(t.linkOpened);
      }
      if (hash) history.replaceState(null, "", window.location.pathname + window.location.search);
      if (isExamplesNewWorkspaceTabIntent(window.location.search)) {
        setPaletteQuery(t.file.openExample);
        history.replaceState(null, "", window.location.pathname);
      }
      setHydrated(true);
    });
    // Restore once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => saveWorkspace({ documents, activeId, prefs: { ...prefs, speedIndex: player.speedIndex } }), 300);
    return () => window.clearTimeout(timer);
  }, [activeId, documents, hydrated, player.speedIndex, prefs]);

  useEffect(() => {
    if (hydrated) player.setSpeedIndex(prefs.speedIndex);
    // Apply the saved speed once after restoring.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // Warn before closing the page with unsaved edits.
  useEffect(() => {
    const anyDirty = documents.some((d) => d.source !== d.savedSource);
    if (!anyDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [documents]);

  // A question from the program always surfaces the console.
  useEffect(() => {
    if (asking) updatePrefs({ bottomTab: "consola", bottomOpen: true });
  }, [asking, updatePrefs]);

  /* ---------- derived views ---------- */
  const visitedLines = useMemo(() => {
    const set = new Set<number>();
    const upto = showPlayhead || player.status === "done" ? player.viewIndex : -1;
    for (let i = 0; i <= upto && i < player.frames.length; i += 1) set.add(player.frames[i].line);
    return set;
    // Frames live in a ref; frameCount/viewIndex are the change signals.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.viewIndex, player.frameCount, showPlayhead, player.status]);

  const trace = useMemo<TraceRow[]>(
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
  const openSide = (tab: SideTab) => {
    updatePrefs({ sideTab: tab });
    setSideOpen(true);
  };
  const toggleSide = (tab: SideTab) => (sideOpen && prefs.sideTab === tab ? setSideOpen(false) : openSide(tab));
  const openBottom = (tab: BottomTab) => updatePrefs({ bottomTab: tab, bottomOpen: true });

  const editorAction = (id: string) => {
    editorRef.current?.focus();
    editorRef.current?.trigger("menu", id, null);
  };
  const insert = (text: string) => {
    const instance = editorRef.current;
    const selection = instance?.getSelection();
    if (!instance || !selection || player.live) return;
    instance.executeEdits("reference", [{ range: selection, text, forceMoveMarkers: true }]);
    instance.focus();
  };
  const reveal = (line: number) => {
    setLinkLine(line);
    editorRef.current?.revealLineInCenter(line);
    editorRef.current?.setPosition({ lineNumber: line, column: 1 });
    editorRef.current?.focus();
  };

  const openDocument = (next: WorkspaceDocument) => {
    player.stop();
    setDocuments((docs) => [...docs, next]);
    setActiveId(next.id);
  };
  const switchTo = (id: string) => {
    if (id === activeId) return;
    player.stop();
    setActiveId(id);
  };
  const closeDocument = (id: string) => {
    const target = documents.find((d) => d.id === id);
    if (!target) return;
    if (target.source !== target.savedSource && !window.confirm(`${target.name} — ${t.unsaved}. ${t.file.closeTab}?`)) return;
    if (id === activeId) player.stop();
    const remaining = documents.filter((d) => d.id !== id);
    if (remaining.length === 0) {
      const fresh = createDocument("SinTitulo.psc", BLANK_PROGRAM);
      setDocuments([fresh]);
      setActiveId(fresh.id);
      return;
    }
    setDocuments(remaining);
    if (id === activeId) setActiveId(remaining[Math.max(0, documents.findIndex((d) => d.id === id) - 1)].id);
  };
  const save = () => {
    downloadText(doc.name, doc.source);
    updateDoc(doc.id, { savedSource: doc.source });
    notify(formatMessage(t.saved, { name: doc.name }));
  };
  const rename = () => {
    const next = window.prompt(t.renamePrompt, doc.name)?.trim();
    if (next) updateDoc(doc.id, { name: /\.\w+$/.test(next) ? next : `${next}.psc` });
  };
  const parseOrNotify = () => {
    const parsed = new Parser(source, { settings }).parse();
    if (!parsed.program) notify(t.exportNeedsFix);
    return parsed.program;
  };
  const exportCode = (id: ExportLanguage, target?: "browser" | "node") => {
    const program = parseOrNotify();
    if (!program) return;
    const code = generateExport(program, id, { settings, target }).code;
    if (!code) return notify(t.exportNeedsFix);
    const ext = exportLanguages[id].fileExtension;
    downloadText(doc.name.replace(/\.psc$/i, "") + (target === "node" ? ".node" : "") + `.${ext}`, code, exportLanguages[id].mimeType);
    notify(formatMessage(t.exported, { lang: LANGUAGE_NAMES[id] ?? id }));
  };
  const exportDiagram = async (format: "png" | "svg") => {
    const program = parseOrNotify();
    if (!program) return;
    const layout = await layoutFlowDiagram(buildFlowDiagram(program));
    const routine = layout.routines.find((r) => r.id === routineRef.current) ?? layout.routines[0];
    if (!routine) return;
    const base = doc.name.replace(/\.psc$/i, "");
    const suffix = layout.routines.length > 1 ? `-${routine.label.replace(/[^\p{L}\p{N}]+/gu, "-")}` : "";
    if (format === "svg") {
      downloadText(`${base}${suffix}.svg`, exportRoutineToSvg(routine).svg, "image/svg+xml");
    } else {
      downloadUrl(`${base}${suffix}.png`, (await exportRoutineToPng(routine)).dataUrl);
    }
    notify(formatMessage(t.exported, { lang: format.toUpperCase() }));
  };
  const share = async () => {
    const url = await buildShareUrl(doc);
    try {
      await navigator.clipboard.writeText(url);
      notify(t.linkCopied);
    } catch {
      // Clipboard can be blocked; let the user copy it by hand instead.
      window.prompt(t.file.shareLink, url);
    }
  };
  const pickProfile = (id: string) => updateDoc(doc.id, { profileId: id, settings: profileSettings(id) });
  const toggleSetting = (key: keyof EngineSettings, value: boolean) =>
    updateDoc(doc.id, { settings: normalizeEngineSettings({ ...settings, [key]: value }) });
  const togglePlay = () => (player.wantPlay ? player.pause() : player.play());
  const setFontSize = (delta: number) => updatePrefs({ fontSize: Math.min(22, Math.max(12, prefs.fontSize + delta)) });

  const insertItems: MenuItem[] = ["SI", "PARA", "MIENTRAS", "REPETIR", "SEGUN", "LEER", "ESCRIBIR", "DEFINIR"]
    .map((word) => catalog.lookup(word))
    .filter((entry): entry is ReferenceEntry => !!entry)
    .map((entry) => ({ label: entry.label, onSelect: () => insert(entry.example) }));

  const menus: Menu[] = [
    {
      label: t.menus.file,
      items: [
        { label: t.file.new, shortcut: k("N"), onSelect: () => openDocument(createDocument("SinTitulo.psc", BLANK_PROGRAM)) },
        { label: t.file.open, shortcut: k("O"), onSelect: () => fileInputRef.current?.click() },
        {
          label: t.file.openExample,
          submenu: examplePrograms.map((example) => ({
            label: dictionary.examples[example.id]?.label ?? example.label,
            onSelect: () => openDocument(createDocument(nameFromSource(example.source, `${example.id}.psc`), example.source, example.profileId)),
          })),
        },
        { separator: true },
        { label: t.file.save, shortcut: k("S"), onSelect: save },
        { label: t.file.rename, onSelect: rename },
        {
          label: t.file.exportAs,
          submenu: [
            ...LANGUAGES.flatMap((l): MenuItem[] =>
              exportLanguages[l.id].supportsTargets
                ? [
                    { label: `${l.name} (${dictionary.workspace.browser})`, onSelect: () => exportCode(l.id, "browser") },
                    { label: `${l.name} (${dictionary.workspace.node})`, onSelect: () => exportCode(l.id, "node") },
                  ]
                : [{ label: `${l.name} (.${l.ext})`, onSelect: () => exportCode(l.id) }]
            ),
            { separator: true },
            { label: t.file.diagramPng, onSelect: () => void exportDiagram("png") },
            { label: t.file.diagramSvg, onSelect: () => void exportDiagram("svg") },
          ],
        },
        { label: t.file.shareLink, onSelect: () => void share() },
        { separator: true },
        { label: t.file.closeTab, shortcut: mac ? "⌃W" : "Ctrl+Alt+W", onSelect: () => closeDocument(doc.id) },
      ],
    },
    {
      label: t.menus.edit,
      items: [
        { label: t.edit.undo, shortcut: k("Z"), onSelect: () => editorAction("undo") },
        { label: t.edit.redo, shortcut: k("Z", true), onSelect: () => editorAction("redo") },
        { separator: true },
        { label: t.edit.find, shortcut: k("F"), onSelect: () => editorAction("actions.find") },
        { label: t.edit.replace, shortcut: k("F", false, true), onSelect: () => editorAction("editor.action.startFindReplaceAction") },
        { separator: true },
        { label: t.edit.suggestions, shortcut: mac ? "⌃Espacio" : "Ctrl+Espacio", onSelect: () => editorAction("editor.action.triggerSuggest") },
        { label: t.edit.commentLine, shortcut: k("/"), onSelect: () => editorAction("editor.action.commentLine"), disabled: player.live },
        { label: t.edit.insert, submenu: insertItems, disabled: player.live },
      ],
    },
    {
      label: t.menus.run,
      items: [
        { label: player.live && !player.wantPlay ? t.run.continue : t.run.run, shortcut: k("↵"), onSelect: player.play, disabled: player.wantPlay },
        { label: t.run.pause, shortcut: "Espacio", onSelect: player.pause, disabled: !player.wantPlay },
        { label: t.run.stepNext, shortcut: "F10", onSelect: player.stepForward },
        { label: t.run.stepBack, shortcut: "⇧F10", onSelect: player.stepBack, disabled: player.frameCount === 0 },
        { label: t.run.stop, shortcut: "Esc", onSelect: player.stop, disabled: !player.live },
        { separator: true },
        {
          label: t.run.speed,
          submenu: SPEEDS.map((speed, index) => ({
            label: t.run.speeds[speed.id],
            checked: index === player.speedIndex,
            onSelect: () => player.setSpeedIndex(index),
          })),
        },
        {
          label: t.run.profile,
          submenu: [
            ...["desktop-default", "flexible", "estricto"].map((id) => ({
              label: profileLabel(id, dictionary),
              checked: doc.profileId === id && !customized,
              onSelect: () => pickProfile(id),
            })),
            { separator: true },
            { label: t.run.moreProfiles, onSelect: () => setProfileOpen(true) },
            { label: t.run.customize, onSelect: () => setProfileOpen(true) },
          ],
        },
      ],
    },
    {
      label: t.menus.view,
      items: [
        { label: t.view.diagram, shortcut: k("1"), checked: sideOpen && prefs.sideTab === "diagrama", onSelect: () => toggleSide("diagrama") },
        { label: formatMessage(t.view.code, { lang: langName }), shortcut: k("2"), checked: sideOpen && prefs.sideTab === "traduccion", onSelect: () => toggleSide("traduccion") },
        { label: t.view.reference, shortcut: k("3"), checked: sideOpen && prefs.sideTab === "referencia", onSelect: () => toggleSide("referencia") },
        { separator: true },
        { label: t.view.bottomPanel, shortcut: k("J"), checked: prefs.bottomOpen, onSelect: () => updatePrefs({ bottomOpen: !prefs.bottomOpen }) },
        { label: t.view.console, checked: prefs.bottomOpen && prefs.bottomTab === "consola", onSelect: () => openBottom("consola") },
        { label: t.view.deskCheck, checked: prefs.bottomOpen && prefs.bottomTab === "prueba", onSelect: () => openBottom("prueba") },
        { label: t.view.problems, checked: prefs.bottomOpen && prefs.bottomTab === "problemas", onSelect: () => openBottom("problemas") },
        { separator: true },
        {
          label: t.view.translateTo,
          submenu: [
            ...LANGUAGES.map((l) => ({
              label: l.name,
              checked: l.id === language,
              onSelect: () => {
                updatePrefs({ language: l.id });
                openSide("traduccion");
              },
            })),
            { separator: true },
            ...SOON.map((name) => ({ label: name, disabled: true, hint: t.view.comingSoon })),
          ],
        },
        { separator: true },
        { label: t.view.zoomIn, shortcut: k("+"), onSelect: () => setFontSize(1) },
        { label: t.view.zoomOut, shortcut: k("−"), onSelect: () => setFontSize(-1) },
        {
          label: t.view.fullscreen,
          shortcut: mac ? "⌃⌘F" : "F11",
          onSelect: () => {
            const request = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
            void request.catch(() => undefined);
          },
        },
      ],
    },
    {
      label: t.menus.help,
      items: [
        { label: t.help.palette, shortcut: k("K"), onSelect: () => setPaletteQuery("") },
        { label: t.help.reference, shortcut: k("3"), onSelect: () => openSide("referencia") },
        { label: t.help.shortcuts, shortcut: k("?"), onSelect: () => setShortcutsOpen(true) },
        { separator: true },
        { label: t.help.about, onSelect: () => router.push(`/${locale}/about`) },
        { label: t.help.officialSite, onSelect: () => window.open("https://pseint.sourceforge.net", "_blank", "noopener") },
      ],
    },
  ];

  /* ---------- global shortcuts (take precedence over the browser's) ---------- */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (profileOpen || paletteQuery !== null) return; // dialogs handle their own keys
      const mod = mac ? event.metaKey : event.ctrlKey;
      const target = (event.target instanceof Element ? event.target : document.body) as HTMLElement;
      const typing = !!target.closest(".monaco-editor, input, textarea");
      const key = event.key.toLowerCase();
      const handled = (fn: () => void) => {
        event.preventDefault();
        event.stopPropagation();
        fn();
      };
      if (mod && key === "k") return handled(() => setPaletteQuery(""));
      if (mod && key === "s") return handled(save);
      if (mod && key === "o") return handled(() => fileInputRef.current?.click());
      if (mod && key === "n") return handled(() => openDocument(createDocument("SinTitulo.psc", BLANK_PROGRAM)));
      if (mod && key === "enter") return handled(togglePlay);
      if (mod && key === "j") return handled(() => updatePrefs({ bottomOpen: !prefs.bottomOpen }));
      if (mod && ["1", "2", "3"].includes(key))
        return handled(() => toggleSide((["diagrama", "traduccion", "referencia"] as SideTab[])[Number(key) - 1]));
      if (mod && (key === "=" || key === "+")) return handled(() => setFontSize(1));
      if (mod && key === "-") return handled(() => setFontSize(-1));
      if (mod && key === "?") return handled(() => setShortcutsOpen(true));
      if (event.ctrlKey && event.altKey && key === "w") return handled(() => closeDocument(doc.id));
      if (mac && event.ctrlKey && !event.metaKey && key === "w") return handled(() => closeDocument(doc.id));
      if (event.key === "F10") return handled(event.shiftKey ? player.stepBack : player.stepForward);
      if (event.key === "Escape" && !docked && sideOpen && !player.live) return handled(() => setSideOpen(false));
      if (event.key === "Escape" && player.live) return handled(player.stop);
      if (typing) return;
      if (event.key === " ") return handled(togglePlay);
      if (event.key === "ArrowRight") return handled(player.stepForward);
      if (event.key === "ArrowLeft") return handled(player.stepBack);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  const nowText = activeLine ? sourceLines[activeLine - 1]?.trim() : null;
  const statusLabel = player.scrubbing ? formatMessage(t.status.rewound, { n: player.viewIndex + 1 }) : t.status[player.status];
  const errorLabel = errors.length ? formatPlural(t.errorCount, errors.length) : t.noErrors;

  const sidePanel = (
    <div className="flex h-full flex-col bg-[#161A1C]">
      <div className="flex h-[32px] shrink-0 items-center gap-2 border-b border-white/[0.06] px-2">
        <Tabs<SideTab>
          onChange={(tab) => updatePrefs({ sideTab: tab })}
          tabs={[
            ["diagrama", t.activity.diagram],
            ["traduccion", formatMessage(t.activity.code, { lang: langName })],
            ["referencia", t.activity.reference],
          ]}
          value={prefs.sideTab}
        />
        <button aria-label={t.closePanel} className="ml-auto shrink-0 rounded p-1 text-white/35 hover:text-white/80" onClick={() => setSideOpen(false)} title={t.closePanel} type="button">
          <X size={13} />
        </button>
      </div>
      <div className="min-h-0 flex-1">
        {prefs.sideTab === "diagrama" && (
          <FlowDiagram
            activeLine={activeLine}
            onPickLine={reveal}
            onRoutineChange={(id) => {
              routineRef.current = id;
            }}
            routineName={showPlayhead ? player.frame?.routine ?? null : null}
            settings={settings}
            source={source}
            visitedLines={visitedLines}
          />
        )}
        {prefs.sideTab === "traduccion" && (
          <div className="flex h-full flex-col">
            <div className="flex shrink-0 flex-wrap items-center gap-1 px-3 pt-2">
              {LANGUAGES.map((l) => (
                <button
                  key={l.id}
                  className={`h-[22px] rounded-[5px] px-2 text-[11.5px] ${language === l.id ? "bg-white/[0.1] text-white" : "text-white/45 hover:text-white/80"}`}
                  onClick={() => updatePrefs({ language: l.id })}
                  type="button"
                >
                  {l.name}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1">
              <TranslationPanel dictionary={dictionary} language={language} settings={settings} source={source} />
            </div>
          </div>
        )}
        {prefs.sideTab === "referencia" && <ReferencePanel catalog={catalog} cursorWord={cursorWord} dictionary={dictionary} onInsert={insert} />}
      </div>
    </div>
  );

  return (
    <div
      className="flex h-[100dvh] flex-col overflow-hidden bg-[#141719] text-[#E6ECE9] select-none"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", var(--font-geist-sans), sans-serif' }}
    >
      <input
        ref={fileInputRef}
        accept=".psc,.txt"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          const text = decodeProgramFile(new Uint8Array(await file.arrayBuffer()));
          openDocument(createDocument(file.name, text, doc.profileId));
          notify(formatMessage(t.opened, { name: file.name }));
        }}
        type="file"
      />

      {/* Menu bar */}
      <div className="flex h-[34px] shrink-0 items-center gap-2 border-b border-black/40 bg-[#1D2124] px-2 shadow-[inset_0_-1px_0_rgba(255,255,255,0.04)]">
        <div className="shrink-0">
          <MenuBar
            compact={phone}
            leading={
              <div className="mr-1.5 ml-1 grid h-[18px] w-[18px] place-items-center rounded-[5px] bg-gradient-to-br from-[#7FE0B8] to-[#2F8F6E] text-[10.5px] font-bold text-[#0E1214]">
                C
              </div>
            }
            menus={menus}
          />
        </div>
        <div className="min-w-0 flex-1 truncate text-center text-[12.5px] text-white/50">
          {!narrow && (
            <>
              {doc.name.replace(/\.psc$/i, "")}
              {dirty && <span className="text-white/30"> — {t.edited}</span>}
            </>
          )}
        </div>
        <button
          className="flex h-[24px] shrink-0 items-center gap-2 rounded-[6px] border border-white/[0.07] bg-black/20 px-2 text-[12px] text-white/45 hover:text-white/75"
          onClick={() => setPaletteQuery("")}
          type="button"
        >
          <Search size={12} />
          {!narrow && t.search}
          <span className="text-white/30">{k("K")}</span>
        </button>
      </div>

      {/* Workspace */}
      <div ref={workspaceRef} className="relative flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Document tabs */}
          <div className="flex h-[32px] shrink-0 items-end gap-2 border-b border-white/[0.06] bg-[#181B1D] pl-2">
            <div className="flex min-w-0 items-end gap-px overflow-x-auto [scrollbar-width:none]" role="tablist">
              {documents.map((d) => {
                const active = d.id === doc.id;
                const edited = d.source !== d.savedSource;
                return (
                  <div
                    key={d.id}
                    aria-selected={active}
                    className={`group flex h-[28px] max-w-[200px] shrink-0 cursor-default items-center gap-2 rounded-t-[7px] border border-b-0 pr-1.5 pl-3 text-[12.5px] whitespace-nowrap ${
                      active ? "border-white/[0.07] bg-[#141719] text-white" : "border-transparent text-white/45 hover:text-white/75"
                    }`}
                    onClick={() => switchTo(d.id)}
                    onDoubleClick={rename}
                    onMouseDown={(event) => {
                      if (event.button === 1) {
                        event.preventDefault();
                        closeDocument(d.id);
                      }
                    }}
                    role="tab"
                  >
                    <span className="truncate">{d.name}</span>
                    <button
                      aria-label={`${t.file.closeTab}: ${d.name}`}
                      className="grid h-4 w-4 shrink-0 place-items-center rounded hover:bg-white/10"
                      onClick={(event) => {
                        event.stopPropagation();
                        closeDocument(d.id);
                      }}
                      title={edited ? t.unsaved : t.file.closeTab}
                      type="button"
                    >
                      {edited ? (
                        <>
                          <span className="h-[7px] w-[7px] rounded-full bg-white/55 group-hover:hidden" />
                          <X className="hidden text-white/60 group-hover:block" size={11} />
                        </>
                      ) : (
                        <X className={active ? "text-white/40" : "text-transparent group-hover:text-white/40"} size={11} />
                      )}
                    </button>
                  </div>
                );
              })}
              <button
                aria-label={t.file.new}
                className="mb-1 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[5px] text-white/40 hover:bg-white/[0.06] hover:text-white/80"
                onClick={() => openDocument(createDocument("SinTitulo.psc", BLANK_PROGRAM))}
                title={`${t.file.new} (${k("N")})`}
                type="button"
              >
                <Plus size={13} />
              </button>
            </div>
            <div className="ml-auto flex h-full min-w-0 shrink items-center gap-2 overflow-hidden pr-2 text-[11.5px] whitespace-nowrap">
              <button
                className={`flex items-center gap-1.5 ${errors.length ? "text-[#F0A48C]" : "text-white/40"}`}
                onClick={() => errors.length && openBottom("problemas")}
                type="button"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${errors.length ? "bg-[#F08A6C]" : "bg-[#7FE0B8]"}`} />
                {errorLabel}
              </button>
              {!narrow && (
                <>
                  <span className="text-white/25">·</span>
                  <button className="truncate text-white/40 hover:text-white/75" onClick={() => setProfileOpen(true)} type="button">
                    {profileLabel(doc.profileId, dictionary)}
                    {customized && ` · ${dictionary.workspace.customProfile}`}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="min-h-[120px] flex-1 select-text">
            <CodeEditor
              currentLine={activeLine}
              diagnostics={diagnostics}
              fontSize={prefs.fontSize}
              highlightLine={linkLine}
              onChange={setSource}
              onMonaco={(monaco) => registerLanguageServices(monaco, () => catalogRef.current)}
              onReady={(instance) => {
                editorRef.current = instance;
                instance.onDidChangeCursorPosition((event) => {
                  setCursorWord(instance.getModel()?.getWordAtPosition(event.position)?.word ?? null);
                });
              }}
              readOnly={player.live}
              value={source}
            />
          </div>

          {/* Bottom panel */}
          {prefs.bottomOpen && <Divider axis="y" onDrag={(d) => updatePrefs({ bottomHeight: Math.min(560, Math.max(110, prefs.bottomHeight - d)) })} />}
          <div className="flex shrink-0 flex-col bg-[#141719]" style={{ height: prefs.bottomOpen ? prefs.bottomHeight : 30 }}>
            <div className="flex h-[30px] shrink-0 items-center gap-2 border-b border-white/[0.05] px-2">
              <Tabs<BottomTab>
                onChange={(id) => (prefs.bottomOpen && prefs.bottomTab === id ? updatePrefs({ bottomOpen: false }) : openBottom(id))}
                tabs={[
                  ["consola", t.view.console],
                  ["prueba", t.view.deskCheck],
                  ["problemas", t.view.problems, errors.length],
                ]}
                value={prefs.bottomOpen ? prefs.bottomTab : null}
              />
              {asking && <span className="shrink-0 truncate rounded-[4px] bg-[#7FE0B8]/15 px-1.5 py-px text-[11px] text-[#A9F0D2]">{t.askingInput}</span>}
              <button
                aria-label={t.togglePanel}
                className="ml-auto shrink-0 rounded p-1 text-white/35 hover:text-white/80"
                onClick={() => updatePrefs({ bottomOpen: !prefs.bottomOpen })}
                title={`${t.togglePanel} (${k("J")})`}
                type="button"
              >
                {prefs.bottomOpen ? <ChevronDown size={13} /> : <PanelBottom size={13} />}
              </button>
            </div>
            {prefs.bottomOpen && (
              <div className="min-h-0 flex-1 select-text">
                {prefs.bottomTab === "consola" && <ConsolePanel dictionary={dictionary} player={player} />}
                {prefs.bottomTab === "prueba" && <DeskCheckPanel dictionary={dictionary} onPickStep={player.seek} trace={trace} />}
                {prefs.bottomTab === "problemas" && (
                  <div className="workspace-scroll h-full overflow-auto py-1 select-none">
                    {diagnostics.length === 0 && <p className="px-4 py-3 text-[12.5px] text-white/40">{t.problemsEmpty}</p>}
                    {diagnostics.map((d, i) => (
                      <button
                        key={i}
                        className="flex w-full items-baseline gap-3 px-4 py-1.5 text-left text-[12.5px] hover:bg-white/[0.04]"
                        onClick={() => reveal(d.line)}
                        type="button"
                      >
                        <span className={d.severity === "error" ? "text-[#F08A6C]" : "text-[#E8C47A]"}>●</span>
                        <span className="flex-1 text-white/80">{d.message}</span>
                        <span className="text-white/35">{formatMessage(t.line, { n: d.line })}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Side panel */}
        {sideOpen && docked && (
          <>
            <Divider axis="x" onDrag={(d) => updatePrefs({ sideWidth: Math.min(760, Math.max(300, prefs.sideWidth - d)) })} />
            <div className="shrink-0" style={{ width: sideWidth }}>
              {sidePanel}
            </div>
          </>
        )}
        {sideOpen && !docked && (
          <>
            <div className="absolute inset-0 right-[40px] z-20 bg-black/25" onMouseDown={() => setSideOpen(false)} />
            <div className="absolute top-0 right-[40px] bottom-0 z-30 border-l border-white/[0.08] shadow-[-20px_0_50px_rgba(0,0,0,0.45)]" style={{ width: sideWidth }}>
              {sidePanel}
            </div>
          </>
        )}

        {/* Activity strip */}
        <div className="z-30 flex w-[40px] shrink-0 flex-col items-center gap-1 border-l border-white/[0.06] bg-[#181B1D] pt-2">
          {(
            [
              ["diagrama", Workflow, t.activity.diagram, "1"],
              ["traduccion", Code, formatMessage(t.activity.code, { lang: langName }), "2"],
              ["referencia", BookOpen, t.activity.reference, "3"],
            ] as const
          ).map(([id, Icon, label, key]) => (
            <button
              key={id}
              aria-label={label}
              aria-pressed={sideOpen && prefs.sideTab === id}
              className={`group relative grid h-8 w-8 place-items-center rounded-[7px] ${
                sideOpen && prefs.sideTab === id ? "bg-white/[0.1] text-white" : "text-white/45 hover:bg-white/[0.05] hover:text-white/85"
              }`}
              onClick={() => toggleSide(id)}
              type="button"
            >
              <Icon size={16} strokeWidth={1.8} />
              <span className="pointer-events-none absolute top-1/2 right-[38px] hidden -translate-y-1/2 rounded-[6px] border border-white/10 bg-[#2A3033] px-2 py-1 text-[12px] whitespace-nowrap text-white shadow-lg group-hover:block">
                {label} <span className="text-white/40">{k(key)}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Transport bar */}
      <div className="flex h-[56px] shrink-0 items-center gap-4 border-t border-black/50 bg-[#1D2124] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        {!narrow && (
          <div className="w-[26%] min-w-0" aria-live="polite">
            <div className="text-[10.5px] font-semibold tracking-[0.08em] text-white/40 uppercase">{statusLabel}</div>
            <div className="truncate font-mono text-[13px] text-white/90">
              {nowText ?? (player.status === "done" ? t.programFinished : t.pressPlay)}
              {activeLine && <span className="ml-2 font-sans text-[11.5px] text-white/35">{formatMessage(t.line, { n: activeLine })}</span>}
            </div>
          </div>
        )}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex shrink-0 items-center">
            <button aria-label={t.run.stepBack} className="grid h-8 w-8 place-items-center rounded-full text-white/70 hover:bg-white/[0.07] hover:text-white disabled:opacity-30" disabled={player.frameCount === 0} onClick={player.stepBack} title={`${t.run.stepBack} (⇧F10)`} type="button">
              <SkipBack fill="currentColor" size={14} />
            </button>
            <button
              aria-label={player.wantPlay ? t.run.pause : t.run.run}
              className="mx-1 grid h-9 w-9 place-items-center rounded-full bg-[#F2F7F4] text-[#0E1214] shadow-[0_2px_8px_rgba(0,0,0,0.4)] active:scale-95"
              onClick={togglePlay}
              title={`${player.wantPlay ? t.run.pause : t.run.run} (${k("↵")})`}
              type="button"
            >
              {player.wantPlay ? <Pause fill="currentColor" size={15} /> : <Play className="ml-0.5" fill="currentColor" size={15} />}
            </button>
            <button aria-label={t.run.stepNext} className="grid h-8 w-8 place-items-center rounded-full text-white/70 hover:bg-white/[0.07] hover:text-white" onClick={player.stepForward} title={`${t.run.stepNext} (F10)`} type="button">
              <SkipForward fill="currentColor" size={14} />
            </button>
            <button aria-label={t.run.stop} className="grid h-8 w-8 place-items-center rounded-full text-white/70 hover:bg-white/[0.07] hover:text-white disabled:opacity-30" disabled={!player.live} onClick={player.stop} title={`${t.run.stop} (Esc)`} type="button">
              <Square fill="currentColor" size={12} />
            </button>
          </div>
          <span className="w-8 shrink-0 text-right text-[11px] text-white/40 tabular-nums">{player.frameCount ? player.viewIndex + 1 : 0}</span>
          <input
            aria-label={statusLabel}
            className="workspace-range min-w-[60px] flex-1"
            disabled={player.frameCount < 2}
            max={Math.max(0, player.frameCount - 1)}
            min={0}
            onChange={(event) => player.seek(Number(event.target.value))}
            style={{ background: `linear-gradient(90deg, #7FE0B8 ${player.frameCount > 1 ? (player.viewIndex / (player.frameCount - 1)) * 100 : 0}%, rgba(255,255,255,0.13) 0)` }}
            type="range"
            value={Math.max(0, player.viewIndex)}
          />
          <span className="w-8 shrink-0 text-[11px] text-white/40 tabular-nums">{player.frameCount}</span>
        </div>
        {workspaceWidth >= 1000 && (
          <div className="flex w-[22%] min-w-0 justify-end gap-1.5 overflow-hidden">
            {[...player.changed].slice(0, 3).map((name) => {
              const now = player.frame?.variables.find((v) => v.name === name);
              const before = player.previous?.variables.find((v) => v.name === name);
              return (
                <span key={name} className="shrink-0 rounded-[5px] bg-[#7FE0B8]/10 px-2 py-0.5 font-mono text-[11.5px] whitespace-nowrap text-[#CFF5E4]">
                  {name} <span className="text-white/35">{before?.initialized ? formatValue(before.value) : "∅"}→</span>
                  {now ? formatValue(now.value) : ""}
                </span>
              );
            })}
          </div>
        )}
        <div className="flex shrink-0 items-center gap-1.5 text-white/40" title={formatMessage(t.speedLabel, { speed: speedLabel })}>
          <Turtle size={13} />
          {SPEEDS.map((speed, index) => (
            <button
              key={speed.id}
              aria-label={t.run.speeds[speed.id]}
              aria-pressed={index === player.speedIndex}
              className={`rounded-full ${index === player.speedIndex ? "h-2 w-2 bg-[#7FE0B8]" : "h-1.5 w-1.5 bg-white/25 hover:bg-white/50"}`}
              onClick={() => player.setSpeedIndex(index)}
              type="button"
            />
          ))}
          <Rabbit size={13} />
        </div>
      </div>

      {toast && (
        <div className="pointer-events-none fixed bottom-[72px] left-1/2 z-[250] max-w-[90vw] -translate-x-1/2 rounded-[8px] border border-white/10 bg-[#2A3033]/95 px-3.5 py-2 text-center text-[12.5px] text-white shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur" role="status">
          {toast}
        </div>
      )}

      {paletteQuery !== null && (
        <CommandPalette
          initialQuery={paletteQuery}
          menus={menus}
          onClose={() => setPaletteQuery(null)}
          onPickReference={(entry) => insert(entry.example)}
          reference={catalog.entries}
          text={t.palette}
        />
      )}

      {profileOpen && (
        <ProfileDialog
          customized={customized}
          dictionary={dictionary}
          onClose={() => setProfileOpen(false)}
          onPickProfile={pickProfile}
          onToggle={toggleSetting}
          profileId={doc.profileId}
          settings={settings}
        />
      )}

      {shortcutsOpen && (
        <div className="fixed inset-0 z-[300] grid place-items-center bg-black/40 p-4" onMouseDown={() => setShortcutsOpen(false)}>
          <div className="w-[520px] max-w-[92vw] rounded-[12px] border border-white/10 bg-[#23282B] p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label={t.shortcuts.title}>
            <div className="mb-3 text-[15px] font-semibold">{t.shortcuts.title}</div>
            {[
              [t.shortcuts.runPause, k("↵")],
              [t.shortcuts.step, "F10 / ⇧F10"],
              [t.shortcuts.pauseOutside, "Espacio"],
              [t.shortcuts.stop, "Esc"],
              [t.shortcuts.suggestions, mac ? "⌃Espacio" : "Ctrl+Espacio"],
              [t.shortcuts.palette, k("K")],
              [t.shortcuts.panels, `${k("1")} ${k("2")} ${k("3")}`],
              [t.shortcuts.bottomPanel, k("J")],
              [t.shortcuts.files, `${k("S")} ${k("O")} ${k("N")}`],
            ].map(([label, keys]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-white/[0.05] py-2 text-[13px]">
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
