import { notFound } from 'next/navigation';

import { sectionLocale, sectionParams } from '@/src/components/examples-site/content';

// /es/ejemplos and /en/examples. Only each locale's own section name is
// generated, and nothing else is served: /en/ejemplos and /es/examples 404.
export const dynamicParams = false;

export function generateStaticParams({ params }: { params: { lang: string } }) {
  return sectionParams(params.lang);
}

export default async function ExamplesSectionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string; section: string }>;
}) {
  const { lang, section } = await params;
  if (!sectionLocale(lang, section)) notFound();
  return children;
}
