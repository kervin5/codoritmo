import { Parser } from '@/src/engine';
import { applyFlowNodeOffsets, buildFlowDiagram, layoutFlowDiagram } from '@/src/diagram';

describe('flow diagram model', () => {
  it('maps structured statements into classic flow nodes', () => {
    const parseResult = new Parser(`Proceso Diagrama
  Leer nombre
  Si nombre = "Ana" Entonces
    Escribir "Hola"
  Sino
    Escribir "Chau"
  FinSi

  Segun nombre Hacer
    Caso "Ana":
      Escribir "A"
    De Otro Modo:
      Escribir "Otro"
  FinSegun
FinProceso`).parse();

    expect(parseResult.program).not.toBeNull();

    const diagram = buildFlowDiagram(parseResult.program!);
    const labels = diagram.routines[0].nodes.map((node) => node.label);

    expect(labels).toEqual(expect.arrayContaining([
      'Proceso Diagrama',
      'Leer nombre',
      'Si nombre = "Ana"',
      'Escribir "Hola"',
      'Escribir "Chau"',
      'Segun nombre',
      'Caso "Ana"',
      'De Otro Modo',
      'Fin',
    ]));
  });

  it('produces stable node ids for the same source', () => {
    const source = `Proceso Estable
  Para i <- 1 Hasta 3 Hacer
    Escribir i
  FinPara
FinProceso`;

    const first = buildFlowDiagram(new Parser(source).parse().program!);
    const second = buildFlowDiagram(new Parser(source).parse().program!);

    expect(first.routines[0].nodes.map((node) => node.id)).toEqual(
      second.routines[0].nodes.map((node) => node.id),
    );
  });

  it('renders Repetir as a post-test loop with a condition node and loopback', () => {
    const source = `Proceso Bucles
  Repetir
    Escribir "Paso"
    i <- i - 1
  Hasta Que i <= 0
FinProceso`;

    const diagram = buildFlowDiagram(new Parser(source).parse().program!);
    const routine = diagram.routines[0];

    expect(routine.nodes.map((node) => node.label)).toEqual(expect.arrayContaining([
      'Repetir',
      'Escribir "Paso"',
      'i <- i - 1',
      'Hasta Que i <= 0',
    ]));

    const conditionNode = routine.nodes.find((node) => node.label === 'Hasta Que i <= 0');
    const bodyNode = routine.nodes.find((node) => node.label === 'Escribir "Paso"');
    const repeatNode = routine.nodes.find((node) => node.label === 'Repetir');

    expect(conditionNode).toBeDefined();
    expect(bodyNode).toBeDefined();
    expect(repeatNode).toBeDefined();
    expect(routine.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: repeatNode?.id,
        target: bodyNode?.id,
      }),
      expect.objectContaining({
        source: conditionNode?.id,
        target: repeatNode?.id,
        label: 'Repetir',
        kind: 'loop',
        targetHandle: 'left-in',
      }),
    ]));
  });

  it('keeps repeat body nodes above the condition in the structured layout', async () => {
    const source = `Proceso Bucles
  Repetir
    Escribir "Paso"
    i <- i - 1
  Hasta Que i <= 0
FinProceso`;

    const diagram = buildFlowDiagram(new Parser(source).parse().program!);
    const positioned = await layoutFlowDiagram(diagram);
    const routine = positioned.routines[0];
    const repeatNode = routine.nodes.find((node) => node.label === 'Repetir');
    const writeNode = routine.nodes.find((node) => node.label === 'Escribir "Paso"');
    const assignNode = routine.nodes.find((node) => node.label === 'i <- i - 1');
    const conditionNode = routine.nodes.find((node) => node.label === 'Hasta Que i <= 0');

    expect(repeatNode).toBeDefined();
    expect(writeNode).toBeDefined();
    expect(assignNode).toBeDefined();
    expect(conditionNode).toBeDefined();
    expect((repeatNode?.position.y ?? 0)).toBeLessThan(writeNode?.position.y ?? 0);
    expect((writeNode?.position.y ?? 0)).toBeLessThan(assignNode?.position.y ?? 0);
    expect((assignNode?.position.y ?? 0)).toBeLessThan(conditionNode?.position.y ?? 0);
  });

  it('keeps for loop bodies below the loop header in the structured layout', async () => {
    const source = `Proceso Bucles
  Para i <- 1 Hasta 3 Hacer
    Escribir i
  FinPara
FinProceso`;

    const diagram = buildFlowDiagram(new Parser(source).parse().program!);
    const positioned = await layoutFlowDiagram(diagram);
    const routine = positioned.routines[0];
    const loopNode = routine.nodes.find((node) => node.label === 'Para i <- 1 Hasta 3');
    const bodyNode = routine.nodes.find((node) => node.label === 'Escribir i');

    expect(loopNode).toBeDefined();
    expect(bodyNode).toBeDefined();
    expect((loopNode?.position.y ?? 0)).toBeLessThan(bodyNode?.position.y ?? 0);
  });

  it('applies stored offsets on top of the structured layout', async () => {
    const source = `Proceso Posiciones
  Escribir "Uno"
  Escribir "Dos"
FinProceso`;

    const diagram = buildFlowDiagram(new Parser(source).parse().program!);
    const positioned = await layoutFlowDiagram(diagram);
    const routine = positioned.routines[0];
    const targetNode = routine.nodes.find((node) => node.label === 'Escribir "Uno"');

    expect(targetNode).toBeDefined();

    const adjusted = applyFlowNodeOffsets(routine, {
      [targetNode!.id]: { x: 48, y: -20 },
    });
    const adjustedNode = adjusted.nodes.find((node) => node.id === targetNode!.id);

    expect(adjustedNode?.position.x).toBe((targetNode?.position.x ?? 0) + 48);
    expect(adjustedNode?.position.y).toBe((targetNode?.position.y ?? 0) - 20);
  });
});
