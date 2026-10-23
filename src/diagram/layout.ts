// Structured layout: every block is laid out around a vertical axis (the
// line the flow runs down), so consecutive blocks line up and sequence
// connectors are straight. Compound blocks reserve side lanes for the
// connectors that leave them (decision arms, loop exits, back edges), and
// the connectors are routed here, once, for both renderers.

import type { DiagramNodeOffset } from '@/src/components/ide/types';

import { estimateEdgeLabelWidth } from './label';
import { JUNCTION_SIZE, type FlowDiagram, type FlowEdge, type FlowLayoutBlock, type FlowNode, type FlowRoutineDiagram } from './model';
import { routeEdge, type EdgeRouteHint } from './route';
import type { Point } from './shapes';

export interface PositionedFlowNode extends FlowNode {
  position: Point;
}

export interface PositionedFlowEdge extends FlowEdge {
  /** Orthogonal polyline from the source handle to the target handle. */
  points: Point[];
  labelPosition?: Point;
}

export interface PositionedFlowRoutineDiagram {
  edges: PositionedFlowEdge[];
  id: string;
  label: string;
  name: string;
  nodes: PositionedFlowNode[];
  /** Lane hints used to route the connectors (kept so offsets can re-route). */
  routeHints: Record<string, EdgeRouteHint>;
}

export interface PositionedFlowDiagram {
  routines: PositionedFlowRoutineDiagram[];
}

/** A laid-out block: extents measured from its axis (x = 0) and its top (y = 0). */
interface Frame {
  left: number;
  right: number;
  height: number;
  /** Top-left corner of each node. */
  positions: Record<string, Point>;
  hints: Record<string, EdgeRouteHint>;
}

const PADDING = 40;
/** Vertical gap between consecutive blocks (room for a Sí/No label too). */
const SEQUENCE_GAP = 40;
/** Space between neighbouring lanes. */
const LANE_GAP = 36;
/** Shortest horizontal arm out of a decision corner. */
const MIN_ARM = 44;
/** Room for a loop's back edge or exit lane beside its body. */
const LOOP_GUTTER = 34;
/** How far below a block a back edge turns towards its lane. */
const BACK_EDGE_DROP = 18;
/** Gap above a merge junction, below the longest lane. */
const MERGE_GAP = 24;
/** Segun: trunk length below the switch before the lanes fan out. */
const FAN_DROP = 18;
const FAN_LABEL_ROOM = 42;
const SWITCH_LANE_MIN = 48;

export async function layoutFlowDiagram(flow: FlowDiagram): Promise<PositionedFlowDiagram> {
  return layoutFlowDiagramSync(flow);
}

export function layoutFlowDiagramSync(flow: FlowDiagram): PositionedFlowDiagram {
  return { routines: flow.routines.map(layoutRoutine) };
}

export function applyFlowNodeOffsets(
  routine: PositionedFlowRoutineDiagram,
  offsets: Record<string, DiagramNodeOffset>,
): PositionedFlowRoutineDiagram {
  const nodes = routine.nodes.map((node) => {
    const offset = offsets[node.id] ?? { x: 0, y: 0 };
    return { ...node, position: { x: node.position.x + offset.x, y: node.position.y + offset.y } };
  });
  return { ...routine, nodes, edges: routeEdges(routine.edges, nodes, routine.routeHints) };
}

function routeEdges(
  edges: FlowEdge[],
  nodes: PositionedFlowNode[],
  hints: Record<string, EdgeRouteHint>,
): PositionedFlowEdge[] {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  return edges.flatMap((edge) => {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    if (!source || !target) return [];
    const { points, labelPosition } = routeEdge(edge, source, target, hints[edge.id]);
    return [{
      id: edge.id,
      kind: edge.kind,
      label: edge.label,
      source: edge.source,
      sourceHandle: edge.sourceHandle,
      target: edge.target,
      targetHandle: edge.targetHandle,
      points,
      labelPosition,
      ...(edge.slot ? { slot: edge.slot } : {}),
    }];
  });
}

function layoutRoutine(routine: FlowRoutineDiagram): PositionedFlowRoutineDiagram {
  const nodeMap = new Map(routine.nodes.map((node) => [node.id, node]));
  const frame = layoutBlock(routine.layout, nodeMap);
  const dx = frame.left + PADDING;
  const dy = PADDING;

  const nodes = routine.nodes.map((node) => {
    const position = frame.positions[node.id] ?? { x: -node.size.width / 2, y: 0 };
    return { ...node, position: { x: position.x + dx, y: position.y + dy } };
  });
  const hints = shiftHints(frame.hints, dx, dy);

  return {
    id: routine.id,
    label: routine.label,
    name: routine.name,
    nodes,
    edges: routeEdges(routine.edges, nodes, hints),
    routeHints: hints,
  };
}

function shiftHints(hints: Record<string, EdgeRouteHint>, dx: number, dy: number): Record<string, EdgeRouteHint> {
  return Object.fromEntries(Object.entries(hints).map(([id, hint]) => [id, {
    ...hint,
    laneX: hint.laneX === undefined ? undefined : hint.laneX + dx,
    turnY: hint.turnY === undefined ? undefined : hint.turnY + dy,
    label: hint.label ? { x: hint.label.x + dx, y: hint.label.y + dy } : undefined,
  }]));
}

function emptyFrame(): Frame {
  return { left: 0, right: 0, height: 0, positions: {}, hints: {} };
}

function isEmpty(frame: Frame): boolean {
  return Object.keys(frame.positions).length === 0;
}

/** Copies a child frame into a parent, with the child's axis at x = dx and its top at y = dy. */
function place(target: Frame, child: Frame, dx: number, dy: number) {
  Object.entries(child.positions).forEach(([id, position]) => {
    target.positions[id] = { x: position.x + dx, y: position.y + dy };
  });
  Object.assign(target.hints, shiftHints(child.hints, dx, dy));
}

function layoutBlock(block: FlowLayoutBlock | null, nodeMap: Map<string, FlowNode>): Frame {
  if (!block) return emptyFrame();

  switch (block.kind) {
    case 'node':
      return layoutNode(nodeMap.get(block.nodeId));
    case 'sequence':
      return layoutSequence(block.blocks, nodeMap);
    case 'if':
      return layoutIf(block, nodeMap);
    case 'loop':
      return layoutLoop(block, nodeMap);
    case 'repeat':
      return layoutRepeat(block, nodeMap);
    case 'switch':
      return layoutSwitch(block, nodeMap);
  }
}

function layoutNode(node: FlowNode | undefined): Frame {
  if (!node) return emptyFrame();
  const half = node.size.width / 2;
  return {
    left: half,
    right: half,
    height: node.size.height,
    positions: { [node.id]: { x: -half, y: 0 } },
    hints: {},
  };
}

function layoutSequence(blocks: FlowLayoutBlock[], nodeMap: Map<string, FlowNode>): Frame {
  const frame = emptyFrame();
  let y = 0;

  blocks
    .map((child) => layoutBlock(child, nodeMap))
    .filter((child) => !isEmpty(child))
    .forEach((child, index) => {
      if (index > 0) y += SEQUENCE_GAP;
      place(frame, child, 0, y);
      frame.left = Math.max(frame.left, child.left);
      frame.right = Math.max(frame.right, child.right);
      y += child.height;
    });

  frame.height = y;
  return frame;
}

/** Junction centred on the axis with its top at y. */
function placeJunction(frame: Frame, junctionId: string | null, y: number) {
  if (!junctionId) return;
  frame.positions[junctionId] = { x: -JUNCTION_SIZE / 2, y };
}

function layoutIf(block: Extract<FlowLayoutBlock, { kind: 'if' }>, nodeMap: Map<string, FlowNode>): Frame {
  const decision = layoutNode(nodeMap.get(block.decisionId));
  const thenFrame = layoutBlock(block.thenBlock, nodeMap);
  const elseFrame = layoutBlock(block.elseBlock, nodeMap);
  const half = decision.right;

  // Lanes sit beside the diamond's corners and never overlap each other.
  const thenX = Math.max(half + MIN_ARM, thenFrame.left + LANE_GAP / 2);
  const elseX = -Math.max(half + MIN_ARM, elseFrame.right + LANE_GAP / 2);
  const branchY = decision.height + 14;
  const lanesBottom = branchY + Math.max(thenFrame.height, elseFrame.height);
  const junctionY = (isEmpty(thenFrame) && isEmpty(elseFrame) ? decision.height : lanesBottom) + MERGE_GAP;

  const frame = emptyFrame();
  place(frame, decision, 0, 0);
  place(frame, thenFrame, thenX, branchY);
  place(frame, elseFrame, elseX, branchY);
  placeJunction(frame, block.junctionId, junctionY);
  frame.hints[block.thenEdgeId] = { laneX: thenX };
  frame.hints[block.elseEdgeId] = { laneX: elseX };

  frame.left = Math.max(half, -elseX + elseFrame.left, -elseX + 8);
  frame.right = Math.max(half, thenX + thenFrame.right, thenX + 8);
  frame.height = block.junctionId ? junctionY + JUNCTION_SIZE : lanesBottom;
  return frame;
}

function layoutLoop(block: Extract<FlowLayoutBlock, { kind: 'loop' }>, nodeMap: Map<string, FlowNode>): Frame {
  const header = layoutNode(nodeMap.get(block.headerId));
  const body = layoutBlock(block.body, nodeMap);
  const bodyY = header.height + SEQUENCE_GAP;
  const bodyBottom = isEmpty(body) ? header.height : bodyY + body.height;

  const backLaneX = -(Math.max(header.left, body.left) + LOOP_GUTTER);
  const exitLaneX = Math.max(header.right + MIN_ARM, body.right + LOOP_GUTTER);
  const junctionY = bodyBottom + BACK_EDGE_DROP + 16;

  const frame = emptyFrame();
  place(frame, header, 0, 0);
  if (!isEmpty(body)) place(frame, body, 0, bodyY);
  placeJunction(frame, block.junctionId, junctionY);
  block.backEdgeIds.forEach((id) => {
    frame.hints[id] = { laneX: backLaneX, turnY: bodyBottom + BACK_EDGE_DROP };
  });
  frame.hints[block.exitEdgeId] = { laneX: exitLaneX };

  frame.left = -backLaneX + 6;
  frame.right = exitLaneX + 6;
  frame.height = junctionY + JUNCTION_SIZE;
  return frame;
}

function layoutRepeat(block: Extract<FlowLayoutBlock, { kind: 'repeat' }>, nodeMap: Map<string, FlowNode>): Frame {
  const entry = layoutNode(nodeMap.get(block.entryId));
  const body = layoutBlock(block.body, nodeMap);
  const condition = layoutNode(nodeMap.get(block.conditionId));
  const bodyY = entry.height + 26;
  const conditionY = isEmpty(body) ? bodyY : bodyY + body.height + SEQUENCE_GAP;
  const backLaneX = -(Math.max(body.left, condition.left) + LOOP_GUTTER);

  const frame = emptyFrame();
  place(frame, entry, 0, 0);
  if (!isEmpty(body)) place(frame, body, 0, bodyY);
  place(frame, condition, 0, conditionY);
  frame.hints[block.backEdgeId] = { laneX: backLaneX };

  frame.left = -backLaneX + 6;
  frame.right = Math.max(body.right, condition.right);
  // A tail below the diamond keeps its Sí/No exit label clear of whatever follows.
  frame.height = conditionY + condition.height + 18;
  return frame;
}

function layoutSwitch(block: Extract<FlowLayoutBlock, { kind: 'switch' }>, nodeMap: Map<string, FlowNode>): Frame {
  const header = layoutNode(nodeMap.get(block.switchId));
  const busY = header.height + FAN_DROP;
  const laneY = busY + FAN_LABEL_ROOM;

  // Lay the lanes out left to right, then centre them under the switch.
  let cursor = 0;
  const lanes = block.branches.map((branch) => {
    const frame = layoutBlock(branch.body, nodeMap);
    const labelHalf = estimateEdgeLabelWidth(branch.label) / 2 + 4;
    const left = Math.max(frame.left, labelHalf, SWITCH_LANE_MIN);
    const right = Math.max(frame.right, labelHalf, SWITCH_LANE_MIN);
    const axis = cursor + left;
    cursor = axis + right + LANE_GAP;
    return { branch, frame, axis, left, right };
  });

  const n = lanes.length;
  const shift = n % 2 === 1
    ? -lanes[(n - 1) / 2].axis
    : -(lanes[n / 2 - 1].axis + lanes[n / 2].axis) / 2;
  const lanesBottom = laneY + Math.max(0, ...lanes.map((lane) => lane.frame.height));
  const junctionY = lanesBottom + MERGE_GAP;

  const frame = emptyFrame();
  place(frame, header, 0, 0);
  frame.left = header.left;
  frame.right = header.right;
  lanes.forEach((lane) => {
    const x = lane.axis + shift;
    place(frame, lane.frame, x, laneY);
    frame.hints[lane.branch.edgeId] = {
      laneX: x,
      turnY: busY,
      label: { x, y: busY + FAN_LABEL_ROOM / 2 },
    };
    frame.left = Math.max(frame.left, -(x - lane.left));
    frame.right = Math.max(frame.right, x + lane.right);
  });
  placeJunction(frame, block.junctionId, junctionY);
  frame.height = block.junctionId ? junctionY + JUNCTION_SIZE : lanesBottom;
  return frame;
}
