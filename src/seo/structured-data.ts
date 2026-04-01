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
