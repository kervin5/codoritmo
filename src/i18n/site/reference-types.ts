// Copy for the public language reference pages (/es/referencia, /en/reference).
// The explanations themselves come from the shared reference guide
// (src/i18n/reference-guide); this file holds what only the public pages need:
// URLs, titles, headings and the page chrome.

/** Per-entry copy, keyed by snippet id (see src/components/ide/snippets.ts). */
export interface ReferenceEntryCopy {
  /** URL slug in this locale: stable, keyword-based, unique. */
  slug: string;
  /** Short name for lists, breadcrumbs and links. */
  name: string;
  /** The page heading, worded the way students search. */
  h1: string;
  /** <title> without the site name (the layout appends it). */
  title: string;
  /** Meta description, at most 155 characters. */
  description: string;
  /** An extra fact for this entry, e.g. the symbol you can write instead. */
  note?: string;
}

export type ReferenceGroupId = "structures" | "algebraic" | "logical" | "relational" | "math" | "strings" | "constants";

export interface ReferenceSiteCopy {
  /** Section name for breadcrumbs and links. */
  section: string;
  index: {
    title: string;
    description: string;
    h1: string;
    intro: string[];
    groupIntros: Record<ReferenceGroupId, string>;
    contents: string;
  };
  page: {
    whatItDoes: string;
    example: string;
    exampleIntro: string;
    result: string;
    resultIntro: string;
    resultWithInput: string;
    noOutput: string;
    anotherExample: string;
    mistake: string;
    note: string;
    flowchart: string;
    flowchartIntro: string;
    flowchartLink: string;
    template: string;
    templateIntro: string;
    usedIn: string;
    usedInIntro: string;
    seeAllConcept: string;
    siblings: string;
    open: string;
    openHint: string;
    openLabel: string;
    independent: string;
    officialSite: string;
    profilesLink: string;
    profilesHint: string;
    backToIndex: string;
    previous: string;
    next: string;
    group: string;
  };
  /** Shape names for the flowchart's alt text, by node kind. */
  shapes: Record<"process" | "input" | "output" | "decision" | "switch" | "loop" | "call", string>;
  /** Alt text templates by scene; {shape} and {label} are filled in. */
  scenes: Record<"single" | "branches" | "while" | "repeat-until" | "repeat-while" | "for" | "cases", string>;
  /** Alt text prefix when the entry is shown inside the block it usually lives in. */
  sceneContext: Record<"condition" | "process", string>;
  entries: Record<string, ReferenceEntryCopy>;
}
