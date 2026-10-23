// A small highlighter for the generated Python, C, C++ and Java shown on the
// translation pages, producing the same tokens as the pseudocode highlighter
// so the shared CodeBlock colours both sides alike.

import type { CodeToken, CodeTokenType } from "@/src/components/examples-site/content";
import type { ExportLanguage } from "@/src/engine";

const KEYWORDS: Partial<Record<ExportLanguage, string[]>> = {
  python: ["def", "return", "if", "elif", "else", "while", "for", "in", "range", "break", "continue", "import", "from", "and", "or", "not", "True", "False", "None", "pass", "with", "as", "global", "try", "except", "lambda"],
  c: ["return", "if", "else", "while", "for", "do", "switch", "case", "default", "break", "continue", "true", "false", "sizeof", "static", "const", "void", "#include", "#define"],
  cpp: ["return", "if", "else", "while", "for", "do", "switch", "case", "default", "break", "continue", "true", "false", "using", "namespace", "static", "const", "void", "#include", "#define"],
  java: ["class", "public", "private", "static", "void", "return", "if", "else", "while", "for", "do", "switch", "case", "default", "break", "continue", "true", "false", "new", "try", "catch", "import", "null"],
};

const TYPES: Partial<Record<ExportLanguage, string[]>> = {
  python: ["int", "float", "str", "bool", "print", "input"],
  c: ["int", "double", "float", "char", "bool"],
  cpp: ["int", "double", "float", "char", "bool", "string"],
  java: ["int", "double", "float", "char", "boolean", "String"],
};

const TOKEN = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(#?[A-Za-z_]\w*)|(\d+(?:\.\d+)?)|(\s+)|([()[\]{},;:.])|(.)/g;

function lineComment(language: ExportLanguage, line: string): number {
  const marker = language === "python" ? "#" : "//";
  let quote: string | null = null;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quote) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (line.startsWith(marker, i)) return i;
  }
  return -1;
}

function tokenize(language: ExportLanguage, code: string): CodeToken[] {
  const keywords = new Set(KEYWORDS[language] ?? []);
  const types = new Set(TYPES[language] ?? []);
  const tokens: CodeToken[] = [];
  for (const match of code.matchAll(TOKEN)) {
    const [text, str, word, num, space, punct] = match;
    let type: CodeTokenType = "operator";
    if (str) type = "string";
    else if (word) type = keywords.has(word) ? "keyword" : types.has(word) ? "type" : "identifier";
    else if (num) type = "number";
    else if (space) type = "space";
    else if (punct) type = "punctuation";
    tokens.push({ text, type });
  }
  return tokens;
}

/** Splits generated code into lines of coloured tokens. */
export function highlightGenerated(code: string, language: ExportLanguage): CodeToken[][] {
  let inBlockComment = false;
  return code
    .trimEnd()
    .split("\n")
    .map((raw) => {
      const line = raw.replace(/\t/g, "    ");
      if (language !== "python") {
        if (inBlockComment || line.trimStart().startsWith("/*")) {
          inBlockComment = !line.includes("*/");
          return [{ text: line, type: "comment" as const }];
        }
      }
      const cut = lineComment(language, line);
      const code = cut === -1 ? line : line.slice(0, cut);
      const tokens = tokenize(language, code);
      if (cut !== -1) tokens.push({ text: line.slice(cut), type: "comment" });
      return tokens;
    });
}
