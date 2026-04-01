import { Position, getSmoothStepPath } from '@xyflow/react';

import type { FlowEdge } from './model';
import {
  DIAGRAM_BACKGROUND_COLOR,
  DIAGRAM_EDGE_DEFAULT_COLOR,
  DIAGRAM_GRID_COLOR,
  DIAGRAM_LABEL_COLOR,
  colorForFlowEdgeKind,
  paletteForFlowNodeKind,
} from './theme';
import type { PositionedFlowNode, PositionedFlowRoutineDiagram } from './layout';

const EXPORT_PADDING = 84;
const EXPORT_SCALE = 2;

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function wrapLabel(label: string, maxChars: number): string[] {
  const words = label.split(/\s+/u);
  const lines: string[] = [];
  let current = '';

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars || !current) {
      current = candidate;
      return;
    }

    lines.push(current);
    current = word;
  });

  if (current) {
    lines.push(current);
  }

  return lines;
}

function labelLines(node: PositionedFlowNode): string[] {
  const maxChars = node.kind === 'decision'
    ? 13
    : node.kind === 'io'
      ? 22
      : Math.max(14, Math.floor((node.size.width - 36) / 8));
  return wrapLabel(node.label, maxChars);
}

function nodeBounds(routine: PositionedFlowRoutineDiagram) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  routine.nodes.forEach((node) => {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + node.size.width);
    maxY = Math.max(maxY, node.position.y + node.size.height);
  });

  return {
    minX,
    minY,
    maxX,
    maxY,
  };
}

function anchorForHandle(node: PositionedFlowNode, handle: string | undefined, mode: 'source' | 'target') {
  const resolved = handle ?? (mode === 'source' ? 'bottom' : 'top');
  const centerX = node.position.x + node.size.width / 2;
  const centerY = node.position.y + node.size.height / 2;

  switch (resolved) {
    case 'left':
    case 'left-in':
      return { x: node.position.x, y: centerY, position: Position.Left };
    case 'right':
    case 'right-in':
      return { x: node.position.x + node.size.width, y: centerY, position: Position.Right };
    case 'top':
      return { x: centerX, y: node.position.y, position: Position.Top };
    case 'bottom':
    default:
      return { x: centerX, y: node.position.y + node.size.height, position: Position.Bottom };
  }
}

function edgeMarkup(edge: FlowEdge, nodeMap: Map<string, PositionedFlowNode>, offsetX: number, offsetY: number): string {
  const sourceNode = nodeMap.get(edge.source);
  const targetNode = nodeMap.get(edge.target);
  if (!sourceNode || !targetNode) {
    return '';
  }

  const source = anchorForHandle(sourceNode, edge.sourceHandle, 'source');
  const target = anchorForHandle(targetNode, edge.targetHandle, 'target');
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX: source.x + offsetX,
    sourceY: source.y + offsetY,
    sourcePosition: source.position,
    targetX: target.x + offsetX,
    targetY: target.y + offsetY,
    targetPosition: target.position,
    borderRadius: edge.kind === 'loop' ? 18 : edge.kind === 'branch' ? 16 : 14,
    offset: edge.kind === 'loop' ? 36 : edge.kind === 'branch' ? 24 : 20,
  });

  const stroke = colorForFlowEdgeKind(edge.kind);
  const labelMarkup = edge.label
    ? `
      <g transform="translate(${labelX}, ${labelY})">
        <rect x="-28" y="-12" width="56" height="24" rx="12" fill="${edge.kind === 'loop' ? '#e7f6ef' : '#fff8ef'}" />
        <text x="0" y="1" fill="${edge.kind === 'loop' ? '#1d5e4d' : DIAGRAM_LABEL_COLOR}" font-size="11" font-weight="700" text-anchor="middle" dominant-baseline="middle">${escapeXml(edge.label)}</text>
      </g>
    `
    : '';

  return `
    <g>
      <path
        d="${path}"
        fill="none"
        marker-end="url(#arrow-${edge.kind})"
        stroke="${stroke}"
        stroke-dasharray="${edge.kind === 'loop' ? '10 8' : ''}"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="${edge.kind === 'loop' ? '2.2' : '1.8'}"
      />
      ${labelMarkup}
    </g>
  `;
}

function nodeShapeMarkup(node: PositionedFlowNode, x: number, y: number) {
  const palette = paletteForFlowNodeKind(node.kind);
  const width = node.size.width;
  const height = node.size.height;
  const lines = labelLines(node);
  const lineHeight = 18;
  const startY = y + height / 2 - ((lines.length - 1) * lineHeight) / 2;
  const textMarkup = lines
    .map(
      (line, index) => `
        <tspan x="${x + width / 2}" y="${startY + index * lineHeight}">${escapeXml(line)}</tspan>
      `,
    )
    .join('');

  const shape = (() => {
    switch (node.kind) {
      case 'decision':
        return `<polygon points="${x + width / 2},${y} ${x + width},${y + height / 2} ${x + width / 2},${y + height} ${x},${y + height / 2}" fill="${palette.fill}" stroke="${palette.stroke}" stroke-width="2" />`;
      case 'io':
        return `<polygon points="${x + 24},${y} ${x + width},${y} ${x + width - 24},${y + height} ${x},${y + height}" fill="${palette.fill}" stroke="${palette.stroke}" stroke-width="2" />`;
      case 'switch':
        return `<polygon points="${x + 24},${y} ${x + width - 24},${y} ${x + width},${y + height / 2} ${x + width - 24},${y + height} ${x + 24},${y + height} ${x},${y + height / 2}" fill="${palette.fill}" stroke="${palette.stroke}" stroke-width="2" />`;
      case 'branch':
        return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="20" fill="${palette.fill}" stroke="${palette.stroke}" stroke-width="2" stroke-dasharray="${palette.dashArray ?? ''}" />`;
      case 'loop':
        return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="24" fill="${palette.fill}" stroke="${palette.stroke}" stroke-width="2" />`;
      case 'terminator':
        return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${height / 2}" fill="${palette.fill}" stroke="${palette.stroke}" stroke-width="2" />`;
      case 'process':
      default:
        return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="18" fill="${palette.fill}" stroke="${palette.stroke}" stroke-width="2" />`;
    }
  })();

  return `
    <g>
      ${shape}
      <text fill="${palette.text}" font-family="Helvetica Neue, Arial, sans-serif" font-size="14" font-weight="700" text-anchor="middle" dominant-baseline="middle">
        ${textMarkup}
      </text>
    </g>
  `;
}

function buildDiagramSvg(routine: PositionedFlowRoutineDiagram) {
  const bounds = nodeBounds(routine);
  const width = Math.max(640, Math.ceil(bounds.maxX - bounds.minX + EXPORT_PADDING * 2));
  const height = Math.max(480, Math.ceil(bounds.maxY - bounds.minY + EXPORT_PADDING * 2));
  const offsetX = EXPORT_PADDING - bounds.minX;
  const offsetY = EXPORT_PADDING - bounds.minY;
  const nodeMap = new Map(routine.nodes.map((node) => [node.id, node]));

  const edges = routine.edges
    .map((edge) => edgeMarkup(edge, nodeMap, offsetX, offsetY))
    .join('');
  const nodes = routine.nodes
    .map((node) => nodeShapeMarkup(node, node.position.x + offsetX, node.position.y + offsetY))
    .join('');

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">
      <defs>
        <pattern id="diagram-grid" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="1.1" cy="1.1" r="1" fill="${DIAGRAM_GRID_COLOR}" />
        </pattern>
        <marker id="arrow-default" markerWidth="10" markerHeight="10" refX="7.5" refY="5" orient="auto">
          <path d="M1 1 L8 5 L1 9 Z" fill="${DIAGRAM_EDGE_DEFAULT_COLOR}" />
        </marker>
        <marker id="arrow-loop" markerWidth="10" markerHeight="10" refX="7.5" refY="5" orient="auto">
          <path d="M1 1 L8 5 L1 9 Z" fill="#2f816b" />
        </marker>
        <marker id="arrow-branch" markerWidth="10" markerHeight="10" refX="7.5" refY="5" orient="auto">
          <path d="M1 1 L8 5 L1 9 Z" fill="#8c7251" />
        </marker>
      </defs>
      <rect width="${width}" height="${height}" fill="${DIAGRAM_BACKGROUND_COLOR}" />
      <rect width="${width}" height="${height}" fill="url(#diagram-grid)" />
      ${edges}
      ${nodes}
    </svg>
  `;

  return {
    width,
    height,
    svg,
  };
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

export async function exportRoutineToPng(routine: PositionedFlowRoutineDiagram) {
  const { svg, width, height } = buildDiagramSvg(routine);
  const dataUrl = await svgToPngDataUrl(svg, width, height);
  return {
    dataUrl,
    width,
    height,
  };
}
