import type { LabelTokenType } from './label';
import type { FlowEdgeKind, FlowNodeKind } from './model';

// Light theme: the PNG/SVG export (prints well on paper).
export const DIAGRAM_BACKGROUND_COLOR = '#f4efe6';
export const DIAGRAM_GRID_COLOR = 'rgba(76,65,49,0.08)';
export const DIAGRAM_EDGE_DEFAULT_COLOR = '#6c766f';
export const DIAGRAM_LABEL_COLOR = '#645d51';

export interface DiagramNodePalette {
  fill: string;
  stroke: string;
  /** Plain text (identifiers) inside the block. */
  text: string;
}

export function paletteForFlowNodeKind(kind: FlowNodeKind): DiagramNodePalette {
  switch (kind) {
    case 'terminator':
      return { fill: '#f8e9ce', stroke: '#c99543', text: '#6e4a17' };
    case 'input':
      return { fill: '#e2eef8', stroke: '#6f9cc0', text: '#2c4f6b' };
    case 'output':
      return { fill: '#dff1f2', stroke: '#6fa9ac', text: '#2f5c5f' };
    case 'decision':
      return { fill: '#fce7bc', stroke: '#cb9748', text: '#6e4a17' };
    case 'loop':
      return { fill: '#dff2e8', stroke: '#2f816b', text: '#1d4e40' };
    case 'switch':
      return { fill: '#f6dfea', stroke: '#c88ca3', text: '#6d4456' };
    case 'call':
      return { fill: '#ece5f6', stroke: '#9a86c0', text: '#4a3a6a' };
    case 'junction':
      return { fill: '#6c766f', stroke: '#6c766f', text: '#6c766f' };
    case 'process':
    default:
      return { fill: '#fff0d7', stroke: '#dfbe81', text: '#4f3c20' };
  }
}

export function colorForFlowEdgeKind(kind: FlowEdgeKind): string {
  switch (kind) {
    case 'loop':
      return '#2f816b';
    case 'branch':
      return '#8c7251';
    case 'merge':
    case 'default':
    default:
      return DIAGRAM_EDGE_DEFAULT_COLOR;
  }
}

/** Syntax colours for labels on the light export: the editor's hues, darkened for paper. */
export const LIGHT_TOKEN_COLORS: Partial<Record<LabelTokenType, string>> = {
  keyword: '#1a6c50',
  type: '#2a6496',
  string: '#94540f',
  number: '#7442ad',
  operator: '#5c6762',
  punctuation: '#5c6762',
};

// Dark theme: the live diagram in the workspace.
export const DARK_ACTIVE_COLOR = '#86F0C4';
export const DARK_ACTIVE_FILL = '#1D2B26';
export const DARK_ACTIVE_TEXT = '#F2FFF9';
export const DARK_EDGE_COLORS: Record<FlowEdgeKind, string> = {
  default: '#5A666C',
  merge: '#5A666C',
  branch: '#8E7F5C',
  loop: '#4E9A7F',
};

export function darkPaletteForFlowNodeKind(kind: FlowNodeKind): DiagramNodePalette {
  switch (kind) {
    case 'terminator':
      return { fill: '#1B2723', stroke: '#3F7C66', text: '#D3EEE2' };
    case 'input':
      return { fill: '#172436', stroke: '#5A8FC4', text: '#D5E4F0' };
    case 'output':
      return { fill: '#132A2D', stroke: '#4FA3A8', text: '#D2EAEC' };
    case 'decision':
      return { fill: '#2C2414', stroke: '#C49A4E', text: '#F0E1C4' };
    case 'loop':
      return { fill: '#16291F', stroke: '#5DBB8F', text: '#D5EEE2' };
    case 'switch':
      return { fill: '#2A1C29', stroke: '#B582AC', text: '#EEDCEA' };
    case 'call':
      return { fill: '#221C30', stroke: '#9A86C8', text: '#E2DCF0' };
    case 'junction':
      return { fill: '#6B777D', stroke: '#6B777D', text: '#6B777D' };
    case 'process':
    default:
      return { fill: '#1B1F22', stroke: '#465056', text: '#E4EAE7' };
  }
}

/** The editor's dark palette (code-editor.tsx); identifiers use the block's own text colour. */
export const DARK_TOKEN_COLORS: Partial<Record<LabelTokenType, string>> = {
  keyword: '#8FD9B6',
  type: '#9CC4E4',
  string: '#E8BE8C',
  number: '#D2B3F2',
  operator: '#9AA6A1',
  punctuation: '#9AA6A1',
};

export function tokenColor(
  type: LabelTokenType,
  palette: DiagramNodePalette,
  tokens: Partial<Record<LabelTokenType, string>>,
): string {
  return tokens[type] ?? palette.text;
}
