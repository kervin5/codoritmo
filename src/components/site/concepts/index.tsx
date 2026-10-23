// Concept pages of the example library: /es/ejemplos/concepto/<slug>,
// /en/examples/concept/<slug>. Each explains one concept for a beginner, shows a
// short runnable program and lists every example that uses it.

import { Play } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { absoluteUrl, highlightSource, pageAlternates } from '@/src/components/examples-site/content';
import ExamplesShell from '@/src/components/examples-site/examples-shell';
import { Breadcrumbs, Chip, CodeBlock, ExampleCard, JsonLd, SectionHeading, Transcript } from '@/src/components/examples-site/parts';
import { referenceCopy, referencePath, referenceSettings } from '@/src/components/site/reference/catalog';
import { runProgram } from '@/src/components/site/reference/run';
import { locales, type Locale } from '@/src/i18n/config';
import { formatMessage, formatPlural } from '@/src/i18n/format';
import { getDictionary } from '@/src/i18n/server';
import { examplePath, examplesIndexPath } from '@/src/lib/example-urls';
import { workspaceProgramHref } from '@/src/lib/workspace-deeplink';
import { officialPseintUrl, openGraphLocale } from '@/src/seo/site';
import type { SitemapEntry } from '@/src/seo/sitemap-entry';
import { createExampleCollectionStructuredData } from '@/src/seo/structured-data';

import { CONCEPT_REFERENCES, conceptFromSlug, conceptPath, concepts, conceptsCopy, examplesWithConcept } from './data';

export { conceptSegment, conceptPath } from './data';

const other = (locale: Locale): Locale => (locale === 'es' ? 'en' : 'es');

export function conceptSlugs(locale: Locale): string[] {
  return concepts.map((concept) => conceptsCopy[locale].concepts[concept].slug);
}

export function hasConcept(locale: Locale, slug: string): boolean {
  return conceptFromSlug(locale, slug) !== null;
}

export async function conceptMetadata(locale: Locale, slug: string): Promise<Metadata> {
  const concept = conceptFromSlug(locale, slug);
  if (!concept) return {};
  const dictionary = await getDictionary(locale);
  const copy = conceptsCopy[locale].concepts[concept];
  const alternates = pageAlternates(locale, (target) => conceptPath(target, concept));
  const fullTitle = `${copy.title} | ${dictionary.metadata.siteName}`;
  return {
    title: copy.title,
    description: copy.description,
    keywords: [dictionary.studio.examples.concepts[concept], 'PSeInt', locale === 'es' ? 'ejercicios resueltos' : 'solved exercises'],
    alternates,
    openGraph: { title: fullTitle, description: copy.description, url: alternates.canonical, locale: openGraphLocale(locale), type: 'website' },
    twitter: { card: 'summary_large_image', title: fullTitle, description: copy.description },
  };
}

export async function ConceptPage({ locale, slug }: { locale: Locale; slug: string }) {
  const concept = conceptFromSlug(locale, slug);
  if (!concept) return null;
  const dictionary = await getDictionary(locale);
  const site = conceptsCopy[locale];
  const copy = site.concepts[concept];
  const name = dictionary.studio.examples.concepts[concept];
  const examples = examplesWithConcept(concept);
  const references = CONCEPT_REFERENCES[concept].filter((id) => id in referenceCopy[locale].entries);
  const run = await runProgram(copy.snippet, { input: copy.input, seed: `concept-${concept}`, settings: referenceSettings });
  const url = absoluteUrl(conceptPath(locale, concept));
  const workspaceHref = workspaceProgramHref(locale, { name, source: copy.snippet });

  const structuredData = createExampleCollectionStructuredData({
    locale,
    siteName: dictionary.metadata.siteName,
    name: copy.h1,
    description: copy.description,
    url,
    items: examples.map((example) => ({
      name: dictionary.examples[example.id]?.label ?? example.label,
      url: absoluteUrl(examplePath(locale, example.id)),
      description: dictionary.examples[example.id]?.description,
    })),
    breadcrumbs: [
      { name: dictionary.appShell.examples, url: absoluteUrl(examplesIndexPath(locale)) },
      { name, url },
    ],
  });

  return (
    <main className="min-h-[100dvh] bg-[#141719]">
      <JsonLd data={structuredData} />
      <ExamplesShell alternateHref={conceptPath(other(locale), concept)} dictionary={dictionary} locale={locale} section="examples">
        <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-12">
          <header className="space-y-5 border-b border-[var(--line)] pb-8">
            <Breadcrumbs
              items={[{ name: dictionary.appShell.examples, href: examplesIndexPath(locale) }, { name }]}
              label={dictionary.examplePages.breadcrumbLabel}
            />
            <h1 className="max-w-[24ch] text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{copy.h1}</h1>
            <p className="text-sm text-[var(--muted)]">{formatPlural(dictionary.examplePages.exampleCount, examples.length)}</p>
          </header>

          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section aria-labelledby="explanation" className="space-y-4">
              <h2 className="text-xl font-semibold tracking-[-0.02em]" id="explanation">
                {site.page.explanation}
              </h2>
              {copy.paragraphs.map((paragraph) => (
                <p className="max-w-[62ch] text-base leading-7 text-white/85" key={paragraph}>
                  {paragraph}
                </p>
              ))}
            </section>
            <section aria-labelledby="snippet" className="space-y-4">
              <SectionHeading id="snippet" intro={site.page.snippetIntro}>
                {site.page.snippet}
              </SectionHeading>
              <CodeBlock dictionary={dictionary} lines={highlightSource(copy.snippet)} source={copy.snippet} title={`${copy.slug}.psc`} />
              {run.lines.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-[var(--muted)]">{site.page.output}</p>
                  <Transcript dictionary={dictionary} run={run} />
                </div>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Link
                  aria-label={formatMessage(site.page.openLabel, { concept: name })}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#7FE0B8] px-5 py-2.5 text-sm font-semibold text-[#0E1214] transition hover:bg-[#9BEBC9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7FE0B8]"
                  href={workspaceHref}
                >
                  <Play aria-hidden="true" fill="currentColor" size={14} />
                  {site.page.open}
                </Link>
                <p className="text-xs text-[var(--muted)] sm:ml-2">{site.page.openHint}</p>
              </div>
            </section>
          </div>

          <section aria-labelledby="examples">
            <SectionHeading id="examples" intro={site.page.examplesIntro}>
              {site.page.examples}
            </SectionHeading>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {examples.map((example) => (
                <ExampleCard dictionary={dictionary} example={example} key={example.id} locale={locale} />
              ))}
            </ul>
          </section>

          {references.length > 0 ? (
            <section aria-labelledby="reference">
              <SectionHeading id="reference" intro={site.page.referenceIntro}>
                {site.page.reference}
              </SectionHeading>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {references.map((id) => {
                  const entry = referenceCopy[locale].entries[id];
                  return (
                    <li key={id}>
                      <Link
                        className="flex h-full flex-col gap-0.5 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 transition hover:border-[var(--accent-soft)]"
                        href={referencePath(locale, id)}
                      >
                        <span className="font-medium">{entry.name}</span>
                        <span className="text-sm leading-6 text-[var(--muted)]">{entry.h1}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="other-concepts">
            <SectionHeading id="other-concepts">{site.page.otherConcepts}</SectionHeading>
            <ul className="flex flex-wrap gap-2">
              {concepts
                .filter((c) => c !== concept)
                .map((c) => (
                  <li key={c}>
                    <Chip href={conceptPath(locale, c)}>{dictionary.studio.examples.concepts[c]}</Chip>
                  </li>
                ))}
            </ul>
          </section>

          <p className="max-w-[70ch] border-t border-[var(--line)] pt-6 text-sm leading-6 text-[var(--muted)]">
            {site.page.independent}{' '}
            <a className="text-white/80 underline-offset-2 hover:underline" href={officialPseintUrl} rel="noopener noreferrer" target="_blank">
              {site.page.officialSite}
            </a>
            .
          </p>
        </div>
      </ExamplesShell>
    </main>
  );
}

export function conceptSitemapEntries(): SitemapEntry[] {
  return concepts.flatMap((concept) => {
    const languages: Record<string, string> = {};
    for (const locale of locales) languages[locale] = absoluteUrl(conceptPath(locale, concept));
    languages['x-default'] = absoluteUrl(conceptPath('es', concept));
    return locales.map((locale) => ({
      url: absoluteUrl(conceptPath(locale, concept)),
      alternates: { languages },
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }));
  });
}
