import type { MetadataRoute } from 'next';

import { siteUrl } from '@/src/seo/site';
import { SITEMAP_IDS, sitemapUrl } from '@/src/seo/sitemaps';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    host: siteUrl,
    sitemap: [`${siteUrl}/sitemap.xml`, ...SITEMAP_IDS.map(sitemapUrl)],
  };
}
