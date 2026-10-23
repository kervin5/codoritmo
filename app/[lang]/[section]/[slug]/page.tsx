import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { hasProfile, ProfilePage, profileMetadata, profileSlugs } from '@/src/components/site/profiles';
import { hasReference, ReferencePage, referenceMetadata, referenceSlugs } from '@/src/components/site/reference';
import { locales } from '@/src/i18n/config';
import { allSectionParams, resolveSection } from '@/src/seo/sections';
import { ExamplePage, exampleMetadata, exampleStaticParams } from './example-page';

// /[lang]/<section>/<slug>: an example, a school profile or a reference entry.
interface ChildPageProps {
  params: Promise<{ lang: string; section: string; slug: string }>;
}

export const dynamicParams = false;

// Returns every full path (lang, section, slug) itself, like the og.png route next
// to it: the parent-to-child form isn't expanded reliably when one [section]
// segment serves several kinds of page.
export function generateStaticParams({ params }: { params: { lang?: string } }) {
  return locales
    .filter((locale) => !params?.lang || params.lang === locale)
    .flatMap((lang) =>
      allSectionParams(lang).flatMap(({ section }) => {
        const resolved = resolveSection(lang, section);
        if (!resolved) return [];
        const slugs =
          resolved.kind === 'examples'
            ? exampleStaticParams({ params: { lang, section } }).map((p) => p.slug)
            : resolved.kind === 'profiles'
              ? profileSlugs(resolved.locale)
              : resolved.kind === 'reference'
                ? referenceSlugs(resolved.locale)
                : [];
        return slugs.map((slug) => ({ lang, section, slug }));
      }),
    );
}

async function resolve(props: ChildPageProps) {
  const { lang, section, slug } = await props.params;
  const resolved = resolveSection(lang, section);
  if (!resolved || resolved.kind === 'feature') notFound();
  if (resolved.kind === 'profiles' && !hasProfile(resolved.locale, slug)) notFound();
  if (resolved.kind === 'reference' && !hasReference(resolved.locale, slug)) notFound();
  return { ...resolved, slug };
}

export async function generateMetadata(props: ChildPageProps): Promise<Metadata> {
  const page = await resolve(props);
  if (page.kind === 'profiles') return profileMetadata(page.locale, page.slug);
  if (page.kind === 'reference') return referenceMetadata(page.locale, page.slug);
  return exampleMetadata(props);
}

export default async function ChildPage(props: ChildPageProps) {
  const page = await resolve(props);
  if (page.kind === 'profiles') return <ProfilePage locale={page.locale} slug={page.slug} />;
  if (page.kind === 'reference') return <ReferencePage locale={page.locale} slug={page.slug} />;
  return ExamplePage(props);
}
