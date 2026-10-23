"use client";

// PROTOTYPE — the Bloques mode: a Scratch-style editor (Blockly, zelos
// renderer) that stays in sync with the pseudocode. Opening it converts the
// current code to blocks; every block change rewrites the code; during
// playback the running block is highlighted.

import * as Blockly from "blockly/core";
import * as En from "blockly/msg/en";
import * as Es from "blockly/msg/es";
import { LocateFixed, Minus, Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { settingsEqual, type EngineSettings } from "@/src/engine";
import type { Locale } from "@/src/i18n/config";
import type { Dictionary } from "@/src/i18n/types";
import { prefersReducedMotion } from "@/src/lib/motion";
import { codeToBlocksState, lineToBlockMap } from "./blocks-from-code";
import { blockData, buildToolbox, defineBlocks, ROUTINES_CATEGORY } from "./blocks-defs";
import { pseudocode } from "./blocks-generator";
import { routinesFlyout } from "./blocks-routines";
import { spring } from "@/src/lib/motion";

const STACK_HINT_KEY = "codoritmo:blocks-stack-hint";
// Storage can be unavailable (private windows, blocked site data): the hint then just shows again next time.
function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
function writeFlag(key: string) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // ignore
  }
}

// Colours and sizes Blockly needs as values. Everything else about the look
// lives in app/globals.css under "Blocks editor".
const MINT = "#86F0C4";
// Blockly measures text on a canvas, which can't resolve CSS variables, so
// this is a plain system stack rather than var(--font-geist-sans).
const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif';
const START_SCALE = 0.85;

const darkTheme = Blockly.Theme.defineTheme("codoritmo-dark", {
  name: "codoritmo-dark",
  base: Blockly.Themes.Classic,
  componentStyles: {
    workspaceBackgroundColour: "#141719",
    toolboxBackgroundColour: "#181B1D",
    toolboxForegroundColour: "#E6ECE9",
    flyoutBackgroundColour: "#1D2124",
    flyoutForegroundColour: "#E6ECE9",
    flyoutOpacity: 1,
    scrollbarColour: "#3A4246",
    scrollbarOpacity: 0.4,
    insertionMarkerColour: MINT,
    insertionMarkerOpacity: 0.3,
    cursorColour: MINT,
    markerColour: MINT,
    selectedGlowColour: MINT,
    selectedGlowOpacity: 0.6,
  },
  // Sizes are in points: 9.5pt is about 12.7px.
  fontStyle: { family: FONT_FAMILY, weight: "600", size: 9.5 },
});

/**
 * Renderer constants the theme can't reach. FIELD_BORDER_RECT_COLOUR fills the
 * text/number pills and whole-block fields (a lone variable or number), so a
 * dark translucent value turns zelos' white pills into recessed dark ones.
 */
const RENDERER_OVERRIDES = {
  FIELD_BORDER_RECT_COLOUR: "rgba(8, 11, 12, 0.42)",
  SELECTED_GLOW_SIZE: 1.1,
};

/**
 * A palette row with a coloured dot instead of Blockly's 8px colour bar, and
 * no solid category-coloured fill when selected; globals.css draws both from
 * --category-colour.
 */
class CategoryRow extends Blockly.ToolboxCategory {
  protected override addColourBorder_(colour: string): void {
    this.rowDiv_?.style.setProperty("--category-colour", colour || "#9AA6A1");
  }

  override setSelected(isSelected: boolean): void {
    super.setSelected(isSelected);
    if (this.rowDiv_) this.rowDiv_.style.backgroundColor = "";
  }
}

/**
 * Blockly always draws a scrollbar handle, even when there is nothing to
 * scroll; the handle then fills the whole track. On the palette flyout that
 * reads as a grey bar down the flyout's edge, through the blocks. Mark such
 * bars idle so CSS can hide them.
 */
function syncIdleScrollbars(host: HTMLElement): void {
  for (const bar of host.querySelectorAll<SVGSVGElement>(".blocklyScrollbarVertical, .blocklyScrollbarHorizontal")) {
    const length = bar.classList.contains("blocklyScrollbarVertical") ? "height" : "width";
    const track = Number(bar.querySelector(".blocklyScrollbarBackground")?.getAttribute(length) ?? 0);
    const handle = Number(bar.querySelector(".blocklyScrollbarHandle")?.getAttribute(length) ?? 0);
    bar.classList.toggle("codoritmo-scrollbar-idle", !(handle > 0 && handle < track - 1));
  }
}

export function BlocksView({
  source,
  settings,
  onChange,
  activeLine,
  dictionary,
  locale,
}: {
  source: string;
  settings: EngineSettings;
  onChange: (code: string) => void;
  /** Line of the generated code that is about to run, if playing. */
  activeLine: number | null;
  dictionary: Dictionary;
  locale: Locale;
}) {
  const t = dictionary.studio.blocks;
  const hostRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  /** The code we last produced; an incoming source equal to it is our own echo. */
  const emittedRef = useRef<string | null>(null);
  /**
   * The settings the code was generated with; null while the code is still the
   * text that was loaded (which may hold comments the blocks don't keep).
   */
  const emittedSettingsRef = useRef<EngineSettings | null>(null);
  const lineMapRef = useRef<Map<number, string>>(new Map());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(START_SCALE);
  /** null: not triggered yet; true: showing; false: dismissed. */
  const [stackHint, setStackHint] = useState<boolean | null>(null);
  const dismissStackHint = () => {
    setStackHint(false);
    writeFlag(STACK_HINT_KEY);
  };
  useEffect(() => {
    if (!stackHint) return;
    const timer = window.setTimeout(dismissStackHint, 9000);
    return () => window.clearTimeout(timer);
  }, [stackHint]);

  // Create the Blockly workspace once.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    Blockly.setLocale((locale === "es" ? Es : En) as unknown as Record<string, string>);
    defineBlocks();
    Blockly.registry.register(
      Blockly.registry.Type.TOOLBOX_ITEM,
      Blockly.ToolboxCategory.registrationName,
      CategoryRow,
      true,
    );
    // Thin bars (the default is 15px; touch devices keep their wider ones).
    if (Blockly.Scrollbar.scrollbarThickness === 15) Blockly.Scrollbar.scrollbarThickness = 10;
    const workspace = Blockly.inject(host, {
      renderer: "zelos",
      rendererOverrides: RENDERER_OVERRIDES,
      theme: darkTheme,
      toolbox: buildToolbox(t.categories),
      // Zoom and centre are our own buttons below; blocks are deleted by
      // dropping them on the palette, with the Delete key, or undone with ⌘Z.
      trashcan: false,
      sounds: false,
      grid: { spacing: 24, length: 1.5, colour: "#22282B", snap: true },
      zoom: { controls: false, wheel: true, startScale: START_SCALE, maxScale: 2, minScale: 0.4, scaleSpeed: 1.15, pinch: true },
      move: { scrollbars: true, drag: true, wheel: true },
    });
    workspaceRef.current = workspace;
    // "Mis subprocesos": new definitions and a call block for each routine there is.
    workspace.registerToolboxCategoryCallback(ROUTINES_CATEGORY, routinesFlyout);

    // Hide scrollbars with nothing to scroll whenever Blockly resizes a handle.
    const scrollbarObserver = new MutationObserver(() => syncIdleScrollbars(host));
    for (const part of host.querySelectorAll(".blocklyScrollbarHandle, .blocklyScrollbarBackground")) {
      scrollbarObserver.observe(part, { attributes: true, attributeFilter: ["width", "height"] });
    }
    syncIdleScrollbars(host);

    // Written in the document's profile (semicolons, operator spellings).
    const emit = () => {
      const settings = settingsRef.current;
      const code = pseudocode.workspaceToCode(workspace, settings);
      emittedRef.current = code;
      emittedSettingsRef.current = settings;
      lineMapRef.current = lineToBlockMap(workspace, code, settings);
      onChangeRef.current(code);
    };
    const listener = (event: Blockly.Events.Abstract) => {
      if (event.type === Blockly.Events.VIEWPORT_CHANGE) setScale(workspace.scale);
      // The first time someone drags a block that carries the ones below it,
      // tell them how to move just one (Blockly heals the stack with ⌘/Ctrl).
      if (event.type === Blockly.Events.BLOCK_DRAG) {
        const drag = event as Blockly.Events.BlockDrag;
        if (drag.isStart && drag.blockId && workspace.getBlockById(drag.blockId)?.getNextBlock()) {
          setStackHint((shown) => shown ?? (readFlag(STACK_HINT_KEY) ? false : true));
        }
      }
      if (event.isUiEvent || workspace.isDragging()) return;
      emit();
    };
    workspace.addChangeListener(listener);

    const observer = new ResizeObserver(() => Blockly.svgResize(workspace));
    observer.observe(host);
    return () => {
      observer.disconnect();
      scrollbarObserver.disconnect();
      workspace.dispose();
      workspaceRef.current = null;
      // A new workspace starts empty, so the next source must be loaded again
      // (React's dev double-mount would otherwise leave it blank).
      emittedRef.current = null;
      emittedSettingsRef.current = null;
    };
    // The workspace is created once; labels and locale are read at creation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load code into blocks when it changes from outside (opening, switching tabs).
  // When only the profile changes and the code came from the blocks, it is
  // rewritten in the new profile's style (semicolons, operator spellings).
  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    if (source === emittedRef.current) {
      const previous = emittedSettingsRef.current;
      if (!previous || settingsEqual(previous, settings)) return;
      emittedSettingsRef.current = settings;
      const code = pseudocode.workspaceToCode(workspace, settings);
      lineMapRef.current = lineToBlockMap(workspace, code, settings);
      if (code === source) return;
      emittedRef.current = code;
      onChangeRef.current(code);
      return;
    }
    const result = codeToBlocksState(source, settings);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError(null);
    Blockly.Events.disable();
    try {
      Blockly.serialization.workspaces.load(result.state, workspace);
      stackTopBlocks(workspace);
    } finally {
      Blockly.Events.enable();
    }
    emittedRef.current = source;
    emittedSettingsRef.current = null;
    // The code stays the loaded text until a block changes, so playback runs its lines.
    lineMapRef.current = result.lines;
    showStart(workspace);
  }, [settings, source]);

  // Follow playback.
  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const id = activeLine ? lineMapRef.current.get(activeLine) ?? null : null;
    workspace.highlightBlock(id);
    if (id) {
      const block = workspace.getBlockById(id);
      if (block) {
        workspace.centerOnBlock(id, true);
        pulseBlock(block);
      }
    }
  }, [activeLine]);

  const zoomBy = (direction: 1 | -1) => workspaceRef.current?.zoomCenter(direction);
  /** Animates a viewport change the way Blockly's own zoom-reset control does. */
  const transition = (change: (workspace: Blockly.WorkspaceSvg) => void) => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    workspace.beginCanvasTransition();
    change(workspace);
    window.setTimeout(() => workspace.endCanvasTransition(), 500);
  };
  const resetZoom = () =>
    transition((workspace) => {
      workspace.setScale(START_SCALE);
      workspace.scrollCenter();
    });
  // Fit everything in view, but never blow a short program up past 100%.
  const fitView = () =>
    transition((workspace) => {
      workspace.zoomToFit();
      if (workspace.scale > 1) {
        workspace.setScale(1);
        workspace.scrollCenter();
      }
    });
  const labels = { zoomIn: t.zoomIn, zoomOut: t.zoomOut, reset: t.resetZoom };
  const control =
    "grid h-[26px] min-w-[26px] place-items-center rounded-[6px] text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86F0C4]/50 active:bg-white/[0.1]";

  return (
    <div className="relative h-full w-full">
      <div ref={hostRef} className="codoritmo-blocks absolute inset-0" />
      <div className="absolute top-4 right-5 z-10 flex items-center gap-px rounded-[9px] border border-white/[0.06] bg-[#1D2124]/90 p-[3px] shadow-[0_6px_20px_rgba(0,0,0,0.35)] backdrop-blur-md">
        <button aria-label={labels.zoomOut} className={control} onClick={() => zoomBy(-1)} title={labels.zoomOut} type="button">
          <Minus size={14} strokeWidth={2} />
        </button>
        <button
          aria-label={labels.reset}
          className={`${control} px-1 text-[11px] font-medium tabular-nums`}
          onClick={resetZoom}
          title={labels.reset}
          type="button"
        >
          {Math.round(scale * 100)}%
        </button>
        <button aria-label={labels.zoomIn} className={control} onClick={() => zoomBy(1)} title={labels.zoomIn} type="button">
          <Plus size={14} strokeWidth={2} />
        </button>
        <span aria-hidden className="mx-[3px] h-3.5 w-px bg-white/[0.08]" />
        <button
          aria-label={dictionary.diagram.fitView}
          className={control}
          onClick={fitView}
          title={dictionary.diagram.fitView}
          type="button"
        >
          <LocateFixed size={14} strokeWidth={1.9} />
        </button>
      </div>
      <AnimatePresence>
        {stackHint && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-4 left-1/2 z-10 flex w-[min(460px,calc(100%-32px))] -translate-x-1/2 items-start gap-3 rounded-[14px] bg-[#2B3134] px-4 py-3 text-[13px] leading-[19px] text-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.45)]"
            exit={{ opacity: 0, y: 8 }}
            initial={{ opacity: 0, y: 12 }}
            role="status"
            transition={spring.smooth}
          >
            <span className="flex-1">
              {t.stackHint.replace("{key}", typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl")}
            </span>
            <button
              className="shrink-0 rounded-full px-2.5 py-0.5 text-[12.5px] font-medium text-[#A9F0D2] hover:bg-white/[0.06]"
              onClick={dismissStackHint}
              type="button"
            >
              {t.gotIt}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {error && (
        <div className="absolute inset-x-4 top-4 z-10 rounded-[10px] border border-[#F08A6C]/40 bg-[#2A1E1B]/95 px-4 py-3 text-[13px] text-[#F5C2B3] shadow-lg backdrop-blur">
          <b className="font-semibold">{t.cannotConvert}</b> {t.fixFirst} <span className="opacity-70">({error})</span>
        </div>
      )}
    </div>
  );
}

/** Scrolls to the top left of the program (a long one doesn't fit; it starts at its first line). */
function showStart(workspace: Blockly.WorkspaceSvg) {
  const content = workspace.getMetricsManager().getContentMetrics();
  const view = workspace.getMetricsManager().getViewMetrics();
  if (content.height <= view.height && content.width <= view.width) {
    workspace.scrollCenter();
    return;
  }
  workspace.scroll(-content.left + 32, -content.top + 32);
}

/**
 * Lays the program's parts (comments, SubProcesos, the Algoritmo) out top to
 * bottom in code order, now that their real heights are known; a comment
 * written right above a part sits right above its block.
 */
function stackTopBlocks(workspace: Blockly.WorkspaceSvg) {
  const LEFT = 24;
  let y = 24;
  for (const block of workspace.getTopBlocks(true)) {
    const tight = block.type !== "ps_comentario" && blockData(block).blank === 0;
    if (y > 24) y += tight ? 8 : 40;
    block.moveTo(new Blockly.utils.Coordinate(LEFT, y));
    y += block.getHeightWidth().height;
  }
}

/**
 * The running block "catches" the playhead: a mint ring that swells off its
 * outline and fades (an overlay copy of the outline, so Blockly's own
 * transforms are never touched).
 */
function pulseBlock(block: Blockly.BlockSvg) {
  if (prefersReducedMotion()) return;
  const root = block.getSvgRoot?.();
  const outline = root?.querySelector<SVGPathElement>(":scope > .blocklyPath");
  const d = outline?.getAttribute("d");
  if (!root || !d || typeof root.animate !== "function") return;
  const ring = document.createElementNS("http://www.w3.org/2000/svg", "path");
  ring.setAttribute("d", d);
  ring.setAttribute("fill", "none");
  ring.setAttribute("stroke", MINT);
  ring.setAttribute("stroke-width", "2");
  ring.setAttribute("pointer-events", "none");
  ring.style.transformBox = "fill-box";
  ring.style.transformOrigin = "center";
  root.appendChild(ring);
  // Swell by ~7px whatever the block's size (a tall Si block must not balloon).
  const box = outline!.getBBox?.();
  const grow = box && box.width > 0 && box.height > 0 ? `${1 + 14 / box.width}, ${1 + 14 / box.height}` : "1.05";
  const animation = ring.animate(
    [
      { opacity: 0.85, transform: "scale(1)" },
      { opacity: 0, transform: `scale(${grow})` },
    ],
    { duration: 480, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
  );
  const remove = () => ring.remove();
  animation.onfinish = remove;
  animation.oncancel = remove;
}
