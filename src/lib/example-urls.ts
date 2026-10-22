// Localized URLs for the example library. Slugs come from each locale's
// titles ("Ordenamiento burbuja" → ordenamiento-burbuja), so Spanish pages
// get Spanish URLs and English pages English ones. Example ids stay the
// stable internal key (and the workspace deep link uses them).

import { examplePrograms, exampleTopics } from "@/src/engine";
import type { Locale } from "@/src/i18n/config";
import { enDictionary } from "@/src/i18n/en";
import { esDictionary } from "@/src/i18n/es";
import type { Dictionary } from "@/src/i18n/types";

type Topic = (typeof exampleTopics)[number];

const dictionaries: Record<Locale, Dictionary> = { es: esDictionary, en: enDictionary };

/** URL section for the library: /es/ejemplos, /en/examples. */
export const examplesSection: Record<Locale, string> = { es: "ejemplos", en: "examples" };

/** Segment for topic pages: /es/ejemplos/tema/…, /en/examples/topic/… */
export const topicSection: Record<Locale, string> = { es: "tema", en: "topic" };

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildTable<K extends string>(keys: readonly K[], label: (locale: Locale, key: K) => string) {
  const bySlug = {} as Record<Locale, Map<string, K>>;
  const byKey = {} as Record<Locale, Map<K, string>>;
  for (const locale of Object.keys(dictionaries) as Locale[]) {
    bySlug[locale] = new Map();
    byKey[locale] = new Map();
    for (const key of keys) {
      let slug = slugify(label(locale, key)) || slugify(key);
      // Keep slugs unique even if two titles slugify the same way.
      if (bySlug[locale].has(slug)) slug = `${slug}-${slugify(key)}`;
      bySlug[locale].set(slug, key);
      byKey[locale].set(key, slug);
    }
  }
  return { bySlug, byKey };
}

const exampleIds = examplePrograms.map((e) => e.id);
const examples = buildTable(exampleIds, (locale, id) => dictionaries[locale].examples[id]?.label ?? id);
const topics = buildTable(exampleTopics, (locale, topic) => dictionaries[locale].studio.examples.topics[topic] ?? topic);

export function exampleSlug(locale: Locale, id: string): string {
  return examples.byKey[locale].get(id) ?? slugify(id);
}

export function exampleIdFromSlug(locale: Locale, slug: string): string | null {
  return examples.bySlug[locale].get(slug) ?? null;
}

export function topicSlug(locale: Locale, topic: Topic): string {
  return topics.byKey[locale].get(topic) ?? topic;
}

export function topicFromSlug(locale: Locale, slug: string): Topic | null {
  return topics.bySlug[locale].get(slug) ?? null;
}

/** /es/ejemplos */
export function examplesIndexPath(locale: Locale): string {
  return `/${locale}/${examplesSection[locale]}`;
}

/** /es/ejemplos/tema/ordenamiento-y-busqueda */
export function topicPath(locale: Locale, topic: Topic): string {
  return `${examplesIndexPath(locale)}/${topicSection[locale]}/${topicSlug(locale, topic)}`;
}

/** /es/ejemplos/ordenamiento-burbuja */
export function examplePath(locale: Locale, id: string): string {
  return `${examplesIndexPath(locale)}/${exampleSlug(locale, id)}`;
}

/* ---------- workspace deep link: /es?ejemplo=bubble-sort ---------- */

const EXAMPLE_PARAM = "ejemplo";

export function workspaceExampleHref(locale: Locale, id: string): string {
  return `/${locale}?${EXAMPLE_PARAM}=${encodeURIComponent(id)}`;
}

/** The example id requested by `?ejemplo=`, if it exists. */
export function workspaceExampleFromSearch(search: string): string | null {
  const id = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get(EXAMPLE_PARAM);
  return id && exampleIds.includes(id) ? id : null;
}
