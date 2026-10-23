// Build-time data for the public reference pages. The entries are the same
// ones the workspace's reference panel shows (snippet catalog + beginner
// guide), built here without hooks, for the default engine settings, so the
// static pages match what a student sees in the app by default.

import { getOperatorGroups, getStructureSnippets } from "@/src/components/ide/snippets";
import { shapeSpecFor, type ShapeSpec } from "@/src/components/workspace/reference-shape";
import { defaultEngineSettings, examplePrograms, type EngineSettings, type ExampleConcept, type ExampleProgram } from "@/src/engine";
import type { Locale } from "@/src/i18n/config";
import { enReferenceSite } from "@/src/i18n/site/reference-en";
import { esReferenceSite } from "@/src/i18n/site/reference-es";
import type { ReferenceEntryCopy, ReferenceGroupId, ReferenceSiteCopy } from "@/src/i18n/site/reference-types";
import type { Dictionary } from "@/src/i18n/types";
import { SECTION_SEGMENTS, sectionPath } from "@/src/seo/sections";

export const referenceCopy: Record<Locale, ReferenceSiteCopy> = { es: esReferenceSite, en: enReferenceSite };

/** The public pages show the default profile; every school profile is one click away in the app. */
export const referenceSettings: EngineSettings = defaultEngineSettings;

/** Fills a profile's operators into guide text: {and} → Y or &&, etc. (same rule as the reference panel). */
export function fillOperators(text: string, settings: EngineSettings = referenceSettings): string {
  const words = settings.wordOperators;
  return text
    .replace(/\{and\}/g, words ? "Y" : "&&")
    .replace(/\{or\}/g, words ? "O" : "||")
    .replace(/\{not\}/g, words ? "NO" : "~")
    .replace(/\{mod\}/g, words ? "MOD" : "%");
}

/**
 * Guide entries that are near-copies of another one: they appear on that
 * entry's page (as a second example) instead of having a page of their own.
 * "rutina" is the same text as "subproceso", so it is left out entirely.
 */
const MERGED_INTO: Record<string, string | null> = {
  rutina: null,
  "escribir-linea": "escribir",
  "repetir-hasta": "repetir",
};

interface RunPlan {
  /** Lines before the guide's example, so it runs with sensible data. */
  setup?: string | Record<Locale, string>;
  /** Lines after it (for routines: the call in the main algorithm). */
  after?: string;
  /** Sample answers for Leer, one per line. */
  input?: string;
  /** The example-library concept closest to this entry. */
  concept: ExampleConcept;
  /** Matches example programs that really use this entry (strings and comments removed). */
  uses?: RegExp;
}

const PLANS: Record<string, RunPlan> = {
  definir: { concept: "variables", uses: /^\s*Definir\b/im },
  dimension: { after: "Escribir notas[1]", concept: "arreglos", uses: /\bDimension\b/i },
  escribir: { concept: "io", uses: /\bEscribir\b/i },
  "escribir-linea": { concept: "io" },
  "escribir-sin-bajar": { concept: "io", uses: /\bSin (Saltar|Bajar)\b/i },
  leer: { input: "15", after: "Escribir edad", concept: "io", uses: /\bLeer\b/i },
  asignar: { after: "Escribir puntos", concept: "variables", uses: /<-/ },
  si: { setup: "edad <- 20", concept: "si", uses: /\bEntonces\b/i },
  "si-sino": { setup: { es: "nota <- 14", en: "nota <- 75" }, concept: "si", uses: /^\s*SiNo\b/im },
  segun: { setup: "opcion <- 2", concept: "segun", uses: /\bSegun\b/i },
  mientras: { concept: "mientras", uses: /^\s*Mientras\b(?!\s+Que)/im },
  repetir: { input: "-3\n0\n7", concept: "repetir", uses: /\bHasta\s+Que\b/i },
  "repetir-hasta": { input: "0000\n1234", concept: "repetir" },
  "repetir-mientras": { input: "-5\n-1\n4", concept: "repetir", uses: /^\s*Mientras\s+Que\b/im },
  para: { concept: "para", uses: /^\s*Para\s+(?!Cada\b)\w+\s*(<-|:=)/im },
  "para-cada": {
    setup: "Dimension notas[3]\nnotas[1] <- 15\nnotas[2] <- 9\nnotas[3] <- 18",
    concept: "paraCada",
    uses: /\bPara\s+Cada\b/i,
  },
  limpiar: { concept: "pantalla", uses: /\bLimpiar\s+Pantalla\b/i },
  esperar: { concept: "pantalla", uses: /\bEsperar\s+(?!Tecla)\S/i },
  "esperar-tecla": { concept: "pantalla", uses: /\bEsperar\s+Tecla\b/i },
  subproceso: { after: 'Saludar("Ana")', concept: "subprocesos", uses: /^\s*SubProceso\b/im },
  subalgoritmo: { after: "Linea()\nLinea()", concept: "subprocesos", uses: /^\s*SubAlgoritmo\b/im },
  funcion: { after: "Escribir Doble(21)", concept: "funciones", uses: /^\s*Funcion\b/im },
  retornar: { after: "Escribir Maximo(3, 9)", concept: "funciones", uses: /\bRetornar\b/i },
  plus: { concept: "matematicas", uses: /\w\s*\+\s*\w/ },
  minus: { concept: "matematicas", uses: /\w\s+-\s+\w/ },
  multiply: { concept: "matematicas", uses: /\w\s*\*\s*\w/ },
  divide: { concept: "matematicas", uses: /\w\s*\/\s*\w/ },
  power: { concept: "matematicas", uses: /\^/ },
  mod: { concept: "matematicas", uses: /\bMOD\b|%/ },
  and: { concept: "logicos", uses: /\sY\s|&&/ },
  or: { concept: "logicos", uses: /\sO\s|\|\|/ },
  not: { concept: "logicos", uses: /\bNO\s|~/ },
  eq: { concept: "si", uses: /[^<>!=:]=[^=]/ },
  neq: { concept: "si", uses: /<>|!=/ },
  lt: { concept: "si", uses: /\w\s*<\s*[\w(]/ },
  leq: { concept: "si", uses: /<=/ },
  gt: { concept: "si", uses: /\w\s*>\s*[\w(]/ },
  geq: { concept: "si", uses: />=/ },
  abs: { concept: "matematicas", uses: /\bAbs\s*\(/i },
  trunc: { concept: "matematicas", uses: /\bTrunc\s*\(/i },
  redon: { concept: "matematicas", uses: /\bRedon\s*\(/i },
  raiz: { concept: "matematicas", uses: /\b(Raiz|RC)\s*\(/i },
  azar: { after: "Escribir dado", concept: "azar", uses: /\bAzar\s*\(/i },
  longitud: { concept: "texto", uses: /\bLongitud\s*\(/i },
  subcadena: { concept: "texto", uses: /\bSubCadena\s*\(/i },
  concatenar: { concept: "texto", uses: /\bConcatenar\s*\(/i },
  "convertir-numero": { concept: "texto", uses: /\bConvertirANumero\s*\(/i },
  "convertir-texto": { concept: "texto", uses: /\bConvertirATexto\s*\(/i },
  pi: { setup: "radio <- 2", after: "Escribir area", concept: "matematicas", uses: /\bPI\b/ },
  euler: { concept: "matematicas", uses: /\bEuler\b/i },
};

/** Variant labels in the snippet catalog describe the option ("Con Sino"); pages show the keyword. */
const LABELS: Record<string, string> = {
  "escribir-sin-bajar": "Escribir Sin Saltar",
  "si-sino": "SiNo",
  "repetir-mientras": "Mientras Que",
};

const ROUTINE = /^(SubProceso|SubAlgoritmo|Funcion)\b/;
const indent = (text: string) =>
  text
    .split("\n")
    .map((line) => (line ? `\t${line}` : line))
    .join("\n");

/** Wraps a guide example into a complete algorithm (routines go before it), like the guide's own test. */
export function buildProgram(locale: Locale, example: string, plan: Pick<RunPlan, "setup" | "after"> = {}): string {
  const name = locale === "es" ? "Ejemplo" : "Example";
  const setup = typeof plan.setup === "string" ? plan.setup : plan.setup?.[locale];
  if (ROUTINE.test(example)) {
    return `${example}\n\nAlgoritmo ${name}\n${indent(plan.after ?? "")}\nFinAlgoritmo\n`;
  }
  const body = [setup, example, plan.after].filter(Boolean).join("\n");
  return `Algoritmo ${name}\n${indent(body)}\nFinAlgoritmo\n`;
}

/* ---------------- entries ---------------- */

export interface WorkedExample {
  /** The guide's example, as written in the guide. */
  sample: string;
  outcome: string;
  /** The complete, runnable algorithm shown on the page. */
  program: string;
  input?: string;
}

export interface ReferenceEntry {
  id: string;
  groupId: ReferenceGroupId;
  groupTitle: string;
  /** The keyword or symbol, as the default profile writes it. */
  label: string;
  /** One line from the snippet catalog, for lists. */
  summary: string;
  body: string;
  /** The insertable template with <placeholders>. */
  template: string;
  example: WorkedExample;
  /** Merged guide entries shown as further examples. */
  more: WorkedExample[];
  tip?: string;
  shape: ShapeSpec | null;
  concept: ExampleConcept;
  uses?: RegExp;
  copy: ReferenceEntryCopy;
}

export interface ReferenceGroup {
  id: ReferenceGroupId;
  title: string;
  entries: ReferenceEntry[];
}

const catalogCache = new Map<Dictionary, ReferenceGroup[]>();

/** Every reference page in a locale, grouped like the workspace's reference panel. */
export function referenceCatalog(locale: Locale, dictionary: Dictionary): ReferenceGroup[] {
  const cached = catalogCache.get(dictionary);
  if (cached) return cached;
  const settings = referenceSettings;
  const copy = referenceCopy[locale];
  const groups = [getStructureSnippets(settings, dictionary), ...getOperatorGroups(settings, dictionary)];

  const worked = (id: string): WorkedExample | null => {
    const guide = dictionary.referenceGuide[id];
    const plan = PLANS[id];
    if (!guide || !plan) return null;
    const sample = fillOperators(guide.example, settings);
    return {
      sample,
      outcome: fillOperators(guide.outcome, settings),
      program: buildProgram(locale, sample, plan),
      input: plan.input,
    };
  };

  const result: ReferenceGroup[] = groups.map((group) => {
    const entries: ReferenceEntry[] = [];
    for (const item of group.items) {
      for (const each of [item, ...(item.variants ?? [])]) {
        if (each.id in MERGED_INTO) continue;
        const guide = dictionary.referenceGuide[each.id];
        const example = worked(each.id);
        const entryCopy = copy.entries[each.id];
        if (!guide || !example || !entryCopy) continue;
        const shape = shapeSpecFor(each.id);
        const more = Object.entries(MERGED_INTO)
          .filter(([, target]) => target === each.id)
          .map(([id]) => worked(id))
          .filter((w): w is WorkedExample => w !== null);
        entries.push({
          id: each.id,
          groupId: group.id as ReferenceGroupId,
          groupTitle: group.title,
          label: LABELS[each.id] ?? each.label,
          summary: fillOperators(each.help.body, settings),
          body: fillOperators(guide.body, settings),
          template: each.insertText,
          example,
          more,
          tip: guide.tip === undefined ? undefined : fillOperators(guide.tip, settings),
          shape: shape ? { ...shape, label: fillOperators(shape.label, settings) } : null,
          concept: PLANS[each.id].concept,
          uses: PLANS[each.id].uses,
          copy: entryCopy,
        });
      }
    }
    return { id: group.id as ReferenceGroupId, title: group.title, entries };
  });
  catalogCache.set(dictionary, result);
  return result;
}

export function findReferenceEntry(locale: Locale, dictionary: Dictionary, slug: string) {
  for (const group of referenceCatalog(locale, dictionary)) {
    const index = group.entries.findIndex((entry) => entry.copy.slug === slug);
    if (index !== -1) return { group, entry: group.entries[index], index };
  }
  return null;
}

/* ---------------- urls ---------------- */

/** Ids of every entry that has its own page, in catalog-independent order. */
export const referenceIds = Object.keys(esReferenceSite.entries);

export function referenceIdFromSlug(locale: Locale, slug: string): string | null {
  const entries = referenceCopy[locale].entries;
  return Object.keys(entries).find((id) => entries[id].slug === slug) ?? null;
}

/** /es/referencia */
export const referenceIndexPath = (locale: Locale) => sectionPath(locale, "reference");

/** /es/referencia/mientras */
export function referencePath(locale: Locale, id: string): string {
  return `/${locale}/${SECTION_SEGMENTS.reference[locale]}/${referenceCopy[locale].entries[id].slug}`;
}

/* ---------------- examples that use an entry ---------------- */

/** Source without string literals and comments, so keywords inside text don't count. */
function codeOnly(source: string): string {
  return source.replace(/"[^"\n]*"|'[^'\n]*'/g, '""').replace(/\/\/.*$/gm, "");
}

const codeCache = new Map<string, string>();
const code = (example: ExampleProgram) => {
  let text = codeCache.get(example.id);
  if (text === undefined) codeCache.set(example.id, (text = codeOnly(example.source)));
  return text;
};

/** Library examples that use an entry, simplest first; falls back to its concept. */
export function examplesUsing(entry: Pick<ReferenceEntry, "uses" | "concept">, limit = 6): ExampleProgram[] {
  const byLevel = (list: ExampleProgram[]) =>
    list
      .map((example, order) => ({ example, order }))
      .sort((a, b) => a.example.level - b.example.level || a.order - b.order)
      .map(({ example }) => example);
  const matching = entry.uses ? examplePrograms.filter((example) => entry.uses!.test(code(example))) : [];
  const list = matching.length > 0 ? matching : examplePrograms.filter((example) => example.concepts.includes(entry.concept));
  return byLevel(list).slice(0, limit);
}
