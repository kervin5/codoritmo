import type { FlowEdgeKind, FlowNodeKind } from './model';

export const DIAGRAM_BACKGROUND_COLOR = '#f4efe6';
export const DIAGRAM_GRID_COLOR = 'rgba(76,65,49,0.08)';
export const DIAGRAM_EDGE_DEFAULT_COLOR = '#6c766f';
export const DIAGRAM_LABEL_COLOR = '#645d51';

export interface DiagramNodePalette {
  dashArray?: string;
  fill: string;
  stroke: string;
  text: string;
}

export function paletteForFlowNodeKind(kind: FlowNodeKind): DiagramNodePalette {
  switch (kind) {
    case 'terminator':
      return {
        fill: '#f8e9ce',
        stroke: '#c99543',
        text: '#8c6123',
      };
    case 'io':
      return {
        fill: '#dff1f2',
        stroke: '#78aeb1',
        text: '#3f6d70',
      };
    case 'decision':
      return {
        fill: '#fce7bc',
        stroke: '#cb9748',
        text: '#8c6123',
      };
    case 'loop':
      return {
        fill: '#dff2e8',
        stroke: '#2f816b',
        text: '#1d5e4d',
      };
    case 'switch':
      return {
        fill: '#f6dfea',
        stroke: '#c88ca3',
        text: '#8d5f72',
      };
    case 'branch':
      return {
        dashArray: '7 6',
        fill: '#fde6de',
        stroke: '#dc8e6f',
        text: '#9e5b43',
      };
    case 'process':
    default:
      return {
        fill: '#fff0d7',
        stroke: '#dfbe81',
        text: '#614a28',
      };
  }
}

export function colorForFlowEdgeKind(kind: FlowEdgeKind): string {
  switch (kind) {
    case 'loop':
      return '#2f816b';
    case 'branch':
      return '#8c7251';
    case 'default':
    default:
      return DIAGRAM_EDGE_DEFAULT_COLOR;
  }
}
