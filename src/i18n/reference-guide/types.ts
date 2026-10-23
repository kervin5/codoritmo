/** Beginner-facing explanation of one reference entry (keyed by snippet id). */
export interface ReferenceGuideEntry {
  /** What it does and when you'd use it, assuming no prior programming. */
  body: string;
  /** A small, realistic example (not a template). */
  example: string;
  /** What the example produces or does. */
  outcome: string;
  /** The most common mistake or a useful nuance. */
  tip?: string;
}

export type ReferenceGuide = Record<string, ReferenceGuideEntry>;
