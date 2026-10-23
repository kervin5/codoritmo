// STUB — replaced by the concept pages (/es/ejemplos/concepto/<slug>, /en/examples/concept/<slug>).
// Contract used by app/[lang]/[section]/[slug]/[topic] and app/sitemap.ts: keep these names and signatures.
import type { Metadata } from "next";

import type { Locale } from "@/src/i18n/config";
import type { SitemapEntry } from "@/src/seo/sitemap-entry";

/** The [slug] segment under the examples section that holds concept pages. */
export const conceptSegment: Record<Locale, string> = { es: "concepto", en: "concept" };

export function conceptSlugs(_locale: Locale): string[] {
  return [];
}
export function hasConcept(_locale: Locale, _slug: string): boolean {
  return false;
}
export async function conceptMetadata(_locale: Locale, _slug: string): Promise<Metadata> {
  return {};
}
export async function ConceptPage({ slug }: { locale: Locale; slug: string }) {
  return <main>{slug}</main>;
}
export function conceptSitemapEntries(): SitemapEntry[] {
  return [];
}
