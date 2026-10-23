// The public language reference: /es/referencia (index) and /es/referencia/<slug>
// (and /en/reference/...). One page per instruction, operator or function, built
// from the same catalog and beginner guide as the workspace's reference panel.

import { ArrowLeft, ArrowRight, Play } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { absoluteUrl, highlightSource, pageAlternates, type SampleRun } from '@/src/components/examples-site/content';
import ExamplesShell from '@/src/components/examples-site/examples-shell';
import { Breadcrumbs, Chip, CodeBlock, ExampleCard, JsonLd, SectionHeading, Transcript } from '@/src/components/examples-site/parts';
import { conceptPath } from '@/src/components/site/concepts/data';
import { shapeSceneSvg, type ShapeSpec } from '@/src/components/workspace/reference-shape';
import { locales, type Locale } from '@/src/i18n/config';
import { formatMessage } from '@/src/i18n/format';
import { getDictionary } from '@/src/i18n/server';
import type { ReferenceSiteCopy } from '@/src/i18n/site/reference-types';
import type { Dictionary } from '@/src/i18n/types';
import { workspaceProgramHref } from '@/src/lib/workspace-deeplink';
import { featurePath, sectionPath } from '@/src/seo/sections';
import { officialPseintUrl, openGraphLocale } from '@/src/seo/site';
import type { SitemapEntry } from '@/src/seo/sitemap-entry';
import { createBreadcrumbList } from '@/src/seo/structured-data';

import {
  examplesUsing,
  findReferenceEntry,
  referenceCatalog,
  referenceCopy,
  referenceIdFromSlug,
  referenceIds,
  referenceIndexPath,
  referencePath,
  referenceSettings,
  type ReferenceEntry,
  type WorkedExample,
} from './catalog';
import { runProgram } from './run';

export { referencePath, referenceIndexPath } from './catalog';

const other = (locale: Locale): Locale => (locale === 'es' ? 'en' : 'es');

/** Slugs of every reference page in a locale (/[lang]/referencia/<slug>). */
export function referenceSlugs(locale: Locale): string[] {
  return referenceIds.map((id) => referenceCopy[locale].entries[id].slug);
}

export function hasReference(locale: Locale, slug: string): boolean {
  return referenceIdFromSlug(locale, slug) !== null;
}

function pageMetadata(options: {
  locale: Locale;
  dictionary: Dictionary;
  title: string;
  description: string;
  pathFor: (locale: Locale) => string;
  type: 'website' | 'article';
}): Metadata {
  const { locale, dictionary, title, description, pathFor, type } = options;
  const alternates = pageAlternates(locale, pathFor);
  const fullTitle = `${title} | ${dictionary.metadata.siteName}`;
  return {
    title,
    description,
    alternates,
    openGraph: { title: fullTitle, description, url: alternates.canonical, locale: openGraphLocale(locale), type },
    twitter: { card: 'summary_large_image', title: fullTitle, description },
  };
}

/* ---------------- index ---------------- */

export async function referenceIndexMetadata(locale: Locale): Promise<Metadata> {
  const dictionary = await getDictionary(locale);
  const copy = referenceCopy[locale].index;
  return pageMetadata({
    locale,
    dictionary,
    title: copy.title,
    description: copy.description,
    pathFor: referenceIndexPath,
    type: 'website',
  });
}

export async function ReferenceIndexPage({ locale }: { locale: Locale }) {
  const dictionary = await getDictionary(locale);
  const site = referenceCopy[locale];
  const groups = referenceCatalog(locale, dictionary);
  const url = absoluteUrl(referenceIndexPath(locale));

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'DefinedTermSet',
        '@id': url,
        name: site.index.h1,
        description: site.index.description,
        url,
        inLanguage: locale,
        isPartOf: { '@type': 'WebSite', name: dictionary.metadata.siteName, url: absoluteUrl(`/${locale}`) },
        hasDefinedTerm: groups.flatMap((group) =>
          group.entries.map((entry) => ({
            '@type': 'DefinedTerm',
            name: entry.label,
            description: entry.summary,
            url: absoluteUrl(referencePath(locale, entry.id)),
          })),
        ),
        breadcrumb: { '@id': `${url}#breadcrumb` },
      },
      {
        '@id': `${url}#breadcrumb`,
        ...createBreadcrumbList([
          { name: dictionary.metadata.siteName, url: absoluteUrl(`/${locale}`) },
          { name: site.section, url },
        ]),
      },
    ],
  };

  return (
    <main className="min-h-[100dvh] bg-[#141719]">
      <JsonLd data={structuredData} />
      <ExamplesShell alternateHref={referenceIndexPath(other(locale))} dictionary={dictionary} isIndex locale={locale} section="reference">
        <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-12">
          <header className="space-y-5 border-b border-[var(--line)] pb-8">
            <Breadcrumbs
              items={[{ name: dictionary.metadata.siteName, href: `/${locale}` }, { name: site.section }]}
              label={dictionary.examplePages.breadcrumbLabel}
            />
            <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{site.index.h1}</h1>
            {site.index.intro.map((paragraph) => (
              <p className="max-w-[65ch] text-base leading-8 text-white/80 sm:text-lg" key={paragraph}>
                {paragraph}
              </p>
            ))}
            <nav aria-label={site.index.contents} className="flex flex-wrap gap-2 pt-1">
              {groups.map((group) => (
                <Chip href={`#${group.id}`} key={group.id}>
                  {group.title}
                </Chip>
              ))}
            </nav>
          </header>

          {groups.map((group) => (
            <section aria-labelledby={group.id} className="scroll-mt-16" key={group.id}>
              <SectionHeading id={group.id} intro={site.index.groupIntros[group.id]}>
                {group.title}
              </SectionHeading>
              <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                {group.entries.map((entry) => (
                  <li key={entry.id}>
                    <Link
                      className="group flex flex-col gap-0.5 rounded-lg px-3 py-2.5 transition hover:bg-white/[0.03]"
                      href={referencePath(locale, entry.id)}
                    >
                      <span className="font-medium text-white group-hover:text-[var(--accent)]">{entry.copy.name}</span>
                      <span className="text-sm leading-6 text-[var(--muted)]">{entry.summary}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <Independent locale={locale} site={site} />
        </div>
      </ExamplesShell>
    </main>
  );
}

/* ---------------- entry pages ---------------- */

export async function referenceMetadata(locale: Locale, slug: string): Promise<Metadata> {
  const dictionary = await getDictionary(locale);
  const id = referenceIdFromSlug(locale, slug);
  if (!id) return {};
  const copy = referenceCopy[locale].entries[id];
  return {
    ...pageMetadata({
      locale,
      dictionary,
      title: copy.title,
      description: copy.description,
      pathFor: (target) => referencePath(target, id),
      type: 'article',
    }),
    keywords: [copy.name, `${copy.name} PSeInt`, 'PSeInt', locale === 'es' ? 'pseudocódigo' : 'pseudocode'],
  };
}

const escapeAttribute = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Describes the flowchart scene in words, for screen readers and as the figure's alt text. */
export function shapeAltText(shape: ShapeSpec, site: ReferenceSiteCopy): string {
  const scene = shape.scene === 'repeat' ? (shape.exitsOn === 'no' ? 'repeat-while' : 'repeat-until') : shape.scene;
  const shapeName = site.shapes[shape.kind as keyof ReferenceSiteCopy['shapes']] ?? shape.kind;
  const text = formatMessage(site.scenes[scene], { shape: shapeName, label: shape.label });
  return shape.context ? `${site.sceneContext[shape.context]} ${text}` : text;
}

function ShapeFigure({ shape, site, dictionary }: { shape: ShapeSpec; site: ReferenceSiteCopy; dictionary: Dictionary }) {
  const alt = shapeAltText(shape, site);
  const svg = shapeSceneSvg(shape).replace(/^<svg /, `<svg role="img" aria-label="${escapeAttribute(alt)}" `);
  const t = dictionary.studio.reference;
  const caption = shape.context === 'condition' ? t.insideCondition : shape.context === 'process' ? t.insideProcess : t.inFlowchart;
  return (
    <figure className="overflow-hidden rounded-xl border border-[var(--line)] bg-[#161A1C]">
      <div
        className="flex justify-center overflow-x-auto bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_0)] bg-[length:16px_16px] px-4 py-6 [&>svg]:h-auto [&>svg]:max-w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <figcaption className="border-t border-[var(--line)] px-4 py-3 text-sm leading-6 text-[var(--muted)]">
        <span className="font-medium text-white/80">{caption}.</span> {alt}
      </figcaption>
    </figure>
  );
}

// Synchronous on purpose: the page runs the programs first, so nothing below it suspends.
function WorkedExampleBlock({
  worked,
  run,
  site,
  dictionary,
  title,
}: {
  worked: WorkedExample;
  run: SampleRun;
  site: ReferenceSiteCopy;
  dictionary: Dictionary;
  title: string;
}) {
  return (
    <div className="space-y-4">
      <CodeBlock dictionary={dictionary} lines={highlightSource(worked.program)} source={worked.program} title={title} />
      <div className="space-y-3">
        <h3 className="text-base font-semibold">{site.page.result}</h3>
        <p className="flex max-w-[65ch] gap-2 text-base leading-7 text-white/85">
          <span aria-hidden="true" className="text-[var(--accent)]">
            →
          </span>
          <span>{worked.outcome}</span>
        </p>
        {run.lines.length > 0 ? (
          <>
            <p className="text-sm text-[var(--muted)]">{worked.input ? site.page.resultWithInput : site.page.resultIntro}</p>
            <Transcript dictionary={dictionary} run={run} />
          </>
        ) : (
          <p className="text-sm text-[var(--muted)]">{site.page.noOutput}</p>
        )}
      </div>
    </div>
  );
}

function Independent({ locale, site }: { locale: Locale; site: ReferenceSiteCopy }) {
  return (
    <p className="max-w-[70ch] border-t border-[var(--line)] pt-6 text-sm leading-6 text-[var(--muted)]" lang={locale}>
      {site.page.independent}{' '}
      <a className="text-white/80 underline-offset-2 hover:underline" href={officialPseintUrl} rel="noopener noreferrer" target="_blank">
        {site.page.officialSite}
      </a>
      .
    </p>
  );
}

const mentionsProfile = (entry: ReferenceEntry) => /perfil|profile/i.test(`${entry.tip ?? ''} ${entry.copy.note ?? ''}`);

export async function ReferencePage({ locale, slug }: { locale: Locale; slug: string }) {
  const dictionary = await getDictionary(locale);
  const site = referenceCopy[locale];
  const found = findReferenceEntry(locale, dictionary, slug);
  if (!found) return null;
  const { group, entry, index } = found;
  const { copy } = entry;
  const url = absoluteUrl(referencePath(locale, entry.id));
  const indexUrl = absoluteUrl(referenceIndexPath(locale));
  const workspaceHref = workspaceProgramHref(locale, { name: copy.name, source: entry.example.program });
  const examples = examplesUsing(entry);
  const conceptName = dictionary.studio.examples.concepts[entry.concept];
  const previous = index > 0 ? group.entries[index - 1] : null;
  const next = index < group.entries.length - 1 ? group.entries[index + 1] : null;
  const siblings = group.entries.filter((e) => e.id !== entry.id);
  const fileName = `${copy.slug}.psc`;
  const [run, ...moreRuns] = await Promise.all(
    [entry.example, ...entry.more].map((worked, n) =>
      runProgram(worked.program, { input: worked.input, seed: n === 0 ? entry.id : `${entry.id}-${n + 1}`, settings: referenceSettings }),
    ),
  );

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        '@id': url,
        headline: copy.h1,
        name: copy.title,
        description: copy.description,
        url,
        inLanguage: locale,
        isAccessibleForFree: true,
        proficiencyLevel: 'Beginner',
        about: {
          '@type': 'DefinedTerm',
          name: entry.label,
          description: entry.body,
          inDefinedTermSet: { '@type': 'DefinedTermSet', name: site.index.h1, url: indexUrl },
        },
        hasPart: {
          '@type': 'SoftwareSourceCode',
          programmingLanguage: 'PSeInt',
          text: entry.example.program,
        },
        isPartOf: { '@type': 'WebSite', name: dictionary.metadata.siteName, url: absoluteUrl(`/${locale}`) },
        breadcrumb: { '@id': `${url}#breadcrumb` },
      },
      {
        '@id': `${url}#breadcrumb`,
        ...createBreadcrumbList([
          { name: site.section, url: indexUrl },
          { name: copy.name, url },
        ]),
      },
    ],
  };

  return (
    <main className="min-h-[100dvh] bg-[#141719]">
      <JsonLd data={structuredData} />
      <ExamplesShell alternateHref={referencePath(other(locale), entry.id)} dictionary={dictionary} locale={locale} section="reference">
        <article className="mx-auto flex w-full max-w-[920px] flex-col gap-12">
          <header className="space-y-5">
            <Breadcrumbs
              items={[{ name: site.section, href: referenceIndexPath(locale) }, { name: copy.name }]}
              label={dictionary.examplePages.breadcrumbLabel}
            />
            <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{copy.h1}</h1>
            <p className="max-w-[62ch] text-lg leading-8 text-white/85">{entry.body}</p>
            <dl className="flex flex-wrap items-center gap-x-5 gap-y-3 text-xs">
              <div className="flex items-center gap-2">
                <dt className="text-[var(--muted)]">{site.page.group}:</dt>
                <dd>
                  <Chip href={`${referenceIndexPath(locale)}#${group.id}`}>{group.title}</Chip>
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="sr-only">{site.page.template}</dt>
                <dd>
                  <code className="rounded bg-white/[0.05] px-2 py-0.5 font-mono text-[13px] text-[#8FE3BE]">{entry.label}</code>
                </dd>
              </div>
            </dl>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
              <Link
                aria-label={formatMessage(site.page.openLabel, { name: copy.name })}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#7FE0B8] px-5 py-2.5 text-sm font-semibold text-[#0E1214] transition hover:bg-[#9BEBC9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7FE0B8]"
                href={workspaceHref}
              >
                <Play aria-hidden="true" fill="currentColor" size={14} />
                {site.page.open}
              </Link>
              <p className="text-xs text-[var(--muted)] sm:ml-2">{site.page.openHint}</p>
            </div>
          </header>

          <section aria-labelledby="example">
            <SectionHeading id="example" intro={site.page.exampleIntro}>
              {site.page.example}
            </SectionHeading>
            <WorkedExampleBlock dictionary={dictionary} run={run} site={site} title={fileName} worked={entry.example} />
          </section>

          {entry.more.map((worked, n) => (
            <section aria-labelledby={`example-${n + 2}`} key={worked.program}>
              <SectionHeading id={`example-${n + 2}`}>{site.page.anotherExample}</SectionHeading>
              <WorkedExampleBlock dictionary={dictionary} run={moreRuns[n]} site={site} title={fileName} worked={worked} />
            </section>
          ))}

          {entry.tip || copy.note ? (
            <div className={`grid gap-4 ${entry.tip && copy.note ? 'sm:grid-cols-2' : ''}`}>
              {entry.tip ? (
                <section aria-labelledby="mistake" className="rounded-xl border border-[#E8BE8C]/25 bg-[#E8BE8C]/[0.06] p-5">
                  <h2 className="text-base font-semibold text-[#F0CFA6]" id="mistake">
                    {site.page.mistake}
                  </h2>
                  <p className="mt-2 text-base leading-7 text-white/90">{entry.tip}</p>
                </section>
              ) : null}
              {copy.note ? (
                <section aria-labelledby="note" className="rounded-xl border border-[var(--accent-soft)] bg-[var(--accent-surface)] p-5">
                  <h2 className="text-base font-semibold text-[var(--accent-strong)]" id="note">
                    {site.page.note}
                  </h2>
                  <p className="mt-2 text-base leading-7 text-white/90">{copy.note}</p>
                </section>
              ) : null}
            </div>
          ) : null}

          {mentionsProfile(entry) ? (
            <p className="-mt-6 text-sm text-[var(--muted)]">
              {site.page.profilesHint.split('{link}')[0]}
              <Link className="text-white/85 underline underline-offset-2 hover:text-white" href={sectionPath(locale, 'profiles')}>
                {site.page.profilesLink}
              </Link>
              {site.page.profilesHint.split('{link}')[1]}
            </p>
          ) : null}

          {entry.shape ? (
            <section aria-labelledby="flowchart">
              <SectionHeading id="flowchart" intro={site.page.flowchartIntro}>
                {site.page.flowchart}
              </SectionHeading>
              <ShapeFigure dictionary={dictionary} shape={entry.shape} site={site} />
              <Link className="mt-3 inline-flex text-sm text-[var(--accent)] hover:underline" href={featurePath(locale, 'flowchart')}>
                {site.page.flowchartLink} →
              </Link>
            </section>
          ) : null}

          <section aria-labelledby="template">
            <SectionHeading id="template" intro={site.page.templateIntro}>
              {site.page.template}
            </SectionHeading>
            <CodeBlock dictionary={dictionary} lines={highlightSource(entry.template)} source={entry.template} title={entry.label} />
          </section>

          {examples.length > 0 ? (
            <section aria-labelledby="used-in">
              <SectionHeading id="used-in" intro={site.page.usedInIntro}>
                {site.page.usedIn}
              </SectionHeading>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {examples.map((example) => (
                  <ExampleCard dictionary={dictionary} example={example} key={example.id} locale={locale} />
                ))}
              </ul>
              <Link className="mt-4 inline-flex text-sm text-[var(--accent)] hover:underline" href={conceptPath(locale, entry.concept)}>
                {formatMessage(site.page.seeAllConcept, { concept: conceptName })} →
              </Link>
            </section>
          ) : null}

          {siblings.length > 0 ? (
            <section aria-labelledby="siblings">
              <SectionHeading id="siblings">{formatMessage(site.page.siblings, { group: group.title.toLowerCase() })}</SectionHeading>
              <ul className="flex flex-wrap gap-2">
                {siblings.map((sibling) => (
                  <li key={sibling.id}>
                    <Chip href={referencePath(locale, sibling.id)}>{sibling.copy.name}</Chip>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <nav aria-label={site.section} className="grid gap-3 sm:grid-cols-2">
            {previous ? (
              <Link
                className="flex flex-col gap-1 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 transition hover:border-[var(--accent-soft)]"
                href={referencePath(locale, previous.id)}
                rel="prev"
              >
                <span className="flex items-center gap-1 text-xs text-[var(--muted)]">
                  <ArrowLeft aria-hidden="true" size={12} /> {site.page.previous}
                </span>
                <span className="font-medium">{previous.copy.name}</span>
              </Link>
            ) : (
              <Link
                className="flex flex-col gap-1 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 transition hover:border-[var(--accent-soft)]"
                href={referenceIndexPath(locale)}
              >
                <span className="flex items-center gap-1 text-xs text-[var(--muted)]">
                  <ArrowLeft aria-hidden="true" size={12} /> {site.section}
                </span>
                <span className="font-medium">{site.page.backToIndex}</span>
              </Link>
            )}
            {next ? (
              <Link
                className="flex flex-col gap-1 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 text-right transition hover:border-[var(--accent-soft)]"
                href={referencePath(locale, next.id)}
                rel="next"
              >
                <span className="flex items-center justify-end gap-1 text-xs text-[var(--muted)]">
                  {site.page.next} <ArrowRight aria-hidden="true" size={12} />
                </span>
                <span className="font-medium">{next.copy.name}</span>
              </Link>
            ) : null}
          </nav>

          <Independent locale={locale} site={site} />
        </article>
      </ExamplesShell>
    </main>
  );
}

/* ---------------- sitemap ---------------- */

function sitemapRow(pathFor: (locale: Locale) => string, priority: number): SitemapEntry[] {
  const languages: Record<string, string> = {};
  for (const locale of locales) languages[locale] = absoluteUrl(pathFor(locale));
  languages['x-default'] = absoluteUrl(pathFor('es'));
  return locales.map((locale) => ({
    url: absoluteUrl(pathFor(locale)),
    alternates: { languages },
    changeFrequency: 'monthly' as const,
    priority,
  }));
}

/** Every reference URL (index and pages) in every locale. */
export function referenceSitemapEntries(): SitemapEntry[] {
  return [
    ...sitemapRow(referenceIndexPath, 0.8),
    ...referenceIds.flatMap((id) => sitemapRow((locale) => referencePath(locale, id), 0.6)),
  ];
}
