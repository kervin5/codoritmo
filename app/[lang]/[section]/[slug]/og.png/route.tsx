import { ImageResponse } from 'next/og';

import { findExample, highlightSource, sectionLocale, type CodeToken, type CodeTokenType } from '@/src/components/examples-site/content';
import { examplePrograms } from '@/src/engine';
import { locales } from '@/src/i18n/config';
import { getDictionary } from '@/src/i18n/server';
import { exampleSlug, examplesSection } from '@/src/lib/example-urls';

// Per-example Open Graph image: /es/ejemplos/<slug>/og.png. Prerendered for
// every example, like the pages themselves.
export const dynamicParams = false;

export function generateStaticParams({ params }: { params: { lang?: string } }) {
  return locales
    .filter((locale) => !params?.lang || params.lang === locale)
    .flatMap((locale) =>
      examplePrograms.map((example) => ({
        lang: locale,
        section: examplesSection[locale],
        slug: exampleSlug(locale, example.id),
      })),
    );
}

const TOKEN_COLORS: Partial<Record<CodeTokenType, string>> = {
  keyword: '#8FD9B6',
  type: '#9CC4E4',
  string: '#E8BE8C',
  number: '#D2B3F2',
  operator: '#9AA6A1',
  punctuation: '#9AA6A1',
  comment: '#6E7B77',
};

const LEVEL_COLORS = { 1: '#7FE0B8', 2: '#E8BE8C', 3: '#D2B3F2' } as const;
const SNIPPET_LINES = 11;
const SNIPPET_COLUMNS = 40;

/** The first lines of the main Algoritmo/Proceso, without blanks, each clipped to fit the card. */
function snippet(source: CodeToken[][]): CodeToken[][] {
  const lineText = (tokens: CodeToken[]) => tokens.map((token) => token.text).join('');
  const main = source.findIndex((tokens) => /^\s*(algoritmo|proceso)\b/i.test(lineText(tokens)));
  return source
    .slice(Math.max(0, main))
    .filter((tokens) => lineText(tokens).trim() !== '')
    .slice(0, SNIPPET_LINES)
    .map((tokens) => {
      const clipped: CodeToken[] = [];
      let room = SNIPPET_COLUMNS;
      for (const token of tokens) {
        if (room <= 0) break;
        if (token.text.length <= room) {
          clipped.push(token);
          room -= token.text.length;
        } else {
          clipped.push({ ...token, text: `${token.text.slice(0, room - 1)}…` });
          room = 0;
        }
      }
      return clipped;
    });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lang: string; section: string; slug: string }> },
) {
  const { lang, section, slug } = await params;
  const locale = sectionLocale(lang, section);
  const example = locale ? findExample(locale, slug) : null;
  if (!locale || !example) return new Response('Not found', { status: 404 });

  const dictionary = await getDictionary(locale);
  const copy = dictionary.examples[example.id];
  const title = copy?.label ?? example.label;
  const topic = dictionary.studio.examples.topics[example.topic];
  const level = dictionary.studio.examples.levels[String(example.level) as '1' | '2' | '3'];
  const lines = snippet(highlightSource(example.source));

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#141719',
          color: '#E6ECE9',
          padding: '56px 64px',
          gap: '48px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', width: '470px', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '44px',
                  height: '44px',
                  borderRadius: '11px',
                  background: 'linear-gradient(135deg, #7FE0B8, #2F8F6E)',
                  color: '#0E1214',
                  fontSize: '26px',
                  fontWeight: 700,
                }}
              >
                C
              </div>
              <div style={{ display: 'flex', fontSize: '26px', color: 'rgba(230,236,233,0.85)' }}>
                {dictionary.metadata.siteName}
              </div>
            </div>
            <div style={{ display: 'flex', fontSize: '22px', color: '#7FE0B8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {dictionary.examplePages.ogTagline}
            </div>
            <div style={{ display: 'flex', fontSize: title.length > 26 ? '54px' : '64px', fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.03em' }}>
              {title}
            </div>
            <div style={{ display: 'flex', fontSize: '24px', lineHeight: 1.4, color: 'rgba(230,236,233,0.65)' }}>
              {copy?.description ?? example.description}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div
              style={{
                display: 'flex',
                padding: '8px 18px',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.15)',
                fontSize: '22px',
                color: 'rgba(230,236,233,0.85)',
              }}
            >
              {topic}
            </div>
            <div
              style={{
                display: 'flex',
                padding: '8px 18px',
                borderRadius: '999px',
                border: `1px solid ${LEVEL_COLORS[example.level]}`,
                fontSize: '22px',
                color: LEVEL_COLORS[example.level],
              }}
            >
              {level}
            </div>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            borderRadius: '18px',
            border: '1px solid rgba(255,255,255,0.08)',
            background: '#101315',
            padding: '26px 28px',
            gap: '4px',
            overflow: 'hidden',
          }}
        >
          {lines.map((tokens, index) => (
            <div key={index} style={{ display: 'flex', flexWrap: 'nowrap', overflow: 'hidden', fontSize: '21px', lineHeight: 1.5, whiteSpace: 'pre', color: '#E4EAE7' }}>
              {tokens.map((token, tokenIndex) => (
                <span key={tokenIndex} style={{ color: TOKEN_COLORS[token.type] ?? '#E4EAE7' }}>
                  {token.text}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
