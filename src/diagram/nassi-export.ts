// PNG/SVG export of a Nassi-Shneiderman diagram, on the same light, printable
// palette as the flowchart export (export.ts): each box takes the fill of its
// flowchart symbol, and the grid of boxes is drawn in one neutral ink.

import { svgToPngDataUrl } from './export';
import { EDGE_LABEL_FONT_SIZE, EXPORT_LABEL_FONT_FAMILY, LABEL_FONT_SIZE, LABEL_LINE_HEIGHT, type LabelToken } from './label';
import type { NassiCell, NassiRoutine, NassiText } from './nassi';
import {
  DIAGRAM_BACKGROUND_COLOR,
  DIAGRAM_LABEL_COLOR,
  LIGHT_TOKEN_COLORS,
  paletteForFlowNodeKind,
  tokenColor,
  type DiagramNodePalette,
} from './theme';

const EXPORT_PADDING = 40;

/** Ink of the box grid on paper, and the fill of an empty slot. */
export const NASSI_LIGHT_GRID = '#a8977a';
export const NASSI_LIGHT_EMPTY = '#fbf7f0';
/** Ink of the box grid on the dark workspace, and the fill of an empty slot. */
export const NASSI_DARK_GRID = '#3E494E';
export const NASSI_DARK_EMPTY = '#14181A';

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/** First baseline of a block of lines centred on `text.y` (dominant-baseline: central). */
export function nassiFirstLineY(text: NassiText): number {
  return text.y - ((text.lines.length - 1) * LABEL_LINE_HEIGHT) / 2;
}

function textMarkup(text: NassiText, palette: DiagramNodePalette, dx: number, dy: number): string {
  const first = nassiFirstLineY(text) + dy;
  return text.lines.map((line: LabelToken[], index) => {
    const spans = line
      .map((token) => `<tspan fill="${tokenColor(token.type, palette, LIGHT_TOKEN_COLORS)}"${token.type === 'keyword' ? ' font-weight="600"' : ''}>${escapeXml(token.text)}</tspan>`)
      .join('');
    return `<text x="${text.x + dx}" y="${first + index * LABEL_LINE_HEIGHT}" xml:space="preserve" font-family='${EXPORT_LABEL_FONT_FAMILY}' font-size="${LABEL_FONT_SIZE}" text-anchor="${text.anchor}" dominant-baseline="central">${spans}</text>`;
  }).join('');
}

function cellMarkup(cell: NassiCell, dx: number, dy: number): string {
  const palette = cell.tone ? paletteForFlowNodeKind(cell.tone) : null;
  const fill = palette?.fill ?? NASSI_LIGHT_EMPTY;
  const parts = [
    `<path d="${cell.outline}" transform="translate(${dx} ${dy})" fill="${fill}" stroke="${NASSI_LIGHT_GRID}" stroke-width="1.4" stroke-linejoin="round" />`,
  ];
  if (cell.details) {
    parts.push(`<path d="${cell.details}" transform="translate(${dx} ${dy})" fill="none" stroke="${NASSI_LIGHT_GRID}" stroke-width="1.4" />`);
  }
  if (cell.text && palette) parts.push(textMarkup(cell.text, palette, dx, dy));
  cell.tags?.forEach((tag) => {
    parts.push(`<text x="${tag.x + dx}" y="${tag.y + dy}" fill="${DIAGRAM_LABEL_COLOR}" font-family="Helvetica Neue, Arial, sans-serif" font-size="${EDGE_LABEL_FONT_SIZE}" font-weight="700" text-anchor="${tag.anchor}" dominant-baseline="central">${escapeXml(tag.text)}</text>`);
  });
  return `<g>${cell.title ? `<title>${escapeXml(cell.title)}</title>` : ''}${parts.join('')}</g>`;
}

export function exportNassiToSvg(routine: NassiRoutine) {
  const width = Math.ceil(routine.width + EXPORT_PADDING * 2);
  const height = Math.ceil(routine.height + EXPORT_PADDING * 2);
  const cells = routine.cells.map((cell) => cellMarkup(cell, EXPORT_PADDING, EXPORT_PADDING)).join('');
  // The outer frame is drawn last, a little heavier, so the routine reads as one block.
  const frame = `<rect x="${EXPORT_PADDING}" y="${EXPORT_PADDING}" width="${routine.width}" height="${routine.height}" fill="none" stroke="${NASSI_LIGHT_GRID}" stroke-width="2.2" />`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none"><title>${escapeXml(routine.label)}</title><rect width="${width}" height="${height}" fill="${DIAGRAM_BACKGROUND_COLOR}" />${cells}${frame}</svg>`;
  return { width, height, svg };
}

export async function exportNassiToPng(routine: NassiRoutine) {
  const { svg, width, height } = exportNassiToSvg(routine);
  const dataUrl = await svgToPngDataUrl(svg, width, height);
  return { dataUrl, width, height };
}
