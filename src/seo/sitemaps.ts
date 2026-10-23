// The site's sitemaps, one per group of pages, so search consoles report on
// each group separately: app/sitemaps/[file]/route.ts serves each at
// /sitemaps/<id>.xml, app/sitemap.xml/route.ts lists them all, and robots.txt
// points at both.

import { absoluteUrl, allExamplePagePaths } from "@/src/components/examples-site/content";
import { conceptSitemapEntries } from "@/src/components/site/concepts";
import { featureSitemapEntries } from "@/src/components/site/features";
import { profileSitemapEntries } from "@/src/components/site/profiles";
import { referenceSitemapEntries } from "@/src/components/site/reference";
import { locales } from "@/src/i18n/config";
import { localeAlternates, localizedSiteUrl, siteUrl } from "@/src/seo/site";
import type { SitemapEntry } from "@/src/seo/sitemap-entry";

export const SITEMAP_IDS = ["core", "examples", "concepts", "reference", "profiles", "features"] as const;
export type SitemapId = (typeof SITEMAP_IDS)[number];

function coreEntries(): SitemapEntry[] {
  const pages: { path: string; priority: number; changeFrequency: SitemapEntry["changeFrequency"] }[] = [
    { path: "", priority: 1, changeFrequency: "weekly" },
    { path: "/about", priority: 0.8, changeFrequency: "monthly" },
  ];
  return pages.flatMap(({ path, priority, changeFrequency }) =>
    locales.map((locale) => ({
      url: localizedSiteUrl(locale, path),
      alternates: { languages: localeAlternates(path) },
      changeFrequency,
      priority,
    })),
  );
}

function exampleEntries(): SitemapEntry[] {
  return allExamplePagePaths().map(({ kind, path, languages }) => ({
    url: absoluteUrl(path),
    alternates: { languages },
    changeFrequency: "monthly",
    priority: kind === "index" ? 0.8 : kind === "topic" ? 0.7 : 0.6,
  }));
}

export function sitemapEntries(id: SitemapId): SitemapEntry[] {
  const lastModified = new Date();
  const entries = {
    core: coreEntries,
    examples: exampleEntries,
    concepts: conceptSitemapEntries,
    reference: referenceSitemapEntries,
    profiles: profileSitemapEntries,
    features: featureSitemapEntries,
  }[id]();
  return entries.map((entry) => ({ lastModified, ...entry }));
}

export const sitemapUrl = (id: SitemapId) => `${siteUrl}/sitemaps/${id}.xml`;

const escapeXml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A <urlset> with hreflang alternates (xhtml:link), as search engines expect. */
export function renderUrlset(entries: SitemapEntry[]): string {
  const rows = entries.map((entry) => {
    const parts = [`    <loc>${escapeXml(entry.url)}</loc>`];
    for (const [lang, href] of Object.entries(entry.alternates?.languages ?? {})) {
      if (href) parts.push(`    <xhtml:link rel="alternate" hreflang="${lang}" href="${escapeXml(String(href))}" />`);
    }
    if (entry.lastModified) parts.push(`    <lastmod>${new Date(entry.lastModified).toISOString()}</lastmod>`);
    if (entry.changeFrequency) parts.push(`    <changefreq>${entry.changeFrequency}</changefreq>`);
    if (entry.priority !== undefined) parts.push(`    <priority>${entry.priority}</priority>`);
    return `  <url>\n${parts.join("\n")}\n  </url>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...rows,
    "</urlset>",
    "",
  ].join("\n");
}

/** The index of every group's sitemap. */
export function renderSitemapIndex(): string {
  const lastmod = new Date().toISOString();
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...SITEMAP_IDS.map((id) => `  <sitemap><loc>${sitemapUrl(id)}</loc><lastmod>${lastmod}</lastmod></sitemap>`),
    "</sitemapindex>",
    "",
  ].join("\n");
}
