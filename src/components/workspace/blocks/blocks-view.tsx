"use client";

// PROTOTYPE — the Bloques mode: a Scratch-style editor (Blockly, zelos
// renderer) that stays in sync with the pseudocode. Opening it converts the
// current code to blocks; every block change rewrites the code; during
// playback the running block is highlighted.

import * as Blockly from "blockly/core";
import * as En from "blockly/msg/en";
import * as Es from "blockly/msg/es";
import { useEffect, useRef, useState } from "react";

import type { EngineSettings } from "@/src/engine";
import type { Locale } from "@/src/i18n/config";
import type { Dictionary } from "@/src/i18n/types";
import { codeToBlocksState, lineToBlockMap } from "./blocks-from-code";
import { buildToolbox, defineBlocks } from "./blocks-defs";
import { pseudocode } from "./blocks-generator";

const darkTheme = Blockly.Theme.defineTheme("codoritmo-dark", {
  name: "codoritmo-dark",
  base: Blockly.Themes.Classic,
  componentStyles: {
    workspaceBackgroundColour: "#141719",
    toolboxBackgroundColour: "#181B1D",
    toolboxForegroundColour: "#DCE3E0",
    flyoutBackgroundColour: "#1D2124",
    flyoutForegroundColour: "#DCE3E0",
    flyoutOpacity: 0.97,
    scrollbarColour: "#3A4246",
    scrollbarOpacity: 0.6,
    insertionMarkerColour: "#86F0C4",
    insertionMarkerOpacity: 0.35,
    cursorColour: "#86F0C4",
  },
  fontStyle: { family: 'var(--font-geist-sans), -apple-system, "Segoe UI", sans-serif', weight: "600", size: 12 },
});

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
  const lineMapRef = useRef<Map<number, string>>(new Map());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [error, setError] = useState<string | null>(null);

  // Create the Blockly workspace once.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    Blockly.setLocale((locale === "es" ? Es : En) as unknown as Record<string, string>);
    defineBlocks();
    const workspace = Blockly.inject(host, {
      renderer: "zelos",
      theme: darkTheme,
      toolbox: buildToolbox(t.categories),
      trashcan: true,
      sounds: false,
      grid: { spacing: 24, length: 2, colour: "#232A2D", snap: true },
      zoom: { controls: true, wheel: true, startScale: 0.85, maxScale: 2, minScale: 0.4, scaleSpeed: 1.15, pinch: true },
      move: { scrollbars: true, drag: true, wheel: true },
    });
    workspaceRef.current = workspace;

    const emit = () => {
      const code = pseudocode.workspaceToCode(workspace);
      emittedRef.current = code;
      lineMapRef.current = lineToBlockMap(workspace, code, settingsRef.current);
      onChangeRef.current(code);
    };
    const listener = (event: Blockly.Events.Abstract) => {
      if (event.isUiEvent || workspace.isDragging()) return;
      emit();
    };
    workspace.addChangeListener(listener);

    const observer = new ResizeObserver(() => Blockly.svgResize(workspace));
    observer.observe(host);
    return () => {
      observer.disconnect();
      workspace.dispose();
      workspaceRef.current = null;
    };
    // The workspace is created once; labels and locale are read at creation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load code into blocks when it changes from outside (opening, switching tabs).
  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace || source === emittedRef.current) return;
    const result = codeToBlocksState(source, settings);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError(null);
    Blockly.Events.disable();
    try {
      Blockly.serialization.workspaces.load(result.state, workspace);
    } finally {
      Blockly.Events.enable();
    }
    emittedRef.current = source;
    lineMapRef.current = lineToBlockMap(workspace, pseudocode.workspaceToCode(workspace), settings);
    workspace.scrollCenter();
  }, [settings, source]);

  // Follow playback.
  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const id = activeLine ? lineMapRef.current.get(activeLine) ?? null : null;
    workspace.highlightBlock(id);
    if (id) {
      const block = workspace.getBlockById(id);
      if (block) workspace.centerOnBlock(id, true);
    }
  }, [activeLine]);

  return (
    <div className="relative h-full w-full">
      <div ref={hostRef} className="codoritmo-blocks absolute inset-0" />
      {error && (
        <div className="absolute inset-x-4 top-4 z-10 rounded-[10px] border border-[#F08A6C]/40 bg-[#2A1E1B]/95 px-4 py-3 text-[13px] text-[#F5C2B3] shadow-lg backdrop-blur">
          <b className="font-semibold">{t.cannotConvert}</b> {t.fixFirst} <span className="opacity-70">({error})</span>
        </div>
      )}
    </div>
  );
}
