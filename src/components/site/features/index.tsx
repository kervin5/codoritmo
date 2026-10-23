// Feature landing pages (/[lang]/<feature slug>, see src/seo/sections.ts).
// Contract used by app/[lang]/[section]/page.tsx and the features sitemap:
// featureMetadata, FeaturePage and featureSitemapEntries.
//
// Every page shows the feature with real output computed at build time
// (translations, a trace table, flowcharts) or a real screenshot, then the
// steps to do it in Codoritmo, an honest comparison with PSeInt desktop, an
// FAQ and links into the rest of the site.

import { ArrowRight, Play } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { absoluteUrl, exampleFlowcharts, highlightSource, pageAlternates } from "@/src/components/examples-site/content";
import ExamplesShell from "@/src/components/examples-site/examples-shell";
import { Breadcrumbs, CodeBlock, ExampleCard, JsonLd, SectionHeading } from "@/src/components/examples-site/parts";
import { conceptSegment, hasConcept } from "@/src/components/site/concepts";
import type { ExampleProgram } from "@/src/engine";
import { locales, type Locale } from "@/src/i18n/config";
import { formatMessage } from "@/src/i18n/format";
import { getDictionary } from "@/src/i18n/server";
import { featuresEn } from "@/src/i18n/site/features-en";
import { featuresEs } from "@/src/i18n/site/features-es";
import type { FeaturesCopy } from "@/src/i18n/site/features-types";
import type { Dictionary } from "@/src/i18n/types";
import { examplePath, examplesIndexPath, slugify } from "@/src/lib/example-urls";
import { workspaceProgramHref } from "@/src/lib/workspace-deeplink";
import { featureIds, featurePath, sectionPath, type FeatureId } from "@/src/seo/sections";
import { officialPseintUrl, openGraphLocale, localizedSiteUrl } from "@/src/seo/site";
import type { SitemapEntry } from "@/src/seo/sitemap-entry";
import { createBreadcrumbList, createHomeStructuredData } from "@/src/seo/structured-data";

import {
  exampleById,
  exampleCount,
  FEATURE_EXAMPLE,
  FEATURE_RELATED_EXAMPLES,
  LANGUAGE_NAMES,
  mappingTable,
  schoolProfileCount,
  shapeImage,
  traceExample,
  translateExample,
  TRANSLATION_LANGUAGE,
  type TraceTable,
} from "./data";
import { highlightGenerated } from "./highlight";

const COPY: Record<Locale, FeaturesCopy> = { es: featuresEs, en: featuresEn };

export function featuresCopy(locale: Locale): FeaturesCopy {
  return COPY[locale];
}

/** Fills {profiles} and {examples} with the real counts. */
export function fillCounts(text: string): string {
  return formatMessage(text, { profiles: schoolProfileCount, examples: exampleCount });
}

/** Screenshots under public/features, one per locale (the app's own UI language). */
const SCREENSHOTS: Partial<Record<FeatureId, { file: string; width: number; height: number }>> = {
  "pseint-online": { file: "workspace-step-by-step", width: 1440, height: 900 },
  alternative: { file: "workspace-step-by-step", width: 1440, height: 900 },
  blocks: { file: "blocks-mode", width: 1440, height: 900 },
};

export function screenshotPath(locale: Locale, id: FeatureId): string | null {
  const shot = SCREENSHOTS[id];
  return shot ? `/features/${shot.file}-${locale}.webp` : null;
}

/** "Algoritmo SumaHastaCero" → "SumaHastaCero.psc", the tab name the app would use. */
function programFileName(example: ExampleProgram): string {
  const name = /^\s*(?:Algoritmo|Proceso)\s+([\p{L}\w]+)/imu.exec(example.source)?.[1] ?? example.id;
  return `${name}.psc`;
}

export function featureWorkspaceHref(locale: Locale, id: FeatureId): string {
  const example = exampleById(FEATURE_EXAMPLE[id]);
  return workspaceProgramHref(locale, { name: programFileName(example), source: example.source, profileId: example.profileId });
}

const ogImage = (locale: Locale) => ({ url: absoluteUrl(`/${locale}/opengraph-image`), width: 1200, height: 630 });

/* ---------------- metadata and sitemap ---------------- */

export async function featureMetadata(locale: Locale, id: FeatureId): Promise<Metadata> {
  const copy = COPY[locale].features[id];
  const dictionary = await getDictionary(locale);
  const alternates = pageAlternates(locale, (l) => featurePath(l, id));
  const title = copy.title;
  const description = fillCounts(copy.description);
  const shot = screenshotPath(locale, id);
  const images = [
    ...(shot ? [{ url: absoluteUrl(shot), width: SCREENSHOTS[id]!.width, height: SCREENSHOTS[id]!.height, alt: copy.showcase.alt ?? copy.h1 }] : []),
    { ...ogImage(locale), alt: copy.h1 },
  ];
  return {
    title,
    description,
    keywords: copy.keywords,
    alternates,
    openGraph: {
      title: `${title} | ${dictionary.metadata.siteName}`,
      description,
      url: alternates.canonical,
      siteName: dictionary.metadata.siteName,
      locale: openGraphLocale(locale),
      type: "website",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${dictionary.metadata.siteName}`,
      description,
      images: images.map((image) => image.url),
    },
  };
}

export function featureSitemapEntries(): SitemapEntry[] {
  return featureIds.flatMap((id) => {
    const languages = pageAlternates("es", (l) => featurePath(l, id)).languages;
    return locales.map((locale) => ({
      url: absoluteUrl(featurePath(locale, id)),
      alternates: { languages },
      changeFrequency: "monthly" as const,
      priority: 0.8,
    }));
  });
}

/* ---------------- structured data ---------------- */

/** The app's WebApplication node (the home page's structured data), for a page's @graph. */
export function webApplicationNode(locale: Locale, dictionary: Dictionary) {
  const app: Partial<ReturnType<typeof createHomeStructuredData>> = { ...createHomeStructuredData(locale, dictionary) };
  delete app["@context"];
  return app as Omit<ReturnType<typeof createHomeStructuredData>, "@context">;
}

function featureStructuredData(locale: Locale, id: FeatureId, dictionary: Dictionary) {
  const text = COPY[locale];
  const copy = text.features[id];
  const url = absoluteUrl(featurePath(locale, id));
  const app = webApplicationNode(locale, dictionary);
  const shot = screenshotPath(locale, id);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": url,
        url,
        name: copy.title,
        headline: copy.h1,
        description: fillCounts(copy.description),
        inLanguage: locale,
        isPartOf: { "@type": "WebSite", name: dictionary.metadata.siteName, url: localizedSiteUrl(locale) },
        about: { "@id": app["@id"] },
        breadcrumb: { "@id": `${url}#breadcrumb` },
        mainEntity: { "@id": `${url}#faq` },
        ...(shot ? { primaryImageOfPage: { "@type": "ImageObject", url: absoluteUrl(shot), caption: copy.showcase.alt } } : {}),
      },
      {
        "@id": `${url}#breadcrumb`,
        ...createBreadcrumbList([
          { name: text.home, url: localizedSiteUrl(locale) },
          { name: copy.name, url },
        ]),
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        inLanguage: locale,
        mainEntity: copy.faq.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: fillCounts(item.a) },
        })),
      },
      app,
    ],
  };
}

/* ---------------- page ---------------- */

export async function FeaturePage({ locale, id }: { locale: Locale; id: FeatureId }) {
  const dictionary = await getDictionary(locale);
  const text = COPY[locale];
  const copy = text.features[id];
  const otherLocale: Locale = locale === "es" ? "en" : "es";
  const workspaceHref = featureWorkspaceHref(locale, id);
  const example = exampleById(FEATURE_EXAMPLE[id]);
  const trace = id === "desk-check" ? await traceExample(example) : null;

  return (
    <main className="min-h-[100dvh] bg-[#141719]">
      <JsonLd data={featureStructuredData(locale, id, dictionary)} />
      <ExamplesShell alternateHref={featurePath(otherLocale, id)} dictionary={dictionary} locale={locale}>
        <article className="mx-auto flex w-full max-w-[1000px] flex-col gap-14">
          <header className="space-y-5">
            <Breadcrumbs
              items={[{ name: text.home, href: `/${locale}` }, { name: copy.name }]}
              label={dictionary.examplePages.breadcrumbLabel}
            />
            <h1 className="max-w-[24ch] text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{copy.h1}</h1>
            <p className="max-w-[68ch] text-lg leading-8 text-white/80">{fillCounts(copy.lead)}</p>
            <CallToAction hint={copy.ctaHint} href={workspaceHref} label={copy.cta} />
          </header>

          <section aria-labelledby="showcase">
            <SectionHeading id="showcase" intro={copy.showcase.intro}>
              {copy.showcase.title}
            </SectionHeading>
            <Showcase dictionary={dictionary} example={example} id={id} locale={locale} trace={trace} />
          </section>

          <section aria-labelledby="steps">
            <SectionHeading id="steps">{copy.stepsTitle}</SectionHeading>
            <ol className="grid gap-3 sm:grid-cols-2">
              {copy.steps.map((step, index) => (
                <li className="flex gap-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" key={step.title}>
                  <span
                    aria-hidden="true"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[var(--accent-soft)] text-sm font-semibold text-[var(--accent-strong)]"
                  >
                    {index + 1}
                  </span>
                  <div className="space-y-1">
                    <h3 className="font-semibold">{step.title}</h3>
                    <p className="text-sm leading-6 text-[var(--muted)]">{fillCounts(step.body)}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-6">
              <CallToAction hint={copy.ctaHint} href={workspaceHref} label={copy.cta} />
            </div>
          </section>

          {copy.notes.map((note, index) => (
            <section aria-labelledby={`note-${index}`} key={note.title}>
              <SectionHeading id={`note-${index}`}>{note.title}</SectionHeading>
              <div className="max-w-[70ch] space-y-4 text-base leading-7 text-white/85">
                {note.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{fillCounts(paragraph)}</p>
                ))}
              </div>
            </section>
          ))}

          <FeatureExtras dictionary={dictionary} id={id} locale={locale} />

          {copy.differences ? (
            <section aria-labelledby="differences">
              <SectionHeading id="differences" intro={copy.differences.intro}>
                {text.differencesTitle}
              </SectionHeading>
              <div className="grid gap-4 md:grid-cols-2">
                <DifferenceList items={copy.differences.codoritmo} title={text.codoritmoColumn} />
                <DifferenceList items={copy.differences.desktop} title={text.desktopColumn} />
              </div>
              <OfficialNote text={text} />
            </section>
          ) : null}

          <section aria-labelledby="faq">
            <SectionHeading id="faq">{text.faqTitle}</SectionHeading>
            <div className="divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">
              {copy.faq.map((item) => (
                <div className="space-y-2 p-5" key={item.q}>
                  <h3 className="font-semibold">{item.q}</h3>
                  <p className="max-w-[70ch] text-sm leading-6 text-white/75">{fillCounts(item.a)}</p>
                </div>
              ))}
            </div>
          </section>

          <RelatedExamples dictionary={dictionary} id={id} locale={locale} />
          <RelatedFeatures id={id} locale={locale} />
          <KeepLearning locale={locale} />
        </article>
      </ExamplesShell>
    </main>
  );
}

/* ---------------- shared pieces ---------------- */

function CallToAction({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <Link
        className="inline-flex items-center justify-center gap-2 rounded-full bg-[#7FE0B8] px-5 py-2.5 text-sm font-semibold text-[#0E1214] transition hover:bg-[#9BEBC9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7FE0B8]"
        href={href}
      >
        <Play aria-hidden="true" fill="currentColor" size={14} />
        {label}
      </Link>
      <p className="text-xs text-[var(--muted)] sm:ml-2">{hint}</p>
    </div>
  );
}

function DifferenceList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
      <h3 className="mb-3 font-semibold">{title}</h3>
      <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-white/80 marker:text-white/30">
        {items.map((item) => (
          <li key={item}>{fillCounts(item)}</li>
        ))}
      </ul>
    </div>
  );
}

function OfficialNote({ text }: { text: FeaturesCopy }) {
  return (
    <p className="mt-4 max-w-[70ch] text-sm leading-6 text-[var(--muted)]">
      {text.officialNote}{" "}
      <a className="text-[var(--accent-strong)] underline-offset-2 hover:underline" href={officialPseintUrl} rel="noopener noreferrer" target="_blank">
        {text.officialLinkLabel}
      </a>
    </p>
  );
}

function Screenshot({ locale, id, alt }: { locale: Locale; id: FeatureId; alt: string }) {
  const shot = SCREENSHOTS[id];
  const src = screenshotPath(locale, id);
  if (!shot || !src) return null;
  return (
    <figure className="overflow-hidden rounded-xl border border-[var(--line)] bg-[#101315]">
      <Image alt={alt} className="h-auto w-full" height={shot.height} preload sizes="(max-width: 1064px) 100vw, 1000px" src={src} width={shot.width} />
    </figure>
  );
}

function codeTitle(example: ExampleProgram) {
  return programFileName(example);
}

/* ---------------- showcases ---------------- */

function Showcase({
  id,
  locale,
  dictionary,
  example,
  trace,
}: {
  id: FeatureId;
  locale: Locale;
  dictionary: Dictionary;
  example: ExampleProgram;
  trace: TraceTable | null;
}) {
  const text = COPY[locale];
  const copy = text.features[id];
  const language = TRANSLATION_LANGUAGE[id];

  if (language) {
    const generated = translateExample(example, language);
    const extension = { python: "py", c: "c", cpp: "cpp", java: "java", javascript: "js" }[language];
    const base = codeTitle(example).replace(/\.psc$/, "");
    return (
      <div className="space-y-3">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <h3 className="text-sm font-medium text-white/70">{text.sourceTitle}</h3>
            <CodeBlock dictionary={dictionary} lines={highlightSource(example.source)} source={example.source} title={codeTitle(example)} />
          </div>
          <div className="min-w-0 space-y-2">
            <h3 className="text-sm font-medium text-white/70">{formatMessage(text.generatedTitle, { lang: LANGUAGE_NAMES[language] })}</h3>
            <CodeBlock dictionary={dictionary} lines={highlightGenerated(generated, language)} source={generated} title={`${base}.${extension}`} />
          </div>
        </div>
        <p className="text-xs text-[var(--muted)]">{text.generatedNote}</p>
      </div>
    );
  }

  if (id === "flowchart") {
    const charts = exampleFlowcharts(example, (name) => formatMessage(text.flowchart.label, { name }));
    return (
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <CodeBlock dictionary={dictionary} lines={highlightSource(example.source)} source={example.source} title={codeTitle(example)} />
        {charts.map((chart) => (
          <FlowchartFigure key={chart.name} svg={chart.svg} />
        ))}
      </div>
    );
  }

  if (id === "desk-check" && trace) {
    const label = dictionary.examples[example.id]?.label ?? example.label;
    return (
      <div className="space-y-4">
        <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[#0E1113]" tabIndex={0}>
          <table className="w-full border-collapse font-mono text-[13px] text-[#DCE3E0]">
            <caption className="sr-only">{formatMessage(text.trace.caption, { name: label })}</caption>
            <thead className="bg-white/[0.03]">
              <tr className="border-b border-white/10 text-left">
                <th className="px-3 py-2 font-sans text-xs font-medium text-white/50" scope="col">
                  {text.trace.step}
                </th>
                <th className="px-3 py-2 font-sans text-xs font-medium text-white/50" scope="col">
                  {text.trace.line}
                </th>
                <th className="px-3 py-2 font-sans text-xs font-medium text-white/50" scope="col">
                  {text.trace.instruction}
                </th>
                {trace.variables.map((name) => (
                  <th className="px-3 py-2 font-semibold" key={name} scope="col">
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trace.rows.map((row) => (
                <tr className="border-b border-white/[0.06]" key={row.step}>
                  <td className="px-3 py-1.5 text-white/40">{row.step}</td>
                  <td className="px-3 py-1.5 text-white/40">{row.line}</td>
                  <td className="max-w-[22rem] truncate px-3 py-1.5 text-white/60" title={row.code}>
                    {row.code}
                  </td>
                  {row.values.map((value, index) => (
                    <td className={`px-3 py-1.5 ${value.changed ? "bg-[#1F7A5C]/25 font-semibold text-[#86F0C4]" : ""}`} key={trace.variables[index]}>
                      {value.text}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[var(--muted)]">{formatMessage(text.trace.rowsShown, { count: trace.rows.length })}</p>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
            <dt className="mb-2 font-semibold">{text.trace.input}</dt>
            <dd className="font-mono text-[#7FE0B8]">{trace.inputs.join(", ")}</dd>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
            <dt className="mb-2 font-semibold">{text.trace.output}</dt>
            <dd>
              <pre className="whitespace-pre-wrap font-mono text-[13px] leading-6 text-white/80">{trace.output.join("\n")}</pre>
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  if (id === "alternative") {
    const comparison = copy.comparison;
    return (
      <div className="space-y-6">
        {comparison ? (
          <div className="overflow-x-auto rounded-xl border border-[var(--line)]" tabIndex={0}>
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-white/[0.03] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium" scope="col">
                    {comparison.feature}
                  </th>
                  <th className="px-4 py-3 font-medium text-white" scope="col">
                    Codoritmo
                  </th>
                  <th className="px-4 py-3 font-medium text-white" scope="col">
                    {locale === "es" ? "PSeInt de escritorio" : "PSeInt desktop"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparison.rows.map((row) => (
                  <tr className="border-t border-[var(--line)] align-top" key={row.feature}>
                    <th className="px-4 py-3 font-normal text-white/70" scope="row">
                      {row.feature}
                    </th>
                    <td className="px-4 py-3 text-white/90">{fillCounts(row.codoritmo)}</td>
                    <td className="px-4 py-3 text-white/90">{fillCounts(row.desktop)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <OfficialNote text={text} />
        <Screenshot alt={copy.showcase.alt ?? copy.h1} id={id} locale={locale} />
      </div>
    );
  }

  if (id === "blocks") {
    return (
      <div className="space-y-6">
        <Screenshot alt={copy.showcase.alt ?? copy.h1} id={id} locale={locale} />
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-white/70">{text.blocks.codeTitle}</h3>
          <CodeBlock dictionary={dictionary} lines={highlightSource(example.source)} source={example.source} title={codeTitle(example)} />
        </div>
      </div>
    );
  }

  return <Screenshot alt={copy.showcase.alt ?? copy.h1} id={id} locale={locale} />;
}

function FlowchartFigure({ svg }: { svg: string }) {
  return (
    <figure className="overflow-hidden rounded-xl border border-[var(--line)] bg-[#F7F4EE]">
      <div className="flex max-h-[900px] justify-center overflow-auto [&>svg]:h-auto [&>svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
    </figure>
  );
}

/* ---------------- page-specific sections ---------------- */

function FeatureExtras({ id, locale, dictionary }: { id: FeatureId; locale: Locale; dictionary: Dictionary }) {
  const text = COPY[locale];
  const language = TRANSLATION_LANGUAGE[id];

  if (language) {
    const rows = mappingTable(language);
    return (
      <section aria-labelledby="mapping">
        <SectionHeading id="mapping" intro={text.mapping.intro}>
          {text.mapping.title}
        </SectionHeading>
        <div className="overflow-x-auto rounded-xl border border-[var(--line)]" tabIndex={0}>
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-white/[0.03] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-2 font-medium" scope="col">
                  {text.mapping.instruction}
                </th>
                <th className="px-4 py-2 font-medium" scope="col">
                  {text.mapping.pseint}
                </th>
                <th className="px-4 py-2 font-medium" scope="col">
                  {LANGUAGE_NAMES[language]}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr className="border-t border-[var(--line)] align-top" key={row.id}>
                  <th className="px-4 py-3 font-normal text-white/75" scope="row">
                    {text.mapping.labels[row.id]}
                  </th>
                  <td className="px-4 py-3">
                    <pre className="whitespace-pre font-mono text-[12.5px] leading-5 text-[#E4EAE7]">{row.pseint.replace(/\t/g, "    ")}</pre>
                  </td>
                  <td className="px-4 py-3">
                    <pre className="whitespace-pre font-mono text-[12.5px] leading-5 text-[#E4EAE7]">{row.target.replace(/\t/g, "    ")}</pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  if (id === "flowchart") {
    const shapes = text.flowchart.shapes
      .map((shape) => ({ ...shape, image: shapeImage(shape.id) }))
      .filter((shape) => shape.image);
    const gallery = FEATURE_RELATED_EXAMPLES.flowchart.map(exampleById);
    return (
      <>
        <section aria-labelledby="legend">
          <SectionHeading id="legend" intro={text.flowchart.legendIntro}>
            {text.flowchart.legendTitle}
          </SectionHeading>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shapes.map((shape) => (
              <li className="flex flex-col gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" key={shape.id}>
                <div className="grid h-[150px] place-items-center rounded-lg bg-[#141719]">
                  {/* A tiny inline SVG (data URI); next/image would not optimize it. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="" className="max-h-[140px] w-auto max-w-full" height={shape.image!.height} src={shape.image!.src} width={shape.image!.width} />
                </div>
                <h3 className="font-semibold">{shape.name}</h3>
                <p className="text-sm leading-6 text-[var(--muted)]">{shape.body}</p>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="gallery">
          <SectionHeading id="gallery" intro={text.flowchart.galleryIntro}>
            {text.flowchart.galleryTitle}
          </SectionHeading>
          <div className="grid items-start gap-4 md:grid-cols-3">
            {gallery.map((example) => {
              const label = dictionary.examples[example.id]?.label ?? example.label;
              const chart = exampleFlowcharts(example, (name) => formatMessage(text.flowchart.label, { name }))[0];
              return chart ? (
                <div className="space-y-2" key={example.id}>
                  <FlowchartFigure svg={chart.svg} />
                  <Link className="text-sm font-medium text-[var(--accent-strong)] hover:underline" href={examplePath(locale, example.id)}>
                    {label}
                  </Link>
                </div>
              ) : null;
            })}
          </div>
        </section>
      </>
    );
  }

  return null;
}

/* ---------------- related links ---------------- */

/** Concept pages for the showcased example's concepts, when the concept pages exist. */
function conceptLinks(locale: Locale, example: ExampleProgram, dictionary: Dictionary) {
  return example.concepts.flatMap((concept) => {
    const label = dictionary.studio.examples.concepts[concept] ?? concept;
    const slug = [slugify(label), slugify(concept)].find((candidate) => hasConcept(locale, candidate));
    return slug ? [{ label, href: `${examplesIndexPath(locale)}/${conceptSegment[locale]}/${slug}` }] : [];
  });
}

function RelatedExamples({ id, locale, dictionary }: { id: FeatureId; locale: Locale; dictionary: Dictionary }) {
  const text = COPY[locale];
  const main = exampleById(FEATURE_EXAMPLE[id]);
  const examples = [main, ...FEATURE_RELATED_EXAMPLES[id].map(exampleById)];
  const concepts = conceptLinks(locale, main, dictionary);
  return (
    <section aria-labelledby="related-examples">
      <SectionHeading id="related-examples" intro={text.relatedExamplesIntro}>
        {text.relatedExamplesTitle}
      </SectionHeading>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {examples.map((example) => (
          <ExampleCard dictionary={dictionary} example={example} key={example.id} locale={locale} />
        ))}
      </ul>
      {concepts.length > 0 ? (
        <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="text-[var(--muted)]">{text.conceptsTitle}:</span>
          {concepts.map((concept) => (
            <Link className="text-[var(--accent-strong)] hover:underline" href={concept.href} key={concept.href}>
              {formatMessage(text.conceptLink, { concept: concept.label })}
            </Link>
          ))}
        </p>
      ) : null}
    </section>
  );
}

function RelatedFeatures({ id, locale }: { id: FeatureId; locale: Locale }) {
  const text = COPY[locale];
  return (
    <section aria-labelledby="related-features">
      <SectionHeading id="related-features">{text.relatedFeaturesTitle}</SectionHeading>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {featureIds
          .filter((other) => other !== id)
          .map((other) => (
            <li key={other}>
              <LinkCard body={text.features[other].summary} href={featurePath(locale, other)} title={text.features[other].name} />
            </li>
          ))}
      </ul>
    </section>
  );
}

export function KeepLearning({ locale }: { locale: Locale }) {
  const text = COPY[locale];
  const links = [
    { ...text.links.examples, href: examplesIndexPath(locale) },
    { ...text.links.reference, href: sectionPath(locale, "reference") },
    { ...text.links.profiles, href: sectionPath(locale, "profiles") },
    { ...text.links.about, href: `/${locale}/about` },
  ];
  return (
    <section aria-labelledby="keep-learning">
      <SectionHeading id="keep-learning">{text.keepLearningTitle}</SectionHeading>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {links.map((link) => (
          <li key={link.href}>
            <LinkCard body={fillCounts(link.body)} href={link.href} title={link.title} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function LinkCard({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link
      className="group flex h-full flex-col gap-1 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 transition hover:border-[var(--accent-soft)] hover:bg-[var(--panel-raised)]"
      href={href}
    >
      <span className="flex items-center gap-1 font-semibold">
        {title}
        <ArrowRight aria-hidden="true" className="text-white/30 transition group-hover:translate-x-0.5 group-hover:text-[var(--accent-strong)]" size={14} />
      </span>
      <span className="text-sm leading-6 text-[var(--muted)]">{body}</span>
    </Link>
  );
}
