// Orthogonal connector routing shared by the live diagram and the export.
// Every connector is a short list of points with right-angle turns:
//   sequence     bottom → top, a straight vertical line
//   branch       out of a decision's side, across, then down into its lane
//   fan-out      Segun: down a short trunk, across a bus, down into each lane
//   merge        down the lane, then across into the junction below
//   back edge    down (or out of a side), around the outer lane, back in from the left

import type { FlowEdge, FlowNodeKind } from './model';
import { handleSide, shapeAnchor, SHAPE_FOR_KIND, type Point } from './shapes';

export interface EdgeRouteHint {
  /** x of the vertical lane the connector runs along (absolute, diagram coordinates). */
  laneX?: number;
  /** y where a connector leaving a bottom handle turns towards its lane (fan-out bus, back-edge drop). */
  turnY?: number;
  /** Explicit label position; otherwise the label sits near the source. */
  label?: Point;
}

interface RoutableNode {
  kind: FlowNodeKind;
  position: Point;
  size: { width: number; height: number };
}

function nodeShape(kind: FlowNodeKind) {
  return SHAPE_FOR_KIND[kind];
}

const DEFAULT_DROP = 18;

export function routeEdge(
  edge: Pick<FlowEdge, 'label' | 'sourceHandle' | 'targetHandle'>,
  source: RoutableNode,
  target: RoutableNode,
  hint: EdgeRouteHint = {},
): { points: Point[]; labelPosition?: Point } {
  const sourceSide = handleSide(edge.sourceHandle);
  const S = shapeAnchor(nodeShape(source.kind), { ...source.position, ...source.size }, sourceSide);
  const T = shapeAnchor(nodeShape(target.kind), { ...target.position, ...target.size }, handleSide(edge.targetHandle));
  let points: Point[];

  if (sourceSide === 'left' || sourceSide === 'right') {
    const laneX = hint.laneX ?? T.x;
    points = [S, { x: laneX, y: S.y }, { x: laneX, y: T.y }, T];
  } else {
    const laneX = hint.laneX ?? (edge.targetHandle === 'top' ? T.x : S.x);
    if (Math.abs(laneX - S.x) < 0.5) {
      points = [S, { x: S.x, y: T.y }, T];
    } else {
      const turnY = hint.turnY ?? S.y + DEFAULT_DROP;
      points = [S, { x: S.x, y: turnY }, { x: laneX, y: turnY }, { x: laneX, y: T.y }, T];
    }
  }

  points = simplify(points);
  const labelPosition = edge.label ? hint.label ?? pointAlong(points, labelDistance(points)) : undefined;
  return { points, labelPosition };
}

/** Labels sit on the first segment, close to the symbol they leave. */
function labelDistance(points: Point[]): number {
  const first = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
  return Math.min(first / 2, 30);
}

function pointAlong(points: Point[], distance: number): Point {
  let remaining = distance;
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1];
    const b = points[index];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= length && length > 0) {
      const t = remaining / length;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= length;
  }
  return points[points.length - 1];
}

/** Drops repeated points and merges collinear runs. */
function simplify(points: Point[]): Point[] {
  const deduped = points.filter((point, index) => (
    index === 0
    || Math.abs(point.x - points[index - 1].x) > 0.01
    || Math.abs(point.y - points[index - 1].y) > 0.01
  ));
  return deduped.filter((point, index) => {
    if (index === 0 || index === deduped.length - 1) return true;
    const a = deduped[index - 1];
    const b = deduped[index + 1];
    const vertical = Math.abs(a.x - point.x) < 0.01 && Math.abs(b.x - point.x) < 0.01;
    const horizontal = Math.abs(a.y - point.y) < 0.01 && Math.abs(b.y - point.y) < 0.01;
    return !(vertical || horizontal);
  });
}

/** SVG path for a polyline with softly rounded corners. */
export function polylinePath(points: Point[], radius = 8): string {
  if (points.length === 0) return '';
  const fmt = (p: Point) => `${Math.round(p.x * 100) / 100},${Math.round(p.y * 100) / 100}`;
  let d = `M ${fmt(points[0])}`;

  for (let index = 1; index < points.length - 1; index += 1) {
    const prev = points[index - 1];
    const corner = points[index];
    const next = points[index + 1];
    const inLength = Math.hypot(corner.x - prev.x, corner.y - prev.y);
    const outLength = Math.hypot(next.x - corner.x, next.y - corner.y);
    const r = Math.min(radius, inLength / 2, outLength / 2);
    const before = {
      x: corner.x - ((corner.x - prev.x) / (inLength || 1)) * r,
      y: corner.y - ((corner.y - prev.y) / (inLength || 1)) * r,
    };
    const after = {
      x: corner.x + ((next.x - corner.x) / (outLength || 1)) * r,
      y: corner.y + ((next.y - corner.y) / (outLength || 1)) * r,
    };
    d += ` L ${fmt(before)} Q ${fmt(corner)} ${fmt(after)}`;
  }

  return `${d} L ${fmt(points[points.length - 1])}`;
}
