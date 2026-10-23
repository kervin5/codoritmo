// Public pages for PSeInt's school profiles: /es/perfiles (every profile, by
// letter) and /es/perfiles/<slug> (one profile's rules, explained, with a
// verified example). Routes live in app/[lang]/[section]/**; see data.ts for
// slugs and which pages are indexable, example.ts for the example programs.

import { Play } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { absoluteUrl, highlightSource, pageAlternates } from "@/src/components/examples-site/content";
import ExamplesShell from "@/src/components/examples-site/examples-shell";
import { Breadcrumbs, CodeBlock, ExampleCard, JsonLd, SectionHeading } from "@/src/components/examples-site/parts";
import { examplePrograms } from "@/src/engine";
import { locales, type Locale } from "@/src/i18n/config";
import { formatMessage, formatPlural } from "@/src/i18n/format";
import { getDictionary } from "@/src/i18n/server";
import type { ProfilesCopy, ProfileRuleKey } from "@/src/i18n/site/profiles-es";
import { examplesIndexPath } from "@/src/lib/example-urls";
import { workspaceProgramHref } from "@/src/lib/workspace-deeplink";
import { sectionPath } from "@/src/seo/sections";
import { officialPseintUrl, openGraphLocale } from "@/src/seo/site";
import type { SitemapEntry } from "@/src/seo/sitemap-entry";
import { createBreadcrumbList, createExampleCollectionStructuredData } from "@/src/seo/structured-data";

import { profilesCopy } from "./copy";
import {
  clip,
  descriptionLines,
  descriptionSummary,
  findProfile,
  generalProfiles,
  profileById,
  profilePath,
  profilesByLetter,
  profilesIndexPath,
  RULE_GROUPS,
  similarProfiles,
  siteProfiles,
  type SiteProfile,
} from "./data";
import { profileExample } from "./example";
import ProfileFilter from "./profile-filter";
import { normalizeProfileSearch } from "./search";

const otherLocale = (locale: Locale): Locale => (locale === "es" ? "en" : "es");
const ogImage = (locale: Locale) => absoluteUrl(`/${locale}/opengraph-image`);

/* ---------------- routing contract ---------------- */

/** Slugs of every profile page in a locale (/[lang]/perfiles/<slug>). */
export function profileSlugs(locale: Locale): string[] {
  return locales.includes(locale) ? siteProfiles.map((profile) => profile.slug) : [];
}

export function hasProfile(locale: Locale, slug: string): boolean {
  return locales.includes(locale) && findProfile(slug) !== null;
}

/* ---------------- shared bits ---------------- */

/** Renders `code` spans written with backticks in the rule texts. */
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/`([^`]+)`/).map((part, index) =>
        index % 2 === 1 ? (
          <code className="rounded bg-white/[0.06] px-1 py-px font-mono text-[0.9em] text-[#E4EAE7]" key={index}>
            {part}
          </code>
        ) : (
          part
        ),
      )}
    </>
  );
}

function Credit({ copy }: { copy: ProfilesCopy }) {
  return (
    <footer className="space-y-2 border-t border-[var(--line)] pt-6 text-sm leading-6 text-[var(--muted)]">
      <p>
        {copy.credit.before}
        <a className="text-white/80 underline decoration-white/30 underline-offset-2 hover:text-white" href={officialPseintUrl} rel="noopener">
          {copy.credit.link}
        </a>
        {copy.credit.after}
      </p>
      <p>{copy.independent}</p>
    </footer>
  );
}

function ruleState(copy: ProfilesCopy, key: ProfileRuleKey, value: boolean, short = false): string {
  const rule = copy.rules[key];
  return short ? (value ? rule.shortOn : rule.shortOff) : value ? rule.on : rule.off;
}

/** The description as the school sent it: a definition list for "Campo: valor" lines. */
function SchoolDescription({ description }: { description: string }) {
  const lines = descriptionLines(description);
  const fields = lines.filter((line) => line.kind === "field");
  if (fields.length >= 2) {
    return (
      <dl className="grid gap-x-4 gap-y-1.5 text-[15px] leading-7 sm:grid-cols-[max-content_1fr]" lang="es">
        {lines.map((line, index) =>
          line.kind === "field" ? (
            <div className="contents" key={index}>
              <dt className="text-[var(--muted)]">{line.label}</dt>
              <dd className="text-white/90">{line.value}</dd>
            </div>
          ) : (
            <dd className="text-white/90 sm:col-span-2" key={index}>
              {line.text}
            </dd>
          ),
        )}
      </dl>
    );
  }
  return (
    <div className="space-y-2 text-[15px] leading-7 text-white/90" lang="es">
      {lines.map((line, index) => (
        <p key={index}>{line.kind === "text" ? line.text : `${line.label}: ${line.value}`}</p>
      ))}
    </div>
  );
}

function openGraph(locale: Locale, siteName: string, title: string, description: string, url: string, type: "website" | "article") {
  const image = { url: ogImage(locale), width: 1200, height: 630, alt: title };
  return {
    openGraph: { title: `${title} | ${siteName}`, description, url, locale: openGraphLocale(locale), type, siteName, images: [image] },
    twitter: { card: "summary_large_image" as const, title: `${title} | ${siteName}`, description, images: [image.url] },
  };
}

/* ---------------- index ---------------- */

export async function profilesIndexMetadata(locale: Locale): Promise<Metadata> {
  const dictionary = await getDictionary(locale);
  const copy = profilesCopy(locale).index;
  const alternates = pageAlternates(locale, profilesIndexPath);
  return {
    title: copy.title,
    description: copy.description,
    alternates,
    ...openGraph(locale, dictionary.metadata.siteName, copy.title, copy.description, alternates.canonical, "website"),
  };
}

function ProfileListItem({ profile, locale }: { profile: SiteProfile; locale: Locale }) {
  const summary = descriptionSummary(profile.description);
  return (
    <li
      className="relative rounded-lg border border-transparent px-3 py-2 transition hover:border-[var(--line)] hover:bg-[var(--panel)] has-[a:focus-visible]:outline has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-[#7FE0B8]"
      data-profile-search={normalizeProfileSearch(`${profile.label} ${profile.id} ${profile.description}`)}
    >
      <Link className="font-medium text-white outline-none after:absolute after:inset-0 after:rounded-lg hover:text-[var(--accent-strong)]" href={profilePath(locale, profile.slug)}>
        {profile.label}
      </Link>
      <p className="mt-0.5 text-[13px] leading-5 text-[var(--muted)]" lang="es">
        {clip(summary, 110)}
      </p>
    </li>
  );
}

export async function ProfilesIndexPage({ locale }: { locale: Locale }) {
  const dictionary = await getDictionary(locale);
  const copy = profilesCopy(locale);
  const text = copy.index;
  const url = absoluteUrl(profilesIndexPath(locale));
  const letters = profilesByLetter();
  const general = generalProfiles();
  const schoolCount = letters.reduce((total, group) => total + group.profiles.length, 0);
  const home = { name: dictionary.metadata.siteName, href: `/${locale}` };

  const structuredData = createExampleCollectionStructuredData({
    locale,
    siteName: dictionary.metadata.siteName,
    name: text.title,
    description: text.description,
    url,
    items: [...general, ...letters.flatMap((group) => group.profiles)].map((profile) => ({
      name: profile.label,
      url: absoluteUrl(profilePath(locale, profile.slug)),
    })),
    breadcrumbs: [
      { name: home.name, url: absoluteUrl(home.href) },
      { name: copy.section, url },
    ],
  });

  return (
    <main className="min-h-[100dvh] bg-[#141719]">
      <JsonLd data={structuredData} />
      <ExamplesShell alternateHref={profilesIndexPath(otherLocale(locale))} dictionary={dictionary} isIndex locale={locale} section="profiles">
        <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-12">
          <header className="space-y-6 border-b border-[var(--line)] pb-10">
            <Breadcrumbs items={[home, { name: copy.section }]} label={copy.breadcrumbLabel} />
            <h1 className="max-w-[22ch] text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{text.h1}</h1>
            <p className="max-w-[62ch] text-base leading-8 text-white/80 sm:text-lg">{text.intro}</p>
            <div className="grid gap-4 pt-2 md:grid-cols-3">
              <section aria-labelledby="what" className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
                <h2 className="text-base font-semibold" id="what">
                  {text.whatTitle}
                </h2>
                {text.whatBody.map((paragraph) => (
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]" key={paragraph}>
                    {paragraph}
                  </p>
                ))}
              </section>
              <section aria-labelledby="why" className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
                <h2 className="text-base font-semibold" id="why">
                  {text.whyTitle}
                </h2>
                {text.whyBody.map((paragraph) => (
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]" key={paragraph}>
                    {paragraph}
                  </p>
                ))}
              </section>
              <section aria-labelledby="how" className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
                <h2 className="text-base font-semibold" id="how">
                  {text.howTitle}
                </h2>
                <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-6 text-[var(--muted)]">
                  {text.howSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{text.howDefault}</p>
              </section>
            </div>
          </header>

          {general.length ? (
            <section aria-labelledby="general">
              <SectionHeading id="general" intro={text.generalIntro}>
                {text.generalTitle}
              </SectionHeading>
              <ul className="grid gap-3 sm:grid-cols-2">
                {general.map((profile) => (
                  <li
                    className="relative rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 transition hover:border-[var(--accent-soft)] has-[a:focus-visible]:outline has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-[#7FE0B8]"
                    key={profile.id}
                  >
                    <h3 className="text-base font-semibold">
                      <Link className="outline-none after:absolute after:inset-0 after:rounded-xl" href={profilePath(locale, profile.slug)}>
                        {profile.label}
                      </Link>
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-[var(--muted)]" lang="es">
                      {profile.description}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="schools" className="space-y-6">
            <SectionHeading id="schools" intro={formatMessage(text.schoolsIntro, { count: schoolCount })}>
              {text.schoolsTitle}
            </SectionHeading>
            <ProfileFilter count={text.filterCount} empty={text.filterEmpty} label={text.filterLabel} listId="profile-list" placeholder={text.filterPlaceholder} />
            <nav aria-label={text.jumpLabel}>
              <ul className="flex flex-wrap gap-1.5">
                {letters.map(({ letter }) => (
                  <li key={letter}>
                    <a
                      className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-white/[0.1] px-2 text-sm text-white/75 transition hover:border-[var(--accent-soft)] hover:text-white"
                      href={`#letra-${letter === "#" ? "0" : letter}`}
                    >
                      {letter === "#" ? text.numbers : letter}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="space-y-10" id="profile-list">
              {letters.map(({ letter, profiles }) => {
                const id = `letra-${letter === "#" ? "0" : letter}`;
                return (
                  <section aria-labelledby={`${id}-title`} className="scroll-mt-16" data-profile-group id={id} key={letter}>
                    <h3 className="mb-3 flex items-baseline gap-3 border-b border-[var(--line)] pb-2" id={`${id}-title`}>
                      <span className="text-2xl font-semibold">{letter === "#" ? text.numbers : letter}</span>
                      <span className="text-xs text-[var(--muted)]">{formatPlural(text.letterCount, profiles.length)}</span>
                    </h3>
                    <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                      {profiles.map((profile) => (
                        <ProfileListItem key={profile.id} locale={locale} profile={profile} />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          </section>

          <Credit copy={copy} />
        </div>
      </ExamplesShell>
    </main>
  );
}

/* ---------------- one profile ---------------- */

/**
 * Search snippet: the profile, who it is for (from the school's own words) and
 * what the page offers, in at most 155 characters. In Spanish the school's
 * text reads on from the profile name ("Perfil X de PSeInt para la materia…");
 * in English it follows as its own sentence.
 */
function metaDescription(locale: Locale, copy: ProfilesCopy, profile: SiteProfile): string {
  const template = copy.page.description;
  const room = 155 - formatMessage(template, { name: profile.label, summary: "" }).length;
  const raw = descriptionSummary(profile.description);
  let summary: string;
  if (locale === "es") {
    const general = /^este perfil\s+/i.test(raw);
    const text = raw.replace(/^este perfil\s+/i, "").replace(/^perfil\s+(?=(?:para|de|del)\b)/i, "");
    const joiner = general ? ", que " : /^(?:para|de|del|en)\b/i.test(text) ? " " : ", ";
    summary = joiner + clip(text, room - joiner.length);
  } else {
    summary = ` ${clip(raw, room - 2)}`;
    if (!summary.endsWith("…")) summary += ".";
  }
  return formatMessage(template, { name: profile.label, summary }).replace("….", "…");
}

function pageTitle(copy: ProfilesCopy, profile: SiteProfile): string {
  const full = formatMessage(copy.page.title, { name: profile.label });
  return full.length <= 60 ? full : formatMessage(copy.page.titleShort, { name: profile.label });
}

export async function profileMetadata(locale: Locale, slug: string): Promise<Metadata> {
  const profile = findProfile(slug);
  if (!profile) return {};
  const dictionary = await getDictionary(locale);
  const copy = profilesCopy(locale);
  const title = pageTitle(copy, profile);
  const description = metaDescription(locale, copy, profile);
  const alternates = pageAlternates(locale, (l) => profilePath(l, profile.slug));
  return {
    title,
    description,
    alternates,
    ...(profile.indexable ? {} : { robots: { index: false, follow: true } }),
    ...openGraph(locale, dictionary.metadata.siteName, title, description, alternates.canonical, "article"),
  };
}

/** Three worked examples that exercise this profile's distinctive areas. */
function practiceExamples(profile: SiteProfile) {
  const s = profile.settings;
  const ids = ["array-average", s.enableUserFunctions ? "factorial-power" : "countdown", s.enableStringFunctions ? "count-vowels" : "leap-year"];
  return ids.map((id) => examplePrograms.find((example) => example.id === id)).filter((example) => example !== undefined);
}

export async function ProfilePage({ locale, slug }: { locale: Locale; slug: string }) {
  const profile = findProfile(slug);
  if (!profile) return null;
  const dictionary = await getDictionary(locale);
  const copy = profilesCopy(locale);
  const text = copy.page;
  const name = profile.label;
  const url = absoluteUrl(profilePath(locale, profile.slug));
  const example = await profileExample(profile, locale);
  const workspaceHref = workspaceProgramHref(locale, {
    name: example?.name ?? `${profile.id}.psc`,
    source: example?.source ?? "",
    profileId: profile.id,
  });
  const twins = profile.twins.map(profileById).filter((twin): twin is SiteProfile => twin !== null);
  const similar = twins.length ? [] : similarProfiles(profile, 6);
  const differences = new Set(profile.differences);
  const home = { name: dictionary.metadata.siteName, href: `/${locale}` };
  const indexHref = profilesIndexPath(locale);
  const h1 = formatMessage(text.h1, { name });
  const description = metaDescription(locale, copy, profile);

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        "@id": url,
        headline: h1,
        name: pageTitle(copy, profile),
        description,
        url,
        inLanguage: locale,
        isAccessibleForFree: true,
        image: ogImage(locale),
        about: { "@type": "Thing", name: h1, description: profile.description },
        isPartOf: { "@type": "CollectionPage", name: copy.index.title, url: absoluteUrl(indexHref) },
        publisher: { "@type": "Organization", name: dictionary.metadata.siteName, url: absoluteUrl(home.href) },
        isBasedOn: { "@type": "SoftwareApplication", name: "PSeInt", url: officialPseintUrl },
        breadcrumb: { "@id": `${url}#breadcrumb` },
        ...(example
          ? {
              hasPart: {
                "@type": "SoftwareSourceCode",
                name: example.name,
                text: example.source,
                programmingLanguage: { "@type": "ComputerLanguage", name: "PSeInt" },
                runtimePlatform: dictionary.metadata.siteName,
                url: absoluteUrl(workspaceHref),
              },
            }
          : {}),
      },
      {
        "@id": `${url}#breadcrumb`,
        ...createBreadcrumbList([
          { name: home.name, url: absoluteUrl(home.href) },
          { name: copy.section, url: absoluteUrl(indexHref) },
          { name, url },
        ]),
      },
    ],
  };

  return (
    <main className="min-h-[100dvh] bg-[#141719]">
      <JsonLd data={structuredData} />
      <ExamplesShell alternateHref={profilePath(otherLocale(locale), profile.slug)} dictionary={dictionary} locale={locale} section="profiles">
        <article className="mx-auto flex w-full max-w-[920px] flex-col gap-12">
          <header className="space-y-5">
            <Breadcrumbs items={[home, { name: copy.section, href: indexHref }, { name }]} label={copy.breadcrumbLabel} />
            <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{h1}</h1>
            <p className="max-w-[62ch] text-lg leading-8 text-white/80">{formatMessage(text.lead, { name })}</p>
            <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
              <Link
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#7FE0B8] px-5 py-2.5 text-sm font-semibold text-[#0E1214] transition hover:bg-[#9BEBC9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7FE0B8]"
                href={workspaceHref}
              >
                <Play aria-hidden="true" fill="currentColor" size={14} />
                {text.open}
              </Link>
              <p className="text-xs text-[var(--muted)] sm:ml-2">{formatMessage(text.openHint, { name })}</p>
            </div>
          </header>

          <section aria-labelledby="sent-by" className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
            <h2 className="text-base font-semibold" id="sent-by">
              {text.sentBy}
            </h2>
            <p className="mb-4 mt-1 text-xs text-[var(--muted)]">{text.sentByNote}</p>
            <blockquote cite={officialPseintUrl}>
              <SchoolDescription description={profile.description} />
            </blockquote>
          </section>

          <section aria-labelledby="summary" className="rounded-xl border border-[var(--accent-soft)] bg-[var(--accent-surface)] p-5 sm:p-6">
            <h2 className="text-base font-semibold" id="summary">
              {text.summaryTitle}
            </h2>
            {profile.differences.length ? (
              <>
                <p className="mt-1 text-sm text-white/75">{text.summaryIntro}</p>
                <ul className="mt-3 space-y-1.5">
                  {profile.differences.map((key) => (
                    <li className="flex gap-2 text-[15px] leading-6 text-white/90" key={key}>
                      <span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent-strong)]" />
                      {ruleState(copy, key, profile.settings[key], true)}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-2 text-[15px] text-white/85">{text.summaryNone}</p>
            )}
          </section>

          <section aria-labelledby="rules">
            <SectionHeading id="rules" intro={text.rulesIntro}>
              {text.rulesTitle}
            </SectionHeading>
            <div className="grid gap-4 sm:grid-cols-2">
              {RULE_GROUPS.map((group) => (
                <section aria-labelledby={`group-${group.id}`} className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5" key={group.id}>
                  <h3 className="text-base font-semibold" id={`group-${group.id}`}>
                    {copy.groups[group.id].title}
                  </h3>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">{copy.groups[group.id].intro}</p>
                  <dl className="mt-4 space-y-4">
                    {group.keys.map((key) => (
                      <div key={key}>
                        <dt className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-white/90">
                          {copy.rules[key].name}
                          {differences.has(key) ? (
                            <span
                              className="rounded-full border border-[#E8BE8C]/30 bg-[#E8BE8C]/10 px-2 py-px text-[11px] font-normal text-[#F0CFA6]"
                              title={text.differsLabel}
                            >
                              {text.differs}
                            </span>
                          ) : null}
                        </dt>
                        <dd className="mt-1 text-sm leading-6 text-[var(--muted)]">
                          <RichText text={ruleState(copy, key, profile.settings[key])} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
          </section>

          {example ? (
            <section aria-labelledby="example" className="space-y-6">
              <SectionHeading id="example" intro={text.exampleIntro}>
                {text.exampleTitle}
              </SectionHeading>
              <CodeBlock dictionary={dictionary} lines={highlightSource(example.source)} source={example.source} title={example.name} />
              <div>
                <h3 className="text-base font-semibold">{text.exampleOutput}</h3>
                <p className="mb-3 mt-0.5 text-sm text-[var(--muted)]">{formatMessage(text.exampleOutputIntro, { name })}</p>
                <pre
                  className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[#0E1113] px-4 py-3 text-[13px] leading-[1.65] text-[#D7DEDA]"
                  style={{ fontFamily: "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace" }}
                  tabIndex={0}
                >
                  <samp>{example.output.join("\n")}</samp>
                </pre>
              </div>
              <Link
                className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent-strong)] hover:underline"
                href={workspaceHref}
              >
                <Play aria-hidden="true" fill="currentColor" size={12} />
                {text.open}
              </Link>
            </section>
          ) : null}

          {twins.length ? (
            <section aria-labelledby="same-rules">
              <SectionHeading id="same-rules" intro={formatPlural(text.sameIntro, twins.length)}>
                {text.sameTitle}
              </SectionHeading>
              <ul className="flex flex-wrap gap-2">
                {twins.map((twin) => (
                  <li key={twin.id}>
                    <Link
                      className="inline-flex rounded-full border border-white/[0.1] bg-white/[0.03] px-3 py-1 text-sm text-white/80 transition hover:border-[var(--accent-soft)] hover:text-white"
                      href={profilePath(locale, twin.slug)}
                    >
                      {twin.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : similar.length ? (
            <section aria-labelledby="similar">
              <SectionHeading id="similar" intro={text.similarIntro}>
                {text.similarTitle}
              </SectionHeading>
              <ul className="grid gap-2 sm:grid-cols-2">
                {similar.map(({ profile: other, key }) => (
                  <li className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-4 py-3" key={other.id}>
                    <Link className="font-medium hover:text-[var(--accent-strong)] hover:underline" href={profilePath(locale, other.slug)}>
                      {other.label}
                    </Link>
                    <p className="mt-0.5 text-sm text-[var(--muted)]">
                      {formatMessage(text.similarItem, {
                        name: other.label,
                        rule: ruleState(copy, key, other.settings[key], true),
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="practice">
            <SectionHeading id="practice" intro={text.practiceIntro}>
              {text.practice}
            </SectionHeading>
            <ul className="grid gap-3 sm:grid-cols-3">
              {practiceExamples(profile).map((item) => (
                <ExampleCard dictionary={dictionary} example={item} key={item.id} locale={locale} />
              ))}
            </ul>
          </section>

          <nav aria-labelledby="next">
            <SectionHeading id="next" intro={text.nextIntro}>
              {text.nextTitle}
            </SectionHeading>
            <ul className="grid gap-3 sm:grid-cols-3">
              {[
                { href: indexHref, title: text.allProfiles, hint: text.allProfilesHint },
                { href: examplesIndexPath(locale), title: text.examples, hint: text.examplesHint },
                { href: sectionPath(locale, "reference"), title: text.reference, hint: text.referenceHint },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    className="flex h-full flex-col gap-1 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 transition hover:border-[var(--accent-soft)]"
                    href={link.href}
                  >
                    <span className="font-medium">{link.title} →</span>
                    <span className="text-sm text-[var(--muted)]">{link.hint}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <Credit copy={copy} />
        </article>
      </ExamplesShell>
    </main>
  );
}

/* ---------------- sitemap ---------------- */

/** Every profile URL (index and pages) in every locale; noindex pages are left out. */
export function profileSitemapEntries(): SitemapEntry[] {
  const pages: { pathFor: (locale: Locale) => string; priority: number }[] = [
    { pathFor: profilesIndexPath, priority: 0.8 },
    ...siteProfiles
      .filter((profile) => profile.indexable)
      .map((profile) => ({ pathFor: (locale: Locale) => profilePath(locale, profile.slug), priority: profile.general ? 0.6 : 0.5 })),
  ];
  return pages.flatMap(({ pathFor, priority }) => {
    const { languages } = pageAlternates("es", pathFor);
    return locales.map((locale) => ({
      url: absoluteUrl(pathFor(locale)),
      alternates: { languages },
      changeFrequency: "monthly" as const,
      priority,
    }));
  });
}
