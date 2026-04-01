import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import AboutShell from "@/src/components/about/about-shell";
import { hasLocale } from "@/src/i18n/config";
import { getDictionary } from "@/src/i18n/server";
import {
  localeAlternates,
  openGraphLocale,
  localizedSiteUrl,
  officialPseintUrl,
} from "@/src/seo/site";
import { createAboutStructuredData } from "@/src/seo/structured-data";

interface AboutPageProps {
  params: Promise<{
    lang: string;
  }>;
}

export async function generateMetadata({
  params,
}: AboutPageProps): Promise<Metadata> {
  const { lang } = await params;

  if (!hasLocale(lang)) {
    notFound();
  }

  const dictionary = await getDictionary(lang);

  return {
    title: dictionary.metadata.about.title,
    description: dictionary.metadata.about.description,
    keywords: dictionary.metadata.about.keywords,
    alternates: {
      canonical: localizedSiteUrl(lang, "/about"),
      languages: localeAlternates("/about"),
    },
    openGraph: {
      title: `${dictionary.metadata.about.title} | ${dictionary.metadata.siteName}`,
      description: dictionary.metadata.about.description,
      url: localizedSiteUrl(lang, "/about"),
      locale: openGraphLocale(lang),
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${dictionary.metadata.about.title} | ${dictionary.metadata.siteName}`,
      description: dictionary.metadata.about.description,
    },
  };
}

export default async function AboutPage({ params }: AboutPageProps) {
  const { lang } = await params;

  if (!hasLocale(lang)) {
    notFound();
  }

  const dictionary = await getDictionary(lang);
  const structuredData = createAboutStructuredData(lang, dictionary);

  return (
    <main className="min-h-screen overflow-x-hidden">
      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
        type="application/ld+json"
      />
      <AboutShell dictionary={dictionary} locale={lang}>
        <article className="mx-auto flex h-full w-full max-w-[960px] flex-col gap-10 px-2 py-4 sm:px-4 lg:justify-center lg:py-10">
          <header className="space-y-4 border-b border-[var(--line)] pb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
              {dictionary.aboutPage.eyebrow}
            </p>
            <h1 className="text-4xl font-semibold tracking-[-0.04em] text-[var(--foreground)] sm:text-5xl">
              {dictionary.aboutPage.title}
            </h1>
          </header>

          <section className="grid gap-10 border-b border-[var(--line)] pb-8 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)]">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              {dictionary.aboutPage.storyTitle}
            </h2>
            <p className="max-w-[62ch] text-base leading-8 text-[var(--foreground)]">
              {dictionary.aboutPage.storyBody}
            </p>
          </section>

          <section className="grid gap-10 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)]">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              {dictionary.aboutPage.compatibilityTitle}
            </h2>
            <div className="max-w-[62ch] space-y-4">
              <p className="text-base leading-8 text-[var(--foreground)]">
                {dictionary.aboutPage.compatibilityBody}
              </p>
              <Link
                className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-soft)] bg-[var(--accent-surface)] px-4 py-2 text-sm font-medium text-[var(--accent-strong)] transition hover:border-[var(--accent)] hover:bg-[rgba(241,252,247,0.98)]"
                href={officialPseintUrl}
                rel="noreferrer"
                target="_blank"
              >
                {dictionary.aboutPage.officialLinkLabel}
              </Link>
            </div>
          </section>
        </article>
      </AboutShell>
    </main>
  );
}
