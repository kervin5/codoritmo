"use client";

import Editor, { type Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useEffect, useRef, useState } from "react";

import type { Diagnostic } from "@/src/engine";
import { prefersReducedMotion } from "@/src/lib/motion";

import { EditorPlayhead, shakeEditorLine, usePlayheadLayer } from "./motion/editor-playhead";

const KEYWORDS = [
  "Algoritmo", "FinAlgoritmo", "Proceso", "FinProceso", "SubProceso", "FinSubProceso", "SubAlgoritmo", "FinSubAlgoritmo",
  "Funcion", "Función", "FinFuncion", "FinFunción", "Si", "Entonces", "SiNo", "FinSi", "Mientras", "Hacer", "FinMientras",
  "Repetir", "Hasta", "Que", "Para", "Cada", "Desde", "Con", "Paso", "FinPara", "Segun", "Según", "FinSegun", "FinSegún",
  "De", "En", "Otro", "Modo", "Caso", "Opcion", "Es", "Definir", "Como", "Dimension", "Dimensión", "Dimensionar",
  "Redimensionar", "Redimensión", "Leer", "Escribir", "Mostrar", "Imprimir", "Informar", "Sin", "Bajar", "Saltar",
  "SinSaltar", "SinBajar", "Limpiar", "Borrar", "Pantalla", "LimpiarPantalla", "BorrarPantalla", "Esperar", "Tecla",
  "EsperarTecla", "Una", "Segundo", "Segundos", "Milisegundo", "Milisegundos", "Por", "Referencia", "Valor", "Copia",
  "Retornar", "Fin", "Verdadero", "Falso", "Y", "O", "No", "MOD",
];
const TYPES = [
  "Entero", "Entera", "Enteros", "Enteras", "Real", "Reales", "Numero", "Número", "Numeros", "Números", "Numerico",
  "Numérico", "Numerica", "Numérica", "Logico", "Lógico", "Logica", "Lógica", "Logicos", "Lógicos", "Caracter", "Carácter",
  "Caracteres", "Cadena", "Cadenas", "Texto", "Textos",
];

let configured = false;

function configure(monaco: Monaco) {
  if (configured) return;
  configured = true;
  monaco.languages.register({ id: "codoritmo" });
  monaco.languages.setMonarchTokensProvider("codoritmo", {
    ignoreCase: true,
    keywords: KEYWORDS,
    types: TYPES,
    tokenizer: {
      root: [
        [/\/\/.*$/, "comment"],
        [/"[^"]*"?/, "string"],
        [/'[^']*'?/, "string"],
        [/\d+(?:\.\d+)?/, "number"],
        [/<-|:=|<=|>=|<>|==|!=|&&|\|\|/, "operator"],
        [/[+\-*/^%=<>&|~←≤≥≠]/, "operator"],
        [/[;:,()[\]]/, "delimiter"],
        // Monarch drops the regex "u" flag, so \p{L} can't be used: list the letters.
        [/[A-Za-z_\u00C0-\u024F][\w\u00C0-\u024F]*/, { cases: { "@keywords": "keyword", "@types": "type.identifier", "@default": "identifier" } }],
      ],
    },
  });
  monaco.editor.defineTheme("codoritmo-night", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "8FD9B6" },
      { token: "type.identifier", foreground: "9CC4E4" },
      { token: "string", foreground: "E8BE8C" },
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
      "editorSuggestWidget.background": "#202528",
      "editorSuggestWidget.border": "#FFFFFF18",
      "editorSuggestWidget.selectedBackground": "#2F8F6E",
      "editorHoverWidget.background": "#202528",
      "editorHoverWidget.border": "#FFFFFF18",
      // The editor itself is transparent; the pinned "sticky scroll" header
      // needs its own (glassy, see globals.css) surface or code shows through.
      "editorStickyScroll.background": "#161A1CEB",
      "editorStickyScrollHover.background": "#1F2528E6",
      "editorStickyScroll.shadow": "#00000066",
    },
  });
}

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  diagnostics: Diagnostic[];
  /** The line the program is about to run; highlighted like a playhead. */
  currentLine: number | null;
  /** A line picked from another view (diagram, problems). */
  highlightLine?: number | null;
  readOnly?: boolean;
  fontSize?: number;
  onReady?: (instance: editor.IStandaloneCodeEditor) => void;
  onMonaco?: (monaco: Monaco) => void;
}

export default function CodeEditor({
  value,
  onChange,
  diagnostics,
  currentLine,
  highlightLine,
  readOnly,
  fontSize = 15,
  onReady,
  onMonaco,
}: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null);
  const [instance, setInstance] = useState<editor.IStandaloneCodeEditor | null>(null);
  // The running line is drawn by <EditorPlayhead> (it glides); decorations are the fallback.
  const playheadLayer = usePlayheadLayer(instance);
  const lineHeight = Math.round(fontSize * 1.7);

  useEffect(() => {
    const instance = editorRef.current;
    if (!instance) return;
    const decorations: editor.IModelDeltaDecoration[] = [];
    if (currentLine) {
      if (!playheadLayer) {
        decorations.push({
          range: { startLineNumber: currentLine, startColumn: 1, endLineNumber: currentLine, endColumn: 1 },
          options: { isWholeLine: true, className: "codoritmo-play-line", glyphMarginClassName: "codoritmo-play-glyph" },
        });
      }
      instance.revealLineInCenterIfOutsideViewport(currentLine);
    }
    if (highlightLine) {
      decorations.push({
        range: { startLineNumber: highlightLine, startColumn: 1, endLineNumber: highlightLine, endColumn: 1 },
        options: { isWholeLine: true, className: "codoritmo-link-line" },
      });
    }
    decorationsRef.current?.set(decorations);
  }, [currentLine, highlightLine, playheadLayer]);

  // A new error shakes its line once. Errors that appear while typing wait
  // until the typing pauses (and are dropped if the edit fixed them).
  const editedAtRef = useRef(0);
  const seenErrorsRef = useRef<Set<string> | null>(null);
  const pendingErrorsRef = useRef(new Map<string, number>());
  useEffect(() => {
    editedAtRef.current = performance.now();
  }, [value]);
  useEffect(() => {
    const errors = diagnostics.filter((d) => d.severity !== "warning");
    const keys = new Map(errors.map((d) => [`${d.line}:${d.message}`, d.line]));
    const seen = seenErrorsRef.current;
    seenErrorsRef.current = new Set(keys.keys());
    if (!seen) return; // the errors already there when the editor opened
    const pending = pendingErrorsRef.current;
    for (const key of [...pending.keys()]) if (!keys.has(key)) pending.delete(key);
    const fresh = [...keys].filter(([key]) => !seen.has(key));
    fresh.forEach(([key, line]) => pending.set(key, line));
    if (pending.size === 0) return;
    const reduced = prefersReducedMotion();
    const each = (lines: Iterable<number>, effect: { shake: boolean; fade: boolean }) => {
      const instance = editorRef.current;
      if (instance) new Set(lines).forEach((line) => shakeEditorLine(instance, line, lineHeight, effect));
    };
    // The squiggle fades in as soon as Monaco draws it; the shake waits for typing to pause.
    const fadeTimer = window.setTimeout(() => each(fresh.map(([, line]) => line), { shake: false, fade: true }), 60);
    const typing = performance.now() - editedAtRef.current < 1200;
    const shakeTimer = window.setTimeout(() => {
      each(pending.values(), { shake: !reduced, fade: false });
      pending.clear();
    }, typing ? 1500 : 90);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(shakeTimer);
    };
  }, [diagnostics, lineHeight]);

  useEffect(() => {
    const monaco = monacoRef.current;
    const model = editorRef.current?.getModel();
    if (!monaco || !model) return;
    monaco.editor.setModelMarkers(
      model,
      "codoritmo",
      diagnostics.map((d) => {
        const line = Math.min(Math.max(d.line, 1), model.getLineCount());
        return {
          message: d.message,
          severity: d.severity === "warning" ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Error,
          startLineNumber: line,
          startColumn: Math.max(1, d.column),
          endLineNumber: line,
          endColumn: model.getLineMaxColumn(line),
        };
      })
    );
  }, [diagnostics]);

  return (
    <>
    <Editor
      beforeMount={(monaco) => {
        configure(monaco);
        onMonaco?.(monaco);
      }}
      language="codoritmo"
      onChange={(next) => onChange(next ?? "")}
      onMount={(instance, monaco) => {
        editorRef.current = instance;
        monacoRef.current = monaco;
        decorationsRef.current = instance.createDecorationsCollection([]);
        setInstance(instance);
        onReady?.(instance);
      }}
      options={{
        automaticLayout: true,
        fontFamily: 'var(--font-geist-mono), "SFMono-Regular", Consolas, monospace',
        fontSize,
        lineHeight,
        glyphMargin: true,
        lineNumbersMinChars: 3,
        minimap: { enabled: false },
        padding: { top: 16, bottom: 16 },
        renderLineHighlight: "line",
        scrollBeyondLastLine: false,
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
        tabSize: 4,
        quickSuggestions: { other: true, comments: false, strings: false },
        suggestOnTriggerCharacters: true,
        tabCompletion: "on",
        hover: { delay: 350 },
        fixedOverflowWidgets: true,
        readOnly,
      }}
      theme="codoritmo-night"
      value={value}
    />
    {instance && playheadLayer && (
      <EditorPlayhead instance={instance} layer={playheadLayer} line={currentLine} lineHeight={lineHeight} />
    )}
    </>
  );
}
