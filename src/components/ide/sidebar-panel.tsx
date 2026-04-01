'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';

import { colorForFlowEdgeKind, paletteForFlowNodeKind } from '@/src/diagram';
import type { EngineSettings } from '@/src/engine';
import { formatMessage } from '@/src/i18n/format';
import type { Dictionary } from '@/src/i18n/types';

import {
  getOperatorGroups,
  getStructureSnippets,
  type SnippetItem,
  type SnippetPreviewKind,
  type SnippetVariant,
} from './snippets';
import type { HelpContent } from './types';
import { AppIcon, SectionLabel, classes } from './ui';

interface GroupTone {
  badge: string;
  button: string;
  chip: string;
  dot: string;
  heading: string;
}

function wrapPreviewLabel(label: string, maxCharsPerLine = 16): string[] {
  const words = label.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return [];
  }

  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (candidate.length <= maxCharsPerLine || !currentLine) {
      currentLine = candidate;
      continue;
    }

    lines.push(currentLine);
    currentLine = word;

    if (lines.length === 2) {
      break;
    }
  }

  if (currentLine && lines.length < 2) {
    lines.push(currentLine);
  }

  if (lines.length === 2 && words.join(' ').length > `${lines[0]} ${lines[1]}`.trim().length) {
    lines[1] = lines[1].length > maxCharsPerLine - 1
      ? `${lines[1].slice(0, maxCharsPerLine - 2)}…`
      : `${lines[1]}…`;
  }

  return lines;
}

function PreviewText({
  color,
  lines,
  size = 13,
  x,
  y,
}: {
  color: string;
  lines: string[];
  size?: number;
  x: number;
  y: number;
}) {
  const lineHeight = size + 3;
  const startY = y - ((lines.length - 1) * lineHeight) / 2;

  return (
    <text
      fill={color}
      fontFamily="var(--font-geist-sans), sans-serif"
      fontSize={size}
      fontWeight="700"
      textAnchor="middle"
      x={x}
      y={startY}
    >
      {lines.map((line, index) => (
        <tspan dy={index === 0 ? 0 : lineHeight} key={`${line}-${index}`} x={x}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

function SnippetShapePreview({
  kind,
  label,
}: {
  kind: SnippetPreviewKind;
  label: string;
}) {
  const processPalette = paletteForFlowNodeKind('process');
  const ioPalette = paletteForFlowNodeKind('io');
  const decisionPalette = paletteForFlowNodeKind('decision');
  const loopPalette = paletteForFlowNodeKind('loop');
  const switchPalette = paletteForFlowNodeKind('switch');
  const loopEdge = colorForFlowEdgeKind('loop');
  const defaultEdge = colorForFlowEdgeKind('default');
  const labelLines = wrapPreviewLabel(label, kind === 'repeat-loop' ? 14 : 16);

  const baseLineProps = {
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 2,
  };

  if (kind === 'io') {
    return (
      <div className="flex justify-center px-2 py-1">
        <svg
          aria-hidden="true"
          className="h-[108px] w-[188px]"
          data-shape="io"
          viewBox="0 0 188 108"
        >
          <polygon
            fill={ioPalette.fill}
            points="34,18 170,18 154,90 18,90"
            stroke={ioPalette.stroke}
            strokeWidth="2"
          />
          <PreviewText color={ioPalette.text} lines={labelLines} size={12.5} x={94} y={54} />
        </svg>
      </div>
    );
  }

  if (kind === 'process') {
    return (
      <div className="flex justify-center px-2 py-1">
        <svg
          aria-hidden="true"
          className="h-[108px] w-[188px]"
          data-shape="process"
          viewBox="0 0 188 108"
        >
          <rect
            fill={processPalette.fill}
            height="68"
            rx="18"
            stroke={processPalette.stroke}
            strokeWidth="2"
            width="156"
            x="16"
            y="20"
          />
          <PreviewText color={processPalette.text} lines={labelLines} x={94} y={54} />
        </svg>
      </div>
    );
  }

  if (kind === 'decision') {
    return (
      <div className="flex justify-center px-2 py-1">
        <svg
          aria-hidden="true"
          className="h-[112px] w-[188px]"
          data-shape="decision"
          viewBox="0 0 188 112"
        >
          <polygon
            fill={decisionPalette.fill}
            points="94,10 168,56 94,102 20,56"
            stroke={decisionPalette.stroke}
            strokeWidth="2"
          />
          <path d="M94 102 V110" stroke={defaultEdge} strokeWidth="2" />
          <path d="M20 56 H10" stroke={defaultEdge} strokeWidth="2" />
          <path d="M168 56 H178" stroke={defaultEdge} strokeWidth="2" />
          <PreviewText color={decisionPalette.text} lines={labelLines} size={12.5} x={94} y={56} />
        </svg>
      </div>
    );
  }

  if (kind === 'switch') {
    return (
      <div className="flex justify-center px-2 py-1">
        <svg
          aria-hidden="true"
          className="h-[114px] w-[188px]"
          data-shape="switch"
          viewBox="0 0 188 114"
        >
          <polygon
            fill={switchPalette.fill}
            points="36,16 152,16 174,48 152,80 36,80 14,48"
            stroke={switchPalette.stroke}
            strokeWidth="2"
          />
          <path d="M94 80 V92" stroke={defaultEdge} strokeWidth="2" />
          <path d="M54 92 V104" stroke={defaultEdge} strokeLinecap="round" strokeOpacity={0.55} strokeWidth="1.75" />
          <path d="M94 92 V106" stroke={defaultEdge} strokeLinecap="round" strokeOpacity={0.75} strokeWidth="2" />
          <path d="M134 92 V104" stroke={defaultEdge} strokeLinecap="round" strokeOpacity={0.55} strokeWidth="1.75" />
          <PreviewText color={switchPalette.text} lines={labelLines} size={12.5} x={94} y={48} />
        </svg>
      </div>
    );
  }

  if (kind === 'while-loop' || kind === 'for-loop') {
    return (
      <div className="flex justify-center px-2 py-1">
        <svg
          aria-hidden="true"
          className="h-[122px] w-[188px]"
          data-shape={kind}
          viewBox="0 0 188 122"
        >
          <rect
            fill={loopPalette.fill}
            height="34"
            rx="18"
            stroke={loopPalette.stroke}
            strokeWidth="2"
            width="132"
            x="28"
            y="10"
          />
          <rect
            fill={processPalette.fill}
            height="26"
            rx="12"
            stroke={processPalette.stroke}
            strokeWidth="2"
            width="100"
            x="44"
            y="62"
          />
          <path
            {...baseLineProps}
            d="M94 44 V62"
            stroke={defaultEdge}
          />
          <path
            {...baseLineProps}
            d="M44 75 H24 V27 H28"
            stroke={loopEdge}
            strokeDasharray="7 6"
          />
          <path
            {...baseLineProps}
            d="M160 27 H176 V92"
            stroke={defaultEdge}
          />
          <PreviewText color={loopPalette.text} lines={labelLines} size={12} x={94} y={27} />
          <PreviewText color={processPalette.text} lines={['...']} size={12} x={94} y={75} />
        </svg>
      </div>
    );
  }

  return (
    <div className="flex justify-center px-2 py-1">
      <svg
        aria-hidden="true"
        className="h-[144px] w-[188px]"
        data-shape="repeat-loop"
        viewBox="0 0 188 144"
      >
        <rect
          fill={loopPalette.fill}
          height="32"
          rx="18"
          stroke={loopPalette.stroke}
          strokeWidth="2"
          width="128"
          x="30"
          y="8"
        />
        <rect
          fill={processPalette.fill}
          height="24"
          rx="12"
          stroke={processPalette.stroke}
          strokeWidth="2"
          width="98"
          x="45"
          y="58"
        />
        <polygon
          fill={decisionPalette.fill}
          points="94,94 136,120 94,146 52,120"
          stroke={decisionPalette.stroke}
          strokeWidth="2"
          transform="translate(0 -14)"
        />
        <path
          {...baseLineProps}
          d="M94 40 V58"
          stroke={defaultEdge}
        />
        <path
          {...baseLineProps}
          d="M94 82 V92"
          stroke={defaultEdge}
        />
        <path
          {...baseLineProps}
          d="M52 106 H26 V24 H30"
          stroke={loopEdge}
          strokeDasharray="7 6"
        />
        <path
          {...baseLineProps}
          d="M136 106 H174 V132"
          stroke={defaultEdge}
        />
        <PreviewText color={loopPalette.text} lines={labelLines} size={12} x={94} y={24} />
        <PreviewText color={processPalette.text} lines={['...']} size={12} x={94} y={71} />
        <PreviewText color={decisionPalette.text} lines={['Condicion']} size={11.5} x={94} y={106} />
      </svg>
    </div>
  );
}

function getGroupTone(groupId: string): GroupTone {
  switch (groupId) {
    case 'structures':
      return {
        badge: 'border border-[rgba(136,179,105,0.24)] bg-[rgba(136,179,105,0.14)] text-[var(--mint-strong)]',
        button: 'border-[rgba(76,65,49,0.1)] bg-[rgba(255,252,247,0.9)] hover:border-[rgba(136,179,105,0.38)] hover:bg-[rgba(255,255,255,0.98)]',
        chip: 'border-[rgba(76,65,49,0.1)] bg-[rgba(255,252,247,0.92)] hover:border-[rgba(136,179,105,0.34)] hover:bg-[rgba(255,255,255,0.98)]',
        dot: 'bg-[var(--mint)]',
        heading: 'text-[var(--mint-strong)]',
      };
    case 'algebraic':
      return {
        badge: 'border border-[rgba(203,151,72,0.24)] bg-[rgba(203,151,72,0.14)] text-[var(--amber-strong)]',
        button: 'border-[rgba(76,65,49,0.1)] bg-[rgba(255,252,247,0.9)] hover:border-[rgba(203,151,72,0.36)] hover:bg-[rgba(255,255,255,0.98)]',
        chip: 'border-[rgba(76,65,49,0.1)] bg-[rgba(255,252,247,0.92)] hover:border-[rgba(203,151,72,0.34)] hover:bg-[rgba(255,255,255,0.98)]',
        dot: 'bg-[var(--amber)]',
        heading: 'text-[var(--amber-strong)]',
      };
    case 'logical':
      return {
        badge: 'border border-[rgba(120,174,177,0.24)] bg-[rgba(120,174,177,0.14)] text-[var(--cyan-strong)]',
        button: 'border-[rgba(76,65,49,0.1)] bg-[rgba(255,252,247,0.9)] hover:border-[rgba(120,174,177,0.36)] hover:bg-[rgba(255,255,255,0.98)]',
        chip: 'border-[rgba(76,65,49,0.1)] bg-[rgba(255,252,247,0.92)] hover:border-[rgba(120,174,177,0.34)] hover:bg-[rgba(255,255,255,0.98)]',
        dot: 'bg-[var(--cyan)]',
        heading: 'text-[var(--cyan-strong)]',
      };
    case 'relational':
      return {
        badge: 'border border-[rgba(220,142,111,0.24)] bg-[rgba(220,142,111,0.14)] text-[var(--coral-strong)]',
        button: 'border-[rgba(76,65,49,0.1)] bg-[rgba(255,252,247,0.9)] hover:border-[rgba(220,142,111,0.36)] hover:bg-[rgba(255,255,255,0.98)]',
        chip: 'border-[rgba(76,65,49,0.1)] bg-[rgba(255,252,247,0.92)] hover:border-[rgba(220,142,111,0.34)] hover:bg-[rgba(255,255,255,0.98)]',
        dot: 'bg-[var(--coral)]',
        heading: 'text-[var(--coral-strong)]',
      };
    case 'math':
      return {
        badge: 'border border-[var(--accent-soft)] bg-[var(--accent-surface)] text-[var(--accent-strong)]',
        button: 'border-[rgba(76,65,49,0.1)] bg-[rgba(255,252,247,0.9)] hover:border-[rgba(47,129,107,0.34)] hover:bg-[rgba(255,255,255,0.98)]',
        chip: 'border-[rgba(76,65,49,0.1)] bg-[rgba(255,252,247,0.92)] hover:border-[rgba(47,129,107,0.3)] hover:bg-[rgba(255,255,255,0.98)]',
        dot: 'bg-[var(--accent)]',
        heading: 'text-[var(--accent-strong)]',
      };
    case 'strings':
      return {
        badge: 'border border-[rgba(200,140,163,0.24)] bg-[rgba(200,140,163,0.14)] text-[var(--pink-strong)]',
        button: 'border-[rgba(76,65,49,0.1)] bg-[rgba(255,252,247,0.9)] hover:border-[rgba(200,140,163,0.34)] hover:bg-[rgba(255,255,255,0.98)]',
        chip: 'border-[rgba(76,65,49,0.1)] bg-[rgba(255,252,247,0.92)] hover:border-[rgba(200,140,163,0.32)] hover:bg-[rgba(255,255,255,0.98)]',
        dot: 'bg-[var(--pink)]',
        heading: 'text-[var(--pink-strong)]',
      };
    default:
      return {
        badge: 'border border-[rgba(203,151,72,0.24)] bg-[rgba(203,151,72,0.14)] text-[var(--amber-strong)]',
        button: 'border-[rgba(76,65,49,0.1)] bg-[rgba(255,252,247,0.9)] hover:border-[rgba(203,151,72,0.36)] hover:bg-[rgba(255,255,255,0.98)]',
        chip: 'border-[rgba(76,65,49,0.1)] bg-[rgba(255,252,247,0.92)] hover:border-[rgba(203,151,72,0.34)] hover:bg-[rgba(255,255,255,0.98)]',
        dot: 'bg-[var(--amber)]',
        heading: 'text-[var(--amber-strong)]',
      };
  }
}

function SnippetButton({
  compact = false,
  dictionary,
  item,
  onInsert,
  onPreview,
  onPreviewEnd,
  tone,
}: {
  compact?: boolean;
  dictionary: Dictionary;
  item: SnippetItem;
  onInsert: (item: { help: HelpContent; placeholder?: string; text: string }) => void;
  onPreview: (
    preview: {
      help: HelpContent;
      previewKind?: SnippetPreviewKind;
      previewLabel?: string;
    },
    target: HTMLElement,
  ) => void;
  onPreviewEnd: () => void;
  tone: GroupTone;
}) {
  const [showVariants, setShowVariants] = useState(false);
  const itemTitle = `${item.help.title}: ${item.help.body}`;

  const handleVariantInsert = (variant: SnippetVariant, target: HTMLElement) => {
    onPreview({
      help: variant.help,
      previewKind: variant.previewKind,
      previewLabel: variant.previewLabel,
    }, target);
    onInsert({
      text: variant.insertText,
      placeholder: variant.placeholder,
      help: variant.help,
    });
    setShowVariants(false);
  };

  return (
    <div className="relative">
      <div className="flex gap-1.5">
        <button
          aria-label={item.label}
          className={classes(
            'min-w-0 flex-1 rounded-[11px] border px-2.5 py-2 text-left text-[13px] font-medium leading-snug tracking-[-0.015em] text-[var(--foreground)] transition',
            compact
              ? 'border-[rgba(76,65,49,0.1)] bg-[rgba(255,252,247,0.85)] py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]'
              : 'shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]',
            !compact ? 'active:scale-[0.998]' : '',
            tone.button,
          )}
          onBlur={compact ? undefined : onPreviewEnd}
          onClick={(event) => {
            if (!compact) {
              onPreview({
                help: item.help,
                previewKind: item.previewKind,
                previewLabel: item.previewLabel,
              }, event.currentTarget);
            }
            onInsert({
              text: item.insertText,
              placeholder: item.placeholder,
              help: item.help,
            });
          }}
          onFocus={compact ? undefined : (event) => onPreview({
            help: item.help,
            previewKind: item.previewKind,
            previewLabel: item.previewLabel,
          }, event.currentTarget)}
          onMouseEnter={compact ? undefined : (event) => onPreview({
            help: item.help,
            previewKind: item.previewKind,
            previewLabel: item.previewLabel,
          }, event.currentTarget)}
          onMouseLeave={compact ? undefined : onPreviewEnd}
          style={compact ? { touchAction: "manipulation" } : undefined}
          title={itemTitle}
          type="button"
        >
          {compact ? (
            /* Compact (mobile): badge + label row, description wraps below */
            <>
              <span className="flex items-center gap-2.5">
                <span className={classes(
                  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] text-[10px] font-bold uppercase tracking-[0.06em]',
                  tone.badge,
                )}>
                  {item.label.slice(0, 2)}
                </span>
                <span className="font-semibold tracking-[-0.02em]">{item.label}</span>
              </span>
              {item.help.body ? (
                <p className="mt-2 text-[12px] font-normal leading-[1.45] text-[var(--muted)]">
                  {item.help.body}
                </p>
              ) : null}
            </>
          ) : (
            /* Desktop: single-row with badge and truncated label */
            <span className="flex min-w-0 items-center gap-2.5">
              <span className={classes(
                'inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-[9px] px-1.5 text-[10px] font-bold uppercase tracking-[0.06em]',
                tone.badge,
              )}>
                {item.label.slice(0, 2)}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px]">{item.label}</span>
            </span>
          )}
        </button>

        {item.variants && item.variants.length > 0 ? (
          <button
            aria-expanded={showVariants}
            aria-label={formatMessage(dictionary.sidebar.moreVariations, { label: item.label })}
            className={classes(
              'inline-flex h-[2.125rem] w-9 shrink-0 items-center justify-center rounded-[11px] border border-[rgba(76,65,49,0.1)] bg-[rgba(255,252,247,0.85)] text-[var(--muted)] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] transition hover:border-[rgba(76,65,49,0.14)] hover:bg-[rgba(255,255,255,0.92)] hover:text-[var(--foreground)]',
              showVariants && 'border-[rgba(76,65,49,0.14)] bg-[rgba(255,255,255,0.95)] text-[var(--foreground)]',
            )}
            onClick={() => setShowVariants((current) => !current)}
            type="button"
          >
            <AppIcon
              className={classes('h-4 w-4 transition-transform duration-200', showVariants && 'rotate-180')}
              name="chevron-down"
            />
          </button>
        ) : null}
      </div>

      {showVariants && item.variants ? (
        <div className="absolute left-0 top-[calc(100%+0.45rem)] z-20 flex min-w-[220px] flex-col gap-0.5 rounded-[12px] border border-[rgba(76,65,49,0.1)] bg-[rgba(252,249,242,0.99)] p-1.5 shadow-[0_14px_36px_rgba(43,36,28,0.1)]">
          {item.variants.map((variant) => (
            <button
              className="rounded-[9px] border border-transparent px-3 py-2.5 text-left text-[13px] font-medium leading-snug tracking-[-0.015em] text-[var(--foreground)] transition hover:border-[rgba(76,65,49,0.08)] hover:bg-[rgba(255,255,255,0.92)]"
              key={variant.id}
              onClick={(event) => handleVariantInsert(variant, event.currentTarget)}
              onBlur={onPreviewEnd}
              onFocus={(event) => onPreview({
                help: variant.help,
                previewKind: variant.previewKind,
                previewLabel: variant.previewLabel,
              }, event.currentTarget)}
              onMouseEnter={(event) => onPreview({
                help: variant.help,
                previewKind: variant.previewKind,
                previewLabel: variant.previewLabel,
              }, event.currentTarget)}
              onMouseLeave={onPreviewEnd}
              title={`${variant.help.title}: ${variant.help.body}`}
              type="button"
            >
              {variant.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface SidebarPanelProps {
  collapsibleDesktop?: boolean;
  compact?: boolean;
  dictionary: Dictionary;
  onInsertSnippet: (item: { help: HelpContent; placeholder?: string; text: string }) => void;
  onPreviewHelp: (help: HelpContent) => void;
  onRequestCollapse?: () => void;
  settings: EngineSettings;
}

interface PreviewState {
  help: HelpContent;
  placement: 'left' | 'right';
  previewKind?: SnippetPreviewKind;
  previewLabel?: string;
  x: number;
  y: number;
}

export default function SidebarPanel({
  collapsibleDesktop = false,
  compact = false,
  dictionary,
  onInsertSnippet,
  onPreviewHelp,
  onRequestCollapse,
  settings,
}: SidebarPanelProps) {
  const structureGroup = getStructureSnippets(settings, dictionary);
  const operatorGroups = getOperatorGroups(settings, dictionary);
  const structureTone = getGroupTone(structureGroup.id);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    [structureGroup.id]: true,
    algebraic: true,
    logical: true,
    relational: false,
    math: false,
    strings: false,
    constants: false,
  });
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);

  const showPreview = (
    preview: {
      help: HelpContent;
      previewKind?: SnippetPreviewKind;
      previewLabel?: string;
    },
    target: HTMLElement,
  ) => {
    onPreviewHelp(preview.help);

    if (compact) return;

    const rect = target.getBoundingClientRect();
    const previewWidth = 260;
    const viewportPadding = 20;
    const prefersLeft = window.innerWidth - rect.right < previewWidth + viewportPadding
      && rect.left > previewWidth + viewportPadding;
    const top = Math.min(
      window.innerHeight - viewportPadding,
      Math.max(viewportPadding, rect.top + rect.height / 2),
    );

    setPreviewState({
      help: preview.help,
      placement: prefersLeft ? 'left' : 'right',
      previewKind: preview.previewKind,
      previewLabel: preview.previewLabel,
      x: prefersLeft ? rect.left - 14 : rect.right + 14,
      y: top,
    });
  };

  const hidePreview = () => {
    setPreviewState(null);
  };

  return (
    <div className="surface-enter flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-4">
      {!compact ? (
        <div className="border-b border-[var(--line)] pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center rounded-full border border-[rgba(47,129,107,0.2)] bg-[rgba(47,129,107,0.07)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--accent-strong)]">
                {dictionary.sidebar.sectionLabel}
              </span>
              <h2 className="mt-2.5 text-[15px] font-semibold tracking-[-0.02em] text-[var(--foreground)]">
                {dictionary.sidebar.title}
              </h2>
              <p className="mt-2 text-[13px] leading-6 text-[var(--muted)]">
                {dictionary.sidebar.description}
              </p>
            </div>
            {collapsibleDesktop && onRequestCollapse ? (
              <button
                aria-label={dictionary.sidebar.collapsePanel}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] border border-[rgba(76,65,49,0.1)] bg-[rgba(255,252,247,0.9)] text-[var(--muted)] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] transition hover:border-[rgba(76,65,49,0.14)] hover:bg-[rgba(43,36,28,0.04)] hover:text-[var(--foreground)] active:scale-[0.97]"
                onClick={onRequestCollapse}
                title={dictionary.sidebar.collapsePanel}
                type="button"
              >
                <AppIcon className="h-4 w-4 rotate-180" name="chevron-left" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={classes("relative min-h-0 flex-1", !compact && "mt-4")}>
        <div
          className="min-h-0 h-full overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable]"
          onScroll={hidePreview}
        >
          <section className="rounded-[14px] border border-[rgba(76,65,49,0.1)] bg-[rgba(255,252,247,0.88)] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
            <button
              className="flex w-full items-center justify-between gap-2 rounded-[10px] -mx-1 px-2 py-2 text-left transition hover:bg-[rgba(43,36,28,0.045)]"
              onClick={() => {
                setOpenGroups((current) => ({
                  ...current,
                  [structureGroup.id]: !current[structureGroup.id],
                }));
              }}
              type="button"
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <span className={classes('h-2.5 w-2.5 shrink-0 rounded-full', structureTone.dot)} />
                <span className={classes('text-[13px] font-semibold tracking-[-0.02em]', structureTone.heading)}>
                  {structureGroup.title}
                </span>
              </span>
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-[var(--muted)] transition hover:bg-[rgba(43,36,28,0.07)] hover:text-[var(--foreground)]">
                <AppIcon
                  className="h-4 w-4"
                  name={openGroups[structureGroup.id] ? 'chevron-up' : 'chevron-down'}
                />
              </span>
            </button>

            {openGroups[structureGroup.id] ? (
              <div className="mt-2 flex flex-col gap-1.5 border-t border-[rgba(76,65,49,0.08)] pt-2.5">
                {structureGroup.items.map((item) => (
                  <SnippetButton
                    compact={compact}
                    dictionary={dictionary}
                    item={item}
                    key={item.id}
                    onInsert={onInsertSnippet}
                    onPreview={showPreview}
                    onPreviewEnd={hidePreview}
                    tone={structureTone}
                  />
                ))}
              </div>
            ) : null}
          </section>

          <div className="mt-4 grid gap-4">
            {operatorGroups.map((group) => (
              <section
                className="rounded-[14px] border border-[rgba(76,65,49,0.1)] bg-[rgba(255,252,247,0.88)] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] last:border-b"
                key={group.id}
              >
                <button
                  className="flex w-full items-center justify-between gap-2 rounded-[10px] -mx-1 px-2 py-2 text-left transition hover:bg-[rgba(43,36,28,0.045)]"
                  onClick={() => {
                    setOpenGroups((current) => ({
                      ...current,
                      [group.id]: !current[group.id],
                    }));
                  }}
                  type="button"
                >
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <span className={classes('h-2.5 w-2.5 shrink-0 rounded-full', getGroupTone(group.id).dot)} />
                    <span className={classes('text-[13px] font-semibold tracking-[-0.02em]', getGroupTone(group.id).heading)}>
                      {group.title}
                    </span>
                  </span>
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-[var(--muted)] transition hover:bg-[rgba(43,36,28,0.07)] hover:text-[var(--foreground)]">
                    <AppIcon
                      className="h-4 w-4"
                      name={openGroups[group.id] ? 'chevron-up' : 'chevron-down'}
                    />
                  </span>
                </button>

                {openGroups[group.id] ? (
                  <div className="mt-2 flex flex-wrap gap-1.5 border-t border-[rgba(76,65,49,0.08)] pt-2.5">
                    {group.items.map((item) => (
                      <button
                        className={classes(
                          'rounded-[10px] border text-[13px] font-medium tracking-[-0.015em] text-[var(--foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] transition',
                          compact ? 'px-3 py-2.5' : 'min-h-[2.125rem] px-3 py-2 hover:border-[rgba(76,65,49,0.14)]',
                          getGroupTone(group.id).chip,
                        )}
                        key={item.id}
                        onBlur={compact ? undefined : hidePreview}
                        onClick={(event) => {
                          if (!compact) showPreview({ help: item.help }, event.currentTarget);
                          onInsertSnippet({
                            text: item.insertText,
                            placeholder: item.placeholder,
                            help: item.help,
                          });
                        }}
                        onFocus={compact ? undefined : (event) => showPreview({ help: item.help }, event.currentTarget)}
                        onMouseEnter={compact ? undefined : (event) => showPreview({ help: item.help }, event.currentTarget)}
                        onMouseLeave={compact ? undefined : hidePreview}
                        style={compact ? { touchAction: "manipulation" } : undefined}
                        title={`${item.help.title}: ${item.help.body}`}
                        type="button"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </section>
            ))}
          </div>
        </div>

        {previewState && typeof document !== 'undefined' ? createPortal(
          <div
            className="pointer-events-none fixed z-[80] max-w-[272px] rounded-[14px] border border-[rgba(76,65,49,0.1)] bg-[rgba(255,252,247,0.98)] px-4 py-3 shadow-[0_14px_32px_rgba(43,36,28,0.08)] backdrop-blur-sm"
            data-testid="quick-help"
            style={{
              left: previewState.x,
              top: previewState.y,
              transform: previewState.placement === 'left'
                ? 'translate(-100%, -50%)'
                : 'translate(0, -50%)',
            }}
          >
            {previewState.previewKind && previewState.previewLabel ? (
              <div
                className="mb-3 rounded-[16px] border border-[rgba(76,65,49,0.08)] bg-[rgba(247,242,233,0.78)] px-3 py-3"
                data-kind={previewState.previewKind}
                data-testid="quick-help-preview"
              >
                <SnippetShapePreview
                  kind={previewState.previewKind}
                  label={previewState.previewLabel}
                />
              </div>
            ) : null}
            <SectionLabel>{dictionary.sidebar.details}</SectionLabel>
            <h3
              className="mt-2 text-sm font-semibold text-[var(--foreground)]"
              data-testid="quick-help-title"
            >
              {previewState.help.title}
            </h3>
            <p className="mt-1.5 text-sm leading-6 text-[var(--muted)]">
              {previewState.help.body}
            </p>
          </div>,
          document.body,
        ) : null}
      </div>
    </div>
  );
}
