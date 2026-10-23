import { notFound } from 'next/navigation';

import { renderUrlset, SITEMAP_IDS, sitemapEntries, type SitemapId } from '@/src/seo/sitemaps';

// /sitemaps/<group>.xml: one sitemap per group of pages (see src/seo/sitemaps.ts).
export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return SITEMAP_IDS.map((id) => ({ file: `${id}.xml` }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const id = file.replace(/\.xml$/, '') as SitemapId;
  if (!SITEMAP_IDS.includes(id)) notFound();
  return new Response(renderUrlset(sitemapEntries(id)), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
