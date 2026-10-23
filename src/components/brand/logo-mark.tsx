import { useId } from "react";

/** The project's public repository. */
export const REPOSITORY_URL = "https://github.com/kervin5/codoritmo";

/**
 * Codoritmo's mark: a mint tile with a "C" drawn as a flow path (it starts at
 * a node and curves round) holding a play triangle, for code that runs.
 * Hook-free and CSS-free so next/og images can render it; `id` keeps the
 * gradient unique when several marks share a page. `square` drops the
 * rounded corners for icons the OS masks itself (apple-touch-icon).
 */
export function LogoArt({ size = 18, id = "logo", square = false, className }: { size?: number; id?: string; square?: boolean; className?: string }) {
  return (
    <svg aria-hidden className={className} height={size} viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#9AF5CF" />
          <stop offset="1" stopColor="#2F9472" />
        </linearGradient>
      </defs>
      <rect fill={`url(#${id}-fill)`} height="24" rx={square ? 0 : 6.5} width="24" />
      {!square && <rect fill="none" height="23" rx="6" stroke="#FFFFFF" strokeOpacity="0.22" width="23" x="0.5" y="0.5" />}
      <path d="M16.5 7.3 A6.3 6.3 0 1 0 16.5 16.7" fill="none" stroke="#0E1214" strokeLinecap="round" strokeWidth="2.4" />
      <circle cx="16.5" cy="7.3" fill="#0E1214" r="2.1" />
      <path d="M10.6 9.6 L14.4 12 L10.6 14.4 Z" fill="#0E1214" stroke="#0E1214" strokeLinejoin="round" strokeWidth="1" />
    </svg>
  );
}

/** The mark for app UI. */
export function LogoMark({ size = 18, className }: { size?: number; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return <LogoArt className={className} id={`logo${id}`} size={size} />;
}

/** GitHub's mark (lucide no longer ships brand icons). */
export function GitHubMark({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden className={className} fill="currentColor" height={size} viewBox="0 0 16 16" width={size}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
