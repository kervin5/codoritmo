"use client";

// PROTOTYPE — throwaway editor wrapper: real Codoritmo language, light theme,
// current-step line highlight and inline error markers.

import Editor, { type Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useEffect, useRef } from "react";

import type { Diagnostic } from "@/src/engine";
import { configureMonaco } from "../pseudocode-editor";

let themesDefined = false;

function defineThemes(monaco: Monaco) {
  if (themesDefined) return;
  themesDefined = true;
  monaco.editor.defineTheme("proto-paper", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "1F6F57", fontStyle: "bold" },
      { token: "string", foreground: "9A5B2E" },
      { token: "string.quote", foreground: "9A5B2E" },
      { token: "type.identifier", foreground: "2E6E8E" },
      { token: "number", foreground: "8A4FB0" },
      { token: "comment", foreground: "9A968C", fontStyle: "italic" },
      { token: "operator", foreground: "5B6560" },
    ],
    colors: {
      "editor.background": "#FFFFFF",
      "editor.foreground": "#1D2420",
      "editor.lineHighlightBackground": "#F4F6F3",
      "editor.lineHighlightBorder": "#00000000",
      "editorLineNumber.foreground": "#B4B8B1",
      "editorLineNumber.activeForeground": "#3C4641",
      "editorCursor.foreground": "#1F6F57",
      "editor.selectionBackground": "#CFE6DC",
      "editorIndentGuide.background1": "#EEF0EC",
      "editorGutter.background": "#FFFFFF",
    },
  });
  monaco.editor.defineTheme("proto-mellow", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "8FD9B6" },
      { token: "type.identifier", foreground: "9CC4E4" },
      { token: "string", foreground: "E8BE8C" },
      { token: "string.quote", foreground: "E8BE8C" },
      { token: "number", foreground: "D2B3F2" },
      { token: "comment", foreground: "5E6A66", fontStyle: "italic" },
      { token: "operator", foreground: "9AA6A1" },
      { token: "identifier", foreground: "E4EAE7" },
    ],
    colors: {
      "editor.background": "#00000000",
      "editor.foreground": "#E4EAE7",
      "editor.lineHighlightBackground": "#FFFFFF08",
      "editor.lineHighlightBorder": "#00000000",
      "editorLineNumber.foreground": "#3C4649",
      "editorLineNumber.activeForeground": "#9AA6A1",
      "editorCursor.foreground": "#86F0C4",
      "editor.selectionBackground": "#2A4A3F",
      "editorIndentGuide.background1": "#1F272A",
      "editorGutter.background": "#00000000",
      "scrollbarSlider.background": "#FFFFFF14",
    },
  });
  monaco.editor.defineTheme("proto-ink", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "7FD1B0", fontStyle: "bold" },
      { token: "string", foreground: "E6B07E" },
      { token: "string.quote", foreground: "E6B07E" },
      { token: "type.identifier", foreground: "8EC5E0" },
      { token: "number", foreground: "C7A3F0" },
      { token: "comment", foreground: "6B7570", fontStyle: "italic" },
    ],
    colors: {
      "editor.background": "#14181A",
      "editor.foreground": "#E8EDEA",
      "editor.lineHighlightBackground": "#1B2124",
      "editorLineNumber.foreground": "#4A5450",
      "editorLineNumber.activeForeground": "#C9D2CD",
      "editorGutter.background": "#14181A",
    },
  });
}

interface PrototypeEditorProps {
  value: string;
  onChange: (value: string) => void;
  diagnostics: Diagnostic[];
  currentLine: number | null;
  readOnly?: boolean;
  theme?: "paper" | "ink" | "mellow";
  fontSize?: number;
  onCursorLine?: (line: number) => void;
  highlightLine?: number | null;
  onReady?: (instance: editor.IStandaloneCodeEditor) => void;
}

export default function PrototypeEditor({
  value,
  onChange,
  diagnostics,
  currentLine,
  readOnly,
  theme = "paper",
  fontSize = 15,
  onCursorLine,
  highlightLine,
  onReady,
}: PrototypeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null);

  useEffect(() => {
    const instance = editorRef.current;
    if (!instance) return;
    const decorations: editor.IModelDeltaDecoration[] = [];
    if (currentLine) {
      decorations.push({
        range: { startLineNumber: currentLine, startColumn: 1, endLineNumber: currentLine, endColumn: 1 },
        options: {
          isWholeLine: true,
          className: theme === "mellow" ? "proto-play-line" : "proto-step-line",
          glyphMarginClassName: theme === "mellow" ? "proto-play-glyph" : "proto-step-glyph",
        },
      });
      instance.revealLineInCenterIfOutsideViewport(currentLine);
    }
    if (highlightLine) {
      decorations.push({
        range: { startLineNumber: highlightLine, startColumn: 1, endLineNumber: highlightLine, endColumn: 1 },
        options: { isWholeLine: true, className: "proto-link-line" },
      });
    }
    decorationsRef.current?.set(decorations);
  }, [currentLine, highlightLine, theme]);

  useEffect(() => {
    const monaco = monacoRef.current;
    const model = editorRef.current?.getModel();
    if (!monaco || !model) return;
    monaco.editor.setModelMarkers(
      model,
      "proto",
      diagnostics.map((d) => ({
        message: d.message,
        severity: d.severity === "warning" ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Error,
        startLineNumber: d.line,
        startColumn: d.column,
        endLineNumber: d.line,
        endColumn: model.getLineMaxColumn(Math.min(d.line, model.getLineCount())),
      }))
    );
  }, [diagnostics]);

  return (
    <Editor
      beforeMount={(monaco) => {
        configureMonaco(monaco);
        defineThemes(monaco);
      }}
      onMount={(instance, monaco) => {
        editorRef.current = instance;
        monacoRef.current = monaco;
        decorationsRef.current = instance.createDecorationsCollection([]);
        instance.onDidChangeCursorPosition((event) => onCursorLine?.(event.position.lineNumber));
        onReady?.(instance);
      }}
      language="codoritmo"
      onChange={(next) => onChange(next ?? "")}
      options={{
        automaticLayout: true,
        fontFamily: 'var(--font-geist-mono), "SFMono-Regular", Consolas, monospace',
        fontSize,
        lineHeight: Math.round(fontSize * 1.7),
        glyphMargin: true,
        lineNumbersMinChars: 3,
        minimap: { enabled: false },
        padding: { top: 20, bottom: 20 },
        renderLineHighlight: "line",
        scrollBeyondLastLine: false,
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
        tabSize: 4,
        readOnly,
      }}
      theme={theme === "ink" ? "proto-ink" : theme === "mellow" ? "proto-mellow" : "proto-paper"}
      value={value}
    />
  );
}
