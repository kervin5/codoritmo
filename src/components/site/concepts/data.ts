// URLs and links for the concept pages (/es/ejemplos/concepto/<slug>,
// /en/examples/concept/<slug>). Kept apart from the page module so the
// reference pages can link here without a circular import.

import { examplePrograms, exampleConcepts, type ExampleConcept, type ExampleProgram } from "@/src/engine";
import type { Locale } from "@/src/i18n/config";
import { enConceptsSite } from "@/src/i18n/site/concepts-en";
import { esConceptsSite } from "@/src/i18n/site/concepts-es";
import type { ConceptSiteCopy } from "@/src/i18n/site/concepts-types";
import { examplesIndexPath } from "@/src/lib/example-urls";

export const conceptsCopy: Record<Locale, ConceptSiteCopy> = { es: esConceptsSite, en: enConceptsSite };

/** The [slug] segment under the examples section that holds concept pages. */
export const conceptSegment: Record<Locale, string> = { es: "concepto", en: "concept" };

export type Concept = ExampleConcept;
export const concepts: readonly Concept[] = exampleConcepts;

export function conceptFromSlug(locale: Locale, slug: string): Concept | null {
  return concepts.find((concept) => conceptsCopy[locale].concepts[concept].slug === slug) ?? null;
}

/** /es/ejemplos/concepto/ciclo-mientras */
export function conceptPath(locale: Locale, concept: Concept): string {
  return `${examplesIndexPath(locale)}/${conceptSegment[locale]}/${conceptsCopy[locale].concepts[concept].slug}`;
}

/** Every example that uses a concept, simplest first (library order within a level). */
export function examplesWithConcept(concept: Concept): ExampleProgram[] {
  return examplePrograms
    .map((example, order) => ({ example, order }))
    .filter(({ example }) => example.concepts.includes(concept))
    .sort((a, b) => a.example.level - b.example.level || a.order - b.order)
    .map(({ example }) => example);
}

/** Reference entries (snippet ids) explaining the instructions a concept relies on. */
export const CONCEPT_REFERENCES: Record<Concept, string[]> = {
  io: ["escribir", "escribir-sin-bajar", "leer"],
  variables: ["definir", "asignar"],
  si: ["si", "si-sino", "and", "or", "eq", "geq"],
  segun: ["segun", "si"],
  mientras: ["mientras", "repetir", "para"],
  repetir: ["repetir", "repetir-mientras", "mientras"],
  para: ["para", "para-cada", "mientras"],
  paraCada: ["para-cada", "para", "dimension"],
  arreglos: ["dimension", "para", "para-cada"],
  matrices: ["dimension", "para"],
  redimensionar: ["dimension", "mientras"],
  texto: ["longitud", "subcadena", "concatenar", "convertir-numero", "convertir-texto"],
  logicos: ["and", "or", "not"],
  subprocesos: ["subproceso", "subalgoritmo", "funcion"],
  funciones: ["funcion", "retornar", "subproceso"],
  referencia: ["subproceso", "funcion"],
  recursion: ["funcion", "si-sino"],
  azar: ["azar", "mod"],
  matematicas: ["mod", "divide", "power", "raiz", "trunc", "redon", "abs"],
  pantalla: ["limpiar", "esperar", "esperar-tecla"],
  coloquial: ["si", "mod", "eq"],
};
