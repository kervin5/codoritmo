// PNG/SVG export. Draws the same symbols (shapes.ts), the same wrapped and
// highlighted labels (label.ts) and the same connector routes (route.ts) as
// the live diagram, on a light, printable palette.

import {
  EDGE_LABEL_FONT_SIZE,
  EXPORT_LABEL_FONT_FAMILY,
  LABEL_FONT_SIZE,
  LABEL_LINE_HEIGHT,
  estimateEdgeLabelWidth,
} from './label';
import type { PositionedFlowEdge, PositionedFlowNode, PositionedFlowRoutineDiagram } from './layout';
import type { FlowEdgeKind } from './model';
import { polylinePath } from './route';
import { ioMarkerPath, shapeGeometry, SHAPE_FOR_KIND } from './shapes';
import {
  DIAGRAM_BACKGROUND_COLOR,
  DIAGRAM_GRID_COLOR,
  DIAGRAM_LABEL_COLOR,
  LIGHT_TOKEN_COLORS,
  colorForFlowEdgeKind,
  paletteForFlowNodeKind,
  tokenColor,
} from './theme';

const EXPORT_PADDING = 48;
const EXPORT_SCALE = 2;
const EDGE_KINDS: FlowEdgeKind[] = ['default', 'branch', 'loop', 'merge'];

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function diagramBounds(routine: PositionedFlowRoutineDiagram) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const include = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  routine.nodes.forEach((node) => {
    include(node.position.x, node.position.y);
    include(node.position.x + node.size.width, node.position.y + node.size.height);
  });
  routine.edges.forEach((edge) => edge.points.forEach((point) => include(point.x, point.y)));

  return { minX, minY, maxX, maxY };
}

function edgeMarkup(edge: PositionedFlowEdge, offsetX: number, offsetY: number): string {
  const points = edge.points.map((point) => ({ x: point.x + offsetX, y: point.y + offsetY }));
  const stroke = colorForFlowEdgeKind(edge.kind);
  const path = `<path d="${polylinePath(points)}" fill="none" marker-end="url(#arrow-${edge.kind})" stroke="${stroke}" stroke-linecap="round" stroke-linejoin="round" stroke-width="${edge.kind === 'loop' ? 2 : 1.6}" />`;

  if (!edge.label || !edge.labelPosition) return path;

  const width = estimateEdgeLabelWidth(edge.label);
  const x = edge.labelPosition.x + offsetX;
  const y = edge.labelPosition.y + offsetY;
  return `${path}<g transform="translate(${x}, ${y})"><rect x="${-width / 2}" y="-10" width="${width}" height="20" rx="10" fill="${DIAGRAM_BACKGROUND_COLOR}" stroke="${stroke}" stroke-opacity="0.45" /><text x="0" y="0.5" fill="${edge.kind === 'loop' ? '#1d5e4d' : DIAGRAM_LABEL_COLOR}" font-family="Helvetica Neue, Arial, sans-serif" font-size="${EDGE_LABEL_FONT_SIZE}" font-weight="700" text-anchor="middle" dominant-baseline="middle">${escapeXml(edge.label)}</text></g>`;
}

function nodeMarkup(node: PositionedFlowNode, x: number, y: number): string {
  const palette = paletteForFlowNodeKind(node.kind);
  const { width, height } = node.size;
  const shape = shapeGeometry(SHAPE_FOR_KIND[node.kind], width, height, x, y);
  const parts = [
    `<path d="${shape.outline}" fill="${palette.fill}" stroke="${palette.stroke}" stroke-width="${node.kind === 'junction' ? 0 : 1.8}" />`,
  ];
  if (shape.details) {
    parts.push(`<path d="${shape.details}" fill="none" stroke="${palette.stroke}" stroke-width="1.6" />`);
  }
  if (node.kind === 'input' || node.kind === 'output') {
    parts.push(`<path d="${ioMarkerPath(node.kind, width, height, x, y)}" fill="none" stroke="${palette.stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`);
  }

  const firstBaseline = y + height / 2 - ((node.lines.length - 1) * LABEL_LINE_HEIGHT) / 2;
  node.lines.forEach((line, index) => {
    const spans = line
      .map((token) => `<tspan fill="${tokenColor(token.type, palette, LIGHT_TOKEN_COLORS)}"${token.type === 'keyword' ? ' font-weight="600"' : ''}>${escapeXml(token.text)}</tspan>`)
      .join('');
    parts.push(`<text x="${x + width / 2}" y="${firstBaseline + index * LABEL_LINE_HEIGHT}" xml:space="preserve" font-family='${EXPORT_LABEL_FONT_FAMILY}' font-size="${LABEL_FONT_SIZE}" text-anchor="middle" dominant-baseline="central">${spans}</text>`);
  });

  return `<g>${node.title ? `<title>${escapeXml(node.title)}</title>` : ''}${parts.join('')}</g>`;
}

function buildDiagramSvg(routine: PositionedFlowRoutineDiagram) {
  const bounds = diagramBounds(routine);
  const width = Math.ceil(bounds.maxX - bounds.minX + EXPORT_PADDING * 2);
  const height = Math.ceil(bounds.maxY - bounds.minY + EXPORT_PADDING * 2);
  const offsetX = EXPORT_PADDING - bounds.minX;
  const offsetY = EXPORT_PADDING - bounds.minY;

  const markers = EDGE_KINDS.map((kind) => (
    `<marker id="arrow-${kind}" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0.5 1 L9 5 L0.5 9 Z" fill="${colorForFlowEdgeKind(kind)}" /></marker>`
  )).join('');
  const edges = routine.edges.map((edge) => edgeMarkup(edge, offsetX, offsetY)).join('');
  const nodes = routine.nodes
    .map((node) => nodeMarkup(node, node.position.x + offsetX, node.position.y + offsetY))
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none"><title>${escapeXml(routine.label)}</title><defs><pattern id="diagram-grid" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1.1" cy="1.1" r="1" fill="${DIAGRAM_GRID_COLOR}" /></pattern>${markers}</defs><rect width="${width}" height="${height}" fill="${DIAGRAM_BACKGROUND_COLOR}" /><rect width="${width}" height="${height}" fill="url(#diagram-grid)" />${edges}${nodes}</svg>`;

  return { width, height, svg };
}

async function svgToPngDataUrl(svg: string, width: number, height: number) {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    const image = new Image();
    image.decoding = 'async';
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Failed to load diagram SVG for export.'));
    });
    image.src = url;
    await loaded;

    const canvas = document.createElement('canvas');
    canvas.width = width * EXPORT_SCALE;
    canvas.height = height * EXPORT_SCALE;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas context is unavailable.');
    }

    context.fillStyle = DIAGRAM_BACKGROUND_COLOR;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function exportRoutineToSvg(routine: PositionedFlowRoutineDiagram) {
  return buildDiagramSvg(routine);
}

export async function exportRoutineToPng(routine: PositionedFlowRoutineDiagram) {
  const { svg, width, height } = buildDiagramSvg(routine);
  const dataUrl = await svgToPngDataUrl(svg, width, height);
  return {
    dataUrl,
    width,
    height,
  };
}
