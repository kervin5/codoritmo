"use client";

// PROTOTYPE — editor intelligence for Codoritmo: autocomplete (keywords as
// snippets with tab-stops, functions, and the program's own variables), hover
// explanations for keywords and variables, and comment/bracket config so
// ⌘/ and auto-closing quotes work. Registered once per Monaco instance; reads
// the latest catalog through a getter so profile changes are picked up.

import type { Monaco } from "@monaco-editor/react";
import type { languages } from "monaco-editor";

import type { ReferenceEntry } from "./reference-inspector";

export interface LanguageCatalog {
  entries: ReferenceEntry[];
  lookup: (word: string | null) => ReferenceEntry | null;
}

let registered = false;

/** `<condicion>` placeholders → Monaco snippet tab-stops `${1:condicion}`. */
function toSnippet(text: string): string {
  let index = 0;
  return text
    .replace(/[$}\\]/g, (c) => `\\${c}`)
    .replace(/<([^<>]+)>/g, (_m, name: string) => `\${${++index}:${name}}`);
}

interface DeclaredVariable {
  name: string;
  type: string | null;
  line: number;
}

/** Cheap scan for variables: Definir lists, assignments, Leer and Para counters. */
function scanVariables(text: string): DeclaredVariable[] {
  const found = new Map<string, DeclaredVariable>();
  const lines = text.split("\n");
  lines.forEach((raw, i) => {
    const line = raw.replace(/\/\/.*$/, "");
    const define = /^\s*Definir\s+(.+?)\s+Como\s+(\w+)/i.exec(line);
    if (define) {
      for (const name of define[1].split(",").map((s) => s.trim()).filter(Boolean)) {
        found.set(name.toLowerCase(), { name, type: define[2], line: i + 1 });
      }
    }
    const assign = /^\s*([\p{L}_][\p{L}\p{N}_]*)\s*(?:\[[^\]]*\])?\s*(?:<-|:=)/u.exec(line);
    if (assign && !found.has(assign[1].toLowerCase())) found.set(assign[1].toLowerCase(), { name: assign[1], type: null, line: i + 1 });
    const read = /^\s*Leer\s+(.+)$/i.exec(line);
    if (read) {
      for (const name of read[1].split(",").map((s) => s.trim().replace(/\[.*$/, "")).filter(Boolean)) {
        if (!found.has(name.toLowerCase())) found.set(name.toLowerCase(), { name, type: null, line: i + 1 });
      }
    }
    const loop = /^\s*Para\s+([\p{L}_][\p{L}\p{N}_]*)/iu.exec(line);
    if (loop && !found.has(loop[1].toLowerCase())) found.set(loop[1].toLowerCase(), { name: loop[1], type: "contador", line: i + 1 });
  });
  return [...found.values()];
}

function kindFor(monaco: Monaco, entry: ReferenceEntry) {
  const k = monaco.languages.CompletionItemKind;
  if (/\(/.test(entry.example)) return k.Function;
  if (entry.example.includes("\n")) return k.Snippet;
  if (/^[^\p{L}]+$/u.test(entry.label)) return k.Operator;
  if (/^[A-Z]+$/.test(entry.label)) return k.Constant;
  return k.Keyword;
}

export function registerLanguageServices(monaco: Monaco, getCatalog: () => LanguageCatalog | null) {
  if (registered) return;
  registered = true;

  monaco.languages.setLanguageConfiguration("codoritmo", {
    comments: { lineComment: "//" },
    brackets: [
      ["(", ")"],
      ["[", "]"],
    ],
    autoClosingPairs: [
      { open: "(", close: ")" },
      { open: "[", close: "]" },
      { open: '"', close: '"', notIn: ["string"] },
      { open: "'", close: "'", notIn: ["string"] },
    ],
    wordPattern: /[\p{L}_][\p{L}\p{N}_]*/u,
    indentationRules: {
      increaseIndentPattern: /^\s*(Algoritmo|Proceso|SubProceso|Funcion|Si|SiNo|Mientras|Para|Repetir|Segun|De Otro Modo)\b.*$/i,
      decreaseIndentPattern: /^\s*(Fin\w*|SiNo|Hasta Que|Mientras Que|De Otro Modo)\b.*$/i,
    },
  });

  monaco.languages.registerCompletionItemProvider("codoritmo", {
    provideCompletionItems(model, position) {
      const catalog = getCatalog();
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      const suggestions: languages.CompletionItem[] = [];
      const seen = new Set<string>();
      for (const entry of catalog?.entries ?? []) {
        if (!/[\p{L}]/u.test(entry.label) || seen.has(entry.label)) continue;
        seen.add(entry.label);
        suggestions.push({
          label: { label: entry.label, description: entry.title },
          kind: kindFor(monaco, entry),
          detail: entry.group,
          documentation: { value: `${entry.body}\n\n\`\`\`\n${entry.example}\n\`\`\`` },
          insertText: toSnippet(entry.example),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          sortText: `1-${entry.label}`,
        });
      }
      for (const variable of scanVariables(model.getValue())) {
        if (variable.line === position.lineNumber && variable.name.length <= word.word.length) continue;
        suggestions.push({
          label: { label: variable.name, description: variable.type ?? "variable" },
          kind: monaco.languages.CompletionItemKind.Variable,
          detail: `Variable · línea ${variable.line}`,
          insertText: variable.name,
          range,
          sortText: `0-${variable.name}`,
        });
      }
      return { suggestions };
    },
  });

  monaco.languages.registerHoverProvider("codoritmo", {
    provideHover(model, position) {
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      const variable = scanVariables(model.getValue()).find((v) => v.name.toLowerCase() === word.word.toLowerCase());
      const entry = getCatalog()?.lookup(word.word);
      if (entry) {
        return {
          range,
          contents: [
            { value: `**${entry.label}** — ${entry.title}` },
            { value: entry.body },
            { value: `\`\`\`\n${entry.example}\n\`\`\`` },
          ],
        };
      }
      if (variable) {
        return {
          range,
          contents: [
            { value: `**${variable.name}** · variable${variable.type ? ` (${variable.type})` : ""}` },
            { value: `Aparece por primera vez en la línea ${variable.line}.` },
          ],
        };
      }
      return null;
    },
  });
}
