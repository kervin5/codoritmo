import type { ReactNode } from "react";

import type { Locale } from "@/src/i18n/config";
import type { Dictionary } from "@/src/i18n/types";

import BottomSheet from "./bottom-sheet";
import type { ShellPanel } from "./types";
import { AppIcon, RailButton, classes } from "./ui";

type AppNavigationItem = "about" | "workspace";

interface AppShellProps {
  activeNav: AppNavigationItem;
  activePanel: ShellPanel;
  children: ReactNode;
  dictionary: Dictionary;
  drawer?: ReactNode;
  /** When set (e.g. on About), Examples navigates here instead of toggling the panel. */
  examplesHref?: string;
  locale: Locale;
  onPanelChange: (panel: ShellPanel) => void;
  onSidebarToggle: () => void;
  /** Omit Examples in the rail (e.g. About layout). */
  showExamplesButton?: boolean;
  sidebarExpanded: boolean;
}

export default function AppShell({
  activeNav,
  activePanel,
  children,
  dictionary,
  drawer,
  examplesHref,
  locale,
  onPanelChange,
  onSidebarToggle,
  showExamplesButton = true,
  sidebarExpanded,
}: AppShellProps) {
  const hasDrawer = activePanel !== "none" && Boolean(drawer);
  const sidebarWidth = sidebarExpanded ? 224 : 76;
  const workspaceHref = `/${locale}`;
  const aboutHref = `/${locale}/about`;

  return (
    <div className="relative min-h-svh bg-[var(--background)]">
      <div className="flex h-svh min-h-0 w-full overflow-hidden">
        {/* Desktop left rail — hidden on mobile */}
        <aside
          className="surface-enter hidden shrink-0 flex-col gap-5 overflow-hidden border-r border-[rgba(0,0,0,0.12)] bg-[var(--accent-strong)] px-3 py-5 transition-[width] duration-300 ease-[cubic-bezier(0.22,0.84,0.28,1)] lg:flex lg:min-h-0"
          data-testid="app-rail"
          lang={locale}
          style={{ width: sidebarWidth }}
        >
          <div
            className={classes(
              "relative transition-all duration-300 ease-[cubic-bezier(0.22,0.84,0.28,1)]",
              sidebarExpanded
                ? "grid grid-cols-[44px_minmax(0,1fr)_36px] items-center gap-3"
                : "flex flex-col items-center gap-2.5"
            )}
          >
            <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-[rgba(255,255,255,0.12)] text-[#f4faf7]">
              <AppIcon className="h-5 w-5" name="spark" />
            </div>

            <div
              className={classes(
                "min-w-0 transition-[max-width,opacity,transform] duration-300 ease-out",
                sidebarExpanded
                  ? "max-w-full translate-x-0 opacity-100"
                  : "pointer-events-none max-h-0 max-w-0 -translate-x-2 overflow-hidden opacity-0",
              )}
            >
              <p className="truncate text-[15px] font-semibold tracking-[-0.03em] text-[#f4faf7]">
                Codoritmo
              </p>
              <p className="mt-0.5 hyphens-auto text-[11px] leading-snug text-[rgba(244,250,247,0.82)] [overflow-wrap:anywhere]">
                {dictionary.appShell.tagline}
              </p>
            </div>

            <button
              aria-label={
                sidebarExpanded
                  ? dictionary.appShell.collapseNavigation
                  : dictionary.appShell.expandNavigation
              }
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[#f4faf7] transition hover:bg-[rgba(255,255,255,0.12)] hover:text-white"
              onClick={onSidebarToggle}
              type="button"
            >
              <AppIcon
                className={classes(
                  "h-4 w-4 transition-transform duration-300 ease-out",
                  sidebarExpanded ? "rotate-0" : "rotate-180"
                )}
                name="chevron-left"
              />
            </button>
          </div>

          <div
            aria-hidden
            className="mx-0.5 h-px shrink-0 bg-[rgba(255,255,255,0.14)]"
          />

          <nav className="flex flex-col gap-0.5">
            {activeNav === "workspace" ? (
              <RailButton
                appearance={
                  activePanel === "examples"
                    ? "soft"
                    : "on"
                }
                expanded={sidebarExpanded}
                icon="workspace"
                label={dictionary.appShell.workspace}
                onClick={() => onPanelChange("none")}
                pageCurrent={activeNav === "workspace"}
              />
            ) : (
              <RailButton
                appearance="off"
                expanded={sidebarExpanded}
                href={workspaceHref}
                icon="workspace"
                label={dictionary.appShell.workspace}
                pageCurrent={false}
              />
            )}
            {showExamplesButton ? (
              examplesHref ? (
                <RailButton
                  appearance="off"
                  expanded={sidebarExpanded}
                  href={examplesHref}
                  icon="book"
                  label={dictionary.appShell.examples}
                  pageCurrent={false}
                />
              ) : (
                <RailButton
                  appearance={
                    activePanel === "examples" ? "on" : "off"
                  }
                  ariaPressed={activePanel === "examples"}
                  expanded={sidebarExpanded}
                  icon="book"
                  label={dictionary.appShell.examples}
                  onClick={() =>
                    onPanelChange(
                      activePanel === "examples" ? "none" : "examples"
                    )
                  }
                  pageCurrent={false}
                />
              )
            ) : null}
            <RailButton
              appearance={activeNav === "about" ? "on" : "off"}
              expanded={sidebarExpanded}
              href={aboutHref}
              icon="about"
              label={dictionary.appShell.about}
              pageCurrent={activeNav === "about"}
            />
          </nav>

          {process.env.NEXT_PUBLIC_GITHUB_URL && (
            <div className="mt-auto">
              <a
                href={process.env.NEXT_PUBLIC_GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={classes(
                  "flex items-center gap-3 rounded-[10px] py-2.5 text-[rgba(244,250,247,0.85)] transition hover:bg-[rgba(255,255,255,0.1)] hover:text-[#f4faf7]",
                  sidebarExpanded ? "justify-start px-2" : "justify-center px-0",
                )}
                aria-label="GitHub"
              >
                <svg
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    clipRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    fillRule="evenodd"
                  />
                </svg>
                {sidebarExpanded && (
                  <span className="text-sm font-medium text-[#f4faf7]">GitHub</span>
                )}
              </a>
            </div>
          )}
        </aside>

        {/* Desktop examples drawer — hidden on mobile */}
        {hasDrawer ? (
          <div
            className="hidden h-full min-h-0 w-[340px] shrink-0 flex-col border-r border-[var(--line)] bg-[rgba(244,238,228,0.94)] p-4 lg:flex"
            data-testid="examples-drawer-desktop"
          >
            {drawer}
          </div>
        ) : null}

        {/* Main content — pb-24 on mobile clears the floating pill nav */}
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-[rgba(248,244,236,0.88)] p-2 pb-24 lg:p-3 lg:pb-4">
          {children}
        </div>
      </div>

      {/* Mobile floating pill nav — hidden on desktop */}
      <nav
        aria-label="Main navigation"
        className="fixed inset-x-0 z-40 flex justify-center lg:hidden"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
      >
        <div className="flex items-center gap-0.5 rounded-[28px] border border-[rgba(126,107,75,0.14)] bg-[rgba(244,238,228,0.94)] px-1.5 py-1.5 shadow-[0_4px_24px_rgba(43,36,28,0.1)] backdrop-blur-xl">
          {/* Workspace */}
          {activeNav === "workspace" ? (
            <button
              aria-current="page"
              className="flex flex-col items-center gap-1 rounded-[20px] bg-[var(--accent)] px-4 py-2 text-white transition active:scale-95"
              onClick={() => onPanelChange("none")}
              type="button"
            >
              <AppIcon className="h-[18px] w-[18px]" name="workspace" />
              <span className="text-xs font-semibold leading-none">{dictionary.appShell.workspace}</span>
            </button>
          ) : (
            <a
              className="flex flex-col items-center gap-1 rounded-[20px] px-4 py-2 text-[rgba(43,36,28,0.45)] transition hover:text-[var(--foreground)] active:scale-95"
              href={workspaceHref}
            >
              <AppIcon className="h-[18px] w-[18px]" name="workspace" />
              <span className="text-xs font-semibold leading-none">{dictionary.appShell.workspace}</span>
            </a>
          )}

          {/* Examples */}
          {showExamplesButton ? (
            examplesHref ? (
              <a
                className="flex flex-col items-center gap-1 rounded-[20px] px-4 py-2 text-[rgba(43,36,28,0.45)] transition hover:text-[var(--foreground)] active:scale-95"
                href={examplesHref}
              >
                <AppIcon className="h-[18px] w-[18px]" name="book" />
                <span className="text-xs font-semibold leading-none">{dictionary.appShell.examples}</span>
              </a>
            ) : (
              <button
                aria-pressed={activePanel === "examples"}
                className={classes(
                  "flex flex-col items-center gap-1 rounded-[20px] px-4 py-2 transition active:scale-95",
                  activePanel === "examples"
                    ? "bg-[var(--accent)] text-white"
                    : "text-[rgba(43,36,28,0.45)] hover:text-[var(--foreground)]"
                )}
                onClick={() =>
                  onPanelChange(activePanel === "examples" ? "none" : "examples")
                }
                type="button"
              >
                <AppIcon className="h-[18px] w-[18px]" name="book" />
                <span className="text-xs font-semibold leading-none">{dictionary.appShell.examples}</span>
              </button>
            )
          ) : null}

          {/* About */}
          <a
            aria-current={activeNav === "about" ? "page" : undefined}
            className={classes(
              "flex flex-col items-center gap-1 rounded-[20px] px-4 py-2 transition active:scale-95",
              activeNav === "about"
                ? "bg-[var(--accent)] text-white"
                : "text-[rgba(43,36,28,0.45)] hover:text-[var(--foreground)]"
            )}
            href={aboutHref}
          >
              <AppIcon className="h-[18px] w-[18px]" name="about" />
              <span className="text-xs font-semibold leading-none">{dictionary.appShell.about}</span>
          </a>
        </div>
      </nav>

      {/* Mobile examples bottom sheet */}
      <div className="lg:hidden">
        <BottomSheet
          isOpen={activePanel === "examples" && Boolean(drawer)}
          onClose={() => onPanelChange("none")}
          title={dictionary.appShell.examples}
        >
          {drawer}
        </BottomSheet>
      </div>
    </div>
  );
}
