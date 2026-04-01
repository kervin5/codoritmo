import type { ExampleProgram } from '@/src/engine';
import { formatCount } from '@/src/i18n/helpers';
import type { Dictionary } from '@/src/i18n/types';

import { AppIcon, SectionLabel, classes } from './ui';

interface LibrarySectionProps {
  dictionary: Dictionary;
  examples: ExampleProgram[];
  onClose: () => void;
  onOpenInWorkspace: (exampleId: string) => void;
  onPreviewExample: (exampleId: string | null) => void;
  previewExampleId: string | null;
  query: string;
  setQuery: (value: string) => void;
}

export default function LibrarySection({
  dictionary,
  examples,
  onClose,
  onOpenInWorkspace,
  onPreviewExample,
  previewExampleId,
  query,
  setQuery,
}: LibrarySectionProps) {
  const expandedExampleId = examples.some((example) => example.id === previewExampleId)
    ? previewExampleId
    : examples[0]?.id ?? null;

  return (
    <div className="surface-enter flex h-full min-h-0 flex-col overflow-hidden p-4">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] pb-4">
        <div>
          <SectionLabel>{dictionary.library.sectionLabel}</SectionLabel>
          <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">
            {dictionary.library.chooseExample}
          </h2>
        </div>

        <button
          aria-label={dictionary.library.close}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-[var(--line)] bg-[rgba(255,255,255,0.6)] text-[var(--muted)] transition hover:bg-[rgba(255,255,255,0.9)] hover:text-[var(--foreground)]"
          onClick={onClose}
          type="button"
        >
          <AppIcon className="h-4 w-4" name="close" />
        </button>
      </div>

      <label className="relative mt-4 block">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]">
          <AppIcon className="h-4 w-4" name="search" />
        </span>
        <input
          aria-label={dictionary.library.searchExamples}
          className="w-full rounded-full border border-[var(--line)] bg-[rgba(255,252,247,0.94)] py-3 pl-11 pr-4 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent-soft)] focus:ring-4 focus:ring-[var(--accent-surface)]"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={dictionary.library.searchExamples}
          value={query}
        />
      </label>

      <div className="mt-4 min-h-0 flex flex-1 flex-col gap-4">
        <div className="min-h-0 flex-1 overflow-auto rounded-[18px] border border-[var(--line)] bg-[rgba(255,251,246,0.9)] [scrollbar-gutter:stable]">
          {examples.length > 0 ? (
            <div className="divide-y divide-[var(--line)]">
              {examples.map((example) => (
                <div
                  className={classes(
                    'px-4 py-3 transition',
                    example.id === expandedExampleId
                      ? 'bg-[rgba(47,129,107,0.08)]'
                      : 'hover:bg-[rgba(224,177,63,0.08)]',
                  )}
                  key={example.id}
                >
                  <div className="flex items-start gap-3">
                    <button
                      aria-expanded={example.id === expandedExampleId}
                      className="min-w-0 flex-1 text-left"
                      onClick={() => onPreviewExample(example.id === expandedExampleId ? null : example.id)}
                      type="button"
                    >
                      <div className="flex items-center gap-3">
                        <p className="truncate text-sm font-medium text-[var(--foreground)]">{example.label}</p>
                        <span className="shrink-0 rounded-full border border-[var(--line)] bg-[rgba(255,255,255,0.82)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)]">
                          {formatCount(dictionary.library.lineCount, example.source.split('\n').length)}
                        </span>
                        <span className="ml-auto shrink-0 text-[var(--muted)]">
                          <AppIcon className="h-4 w-4" name={example.id === expandedExampleId ? 'chevron-up' : 'chevron-down'} />
                        </span>
                      </div>
                    </button>

                    <button
                      aria-label={`${dictionary.library.openInNewTab}: ${example.label}`}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[var(--muted)] transition hover:bg-[rgba(43,36,28,0.05)] hover:text-[var(--foreground)]"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenInWorkspace(example.id);
                      }}
                      title={dictionary.library.openInNewTab}
                      type="button"
                    >
                      <AppIcon className="h-4 w-4" name="open-tab" />
                    </button>
                  </div>

                  <div
                    className={classes(
                      'grid transition-[grid-template-rows,opacity,margin] duration-200 ease-out',
                      example.id === expandedExampleId
                        ? 'mt-2 grid-rows-[1fr] opacity-100'
                        : 'mt-0 grid-rows-[0fr] opacity-0',
                    )}
                  >
                    <div className="overflow-hidden">
                      <p className="pr-10 text-sm leading-6 text-[var(--muted)]">
                        {example.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[16px] border border-dashed border-[var(--line)] px-4 py-5 text-sm text-[var(--muted)]">
              {dictionary.library.noExamplesMatch}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
