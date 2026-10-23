import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

import type { Locale } from '@/src/i18n/config';
import type { Dictionary } from '@/src/i18n/types';
import { examplesIndexPath } from '@/src/lib/example-urls';
import { GitHubMark, LogoMark, REPOSITORY_URL } from '@/src/components/brand/logo-mark';

interface AboutShellProps {
  children: ReactNode;
  dictionary: Dictionary;
  locale: Locale;
}

// Re-themes the shared CSS variables so page content matches the dark workspace.
const darkTokens = {
  '--foreground': '#E6ECE9',
  '--muted': 'rgba(230, 236, 233, 0.5)',
  '--line': 'rgba(255, 255, 255, 0.08)',
  '--accent': '#7FE0B8',
  '--accent-strong': '#7FE0B8',
  '--accent-soft': 'rgba(127, 224, 184, 0.3)',
  '--accent-surface': 'rgba(127, 224, 184, 0.08)',
} as CSSProperties;

export default function AboutShell({ children, dictionary, locale }: AboutShellProps) {
  return (
    <div
      className="min-h-[100dvh] bg-[#141719] text-[var(--foreground)]"
      style={{ ...darkTokens, fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", var(--font-geist-sans), sans-serif' }}
    >
      <header className="sticky top-0 z-10 flex h-[34px] items-center gap-2 border-b border-black/40 bg-[#1D2124] px-3 shadow-[inset_0_-1px_0_rgba(255,255,255,0.04)]">
        <Link className="flex items-center gap-2 text-[13px] text-white/85 hover:text-white" href={`/${locale}`}>
          <LogoMark className="shrink-0" />
          {dictionary.metadata.siteName}
        </Link>
        <span className="text-white/25">/</span>
        <Link aria-current="page" className="text-[13px] text-white/50 hover:text-white/80" href={`/${locale}/about`}>
          {dictionary.appShell.about}
        </Link>
        <Link className="ml-auto text-[12px] text-white/55 hover:text-white" href={examplesIndexPath(locale)}>
          {dictionary.appShell.examples}
        </Link>
        <Link
          className="rounded-[6px] border border-white/[0.08] bg-black/20 px-2.5 py-0.5 text-[12px] text-white/70 hover:text-white"
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
      <div className="px-4 py-8 sm:px-8">{children}</div>
    </div>
  );
}
