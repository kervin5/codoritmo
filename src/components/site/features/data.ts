// Build-time data for the feature pages: real output of the engine, computed
// while prerendering, so every code sample, table and diagram on these pages
// is exactly what the app produces for the same program.

import {
  examplePrograms,
  exportLanguages,
  generateExport,
  Interpreter,
  normalizeEngineSettings,
  Parser,
  type ExampleProgram,
  type ExportLanguage,
  type Runtime,
  type VariableSnapshot,
} from "@/src/engine";
import { generatedProfiles } from "@/src/engine/school-profiles";
import { shapeSceneSvg, shapeSpecFor, svgDataUri } from "@/src/components/workspace/reference-shape";
import type { MappingRowId } from "@/src/i18n/site/features-types";
import type { FeatureId } from "@/src/seo/sections";

/** How many school profiles come from PSeInt (463 today). */
export const schoolProfileCount = generatedProfiles.length;
export const exampleCount = examplePrograms.length;

export function exampleById(id: string): ExampleProgram {
  const example = examplePrograms.find((e) => e.id === id);
  if (!example) throw new Error(`Unknown example ${id}`);
  return example;
}

/** The program each page shows and opens in the app. */
export const FEATURE_EXAMPLE: Record<FeatureId, string> = {
  "pseint-online": "sum-until-zero",
  alternative: "sum-until-zero",
  flowchart: "sum-until-zero",
  "desk-check": "sum-until-zero",
  "to-python": "guess-number",
  "to-c": "gcd-lcm",
  "to-java": "array-average",
  blocks: "times-table",
};

/** More examples worth opening from each page. */
export const FEATURE_RELATED_EXAMPLES: Record<FeatureId, string[]> = {
  "pseint-online": ["hello-world", "guess-number", "bubble-sort"],
  alternative: ["can-vote", "binary-search", "hanoi"],
  flowchart: ["can-vote", "times-table", "leap-year"],
  "desk-check": ["factorial-power", "linear-search", "bubble-sort"],
  "to-python": ["temperature", "palindrome", "bubble-sort"],
  "to-c": ["times-table", "primes", "fibonacci"],
  "to-java": ["linear-search", "factorial-power", "selection-sort"],
  blocks: ["greeting", "can-vote", "countdown"],
};

export const TRANSLATION_LANGUAGE: Partial<Record<FeatureId, ExportLanguage>> = {
  "to-python": "python",
  "to-c": "c",
  "to-java": "java",
};

export const LANGUAGE_NAMES = Object.fromEntries(
  Object.values(exportLanguages).map((definition) => [definition.id, definition.name])
) as Record<ExportLanguage, string>;

/* ---------------- translations ---------------- */

export function translateSource(source: string, language: ExportLanguage, settings?: ExampleProgram["settings"]): string {
  const normalized = normalizeEngineSettings(settings);
  const parsed = new Parser(source, { settings: normalized }).parse();
  if (!parsed.program) throw new Error("The program does not parse");
  const code = generateExport(parsed.program, language, { settings: normalized }).code;
  if (!code) throw new Error(`No ${language} output`);
  return code;
}

export function translateExample(example: ExampleProgram, language: ExportLanguage): string {
  return translateSource(example.source, language, example.settings);
}

/** One instruction per row; each is translated inside the same small program. */
export const MAPPING_ROWS: { id: MappingRowId; pseint: string }[] = [
  { id: "write", pseint: 'Escribir "Hola, ", nombre' },
  { id: "writeNoNewline", pseint: 'Escribir Sin Saltar "Total: "' },
  { id: "readInteger", pseint: "Leer n" },
  { id: "readReal", pseint: "Leer x" },
  { id: "assignRandom", pseint: "n <- Aleatorio(1, 6)" },
  { id: "ifElse", pseint: 'Si n MOD 2 = 0 Entonces\n\tEscribir "par"\nSiNo\n\tEscribir "impar"\nFinSi' },
  { id: "switch", pseint: 'Segun n Hacer\n\t1: Escribir "uno"\n\tDe Otro Modo: Escribir "otro"\nFinSegun' },
  { id: "while", pseint: "Mientras n > 0 Hacer\n\tn <- n - 1\nFinMientras" },
  { id: "repeat", pseint: "Repetir\n\tLeer n\nHasta Que n > 0" },
  { id: "for", pseint: "Para i <- 1 Hasta 10 Hacer\n\tEscribir i\nFinPara" },
  { id: "arrayItem", pseint: "datos[1] <- n" },
];

const indent = (text: string) =>
  text
    .split("\n")
    .map((line) => `\t${line}`)
    .join("\n");

function mappingProgram(statement: string): string {
  return [
    "Algoritmo Demo",
    "\tDefinir n, i Como Entero",
    "\tDefinir x Como Real",
    "\tDefinir nombre Como Caracter",
    "\tDefinir datos Como Entero",
    "\tDimension datos[5]",
    ...(statement ? [indent(statement)] : []),
    "FinAlgoritmo",
    "",
  ].join("\n");
}

/** Indentation of statements directly inside main() in each generated language. */
const BODY_INDENT: Partial<Record<ExportLanguage, string>> = { python: "    ", c: "\t", cpp: "\t", java: "        " };

const indentOf = (line: string) => line.length - line.trimStart().length;

/** Variable declarations, which can change when a statement first uses a variable; never part of the statement. */
const DECLARATION = /^\s*(\w+: [\w[\]]+( = .*)?|(int|double|bool|boolean|char|String|float)\b.*;)$/;

/**
 * The lines a statement adds to main(): translate the program with and without
 * it and keep the first new block of lines at the body's indentation.
 */
export function translateStatement(statement: string, language: ExportLanguage): string {
  const bodyIndent = BODY_INDENT[language];
  if (!bodyIndent) throw new Error(`No mapping for ${language}`);
  const base = translateSource(mappingProgram(""), language).split("\n");
  const lines = translateSource(mappingProgram(statement), language).split("\n");
  const remaining = new Map<string, number>();
  for (const line of base) remaining.set(line, (remaining.get(line) ?? 0) + 1);
  const isNew = lines.map((line) => {
    const count = remaining.get(line) ?? 0;
    if (count > 0) {
      remaining.set(line, count - 1);
      return false;
    }
    return true;
  });
  const depth = bodyIndent.length;
  const start = lines.findIndex((line, index) => isNew[index] && indentOf(line) === depth && line.trim() !== "" && !DECLARATION.test(line));
  if (start === -1) return "";
  const block: string[] = [];
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) break;
    const lineDepth = indentOf(line);
    if (lineDepth > depth || (lineDepth === depth && isNew[index])) block.push(line.slice(bodyIndent.length));
    else break;
  }
  return block.join("\n");
}

export function mappingTable(language: ExportLanguage): { id: MappingRowId; pseint: string; target: string }[] {
  return MAPPING_ROWS.map((row) => ({ ...row, target: translateStatement(row.pseint, language) }));
}

/* ---------------- desk check ---------------- */

export interface TraceTable {
  variables: string[];
  rows: { step: number; line: number; code: string; values: { text: string; changed: boolean }[] }[];
  inputs: string[];
  output: string[];
}

/** Same formatting as the desk check panel in the workspace. */
export function formatTraceValue(value: VariableSnapshot["value"]): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "VERDADERO" : "FALSO";
  if (typeof value === "string") return `"${value}"`;
  if (Array.isArray(value)) return `[${value.map(formatTraceValue).join(", ")}]`;
  return String(value);
}

const traceCache = new Map<string, Promise<TraceTable>>();

/**
 * Runs the example with its sample answers and records, like the workspace's
 * desk check, the variables before every statement (rows without variables
 * are left out, as there).
 */
export function traceExample(example: ExampleProgram): Promise<TraceTable> {
  let trace = traceCache.get(example.id);
  if (!trace) {
    trace = buildTrace(example);
    traceCache.set(example.id, trace);
  }
  return trace;
}

async function buildTrace(example: ExampleProgram): Promise<TraceTable> {
  const inputs = example.input?.split("\n") ?? [];
  const queue = [...inputs];
  const output: string[] = [];
  let pending = "";
  const frames: { line: number; variables: VariableSnapshot[] }[] = [];
  const runtime: Runtime = {
    write(value, newline = true) {
      pending += value;
      if (newline) {
        output.push(pending);
        pending = "";
      }
    },
    read() {
      if (pending) output.push(pending);
      pending = "";
      return queue.shift() ?? "";
    },
    clear() {},
    async sleep() {},
    async waitForKey() {},
  };
  const interpreter = new Interpreter({
    settings: normalizeEngineSettings(example.settings),
    limits: { maxSteps: 100_000, maxOutputLines: 400 },
    hooks: {
      onStatement: (event) => {
        if (frames.length < 400) frames.push({ line: event.line, variables: event.variables() });
      },
    },
  });
  await interpreter.run(example.source, runtime);
  if (pending) output.push(pending);

  const sourceLines = example.source.split("\n");
  const kept = frames.map((frame, step) => ({ ...frame, step })).filter((frame) => frame.variables.length > 0);
  const variables: string[] = [];
  for (const frame of kept) for (const v of frame.variables) if (!variables.includes(v.name)) variables.push(v.name);

  const rows = kept.map((frame, index) => {
    const previous = kept[index - 1];
    return {
      step: frame.step + 1,
      line: frame.line,
      code: (sourceLines[frame.line - 1] ?? "").trim(),
      values: variables.map((name) => {
        const variable = frame.variables.find((v) => v.name === name);
        const before = previous?.variables.find((v) => v.name === name);
        const changed = Boolean(variable?.initialized) && index > 0 && JSON.stringify(variable?.value) !== JSON.stringify(before?.value);
        return { text: variable?.initialized ? formatTraceValue(variable.value) : "", changed };
      }),
    };
  });
  return { variables, rows, inputs, output };
}

/* ---------------- flowchart shapes ---------------- */

export interface ShapeImage {
  id: string;
  src: string;
  width: number;
  height: number;
}

/** The reference panel's little flowchart scenes, as images for the legend. */
export function shapeImage(id: string): ShapeImage | null {
  const spec = shapeSpecFor(id);
  if (!spec) return null;
  const svg = shapeSceneSvg(spec);
  const width = Number(/width="(\d+)"/.exec(svg)?.[1] ?? 0);
  const height = Number(/height="(\d+)"/.exec(svg)?.[1] ?? 0);
  return { id, src: svgDataUri(svg), width, height };
}
