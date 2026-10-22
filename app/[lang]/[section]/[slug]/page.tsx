import { ArrowLeft, ArrowRight, Play } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  absoluteUrl,
  exampleFlowcharts,
  exampleParams,
  examplePathFor,
  findExample,
  highlightSource,
  ogImagePath,
  pageAlternates,
  relatedExamples,
  runExample,
  sectionLocale,
  topicNeighbours,
} from '@/src/components/examples-site/content';
import ExamplesShell from '@/src/components/examples-site/examples-shell';
import {
  Breadcrumbs,
  Chip,
  CodeBlock,
  ComplexityTable,
  ExampleCard,
  JsonLd,
  LevelChip,
  SectionHeading,
  Transcript,
} from '@/src/components/examples-site/parts';
import ShareButton from '@/src/components/examples-site/share-button';
import type { ExampleProgram } from '@/src/engine';
import type { Locale } from '@/src/i18n/config';
import { formatMessage } from '@/src/i18n/format';
import { getDictionary } from '@/src/i18n/server';
import type { Dictionary } from '@/src/i18n/types';
import {
  examplePath,
  examplesIndexPath,
  topicPath,
  workspaceExampleHref,
} from '@/src/lib/example-urls';
import { openGraphLocale } from '@/src/seo/site';
import { createExampleStructuredData } from '@/src/seo/structured-data';

interface ExamplePageProps {
  params: Promise<{ lang: string; section: string; slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams({ params }: { params: { lang: string; section: string } }) {
  return sectionLocale(params.lang, params.section) ? exampleParams(params.lang) : [];
}

async function resolve(params: ExamplePageProps['params']) {
  const { lang, section, slug } = await params;
  const locale = sectionLocale(lang, section);
  const example = locale ? findExample(locale, slug) : null;
  if (!locale || !example) notFound();
  return { locale, example, dictionary: await getDictionary(locale) };
}

function copyFor(example: ExampleProgram, dictionary: Dictionary) {
  return (
    dictionary.examples[example.id] ?? {
      label: example.label,
      description: example.description,
      learn: example.description,
      challenge: '',
      hint: '',
    }
  );
}

/** Description for search results: the one-liner plus as much of "what you'll learn" as fits. */
function metaDescription(description: string, learn: string): string {
  const full = `${description} ${learn}`;
  if (full.length <= 160) return full;
  const cut = full.slice(0, 157);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

export async function generateMetadata({ params }: ExamplePageProps): Promise<Metadata> {
  const { locale, example, dictionary } = await resolve(params);
  const copy = copyFor(example, dictionary);
  const title = formatMessage(dictionary.examplePages.exampleTitle, { title: copy.label });
  const description = metaDescription(copy.description, copy.learn);
  const alternates = pageAlternates(locale, examplePathFor(example.id));
  const image = { url: absoluteUrl(ogImagePath(locale, example.id)), width: 1200, height: 630, alt: copy.label };
  const topicName = dictionary.studio.examples.topics[example.topic];

  return {
    title,
    description,
    keywords: [copy.label, topicName, ...example.concepts.map((c) => dictionary.studio.examples.concepts[c] ?? c), 'PSeInt'],
    alternates,
    openGraph: {
      title: `${title} | ${dictionary.metadata.siteName}`,
      description,
      url: alternates.canonical,
      locale: openGraphLocale(locale),
      type: 'article',
      section: topicName,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | ${dictionary.metadata.siteName}`,
      description,
      images: [image],
    },
  };
}

export default async function ExamplePage({ params }: ExamplePageProps) {
  const { locale, example, dictionary } = await resolve(params);
  const text = dictionary.examplePages;
  const labels = dictionary.studio.examples;
  const copy = copyFor(example, dictionary);
  const topicName = labels.topics[example.topic];
  const levelName = labels.levels[String(example.level) as '1' | '2' | '3'];
  const otherLocale: Locale = locale === 'es' ? 'en' : 'es';

  const url = absoluteUrl(examplePath(locale, example.id));
  const workspaceHref = workspaceExampleHref(locale, example.id);
  const flowcharts = exampleFlowcharts(example, (name) => formatMessage(text.flowchartLabel, { name }));
  const run = await runExample(example);
  const { previous, next } = topicNeighbours(example);
  const related = relatedExamples(example);
  const conceptNames = example.concepts.map((c) => labels.concepts[c] ?? c);

  const structuredData = createExampleStructuredData({
    locale,
    siteName: dictionary.metadata.siteName,
    name: copy.label,
    description: copy.description,
    url,
    image: absoluteUrl(ogImagePath(locale, example.id)),
    learn: copy.learn,
    educationalLevel: levelName,
    topic: { name: topicName, url: absoluteUrl(topicPath(locale, example.topic)) },
    concepts: conceptNames,
    source: example.source,
    workspaceUrl: absoluteUrl(workspaceHref),
    breadcrumbs: [
      { name: dictionary.appShell.examples, url: absoluteUrl(examplesIndexPath(locale)) },
      { name: topicName, url: absoluteUrl(topicPath(locale, example.topic)) },
      { name: copy.label, url },
    ],
  });

  return (
    <main className="min-h-[100dvh] bg-[#141719]">
      <JsonLd data={structuredData} />
      <ExamplesShell alternateHref={examplePath(otherLocale, example.id)} dictionary={dictionary} locale={locale}>
        <article className="mx-auto flex w-full max-w-[920px] flex-col gap-12">
          <header className="space-y-5">
            <Breadcrumbs
              items={[
                { name: dictionary.appShell.examples, href: examplesIndexPath(locale) },
                { name: topicName, href: topicPath(locale, example.topic) },
                { name: copy.label },
              ]}
              label={text.breadcrumbLabel}
            />
            <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{copy.label}</h1>
            <p className="max-w-[62ch] text-lg leading-8 text-white/80">{copy.description}</p>
            <dl className="flex flex-wrap items-center gap-x-5 gap-y-3 text-xs">
              <div className="flex items-center gap-2">
                <dt className="sr-only">{text.level}</dt>
                <dd>
                  <LevelChip label={levelName} level={example.level} />
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="text-[var(--muted)]">{text.topic}:</dt>
                <dd>
                  <Chip href={topicPath(locale, example.topic)}>{topicName}</Chip>
                </dd>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <dt className="text-[var(--muted)]">{text.concepts}:</dt>
                {conceptNames.map((name) => (
                  <dd key={name}>
                    <Chip>{name}</Chip>
                  </dd>
                ))}
              </div>
            </dl>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
              <Link
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#7FE0B8] px-5 py-2.5 text-sm font-semibold text-[#0E1214] transition hover:bg-[#9BEBC9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7FE0B8]"
                href={workspaceHref}
              >
                <Play aria-hidden="true" fill="currentColor" size={14} />
                {text.openInCodoritmo}
              </Link>
              <ShareButton
                copiedLabel={text.linkCopied}
                failedLabel={text.copyFailed}
                label={text.share}
                text={copy.description}
                title={copy.label}
                url={url}
              />
              <p className="text-xs text-[var(--muted)] sm:ml-2">{text.openInCodoritmoHint}</p>
            </div>
          </header>

          <section aria-labelledby="learn" className="rounded-xl border border-[var(--accent-soft)] bg-[var(--accent-surface)] p-5 sm:p-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--accent-strong)]" id="learn">
              {labels.learn}
            </h2>
            <p className="mt-3 max-w-[65ch] text-base leading-7 text-white/90">{copy.learn}</p>
          </section>

          <section aria-labelledby="code">
            <SectionHeading id="code">{text.code}</SectionHeading>
            <CodeBlock dictionary={dictionary} lines={highlightSource(example.source)} source={example.source} title={`${example.id}.psc`} />
          </section>

          {flowcharts.length > 0 ? (
            <section aria-labelledby="flowchart">
              <SectionHeading id="flowchart" intro={text.flowchartIntro}>
                {text.flowchart}
              </SectionHeading>
              <div className="space-y-6">
                {flowcharts.map((chart) => (
                  <figure className="overflow-hidden rounded-xl border border-[var(--line)] bg-[#F7F4EE]" key={chart.name}>
                    {flowcharts.length > 1 ? (
                      <figcaption className="border-b border-black/10 bg-[#EFEAE1] px-4 py-2 font-mono text-xs text-[#4c4131]">
                        {chart.name}
                      </figcaption>
                    ) : null}
                    <div
                      className="flex max-h-[900px] justify-center overflow-auto [&>svg]:h-auto [&>svg]:max-w-full"
                      dangerouslySetInnerHTML={{ __html: chart.svg }}
                    />
                  </figure>
                ))}
              </div>
            </section>
          ) : null}

          <section aria-labelledby="sample-run">
            <SectionHeading id="sample-run" intro={example.input ? text.sampleRunIntro : text.sampleRunNoInput}>
              {text.sampleRun}
            </SectionHeading>
            <Transcript dictionary={dictionary} run={run} />
          </section>

          {example.complexity ? (
            <section aria-labelledby="complexity">
              <SectionHeading id="complexity" intro={text.complexityIntro}>
                {labels.complexity.label}
              </SectionHeading>
              <ComplexityTable complexity={example.complexity} dictionary={dictionary} />
            </section>
          ) : null}

          {copy.challenge ? (
            <section aria-labelledby="challenge" className="rounded-xl border border-[#E8BE8C]/25 bg-[#E8BE8C]/[0.06] p-5 sm:p-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#F0CFA6]" id="challenge">
                {text.challenge}
              </h2>
              <p className="mt-3 max-w-[65ch] text-base leading-7 text-white/90">{copy.challenge}</p>
              {copy.hint ? (
                <details className="group mt-4">
                  <summary className="cursor-pointer select-none text-sm font-medium text-[#F0CFA6] hover:underline">
                    {text.showHint}
                  </summary>
                  <p className="mt-2 max-w-[65ch] text-sm leading-6 text-white/75">{copy.hint}</p>
                </details>
              ) : null}
              <Link className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent-strong)] hover:underline" href={workspaceHref}>
                <Play aria-hidden="true" fill="currentColor" size={12} />
                {text.openInCodoritmo}
              </Link>
            </section>
          ) : null}

          {previous || next ? (
            <nav aria-label={text.exampleNavigation} className="grid gap-3 sm:grid-cols-2">
              {previous ? (
                <Link
                  className="flex flex-col gap-1 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 transition hover:border-[var(--accent-soft)]"
                  href={examplePath(locale, previous.id)}
                  rel="prev"
                >
                  <span className="flex items-center gap-1 text-xs text-[var(--muted)]">
                    <ArrowLeft aria-hidden="true" size={12} /> {text.previous}
                  </span>
                  <span className="font-medium">{copyFor(previous, dictionary).label}</span>
                </Link>
              ) : (
                <span aria-hidden="true" className="hidden sm:block" />
              )}
              {next ? (
                <Link
                  className="flex flex-col gap-1 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 text-right transition hover:border-[var(--accent-soft)]"
                  href={examplePath(locale, next.id)}
                  rel="next"
                >
                  <span className="flex items-center justify-end gap-1 text-xs text-[var(--muted)]">
                    {text.next} <ArrowRight aria-hidden="true" size={12} />
                  </span>
                  <span className="font-medium">{copyFor(next, dictionary).label}</span>
                </Link>
              ) : null}
            </nav>
          ) : null}

          {related.length > 0 ? (
            <section aria-labelledby="related">
              <SectionHeading id="related">{text.related}</SectionHeading>
              <ul className="grid gap-3 sm:grid-cols-3">
                {related.map((item) => (
                  <ExampleCard dictionary={dictionary} example={item} key={item.id} locale={locale} />
                ))}
              </ul>
            </section>
          ) : null}
        </article>
      </ExamplesShell>
    </main>
  );
}
