import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ConceptPage, conceptMetadata, conceptSegment, conceptSlugs, hasConcept } from '@/src/components/site/concepts';
import { locales } from '@/src/i18n/config';
import { resolveSection, SECTION_SEGMENTS } from '@/src/seo/sections';
import { TopicPage, topicMetadata, topicStaticParams } from './topic-page';

// /es/ejemplos/tema/<tema> and /es/ejemplos/concepto/<concepto> (and their English twins).
interface GroupPageProps {
  params: Promise<{ lang: string; section: string; slug: string; topic: string }>;
}

export const dynamicParams = false;

// Full paths (lang, section, slug, topic), for the same reason as the [slug] page.
export function generateStaticParams({ params }: { params: { lang?: string } }) {
  return locales
    .filter((locale) => !params?.lang || params.lang === locale)
    .flatMap((lang) => {
      const section = SECTION_SEGMENTS.examples[lang];
      return [
        ...topicStaticParams({ params: { lang, section } }),
        ...conceptSlugs(lang).map((topic) => ({ slug: conceptSegment[lang], topic })),
      ].map((p) => ({ lang, section, ...p }));
    });
}

async function concept(props: GroupPageProps) {
  const { lang, section, slug, topic } = await props.params;
  const resolved = resolveSection(lang, section);
  if (!resolved || resolved.kind !== 'examples') notFound();
  if (slug !== conceptSegment[resolved.locale]) return null;
  if (!hasConcept(resolved.locale, topic)) notFound();
  return { locale: resolved.locale, slug: topic };
}

export async function generateMetadata(props: GroupPageProps): Promise<Metadata> {
  const page = await concept(props);
  return page ? conceptMetadata(page.locale, page.slug) : topicMetadata(props);
}

export default async function GroupPage(props: GroupPageProps) {
  const page = await concept(props);
  return page ? <ConceptPage locale={page.locale} slug={page.slug} /> : TopicPage(props);
}
