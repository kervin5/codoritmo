// STUB — replaced by the feature landing pages (/[lang]/<feature slug>, see src/seo/sections.ts).
// Contract used by app/[lang]/[section]/page.tsx and app/sitemap.ts: keep these names and signatures.
import type { Metadata } from "next";

import type { Locale } from "@/src/i18n/config";
import type { FeatureId } from "@/src/seo/sections";
import type { SitemapEntry } from "@/src/seo/sitemap-entry";

export async function featureMetadata(_locale: Locale, _id: FeatureId): Promise<Metadata> {
  return {};
}
export async function FeaturePage({ id }: { locale: Locale; id: FeatureId }) {
  return <main>{id}</main>;
}
export function featureSitemapEntries(): SitemapEntry[] {
  return [];
}
