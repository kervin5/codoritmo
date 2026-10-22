import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import {
  absoluteUrl,
  examplesInTopic,
  findTopic,
  pageAlternates,
  sectionLocale,
  topicParams,
  topicPathFor,
} from '@/src/components/examples-site/content';
import ExamplesShell from '@/src/components/examples-site/examples-shell';
import { Breadcrumbs, ExampleCard, JsonLd } from '@/src/components/examples-site/parts';
import type { Locale } from '@/src/i18n/config';
import { formatMessage, formatPlural } from '@/src/i18n/format';
import { getDictionary } from '@/src/i18n/server';
import { examplePath, examplesIndexPath, topicPath, topicSection } from '@/src/lib/example-urls';
import { openGraphLocale } from '@/src/seo/site';
import { createExampleCollectionStructuredData } from '@/src/seo/structured-data';

// /es/ejemplos/tema/<tema>, /en/examples/topic/<topic>. The [slug] segment is
// shared with the example pages, so here it must be the locale's "tema"/"topic".
interface TopicPageProps {
  params: Promise<{ lang: string; section: string; slug: string; topic: string }>;
}

export const dynamicParams = false;

export function generateStaticParams({ params }: { params: { lang: string; section: string } }) {
  if (!sectionLocale(params.lang, params.section)) return [];
  const locale = params.lang as Locale;
  return topicParams(locale).map(({ topic }) => ({ slug: topicSection[locale], topic }));
}

async function resolve(params: TopicPageProps['params']) {
  const { lang, section, slug, topic: topicSlug } = await params;
  const locale = sectionLocale(lang, section);
  const topic = locale ? findTopic(locale, slug, topicSlug) : null;
  if (!locale || !topic) notFound();
  return { locale, topic, dictionary: await getDictionary(locale) };
}

export async function generateMetadata({ params }: TopicPageProps): Promise<Metadata> {
  const { locale, topic, dictionary } = await resolve(params);
  const text = dictionary.examplePages;
  const topicName = dictionary.studio.examples.topics[topic];
  const title = formatMessage(text.topicTitle, { topic: topicName });
  const description = formatMessage(text.topicDescription, {
    topic: topicName.toLowerCase(),
    count: examplesInTopic(topic).length,
  });
  const alternates = pageAlternates(locale, topicPathFor(topic));

  return {
    title,
    description,
    alternates,
    openGraph: {
      title: `${title} | ${dictionary.metadata.siteName}`,
      description,
      url: alternates.canonical,
      locale: openGraphLocale(locale),
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | ${dictionary.metadata.siteName}`,
      description,
    },
  };
}

export default async function TopicPage({ params }: TopicPageProps) {
  const { locale, topic, dictionary } = await resolve(params);
  const text = dictionary.examplePages;
  const topicName = dictionary.studio.examples.topics[topic];
  const examples = examplesInTopic(topic);
  const url = absoluteUrl(topicPath(locale, topic));
  const description = formatMessage(text.topicDescription, { topic: topicName.toLowerCase(), count: examples.length });

  const structuredData = createExampleCollectionStructuredData({
    locale,
    siteName: dictionary.metadata.siteName,
    name: formatMessage(text.topicTitle, { topic: topicName }),
    description,
    url,
    items: examples.map((example) => ({
      name: dictionary.examples[example.id]?.label ?? example.label,
      url: absoluteUrl(examplePath(locale, example.id)),
      description: dictionary.examples[example.id]?.description,
    })),
    breadcrumbs: [
      { name: dictionary.appShell.examples, url: absoluteUrl(examplesIndexPath(locale)) },
      { name: topicName, url },
    ],
  });

  return (
    <main className="min-h-[100dvh] bg-[#141719]">
      <JsonLd data={structuredData} />
      <ExamplesShell alternateHref={topicPath(locale === 'es' ? 'en' : 'es', topic)} dictionary={dictionary} locale={locale}>
        <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-10">
          <header className="space-y-5 border-b border-[var(--line)] pb-8">
            <Breadcrumbs
              items={[{ name: dictionary.appShell.examples, href: examplesIndexPath(locale) }, { name: topicName }]}
              label={text.breadcrumbLabel}
            />
            <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{topicName}</h1>
            <p className="max-w-[62ch] text-base leading-8 text-white/80 sm:text-lg">{text.topicIntros[topic]}</p>
            <p className="text-sm text-[var(--muted)]">{formatPlural(text.exampleCount, examples.length)}</p>
          </header>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {examples.map((example) => (
              <ExampleCard dictionary={dictionary} example={example} headingLevel={2} key={example.id} locale={locale} />
            ))}
          </ul>
        </div>
      </ExamplesShell>
    </main>
  );
}
