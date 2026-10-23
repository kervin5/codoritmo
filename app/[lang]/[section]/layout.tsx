import { notFound } from 'next/navigation';

import { allSectionParams, resolveSection } from '@/src/seo/sections';

// Every public section and feature page under /[lang]. Only the segments in
// src/seo/sections.ts are generated, and nothing else is served.
export const dynamicParams = false;

export function generateStaticParams({ params }: { params: { lang: string } }) {
  return allSectionParams(params.lang);
}

export default async function SectionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string; section: string }>;
}) {
  const { lang, section } = await params;
  if (!resolveSection(lang, section)) notFound();
  return children;
}
