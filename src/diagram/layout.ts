import type { DiagramNodeOffset } from '@/src/components/ide/types';

import type { FlowDiagram, FlowEdge, FlowLayoutBlock, FlowNode, FlowRoutineDiagram } from './model';

export interface PositionedFlowNode extends FlowNode {
  position: {
    x: number;
    y: number;
  };
}

export interface PositionedFlowRoutineDiagram {
  edges: FlowEdge[];
  id: string;
  label: string;
  nodes: PositionedFlowNode[];
}

export interface PositionedFlowDiagram {
  routines: PositionedFlowRoutineDiagram[];
}

interface LayoutFrame {
  height: number;
  positions: Record<string, { x: number; y: number }>;
  width: number;
}

const HORIZONTAL_GAP = 120;
const LOOP_LEFT_GUTTER = 140;
const LOOP_RIGHT_GUTTER = 120;
const PADDING = 40;
const REPEAT_CONDITION_GAP = 20;
const SEQUENCE_GAP = 72;
const SWITCH_LANE_MIN_WIDTH = 188;
const LOOP_BODY_GAP = 44;
const REPEAT_LEFT_GUTTER = 156;
const REPEAT_RIGHT_GUTTER = 132;

export async function layoutFlowDiagram(flow: FlowDiagram): Promise<PositionedFlowDiagram> {
  return {
    routines: flow.routines.map(layoutRoutine),
  };
}

export function applyFlowNodeOffsets(
  routine: PositionedFlowRoutineDiagram,
  offsets: Record<string, DiagramNodeOffset>,
): PositionedFlowRoutineDiagram {
  return {
    ...routine,
    nodes: routine.nodes.map((node) => {
      const offset = offsets[node.id] ?? { x: 0, y: 0 };
      return {
        ...node,
        position: {
          x: node.position.x + offset.x,
          y: node.position.y + offset.y,
        },
      };
    }),
  };
}

function emptyFrame(): LayoutFrame {
  return {
    width: 0,
    height: 0,
    positions: {},
  };
}

function mergePositions(
  target: Record<string, { x: number; y: number }>,
  source: Record<string, { x: number; y: number }>,
  dx: number,
  dy: number,
) {
  Object.entries(source).forEach(([nodeId, position]) => {
    target[nodeId] = {
      x: position.x + dx,
      y: position.y + dy,
    };
  });
}

function layoutRoutine(routine: FlowRoutineDiagram): PositionedFlowRoutineDiagram {
  const nodeMap = new Map(routine.nodes.map((node) => [node.id, node]));
  const frame = layoutBlock(routine.layout, nodeMap);

  return {
    id: routine.id,
    label: routine.label,
    edges: routine.edges,
    nodes: routine.nodes.map((node) => ({
      ...node,
      position: {
        x: (frame.positions[node.id]?.x ?? 0) + PADDING,
        y: (frame.positions[node.id]?.y ?? 0) + PADDING,
      },
    })),
  };
}

function layoutBlock(
  block: FlowLayoutBlock | null,
  nodeMap: Map<string, FlowNode>,
): LayoutFrame {
  if (!block) {
    return emptyFrame();
  }

  switch (block.kind) {
    case 'node':
      return layoutNode(nodeMap, block.nodeId);
    case 'sequence':
      return layoutSequence(block.blocks, nodeMap, block.gap ?? SEQUENCE_GAP);
    case 'if':
      return layoutIf(block, nodeMap);
    case 'loop':
      return layoutLoop(block.loopId, block.body, nodeMap);
    case 'while':
      return layoutLoop(block.decisionId, block.body, nodeMap);
    case 'repeat':
      return layoutRepeat(block, nodeMap);
    case 'switch':
      return layoutSwitch(block, nodeMap);
  }
}

function layoutNode(nodeMap: Map<string, FlowNode>, nodeId: string): LayoutFrame {
  const node = nodeMap.get(nodeId);
  if (!node) {
    return emptyFrame();
  }

  return {
    width: node.size.width,
    height: node.size.height,
    positions: {
      [nodeId]: { x: 0, y: 0 },
    },
  };
}

function layoutSequence(
  blocks: FlowLayoutBlock[],
  nodeMap: Map<string, FlowNode>,
  gap: number,
): LayoutFrame {
  const frames = blocks
    .map((child) => layoutBlock(child, nodeMap))
    .filter((frame) => frame.width > 0 || Object.keys(frame.positions).length > 0);

  if (frames.length === 0) {
    return emptyFrame();
  }

  const width = Math.max(...frames.map((frame) => frame.width));
  const positions: Record<string, { x: number; y: number }> = {};
  let y = 0;

  frames.forEach((frame, index) => {
    mergePositions(positions, frame.positions, Math.round((width - frame.width) / 2), y);
    y += frame.height;
    if (index < frames.length - 1) {
      y += gap;
    }
  });

  return {
    width,
    height: y,
    positions,
  };
}

function layoutIf(
  block: Extract<FlowLayoutBlock, { kind: 'if' }>,
  nodeMap: Map<string, FlowNode>,
): LayoutFrame {
  const decision = layoutNode(nodeMap, block.decisionId);
  const thenFrame = layoutBlock(block.thenBlock, nodeMap);
  const elseFrame = layoutBlock(block.elseBlock, nodeMap);
  const leftWidth = Math.max(elseFrame.width, 168);
  const rightWidth = Math.max(thenFrame.width, 168);
  const branchSpan = leftWidth + HORIZONTAL_GAP + rightWidth;
  const width = Math.max(decision.width, branchSpan);
  const positions: Record<string, { x: number; y: number }> = {};
  const decisionX = Math.round((width - decision.width) / 2);
  const branchY = decision.height + SEQUENCE_GAP;
  const branchStartX = Math.round((width - branchSpan) / 2);

  mergePositions(positions, decision.positions, decisionX, 0);
  mergePositions(
    positions,
    elseFrame.positions,
    branchStartX + Math.round((leftWidth - elseFrame.width) / 2),
    branchY,
  );
  mergePositions(
    positions,
    thenFrame.positions,
    branchStartX + leftWidth + HORIZONTAL_GAP + Math.round((rightWidth - thenFrame.width) / 2),
    branchY,
  );

  return {
    width,
    height: branchY + Math.max(thenFrame.height, elseFrame.height),
    positions,
  };
}

function layoutLoop(
  loopId: string,
  body: FlowLayoutBlock | null,
  nodeMap: Map<string, FlowNode>,
): LayoutFrame {
  const header = layoutNode(nodeMap, loopId);
  const bodyFrame = layoutBlock(body, nodeMap);
  const contentWidth = Math.max(header.width, bodyFrame.width);
  const width = contentWidth + LOOP_LEFT_GUTTER + LOOP_RIGHT_GUTTER;
  const positions: Record<string, { x: number; y: number }> = {};
  const headerX = LOOP_LEFT_GUTTER + Math.round((contentWidth - header.width) / 2);

  mergePositions(positions, header.positions, headerX, 0);

  if (bodyFrame.width === 0 && Object.keys(bodyFrame.positions).length === 0) {
    return {
      width,
      height: header.height,
      positions,
    };
  }

  const bodyY = header.height + LOOP_BODY_GAP;
  const bodyX = LOOP_LEFT_GUTTER + Math.round((contentWidth - bodyFrame.width) / 2);
  mergePositions(positions, bodyFrame.positions, bodyX, bodyY);

  return {
    width,
    height: bodyY + bodyFrame.height,
    positions,
  };
}

function layoutRepeat(
  block: Extract<FlowLayoutBlock, { kind: 'repeat' }>,
  nodeMap: Map<string, FlowNode>,
): LayoutFrame {
  const header = layoutNode(nodeMap, block.headerId);
  const bodyFrame = layoutBlock(block.body, nodeMap);
  const condition = layoutNode(nodeMap, block.conditionId);
  const contentWidth = Math.max(header.width, bodyFrame.width, condition.width);
  const width = contentWidth + REPEAT_LEFT_GUTTER + REPEAT_RIGHT_GUTTER;
  const positions: Record<string, { x: number; y: number }> = {};

  mergePositions(
    positions,
    header.positions,
    REPEAT_LEFT_GUTTER + Math.round((contentWidth - header.width) / 2),
    0,
  );

  const bodyY = header.height + LOOP_BODY_GAP;

  if (bodyFrame.width > 0 || Object.keys(bodyFrame.positions).length > 0) {
    mergePositions(
      positions,
      bodyFrame.positions,
      REPEAT_LEFT_GUTTER + Math.round((contentWidth - bodyFrame.width) / 2),
      bodyY,
    );
  }

  const conditionY = bodyFrame.height > 0
    ? bodyY + bodyFrame.height + REPEAT_CONDITION_GAP
    : bodyY + REPEAT_CONDITION_GAP;
  mergePositions(
    positions,
    condition.positions,
    REPEAT_LEFT_GUTTER + Math.round((contentWidth - condition.width) / 2),
    conditionY,
  );

  return {
    width,
    height: conditionY + condition.height,
    positions,
  };
}

function layoutSwitch(
  block: Extract<FlowLayoutBlock, { kind: 'switch' }>,
  nodeMap: Map<string, FlowNode>,
): LayoutFrame {
  const header = layoutNode(nodeMap, block.switchId);
  const laneFrames = block.branches.map((branch) => {
    const branchNode = layoutNode(nodeMap, branch.branchId);
    const body = layoutBlock(branch.body, nodeMap);
    const lane = body.width > 0 || Object.keys(body.positions).length > 0
      ? layoutSequence([{ kind: 'node', nodeId: branch.branchId }, branch.body!], nodeMap, 36)
      : branchNode;

    return {
      frame: lane,
      width: Math.max(lane.width, SWITCH_LANE_MIN_WIDTH),
    };
  });

  if (laneFrames.length === 0) {
    return {
      width: header.width,
      height: header.height,
      positions: header.positions,
    };
  }

  const laneSpan = laneFrames.reduce((sum, lane, index) => (
    sum + lane.width + (index < laneFrames.length - 1 ? HORIZONTAL_GAP : 0)
  ), 0);
  const width = Math.max(header.width, laneSpan);
  const laneStartX = Math.round((width - laneSpan) / 2);
  const laneY = header.height + SEQUENCE_GAP;
  const positions: Record<string, { x: number; y: number }> = {};
  let currentX = laneStartX;

  mergePositions(positions, header.positions, Math.round((width - header.width) / 2), 0);

  laneFrames.forEach((lane, index) => {
    mergePositions(
      positions,
      lane.frame.positions,
      currentX + Math.round((lane.width - lane.frame.width) / 2),
      laneY,
    );
    currentX += lane.width;
    if (index < laneFrames.length - 1) {
      currentX += HORIZONTAL_GAP;
    }
  });

  return {
    width,
    height: laneY + Math.max(...laneFrames.map((lane) => lane.frame.height)),
    positions,
  };
}
