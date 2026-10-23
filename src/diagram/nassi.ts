// Nassi-Shneiderman (Chapin) diagrams: the structured alternative to the
// flowchart that PSeInt draws when "usar diagramas de Nassi-Shneiderman" is
// on (psdraw3/DNassiSchne.cpp). No arrows: every statement is a box, and a
// routine is one tall rectangle of boxes stacked top to bottom, all stretched
// to the same width.
//
//   simple      Escribir, Leer, assignments, calls: one box
//   Si          a header whose two diagonals meet above the split between the
//               Sí column (left) and the No column (right)
//   Segun       a header whose diagonals meet above the De Otro Modo column,
//               a row of case labels, then one column per case
//   Mientras,   a header bar across the whole width; the body is indented
//   Para        under it, with the loop's strip down its left side
//   Repetir     the same strip, with the condition bar at the bottom
//
// Built from the flowchart model (model.ts), so every box keeps the node's
// source line and the trace lines that light it up during a run. Pure
// layout: both the live view and the PNG/SVG export draw these cells.

import { LABEL_CHAR_WIDTH, LABEL_LINE_HEIGHT, wrapLabel, type LabelToken } from './label';
import {
  DEFAULT_CASE_LABEL,
  FALSE_LABEL,
  TRUE_LABEL,
  type FlowDiagram,
  type FlowLayoutBlock,
  type FlowNode,
  type FlowNodeKind,
  type FlowRoutineDiagram,
} from './model';

export type NassiCellKind =
  | 'case'
  | 'empty'
  | 'if'
  | 'loop'
  | 'repeat'
  | 'simple'
  | 'switch'
  | 'terminator';

export interface NassiText {
  lines: LabelToken[][];
  /** Anchor x (the left edge for "start", the centre for "middle"). */
  x: number;
  /** Vertical centre of the whole block of lines. */
  y: number;
  anchor: 'middle' | 'start';
}

/** A small label inside a header: Sí / No under a condition's diagonals. */
export interface NassiTag {
  text: string;
  x: number;
  /** Vertical centre. */
  y: number;
  anchor: 'end' | 'middle' | 'start';
}

export interface NassiCell {
  id: string;
  kind: NassiCellKind;
  /** Flowchart kind whose palette the box uses (null: an empty slot). */
  tone: FlowNodeKind | null;
  /** The flowchart node this box stands for (absent for case labels and empty slots). */
  nodeId?: string;
  /** Bounding box of the outline. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Closed outline, absolute coordinates: filled and stroked, and what glows. */
  outline: string;
  /** Extra strokes on top (a header's diagonals). */
  details?: string;
  text?: NassiText;
  tags?: NassiTag[];
  /** Full statement, for the tooltip. */
  title: string;
  truncated: boolean;
  /** Source line a click jumps to. */
  line?: number;
  /** Line the interpreter reports when this box runs (it glows then). */
  traceLine?: number;
  /** Line that marks this box as visited. */
  visitLine?: number;
}

export interface NassiRoutine {
  /** Same id as the flowchart routine (so the picker and the export agree). */
  id: string;
  label: string;
  name: string;
  width: number;
  height: number;
  /** Painted in order; boxes tile the routine's rectangle without overlapping. */
  cells: NassiCell[];
}

export interface NassiDiagram {
  routines: NassiRoutine[];
}

/** Horizontal padding inside a box. */
const PAD_X = 14;
/** Vertical padding above and below a box's text. */
const PAD_Y = 11;
const MIN_WIDTH = 120;
const MIN_HEIGHT = 40;
/** Width of a loop's strip (the indent of its body). */
export const NASSI_LOOP_STRIP = 24;
/** Band at the bottom of a Si header where the Sí / No labels sit. */
const TAG_BAND = 22;
/** Narrowest column of a Si or Segun (room for its label). */
const MIN_COLUMN = 64;
/** Height of an empty branch or loop body. */
const EMPTY_HEIGHT = 30;
/** Clearance between a condition and the diagonals around it. */
const TRIANGLE_CLEARANCE = 24;
export const NASSI_MIN_ROUTINE_WIDTH = 260;

const LIMITS = {
  simple: { maxChars: 36, maxLines: 3 },
  condition: { maxChars: 26, maxLines: 3 },
  bar: { maxChars: 44, maxLines: 2 },
  caseLabel: { maxChars: 18, maxLines: 2 },
};

interface Wrapped {
  lines: LabelToken[][];
  columns: number;
  truncated: boolean;
}

const textWidth = (wrapped: Wrapped) => wrapped.columns * LABEL_CHAR_WIDTH;
const textHeight = (wrapped: Wrapped) => wrapped.lines.length * LABEL_LINE_HEIGHT;
const even = (value: number) => Math.ceil(value / 2) * 2;
const round = (value: number) => Math.round(value * 100) / 100;

function rect(x: number, y: number, width: number, height: number): string {
  return `M ${round(x)},${round(y)} L ${round(x + width)},${round(y)} L ${round(x + width)},${round(y + height)} L ${round(x)},${round(y + height)} Z`;
}

function polygon(points: Array<[number, number]>): string {
  return `M ${points.map(([px, py]) => `${round(px)},${round(py)}`).join(' L ')} Z`;
}

/**
 * Height of a header whose two diagonals start at its top corners and meet at
 * (splitX, bottom). At depth t the room between them is width × (1 − t), so a
 * condition of textW fits when it ends above t = 1 − (textW + clearance) / width.
 */
function triangleHeaderHeight(text: Wrapped, width: number, minBelow: number): number {
  const band = PAD_Y + textHeight(text);
  const room = 1 - (textWidth(text) + TRIANGLE_CLEARANCE) / width;
  return even(Math.max(band + minBelow, band / Math.max(room, 0.2)));
}

/** Where to centre a condition inside the triangle of a header (it leans towards the split). */
function triangleTextX(x: number, width: number, splitX: number, height: number, text: Wrapped): number {
  const depth = (PAD_Y + textHeight(text)) / height;
  return x + width / 2 + depth * (splitX - width / 2);
}

function lineOf(node: FlowNode | undefined): number | undefined {
  return node?.sourceSpan?.start.line;
}

class NassiBuilder {
  private readonly cells: NassiCell[] = [];
  private readonly nodes: Map<string, FlowNode>;
  private readonly widths = new Map<FlowLayoutBlock, number>();
  private emptyCount = 0;

  constructor(private readonly routine: FlowRoutineDiagram) {
    this.nodes = new Map(routine.nodes.map((node) => [node.id, node]));
  }

  build(): NassiRoutine {
    const width = Math.max(NASSI_MIN_ROUTINE_WIDTH, this.minWidth(this.routine.layout));
    const height = this.place(this.routine.layout, 0, 0, width);
    return {
      id: this.routine.id,
      label: this.routine.label,
      name: this.routine.name,
      width,
      height,
      cells: this.cells,
    };
  }

  private node(id: string): FlowNode {
    const node = this.nodes.get(id);
    if (!node) throw new Error(`Nassi-Shneiderman: unknown node ${id}`);
    return node;
  }

  /* ---------- text ---------- */

  private simpleText(node: FlowNode): Wrapped {
    return wrapLabel(node.label, LIMITS.simple.maxChars, LIMITS.simple.maxLines);
  }

  private conditionText(node: FlowNode): Wrapped {
    return wrapLabel(node.label, LIMITS.condition.maxChars, LIMITS.condition.maxLines);
  }

  /** A loop's bar reads as the statement: "Mientras i <= n", "Para i <- 1 Hasta n", "Hasta Que x > 0". */
  private barLabel(node: FlowNode): string {
    if (node.kind === 'loop') return node.label;
    return node.title.replace(/\s+Hacer$/u, '');
  }

  private barText(node: FlowNode): Wrapped {
    return wrapLabel(this.barLabel(node), LIMITS.bar.maxChars, LIMITS.bar.maxLines);
  }

  private caseText(label: string): Wrapped {
    return wrapLabel(label, LIMITS.caseLabel.maxChars, LIMITS.caseLabel.maxLines);
  }

  /* ---------- widths (bottom-up) ---------- */

  private minWidth(block: FlowLayoutBlock | null): number {
    if (!block) return MIN_COLUMN;
    const cached = this.widths.get(block);
    if (cached !== undefined) return cached;
    const width = even(this.measure(block));
    this.widths.set(block, width);
    return width;
  }

  private measure(block: FlowLayoutBlock): number {
    switch (block.kind) {
      case 'node': {
        const node = this.node(block.nodeId);
        if (node.kind === 'junction') return 0;
        return Math.max(MIN_WIDTH, textWidth(this.simpleText(node)) + PAD_X * 2);
      }
      case 'sequence':
        return Math.max(0, ...block.blocks.map((child) => this.minWidth(child)));
      case 'if': {
        const condition = this.conditionText(this.node(block.decisionId));
        const columns = Math.max(MIN_COLUMN, this.minWidth(block.thenBlock)) + Math.max(MIN_COLUMN, this.minWidth(block.elseBlock));
        return Math.max(columns, 2 * (textWidth(condition) + TRIANGLE_CLEARANCE));
      }
      case 'loop':
        return Math.max(
          NASSI_LOOP_STRIP + Math.max(MIN_COLUMN, this.minWidth(block.body)),
          textWidth(this.barText(this.node(block.headerId))) + PAD_X * 2,
        );
      case 'repeat':
        return Math.max(
          NASSI_LOOP_STRIP + Math.max(MIN_COLUMN, this.minWidth(block.body)),
          textWidth(this.barText(this.node(block.conditionId))) + PAD_X * 2,
        );
      case 'switch': {
        const expression = this.conditionText(this.node(block.switchId));
        const columns = this.switchColumnWidths(block).reduce((sum, width) => sum + width, 0);
        return Math.max(columns, MIN_WIDTH, 2 * (textWidth(expression) + TRIANGLE_CLEARANCE));
      }
    }
  }

  private switchColumnWidths(block: Extract<FlowLayoutBlock, { kind: 'switch' }>): number[] {
    return block.branches.map((branch) => even(Math.max(
      MIN_COLUMN,
      this.minWidth(branch.body),
      textWidth(this.caseText(branch.label)) + PAD_X * 2,
    )));
  }

  /** Shares out extra width evenly between columns (PSeInt does the same). */
  private stretch(widths: number[], total: number): number[] {
    const extra = total - widths.reduce((sum, width) => sum + width, 0);
    if (extra <= 0 || widths.length === 0) return widths;
    const share = Math.floor(extra / widths.length);
    const out = widths.map((width) => width + share);
    out[out.length - 1] += extra - share * widths.length;
    return out;
  }

  /* ---------- placement (top-down); returns the height used ---------- */

  private place(block: FlowLayoutBlock | null, x: number, y: number, width: number): number {
    if (!block) return 0;
    switch (block.kind) {
      case 'node':
        return this.placeNode(this.node(block.nodeId), x, y, width);
      case 'sequence': {
        let height = 0;
        block.blocks.forEach((child) => {
          height += this.place(child, x, y + height, width);
        });
        return height;
      }
      case 'if':
        return this.placeIf(block, x, y, width);
      case 'loop':
        return this.placeLoop(block, x, y, width);
      case 'repeat':
        return this.placeRepeat(block, x, y, width);
      case 'switch':
        return this.placeSwitch(block, x, y, width);
    }
  }

  private placeNode(node: FlowNode, x: number, y: number, width: number): number {
    if (node.kind === 'junction') return 0;
    const text = this.simpleText(node);
    const height = even(Math.max(MIN_HEIGHT, textHeight(text) + PAD_Y * 2));
    const terminator = node.kind === 'terminator';
    this.cells.push({
      id: node.id,
      kind: terminator ? 'terminator' : 'simple',
      tone: node.kind,
      nodeId: node.id,
      x,
      y,
      width,
      height,
      outline: rect(x, y, width, height),
      text: { lines: text.lines, x: x + width / 2, y: y + height / 2, anchor: 'middle' },
      title: node.title,
      truncated: text.truncated,
      line: lineOf(node),
      traceLine: node.traceLine,
      visitLine: node.visitLine,
    });
    return height;
  }

  private fill(x: number, y: number, width: number, height: number) {
    if (height <= 0.5) return;
    this.emptyCount += 1;
    this.cells.push({
      id: `${this.routine.id}:empty-${this.emptyCount}`,
      kind: 'empty',
      tone: null,
      x,
      y,
      width,
      height,
      outline: rect(x, y, width, height),
      title: '',
      truncated: false,
    });
  }

  /** Side-by-side columns of a Si or Segun; the shorter ones end in an empty slot. */
  private placeColumns(
    columns: Array<{ block: FlowLayoutBlock | null; x: number; width: number }>,
    y: number,
  ): number {
    const heights = columns.map((column) => this.place(column.block, column.x, y, column.width));
    const height = Math.max(EMPTY_HEIGHT, ...heights);
    columns.forEach((column, index) => this.fill(column.x, y + heights[index], column.width, height - heights[index]));
    return height;
  }

  private placeIf(block: Extract<FlowLayoutBlock, { kind: 'if' }>, x: number, y: number, width: number): number {
    const node = this.node(block.decisionId);
    const condition = this.conditionText(node);
    const [thenWidth, elseWidth] = this.stretch(
      [Math.max(MIN_COLUMN, this.minWidth(block.thenBlock)), Math.max(MIN_COLUMN, this.minWidth(block.elseBlock))],
      width,
    );
    const headerHeight = triangleHeaderHeight(condition, width, TAG_BAND);
    const splitX = x + thenWidth;

    this.cells.push({
      id: node.id,
      kind: 'if',
      tone: 'decision',
      nodeId: node.id,
      x,
      y,
      width,
      height: headerHeight,
      outline: rect(x, y, width, headerHeight),
      details: `M ${round(x)},${round(y)} L ${round(splitX)},${round(y + headerHeight)} L ${round(x + width)},${round(y)}`,
      text: {
        lines: condition.lines,
        x: triangleTextX(x, width, thenWidth, headerHeight, condition),
        y: y + PAD_Y + textHeight(condition) / 2,
        anchor: 'middle',
      },
      tags: [
        { text: TRUE_LABEL, x: x + 9, y: y + headerHeight - TAG_BAND / 2, anchor: 'start' },
        { text: FALSE_LABEL, x: x + width - 9, y: y + headerHeight - TAG_BAND / 2, anchor: 'end' },
      ],
      title: node.title,
      truncated: condition.truncated,
      line: lineOf(node),
      traceLine: node.traceLine,
      visitLine: node.visitLine,
    });

    const bodyHeight = this.placeColumns(
      [
        { block: block.thenBlock, x, width: thenWidth },
        { block: block.elseBlock, x: splitX, width: elseWidth },
      ],
      y + headerHeight,
    );
    return headerHeight + bodyHeight;
  }

  private placeLoop(block: Extract<FlowLayoutBlock, { kind: 'loop' }>, x: number, y: number, width: number): number {
    const node = this.node(block.headerId);
    const text = this.barText(node);
    const barHeight = even(Math.max(MIN_HEIGHT - 4, textHeight(text) + PAD_Y * 2));
    const bodyX = x + NASSI_LOOP_STRIP;
    const bodyWidth = width - NASSI_LOOP_STRIP;
    let bodyHeight = this.place(block.body, bodyX, y + barHeight, bodyWidth);
    if (bodyHeight === 0) {
      this.fill(bodyX, y + barHeight, bodyWidth, EMPTY_HEIGHT);
      bodyHeight = EMPTY_HEIGHT;
    }
    const height = barHeight + bodyHeight;
    this.cells.push({
      id: node.id,
      kind: 'loop',
      tone: 'loop',
      nodeId: node.id,
      x,
      y,
      width,
      height,
      outline: polygon([[x, y], [x + width, y], [x + width, y + barHeight], [bodyX, y + barHeight], [bodyX, y + height], [x, y + height]]),
      text: { lines: text.lines, x: x + PAD_X, y: y + barHeight / 2, anchor: 'start' },
      title: node.title,
      truncated: text.truncated,
      line: lineOf(node),
      traceLine: node.traceLine,
      visitLine: node.visitLine,
    });
    return height;
  }

  private placeRepeat(block: Extract<FlowLayoutBlock, { kind: 'repeat' }>, x: number, y: number, width: number): number {
    const entry = this.node(block.entryId);
    const condition = this.node(block.conditionId);
    const text = this.barText(condition);
    const barHeight = even(Math.max(MIN_HEIGHT - 4, textHeight(text) + PAD_Y * 2));
    const bodyX = x + NASSI_LOOP_STRIP;
    const bodyWidth = width - NASSI_LOOP_STRIP;
    let bodyHeight = this.place(block.body, bodyX, y, bodyWidth);
    if (bodyHeight === 0) {
      this.fill(bodyX, y, bodyWidth, EMPTY_HEIGHT);
      bodyHeight = EMPTY_HEIGHT;
    }
    const height = bodyHeight + barHeight;
    this.cells.push({
      id: condition.id,
      kind: 'repeat',
      tone: 'loop',
      nodeId: condition.id,
      x,
      y,
      width,
      height,
      outline: polygon([[x, y], [bodyX, y], [bodyX, y + bodyHeight], [x + width, y + bodyHeight], [x + width, y + height], [x, y + height]]),
      text: { lines: text.lines, x: x + PAD_X, y: y + bodyHeight + barHeight / 2, anchor: 'start' },
      title: condition.title,
      truncated: text.truncated,
      // The bar is the Hasta Que line; the run reports the Repetir line each time round.
      line: lineOf(condition) ?? lineOf(entry),
      traceLine: entry.traceLine,
      visitLine: condition.visitLine ?? entry.traceLine,
    });
    return height;
  }

  private placeSwitch(block: Extract<FlowLayoutBlock, { kind: 'switch' }>, x: number, y: number, width: number): number {
    const node = this.node(block.switchId);
    const expression = this.conditionText(node);
    const widths = this.stretch(this.switchColumnWidths(block), width);
    const lastLeft = widths.slice(0, -1).reduce((sum, w) => sum + w, 0);
    const headerHeight = triangleHeaderHeight(expression, width, 18);
    const caseTexts = block.branches.map((branch) => this.caseText(branch.label));
    const caseHeight = even(Math.max(28, ...caseTexts.map((text) => textHeight(text) + 12)));

    this.cells.push({
      id: node.id,
      kind: 'switch',
      tone: 'switch',
      nodeId: node.id,
      x,
      y,
      width,
      height: headerHeight,
      outline: rect(x, y, width, headerHeight),
      // Like PSeInt: the diagonals meet above the De Otro Modo column.
      details: `M ${round(x)},${round(y)} L ${round(x + lastLeft)},${round(y + headerHeight)} L ${round(x + width)},${round(y)}`,
      text: {
        lines: expression.lines,
        x: triangleTextX(x, width, lastLeft, headerHeight, expression),
        y: y + PAD_Y + textHeight(expression) / 2,
        anchor: 'middle',
      },
      title: node.title,
      truncated: expression.truncated,
      line: lineOf(node),
      traceLine: node.traceLine,
      visitLine: node.visitLine,
    });

    let columnX = x;
    const columns = block.branches.map((branch, index) => {
      const column = { block: branch.body, x: columnX, width: widths[index] };
      const text = caseTexts[index];
      this.cells.push({
        id: `${node.id}:case-${index}`,
        kind: 'case',
        tone: 'switch',
        x: columnX,
        y: y + headerHeight,
        width: widths[index],
        height: caseHeight,
        outline: rect(columnX, y + headerHeight, widths[index], caseHeight),
        text: { lines: text.lines, x: columnX + widths[index] / 2, y: y + headerHeight + caseHeight / 2, anchor: 'middle' },
        title: branch.label === DEFAULT_CASE_LABEL ? DEFAULT_CASE_LABEL : `Caso ${branch.label}`,
        truncated: text.truncated,
        line: lineOf(node),
        // Lit with its Segun once it has run (it never glows on its own).
        visitLine: node.visitLine,
      });
      columnX += widths[index];
      return column;
    });

    const bodyHeight = this.placeColumns(columns, y + headerHeight + caseHeight);
    return headerHeight + caseHeight + bodyHeight;
  }
}

/** Lays out one routine of the flowchart model as a Nassi-Shneiderman diagram. */
export function layoutNassiRoutine(routine: FlowRoutineDiagram): NassiRoutine {
  return new NassiBuilder(routine).build();
}

/** One Nassi-Shneiderman diagram per routine, in the same order (and with the same ids) as the flowchart. */
export function buildNassiDiagram(diagram: FlowDiagram): NassiDiagram {
  return { routines: diagram.routines.map(layoutNassiRoutine) };
}
