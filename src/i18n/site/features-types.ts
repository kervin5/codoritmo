// Copy for the feature landing pages (/es/pseint-online, /en/pseudocode-to-python…).
// Each locale's file (features-es.ts, features-en.ts) fills this shape.

import type { FeatureId } from "@/src/seo/sections";

export interface FeatureFaq {
  q: string;
  a: string;
}

export interface FeatureStep {
  title: string;
  body: string;
}

/** A section of plain paragraphs, for the explanations specific to one page. */
export interface FeatureNote {
  title: string;
  paragraphs: string[];
}

export interface FeatureCopy {
  /** <title> without the site name (the layout appends it); 60 characters at most. */
  title: string;
  /** Meta description; 155 characters at most. */
  description: string;
  keywords: string[];
  /** Short name, used in breadcrumbs and links to this page. */
  name: string;
  /** One sentence on what the page offers, for cards that link to it. */
  summary: string;
  h1: string;
  lead: string;
  showcase: {
    title: string;
    intro: string;
    /** Alt text for a screenshot, when the showcase is one. */
    alt?: string;
  };
  stepsTitle: string;
  steps: FeatureStep[];
  /** Label of the main button, which opens the showcased program in the app. */
  cta: string;
  ctaHint: string;
  /** Extra explanation specific to this page. */
  notes: FeatureNote[];
  /** Side-by-side lists of what each tool does that the other doesn't (omitted where `comparison` covers it). */
  differences?: {
    intro: string;
    codoritmo: string[];
    desktop: string[];
  };
  /** A full feature-by-feature table (the alternative page). */
  comparison?: {
    feature: string;
    rows: { feature: string; codoritmo: string; desktop: string }[];
  };
  faq: FeatureFaq[];
}

/** Rows of the "how each instruction is translated" table on the translation pages. */
export type MappingRowId =
  | "write"
  | "writeNoNewline"
  | "readInteger"
  | "readReal"
  | "assignRandom"
  | "ifElse"
  | "switch"
  | "while"
  | "repeat"
  | "for"
  | "arrayItem";

export interface FeaturesCopy {
  /** Root of the breadcrumbs (the app's home). */
  home: string;
  stepsCta: string;
  differencesTitle: string;
  codoritmoColumn: string;
  desktopColumn: string;
  officialNote: string;
  officialLinkLabel: string;
  faqTitle: string;
  relatedFeaturesTitle: string;
  relatedExamplesTitle: string;
  relatedExamplesIntro: string;
  keepLearningTitle: string;
  links: {
    examples: { title: string; body: string };
    reference: { title: string; body: string };
    profiles: { title: string; body: string };
    about: { title: string; body: string };
  };
  /** "{concept}: ejemplos" links to concept pages, when they exist. */
  conceptLink: string;
  conceptsTitle: string;
  sourceTitle: string;
  /** "{lang} generado por Codoritmo" */
  generatedTitle: string;
  generatedNote: string;
  openExample: string;
  examplePage: string;
  mapping: {
    title: string;
    intro: string;
    instruction: string;
    pseint: string;
    labels: Record<MappingRowId, string>;
  };
  trace: {
    caption: string;
    step: string;
    line: string;
    instruction: string;
    input: string;
    output: string;
    rowsShown: string;
  };
  flowchart: {
    label: string;
    legendTitle: string;
    legendIntro: string;
    shapes: { id: string; name: string; body: string }[];
    galleryTitle: string;
    galleryIntro: string;
  };
  blocks: {
    codeTitle: string;
  };
  features: Record<FeatureId, FeatureCopy>;
}
