import type { MetadataRoute } from 'next';

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
  ];
}
