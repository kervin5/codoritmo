// Block text for the flowchart: a small tokenizer (so labels can be coloured
// like the editor) and a monospace word-wrapper that both renderers share, so
// the live diagram and the PNG/SVG export break lines in the same places.

export type LabelTokenType =
  | 'identifier'
  | 'keyword'
  | 'number'
  | 'operator'
  | 'punctuation'
  | 'space'
  | 'string'
  | 'type';

export interface LabelToken {
  text: string;
  type: LabelTokenType;
}

export interface WrappedLabel {
  lines: LabelToken[][];
  /** Longest line, in characters. */
  columns: number;
  truncated: boolean;
}

// Same vocabulary as the editor's Monarch grammar (code-editor.tsx), minus
// "opcion": in a block label it is almost always a variable name.
const KEYWORDS = new Set([
  'algoritmo', 'finalgoritmo', 'proceso', 'finproceso', 'subproceso', 'finsubproceso', 'subalgoritmo',
  'finsubalgoritmo', 'funcion', 'función', 'finfuncion', 'finfunción', 'si', 'entonces', 'sino', 'finsi',
  'mientras', 'hacer', 'finmientras', 'repetir', 'hasta', 'que', 'para', 'cada', 'desde', 'con', 'paso',
  'finpara', 'segun', 'según', 'finsegun', 'finsegún', 'de', 'en', 'otro', 'modo', 'caso', 'es',
  'definir', 'como', 'dimension', 'dimensión', 'dimensionar', 'redimensionar', 'redimensión', 'leer',
  'escribir', 'mostrar', 'imprimir', 'informar', 'sin', 'bajar', 'saltar', 'sinsaltar', 'sinbajar', 'limpiar',
  'borrar', 'pantalla', 'limpiarpantalla', 'borrarpantalla', 'esperar', 'tecla', 'esperartecla', 'una',
  'segundo', 'segundos', 'milisegundo', 'milisegundos', 'por', 'referencia', 'valor', 'copia', 'retornar',
  'fin', 'verdadero', 'falso', 'y', 'o', 'no', 'mod',
]);

const TYPES = new Set([
  'entero', 'entera', 'enteros', 'enteras', 'real', 'reales', 'numero', 'número', 'numeros', 'números',
  'numerico', 'numérico', 'numerica', 'numérica', 'logico', 'lógico', 'logica', 'lógica', 'logicos', 'lógicos',
  'caracter', 'carácter', 'caracteres', 'cadena', 'cadenas', 'texto', 'textos',
]);

const TOKEN_PATTERNS: Array<[RegExp, LabelTokenType | 'word']> = [
  [/^\s+/u, 'space'],
  [/^"[^"]*"?/u, 'string'],
  [/^'[^']*'?/u, 'string'],
  [/^\d+(?:\.\d+)?/u, 'number'],
  [/^(?:<-|:=|<=|>=|<>|==|!=|&&|\|\||[+\-*/^%=<>&|~←≤≥≠])/u, 'operator'],
  [/^[;:,()[\]]/u, 'punctuation'],
  [/^[\p{L}_][\p{L}\p{N}_]*/u, 'word'],
];

/** Splits a block label into coloured tokens (keywords, types, strings, numbers, operators). */
export function tokenizeLabel(text: string): LabelToken[] {
  const tokens: LabelToken[] = [];
  let rest = text;

  while (rest.length > 0) {
    let matched = false;
    for (const [pattern, type] of TOKEN_PATTERNS) {
      const match = pattern.exec(rest);
      if (!match) continue;
      const value = match[0];
      const lower = value.toLowerCase();
      tokens.push({
        text: value,
        type: type === 'word'
          ? KEYWORDS.has(lower) ? 'keyword' : TYPES.has(lower) ? 'type' : 'identifier'
          : type,
      });
      rest = rest.slice(value.length);
      matched = true;
      break;
    }
    if (!matched) {
      tokens.push({ text: rest[0], type: 'punctuation' });
      rest = rest.slice(1);
    }
  }

  return tokens;
}

/** Character ranges [start, end) of each wrapped line, greedy on spaces, hard-splitting long words. */
function wrapRanges(text: string, maxChars: number): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let start = 0;

  while (start < text.length) {
    while (text[start] === ' ') start += 1;
    if (start >= text.length) break;
    if (text.length - start <= maxChars) {
      ranges.push([start, text.length]);
      break;
    }
    const window = text.slice(start, start + maxChars + 1);
    const breakAt = window.lastIndexOf(' ');
    if (breakAt > 0) {
      ranges.push([start, start + breakAt]);
      start += breakAt + 1;
    } else {
      ranges.push([start, start + maxChars]);
      start += maxChars;
    }
  }

  return ranges.length > 0 ? ranges : [[0, 0]];
}

function sliceTokens(tokens: LabelToken[], from: number, to: number): LabelToken[] {
  const out: LabelToken[] = [];
  let offset = 0;
  tokens.forEach((token) => {
    const tokenStart = offset;
    const tokenEnd = offset + token.text.length;
    offset = tokenEnd;
    const a = Math.max(from, tokenStart);
    const b = Math.min(to, tokenEnd);
    if (b > a) out.push({ text: token.text.slice(a - tokenStart, b - tokenStart), type: token.type });
  });
  return out;
}

/** Wraps a label to at most `maxLines` lines of `maxChars`, ending with "…" when it does not fit. */
export function wrapLabel(text: string, maxChars: number, maxLines: number): WrappedLabel {
  const tokens = tokenizeLabel(text);
  let ranges = wrapRanges(text, maxChars);
  let truncated = false;

  if (ranges.length > maxLines) {
    truncated = true;
    ranges = ranges.slice(0, maxLines);
    const last = ranges[maxLines - 1];
    ranges[maxLines - 1] = [last[0], Math.min(last[1], last[0] + maxChars - 1)];
  }

  const lines = ranges.map(([from, to]) => sliceTokens(tokens, from, to));
  if (truncated) {
    const last = lines[lines.length - 1];
    while (last.length > 0 && last[last.length - 1].type === 'space') last.pop();
    last.push({ text: '…', type: 'punctuation' });
  }

  return {
    lines,
    columns: Math.max(...lines.map((line) => line.reduce((sum, token) => sum + [...token.text].length, 0))),
    truncated,
  };
}

/** Font metrics shared by both renderers (a monospace face, so width is columns × advance). */
export const LABEL_FONT_SIZE = 13;
export const LABEL_LINE_HEIGHT = 18;
export const LABEL_CHAR_WIDTH = 7.9;
export const LABEL_FONT_FAMILY = 'var(--font-geist-mono), "SFMono-Regular", Menlo, Consolas, monospace';
export const EXPORT_LABEL_FONT_FAMILY = '"SFMono-Regular", Menlo, Consolas, "DejaVu Sans Mono", monospace';

/** Edge labels (Sí / No / case values) use a small proportional face. */
export const EDGE_LABEL_FONT_SIZE = 11;

export function estimateEdgeLabelWidth(label: string): number {
  return Math.ceil([...label].length * 6.6 + 14);
}
