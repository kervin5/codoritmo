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

export type FlowNodeKind =
  | 'branch'
  | 'decision'
  | 'io'
  | 'loop'
  | 'process'
  | 'switch'
  | 'terminator';

export type FlowEdgeKind = 'branch' | 'default' | 'loop';

export interface FlowNodeSize {
  height: number;
  width: number;
}

export interface FlowNode {
  id: string;
  kind: FlowNodeKind;
  label: string;
  routineId: string;
  size: FlowNodeSize;
  sourceSpan?: SourceSpan;
}

export interface FlowEdge {
  id: string;
  kind: FlowEdgeKind;
  label?: string;
  source: string;
  sourceHandle?: string;
  target: string;
  targetHandle?: string;
}

export interface FlowRoutineDiagram {
  edges: FlowEdge[];
  id: string;
  label: string;
  layout: FlowLayoutBlock;
  nodes: FlowNode[];
}

export interface FlowDiagram {
  routines: FlowRoutineDiagram[];
}

export type FlowLayoutBlock =
  | { kind: 'if'; decisionId: string; elseBlock: FlowLayoutBlock | null; thenBlock: FlowLayoutBlock | null }
  | { kind: 'loop'; body: FlowLayoutBlock | null; loopId: string }
  | { kind: 'node'; nodeId: string }
  | { kind: 'repeat'; body: FlowLayoutBlock | null; conditionId: string; headerId: string }
  | { kind: 'sequence'; blocks: FlowLayoutBlock[]; gap?: number }
  | { branches: Array<{ body: FlowLayoutBlock | null; branchId: string }>; kind: 'switch'; switchId: string }
  | { body: FlowLayoutBlock | null; decisionId: string; kind: 'while' };

type FlowEdgeInput = Omit<FlowEdge, 'id' | 'kind'> & {
  kind?: FlowEdgeKind;
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
  sourceHandle?: string;
}

const NODE_SIZES: Record<FlowNodeKind, FlowNodeSize> = {
  terminator: { width: 210, height: 68 },
  process: { width: 196, height: 80 },
  io: { width: 208, height: 80 },
  decision: { width: 212, height: 132 },
  loop: { width: 216, height: 82 },
  switch: { width: 216, height: 92 },
  branch: { width: 176, height: 70 },
};

function formatExpression(expression: ExpressionNode): string {
  switch (expression.kind) {
    case 'literal':
      return typeof expression.value === 'string'
        ? `"${expression.value}"`
        : String(expression.value);
    case 'identifier':
      return expression.name;
    case 'arrayAccess':
      return `${formatExpression(expression.target)}[${expression.indices.map(formatExpression).join(', ')}]`;
    case 'call':
      return `${expression.callee}(${expression.args.map(formatExpression).join(', ')})`;
    case 'binary':
      return `${formatExpression(expression.left)} ${expression.operator} ${formatExpression(expression.right)}`;
    case 'unary':
      return `${expression.operator} ${formatExpression(expression.operand)}`;
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

class FlowDiagramBuilder {
  private edgeCounter = 0;
  private readonly edges: FlowEdge[] = [];
  private readonly nodes: FlowNode[] = [];

  constructor(private readonly routineId: string) {}

  buildStatements(
    statements: StatementNode[],
    path: string,
    options?: { gap?: number },
  ): FlowFragment {
    let entryId: string | null = null;
    let exits: FlowExit[] = [];
    const layouts: FlowLayoutBlock[] = [];

    statements.forEach((statement, index) => {
      const fragment = this.buildStatement(statement, `${path}-${index}`);

      if (!fragment.entryId) {
        return;
      }

      if (fragment.layout) {
        layouts.push(fragment.layout);
      }

      if (!entryId) {
        entryId = fragment.entryId;
      }

      if (exits.length > 0) {
        this.connectExits(exits, fragment.entryId);
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
          : { kind: 'sequence', blocks: layouts, gap: options?.gap },
    };
  }

  createRoutine(label: string, body: StatementNode[]): FlowRoutineDiagram {
    const startNodeId = `${this.routineId}:start`;
    const endNodeId = `${this.routineId}:end`;

    this.addNode({
      id: startNodeId,
      kind: 'terminator',
      label,
      routineId: this.routineId,
    });

    this.addNode({
      id: endNodeId,
      kind: 'terminator',
      label: 'Fin',
      routineId: this.routineId,
    });

    const bodyFlow = this.buildStatements(body, `${this.routineId}:body`);
    if (bodyFlow.entryId) {
      this.addEdge({
        source: startNodeId,
        target: bodyFlow.entryId,
      });
      this.connectExits(bodyFlow.exits, endNodeId);
    } else {
      this.addEdge({
        source: startNodeId,
        target: endNodeId,
      });
    }

    return {
      id: this.routineId,
      label,
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

  private addEdge(edge: FlowEdgeInput) {
    this.edges.push({
      id: `${edge.source}-${edge.target}-${this.edgeCounter += 1}`,
      kind: edge.kind ?? 'default',
      label: edge.label,
      source: edge.source,
      sourceHandle: edge.sourceHandle,
      target: edge.target,
      targetHandle: edge.targetHandle,
    });
  }

  private addNode(node: Omit<FlowNode, 'size'> & { size?: FlowNodeSize }) {
    this.nodes.push({
      ...node,
      size: node.size ?? NODE_SIZES[node.kind],
    });
  }

  private buildStatement(statement: StatementNode, path: string): FlowFragment {
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
          `Dimension ${statement.items.map((item) => `${item.name}[${item.dimensions.map(formatExpression).join(', ')}]`).join(', ')}`,
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
          'io',
          `${statement.newline ? 'Escribir' : 'Escribir Sin Bajar'} ${statement.expressions.map(formatExpression).join(', ')}`,
          path,
        );
      case 'read':
        return this.createSimpleNode(
          statement,
          'io',
          `Leer ${statement.targets.map(formatAssignable).join(', ')}`,
          path,
        );
      case 'clear':
        return this.createSimpleNode(statement, 'process', 'Limpiar Pantalla', path);
      case 'wait':
        return this.createSimpleNode(
          statement,
          'process',
          statement.mode === 'key'
            ? 'Esperar Tecla'
            : `Esperar ${statement.durationMs ? formatExpression(statement.durationMs) : ''}`.trim(),
          path,
        );
      case 'return':
        return this.createSimpleNode(
          statement,
          'process',
          statement.expression ? `Retornar ${formatExpression(statement.expression)}` : 'Retornar',
          path,
        );
      case 'expression':
        return this.createSimpleNode(statement, 'process', formatExpression(statement.expression), path);
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

  private buildIf(statement: Extract<StatementNode, { kind: 'if' }>, path: string): FlowFragment {
    const decisionId = nodeId(`${this.routineId}:if`, statement.span, path);
    this.addNode({
      id: decisionId,
      kind: 'decision',
      label: `Si ${formatExpression(statement.condition)}`,
      routineId: this.routineId,
      sourceSpan: statement.span,
    });

    const thenFlow = this.buildStatements(statement.thenBranch, `${path}:then`, { gap: 40 });
    const elseFlow = this.buildStatements(statement.elseBranch, `${path}:else`, { gap: 40 });
    const exits: FlowExit[] = [];

    if (thenFlow.entryId) {
      this.addEdge({
        source: decisionId,
        sourceHandle: 'right',
        target: thenFlow.entryId,
        label: 'Si',
        kind: 'branch',
      });
      exits.push(...thenFlow.exits);
    } else {
      exits.push({ fromId: decisionId, sourceHandle: 'right', label: 'Si', kind: 'branch' });
    }

    if (elseFlow.entryId) {
      this.addEdge({
        source: decisionId,
        sourceHandle: 'left',
        target: elseFlow.entryId,
        label: 'No',
        kind: 'branch',
      });
      exits.push(...elseFlow.exits);
    } else {
      exits.push({ fromId: decisionId, sourceHandle: 'left', label: 'No', kind: 'branch' });
    }

    return {
      entryId: decisionId,
      exits,
      layout: {
        kind: 'if',
        decisionId,
        thenBlock: thenFlow.layout,
        elseBlock: elseFlow.layout,
      },
    };
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
      routineId: this.routineId,
      sourceSpan: statement.span,
    });

    const bodyFlow = this.buildStatements(body, `${path}:body`, { gap: 36 });
    if (bodyFlow.entryId) {
      this.addEdge({
        source: loopId,
        sourceHandle: 'bottom',
        target: bodyFlow.entryId,
        label: 'Iterar',
        kind: 'branch',
      });
      bodyFlow.exits.forEach((exit) => {
        this.addEdge({
          source: exit.fromId,
          sourceHandle: exit.sourceHandle ?? 'left',
          target: loopId,
          targetHandle: 'left-in',
          label: exit.label ?? 'Siguiente',
          kind: 'loop',
        });
      });
    }

    return {
      entryId: loopId,
      exits: [{ fromId: loopId, sourceHandle: 'right', label: 'Salir', kind: 'branch' }],
      layout: {
        kind: 'loop',
        loopId,
        body: bodyFlow.layout,
      },
    };
  }

  private buildRepeat(statement: Extract<StatementNode, { kind: 'repeat' }>, path: string): FlowFragment {
    const headerId = nodeId(`${this.routineId}:repeat`, statement.span, `${path}:header`);
    const conditionId = nodeId(`${this.routineId}:repeat-condition`, statement.span, `${path}:condition`);

    this.addNode({
      id: headerId,
      kind: 'loop',
      label: 'Repetir',
      routineId: this.routineId,
      sourceSpan: statement.span,
    });

    this.addNode({
      id: conditionId,
      kind: 'decision',
      label: `${statement.mode === 'until' ? 'Hasta Que' : 'Mientras Que'} ${formatExpression(statement.condition)}`,
      routineId: this.routineId,
      sourceSpan: statement.span,
    });

    const bodyFlow = this.buildStatements(statement.body, `${path}:body`, { gap: 36 });
    if (bodyFlow.entryId) {
      this.addEdge({
        source: headerId,
        sourceHandle: 'bottom',
        target: bodyFlow.entryId,
      });
      this.connectExits(bodyFlow.exits, conditionId);

      if (statement.mode === 'until') {
        this.addEdge({
          source: conditionId,
          sourceHandle: 'left',
          target: headerId,
          targetHandle: 'left-in',
          label: 'Repetir',
          kind: 'loop',
        });

        return {
          entryId: headerId,
          exits: [{ fromId: conditionId, sourceHandle: 'right', label: 'Salir', kind: 'branch' }],
          layout: {
            kind: 'repeat',
            body: bodyFlow.layout,
            conditionId,
            headerId,
          },
        };
      }

      this.addEdge({
        source: conditionId,
        sourceHandle: 'left',
        target: headerId,
        targetHandle: 'left-in',
        label: 'Repetir',
        kind: 'loop',
      });

      return {
        entryId: headerId,
        exits: [{ fromId: conditionId, sourceHandle: 'right', label: 'Salir', kind: 'branch' }],
        layout: {
          kind: 'repeat',
          body: bodyFlow.layout,
          conditionId,
          headerId,
        },
      };
    }

    this.addEdge({
      source: headerId,
      sourceHandle: 'bottom',
      target: conditionId,
    });

    if (statement.mode === 'until') {
      return {
        entryId: headerId,
        exits: [{ fromId: conditionId, sourceHandle: 'right', label: 'Salir', kind: 'branch' }],
        layout: {
          kind: 'repeat',
          body: null,
          conditionId,
          headerId,
        },
      };
    }

    return {
      entryId: headerId,
      exits: [{ fromId: conditionId, sourceHandle: 'right', label: 'Salir', kind: 'branch' }],
      layout: {
        kind: 'repeat',
        body: null,
        conditionId,
        headerId,
      },
    };
  }

  private buildSwitch(statement: Extract<StatementNode, { kind: 'switch' }>, path: string): FlowFragment {
    const switchId = nodeId(`${this.routineId}:switch`, statement.span, path);
    this.addNode({
      id: switchId,
      kind: 'switch',
      label: `Segun ${formatExpression(statement.expression)}`,
      routineId: this.routineId,
      sourceSpan: statement.span,
    });

    const exits: FlowExit[] = [];
    const layoutBranches: Array<{ body: FlowLayoutBlock | null; branchId: string }> = [];
    const branches = [
      ...statement.cases.map((caseNode, index) => ({
        key: `case-${index}`,
        label: `Caso ${formatCase(caseNode)}`,
        span: caseNode.span,
        body: caseNode.body,
      })),
      ...(statement.defaultCase.length > 0
        ? [{ key: 'default', label: 'De Otro Modo', span: statement.span, body: statement.defaultCase }]
        : []),
    ];

    branches.forEach((branch, index) => {
      const branchId = nodeId(`${this.routineId}:switch-branch`, branch.span, `${path}:${branch.key}`);
      this.addNode({
        id: branchId,
        kind: 'branch',
        label: branch.label,
        routineId: this.routineId,
        sourceSpan: branch.span,
      });
      this.addEdge({
        source: switchId,
        sourceHandle: index % 2 === 0 ? 'right' : 'left',
        target: branchId,
        kind: 'branch',
      });

      const bodyFlow = this.buildStatements(branch.body, `${path}:${branch.key}:body`, { gap: 36 });
      layoutBranches.push({
        branchId,
        body: bodyFlow.layout,
      });
      if (bodyFlow.entryId) {
        this.addEdge({
          source: branchId,
          target: bodyFlow.entryId,
        });
        exits.push(...bodyFlow.exits);
      } else {
        exits.push({ fromId: branchId });
      }
    });

    if (branches.length === 0) {
      exits.push({ fromId: switchId });
    }

    return {
      entryId: switchId,
      exits,
      layout: {
        kind: 'switch',
        switchId,
        branches: layoutBranches,
      },
    };
  }

  private buildWhile(statement: Extract<StatementNode, { kind: 'while' }>, path: string): FlowFragment {
    const decisionId = nodeId(`${this.routineId}:while`, statement.span, path);
    this.addNode({
      id: decisionId,
      kind: 'decision',
      label: `Mientras ${formatExpression(statement.condition)}`,
      routineId: this.routineId,
      sourceSpan: statement.span,
    });

    const bodyFlow = this.buildStatements(statement.body, `${path}:body`, { gap: 36 });
    if (bodyFlow.entryId) {
      this.addEdge({
        source: decisionId,
        sourceHandle: 'bottom',
        target: bodyFlow.entryId,
        label: 'Si',
        kind: 'branch',
      });

      bodyFlow.exits.forEach((exit) => {
        this.addEdge({
          source: exit.fromId,
          sourceHandle: exit.sourceHandle ?? 'left',
          target: decisionId,
          targetHandle: 'left-in',
          label: exit.label ?? 'Repetir',
          kind: 'loop',
        });
      });
    }

    return {
      entryId: decisionId,
      exits: [{ fromId: decisionId, sourceHandle: 'right', label: 'No', kind: 'branch' }],
      layout: {
        kind: 'while',
        decisionId,
        body: bodyFlow.layout,
      },
    };
  }

  private connectExits(exits: FlowExit[], target: string) {
    exits.forEach((exit) => {
      this.addEdge({
        source: exit.fromId,
        sourceHandle: exit.sourceHandle,
        target,
        label: exit.label,
        kind: exit.kind ?? 'default',
      });
    });
  }

  private createSimpleNode(statement: StatementNode, kind: FlowNodeKind, label: string, path: string): FlowFragment {
    const id = nodeId(`${this.routineId}:${statement.kind}`, statement.span, path);
    this.addNode({
      id,
      kind,
      label,
      routineId: this.routineId,
      sourceSpan: statement.span,
    });

    return {
      entryId: id,
      exits: [{ fromId: id }],
      layout: { kind: 'node', nodeId: id },
    };
  }
}

export function buildFlowDiagram(program: ProgramNode): FlowDiagram {
  const routines: FlowRoutineDiagram[] = [];
  const routineEntries: Array<MainRoutineNode | RoutineNode> = [program.entry, ...program.routines];

  routineEntries.forEach((routine, index) => {
    const id = routineDiagramId(routine, index);
    const builder = new FlowDiagramBuilder(id);
    routines.push(builder.createRoutine(routineLabel(routine), routine.body));
  });

  return { routines };
}
