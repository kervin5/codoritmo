import { renderSitemapIndex } from '@/src/seo/sitemaps';

// The sitemap index: one sitemap per group of pages (see src/seo/sitemaps.ts).
export const dynamic = 'force-static';

export function GET() {
  return new Response(renderSitemapIndex(), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
