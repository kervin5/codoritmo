import type { Locale } from '@/src/i18n/config';
import type { Dictionary } from '@/src/i18n/types';

import { localizedSiteUrl, officialPseintUrl } from './site';

function languageName(locale: Locale): string {
  return locale === 'es' ? 'Spanish' : 'English';
}

export function createHomeStructuredData(locale: Locale, dictionary: Dictionary) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: dictionary.metadata.siteName,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Any',
    inLanguage: languageName(locale),
    isAccessibleForFree: true,
    url: localizedSiteUrl(locale),
    description: dictionary.metadata.home.description,
    keywords: dictionary.metadata.home.keywords.join(', '),
    isBasedOn: {
      '@type': 'SoftwareApplication',
      name: 'PSeInt',
      url: officialPseintUrl,
    },
  };
}

export function createAboutStructuredData(locale: Locale, dictionary: Dictionary) {
  return {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: `${dictionary.aboutPage.eyebrow} | ${dictionary.metadata.siteName}`,
    url: localizedSiteUrl(locale, '/about'),
    inLanguage: languageName(locale),
    description: dictionary.metadata.about.description,
    about: {
      '@type': 'SoftwareApplication',
      name: dictionary.metadata.siteName,
      applicationCategory: 'DeveloperApplication',
    },
    mentions: {
      '@type': 'SoftwareApplication',
      name: 'PSeInt',
      url: officialPseintUrl,
    },
  };
}

/* ---------------- example library ---------------- */

export interface StructuredLink {
  name: string;
  url: string;
  description?: string;
}

/** Serializes JSON-LD for a <script> tag, escaping `<` so code like `a <- 1` or `</script>` is inert. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function createBreadcrumbList(items: StructuredLink[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/** The examples index or a topic page: a CollectionPage whose main entity lists its items. */
export function createExampleCollectionStructuredData(options: {
  locale: Locale;
  siteName: string;
  name: string;
  description: string;
  url: string;
  items: StructuredLink[];
  breadcrumbs: StructuredLink[];
}) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': options.url,
        name: options.name,
        description: options.description,
        url: options.url,
        inLanguage: options.locale,
        isAccessibleForFree: true,
        isPartOf: { '@type': 'WebSite', name: options.siteName, url: localizedSiteUrl(options.locale) },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: options.items.length,
          itemListElement: options.items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            url: item.url,
            name: item.name,
            ...(item.description ? { description: item.description } : {}),
          })),
        },
        breadcrumb: { '@id': `${options.url}#breadcrumb` },
      },
      { '@id': `${options.url}#breadcrumb`, ...createBreadcrumbList(options.breadcrumbs) },
    ],
  };
}

/** One example page: a LearningResource whose part is the program itself (SoftwareSourceCode). */
export function createExampleStructuredData(options: {
  locale: Locale;
  siteName: string;
  name: string;
  description: string;
  url: string;
  image: string;
  learn: string;
  educationalLevel: string;
  topic: StructuredLink;
  concepts: string[];
  source: string;
  workspaceUrl: string;
  breadcrumbs: StructuredLink[];
}) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'LearningResource',
        '@id': options.url,
        name: options.name,
        description: options.description,
        abstract: options.learn,
        url: options.url,
        image: options.image,
        inLanguage: options.locale,
        isAccessibleForFree: true,
        learningResourceType: 'Worked example',
        educationalLevel: options.educationalLevel,
        teaches: options.concepts,
        keywords: [options.topic.name, ...options.concepts].join(', '),
        about: { '@type': 'Thing', name: options.topic.name },
        isPartOf: { '@type': 'CollectionPage', name: options.topic.name, url: options.topic.url },
        provider: { '@type': 'Organization', name: options.siteName, url: localizedSiteUrl(options.locale) },
        breadcrumb: { '@id': `${options.url}#breadcrumb` },
        hasPart: {
          '@type': 'SoftwareSourceCode',
          name: options.name,
          text: options.source,
          codeSampleType: 'full solution',
          programmingLanguage: { '@type': 'ComputerLanguage', name: 'PSeInt' },
          runtimePlatform: options.siteName,
          url: options.workspaceUrl,
          isBasedOn: { '@type': 'SoftwareApplication', name: 'PSeInt', url: officialPseintUrl },
        },
      },
      { '@id': `${options.url}#breadcrumb`, ...createBreadcrumbList(options.breadcrumbs) },
    ],
  };
}
