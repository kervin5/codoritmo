// Flowchart symbols (ISO 5807, as PSeInt and school textbooks draw them) as
// SVG path data, plus the points where connectors attach. Both the live
// diagram and the PNG/SVG export draw from here.

import type { FlowNodeKind, FlowSourceHandle, FlowTargetHandle } from './model';

export type FlowNodeShape =
  | 'connector'
  | 'decision'
  | 'input-output'
  | 'predefined-process'
  | 'preparation'
  | 'process'
  | 'terminator';

export const SHAPE_FOR_KIND: Record<FlowNodeKind, FlowNodeShape> = {
  call: 'predefined-process',
  decision: 'decision',
  input: 'input-output',
  junction: 'connector',
  loop: 'preparation',
  output: 'input-output',
  process: 'process',
  switch: 'decision',
  terminator: 'terminator',
};

/** Horizontal slant of the input/output parallelogram. */
export const PARALLELOGRAM_SKEW = 16;
/** Inset of the double side bars of a predefined process (subprocess call). */
export const PREDEFINED_BAR_INSET = 10;

export function hexagonInset(height: number): number {
  return Math.min(20, Math.round(height / 2));
}

export interface ShapeGeometry {
  /** Closed outline, filled and stroked. */
  outline: string;
  /** Extra strokes drawn on top (the side bars of a predefined process). */
  details?: string;
}

/** Path data for a symbol of the given size, with its top-left corner at (x, y). */
export function shapeGeometry(shape: FlowNodeShape, width: number, height: number, x = 0, y = 0): ShapeGeometry {
  const w = width;
  const h = height;
  const p = (px: number, py: number) => `${round(x + px)},${round(y + py)}`;

  switch (shape) {
    case 'terminator': {
      const r = h / 2;
      return {
        outline: `M ${p(r, 0)} L ${p(w - r, 0)} A ${r} ${r} 0 0 1 ${p(w - r, h)} L ${p(r, h)} A ${r} ${r} 0 0 1 ${p(r, 0)} Z`,
      };
    }
    case 'input-output': {
      const s = PARALLELOGRAM_SKEW;
      return { outline: `M ${p(s, 0)} L ${p(w, 0)} L ${p(w - s, h)} L ${p(0, h)} Z` };
    }
    case 'decision':
      return { outline: `M ${p(w / 2, 0)} L ${p(w, h / 2)} L ${p(w / 2, h)} L ${p(0, h / 2)} Z` };
    case 'preparation': {
      const i = hexagonInset(h);
      return { outline: `M ${p(i, 0)} L ${p(w - i, 0)} L ${p(w, h / 2)} L ${p(w - i, h)} L ${p(i, h)} L ${p(0, h / 2)} Z` };
    }
    case 'predefined-process': {
      const b = PREDEFINED_BAR_INSET;
      return {
        outline: `M ${p(0, 0)} L ${p(w, 0)} L ${p(w, h)} L ${p(0, h)} Z`,
        details: `M ${p(b, 0)} L ${p(b, h)} M ${p(w - b, 0)} L ${p(w - b, h)}`,
      };
    }
    case 'connector': {
      const r = Math.min(w, h) / 2;
      return { outline: `M ${p(0, h / 2)} A ${r} ${r} 0 1 0 ${p(w, h / 2)} A ${r} ${r} 0 1 0 ${p(0, h / 2)} Z` };
    }
    case 'process':
    default:
      return { outline: `M ${p(0, 0)} L ${p(w, 0)} L ${p(w, h)} L ${p(0, h)} Z` };
  }
}

/**
 * Small arrow that tells input from output on the parallelogram: data comes
 * in through the left side (Leer) or leaves through the right side (Escribir).
 */
export function ioMarkerPath(kind: 'input' | 'output', width: number, height: number, x = 0, y = 0): string {
  const cy = y + height / 2;
  const edgeX = kind === 'input'
    ? x + PARALLELOGRAM_SKEW / 2
    : x + width - PARALLELOGRAM_SKEW / 2;
  const from = kind === 'input' ? edgeX - 13 : edgeX - 3;
  const to = kind === 'input' ? edgeX + 5 : edgeX + 15;
  return `M ${round(from)},${round(cy)} L ${round(to - 5)},${round(cy)} M ${round(to - 6)},${round(cy - 4.5)} L ${round(to)},${round(cy)} L ${round(to - 6)},${round(cy + 4.5)}`;
}

export interface Point {
  x: number;
  y: number;
}

export type HandleSide = 'bottom' | 'left' | 'right' | 'top';

export function handleSide(handle: FlowSourceHandle | FlowTargetHandle): HandleSide {
  switch (handle) {
    case 'left':
    case 'left-in':
      return 'left';
    case 'right':
    case 'right-in':
      return 'right';
    case 'top':
      return 'top';
    case 'bottom':
    default:
      return 'bottom';
  }
}

/** Where a connector touches a symbol of this shape, on the given side. */
export function shapeAnchor(
  shape: FlowNodeShape,
  box: { x: number; y: number; width: number; height: number },
  side: HandleSide,
): Point {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const inset = shape === 'input-output' ? PARALLELOGRAM_SKEW / 2 : 0;

  switch (side) {
    case 'top':
      return { x: cx, y: box.y };
    case 'left':
      return { x: box.x + inset, y: cy };
    case 'right':
      return { x: box.x + box.width - inset, y: cy };
    case 'bottom':
    default:
      return { x: cx, y: box.y + box.height };
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
