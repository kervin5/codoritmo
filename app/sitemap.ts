import type { MetadataRoute } from 'next';

import { absoluteUrl, allExamplePagePaths } from '@/src/components/examples-site/content';
import { localizedSiteUrl } from '@/src/seo/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: localizedSiteUrl('es'),
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: localizedSiteUrl('en'),
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.95,
    },
    {
      url: localizedSiteUrl('es', '/about'),
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: localizedSiteUrl('en', '/about'),
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    // Example library: index, topic and example pages in both locales.
    ...allExamplePagePaths().map(({ kind, path, languages }) => ({
      url: absoluteUrl(path),
      alternates: { languages },
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: kind === 'index' ? 0.8 : kind === 'topic' ? 0.7 : 0.6,
    })),
  ];
}
