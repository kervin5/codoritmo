// Copy for the concept pages (/es/ejemplos/concepto/<slug>, /en/examples/concept/<slug>):
// one page per concept of the example library, explaining it for a beginner
// and listing every example that uses it.

import type { ExampleConcept } from "@/src/engine";

export interface ConceptCopy {
  /** URL slug in this locale. */
  slug: string;
  /** The page heading, worded the way students search. */
  h1: string;
  /** <title> without the site name (the layout appends it). */
  title: string;
  /** Meta description, at most 155 characters. */
  description: string;
  /** The explanation: 2–4 short paragraphs. */
  paragraphs: string[];
  /** A short, complete program that shows the concept (verified by tests). */
  snippet: string;
  /** Sample answers for Leer in the snippet, one per line. */
  input?: string;
}

export interface ConceptSiteCopy {
  page: {
    explanation: string;
    snippet: string;
    snippetIntro: string;
    output: string;
    examples: string;
    examplesIntro: string;
    reference: string;
    referenceIntro: string;
    otherConcepts: string;
    open: string;
    openHint: string;
    openLabel: string;
    independent: string;
    officialSite: string;
  };
  concepts: Record<ExampleConcept, ConceptCopy>;
}
