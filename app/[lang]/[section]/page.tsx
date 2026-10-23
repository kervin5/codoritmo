import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { FeaturePage, featureMetadata } from '@/src/components/site/features';
import { ProfilesIndexPage, profilesIndexMetadata } from '@/src/components/site/profiles';
import { ReferenceIndexPage, referenceIndexMetadata } from '@/src/components/site/reference';
import { allSectionParams, resolveSection } from '@/src/seo/sections';
import { ExamplesIndexPage, examplesIndexMetadata } from './examples-index';

// /[lang]/<segment>: a section index (/es/ejemplos, /es/perfiles, /es/referencia)
// or a feature page (/es/pseint-online). See src/seo/sections.ts.
interface SectionPageProps {
  params: Promise<{ lang: string; section: string }>;
}

export const dynamicParams = false;

export function generateStaticParams({ params }: { params: { lang: string } }) {
  return allSectionParams(params.lang);
}

export async function generateMetadata(props: SectionPageProps): Promise<Metadata> {
  const { lang, section } = await props.params;
  const resolved = resolveSection(lang, section);
  if (!resolved) notFound();
  switch (resolved.kind) {
    case 'examples':
      return examplesIndexMetadata(props);
    case 'profiles':
      return profilesIndexMetadata(resolved.locale);
    case 'reference':
      return referenceIndexMetadata(resolved.locale);
    case 'feature':
      return featureMetadata(resolved.locale, resolved.feature);
  }
}

export default async function SectionPage(props: SectionPageProps) {
  const { lang, section } = await props.params;
  const resolved = resolveSection(lang, section);
  if (!resolved) notFound();
  switch (resolved.kind) {
    case 'examples':
      return ExamplesIndexPage(props);
    case 'profiles':
      return <ProfilesIndexPage locale={resolved.locale} />;
    case 'reference':
      return <ReferenceIndexPage locale={resolved.locale} />;
    case 'feature':
      return <FeaturePage id={resolved.feature} locale={resolved.locale} />;
  }
}
