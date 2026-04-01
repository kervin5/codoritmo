import {
  AlertTriangle,
  BookOpen,
  Braces,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  ChevronsUpDown,
  CircleHelp,
  Code2,
  Download,
  ExternalLink,
  Info,
  Maximize2,
  Minimize2,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Terminal,
  Waypoints,
  X,
  Zap,
  PanelLeft,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

export type IconName =
  | 'alert'
  | 'about'
  | 'book'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-up'
  | 'close'
  | 'code'
  | 'collapse'
  | 'compress'
  | 'console'
  | 'diagram'
  | 'download'
  | 'edit'
  | 'expand'
  | 'help'
  | 'insert'
  | 'open-tab'
  | 'play'
  | 'plus'
  | 'reset'
  | 'search'
  | 'settings'
  | 'spark'
  | 'workspace';

const ICON_MAP: Record<IconName, LucideIcon> = {
  about:          Info,
  alert:          AlertTriangle,
  book:           BookOpen,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-up':   ChevronUp,
  close:          X,
  code:           Code2,
  collapse:       ChevronsUpDown,
  compress:       Minimize2,
  console:        Terminal,
  diagram:        Waypoints,
  download:       Download,
  edit:           Pencil,
  expand:         Maximize2,
  help:           CircleHelp,
  insert:         Braces,
  'open-tab':     ExternalLink,
  play:           Play,
  plus:           Plus,
  reset:          RotateCcw,
  search:         Search,
  settings:       SlidersHorizontal,
  spark:          Zap,
  workspace:      PanelLeft,
};

export function classes(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function AppIcon({
  className = 'h-5 w-5',
  name,
}: {
  className?: string;
  name: IconName;
}) {
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  return <Icon aria-hidden="true" className={className} strokeWidth={2} />;
}

export function Surface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={classes(
      'rounded-[24px] border border-[var(--line)] bg-[var(--panel)] shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_12px_28px_rgba(43,36,28,0.05)]',
      className,
    )}>
      {children}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-medium text-[var(--muted)]">
      {children}
    </p>
  );
}

export function StatusChip({
  label,
  tone = 'muted',
}: {
  label: string;
  tone?: 'accent' | 'ink' | 'muted' | 'success' | 'warning';
}) {
  const toneClass = tone === 'accent'
    ? 'border-[var(--accent-soft)] bg-[var(--accent-surface)] text-[var(--accent-strong)]'
    : tone === 'ink'
      ? 'border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-[rgba(238,243,236,0.72)]'
    : tone === 'success'
      ? 'border-[var(--accent-soft)] bg-[var(--accent-surface)] text-[var(--success-strong)]'
    : tone === 'warning'
        ? 'border-[var(--amber-soft)] bg-[var(--amber-surface)] text-[var(--warning-strong)]'
        : 'border-[var(--line)] bg-[rgba(255,255,255,0.82)] text-[var(--muted)]';

  return (
    <span className={classes(
        'inline-flex items-center rounded-[999px] border px-3 py-1 text-[11px] font-medium',
        toneClass,
      )}>
      {label}
    </span>
  );
}

export function ActionButton({
  ariaLabel,
  className,
  disabled = false,
  icon,
  iconOnly = false,
  label,
  onClick,
  title,
  tone = 'secondary',
}: {
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  icon?: IconName;
  iconOnly?: boolean;
  label: string;
  onClick: () => void;
  title?: string;
  tone?: 'ghost' | 'primary' | 'secondary' | 'success';
}) {
  const toneClass = tone === 'success'
    ? 'border border-[rgba(136,179,105,0.28)] bg-[var(--mint)] text-[#f7fbf7] shadow-[0_1px_0_rgba(255,255,255,0.16)_inset,0_8px_18px_rgba(136,179,105,0.18)] hover:bg-[var(--mint-strong)] hover:text-white'
    : tone === 'primary'
      ? 'border border-[rgba(47,129,107,0.3)] bg-[var(--accent)] text-[#f4faf7] shadow-[0_1px_0_rgba(255,255,255,0.16)_inset,0_8px_18px_rgba(47,129,107,0.2)] hover:bg-[var(--accent-strong)] hover:text-white'
      : tone === 'ghost'
      ? 'bg-transparent text-[var(--muted)] hover:bg-[rgba(43,36,28,0.05)] hover:text-[var(--foreground)]'
      : 'border border-[rgba(76,65,49,0.12)] bg-[rgba(255,252,247,0.92)] text-[var(--foreground)] shadow-[0_1px_0_rgba(255,255,255,0.78)_inset] hover:border-[rgba(47,129,107,0.2)] hover:bg-[rgba(255,255,255,0.98)]';

  return (
    <button
      aria-label={ariaLabel ?? (iconOnly ? label : undefined)}
      className={classes(
        'inline-flex items-center justify-center gap-2 rounded-[14px] text-sm font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-200 disabled:cursor-not-allowed disabled:opacity-50',
        iconOnly ? 'h-11 w-11 px-0 py-0' : 'px-4 py-2.5',
        toneClass,
        className,
      )}
      disabled={disabled}
      onClick={onClick}
      title={title ?? (iconOnly ? label : undefined)}
      type="button"
    >
      {icon ? <AppIcon className="h-4 w-4" name={icon} /> : null}
      {iconOnly ? <span className="sr-only">{label}</span> : label}
    </button>
  );
}

export function SelectField({
  ariaLabel,
  className,
  disabled = false,
  id,
  label,
  onChange,
  options,
  value,
  visibleLabel = true,
}: {
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
  visibleLabel?: boolean;
}) {
  return (
    <label className={classes('flex flex-col gap-2.5', className)}>
      {visibleLabel ? (
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
          {label}
        </span>
      ) : (
        <span className="sr-only">{label}</span>
      )}

      <span className={classes('relative block', disabled && 'opacity-70')}>
        <select
          aria-label={ariaLabel ?? label}
          className={classes(
            'h-12 w-full min-h-12 appearance-none rounded-[12px] border border-[rgba(76,65,49,0.14)] bg-[rgba(252,249,242,0.98)] py-2.5 pl-[18px] pr-12 text-[15px] font-medium leading-snug tracking-[-0.01em] text-[var(--foreground)]',
            'shadow-[inset_0_1px_0_rgba(255,255,255,0.92),inset_0_-1px_0_rgba(43,36,28,0.04)] outline-none transition-[border-color,background-color,box-shadow] duration-200',
            'hover:border-[rgba(76,65,49,0.22)] hover:bg-[rgba(255,253,248,0.99)]',
            'focus-visible:border-[rgba(47,129,107,0.45)] focus-visible:bg-white focus-visible:shadow-[inset_0_0_0_1px_rgba(47,129,107,0.12),0_0_0_3px_var(--accent-surface)]',
            'disabled:cursor-default disabled:border-[var(--line)] disabled:bg-[rgba(244,239,230,0.96)] disabled:text-[var(--muted)]',
          )}
          disabled={disabled}
          id={id}
          onChange={(event) => onChange(event.target.value)}
          value={value}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[rgba(55,48,38,0.42)]">
          <AppIcon className="h-[18px] w-[18px]" name="chevron-down" />
        </span>
      </span>
    </label>
  );
}

export function TabButton({
  active,
  icon,
  label,
  onClick,
  tone = 'neutral',
}: {
  active: boolean;
  icon?: IconName;
  label: string;
  onClick: () => void;
  tone?: 'amber' | 'coral' | 'cyan' | 'diagram' | 'export' | 'ink' | 'mint' | 'neutral' | 'output' | 'source' | 'violet';
}) {
  const activeToneClass = tone === 'ink'
    ? 'border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.08)] text-[var(--ink-contrast)] shadow-none'
    : tone === 'source'
    ? 'border border-[rgba(160,118,52,0.42)] bg-[var(--amber)] text-[rgba(255,251,244,0.98)] shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]'
    : tone === 'export'
    ? 'border border-[rgba(176,98,72,0.4)] bg-[var(--coral)] text-[rgba(255,248,244,0.98)] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
    : tone === 'diagram'
    ? 'border border-[rgba(36,96,80,0.45)] bg-[var(--accent)] text-[rgba(244,250,247,0.98)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]'
    : tone === 'violet'
    ? 'border border-[rgba(39,56,50,0.12)] bg-[rgba(255,252,247,0.98)] text-[var(--foreground)] shadow-[0_1px_0_rgba(255,255,255,0.88)_inset]'
    : tone === 'amber'
      ? 'border border-[rgba(160,118,52,0.42)] bg-[var(--amber)] text-[rgba(255,251,244,0.98)] shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]'
    : tone === 'cyan'
      ? 'border border-[var(--cyan-soft)] bg-[rgba(247,252,252,0.98)] text-[var(--cyan-strong)] shadow-[0_1px_0_rgba(255,255,255,0.88)_inset]'
      : tone === 'mint'
        ? 'border border-[var(--mint-soft)] bg-[rgba(248,252,244,0.98)] text-[var(--mint-strong)] shadow-[0_1px_0_rgba(255,255,255,0.88)_inset]'
        : tone === 'coral'
          ? 'border border-[var(--coral-soft)] bg-[rgba(255,247,242,0.98)] text-[var(--coral-strong)] shadow-[0_1px_0_rgba(255,255,255,0.88)_inset]'
          : tone === 'output'
            ? 'border border-[rgba(255,255,255,0.08)] bg-[var(--ink)] text-[var(--ink-contrast)] shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_8px_18px_rgba(12,16,15,0.22)]'
          : 'border border-[rgba(255,255,255,0.08)] bg-[var(--ink)] text-[var(--ink-contrast)]';
  const inactiveToneClass = tone === 'ink'
    ? 'border border-transparent bg-transparent text-[rgba(238,243,236,0.58)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--ink-contrast)]'
    : tone === 'source'
    ? 'border border-transparent bg-transparent text-[rgba(111,98,77,0.88)] hover:bg-[rgba(255,248,239,0.94)] hover:text-[var(--amber-strong)]'
    : tone === 'export'
    ? 'border border-transparent bg-transparent text-[rgba(111,98,77,0.88)] hover:bg-[rgba(255,243,237,0.92)] hover:text-[var(--coral-strong)]'
    : tone === 'diagram'
    ? 'border border-transparent bg-transparent text-[rgba(111,98,77,0.88)] hover:bg-[rgba(239,250,245,0.92)] hover:text-[var(--accent-strong)]'
    : tone === 'violet'
    ? 'border border-transparent bg-transparent text-[var(--muted)] hover:bg-[rgba(255,255,255,0.5)] hover:text-[var(--foreground)]'
    : tone === 'amber'
      ? 'border border-transparent bg-transparent text-[rgba(111,98,77,0.88)] hover:bg-[rgba(255,248,239,0.92)] hover:text-[var(--amber-strong)]'
    : tone === 'cyan'
      ? 'border border-transparent bg-transparent text-[var(--muted)] hover:bg-[rgba(247,252,252,0.9)] hover:text-[var(--cyan-strong)]'
      : tone === 'mint'
        ? 'border border-transparent bg-transparent text-[var(--muted)] hover:bg-[rgba(248,252,244,0.9)] hover:text-[var(--mint-strong)]'
        : tone === 'coral'
          ? 'border border-transparent bg-transparent text-[var(--muted)] hover:bg-[rgba(255,247,242,0.9)] hover:text-[var(--coral-strong)]'
          : tone === 'output'
            ? 'border border-transparent bg-transparent text-[rgba(41,38,31,0.62)] hover:bg-[rgba(23,27,26,0.08)] hover:text-[var(--foreground)]'
          : 'border border-transparent bg-transparent text-[var(--muted)] hover:bg-[rgba(43,36,28,0.05)] hover:text-[var(--foreground)]';

  return (
    <button
      className={classes(
        'inline-flex min-h-11 items-center gap-2 rounded-[11px] px-4 py-2 text-[13px] font-semibold tracking-[-0.02em] transition-[background-color,border-color,color,box-shadow,transform] duration-200',
        active ? activeToneClass : inactiveToneClass,
      )}
      data-active={active ? 'true' : 'false'}
      onClick={onClick}
      type="button"
    >
      {icon ? <AppIcon className="h-[17px] w-[17px] shrink-0 opacity-[0.92]" name={icon} /> : null}
      {label}
    </button>
  );
}

export function SegmentedControl({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={classes(
      'inline-flex items-center gap-0.5 rounded-[14px] border border-[rgba(76,65,49,0.12)] bg-[rgba(226,216,200,0.55)] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),inset_0_-1px_0_rgba(43,36,28,0.05)]',
      className,
    )}>
      {children}
    </div>
  );
}

/**
 * `on` — single primary highlight (current route or open panel).
 * `soft` — on workspace while Examples drawer is open (still this area, not competing with `on`).
 * `off` — default.
 */
export type RailNavAppearance = 'off' | 'on' | 'soft';

/** On dark accent rail — flat fills, minimal chrome. */
const RAIL_APPEAR: Record<RailNavAppearance, string> = {
  on: 'bg-[rgba(255,255,255,0.14)] text-[#f4faf7] font-semibold',
  soft: 'bg-transparent text-[#f4faf7] font-medium',
  off: 'text-[rgba(244,250,247,0.78)] hover:bg-[rgba(255,255,255,0.08)] hover:text-[#f4faf7]',
};

export function RailButton({
  appearance,
  ariaPressed,
  expanded = false,
  href,
  icon,
  label,
  onClick,
  pageCurrent,
}: {
  appearance: RailNavAppearance;
  ariaPressed?: boolean;
  expanded?: boolean;
  href?: string;
  icon: IconName;
  label: string;
  onClick?: () => void;
  /** Sets `aria-current="page"` (workspace home or about route). */
  pageCurrent?: boolean;
}) {
  const className = classes(
    'flex w-full min-h-10 items-center gap-2.5 rounded-[8px] py-1.5 transition-[background-color,color] duration-150 ease-out',
    expanded ? 'justify-start px-2' : 'justify-center px-0',
    RAIL_APPEAR[appearance],
  );
  const content = (
    <>
      <span className="inline-flex w-[22px] shrink-0 justify-center text-current">
        <AppIcon className="h-[17px] w-[17px]" name={icon} />
      </span>
      <span
        aria-hidden={expanded ? undefined : true}
        className={classes(
          'min-w-0 overflow-hidden text-left text-[13px] font-medium leading-snug tracking-[-0.02em] transition-[max-width,opacity,transform,padding] duration-200 ease-out',
          expanded
            ? 'max-w-[200px] flex-1 translate-x-0 opacity-100'
            : 'pointer-events-none w-0 max-w-0 flex-none -translate-x-1 opacity-0',
        )}
      >
        {label}
      </span>
    </>
  );

  if (href) {
    return (
      <Link
        aria-current={pageCurrent ? 'page' : undefined}
        aria-label={label}
        className={className}
        href={href}
        title={label}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      aria-current={pageCurrent ? 'page' : undefined}
      aria-label={label}
      aria-pressed={ariaPressed}
      className={className}
      onClick={onClick}
      title={label}
      type="button"
    >
      {content}
    </button>
  );
}

export function InputField({
  ariaLabel,
  children,
  label,
}: {
  ariaLabel?: string;
  children: ReactNode;
  label: string;
}) {
  return (
    <label aria-label={ariaLabel} className="flex flex-col gap-2">
      <span className="text-[11px] font-medium text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}
