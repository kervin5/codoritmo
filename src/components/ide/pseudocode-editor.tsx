"use client";

import Editor, { type Monaco } from "@monaco-editor/react";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { editor } from "monaco-editor";

import type { Diagnostic, SourceSpan } from "@/src/engine";
import type { Dictionary } from "@/src/i18n/types";

type MonacoEditorInstance = editor.IStandaloneCodeEditor;

export interface EditorHandle {
  focus: () => void;
  insertSnippet: (options: { placeholder?: string; text: string }) => void;
  revealSpan: (span: SourceSpan) => void;
}

interface EditorProps {
  dictionary: Dictionary;
  diagnostics: Diagnostic[];
  onChange: (value: string) => void;
  value: string;
}

let editorConfigured = false;

function configureMonaco(monaco: Monaco): void {
  if (editorConfigured) {
    return;
  }

  editorConfigured = true;

  monaco.languages.register({ id: "codoritmo" });
  monaco.languages.setMonarchTokensProvider("codoritmo", {
    ignoreCase: true,
    tokenizer: {
      root: [
        [
          /\b(Proceso|FinProceso|Algoritmo|FinAlgoritmo|SubProceso|FinSubProceso|SubAlgoritmo|FinSubAlgoritmo|Funcion|FinFuncion|Si|Entonces|Sino|FinSi|Mientras|Hacer|FinMientras|Repetir|Hasta|Que|Para|Cada|Desde|Con|Paso|FinPara|Segun|De|Otro|Modo|FinSegun|Definir|Como|Dimension|Leer|Escribir|Mostrar|Sin|Bajar|Limpiar|Pantalla|Esperar|Tecla|Por|Referencia|Retornar|Verdadero|Falso|Y|O|No)\b/,
          "keyword",
        ],
        [/\b(Entero|Real|Logico|Caracter|Cadena)\b/, "type.identifier"],
        [/\/\/.*$/, "comment"],
        [/"([^"\\]|\\.)*$/, "string.invalid"],
        [/"/, { token: "string.quote", bracket: "@open", next: "@string" }],
        [/'([^'\\]|\\.)*$/, "string.invalid"],
        [
          /'/,
          { token: "string.quote", bracket: "@open", next: "@singleString" },
        ],
        [/\{[%!]|&&\}|[|][|]\}/, "operator"],
        [/\{[^}]*\}/, "comment"],
        [/[<>!=]=|<-|<>|==|!=/, "operator"],
        [/[+\-*/^=<>]/, "operator"],
        [/\d+(?:[.,]\d+)?/, "number"],
        [/[;:,()[\]]/, "delimiter"],
        [/[A-Za-z_\p{L}][\w\p{L}\p{N}_]*/u, "identifier"],
      ],
      string: [
        [/[^\\"]+/, "string"],
        [/\\./, "string.escape"],
        [/"/, { token: "string.quote", bracket: "@close", next: "@pop" }],
      ],
      singleString: [
        [/[^\\']+/, "string"],
        [/\\./, "string.escape"],
        [/'/, { token: "string.quote", bracket: "@close", next: "@pop" }],
      ],
    },
  });

  monaco.editor.defineTheme("codoritmo-studio", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "FF9A62" },
      { token: "type.identifier", foreground: "7EC6B1" },
      { token: "comment", foreground: "6B7A74" },
      { token: "number", foreground: "E5C46A" },
      { token: "string", foreground: "B8E986" },
      { token: "operator", foreground: "F7F1E8" },
    ],
    colors: {
      "editor.background": "#171B1A",
      "editor.foreground": "#EEF3EC",
      "editor.lineHighlightBackground": "#1F2624",
      "editor.selectionBackground": "#25443C",
      "editor.inactiveSelectionBackground": "#1E3430",
      "editorCursor.foreground": "#7EC6B1",
      "editorLineNumber.foreground": "#71817A",
      "editorLineNumber.activeForeground": "#E4EBE6",
      "editorWhitespace.foreground": "#263230",
      "editorIndentGuide.background1": "#24312E",
      "editorIndentGuide.activeBackground1": "#35514A",
      "editorGutter.background": "#171B1A",
      "editorError.foreground": "#FF7272",
      "editorWarning.foreground": "#FFCE70",
    },
  });
}

function indentSnippet(text: string, indent: string): string {
  const lines = text.split("\n");
  return lines
    .map((line, index) => (index === 0 ? line : `${indent}${line}`))
    .join("\n");
}

const PseudocodeEditor = forwardRef<EditorHandle, EditorProps>(
  function PseudocodeEditor({ dictionary, diagnostics, onChange, value }, ref) {
    const editorRef = useRef<MonacoEditorInstance | null>(null);
    const monacoRef = useRef<Monaco | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        focus() {
          editorRef.current?.focus();
        },
        insertSnippet({ placeholder, text }) {
          if (!editorRef.current || !monacoRef.current) {
            return;
          }

          const editorInstance = editorRef.current;
          const model = editorInstance.getModel();
          const selection = editorInstance.getSelection();
          if (!model || !selection) {
            return;
          }

          const linePrefix = model.getValueInRange({
            startLineNumber: selection.startLineNumber,
            startColumn: 1,
            endLineNumber: selection.startLineNumber,
            endColumn: selection.startColumn,
          });
          const indent = linePrefix.match(/^\s*/)?.[0] ?? "";
          const snippetText = indentSnippet(text, indent);
          const startOffset = model.getOffsetAt(selection.getStartPosition());

          editorInstance.executeEdits("codoritmo-snippet", [
            {
              range: selection,
              text: snippetText,
              forceMoveMarkers: true,
            },
          ]);

          if (placeholder) {
            const placeholderIndex = snippetText.indexOf(placeholder);
            if (placeholderIndex >= 0) {
              const start = model.getPositionAt(startOffset + placeholderIndex);
              const end = model.getPositionAt(
                startOffset + placeholderIndex + placeholder.length
              );
              editorInstance.setSelection(
                new monacoRef.current.Selection(
                  start.lineNumber,
                  start.column,
                  end.lineNumber,
                  end.column
                )
              );
            }
          }

          editorInstance.focus();
        },
        revealSpan(span) {
          if (!editorRef.current || !monacoRef.current) {
            return;
          }

          const editorInstance = editorRef.current;
          editorInstance.setSelection(
            new monacoRef.current.Selection(
              span.start.line,
              span.start.column,
              span.end.line,
              span.end.column
            )
          );
          editorInstance.revealLineInCenter(span.start.line);
          editorInstance.focus();
        },
      }),
      []
    );

    useEffect(() => {
      if (!editorRef.current || !monacoRef.current) {
        return;
      }

      const model = editorRef.current.getModel();
      if (!model) {
        return;
      }

      monacoRef.current.editor.setModelMarkers(
        model,
        "codoritmo",
        diagnostics.map((diagnostic) => ({
          message: diagnostic.message,
          severity:
            diagnostic.severity === "warning"
              ? monacoRef.current!.MarkerSeverity.Warning
              : monacoRef.current!.MarkerSeverity.Error,
          startLineNumber: diagnostic.line,
          startColumn: diagnostic.column,
          endLineNumber: diagnostic.line,
          endColumn: diagnostic.column + 1,
        }))
      );
    }, [diagnostics]);

    return (
      <Editor
        beforeMount={configureMonaco}
        defaultLanguage="codoritmo"
        height="100%"
        loading={
          <div className="flex h-full min-h-[520px] items-center justify-center text-sm text-[var(--muted)]">
            {dictionary.editor.loading}
          </div>
        }
        onChange={(nextValue) => onChange(nextValue ?? "")}
        onMount={(editorInstance, monaco) => {
          editorRef.current = editorInstance;
          monacoRef.current = monaco;
          const model = editorInstance.getModel();
          if (!model) {
            return;
          }

          monaco.editor.setModelMarkers(
            model,
            "codoritmo",
            diagnostics.map((diagnostic) => ({
              message: diagnostic.message,
              severity:
                diagnostic.severity === "warning"
                  ? monaco.MarkerSeverity.Warning
                  : monaco.MarkerSeverity.Error,
              startLineNumber: diagnostic.line,
              startColumn: diagnostic.column,
              endLineNumber: diagnostic.line,
              endColumn: diagnostic.column + 1,
            }))
          );
        }}
        options={{
          automaticLayout: true,
          fontFamily:
            'var(--font-geist-mono), "SFMono-Regular", Consolas, monospace',
          fontLigatures: true,
          fontSize: 15,
          lineNumbersMinChars: 3,
          minimap: { enabled: false },
          padding: { top: 18, bottom: 18 },
          renderWhitespace: "selection",
          roundedSelection: false,
          scrollBeyondLastLine: false,
          tabSize: 2,
        }}
        theme="codoritmo-studio"
        value={value}
      />
    );
  }
);

export default PseudocodeEditor;
