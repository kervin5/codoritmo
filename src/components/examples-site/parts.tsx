// Server-rendered building blocks shared by the index, topic and example pages.

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

import type { ExampleProgram } from '@/src/engine';
import type { Locale } from '@/src/i18n/config';
import { formatPlural } from '@/src/i18n/format';
import type { Dictionary } from '@/src/i18n/types';
import { examplePath } from '@/src/lib/example-urls';
import { serializeJsonLd } from '@/src/seo/structured-data';

import CopyCodeButton from './copy-code-button';
import motionStyles from './motion.module.css';
import type { CodeToken, CodeTokenType, SampleRun } from './content';

export function JsonLd({ data }: { data: unknown }) {
  return <script dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} type="application/ld+json" />;
}

/* ---------------- breadcrumbs ---------------- */

export function Breadcrumbs({ items, label }: { items: { name: string; href?: string }[]; label: string }) {
  return (
    <nav aria-label={label}>
      <ol className="flex flex-wrap items-center gap-1 text-[13px] text-[var(--muted)]">
        {items.map((item, index) => (
          <li className="flex items-center gap-1" key={`${item.name}-${index}`}>
            {index > 0 ? <ChevronRight aria-hidden="true" className="text-white/25" size={13} /> : null}
            {item.href ? (
              <Link className="rounded hover:text-[var(--foreground)] hover:underline" href={item.href}>
                {item.name}
              </Link>
            ) : (
              <span aria-current="page" className="text-white/80">
                {item.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/* ---------------- chips ---------------- */

const LEVEL_STYLES: Record<1 | 2 | 3, string> = {
  1: 'border-[#7FE0B8]/30 bg-[#7FE0B8]/10 text-[#9BEBC9]',
  2: 'border-[#E8BE8C]/30 bg-[#E8BE8C]/10 text-[#F0CFA6]',
  3: 'border-[#D2B3F2]/30 bg-[#D2B3F2]/10 text-[#DEC6F6]',
};

export function LevelChip({ level, label }: { level: 1 | 2 | 3; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${LEVEL_STYLES[level]}`}>
      <span aria-hidden="true" className="flex gap-0.5">
        {[1, 2, 3].map((dot) => (
          <span className={`h-1.5 w-1.5 rounded-full ${dot <= level ? 'bg-current' : 'bg-current opacity-25'}`} key={dot} />
        ))}
      </span>
      {label}
    </span>
  );
}

export function Chip({ children, href }: { children: React.ReactNode; href?: string }) {
  const className =
    'inline-flex items-center rounded-full border border-white/[0.1] bg-white/[0.03] px-2.5 py-0.5 text-xs text-white/75';
  return href ? (
    <Link className={`${className} transition hover:border-[var(--accent-soft)] hover:text-white`} href={href}>
      {children}
    </Link>
  ) : (
    <span className={className}>{children}</span>
  );
}

/* ---------------- cards ---------------- */

export function ExampleCard({
  example,
  dictionary,
  locale,
  headingLevel = 3,
}: {
  example: ExampleProgram;
  dictionary: Dictionary;
  locale: Locale;
  headingLevel?: 2 | 3;
}) {
  const copy = dictionary.examples[example.id];
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <li className={`group relative flex flex-col gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 ${motionStyles.card} hover:border-[var(--accent-soft)] hover:bg-[var(--panel-raised)] has-[a:focus-visible]:outline has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-[#7FE0B8]`}>
      <Heading className="text-base font-semibold leading-snug tracking-[-0.01em]">
        <Link
          className="outline-none after:absolute after:inset-0 after:rounded-xl"
          href={examplePath(locale, example.id)}
        >
          {copy?.label ?? example.label}
        </Link>
      </Heading>
      <p className="text-sm leading-6 text-[var(--muted)]">{copy?.description ?? example.description}</p>
      <div className="mt-auto">
        <LevelChip label={dictionary.studio.examples.levels[String(example.level) as '1' | '2' | '3']} level={example.level} />
      </div>
    </li>
  );
}

/* ---------------- code ---------------- */

const TOKEN_CLASSES: Partial<Record<CodeTokenType, string>> = {
  keyword: 'text-[#8FD9B6] font-medium',
  type: 'text-[#9CC4E4]',
  string: 'text-[#E8BE8C]',
  number: 'text-[#D2B3F2]',
  operator: 'text-[#9AA6A1]',
  punctuation: 'text-[#9AA6A1]',
  comment: 'text-[#7C8985] italic',
};

export function CodeBlock({
  lines,
  source,
  title,
  dictionary,
}: {
  lines: CodeToken[][];
  source: string;
  title: string;
  dictionary: Dictionary;
}) {
  const text = dictionary.examplePages;
  return (
    <figure className="overflow-hidden rounded-xl border border-[var(--line)] bg-[#101315]">
      <figcaption className="flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[#171B1D] px-4 py-2">
        <span className="font-mono text-xs text-white/55">
          {title} · {formatPlural(text.lineCount, lines.length)}
        </span>
        <CopyCodeButton code={source} copiedLabel={text.codeCopied} failedLabel={text.copyFailed} label={text.copyCode} />
      </figcaption>
      <pre className="overflow-x-auto py-3 text-[13px] leading-[1.65]" style={{ fontFamily: 'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace' }} tabIndex={0}>
        <code className="grid">
          {lines.map((tokens, index) => (
            <span className="grid grid-cols-[3rem_1fr] hover:bg-white/[0.02]" key={index}>
              <span aria-hidden="true" className="select-none pr-4 text-right text-white/20">
                {index + 1}
              </span>
              <span className="whitespace-pre pr-4 text-[#E4EAE7]">
                {tokens.map((token, tokenIndex) =>
                  TOKEN_CLASSES[token.type] ? (
                    <span className={TOKEN_CLASSES[token.type]} key={tokenIndex}>
                      {token.text}
                    </span>
                  ) : (
                    token.text
                  ),
                )}
              </span>
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}

/* ---------------- sample run ---------------- */

export function Transcript({ run, dictionary }: { run: SampleRun; dictionary: Dictionary }) {
  const text = dictionary.examplePages;
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[#0E1113]">
      <pre
        className="max-h-[480px] overflow-auto px-4 py-3 text-[13px] leading-[1.65] text-[#D7DEDA]"
        data-testid="sample-run"
        style={{ fontFamily: 'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace' }}
        tabIndex={0}
      >
        <samp className="block">
          {run.lines.map((line, index) =>
            line.kind === 'in' ? (
              <kbd className="block font-[inherit] font-semibold text-[#7FE0B8]" key={index}>
                <span className="sr-only">{text.answer} </span>
                <span aria-hidden="true" className="select-none text-[#7FE0B8]/60">
                  {'> '}
                </span>
                {line.text}
              </kbd>
            ) : (
              <span className={`block whitespace-pre-wrap ${line.kind === 'err' ? 'text-[#F2A7A0]' : ''}`} key={index}>
                {line.text || ' '}
              </span>
            ),
          )}
        </samp>
      </pre>
      {run.truncated ? (
        <p className="border-t border-[var(--line)] px-4 py-2 text-xs text-[var(--muted)]">{text.outputTruncated}</p>
      ) : null}
    </div>
  );
}

/* ---------------- complexity ---------------- */

export function ComplexityTable({
  complexity,
  dictionary,
}: {
  complexity: NonNullable<ExampleProgram['complexity']>;
  dictionary: Dictionary;
}) {
  const labels = dictionary.studio.examples.complexity;
  const text = dictionary.examplePages;
  const rows: [string, string][] = [
    [labels.best, complexity.best],
    [labels.average, complexity.average],
    [labels.worst, complexity.worst],
    [labels.space, complexity.space],
  ];
  const traits = [
    complexity.stable === undefined ? null : complexity.stable ? labels.stable : labels.unstable,
    complexity.inPlace === undefined ? null : complexity.inPlace ? labels.inPlace : null,
  ].filter((trait): trait is string => trait !== null);

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-[var(--line)]">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{labels.label}</caption>
          <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
            <tr>
              <th className="px-4 py-2 font-medium" scope="col">
                {text.complexityCase}
              </th>
              <th className="px-4 py-2 font-medium" scope="col">
                {text.complexityCost}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, value]) => (
              <tr className="border-t border-[var(--line)]" key={label}>
                <th className="px-4 py-2 font-normal text-white/75" scope="row">
                  {label}
                </th>
                <td className="px-4 py-2 font-mono text-[#D2B3F2]">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {traits.length > 0 ? (
        <p className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
          <span>{text.traits}:</span>
          {traits.map((trait) => (
            <Chip key={trait}>{trait}</Chip>
          ))}
        </p>
      ) : null}
    </div>
  );
}

/* ---------------- section heading ---------------- */

export function SectionHeading({ id, children, intro }: { id: string; children: React.ReactNode; intro?: string }) {
  return (
    <div className="mb-4 space-y-1">
      <h2 className="text-xl font-semibold tracking-[-0.02em]" id={id}>
        {children}
      </h2>
      {intro ? <p className="max-w-[65ch] text-sm leading-6 text-[var(--muted)]">{intro}</p> : null}
    </div>
  );
}

