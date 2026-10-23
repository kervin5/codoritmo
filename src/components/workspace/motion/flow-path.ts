// Geometry for the light that travels the live flowchart: which connectors
// lead from the block that just ran to the next one, and where along them
// the light is at a given distance. Pure functions, so they work in tests
// (jsdom has no SVG geometry).

import type { Point, PositionedFlowEdge, PositionedFlowRoutineDiagram } from "@/src/diagram";

/** Most connectors the light follows between two blocks before giving up. */
const MAX_HOPS = 7;

/**
 * Connectors from one block to the next, shortest first. The interpreter only
 * reports some blocks (a loop header runs once, Hasta Que never), so the path
 * may pass through other blocks: a loop's back edge, a junction, a header.
 * With `from === to` it finds a cycle (a loop body that is a single block).
 */
export function findRoute(
  routine: PositionedFlowRoutineDiagram,
  from: string,
  to: string,
  maxHops = MAX_HOPS
): PositionedFlowEdge[] | null {
  const outgoing = new Map<string, PositionedFlowEdge[]>();
  for (const edge of routine.edges) {
    const list = outgoing.get(edge.source);
    if (list) list.push(edge);
    else outgoing.set(edge.source, [edge]);
  }

  // Breadth-first over edges; a node is expanded once (except the start, which a cycle returns to).
  const queue: { node: string; path: PositionedFlowEdge[] }[] = [{ node: from, path: [] }];
  const seen = new Set<string>();
  while (queue.length) {
    const { node, path } = queue.shift()!;
    if (path.length >= maxHops) continue;
    for (const edge of outgoing.get(node) ?? []) {
      const next = [...path, edge];
      if (edge.target === to) return next;
      if (seen.has(edge.target)) continue;
      seen.add(edge.target);
      queue.push({ node: edge.target, path: next });
    }
  }
  return null;
}

/** The polyline with its corners rounded exactly like `polylinePath` draws them, flattened to points. */
export function flattenRounded(points: Point[], radius = 8, steps = 4): Point[] {
  if (points.length < 3) return points.slice();
  const out: Point[] = [points[0]];
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
    out.push(before);
    for (let step = 1; step < steps; step += 1) {
      const t = step / steps;
      const u = 1 - t;
      out.push({
        x: u * u * before.x + 2 * u * t * corner.x + t * t * after.x,
        y: u * u * before.y + 2 * u * t * corner.y + t * t * after.y,
      });
    }
    out.push(after);
  }
  out.push(points[points.length - 1]);
  return out;
}

export interface TravelPath {
  points: Point[];
  /** Cumulative distance at each point. */
  distances: number[];
  length: number;
  /** Where each connector of the route starts, as a distance along the whole path. */
  edgeStarts: { edge: PositionedFlowEdge; at: number }[];
}

/**
 * One continuous path through a chain of connectors. Where two connectors
 * meet at a block the light passes through the block's centre.
 */
export function travelPath(route: PositionedFlowEdge[], centerOf?: (nodeId: string) => Point | undefined): TravelPath {
  const points: Point[] = [];
  const edgeStarts: TravelPath["edgeStarts"] = [];
  const distances: number[] = [];
  let length = 0;
  const push = (point: Point) => {
    const last = points[points.length - 1];
    if (last) {
      const step = Math.hypot(point.x - last.x, point.y - last.y);
      if (step < 0.01) return;
      length += step;
    }
    points.push(point);
    distances.push(length);
  };
  route.forEach((edge, edgeIndex) => {
    const flat = flattenRounded(edge.points);
    if (edgeIndex > 0) {
      const center = centerOf?.(edge.source);
      if (center) push(center);
    }
    edgeStarts.push({ edge, at: length + (points.length ? Math.hypot(flat[0].x - points[points.length - 1].x, flat[0].y - points[points.length - 1].y) : 0) });
    flat.forEach(push);
  });
  return { points, distances, length, edgeStarts };
}

/** Point at `distance` along the path (clamped). */
export function pointAt(path: TravelPath, distance: number): Point {
  const { points, distances } = path;
  if (points.length === 0) return { x: 0, y: 0 };
  if (distance <= 0) return points[0];
  for (let index = 1; index < points.length; index += 1) {
    if (distances[index] >= distance) {
      const span = distances[index] - distances[index - 1];
      const t = span > 0 ? (distance - distances[index - 1]) / span : 1;
      const a = points[index - 1];
      const b = points[index];
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
  }
  return points[points.length - 1];
}

/** SVG "M … L …" for the stretch of the path between two distances (the trail behind the light). */
export function subPath(path: TravelPath, start: number, end: number): string {
  const { points, distances } = path;
  if (points.length === 0 || end <= start) return "";
  const parts: Point[] = [pointAt(path, start)];
  for (let index = 0; index < points.length; index += 1) {
    if (distances[index] > start && distances[index] < end) parts.push(points[index]);
  }
  parts.push(pointAt(path, end));
  return parts
    .map((p, index) => `${index === 0 ? "M" : "L"} ${Math.round(p.x * 10) / 10} ${Math.round(p.y * 10) / 10}`)
    .join(" ");
}

/** How long the light takes: proportional to distance, kept short, and never longer than a step. */
export function travelDuration(length: number, stepMs: number | null): number {
  const natural = Math.min(450, Math.max(180, 120 + length * 1.1));
  if (stepMs === null) return natural;
  return Math.min(natural, stepMs * 0.75);
}

/** Below this per-step budget the light would only flicker: just move the highlight. */
export const MIN_TRAVEL_MS = 130;
