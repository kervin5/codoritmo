// Build-time data for the public example pages: which pages exist, their
// localized URLs, the highlighted source, the flowcharts and a sample run.
// Everything here is pure and deterministic, so the pages can be prerendered.

import { buildFlowDiagram, exportRoutineToSvg, layoutFlowDiagramSync, tokenizeLabel, type LabelTokenType } from "@/src/diagram";
import {
  examplePrograms,
  exampleTopics,
  Interpreter,
  normalizeEngineSettings,
  Parser,
  type ExampleProgram,
  type ExampleTopic,
  type Runtime,
} from "@/src/engine";
import { hasLocale, locales, type Locale } from "@/src/i18n/config";
import {
  examplePath,
  examplesIndexPath,
  examplesSection,
  exampleIdFromSlug,
  exampleSlug,
  topicFromSlug,
  topicPath,
  topicSection,
  topicSlug,
} from "@/src/lib/example-urls";
import { siteUrl } from "@/src/seo/site";

export type Topic = (typeof exampleTopics)[number];

/* ---------------- routing ---------------- */

/** The locale when `section` is that locale's library segment (/es/ejemplos), else null. */
export function sectionLocale(lang: string, section: string): Locale | null {
  return hasLocale(lang) && examplesSection[lang] === section ? lang : null;
}

export function sectionParams(lang: string) {
  return hasLocale(lang) ? [{ section: examplesSection[lang] }] : [];
}

export function exampleParams(lang: string) {
  return hasLocale(lang) ? examplePrograms.map((e) => ({ slug: exampleSlug(lang, e.id) })) : [];
}

export function topicParams(lang: string) {
  return hasLocale(lang) ? exampleTopics.map((topic) => ({ topic: topicSlug(lang, topic) })) : [];
}

export function findExample(locale: Locale, slug: string): ExampleProgram | null {
  const id = exampleIdFromSlug(locale, slug);
  return id ? (examplePrograms.find((e) => e.id === id) ?? null) : null;
}

export function findTopic(locale: Locale, topicSegment: string, slug: string): Topic | null {
  return topicSection[locale] === topicSegment ? topicFromSlug(locale, slug) : null;
}

export function absoluteUrl(path: string): string {
  return `${siteUrl}${path}`;
}

/** Canonical plus hreflang alternates for a page whose path differs per locale. */
export function pageAlternates(locale: Locale, pathFor: (locale: Locale) => string) {
  const languages: Record<string, string> = {};
  for (const other of locales) languages[other] = absoluteUrl(pathFor(other));
  languages["x-default"] = absoluteUrl(pathFor("es"));
  return { canonical: absoluteUrl(pathFor(locale)), languages };
}

export const indexPathFor = (locale: Locale) => examplesIndexPath(locale);
export const topicPathFor = (topic: Topic) => (locale: Locale) => topicPath(locale, topic);
/** Per-example Open Graph image (a static route next to the page). */
export function ogImagePath(locale: Locale, id: string): string {
  return `${examplePath(locale, id)}/og.png`;
}

export const examplePathFor = (id: string) => (locale: Locale) => examplePath(locale, id);

/** Every public URL of the library, in both locales, with its translations (for the sitemap and tests). */
export function allExamplePagePaths(): {
  kind: "index" | "topic" | "example";
  locale: Locale;
  path: string;
  languages: Record<Locale, string>;
}[] {
  const pages: { kind: "index" | "topic" | "example"; pathFor: (locale: Locale) => string }[] = [
    { kind: "index", pathFor: indexPathFor },
    ...exampleTopics.map((topic) => ({ kind: "topic" as const, pathFor: topicPathFor(topic) })),
    ...examplePrograms.map((e) => ({ kind: "example" as const, pathFor: examplePathFor(e.id) })),
  ];
  return locales.flatMap((locale) =>
    pages.map(({ kind, pathFor }) => ({
      kind,
      locale,
      path: pathFor(locale),
      languages: Object.fromEntries(locales.map((other) => [other, absoluteUrl(pathFor(other))])) as Record<Locale, string>,
    })),
  );
}

/* ---------------- grouping ---------------- */

export function examplesInTopic(topic: ExampleTopic): ExampleProgram[] {
  return examplePrograms.filter((e) => e.topic === topic);
}

export function topicNeighbours(example: ExampleProgram) {
  const siblings = examplesInTopic(example.topic);
  const index = siblings.findIndex((e) => e.id === example.id);
  return {
    previous: index > 0 ? siblings[index - 1] : null,
    next: index < siblings.length - 1 ? siblings[index + 1] : null,
  };
}

/** Up to `limit` examples that share the most concepts, preferring the same topic and a close level. */
export function relatedExamples(example: ExampleProgram, limit = 3): ExampleProgram[] {
  const { previous, next } = topicNeighbours(example);
  const skip = new Set([example.id, previous?.id, next?.id]);
  return examplePrograms
    .filter((e) => !skip.has(e.id))
    .map((e, order) => {
      const shared = e.concepts.filter((c) => example.concepts.includes(c)).length;
      const score = shared * 3 + (e.topic === example.topic ? 2 : 0) - Math.abs(e.level - example.level);
      return { e, score, order };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map(({ e }) => e);
}

/* ---------------- code highlighting ---------------- */

export type CodeTokenType = LabelTokenType | "comment";
export interface CodeToken {
  text: string;
  type: CodeTokenType;
}

/** Index of a `//` comment that is not inside a string, or -1. */
function commentStart(line: string): number {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === "/" && line[i + 1] === "/") {
      return i;
    }
  }
  return -1;
}

/** Splits source into lines of coloured tokens, using the flowchart's tokenizer plus comments. */
export function highlightSource(source: string): CodeToken[][] {
  return source
    .replace(/\r\n?/g, "\n")
    .trimEnd()
    .split("\n")
    .map((raw) => {
      const line = raw.replace(/\t/g, "    ");
      const cut = commentStart(line);
      const code = cut === -1 ? line : line.slice(0, cut);
      const tokens: CodeToken[] = tokenizeLabel(code);
      if (cut !== -1) tokens.push({ text: line.slice(cut), type: "comment" });
      return tokens;
    });
}

/* ---------------- flowcharts ---------------- */

export interface ExampleFlowchart {
  name: string;
  svg: string;
  width: number;
  height: number;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

const flowchartCache = new Map<string, ExampleFlowchart[]>();

/** One SVG per routine, with ids made unique so several can share a page. */
export function exampleFlowcharts(example: ExampleProgram, labelFor: (name: string) => string): ExampleFlowchart[] {
  let charts = flowchartCache.get(example.id);
  if (!charts) {
    const parsed = new Parser(example.source, { settings: normalizeEngineSettings(example.settings) }).parse();
    if (!parsed.program) return [];
    charts = layoutFlowDiagramSync(buildFlowDiagram(parsed.program)).routines.map((routine, index) => {
      const { svg, width, height } = exportRoutineToSvg(routine);
      const prefix = `${example.id}-r${index}-`;
      return {
        name: routine.label,
        width,
        height,
        svg: svg
          .replace(/id="(arrow-[a-z]+|diagram-grid)"/g, `id="${prefix}$1"`)
          .replace(/url\(#(arrow-[a-z]+|diagram-grid)\)/g, `url(#${prefix}$1)`),
      };
    });
    flowchartCache.set(example.id, charts);
  }
  return charts.map((chart) => ({
    ...chart,
    svg: chart.svg
      .replace(/<svg /, `<svg role="img" aria-label="${escapeAttribute(labelFor(chart.name))}" `),
  }));
}

/* ---------------- sample run ---------------- */

export interface TranscriptLine {
  kind: "out" | "in" | "err";
  text: string;
}

export interface SampleRun {
  lines: TranscriptLine[];
  truncated: boolean;
}

/** Deterministic random numbers (mulberry32), seeded per example so builds repeat. */
function seededRandom(seedText: string) {
  let state = 0;
  for (const ch of seedText) state = (Math.imul(state, 31) + ch.charCodeAt(0)) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MAX_TRANSCRIPT_LINES = 120;
const runCache = new Map<string, Promise<SampleRun>>();

/** Runs the example with its sample answers and returns the console transcript. */
export function runExample(example: ExampleProgram): Promise<SampleRun> {
  let run = runCache.get(example.id);
  if (!run) {
    run = runExampleUncached(example);
    runCache.set(example.id, run);
  }
  return run;
}

/** Same as runExample, without the per-build cache. */
export async function runExampleUncached(example: ExampleProgram): Promise<SampleRun> {
  const queue = example.input?.split("\n") ?? [];
  const lines: TranscriptLine[] = [];
  let pending = "";
  const flush = () => {
    if (pending) lines.push({ kind: "out", text: pending });
    pending = "";
  };
  const runtime: Runtime = {
    write(value, newline = true) {
      pending += value;
      if (newline) {
        lines.push({ kind: "out", text: pending });
        pending = "";
      }
    },
    read() {
      flush();
      const value = queue.shift() ?? "";
      lines.push({ kind: "in", text: value });
      return value;
    },
    // A transcript keeps the whole story, so clearing the screen is a no-op.
    clear() {},
    async sleep() {},
    async waitForKey() {},
  };
  const interpreter = new Interpreter({
    settings: normalizeEngineSettings(example.settings),
    limits: { maxSteps: 2_000_000, yieldEvery: 50_000, maxOutputLines: 400 },
    random: seededRandom(example.id),
  });
  const result = await interpreter.run(example.source, runtime);
  flush();
  const error = result.diagnostics.find((d) => d.severity === "error");
  if (error) lines.push({ kind: "err", text: error.message });
  return {
    lines: lines.slice(0, MAX_TRANSCRIPT_LINES),
    truncated: lines.length > MAX_TRANSCRIPT_LINES,
  };
}
