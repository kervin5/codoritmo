// Every public, statically generated area of the site and its localized URL
// segment. Pages live under /[lang]/[section]: the segment alone says which
// area it is (/es/perfiles is the profiles index, /es/pseint-online a feature
// page), so one dynamic route serves them all and each area renders its own.

import { hasLocale, locales, type Locale } from "@/src/i18n/config";

export type SectionKind = "examples" | "profiles" | "reference";

/** Sections with an index page and child pages: /[lang]/[segment]/[slug]. */
export const SECTION_SEGMENTS: Record<SectionKind, Record<Locale, string>> = {
  examples: { es: "ejemplos", en: "examples" },
  profiles: { es: "perfiles", en: "profiles" },
  reference: { es: "referencia", en: "reference" },
};

/** Single landing pages for what the app does, each at /[lang]/[slug]. */
export const FEATURE_SLUGS = {
  "pseint-online": { es: "pseint-online", en: "pseint-online" },
  alternative: { es: "alternativa-a-pseint", en: "pseint-alternative" },
  flowchart: { es: "diagrama-de-flujo-online", en: "online-flowchart-maker" },
  "desk-check": { es: "prueba-de-escritorio-online", en: "online-trace-table" },
  "to-python": { es: "pseudocodigo-a-python", en: "pseudocode-to-python" },
  "to-c": { es: "pseudocodigo-a-c", en: "pseudocode-to-c" },
  "to-java": { es: "pseudocodigo-a-java", en: "pseudocode-to-java" },
  blocks: { es: "programar-con-bloques", en: "block-based-programming" },
} as const satisfies Record<string, Record<Locale, string>>;

export type FeatureId = keyof typeof FEATURE_SLUGS;
export const featureIds = Object.keys(FEATURE_SLUGS) as FeatureId[];

export type ResolvedSection =
  | { locale: Locale; kind: SectionKind }
  | { locale: Locale; kind: "feature"; feature: FeatureId };

/** What /[lang]/[segment] is, or null when nothing lives there (so the route 404s). */
export function resolveSection(lang: string, segment: string): ResolvedSection | null {
  if (!hasLocale(lang)) return null;
  for (const kind of Object.keys(SECTION_SEGMENTS) as SectionKind[]) {
    if (SECTION_SEGMENTS[kind][lang] === segment) return { locale: lang, kind };
  }
  const feature = featureIds.find((id) => FEATURE_SLUGS[id][lang] === segment);
  return feature ? { locale: lang, kind: "feature", feature } : null;
}

/** Every /[lang]/[segment] that exists in a locale. */
export function allSectionParams(lang: string): { section: string }[] {
  if (!hasLocale(lang)) return [];
  return [
    ...(Object.keys(SECTION_SEGMENTS) as SectionKind[]).map((kind) => ({ section: SECTION_SEGMENTS[kind][lang] })),
    ...featureIds.map((id) => ({ section: FEATURE_SLUGS[id][lang] })),
  ];
}

export const sectionPath = (locale: Locale, kind: SectionKind) => `/${locale}/${SECTION_SEGMENTS[kind][locale]}`;
export const featurePath = (locale: Locale, id: FeatureId) => `/${locale}/${FEATURE_SLUGS[id][locale]}`;

/** Both locales' URL for the same page, for hreflang and the sitemap. */
export function localizedPaths(pathFor: (locale: Locale) => string): Record<Locale, string> {
  return Object.fromEntries(locales.map((locale) => [locale, pathFor(locale)])) as Record<Locale, string>;
}
