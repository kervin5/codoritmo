// STUB — replaced by the school-profiles pages. Contract used by app/[lang]/[section]/**
// and app/sitemap.ts: keep these names and signatures.
import type { Metadata } from "next";

import type { Locale } from "@/src/i18n/config";
import type { SitemapEntry } from "@/src/seo/sitemap-entry";

/** Slugs of every profile page in a locale (/[lang]/perfiles/<slug>). */
export function profileSlugs(_locale: Locale): string[] {
  return [];
}
export function hasProfile(_locale: Locale, _slug: string): boolean {
  return false;
}
export async function profilesIndexMetadata(_locale: Locale): Promise<Metadata> {
  return {};
}
export async function ProfilesIndexPage({ locale }: { locale: Locale }) {
  return <main>{locale}</main>;
}
export async function profileMetadata(_locale: Locale, _slug: string): Promise<Metadata> {
  return {};
}
export async function ProfilePage({ slug }: { locale: Locale; slug: string }) {
  return <main>{slug}</main>;
}
/** Every profile URL (index and pages) in every locale. */
export function profileSitemapEntries(): SitemapEntry[] {
  return [];
}
