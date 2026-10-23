import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  absoluteUrl,
  examplesInTopic,
  indexPathFor,
  pageAlternates,
  sectionLocale,
} from '@/src/components/examples-site/content';
import ExamplesShell from '@/src/components/examples-site/examples-shell';
import { ExampleCard, JsonLd } from '@/src/components/examples-site/parts';
import { exampleTopics } from '@/src/engine';
import { getDictionary } from '@/src/i18n/server';
import { formatPlural } from '@/src/i18n/format';
import { examplesIndexPath, topicPath } from '@/src/lib/example-urls';
import { openGraphLocale } from '@/src/seo/site';
import { createExampleCollectionStructuredData } from '@/src/seo/structured-data';

export interface ExamplesIndexProps {
  params: Promise<{ lang: string; section: string }>;
}

export async function examplesIndexMetadata({ params }: ExamplesIndexProps): Promise<Metadata> {
  const { lang, section } = await params;
  const locale = sectionLocale(lang, section);
  if (!locale) notFound();

  const dictionary = await getDictionary(locale);
  const text = dictionary.examplePages;
  const alternates = pageAlternates(locale, indexPathFor);

  return {
    title: text.indexTitle,
    description: text.indexDescription,
    keywords: text.indexKeywords,
    alternates,
    openGraph: {
      title: `${text.indexTitle} | ${dictionary.metadata.siteName}`,
      description: text.indexDescription,
      url: alternates.canonical,
      locale: openGraphLocale(locale),
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${text.indexTitle} | ${dictionary.metadata.siteName}`,
      description: text.indexDescription,
    },
  };
}

export async function ExamplesIndexPage({ params }: ExamplesIndexProps) {
  const { lang, section } = await params;
  const locale = sectionLocale(lang, section);
  if (!locale) notFound();

  const dictionary = await getDictionary(locale);
  const text = dictionary.examplePages;
  const topicNames = dictionary.studio.examples.topics;
  const url = absoluteUrl(examplesIndexPath(locale));

  const structuredData = createExampleCollectionStructuredData({
    locale,
    siteName: dictionary.metadata.siteName,
    name: text.indexTitle,
    description: text.indexDescription,
    url,
    items: exampleTopics.map((topic) => ({
      name: topicNames[topic],
      url: absoluteUrl(topicPath(locale, topic)),
      description: text.topicIntros[topic],
    })),
    breadcrumbs: [{ name: dictionary.appShell.examples, url }],
  });

  return (
    <main className="min-h-[100dvh] bg-[#141719]">
      <JsonLd data={structuredData} />
      <ExamplesShell alternateHref={examplesIndexPath(locale === 'es' ? 'en' : 'es')} dictionary={dictionary} isIndex locale={locale}>
        <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-12">
          <header className="space-y-6 border-b border-[var(--line)] pb-10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">{text.eyebrow}</p>
            <h1 className="max-w-[20ch] text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{text.heading}</h1>
            <p className="max-w-[62ch] text-base leading-8 text-white/80 sm:text-lg">{text.intro}</p>
            <div className="grid gap-4 pt-2 sm:grid-cols-2">
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
                <h2 className="text-sm font-semibold text-[var(--accent-strong)]">{text.forStudentsTitle}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{text.forStudentsBody}</p>
              </section>
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
                <h2 className="text-sm font-semibold text-[var(--accent-strong)]">{text.forTeachersTitle}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{text.forTeachersBody}</p>
              </section>
            </div>
            <nav aria-label={dictionary.studio.examples.title}>
              <ul className="flex flex-wrap gap-2">
                {exampleTopics.map((topic) => (
                  <li key={topic}>
                    <a
                      className="inline-flex rounded-full border border-white/[0.1] px-3 py-1 text-sm text-white/75 transition hover:border-[var(--accent-soft)] hover:text-white"
                      href={`#${topic}`}
                    >
                      {topicNames[topic]}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </header>

          {exampleTopics.map((topic) => {
            const examples = examplesInTopic(topic);
            return (
              <section aria-labelledby={`${topic}-title`} className="scroll-mt-16" id={topic} key={topic}>
                <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-semibold tracking-[-0.02em]" id={`${topic}-title`}>
                      <Link className="hover:text-[var(--accent-strong)]" href={topicPath(locale, topic)}>
                        {topicNames[topic]}
                      </Link>
                    </h2>
                    <p className="max-w-[65ch] text-sm leading-6 text-[var(--muted)]">{text.topicIntros[topic]}</p>
                  </div>
                  <Link
                    className="shrink-0 text-sm text-[var(--accent-strong)] hover:underline"
                    href={topicPath(locale, topic)}
                  >
                    {text.viewTopic} ({formatPlural(text.exampleCount, examples.length)}) →
                  </Link>
                </div>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {examples.map((example) => (
                    <ExampleCard dictionary={dictionary} example={example} key={example.id} locale={locale} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </ExamplesShell>
    </main>
  );
}
