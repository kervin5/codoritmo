import { Parser } from '@/src/engine';
import {
  applyFlowNodeOffsets,
  buildFlowDiagram,
  exportRoutineToSvg,
  layoutFlowDiagram,
  layoutFlowDiagramSync,
  tokenizeLabel,
  wrapLabel,
  type FlowRoutineDiagram,
} from '@/src/diagram';

function diagramOf(source: string) {
  const parsed = new Parser(source).parse();
  expect(parsed.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return buildFlowDiagram(parsed.program!);
}

function main(source: string) {
  return diagramOf(source).routines[0];
}

function byLabel(routine: FlowRoutineDiagram, label: string) {
  const node = routine.nodes.find((candidate) => candidate.label === label);
  if (!node) throw new Error(`No node "${label}" in ${routine.nodes.map((n) => n.label).join(' | ')}`);
  return node;
}

function edgesFrom(routine: FlowRoutineDiagram, id: string) {
  return routine.edges.filter((edge) => edge.source === id);
}

function edgesTo(routine: FlowRoutineDiagram, id: string) {
  return routine.edges.filter((edge) => edge.target === id);
}

describe('flow diagram symbols', () => {
  const routine = main(`Proceso Simbolos
  Definir x Como Entero
  Dimension v[5]
  Leer x
  x <- x + 1
  Escribir "x vale ", x
  Limpiar Pantalla
  Esperar 2 Segundos
  Esperar Tecla
FinProceso`);

  it('draws start and end as terminators', () => {
    expect(byLabel(routine, 'Proceso Simbolos').kind).toBe('terminator');
    expect(byLabel(routine, 'FinProceso').kind).toBe('terminator');
  });

  it('draws Definir, Dimension and assignments as processes', () => {
    expect(byLabel(routine, 'Definir x Como Entero').kind).toBe('process');
    expect(byLabel(routine, 'Dimension v[5]').kind).toBe('process');
    expect(byLabel(routine, 'x <- x + 1').kind).toBe('process');
  });

  it('tells input from output', () => {
    expect(byLabel(routine, 'Leer x').kind).toBe('input');
    expect(byLabel(routine, 'Escribir "x vale ", x').kind).toBe('output');
  });

  it('labels Limpiar Pantalla and Esperar as processes in PSeInt words', () => {
    expect(byLabel(routine, 'Limpiar Pantalla').kind).toBe('process');
    expect(byLabel(routine, 'Esperar 2 Segundos').kind).toBe('process');
    expect(byLabel(routine, 'Esperar Tecla').kind).toBe('process');
  });

  it('chains a sequence bottom to top', () => {
    routine.edges.forEach((edge) => {
      expect(edge.kind).toBe('default');
      expect(edge.sourceHandle).toBe('bottom');
      expect(edge.targetHandle).toBe('top');
    });
    expect(routine.edges).toHaveLength(routine.nodes.length - 1);
  });

  it('routes the sequence as straight vertical lines', () => {
    const positioned = layoutFlowDiagramSync(diagramOf(`Proceso P
  Definir a Como Entero
  Escribir "Hola"
  Leer a
FinProceso`)).routines[0];
    positioned.edges.forEach((edge) => {
      expect(edge.points).toHaveLength(2);
      expect(edge.points[0].x).toBe(edge.points[1].x);
    });
  });
});

describe('Si', () => {
  const routine = main(`Proceso P
  Leer n
  Si n > 0 Entonces
    Escribir "positivo"
  Sino
    Escribir "no positivo"
  FinSi
  Escribir "fin"
FinProceso`);
  const decision = byLabel(routine, 'n > 0');

  it('is a diamond showing the condition', () => {
    expect(decision.kind).toBe('decision');
    expect(decision.title).toBe('Si n > 0 Entonces');
  });

  it('leaves through the sides labelled Sí (right) and No (left)', () => {
    const out = edgesFrom(routine, decision.id);
    expect(out).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Sí', sourceHandle: 'right', target: byLabel(routine, 'Escribir "positivo"').id, targetHandle: 'top' }),
      expect.objectContaining({ label: 'No', sourceHandle: 'left', target: byLabel(routine, 'Escribir "no positivo"').id, targetHandle: 'top' }),
    ]));
  });

  it('merges both branches in a junction below, then continues', () => {
    const junction = routine.nodes.find((node) => node.kind === 'junction')!;
    const merges = edgesTo(routine, junction.id);
    expect(merges.map((edge) => [edge.kind, edge.targetHandle]).sort()).toEqual([['merge', 'left-in'], ['merge', 'right-in']]);
    expect(edgesFrom(routine, junction.id)).toEqual([
      expect.objectContaining({ target: byLabel(routine, 'Escribir "fin"').id, sourceHandle: 'bottom', targetHandle: 'top' }),
    ]);
  });

  it('places Sí to the right and No to the left, below the diamond', () => {
    const positioned = layoutFlowDiagramSync(diagramOf(`Proceso P
  Si n > 0 Entonces
    Escribir "positivo"
  Sino
    Escribir "no positivo"
  FinSi
FinProceso`)).routines[0];
    const d = positioned.nodes.find((n) => n.kind === 'decision')!;
    const yes = positioned.nodes.find((n) => n.label === 'Escribir "positivo"')!;
    const no = positioned.nodes.find((n) => n.label === 'Escribir "no positivo"')!;
    const center = d.position.x + d.size.width / 2;
    expect(yes.position.x).toBeGreaterThan(center);
    expect(no.position.x + no.size.width).toBeLessThan(center);
    expect(yes.position.y).toBeGreaterThan(d.position.y + d.size.height);
    const yesEdge = positioned.edges.find((e) => e.label === 'Sí')!;
    expect(yesEdge.points).toHaveLength(3);
    expect(yesEdge.points[0].y).toBe(yesEdge.points[1].y);
  });

  it('routes an empty Sino straight to the junction along its lane', () => {
    const positioned = layoutFlowDiagramSync(diagramOf(`Proceso P
  Si n > 0 Entonces
    Escribir "positivo"
  FinSi
FinProceso`)).routines[0];
    const noEdge = positioned.edges.find((e) => e.label === 'No')!;
    const junction = positioned.nodes.find((n) => n.kind === 'junction')!;
    expect(noEdge.target).toBe(junction.id);
    expect(noEdge.targetHandle).toBe('left-in');
    expect(noEdge.points).toHaveLength(4);
  });
});

describe('Mientras', () => {
  const routine = main(`Proceso P
  i <- 0
  Mientras i < 3 Hacer
    i <- i + 1
  FinMientras
  Escribir i
FinProceso`);
  const decision = byLabel(routine, 'i < 3');

  it('is a diamond with Sí into the body and No out of the right side', () => {
    expect(decision.kind).toBe('decision');
    expect(edgesFrom(routine, decision.id)).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Sí', sourceHandle: 'bottom', target: byLabel(routine, 'i <- i + 1').id }),
      expect.objectContaining({ label: 'No', sourceHandle: 'right', targetHandle: 'right-in', kind: 'branch' }),
    ]));
  });

  it('closes the loop with a back edge into the left corner', () => {
    expect(edgesTo(routine, decision.id)).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'loop', source: byLabel(routine, 'i <- i + 1').id, targetHandle: 'left-in' }),
    ]));
  });

  it('runs the back edge around the left side of the body', () => {
    const positioned = layoutFlowDiagramSync(diagramOf(`Proceso P
  Mientras i < 3 Hacer
    i <- i + 1
  FinMientras
FinProceso`)).routines[0];
    const back = positioned.edges.find((e) => e.kind === 'loop')!;
    const body = positioned.nodes.find((n) => n.label === 'i <- i + 1')!;
    const laneX = Math.min(...back.points.map((p) => p.x));
    expect(laneX).toBeLessThan(body.position.x);
    expect(back.points[back.points.length - 1].y).toBeLessThan(back.points[0].y);
  });
});

describe('Repetir', () => {
  const source = `Proceso Bucles
  Repetir
    Escribir "Paso"
    i <- i - 1
    Si i = 2 Entonces
      Escribir "dos"
    FinSi
  Hasta Que i <= 0
FinProceso`;
  const routine = main(source);
  const condition = byLabel(routine, 'i <= 0');

  it('runs the body first and tests the condition after it', () => {
    const entry = routine.nodes.find((node) => node.kind === 'junction' && node.traceLine !== undefined)!;
    expect(edgesFrom(routine, entry.id)[0].target).toBe(byLabel(routine, 'Escribir "Paso"').id);
    expect(condition.kind).toBe('decision');
    expect(condition.title).toBe('Hasta Que i <= 0');
  });

  it('repeats on No with a back edge out of the left corner, leaves on Sí', () => {
    const entry = routine.nodes.find((node) => node.kind === 'junction' && node.traceLine !== undefined)!;
    expect(edgesFrom(routine, condition.id)).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'loop', label: 'No', sourceHandle: 'left', target: entry.id, targetHandle: 'left-in' }),
      expect.objectContaining({ kind: 'branch', label: 'Sí', sourceHandle: 'bottom' }),
    ]));
  });

  it('keeps the body between the entry and the condition', async () => {
    const positioned = (await layoutFlowDiagram(diagramOf(source))).routines[0];
    const y = (label: string) => positioned.nodes.find((n) => n.label === label)!.position.y;
    expect(y('Escribir "Paso"')).toBeLessThan(y('i <- i - 1'));
    expect(y('i <- i - 1')).toBeLessThan(y('i <= 0'));
    expect(y('Escribir "dos"')).toBeLessThan(y('i <= 0'));
  });

  it('labels Mientras Que the other way round', () => {
    const r = main(`Proceso P
  Repetir
    i <- i + 1
  Mientras Que i < 5
FinProceso`);
    const cond = byLabel(r, 'i < 5');
    expect(edgesFrom(r, cond.id)).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'loop', label: 'Sí' }),
      expect.objectContaining({ kind: 'branch', label: 'No' }),
    ]));
  });
});

describe('Para and Para Cada', () => {
  const routine = main(`Proceso P
  Dimension v[3]
  Para i <- 1 Hasta 3 Con Paso 1 Hacer
    v[i] <- i
  FinPara
  Para Cada x De v Hacer
    Escribir x
  FinPara
FinProceso`);

  it('draws the header as a preparation hexagon', () => {
    expect(byLabel(routine, 'Para i <- 1 Hasta 3 Con Paso 1').kind).toBe('loop');
    expect(byLabel(routine, 'Para Cada x De v').kind).toBe('loop');
  });

  it('loops back into the hexagon and exits from its right side', () => {
    const header = byLabel(routine, 'Para i <- 1 Hasta 3 Con Paso 1');
    expect(edgesTo(routine, header.id)).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'loop', targetHandle: 'left-in' }),
    ]));
    expect(edgesFrom(routine, header.id)).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceHandle: 'bottom', target: byLabel(routine, 'v[i] <- i').id }),
      expect.objectContaining({ sourceHandle: 'right', targetHandle: 'right-in' }),
    ]));
  });

  it('keeps for loop bodies below the header', () => {
    const positioned = layoutFlowDiagramSync(diagramOf(`Proceso Bucles
  Para i <- 1 Hasta 3 Hacer
    Escribir i
  FinPara
FinProceso`)).routines[0];
    const loopNode = positioned.nodes.find((node) => node.label === 'Para i <- 1 Hasta 3')!;
    const bodyNode = positioned.nodes.find((node) => node.label === 'Escribir i')!;
    expect(loopNode.position.y).toBeLessThan(bodyNode.position.y);
  });
});

describe('Segun', () => {
  const routine = main(`Proceso P
  Leer op
  Segun op Hacer
    1:
      Escribir "uno"
    2, 3:
      Escribir "dos o tres"
    De Otro Modo:
      Escribir "otro"
  FinSegun
FinProceso`);
  const switchNode = byLabel(routine, 'op');

  it('is a multi-way decision whose lanes are labelled with the case values', () => {
    expect(switchNode.kind).toBe('switch');
    expect(edgesFrom(routine, switchNode.id).map((edge) => edge.label)).toEqual(['1', '2, 3', 'De Otro Modo']);
    edgesFrom(routine, switchNode.id).forEach((edge) => {
      expect(edge.sourceHandle).toBe('bottom');
      expect(edge.kind).toBe('branch');
    });
  });

  it('merges every lane into one junction', () => {
    const junction = routine.nodes.find((node) => node.kind === 'junction')!;
    expect(edgesTo(routine, junction.id).map((edge) => edge.targetHandle)).toEqual(['left-in', 'top', 'right-in']);
  });

  it('fans the lanes out side by side under the switch', () => {
    const positioned = layoutFlowDiagramSync(diagramOf(`Proceso P
  Segun op Hacer
    1:
      Escribir "uno"
    2:
      Escribir "dos"
  FinSegun
FinProceso`)).routines[0];
    const xs = ['Escribir "uno"', 'Escribir "dos"'].map((label) => positioned.nodes.find((n) => n.label === label)!.position.x);
    expect(xs[0]).toBeLessThan(xs[1]);
    const fan = positioned.edges.filter((e) => e.kind === 'branch');
    expect(fan.map((e) => e.label)).toEqual(['1', '2', 'De Otro Modo']);
    fan.forEach((e) => expect(e.labelPosition).toBeDefined());
  });

  it('still draws the path for unmatched values when there is no De Otro Modo', () => {
    const r = main(`Proceso P
  Segun op Hacer
    1:
      Escribir "uno"
  FinSegun
FinProceso`);
    const s = byLabel(r, 'op');
    expect(edgesFrom(r, s.id).map((edge) => edge.label)).toEqual(['1', 'De Otro Modo']);
  });
});

describe('subprocesses and functions', () => {
  const diagram = diagramOf(`Funcion r <- Doble(n)
  r <- n * 2
FinFuncion

SubProceso Saludar(nombre Por Referencia)
  Escribir "Hola ", nombre
FinSubProceso

SubProceso Separador
  Escribir "---"
FinSubProceso

Proceso P
  Definir t Como Caracter
  Saludar(t)
  Separador
  Escribir Doble(3)
FinProceso`);
  const [mainRoutine, doble, saludar] = diagram.routines;

  it('draws a call as a predefined process', () => {
    expect(byLabel(mainRoutine, 'Saludar(t)').kind).toBe('call');
    expect(byLabel(mainRoutine, 'Separador').kind).toBe('call');
    expect(byLabel(mainRoutine, 'Escribir Doble(3)').kind).toBe('output');
  });

  it('names each routine with its parameters on its terminators', () => {
    expect(doble.name).toBe('Doble');
    expect(byLabel(doble, 'Funcion r <- Doble(n)').kind).toBe('terminator');
    expect(byLabel(doble, 'FinFuncion (devuelve r)').kind).toBe('terminator');
    expect(byLabel(saludar, 'SubProceso Saludar(nombre Por Referencia)').kind).toBe('terminator');
    expect(byLabel(saludar, 'FinSubProceso').kind).toBe('terminator');
  });
});

describe('Retornar', () => {
  it('flows into Fin when it is the last statement', () => {
    const routine = diagramOf(`Funcion r <- F(n)
  Retornar n
FinFuncion
Proceso P
  Escribir F(1)
FinProceso`).routines[1];
    const ret = byLabel(routine, 'Retornar n');
    expect(ret.kind).toBe('process');
    expect(edgesFrom(routine, ret.id)).toHaveLength(1);
  });

  it('ends its path when it returns early', () => {
    const routine = diagramOf(`Funcion r <- F(n)
  Si n < 0 Entonces
    Retornar 0
  FinSi
  r <- n
FinFuncion
Proceso P
  Escribir F(1)
FinProceso`).routines[1];
    const ret = byLabel(routine, 'Retornar 0');
    expect(ret.kind).toBe('terminator');
    expect(edgesFrom(routine, ret.id)).toHaveLength(0);
  });
});

describe('nested structures', () => {
  const source = `Proceso Anidado
  Mientras a < 10 Hacer
    Para i <- 1 Hasta 3 Hacer
      Si i = 2 Entonces
        Escribir "dos"
      Sino
        Segun i Hacer
          1: Escribir "uno"
          De Otro Modo: Escribir "otro"
        FinSegun
      FinSi
    FinPara
    Repetir
      a <- a + 1
      Si a = 5 Entonces
        Escribir "cinco"
      FinSi
    Hasta Que a > 4
  FinMientras
FinProceso`;

  it('lays out without overlaps and keeps nested back-edge lanes apart', () => {
    const positioned = layoutFlowDiagramSync(diagramOf(source)).routines[0];
    const nodes = positioned.nodes;
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        const overlap = a.position.x < b.position.x + b.size.width && b.position.x < a.position.x + a.size.width
          && a.position.y < b.position.y + b.size.height && b.position.y < a.position.y + a.size.height;
        expect(overlap).toBe(false);
      }
    }
    const lanes = positioned.edges
      .filter((edge) => edge.kind === 'loop')
      .map((edge) => Math.min(...edge.points.map((p) => p.x)));
    expect(new Set(lanes).size).toBe(lanes.length);
  });

  it('produces stable node ids for the same source', () => {
    expect(diagramOf(source).routines[0].nodes.map((node) => node.id))
      .toEqual(diagramOf(source).routines[0].nodes.map((node) => node.id));
  });
});

describe('labels', () => {
  it('tokenizes keywords, types, strings, numbers and operators', () => {
    const types = (text: string) => tokenizeLabel(text).filter((t) => t.type !== 'space').map((t) => [t.text, t.type]);
    expect(types('Definir x Como Entero')).toEqual([
      ['Definir', 'keyword'], ['x', 'identifier'], ['Como', 'keyword'], ['Entero', 'type'],
    ]);
    expect(types('Escribir "a b", n + 1.5')).toEqual([
      ['Escribir', 'keyword'], ['"a b"', 'string'], [',', 'punctuation'], ['n', 'identifier'], ['+', 'operator'], ['1.5', 'number'],
    ]);
    expect(types('x <- NO b')).toEqual([['x', 'identifier'], ['<-', 'operator'], ['NO', 'keyword'], ['b', 'identifier']]);
  });

  it('wraps long labels and truncates with an ellipsis', () => {
    const wrapped = wrapLabel('Escribir "uno dos tres cuatro cinco seis siete ocho nueve diez once doce"', 16, 2);
    expect(wrapped.lines).toHaveLength(2);
    expect(wrapped.truncated).toBe(true);
    expect(wrapped.lines[1][wrapped.lines[1].length - 1].text).toBe('…');
    wrapped.lines.forEach((line) => {
      expect(line.map((t) => t.text).join('').length).toBeLessThanOrEqual(16);
    });
    // Colours survive the wrap: the string keeps its type on both lines.
    expect(wrapped.lines[1].some((t) => t.type === 'string')).toBe(true);
  });

  it('keeps the full text for the tooltip and grows the block for long labels', () => {
    const routine = main(`Proceso P
  Escribir "Este es un mensaje bastante largo para un solo renglón del diagrama de flujo, de verdad muy largo"
  Escribir "corto"
FinProceso`);
    const long = routine.nodes.find((n) => n.label.includes('bastante'))!;
    const short = byLabel(routine, 'Escribir "corto"');
    expect(long.truncated).toBe(true);
    expect(long.title).toContain('de verdad muy largo');
    expect(long.size.height).toBeGreaterThan(short.size.height);
    expect(long.size.width).toBeGreaterThan(short.size.width);
  });

  it('writes logical operators and booleans the PSeInt way', () => {
    const routine = main(`Proceso P
  Si a > 1 Y NO b O c = Verdadero Entonces
    x <- 7 MOD 2
  FinSi
FinProceso`);
    expect(routine.nodes.map((n) => n.label)).toEqual(expect.arrayContaining([
      'a > 1 Y NO b O c = Verdadero',
      'x <- 7 MOD 2',
    ]));
  });
});

describe('export', () => {
  it('draws the same routed connectors and highlighted labels', () => {
    const positioned = layoutFlowDiagramSync(diagramOf(`Proceso P
  Si n > 0 Entonces
    Escribir "positivo"
  FinSi
FinProceso`)).routines[0];
    const { svg } = exportRoutineToSvg(positioned);
    expect(svg).toContain('marker-end="url(#arrow-branch)"');
    expect(svg).toContain('>Sí</text>');
    expect(svg).toContain('<tspan fill="#94540f">&quot;positivo&quot;</tspan>');
    expect((svg.match(/<path d="M [^"]*"[^>]*marker-end/g) ?? []).length).toBe(positioned.edges.length);
  });

  it('applies stored offsets and re-routes connectors', async () => {
    const positioned = (await layoutFlowDiagram(diagramOf(`Proceso Posiciones
  Escribir "Uno"
  Escribir "Dos"
FinProceso`))).routines[0];
    const target = positioned.nodes.find((node) => node.label === 'Escribir "Uno"')!;
    const adjusted = applyFlowNodeOffsets(positioned, { [target.id]: { x: 48, y: -20 } });
    const moved = adjusted.nodes.find((node) => node.id === target.id)!;
    expect(moved.position).toEqual({ x: target.position.x + 48, y: target.position.y - 20 });
    const into = adjusted.edges.find((edge) => edge.target === target.id)!;
    expect(into.points[into.points.length - 1]).toEqual({ x: moved.position.x + moved.size.width / 2, y: moved.position.y });
  });
});
