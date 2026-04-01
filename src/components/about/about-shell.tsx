'use client';

import { useState, type ReactNode } from 'react';

import type { Locale } from '@/src/i18n/config';
import type { Dictionary } from '@/src/i18n/types';
import { workspaceExamplesNewTabHref } from '@/src/lib/workspace-deeplink';

import AppShell from '../ide/app-shell';

interface AboutShellProps {
  children: ReactNode;
  dictionary: Dictionary;
  locale: Locale;
}

export default function AboutShell({
  children,
  dictionary,
  locale,
}: AboutShellProps) {
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  return (
    <AppShell
      activeNav="about"
      activePanel="none"
      dictionary={dictionary}
      examplesHref={workspaceExamplesNewTabHref(locale)}
      locale={locale}
      onPanelChange={() => {}}
      onSidebarToggle={() => setSidebarExpanded((current) => !current)}
      sidebarExpanded={sidebarExpanded}
    >
      {children}
    </AppShell>
  );
}
