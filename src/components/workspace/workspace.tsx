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
  Blocks,
  BookOpen,
  ChartColumn,
  ChevronDown,
  CircleCheck,
  Code,
  FileText,
  Gauge,
  PanelBottom,
  Pause,
  Play,
  Plus,
  Rabbit,
  Search,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  GraduationCap,
  LibraryBig,
  Square,
  SquareTerminal,
  Table2,
  TriangleAlert,
  Turtle,
  Workflow,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { editor } from "monaco-editor";
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from "motion/react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { buildFlowDiagram, exportRoutineToPng, exportRoutineToSvg, layoutFlowDiagram } from "@/src/diagram";
import {
  examplePrograms,
  exportLanguages,
  generateExport,
  normalizeEngineSettings,
  Parser,
  settingsEqual,
  type EngineSettings,
  type ExampleProgram,
  type ExportLanguage,
} from "@/src/engine";
import type { Locale } from "@/src/i18n/config";
import { formatDiagnostic } from "@/src/i18n/diagnostics";
import { formatMessage, formatPlural } from "@/src/i18n/format";
import type { Dictionary } from "@/src/i18n/types";
import { workspaceExampleFromSearch } from "@/src/lib/example-urls";
import { spring } from "@/src/lib/motion";
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
import { ArrayView } from "./array-view";

// PROTOTYPE: Blockly is large, so the blocks mode loads only when first opened.
const BlocksView = dynamic(() => import("./blocks/blocks-view").then((m) => m.BlocksView), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#141719]" />,
});
import { ComplexityPanel } from "./complexity-panel";
import { GitHubMark, REPOSITORY_URL } from "@/src/components/brand/logo-mark";
import { ExamplesBrowser } from "./examples-browser";
import { VariableDock } from "./variable-dock";
import { RunTimeline } from "./run-timeline";
import { LogoMarkAnimated } from "./motion/logo-mark-animated";
import { ConsolePanel, DeskCheckPanel, TranslationPanel, type TraceRow } from "./panels";
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

/**
 * A drag handle between panes. Sizes are computed from where the drag started
 * (not from props captured at pointer-down, which would go stale mid-drag).
 * `size` grows as the pointer moves left/up, which suits panels docked right or bottom.
 */
function Divider({
  axis,
  size,
  min,
  max,
  onResize,
}: {
  axis: "x" | "y";
  size: number;
  min: number;
  /** Upper bound, or a function read when the drag starts (e.g. from the window size). */
  max: number | (() => number);
  onResize: (size: number) => void;
}) {
  return (
    <div
      aria-orientation={axis === "x" ? "vertical" : "horizontal"}
      className={`group relative z-20 shrink-0 touch-none ${axis === "x" ? "w-px cursor-col-resize" : "h-px cursor-row-resize"} bg-white/[0.07]`}
      role="separator"
      onPointerDown={(event) => {
        event.preventDefault();
        const start = axis === "x" ? event.clientX : event.clientY;
        const startSize = size;
        const limit = typeof max === "function" ? max() : max;
        const move = (e: PointerEvent) => {
          const now = axis === "x" ? e.clientX : e.clientY;
          onResize(Math.round(Math.min(limit, Math.max(min, startSize - (now - start)))));
        };
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          window.removeEventListener("pointercancel", up);
          document.body.style.cursor = "";
          document.body.style.userSelect = "";
          delete document.body.dataset.resizing;
        };
        document.body.style.cursor = axis === "x" ? "col-resize" : "row-resize";
        document.body.style.userSelect = "none";
        document.body.dataset.resizing = "";
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", up);
      }}
    >
      <div className={`absolute ${axis === "x" ? "inset-y-0 -left-[3px] w-[7px]" : "inset-x-0 -top-[3px] h-[7px]"} transition-colors group-hover:bg-[#4FB892]/40 group-active:bg-[#4FB892]/60`} />
    </div>
  );
}

/**
 * A Material 3 Expressive style button: a flat tonal shape that morphs on
 * hover (rounder) and press (squarer, slightly squashed) with a spring.
 * The primary one is larger and uses the accent colour.
 */
function ShapeButton({
  children,
  primary,
  compact,
  disabled,
  onClick,
  ariaLabel,
  ariaDescribedBy,
  title,
}: {
  children: React.ReactNode;
  primary?: boolean;
  /** Smaller, for phones. */
  compact?: boolean;
  disabled?: boolean;
  onClick: () => void;
  ariaLabel: string;
  ariaDescribedBy?: string;
  title?: string;
}) {
  const radius = primary ? { rest: 18, hover: 26, press: 12 } : { rest: 20, hover: 13, press: 9 };
  return (
    <motion.button
      animate={{ borderRadius: radius.rest }}
      aria-describedby={ariaDescribedBy}
      aria-label={ariaLabel}
      className={`relative grid place-items-center outline-offset-2 transition-colors focus-visible:outline-2 focus-visible:outline-[#86F0C4] disabled:pointer-events-none disabled:opacity-35 ${
        primary
          ? `${compact ? "h-10 w-12" : "h-11 w-[54px]"} bg-[#86F0C4]/[0.16] text-[#9AF5CF] hover:bg-[#86F0C4]/[0.24]`
          : `${compact ? "h-9 w-9" : "h-10 w-10"} bg-white/[0.07] text-white/80 hover:bg-white/[0.11] hover:text-white`
      }`}
      disabled={disabled}
      initial={false}
      onClick={onClick}
      title={title}
      transition={spring.bouncy}
      type="button"
      whileHover={{ borderRadius: radius.hover }}
      whileTap={{ borderRadius: radius.press, scale: 0.93 }}
    >
      {children}
    </motion.button>
  );
}

interface TabItem<T extends string> {
  id: T;
  label: string;
  icon?: LucideIcon;
  /** Count shown as a red badge (problems). */
  badge?: number;
  /** A pulsing dot: something needs attention here (the program is waiting). */
  dot?: boolean;
}

/** Segmented tabs: icon + label, or icon only (with tooltip) when compact. The selection pill slides between tabs. */
function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  compact,
}: {
  tabs: TabItem<T>[];
  value: T | null;
  onChange: (id: T) => void;
  compact?: boolean;
}) {
  const group = useId();
  return (
    <LayoutGroup id={group}>
      <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none]" role="tablist">
        {tabs.map(({ id, label, icon: Icon, badge, dot }) => (
          <motion.button
            key={id}
            aria-label={label}
            aria-selected={value === id}
            className={`relative flex h-[24px] shrink-0 items-center gap-1.5 rounded-[6px] text-[12px] whitespace-nowrap transition-colors ${
              compact ? "w-[28px] justify-center" : "px-2"
            } ${value === id ? "text-white" : "text-white/50 hover:bg-white/[0.04] hover:text-white/85"}`}
            onClick={() => onChange(id)}
            role="tab"
            title={compact ? label : undefined}
            type="button"
            whileTap={{ scale: 0.96 }}
          >
            {value === id && (
              <motion.span className="absolute inset-0 rounded-[6px] bg-white/[0.09]" layoutId="tab-selection" transition={spring.snappy} />
            )}
            {Icon && <Icon className={`relative ${value === id ? "text-[#86F0C4]" : ""}`} size={13} strokeWidth={1.9} />}
            {!compact && <span className="relative">{label}</span>}
            <AnimatePresence>
              {!!badge && (
                <motion.span
                  key={badge}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`${compact ? "absolute -top-0.5 -right-0.5" : "relative"} min-w-[15px] rounded-full bg-[#E5735A] px-1 text-center text-[9.5px] leading-[15px] font-semibold text-white`}
                  exit={{ scale: 0.4, opacity: 0 }}
                  initial={{ scale: 0.4, opacity: 0 }}
                  transition={spring.bouncy}
                >
                  {badge}
                </motion.span>
              )}
            </AnimatePresence>
            {dot && <span className="codoritmo-attention-dot absolute top-[3px] right-[3px] h-[6px] w-[6px] rounded-full bg-[#86F0C4]" />}
          </motion.button>
        ))}
      </div>
    </LayoutGroup>
  );
}

/** A new tab holding an example, tagged so its guide shows. */
function exampleDocument(example: ExampleProgram) {
  return createDocument(nameFromSource(example.source, `${example.id}.psc`), example.source, example.profileId, example.id);
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
  /** The run toolbar floats over the editor; drop its status text when the editor is narrow. */
  const compactToolbar = workspaceWidth - (sideOpen && docked ? sideWidth : 0) - 40 < 720;
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
  const [examplesOpen, setExamplesOpen] = useState(false);
  const examplesButtonRef = useRef<HTMLButtonElement>(null);
  const [hintShown, setHintShown] = useState(false);
  const [guideExpanded, setGuideExpanded] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [cursorWord, setCursorWord] = useState<string | null>(null);
  const [linkLine, setLinkLine] = useState<number | null>(null);

  const language = (exportLanguages[prefs.language as ExportLanguage] ? prefs.language : "c") as ExportLanguage;
  const langName = LANGUAGE_NAMES[language] ?? language;
  const dirty = doc.source !== doc.savedSource;
  const blocksMode = prefs.editorMode === "blocks";
  const customized = !settingsEqual(settings, profileSettings(doc.profileId));
  const showPlayhead = player.live || player.scrubbing;
  const activeLine = showPlayhead ? player.frame?.line ?? null : null;
  const errors = player.parseDiagnostics.filter((d) => d.severity === "error");
  // Messages in the page's language, for the Problems panel and editor markers.
  const diagnostics = useMemo(
    () =>
      (player.runtimeError ? [...player.parseDiagnostics, player.runtimeError] : player.parseDiagnostics).map((d) => ({
        ...d,
        message: formatDiagnostic(d, dictionary),
      })),
    [player.parseDiagnostics, player.runtimeError, dictionary]
  );
  const sourceLines = useMemo(() => source.split("\n"), [source]);
  const guideExample = doc.exampleId && !doc.guideDismissed ? examplePrograms.find((e) => e.id === doc.exampleId) : undefined;
  const guideCopy = guideExample ? dictionary.examples[guideExample.id] : undefined;
  const guide = guideExample && guideCopy?.learn ? { example: guideExample, copy: guideCopy } : null;
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
      // `?ejemplo=<id>`: open that example with its guide, as the browser does.
      const linkedId = workspaceExampleFromSearch(window.location.search);
      const linked = linkedId ? examplePrograms.find((e) => e.id === linkedId) : undefined;
      if (linked) {
        const doc = exampleDocument(linked);
        docs = [...(docs ?? []), doc];
        setDocuments(docs);
        setActiveId(doc.id);
        setHintShown(false);
      }
      const params = new URLSearchParams(window.location.search);
      if (params.has("ejemplo")) {
        params.delete("ejemplo");
        const rest = params.toString();
        history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""));
      }
      if (isExamplesNewWorkspaceTabIntent(window.location.search)) {
        setExamplesOpen(true);
        history.replaceState(null, "", window.location.pathname);
      } else if (!restored && !shared && !linked) {
        // First visit: start by showing what Codoritmo can do.
        setExamplesOpen(true);
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
  const openExample = (example: ExampleProgram) => {
    setExamplesOpen(false);
    setHintShown(false);
    openDocument(exampleDocument(example));
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
        { label: t.examples.menu, shortcut: k("E"), onSelect: () => setExamplesOpen(true) },
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
        { label: t.visualizer.arraysTab, checked: prefs.bottomOpen && prefs.bottomTab === "arreglos", onSelect: () => openBottom("arreglos") },
        { label: t.visualizer.complexityTab, checked: prefs.bottomOpen && prefs.bottomTab === "complejidad", onSelect: () => openBottom("complejidad") },
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
        { label: t.help.repository, onSelect: () => window.open(REPOSITORY_URL, "_blank", "noopener") },
        { label: t.help.officialSite, onSelect: () => window.open("https://pseint.sourceforge.net", "_blank", "noopener") },
      ],
    },
  ];

  /* ---------- global shortcuts (take precedence over the browser's) ---------- */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (profileOpen || paletteQuery !== null || examplesOpen) return; // dialogs handle their own keys
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
      if (mod && key === "e") return handled(() => setExamplesOpen(true));
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
            { id: "diagrama", label: t.activity.diagram, icon: Workflow },
            { id: "traduccion", label: formatMessage(t.activity.code, { lang: langName }), icon: Code },
            { id: "referencia", label: t.activity.reference, icon: BookOpen },
          ]}
          value={prefs.sideTab}
        />
        <button aria-label={t.closePanel} className="ml-auto shrink-0 rounded p-1 text-white/35 hover:text-white/80" onClick={() => setSideOpen(false)} title={t.closePanel} type="button">
          <X size={13} />
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
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
            step={player.viewIndex}
            stepMs={player.wantPlay ? SPEEDS[player.speedIndex].ms : null}
            finished={player.status === "done"}
            visitedLines={visitedLines}
          />
        )}
        {prefs.sideTab === "diagrama" && showPlayhead && (
          <VariableDock changed={player.changed} step={player.viewIndex} variables={player.variables} />
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
    <MotionConfig reducedMotion="user">
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
              <LogoMarkAnimated className="mr-1.5 ml-1 shrink-0" playing={player.wantPlay} />
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
          className="flex h-[24px] shrink-0 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 text-[12px] text-white/75 ring-1 ring-white/[0.06] transition-colors hover:bg-white/[0.1] hover:text-white"
          ref={examplesButtonRef}
          onClick={() => setExamplesOpen(true)}
          title={`${t.examples.menu} (${k("E")})`}
          type="button"
        >
          <LibraryBig className="text-[#7FE0B8]" size={13} />
          {!phone && (narrow ? t.examples.title : formatMessage(t.examples.explore, { n: examplePrograms.length }))}
        </button>
        <button
          className="flex h-[24px] shrink-0 items-center gap-2 rounded-[6px] border border-white/[0.07] bg-black/20 px-2 text-[12px] text-white/45 hover:text-white/75"
          onClick={() => setPaletteQuery("")}
          type="button"
        >
          <Search size={12} />
          {!narrow && t.search}
          <span className="text-white/30">{k("K")}</span>
        </button>
        <a
          aria-label={t.help.repository}
          className="grid h-[24px] w-[24px] shrink-0 place-items-center rounded-[6px] text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white"
          href={REPOSITORY_URL}
          rel="noopener noreferrer"
          target="_blank"
          title={t.help.repository}
        >
          <GitHubMark size={14} />
        </a>
      </div>

      {/* Workspace */}
      <div ref={workspaceRef} className="relative flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Document tabs */}
          <div className="flex h-[32px] shrink-0 items-end gap-2 border-b border-white/[0.06] bg-[#181B1D] pl-2">
            <div className="flex min-w-0 items-end gap-px overflow-x-auto [scrollbar-width:none]" data-doc-tablist="" role="tablist">
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
                    aria-label={d.name}
                    role="tab"
                    title={d.name}
                  >
                    <FileText className={`shrink-0 ${active ? "text-[#86F0C4]" : "text-white/35"}`} size={12} strokeWidth={1.9} />
                    <span className="truncate">{d.name.replace(/\.psc$/i, "")}</span>
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
            {/* View control: how this document is edited. A segmented control, so it never reads as a tab. */}
            <div className="ml-auto flex h-full shrink-0 items-center pr-2">
              <div className="flex rounded-[7px] bg-black/30 p-[2px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]" role="radiogroup" aria-label={t.blocks.modeHint}>
                {(
                  [
                    ["code", Code, t.blocks.modeCode],
                    ["blocks", Blocks, t.blocks.modeBlocks],
                  ] as const
                ).map(([mode, Icon, label]) => {
                  const on = (prefs.editorMode ?? "code") === mode;
                  return (
                    <motion.button
                      key={mode}
                      aria-checked={on}
                      aria-label={label}
                      className={`relative flex h-[22px] items-center gap-1.5 rounded-[5px] px-2 text-[11.5px] transition-colors ${
                        on ? "text-white" : "text-white/45 hover:text-white/85"
                      }`}
                      onClick={() => updatePrefs({ editorMode: mode })}
                      role="radio"
                      title={`${label} — ${t.blocks.modeHint}`}
                      type="button"
                      whileTap={{ scale: 0.95 }}
                    >
                      {on && (
                        <motion.span
                          className="absolute inset-0 rounded-[5px] bg-white/[0.12] shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
                          layoutId="editor-mode-thumb"
                          transition={spring.snappy}
                        />
                      )}
                      <motion.span
                        animate={on ? { rotate: [0, -8, 0], scale: [1, 1.15, 1] } : { rotate: 0, scale: 1 }}
                        className="relative"
                        transition={{ duration: 0.35 }}
                      >
                        <Icon size={13} strokeWidth={1.9} />
                      </motion.span>
                      <span className="relative">{label}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>

          {guide && (
            <div className="shrink-0 border-b border-white/[0.06] bg-gradient-to-r from-[#7FE0B8]/[0.07] to-transparent text-[12.5px] leading-[19px]">
              <div className="flex h-[34px] items-center gap-2.5 px-3">
                <GraduationCap className="shrink-0 text-[#7FE0B8]" size={14} />
                <button
                  aria-expanded={guideExpanded}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  onClick={() => setGuideExpanded((v) => !v)}
                  type="button"
                >
                  <span className="shrink-0 font-semibold text-white/90">{guide.copy.label}</span>
                  {!guideExpanded && <span className="min-w-0 truncate text-white/50">{guide.copy.description}</span>}
                  <span className="ml-auto flex shrink-0 items-center gap-1 text-[12px] text-[#7FE0B8]">
                    {t.examples.guide}
                    <ChevronDown className={`transition-transform ${guideExpanded ? "rotate-180" : ""}`} size={13} />
                  </span>
                </button>
                <button
                  aria-label={t.examples.dismiss}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-[5px] text-white/40 hover:bg-white/[0.06] hover:text-white"
                  onClick={() => updateDoc(doc.id, { guideDismissed: true })}
                  title={t.examples.dismiss}
                  type="button"
                >
                  <X size={13} />
                </button>
              </div>
              <AnimatePresence initial={false}>
              {guideExpanded && (
                <motion.div
                  animate={{ height: "auto", opacity: 1 }}
                  className="overflow-hidden"
                  exit={{ height: 0, opacity: 0 }}
                  initial={{ height: 0, opacity: 0 }}
                  transition={spring.smooth}
                >
                <div className="space-y-2 px-3 pb-3 pl-[33px] text-white/70">
                  <p>{guide.copy.learn}</p>
                  <p>
                    <span className="font-medium text-[#A9F0D2]">{t.examples.challenge}: </span>
                    {guide.copy.challenge}{" "}
                    {hintShown ? (
                      <span className="text-white/50 italic">{guide.copy.hint}</span>
                    ) : (
                      <button className="text-[#7FE0B8] hover:underline" onClick={() => setHintShown(true)} type="button">
                        {t.examples.showHint}
                      </button>
                    )}
                  </p>
                  {guide.example.input && (
                    <p className="text-white/45">
                      {t.examples.sampleInput} <span className="font-mono text-white/65">{guide.example.input.split("\n").join(" · ")}</span>
                    </p>
                  )}
                </div>
                </motion.div>
              )}
              </AnimatePresence>
            </div>
          )}
          <div className="relative min-h-[120px] flex-1 select-text">
            {blocksMode ? (
              <BlocksView
                activeLine={activeLine}
                dictionary={dictionary}
                locale={locale}
                onChange={setSource}
                settings={settings}
                source={source}
              />
            ) : (
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
            )}
            <AnimatePresence>
              {!blocksMode && source.trim() === BLANK_PROGRAM.trim() && (
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute top-28 right-6 left-16 z-10 max-w-[460px] rounded-[14px] bg-[#1D2124]/95 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.07] backdrop-blur-md"
                  exit={{ opacity: 0, y: 8 }}
                  initial={{ opacity: 0, y: 12 }}
                  transition={spring.smooth}
                >
                  <p className="text-[14.5px] font-medium text-white/90">{t.blankTitle}</p>
                  <p className="mt-1 text-[13px] leading-[19px] text-white/55">{t.blankBody}</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      className="flex h-[28px] items-center gap-1.5 rounded-full bg-[#7FE0B8]/[0.14] px-3 text-[12.5px] text-[#C9FBE5] transition-colors hover:bg-[#7FE0B8]/[0.22]"
                      onClick={() => setExamplesOpen(true)}
                      type="button"
                    >
                      <LibraryBig size={13} /> {t.blankExamples}
                    </button>
                    <button
                      className="flex h-[28px] items-center gap-1.5 rounded-full px-3 text-[12.5px] text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white"
                      onClick={() => openSide("referencia")}
                      type="button"
                    >
                      <BookOpen size={13} /> {t.blankReference}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Run toolbar (docked): its own strip between the program and what it prints, never over the code. */}
          <div className="flex shrink-0 select-none justify-center border-t border-white/[0.05] bg-[#181B1D] px-2 py-1.5 sm:px-3">
            <div className={`flex w-full max-w-[880px] items-center ${phone ? "gap-2" : "gap-3"}`}>
              {/* Playback controls as one connected group (Material 3 Expressive): flat tonal shapes that
                  morph when touched, with the primary action larger and in the accent colour. */}
              <div className="flex shrink-0 items-center gap-1.5">
                <ShapeButton
                compact={phone}
                  ariaLabel={t.run.stepBack}
                  disabled={player.frameCount === 0}
                  onClick={player.stepBack}
                  title={`${t.run.stepBack} (⇧F10)`}
                >
                  <SkipBack fill="currentColor" size={15} />
                </ShapeButton>
                <div className="group relative">
                  <ShapeButton
                compact={phone}
                    ariaDescribedBy="run-hint"
                    ariaLabel={player.wantPlay ? t.run.pause : player.status === "paused" ? t.run.continue : t.run.run}
                    onClick={togglePlay}
                    primary
                  >
                    <AnimatePresence initial={false} mode="popLayout">
                      <motion.span
                        key={player.wantPlay ? "pause" : "play"}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        className="grid place-items-center"
                        exit={{ opacity: 0, scale: 0.5, rotate: player.wantPlay ? 90 : -90 }}
                        initial={{ opacity: 0, scale: 0.5, rotate: player.wantPlay ? -90 : 90 }}
                        transition={spring.snappy}
                      >
                        {player.wantPlay ? <Pause fill="currentColor" size={20} /> : <Play className="ml-[2px]" fill="currentColor" size={20} />}
                      </motion.span>
                    </AnimatePresence>
                  </ShapeButton>
                  {/* What the button does, shown after a short hover. */}
                  <div
                    className="pointer-events-none absolute bottom-[calc(100%+12px)] left-0 z-30 w-[260px] translate-y-1 rounded-[14px] bg-[#2B3134] px-3 py-2.5 text-[12.5px] leading-[18px] text-white/75 opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.4)] transition-[opacity,translate] duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-hover:delay-500 group-has-[:focus-visible]:translate-y-0 group-has-[:focus-visible]:opacity-100"
                    id="run-hint"
                    role="tooltip"
                  >
                    <div className="mb-0.5 flex items-center justify-between font-medium text-white/95">
                      {player.wantPlay ? t.run.pause : player.status === "paused" ? t.run.continue : t.run.run}
                      <span className="font-normal text-white/40">{k("↵")}</span>
                    </div>
                    {player.wantPlay ? t.pauseHint : t.runHint}
                  </div>
                </div>
                <ShapeButton compact={phone} ariaLabel={t.run.stepNext} onClick={player.stepForward} title={`${t.run.stepNext} (F10)`}>
                  <SkipForward fill="currentColor" size={15} />
                </ShapeButton>
                <ShapeButton compact={phone} ariaLabel={t.run.stop} disabled={!player.live} onClick={player.stop} title={`${t.run.stop} (Esc)`}>
                  <Square fill="currentColor" size={13} />
                </ShapeButton>
              </div>
              {!compactToolbar && (
                <div className="w-[150px] min-w-0 shrink-0 leading-tight" aria-live="polite">
                  <AnimatePresence initial={false} mode="popLayout">
                    <motion.div
                      key={statusLabel}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-[12px] font-medium text-white/50"
                      exit={{ opacity: 0, y: -6 }}
                      initial={{ opacity: 0, y: 6 }}
                      transition={spring.snappy}
                    >
                      {statusLabel}
                    </motion.div>
                  </AnimatePresence>
                  <div className="truncate text-[12.5px] text-white/85" title={nowText ?? undefined}>
                    {activeLine ? formatMessage(t.line, { n: activeLine }) : player.status === "done" ? t.programFinished : t.pressPlay}
                  </div>
                </div>
              )}
              <RunTimeline
                disabled={player.frameCount < 2}
                frameCount={player.frameCount}
                frames={player.frames}
                label={statusLabel}
                onSeek={player.seek}
                sourceLines={sourceLines}
                stepLabel={(step, line) => formatMessage(t.stepAtLine, { step, line })}
                viewIndex={player.viewIndex}
              />
              <div className="flex shrink-0 items-center gap-1.5 text-white/40" title={formatMessage(t.speedLabel, { speed: speedLabel })}>
                {!phone && <Turtle size={13} />}
                {SPEEDS.map((speed, index) => (
                  <button
                    key={speed.id}
                    aria-label={t.run.speeds[speed.id]}
                    aria-pressed={index === player.speedIndex}
                    className="group relative grid h-3 w-3 place-items-center"
                    onClick={() => player.setSpeedIndex(index)}
                    type="button"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-white/25 transition-transform group-hover:scale-125 group-hover:bg-white/50" />
                    {index === player.speedIndex && (
                      <motion.span className="absolute h-2 w-2 rounded-full bg-white/80" layoutId="speed-dot" transition={spring.bouncy} />
                    )}
                  </button>
                ))}
                {!phone && <Rabbit size={13} />}
              </div>
            </div>
          </div>

          {/* Bottom panel */}
          {prefs.bottomOpen && <Divider axis="y" max={() => Math.max(160, Math.round(window.innerHeight * 0.7))} min={110} onResize={(bottomHeight) => updatePrefs({ bottomHeight })} size={prefs.bottomHeight} />}
          <div className="codoritmo-panel-size flex shrink-0 flex-col bg-[#141719]" style={{ height: prefs.bottomOpen ? prefs.bottomHeight : 30 }}>
            <div className="flex h-[30px] shrink-0 items-center gap-2 border-b border-white/[0.05] px-2">
              <Tabs<BottomTab>
                onChange={(id) => (prefs.bottomOpen && prefs.bottomTab === id ? updatePrefs({ bottomOpen: false }) : openBottom(id))}
                compact={workspaceWidth < 900}
                tabs={[
                  { id: "consola", label: t.view.console, icon: SquareTerminal, dot: asking && prefs.bottomTab !== "consola" },
                  { id: "prueba", label: t.view.deskCheck, icon: Table2 },
                  { id: "arreglos", label: t.visualizer.arraysTab, icon: ChartColumn },
                  { id: "complejidad", label: t.visualizer.complexityTab, icon: Gauge },
                  { id: "problemas", label: t.view.problems, icon: TriangleAlert, badge: errors.length },
                ]}
                value={prefs.bottomOpen ? prefs.bottomTab : null}
              />
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
                {prefs.bottomTab === "consola" && <ConsolePanel dictionary={dictionary} onRun={player.play} player={player} />}
                {prefs.bottomTab === "prueba" && <DeskCheckPanel dictionary={dictionary} onPickStep={player.seek} trace={trace} />}
                {prefs.bottomTab === "arreglos" && (
                  <ArrayView
                    baseZero={settings.baseZeroArrays}
                    dictionary={dictionary}
                    line={activeLine ? sourceLines[activeLine - 1] ?? null : null}
                    metrics={player.frame?.metrics ?? null}
                    previous={player.previous?.variables.length ? player.previous.variables : null}
                    variables={player.variables}
                  />
                )}
                {prefs.bottomTab === "complejidad" && (
                  <ComplexityPanel dictionary={dictionary} exampleId={doc.exampleId} settings={settings} source={source} />
                )}
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
            <Divider axis="x" max={760} min={300} onResize={(sideWidth) => updatePrefs({ sideWidth })} size={prefs.sideWidth} />
            <div className="shrink-0" style={{ width: sideWidth }}>
              {sidePanel}
            </div>
          </>
        )}
        <AnimatePresence>
          {sideOpen && !docked && (
            <>
              <motion.div
                key="side-scrim"
                animate={{ opacity: 1 }}
                className="absolute inset-0 right-[40px] z-20 bg-black/25"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                onMouseDown={() => setSideOpen(false)}
              />
              <motion.div
                key="side-sheet"
                animate={{ x: 0, opacity: 1 }}
                className="absolute top-0 right-[40px] bottom-0 z-30 border-l border-white/[0.08] shadow-[-20px_0_50px_rgba(0,0,0,0.45)]"
                exit={{ x: 40, opacity: 0 }}
                initial={{ x: 40, opacity: 0 }}
                style={{ width: sideWidth }}
                transition={spring.smooth}
              >
                {sidePanel}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Activity strip */}
        <div className="z-30 flex w-[40px] shrink-0 flex-col items-center gap-1 border-l border-white/[0.06] bg-[#181B1D] pt-2">
          {(
            [
              ["diagrama", Workflow, t.activity.diagram, "1"],
              ["traduccion", Code, formatMessage(t.activity.code, { lang: langName }), "2"],
              ["referencia", BookOpen, t.activity.reference, "3"],
            ] as const
          ).map(([id, Icon, label, key]) => (
            <motion.button
              key={id}
              aria-label={label}
              aria-pressed={sideOpen && prefs.sideTab === id}
              className={`group relative grid h-8 w-8 place-items-center rounded-[7px] transition-colors ${
                sideOpen && prefs.sideTab === id ? "text-white" : "text-white/45 hover:bg-white/[0.05] hover:text-white/85"
              }`}
              onClick={() => toggleSide(id)}
              type="button"
              whileTap={{ scale: 0.9 }}
            >
              {sideOpen && prefs.sideTab === id && (
                <motion.span className="absolute inset-0 rounded-[7px] bg-white/[0.1]" layoutId="activity-selection" transition={spring.snappy} />
              )}
              <Icon className="relative" size={16} strokeWidth={1.8} />
              <span className="codoritmo-tooltip pointer-events-none absolute top-1/2 right-[38px] -translate-y-1/2 rounded-[6px] border border-white/10 bg-[#2A3033] px-2 py-1 text-[12px] whitespace-nowrap text-white shadow-lg">
                {label} <span className="text-white/40">{k(key)}</span>
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Status bar: facts about the document, never controls that look like tabs */}
      <div className="flex h-[24px] shrink-0 items-center gap-4 border-t border-black/40 bg-[#181B1D] px-3 text-[11.5px] text-white/45">
        <button
          className={`flex items-center gap-1.5 hover:text-white/80 ${errors.length ? "text-[#F0A48C]" : ""}`}
          onClick={() => openBottom("problemas")}
          type="button"
        >
          {errors.length ? <TriangleAlert size={12} /> : <CircleCheck className="text-[#7FE0B8]" size={12} />}
          {errorLabel}
        </button>
        <button className="flex min-w-0 items-center gap-1.5 hover:text-white/80" onClick={() => setProfileOpen(true)} type="button">
          <SlidersHorizontal className="shrink-0" size={12} />
          <span className="truncate">
            {profileLabel(doc.profileId, dictionary)}
            {customized && ` · ${dictionary.workspace.customProfile}`}
          </span>
        </button>
        <AnimatePresence>
          {asking && (
            <motion.span
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-1.5 text-[#A9F0D2]"
              exit={{ opacity: 0, x: -6 }}
              initial={{ opacity: 0, x: -6 }}
              transition={spring.snappy}
            >
              <span className="codoritmo-attention-dot h-[6px] w-[6px] rounded-full bg-[#86F0C4]" />
              {t.askingInput}
            </motion.span>
          )}
        </AnimatePresence>
        <span className="ml-auto truncate">
          {dirty ? t.unsaved : ""}
        </span>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="pointer-events-none fixed bottom-[72px] left-1/2 z-[250] max-w-[90vw] rounded-[8px] border border-white/10 bg-[#2A3033]/95 px-3.5 py-2 text-center text-[12.5px] text-white shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur"
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            initial={{ opacity: 0, y: 14, scale: 0.94 }}
            role="status"
            style={{ x: "-50%" }}
            transition={spring.bouncy}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {examplesOpen && (
        <ExamplesBrowser
          dictionary={dictionary}
          // An opened example flies into its new document tab.
          getTabTargetRect={() =>
            document.querySelector<HTMLElement>('[data-doc-tablist] [role="tab"][aria-selected="true"]')?.getBoundingClientRect() ?? null
          }
          locale={locale}
          onClose={() => setExamplesOpen(false)}
          onOpen={openExample}
          // The sheet grows out of the Ejemplos button, also when opened with ⌘E or the menu.
          originRect={examplesButtonRef.current?.getBoundingClientRect() ?? null}
        />
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
        <div className="codoritmo-fade-in fixed inset-0 z-[300] grid place-items-center bg-black/40 p-4" onMouseDown={() => setShortcutsOpen(false)}>
          <div className="codoritmo-dialog-in w-[520px] max-w-[92vw] rounded-[12px] border border-white/10 bg-[#23282B] p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label={t.shortcuts.title}>
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
    </MotionConfig>
  );
}
