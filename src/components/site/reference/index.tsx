// STUB — replaced by the language reference pages. Contract used by app/[lang]/[section]/**
// and app/sitemap.ts: keep these names and signatures.
import type { Metadata } from "next";

import type { Locale } from "@/src/i18n/config";
import type { SitemapEntry } from "@/src/seo/sitemap-entry";

/** Slugs of every reference page in a locale (/[lang]/referencia/<slug>). */
export function referenceSlugs(_locale: Locale): string[] {
  return [];
}
export function hasReference(_locale: Locale, _slug: string): boolean {
  return false;
}
export async function referenceIndexMetadata(_locale: Locale): Promise<Metadata> {
  return {};
}
export async function ReferenceIndexPage({ locale }: { locale: Locale }) {
  return <main>{locale}</main>;
}
export async function referenceMetadata(_locale: Locale, _slug: string): Promise<Metadata> {
  return {};
}
export async function ReferencePage({ slug }: { locale: Locale; slug: string }) {
  return <main>{slug}</main>;
}
/** Every reference URL (index and pages) in every locale. */
export function referenceSitemapEntries(): SitemapEntry[] {
  return [];
}
