import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

import type { Locale } from '@/src/i18n/config';
import type { Dictionary } from '@/src/i18n/types';
import { examplesIndexPath } from '@/src/lib/example-urls';
import { featureIds, featurePath, sectionPath, type FeatureId, type SectionKind } from '@/src/seo/sections';
import { officialPseintUrl } from '@/src/seo/site';
import { GitHubMark, LogoMark, REPOSITORY_URL } from '@/src/components/brand/logo-mark';

import motionStyles from './motion.module.css';

interface ExamplesShellProps {
  children: ReactNode;
  dictionary: Dictionary;
  locale: Locale;
  /** The same page in the other locale (slugs differ per language). */
  alternateHref: string;
  /** True on the examples index itself, so its header link is marked as the current page. */
  isIndex?: boolean;
  /** The section this page belongs to, highlighted in the header. */
  section?: SectionKind;
}

// Navigation copy for the public pages' header and footer.
const NAV: Record<Locale, { sections: Record<SectionKind, string>; features: Record<FeatureId, string>; learn: string; tools: string; project: string; source: string; pseint: string }> = {
  es: {
    sections: { examples: 'Ejemplos', reference: 'Referencia', profiles: 'Perfiles' },
    features: {
      'pseint-online': 'PSeInt online',
      alternative: 'Alternativa a PSeInt',
      flowchart: 'Diagramas de flujo',
      'desk-check': 'Prueba de escritorio',
      'to-python': 'Pseudocódigo a Python',
      'to-c': 'Pseudocódigo a C',
      'to-java': 'Pseudocódigo a Java',
      blocks: 'Programar con bloques',
    },
    learn: 'Aprende',
    tools: 'Herramientas',
    project: 'Proyecto',
    source: 'Código fuente',
    pseint: 'PSeInt oficial',
  },
  en: {
    sections: { examples: 'Examples', reference: 'Reference', profiles: 'Profiles' },
    features: {
      'pseint-online': 'PSeInt online',
      alternative: 'PSeInt alternative',
      flowchart: 'Flowchart maker',
      'desk-check': 'Trace tables',
      'to-python': 'Pseudocode to Python',
      'to-c': 'Pseudocode to C',
      'to-java': 'Pseudocode to Java',
      blocks: 'Block-based programming',
    },
    learn: 'Learn',
    tools: 'Tools',
    project: 'Project',
    source: 'Source code',
    pseint: 'Official PSeInt',
  },
};

const sectionLabelsFor = (locale: Locale) => (['examples', 'reference', 'profiles'] as SectionKind[]).map((kind) => ({
  kind,
  href: kind === 'examples' ? examplesIndexPath(locale) : sectionPath(locale, kind),
  label: NAV[locale].sections[kind],
}));

// Same dark tokens as the about page, plus a few for code and cards.
const darkTokens = {
  '--foreground': '#E6ECE9',
  '--muted': 'rgba(230, 236, 233, 0.6)',
  '--line': 'rgba(255, 255, 255, 0.08)',
  '--accent': '#7FE0B8',
  '--accent-strong': '#7FE0B8',
  '--accent-soft': 'rgba(127, 224, 184, 0.3)',
  '--accent-surface': 'rgba(127, 224, 184, 0.08)',
  '--panel': '#1A1E21',
  '--panel-raised': '#1F2427',
} as CSSProperties;

export default function ExamplesShell({ children, dictionary, locale, alternateHref, isIndex = false, section }: ExamplesShellProps) {
  const text = dictionary.examplePages;
  const otherLocale: Locale = locale === 'es' ? 'en' : 'es';
  const nav = NAV[locale];
  const current: SectionKind | undefined = section ?? (isIndex ? 'examples' : undefined);

  return (
    <div
      className={`min-h-[100dvh] bg-[#141719] text-[var(--foreground)] ${motionStyles.site}`}
      style={{ ...darkTokens, fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", var(--font-geist-sans), sans-serif' }}
    >
      <a
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-2 focus:z-20 focus:rounded focus:bg-[#7FE0B8] focus:px-3 focus:py-1 focus:text-[#0E1214]"
        href="#contenido"
      >
        {text.skipToContent}
      </a>
      <header className="sticky top-0 z-10 flex h-[34px] items-center gap-2 border-b border-black/40 bg-[#1D2124] px-3 shadow-[inset_0_-1px_0_rgba(255,255,255,0.04)]">
        <Link className="flex shrink-0 items-center gap-2 text-[13px] text-white/85 hover:text-white" href={`/${locale}`}>
          <LogoMark className="shrink-0" />
          <span className="hidden sm:inline">{dictionary.metadata.siteName}</span>
        </Link>
        <nav aria-label={nav.learn} className="ml-1 flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none]">
          {sectionLabelsFor(locale).map(({ kind, href, label }) => (
            <Link
              key={kind}
              aria-current={current === kind ? (isIndex ? 'page' : 'true') : undefined}
              className={`shrink-0 rounded-[6px] px-2 py-0.5 text-[13px] transition-colors ${
                current === kind ? 'bg-white/[0.08] text-white' : 'text-white/55 hover:text-white/85'
              }`}
              href={href}
            >
              {label}
            </Link>
          ))}
        </nav>
        <Link
          className="ml-auto shrink-0 text-[12px] text-white/55 hover:text-white"
          href={alternateHref}
          hrefLang={otherLocale}
          lang={otherLocale}
          title={text.switchLanguage}
        >
          {text.otherLanguage}
        </Link>
        <Link className="hidden shrink-0 text-[12px] text-white/55 hover:text-white sm:inline" href={`/${locale}/about`}>
          {dictionary.appShell.about}
        </Link>
        <Link
          className="shrink-0 rounded-[6px] border border-white/[0.08] bg-black/20 px-2.5 py-0.5 text-[12px] text-white/70 hover:text-white"
          href={`/${locale}`}
        >
          {dictionary.appShell.workspace} →
        </Link>
        <a
          aria-label={dictionary.appShell.repository}
          className="grid h-[24px] w-[24px] shrink-0 place-items-center rounded-[6px] text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white"
          href={REPOSITORY_URL}
          rel="noopener noreferrer"
          target="_blank"
          title={dictionary.appShell.repository}
        >
          <GitHubMark size={14} />
        </a>
      </header>
      <div className={`px-4 pb-16 pt-6 sm:px-8 sm:pt-10 ${motionStyles.content}`} id="contenido">
        {children}
      </div>
      <footer className="border-t border-[var(--line)] px-4 py-10 sm:px-8">
        <nav aria-label={nav.project} className="mx-auto mb-10 grid max-w-[1080px] grid-cols-2 gap-8 text-sm sm:grid-cols-3">
          <div>
            <p className="font-medium text-white/85">{nav.learn}</p>
            <ul className="mt-3 space-y-2 text-[var(--muted)]">
              {sectionLabelsFor(locale).map(({ kind, href, label }) => (
                <li key={kind}>
                  <Link className="hover:text-white" href={href}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-medium text-white/85">{nav.tools}</p>
            <ul className="mt-3 space-y-2 text-[var(--muted)]">
              {featureIds.map((id) => (
                <li key={id}>
                  <Link className="hover:text-white" href={featurePath(locale, id)}>
                    {nav.features[id]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-medium text-white/85">{nav.project}</p>
            <ul className="mt-3 space-y-2 text-[var(--muted)]">
              <li>
                <Link className="hover:text-white" href={`/${locale}/about`}>
                  {dictionary.appShell.about}
                </Link>
              </li>
              <li>
                <a className="hover:text-white" href={REPOSITORY_URL} rel="noopener noreferrer" target="_blank">
                  {nav.source}
                </a>
              </li>
              <li>
                <a className="hover:text-white" href={officialPseintUrl} rel="noopener noreferrer" target="_blank">
                  {nav.pseint}
                </a>
              </li>
            </ul>
          </div>
        </nav>
        <div className="mx-auto flex max-w-[1080px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-base font-semibold">{text.footerCta}</p>
            <p className="mt-1 max-w-[60ch] text-sm text-[var(--muted)]">{text.footerCtaBody}</p>
          </div>
          <Link
            className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#7FE0B8] px-5 py-2.5 text-sm font-semibold text-[#0E1214] transition hover:bg-[#9BEBC9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7FE0B8]"
            href={`/${locale}`}
          >
            {dictionary.appShell.workspace} →
          </Link>
        </div>
      </footer>
    </div>
  );
}
