// Builds the flow graph of every routine from the AST, using standard
// flowchart symbols (ISO 5807, as PSeInt and textbooks draw them):
//
//   terminator  Inicio / Fin of a routine (named, with its parameters)
//   process     assignment, Definir, Dimension, Limpiar Pantalla, Esperar
//   input       Leer            (parallelogram, arrow coming in)
//   output      Escribir        (parallelogram, arrow going out)
//   decision    Si, Mientras, the Hasta Que / Mientras Que of Repetir
//   loop        Para, Para Cada (preparation hexagon)
//   switch      Segun (multi-way decision; case values label the lanes)
//   call        subprocess call (predefined process: double side bars)
//   junction    connector dot where branches merge or a loop closes
//
// Every connector carries explicit handles, so the renderers never have to
// guess where a line leaves or enters a block.

import type {
  AssignableExpressionNode,
  ExpressionNode,
  MainRoutineNode,
  ProgramNode,
  RoutineNode,
  SourceSpan,
  StatementNode,
  SwitchCaseNode,
} from '@/src/engine';

import { LABEL_CHAR_WIDTH, LABEL_LINE_HEIGHT, wrapLabel, type LabelToken } from './label';
import { hexagonInset, PARALLELOGRAM_SKEW, PREDEFINED_BAR_INSET } from './shapes';

export type FlowNodeKind =
  | 'call'
  | 'decision'
  | 'input'
  | 'junction'
  | 'loop'
  | 'output'
  | 'process'
  | 'switch'
  | 'terminator';

export const FLOW_NODE_KINDS: readonly FlowNodeKind[] = [
  'call', 'decision', 'input', 'junction', 'loop', 'output', 'process', 'switch', 'terminator',
];

/**
 * sequence: bottom → top, straight down.
 * branch: a labelled way out of a decision (Sí / No, a Segun case, a loop exit).
 * loop: a back edge that closes a loop around the left side.
 * merge: the end of a branch joining the junction below it.
 */
export type FlowEdgeKind = 'branch' | 'default' | 'loop' | 'merge';

export type FlowSourceHandle = 'bottom' | 'left' | 'right';
export type FlowTargetHandle = 'left-in' | 'right-in' | 'top';

export const FLOW_SOURCE_HANDLES: readonly FlowSourceHandle[] = ['bottom', 'left', 'right'];
export const FLOW_TARGET_HANDLES: readonly FlowTargetHandle[] = ['top', 'left-in', 'right-in'];

/** Edge labels for the two ways out of a condition. */
export const TRUE_LABEL = 'Sí';
export const FALSE_LABEL = 'No';
export const DEFAULT_CASE_LABEL = 'De Otro Modo';

export interface FlowNodeSize {
  height: number;
  width: number;
}

export interface FlowNode {
  id: string;
  kind: FlowNodeKind;
  /** Text inside the symbol (a decision shows only its condition, like PSeInt). */
  label: string;
  /** Wrapped, tokenized label; the last line ends in "…" when it was cut. */
  lines: LabelToken[][];
  /** Full statement for the tooltip (e.g. "Mientras i <= n"). */
  title: string;
  truncated: boolean;
  routineId: string;
  size: FlowNodeSize;
  sourceSpan?: SourceSpan;
  /** Line the interpreter reports when this block runs (it glows then). */
  traceLine?: number;
  /** Line that marks this block as visited (defaults to traceLine). */
  visitLine?: number;
}

export interface FlowEdge {
  id: string;
  kind: FlowEdgeKind;
  label?: string;
  source: string;
  sourceHandle: FlowSourceHandle;
  target: string;
  targetHandle: FlowTargetHandle;
}

export interface FlowRoutineDiagram {
  edges: FlowEdge[];
  id: string;
  /** "Algoritmo Nombre", "Funcion Nombre", ... */
  label: string;
  /** Bare routine name, as the interpreter reports it. */
  name: string;
  layout: FlowLayoutBlock;
  nodes: FlowNode[];
}

export interface FlowDiagram {
  routines: FlowRoutineDiagram[];
}

export type FlowLayoutBlock =
  | { kind: 'node'; nodeId: string }
  | { kind: 'sequence'; blocks: FlowLayoutBlock[] }
  | {
      kind: 'if';
      decisionId: string;
      junctionId: string | null;
      thenBlock: FlowLayoutBlock | null;
      elseBlock: FlowLayoutBlock | null;
      /** Edges leaving the decision (they run along their lane). */
      thenEdgeId: string;
      elseEdgeId: string;
    }
  | {
      kind: 'loop';
      headerId: string;
      body: FlowLayoutBlock | null;
      junctionId: string;
      exitEdgeId: string;
      backEdgeIds: string[];
    }
  | {
      kind: 'repeat';
      entryId: string;
      body: FlowLayoutBlock | null;
      conditionId: string;
      backEdgeId: string;
    }
  | {
      kind: 'switch';
      switchId: string;
      junctionId: string | null;
      branches: Array<{ body: FlowLayoutBlock | null; edgeId: string; label: string }>;
    };

interface FlowFragment {
  entryId: string | null;
  exits: FlowExit[];
  layout: FlowLayoutBlock | null;
}

interface FlowExit {
  fromId: string;
  kind?: FlowEdgeKind;
  label?: string;
  sourceHandle?: FlowSourceHandle;
}

const LABEL_LIMITS: Record<FlowNodeKind, { maxChars: number; maxLines: number }> = {
  call: { maxChars: 28, maxLines: 3 },
  decision: { maxChars: 20, maxLines: 3 },
  input: { maxChars: 28, maxLines: 3 },
  junction: { maxChars: 1, maxLines: 1 },
  loop: { maxChars: 28, maxLines: 2 },
  output: { maxChars: 30, maxLines: 3 },
  process: { maxChars: 30, maxLines: 3 },
  switch: { maxChars: 20, maxLines: 2 },
  terminator: { maxChars: 34, maxLines: 2 },
};

export const JUNCTION_SIZE = 12;

const even = (value: number) => Math.ceil(value / 2) * 2;

function sizeFor(kind: FlowNodeKind, columns: number, lineCount: number): FlowNodeSize {
  const textWidth = columns * LABEL_CHAR_WIDTH;
  const textHeight = lineCount * LABEL_LINE_HEIGHT;
  const boxHeight = Math.max(44, textHeight + 22);

  switch (kind) {
    case 'junction':
      return { width: JUNCTION_SIZE, height: JUNCTION_SIZE };
    case 'terminator': {
      const height = Math.max(40, textHeight + 18);
      return { width: even(Math.max(120, textWidth + height + 8)), height: even(height) };
    }
    case 'decision':
    case 'switch':
      // A centred text box w × h fits a diamond W × H when w/W + h/H <= 1.
      return {
        width: even(Math.max(128, (textWidth + 18) / 0.62)),
        height: even(Math.max(64, (textHeight + 8) / 0.38)),
      };
    case 'loop':
      return { width: even(Math.max(140, textWidth + 32 + 2 * hexagonInset(boxHeight))), height: even(boxHeight) };
    case 'call':
      return { width: even(Math.max(132, textWidth + 32 + 2 * PREDEFINED_BAR_INSET)), height: even(boxHeight) };
    case 'input':
    case 'output':
      return { width: even(Math.max(132, textWidth + 36 + 2 * PARALLELOGRAM_SKEW)), height: even(boxHeight) };
    case 'process':
    default:
      return { width: even(Math.max(120, textWidth + 32)), height: even(boxHeight) };
  }
}

const WORD_OPERATORS: Record<string, string> = { AND: 'Y', OR: 'O', NOT: 'NO', '%': 'MOD' };

function formatOperator(operator: string): string {
  return WORD_OPERATORS[operator.toUpperCase()] ?? operator;
}

export function formatExpression(expression: ExpressionNode): string {
  switch (expression.kind) {
    case 'literal':
      if (expression.valueType === 'string') return `"${expression.value}"`;
      if (expression.valueType === 'boolean') return expression.value ? 'Verdadero' : 'Falso';
      return String(expression.value);
    case 'identifier':
      return expression.name;
    case 'arrayAccess':
      return `${formatExpression(expression.target)}[${expression.indices.map(formatExpression).join(', ')}]`;
    case 'call':
      return `${expression.callee}(${expression.args.map(formatExpression).join(', ')})`;
    case 'binary':
      return `${formatExpression(expression.left)} ${formatOperator(expression.operator)} ${formatExpression(expression.right)}`;
    case 'unary': {
      const operator = formatOperator(expression.operator);
      return /^\p{L}/u.test(operator)
        ? `${operator} ${formatExpression(expression.operand)}`
        : `${operator}${formatExpression(expression.operand)}`;
    }
    case 'group':
      return `(${formatExpression(expression.expression)})`;
  }
}

function formatAssignable(target: AssignableExpressionNode): string {
  return target.kind === 'identifier'
    ? target.name
    : `${formatExpression(target.target)}[${target.indices.map(formatExpression).join(', ')}]`;
}

function formatCase(caseNode: SwitchCaseNode): string {
  return caseNode.values.map(formatExpression).join(', ');
}

function formatWait(duration: ExpressionNode | undefined): string {
  if (!duration) return 'Esperar Tecla';
  // The parser stores "Esperar n Segundos" as n * 1000 milliseconds.
  if (
    duration.kind === 'binary' && duration.operator === '*' && !duration.span
    && duration.right.kind === 'literal' && duration.right.value === 1000
  ) {
    const amount = formatExpression(duration.left);
    return `Esperar ${amount} ${amount === '1' ? 'Segundo' : 'Segundos'}`;
  }
  return `Esperar ${formatExpression(duration)} Milisegundos`;
}

function nodeId(prefix: string, span: SourceSpan | undefined, fallback: string): string {
  if (span) {
    return `${prefix}:${span.start.line}:${span.start.column}:${span.end.line}:${span.end.column}`;
  }

  return `${prefix}:${fallback}`;
}

function routineDiagramId(routine: MainRoutineNode | RoutineNode, index: number): string {
  const base = routine.type === 'MainRoutine' ? 'main' : 'routine';
  return nodeId(base, routine.span, `${routine.name.toLowerCase()}-${index}`);
}

function routineLabel(routine: MainRoutineNode | RoutineNode): string {
  return `${routine.headerKind} ${routine.name}`;
}

/** Start terminator: the routine's header, with its parameters and return variable. */
function routineStartLabel(routine: MainRoutineNode | RoutineNode): string {
  if (routine.type === 'MainRoutine') return routineLabel(routine);
  const params = routine.params
    .map((param) => (param.byReference ? `${param.name} Por Referencia` : param.name))
    .join(', ');
  const returns = routine.returnTarget ? `${routine.returnTarget} <- ` : '';
  return `${routine.headerKind} ${returns}${routine.name}(${params})`;
}

function routineEndLabel(routine: MainRoutineNode | RoutineNode): string {
  const end = `Fin${routine.headerKind}`;
  return routine.type === 'Routine' && routine.returnTarget
    ? `${end} (devuelve ${routine.returnTarget})`
    : end;
}

class FlowDiagramBuilder {
  private edgeCounter = 0;
  private readonly edges: FlowEdge[] = [];
  private readonly nodes: FlowNode[] = [];

  constructor(
    private readonly routineId: string,
    private readonly routineNames: Set<string>,
  ) {}

  createRoutine(routine: MainRoutineNode | RoutineNode): FlowRoutineDiagram {
    const startNodeId = `${this.routineId}:start`;
    const endNodeId = `${this.routineId}:end`;
    const routineLine = routine.span?.start.line;
    const endLine = routine.span?.end.line;

    this.addNode({
      id: startNodeId,
      kind: 'terminator',
      label: routineStartLabel(routine),
      sourceSpan: routine.span,
      visitLine: routine.type === 'Routine' ? routineLine : undefined,
    });

    // A trailing Retornar flows into Fin like any other block.
    const body = routine.body;
    const last = body[body.length - 1];
    const bodyFlow = this.buildStatements(body, `${this.routineId}:body`, last?.kind === 'return' ? last : undefined);

    this.addNode({
      id: endNodeId,
      kind: 'terminator',
      label: routineEndLabel(routine),
      sourceSpan: endLine
        ? { start: { line: endLine, column: 1 }, end: { line: endLine, column: 1 } } as SourceSpan
        : undefined,
    });

    if (bodyFlow.entryId) {
      this.addEdge({ source: startNodeId, target: bodyFlow.entryId });
      this.connectExits(bodyFlow.exits, endNodeId, 'top');
    } else {
      this.addEdge({ source: startNodeId, target: endNodeId });
    }

    return {
      id: this.routineId,
      label: routineLabel(routine),
      name: routine.name,
      layout: {
        kind: 'sequence',
        blocks: [
          { kind: 'node', nodeId: startNodeId },
          ...(bodyFlow.layout ? [bodyFlow.layout] : []),
          { kind: 'node', nodeId: endNodeId },
        ],
      },
      nodes: this.nodes,
      edges: this.edges,
    };
  }

  private buildStatements(statements: StatementNode[], path: string, trailingReturn?: StatementNode): FlowFragment {
    let entryId: string | null = null;
    let exits: FlowExit[] = [];
    let started = false;
    const layouts: FlowLayoutBlock[] = [];

    statements.forEach((statement, index) => {
      const fragment = this.buildStatement(statement, `${path}-${index}`, statement === trailingReturn);

      if (!fragment.entryId) {
        return;
      }

      if (fragment.layout) {
        layouts.push(fragment.layout);
      }

      if (!started) {
        entryId = fragment.entryId;
        started = true;
      } else {
        // After a Retornar nothing flows in: the rest is unreachable.
        this.connectExits(exits, fragment.entryId, 'top');
      }

      exits = fragment.exits;
    });

    return {
      entryId,
      exits,
      layout: layouts.length === 0
        ? null
        : layouts.length === 1
          ? layouts[0]
          : { kind: 'sequence', blocks: layouts },
    };
  }

  private addEdge(edge: Omit<FlowEdge, 'id' | 'kind' | 'sourceHandle' | 'targetHandle'> & {
    kind?: FlowEdgeKind;
    sourceHandle?: FlowSourceHandle;
    targetHandle?: FlowTargetHandle;
  }): string {
    const id = `${edge.source}->${edge.target}#${this.edgeCounter += 1}`;
    this.edges.push({
      id,
      kind: edge.kind ?? 'default',
      label: edge.label,
      source: edge.source,
      sourceHandle: edge.sourceHandle ?? 'bottom',
      target: edge.target,
      targetHandle: edge.targetHandle ?? 'top',
    });
    return id;
  }

  private addNode(node: {
    id: string;
    kind: FlowNodeKind;
    label: string;
    title?: string;
    sourceSpan?: SourceSpan;
    traceLine?: number;
    visitLine?: number;
  }) {
    const limits = LABEL_LIMITS[node.kind];
    const wrapped = node.kind === 'junction'
      ? { lines: [], columns: 0, truncated: false }
      : wrapLabel(node.label, limits.maxChars, limits.maxLines);
    this.nodes.push({
      id: node.id,
      kind: node.kind,
      label: node.label,
      lines: wrapped.lines,
      title: node.title ?? node.label,
      truncated: wrapped.truncated,
      routineId: this.routineId,
      size: sizeFor(node.kind, wrapped.columns, wrapped.lines.length),
      sourceSpan: node.sourceSpan,
      traceLine: node.traceLine,
      visitLine: node.visitLine ?? node.traceLine,
    });
  }

  private addJunction(id: string, sourceSpan?: SourceSpan, traceLine?: number) {
    this.addNode({ id, kind: 'junction', label: '', sourceSpan, traceLine });
  }

  private buildStatement(statement: StatementNode, path: string, isTrailingReturn: boolean): FlowFragment {
    switch (statement.kind) {
      case 'define':
        return this.createSimpleNode(
          statement,
          'process',
          `Definir ${statement.names.join(', ')} Como ${statement.dataType}`,
          path,
        );
      case 'dimension':
        return this.createSimpleNode(
          statement,
          'process',
          `${statement.resize ? 'Redimensionar' : 'Dimension'} ${statement.items.map((item) => `${item.name}[${item.dimensions.map(formatExpression).join(', ')}]`).join(', ')}`,
          path,
        );
      case 'assignment':
        return this.createSimpleNode(
          statement,
          'process',
          `${formatAssignable(statement.target)} <- ${formatExpression(statement.value)}`,
          path,
        );
      case 'write':
        return this.createSimpleNode(
          statement,
          'output',
          `${statement.newline ? 'Escribir' : 'Escribir Sin Saltar'} ${statement.expressions.map(formatExpression).join(', ')}`,
          path,
        );
      case 'read':
        return this.createSimpleNode(
          statement,
          'input',
          `Leer ${statement.targets.map(formatAssignable).join(', ')}`,
          path,
        );
      case 'clear':
        return this.createSimpleNode(statement, 'process', 'Limpiar Pantalla', path);
      case 'wait':
        return this.createSimpleNode(
          statement,
          'process',
          formatWait(statement.mode === 'key' ? undefined : statement.durationMs),
          path,
        );
      case 'return': {
        const label = statement.expression ? `Retornar ${formatExpression(statement.expression)}` : 'Retornar';
        if (isTrailingReturn) {
          return this.createSimpleNode(statement, 'process', label, path);
        }
        // A Retornar in the middle of the routine leaves it: it ends that path.
        const fragment = this.createSimpleNode(statement, 'terminator', label, path);
        return { ...fragment, exits: [] };
      }
      case 'expression':
        return this.createSimpleNode(
          statement,
          this.isRoutineCall(statement.expression) ? 'call' : 'process',
          formatExpression(statement.expression),
          path,
        );
      case 'if':
        return this.buildIf(statement, path);
      case 'while':
        return this.buildWhile(statement, path);
      case 'repeat':
        return this.buildRepeat(statement, path);
      case 'for':
        return this.buildLoop(
          statement,
          `Para ${statement.variable} <- ${formatExpression(statement.start)} Hasta ${formatExpression(statement.end)}${statement.step ? ` Con Paso ${formatExpression(statement.step)}` : ''}`,
          statement.body,
          path,
        );
      case 'forEach':
        return this.buildLoop(
          statement,
          `Para Cada ${statement.variable} De ${formatExpression(statement.collection)}`,
          statement.body,
          path,
        );
      case 'switch':
        return this.buildSwitch(statement, path);
    }
  }

  private isRoutineCall(expression: ExpressionNode): boolean {
    const name = expression.kind === 'call'
      ? expression.callee
      : expression.kind === 'identifier'
        ? expression.name
        : null;
    return name !== null && (expression.kind === 'call' || this.routineNames.has(name.toLowerCase()));
  }

  private buildIf(statement: Extract<StatementNode, { kind: 'if' }>, path: string): FlowFragment {
    const decisionId = nodeId(`${this.routineId}:if`, statement.span, path);
    const junctionId = `${decisionId}:merge`;
    const condition = formatExpression(statement.condition);
    this.addNode({
      id: decisionId,
      kind: 'decision',
      label: condition,
      title: `Si ${condition} Entonces`,
      sourceSpan: statement.span,
      traceLine: statement.span?.start.line,
    });

    const thenFlow = this.buildStatements(statement.thenBranch, `${path}:then`);
    const elseFlow = this.buildStatements(statement.elseBranch, `${path}:else`);
    const reachesEnd = (flow: FlowFragment) => !flow.entryId || flow.exits.length > 0;
    const hasJunction = reachesEnd(thenFlow) || reachesEnd(elseFlow);
    if (hasJunction) this.addJunction(junctionId);

    // Sí leaves through the right corner, No through the left one.
    const arm = (flow: FlowFragment, handle: 'left' | 'right', label: string) => {
      if (flow.entryId) {
        const id = this.addEdge({ source: decisionId, sourceHandle: handle, target: flow.entryId, label, kind: 'branch' });
        this.connectExits(flow.exits, junctionId, handle === 'right' ? 'right-in' : 'left-in', 'merge');
        return id;
      }
      return this.addEdge({
        source: decisionId,
        sourceHandle: handle,
        target: junctionId,
        targetHandle: handle === 'right' ? 'right-in' : 'left-in',
        label,
        kind: 'branch',
      });
    };

    const thenEdgeId = arm(thenFlow, 'right', TRUE_LABEL);
    const elseEdgeId = arm(elseFlow, 'left', FALSE_LABEL);

    return {
      entryId: decisionId,
      exits: hasJunction ? [{ fromId: junctionId }] : [],
      layout: {
        kind: 'if',
        decisionId,
        junctionId: hasJunction ? junctionId : null,
        thenBlock: thenFlow.layout,
        elseBlock: elseFlow.layout,
        thenEdgeId,
        elseEdgeId,
      },
    };
  }

  /**
   * Pre-test loops share one shape: the header (a Mientras diamond or a Para
   * hexagon), the body below it, a back edge around the left side into the
   * header, and the exit out of the right side down to a junction.
   */
  private buildPretestLoop(
    headerId: string,
    bodyStatements: StatementNode[],
    path: string,
    labels: { body?: string; exit?: string },
  ): FlowFragment {
    const junctionId = `${headerId}:exit`;
    const bodyFlow = this.buildStatements(bodyStatements, `${path}:body`);
    this.addJunction(junctionId);
    const backEdgeIds: string[] = [];

    if (bodyFlow.entryId) {
      this.addEdge({ source: headerId, target: bodyFlow.entryId, label: labels.body, kind: labels.body ? 'branch' : 'default' });
      bodyFlow.exits.forEach((exit) => {
        backEdgeIds.push(this.addEdge({
          source: exit.fromId,
          sourceHandle: exit.sourceHandle ?? 'bottom',
          target: headerId,
          targetHandle: 'left-in',
          label: exit.label,
          kind: 'loop',
        }));
      });
    } else {
      // Empty body: the loop goes straight back to its header.
      backEdgeIds.push(this.addEdge({
        source: headerId,
        target: headerId,
        targetHandle: 'left-in',
        label: labels.body,
        kind: 'loop',
      }));
    }

    const exitEdgeId = this.addEdge({
      source: headerId,
      sourceHandle: 'right',
      target: junctionId,
      targetHandle: 'right-in',
      label: labels.exit,
      kind: 'branch',
    });

    return {
      entryId: headerId,
      exits: [{ fromId: junctionId }],
      layout: { kind: 'loop', headerId, body: bodyFlow.layout, junctionId, exitEdgeId, backEdgeIds },
    };
  }

  private buildWhile(statement: Extract<StatementNode, { kind: 'while' }>, path: string): FlowFragment {
    const decisionId = nodeId(`${this.routineId}:while`, statement.span, path);
    const condition = formatExpression(statement.condition);
    this.addNode({
      id: decisionId,
      kind: 'decision',
      label: condition,
      title: `Mientras ${condition} Hacer`,
      sourceSpan: statement.span,
      traceLine: statement.span?.start.line,
    });
    return this.buildPretestLoop(decisionId, statement.body, path, { body: TRUE_LABEL, exit: FALSE_LABEL });
  }

  private buildLoop(
    statement: Extract<StatementNode, { kind: 'for' | 'forEach' }>,
    label: string,
    body: StatementNode[],
    path: string,
  ): FlowFragment {
    const loopId = nodeId(`${this.routineId}:loop`, statement.span, path);
    this.addNode({
      id: loopId,
      kind: 'loop',
      label,
      title: `${label} Hacer`,
      sourceSpan: statement.span,
      traceLine: statement.span?.start.line,
    });
    return this.buildPretestLoop(loopId, body, path, {});
  }

  /**
   * Repetir ... Hasta Que: the body runs first, then the condition; the back
   * edge leaves the diamond's left corner and re-enters above the body.
   */
  private buildRepeat(statement: Extract<StatementNode, { kind: 'repeat' }>, path: string): FlowFragment {
    const entryId = nodeId(`${this.routineId}:repeat`, statement.span, `${path}:entry`);
    const conditionId = nodeId(`${this.routineId}:repeat-condition`, statement.span, `${path}:condition`);
    const line = statement.span?.start.line;
    const condition = formatExpression(statement.condition);
    const until = statement.mode === 'until';
    const conditionSpan = statement.span?.end
      ? { start: { line: statement.span.end.line, column: 1 }, end: statement.span.end } as SourceSpan
      : statement.span;

    this.addJunction(entryId, statement.span, line);
    const bodyFlow = this.buildStatements(statement.body, `${path}:body`);
    this.addNode({
      id: conditionId,
      kind: 'decision',
      label: condition,
      title: `${until ? 'Hasta Que' : 'Mientras Que'} ${condition}`,
      sourceSpan: conditionSpan,
      visitLine: line,
    });

    if (bodyFlow.entryId) {
      this.addEdge({ source: entryId, target: bodyFlow.entryId });
      this.connectExits(bodyFlow.exits, conditionId, 'top');
    } else {
      this.addEdge({ source: entryId, target: conditionId });
    }

    // Hasta Que repeats while the condition is false; Mientras Que while it is true.
    const backEdgeId = this.addEdge({
      source: conditionId,
      sourceHandle: 'left',
      target: entryId,
      targetHandle: 'left-in',
      label: until ? FALSE_LABEL : TRUE_LABEL,
      kind: 'loop',
    });

    return {
      entryId,
      exits: [{ fromId: conditionId, sourceHandle: 'bottom', label: until ? TRUE_LABEL : FALSE_LABEL, kind: 'branch' }],
      layout: { kind: 'repeat', entryId, body: bodyFlow.layout, conditionId, backEdgeId },
    };
  }

  /**
   * Segun: a multi-way decision. Its lanes fan out below it, each labelled
   * with its case values, and merge again in a junction.
   */
  private buildSwitch(statement: Extract<StatementNode, { kind: 'switch' }>, path: string): FlowFragment {
    const switchId = nodeId(`${this.routineId}:switch`, statement.span, path);
    const junctionId = `${switchId}:merge`;
    const expression = formatExpression(statement.expression);
    this.addNode({
      id: switchId,
      kind: 'switch',
      label: expression,
      title: `Segun ${expression} Hacer`,
      sourceSpan: statement.span,
      traceLine: statement.span?.start.line,
    });

    // Without De Otro Modo an unmatched value still goes on: draw that path too.
    const branches = [
      ...statement.cases.map((caseNode, index) => ({
        key: `case-${index}`,
        label: formatCase(caseNode),
        body: caseNode.body,
      })),
      { key: 'default', label: DEFAULT_CASE_LABEL, body: statement.defaultCase },
    ];
    const flows = branches.map((branch) => this.buildStatements(branch.body, `${path}:${branch.key}:body`));
    const reachesEnd = flows.some((flow) => !flow.entryId || flow.exits.length > 0);
    if (reachesEnd) this.addJunction(junctionId);

    const middle = (branches.length - 1) / 2;
    const layoutBranches = branches.map((branch, index) => {
      const flow = flows[index];
      const mergeHandle: FlowTargetHandle = index < middle ? 'left-in' : index > middle ? 'right-in' : 'top';
      let edgeId: string;
      if (flow.entryId) {
        edgeId = this.addEdge({ source: switchId, target: flow.entryId, label: branch.label, kind: 'branch' });
        this.connectExits(flow.exits, junctionId, mergeHandle, 'merge');
      } else {
        edgeId = this.addEdge({ source: switchId, target: junctionId, targetHandle: mergeHandle, label: branch.label, kind: 'branch' });
      }
      return { body: flow.layout, edgeId, label: branch.label };
    });

    return {
      entryId: switchId,
      exits: reachesEnd ? [{ fromId: junctionId }] : [],
      layout: { kind: 'switch', switchId, junctionId: reachesEnd ? junctionId : null, branches: layoutBranches },
    };
  }

  private connectExits(
    exits: FlowExit[],
    target: string,
    targetHandle: FlowTargetHandle,
    kind?: FlowEdgeKind,
  ) {
    exits.forEach((exit) => {
      this.addEdge({
        source: exit.fromId,
        sourceHandle: exit.sourceHandle ?? 'bottom',
        target,
        targetHandle,
        label: exit.label,
        kind: exit.kind ?? kind ?? 'default',
      });
    });
  }

  private createSimpleNode(statement: StatementNode, kind: FlowNodeKind, label: string, path: string): FlowFragment {
    const id = nodeId(`${this.routineId}:${statement.kind}`, statement.span, path);
    this.addNode({
      id,
      kind,
      label,
      sourceSpan: statement.span,
      traceLine: statement.span?.start.line,
    });

    return {
      entryId: id,
      exits: [{ fromId: id }],
      layout: { kind: 'node', nodeId: id },
    };
  }
}

export function buildFlowDiagram(program: ProgramNode): FlowDiagram {
  const routineEntries: Array<MainRoutineNode | RoutineNode> = [program.entry, ...program.routines];
  const routineNames = new Set(program.routines.map((routine) => routine.name.toLowerCase()));

  return {
    routines: routineEntries.map((routine, index) => (
      new FlowDiagramBuilder(routineDiagramId(routine, index), routineNames).createRoutine(routine)
    )),
  };
}
