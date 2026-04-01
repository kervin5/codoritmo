import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import Playground from '@/src/components/ide/playground';
import { hasLocale } from '@/src/i18n/config';
import { getDictionary } from '@/src/i18n/server';
import { localeAlternates, openGraphLocale, localizedSiteUrl } from '@/src/seo/site';
import { createHomeStructuredData } from '@/src/seo/structured-data';

interface HomePageProps {
  params: Promise<{
    lang: string;
  }>;
}

export async function generateMetadata({
  params,
}: HomePageProps): Promise<Metadata> {
  const { lang } = await params;

  if (!hasLocale(lang)) {
    notFound();
  }

  const dictionary = await getDictionary(lang);

  return {
    title: dictionary.metadata.home.title,
    description: dictionary.metadata.home.description,
    keywords: dictionary.metadata.home.keywords,
    alternates: {
      canonical: localizedSiteUrl(lang),
      languages: localeAlternates(),
    },
    openGraph: {
      title: `${dictionary.metadata.home.title} | ${dictionary.metadata.siteName}`,
      description: dictionary.metadata.home.description,
      url: localizedSiteUrl(lang),
      locale: openGraphLocale(lang),
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${dictionary.metadata.home.title} | ${dictionary.metadata.siteName}`,
      description: dictionary.metadata.home.description,
    },
  };
}

export default async function Home({
  params,
}: HomePageProps) {
  const { lang } = await params;

  if (!hasLocale(lang)) {
    notFound();
  }

  const dictionary = await getDictionary(lang);
  const structuredData = createHomeStructuredData(lang, dictionary);

  return (
    <main className="min-h-screen overflow-x-hidden">
      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
        type="application/ld+json"
      />
      <Playground dictionary={dictionary} key={lang} locale={lang} />
    </main>
  );
}
