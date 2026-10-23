import { ArrowRight, Play } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { REPOSITORY_URL } from "@/src/components/brand/logo-mark";
import { absoluteUrl } from "@/src/components/examples-site/content";
import ExamplesShell from "@/src/components/examples-site/examples-shell";
import { Breadcrumbs, JsonLd, SectionHeading } from "@/src/components/examples-site/parts";
import { featuresCopy, fillCounts, webApplicationNode } from "@/src/components/site/features";
import { hasLocale, type Locale } from "@/src/i18n/config";
import { getDictionary } from "@/src/i18n/server";
import type { AboutLinkTarget, Dictionary } from "@/src/i18n/types";
import { examplesIndexPath } from "@/src/lib/example-urls";
import { featurePath, sectionPath } from "@/src/seo/sections";
import { localeAlternates, localizedSiteUrl, officialPseintUrl, openGraphLocale } from "@/src/seo/site";
import { createBreadcrumbList } from "@/src/seo/structured-data";

interface AboutPageProps {
  params: Promise<{
    lang: string;
  }>;
}

const LICENSE_URL = "https://www.gnu.org/licenses/old-licenses/gpl-2.0.html";

export async function generateMetadata({ params }: AboutPageProps): Promise<Metadata> {
  const { lang } = await params;

  if (!hasLocale(lang)) {
    notFound();
  }

  const dictionary = await getDictionary(lang);
  const { title, description, keywords } = dictionary.metadata.about;
  const image = { url: absoluteUrl(`/${lang}/opengraph-image`), width: 1200, height: 630, alt: dictionary.aboutPage.title };

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: localizedSiteUrl(lang, "/about"),
      languages: localeAlternates("/about"),
    },
    openGraph: {
      title: `${title} | ${dictionary.metadata.siteName}`,
      description,
      url: localizedSiteUrl(lang, "/about"),
      siteName: dictionary.metadata.siteName,
      locale: openGraphLocale(lang),
      type: "website",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${dictionary.metadata.siteName}`,
      description,
      images: [image.url],
    },
  };
}

function aboutStructuredData(locale: Locale, dictionary: Dictionary) {
  const url = localizedSiteUrl(locale, "/about");
  const app = webApplicationNode(locale, dictionary);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "AboutPage",
        "@id": url,
        url,
        name: dictionary.metadata.about.title,
        description: dictionary.metadata.about.description,
        inLanguage: locale,
        isPartOf: { "@type": "WebSite", name: dictionary.metadata.siteName, url: localizedSiteUrl(locale) },
        about: { "@id": app["@id"] },
        breadcrumb: { "@id": `${url}#breadcrumb` },
        mentions: { "@type": "SoftwareApplication", name: "PSeInt", url: officialPseintUrl, author: { "@type": "Person", name: "Pablo Novara" } },
      },
      {
        "@id": `${url}#breadcrumb`,
        ...createBreadcrumbList([
          { name: dictionary.metadata.siteName, url: localizedSiteUrl(locale) },
          { name: dictionary.aboutPage.breadcrumb, url },
        ]),
      },
      { ...app, codeRepository: REPOSITORY_URL },
    ],
  };
}

/** Label and URL for a feature section's link: a feature page or a site section. */
function aboutLink(locale: Locale, target: AboutLinkTarget): { label: string; href: string } {
  const features = featuresCopy(locale);
  switch (target) {
    case "examples":
      return { label: features.links.examples.title, href: examplesIndexPath(locale) };
    case "reference":
      return { label: features.links.reference.title, href: sectionPath(locale, "reference") };
    case "profiles":
      return { label: features.links.profiles.title, href: sectionPath(locale, "profiles") };
    default:
      return { label: features.features[target].name, href: featurePath(locale, target) };
  }
}

const textLink = "text-[var(--accent-strong)] underline-offset-2 hover:underline";

export default async function AboutPage({ params }: AboutPageProps) {
  const { lang } = await params;

  if (!hasLocale(lang)) {
    notFound();
  }

  const dictionary = await getDictionary(lang);
  const text = dictionary.aboutPage;
  const otherLocale: Locale = lang === "es" ? "en" : "es";

  return (
    <main className="min-h-[100dvh] bg-[#141719]">
      <JsonLd data={aboutStructuredData(lang, dictionary)} />
      <ExamplesShell alternateHref={`/${otherLocale}/about`} dictionary={dictionary} locale={lang}>
        <article className="mx-auto flex w-full max-w-[960px] flex-col gap-14">
          <header className="space-y-5">
            <Breadcrumbs
              items={[{ name: dictionary.metadata.siteName, href: `/${lang}` }, { name: text.breadcrumb }]}
              label={dictionary.examplePages.breadcrumbLabel}
            />
            <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{text.title}</h1>
            <p className="max-w-[68ch] text-lg leading-8 text-white/80">{fillCounts(text.lead)}</p>
          </header>

          <section aria-labelledby="what">
            <SectionHeading id="what">{text.whatTitle}</SectionHeading>
            <div className="max-w-[70ch] space-y-4 text-base leading-7 text-white/85">
              {text.whatBody.map((paragraph) => (
                <p key={paragraph}>{fillCounts(paragraph)}</p>
              ))}
            </div>
          </section>

          <section aria-labelledby="features">
            <SectionHeading id="features" intro={text.featuresIntro}>
              {text.featuresTitle}
            </SectionHeading>
            <div className="grid gap-3 sm:grid-cols-2">
              {text.features.map((feature) => (
                <div className="flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5" key={feature.title}>
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="text-sm leading-6 text-white/75">{fillCounts(feature.body)}</p>
                  <p className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm">
                    {feature.links.map((target) => {
                      const link = aboutLink(lang, target);
                      return (
                        <Link className={`inline-flex items-center gap-1 ${textLink}`} href={link.href} key={target}>
                          {link.label}
                          <ArrowRight aria-hidden="true" size={13} />
                        </Link>
                      );
                    })}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="compatibility">
            <SectionHeading id="compatibility">{text.compatibilityTitle}</SectionHeading>
            <div className="max-w-[70ch] space-y-4 text-base leading-7 text-white/85">
              {text.compatibilityBody.map((paragraph) => (
                <p key={paragraph}>{fillCounts(paragraph)}</p>
              ))}
            </div>
            <p className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {(["profiles", "alternative"] as const).map((target) => {
                const link = aboutLink(lang, target);
                return (
                  <Link className={textLink} href={link.href} key={target}>
                    {link.label}
                  </Link>
                );
              })}
            </p>
          </section>

          <section aria-labelledby="open-source">
            <SectionHeading id="open-source">{text.openSourceTitle}</SectionHeading>
            <div className="max-w-[70ch] space-y-4 text-base leading-7 text-white/85">
              {text.openSourceBody.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <p className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <a className={textLink} href={REPOSITORY_URL} rel="noopener noreferrer" target="_blank">
                {text.repositoryLinkLabel}
              </a>
              <a className={textLink} href={LICENSE_URL} rel="noopener noreferrer license" target="_blank">
                {text.licenseLinkLabel}
              </a>
            </p>
          </section>

          <section aria-labelledby="credits">
            <SectionHeading id="credits">{text.creditsTitle}</SectionHeading>
            <div className="max-w-[70ch] space-y-4 text-base leading-7 text-white/85">
              {text.creditsBody.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <a
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--accent-soft)] bg-[var(--accent-surface)] px-4 py-2 text-sm font-medium text-[var(--accent-strong)] transition hover:border-[var(--accent)]"
              href={officialPseintUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              {text.officialLinkLabel}
            </a>
          </section>

          <section aria-labelledby="try" className="rounded-xl border border-[var(--accent-soft)] bg-[var(--accent-surface)] p-6">
            <h2 className="text-xl font-semibold tracking-[-0.02em]" id="try">
              {text.ctaTitle}
            </h2>
            <p className="mt-2 max-w-[60ch] text-sm leading-6 text-white/80">{text.ctaBody}</p>
            <Link
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-[#7FE0B8] px-5 py-2.5 text-sm font-semibold text-[#0E1214] transition hover:bg-[#9BEBC9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7FE0B8]"
              href={`/${lang}`}
            >
              <Play aria-hidden="true" fill="currentColor" size={14} />
              {text.ctaButton}
            </Link>
          </section>
        </article>
      </ExamplesShell>
    </main>
  );
}
