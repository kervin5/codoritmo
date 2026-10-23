import { examplePrograms, normalizeEngineSettings, Parser } from '@/src/engine';
import {
  applyIoShapes,
  buildFlowDiagram,
  buildNassiDiagram,
  exportNassiToSvg,
  exportRoutineToSvg,
  layoutFlowDiagramSync,
  shapeForKind,
  shapeGeometry,
  type NassiCell,
  type NassiRoutine,
} from '@/src/diagram';
import { NASSI_LOOP_STRIP } from '@/src/diagram/nassi';

function nassiOf(source: string) {
  const parsed = new Parser(source).parse();
  expect(parsed.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return buildNassiDiagram(buildFlowDiagram(parsed.program!));
}

const main = (source: string) => nassiOf(source).routines[0];

const textOf = (cell: NassiCell) => cell.text?.lines.map((line) => line.map((t) => t.text).join('')).join(' ') ?? '';

function cell(routine: NassiRoutine, text: string): NassiCell {
  const found = routine.cells.find((c) => textOf(c) === text);
  if (!found) throw new Error(`No cell "${text}" in ${routine.cells.map(textOf).join(' | ')}`);
  return found;
}

/** Boxes tile the routine: no two overlap, and together they cover it exactly (area check). */
function expectTiling(routine: NassiRoutine) {
  const area = (c: NassiCell) => {
    switch (c.kind) {
      case 'if':
      case 'switch':
      case 'case':
      case 'simple':
      case 'terminator':
      case 'empty':
        return c.width * c.height;
      default:
        return 0; // a loop's L-shape is measured below
    }
  };
  let total = routine.cells.reduce((sum, c) => sum + area(c), 0);
  routine.cells.filter((c) => c.kind === 'loop' || c.kind === 'repeat').forEach((loop) => {
    const inside = routine.cells.filter((c) => c !== loop && c.x >= loop.x + NASSI_LOOP_STRIP - 0.5 && c.x + c.width <= loop.x + loop.width + 0.5 && c.y >= loop.y - 0.5 && c.y + c.height <= loop.y + loop.height + 0.5);
    const bar = loop.height - Math.max(...inside.map((c) => c.y + c.height)) + Math.min(...inside.map((c) => c.y));
    total += loop.width * bar + NASSI_LOOP_STRIP * (loop.height - bar);
  });
  expect(Math.round(total)).toBe(Math.round(routine.width * routine.height));
  routine.cells.forEach((c) => {
    expect(c.x).toBeGreaterThanOrEqual(0);
    expect(c.y).toBeGreaterThanOrEqual(0);
    expect(c.x + c.width).toBeLessThanOrEqual(routine.width + 0.01);
    expect(c.y + c.height).toBeLessThanOrEqual(routine.height + 0.01);
  });
}

describe('Nassi-Shneiderman layout', () => {
  test('a sequence is a stack of boxes, all as wide as the routine, between Algoritmo and FinAlgoritmo', () => {
    const routine = main(`Algoritmo Saludo
  Definir nombre Como Cadena
  Escribir "Nombre?"
  Leer nombre
  Escribir "Hola ", nombre
FinAlgoritmo`);
    expect(routine.cells.map(textOf)).toEqual([
      'Algoritmo Saludo',
      'Definir nombre Como Cadena',
      'Escribir "Nombre?"',
      'Leer nombre',
      'Escribir "Hola ", nombre',
      'FinAlgoritmo',
    ]);
    routine.cells.forEach((c) => {
      expect(c.x).toBe(0);
      expect(c.width).toBe(routine.width);
    });
    for (let i = 1; i < routine.cells.length; i += 1) {
      expect(routine.cells[i].y).toBe(routine.cells[i - 1].y + routine.cells[i - 1].height);
    }
    expect(cell(routine, 'Leer nombre')).toMatchObject({ kind: 'simple', tone: 'input', line: 4, traceLine: 4 });
    expect(cell(routine, 'Algoritmo Saludo').kind).toBe('terminator');
    expectTiling(routine);
  });

  test('Si: a header with diagonals meeting over the split, Sí column left and No column right', () => {
    const routine = main(`Algoritmo Signo
  Leer x
  Si x > 0 Entonces
    Escribir "positivo"
    Escribir "listo"
  SiNo
    Escribir "no positivo"
  FinSi
FinAlgoritmo`);
    const header = cell(routine, 'x > 0');
    expect(header).toMatchObject({ kind: 'if', tone: 'decision', line: 3, traceLine: 3 });
    expect(header.tags?.map((tag) => tag.text)).toEqual(['Sí', 'No']);
    const yes = cell(routine, 'Escribir "positivo"');
    const no = cell(routine, 'Escribir "no positivo"');
    expect(yes.x).toBe(header.x);
    expect(yes.y).toBe(header.y + header.height);
    expect(no.x).toBe(yes.x + yes.width);
    expect(no.x + no.width).toBe(header.x + header.width);
    // The diagonals meet at the split, at the bottom of the header.
    expect(header.details).toContain(`${no.x},${header.y + header.height}`);
    // The shorter No column ends in an empty slot down to the end of the Sí column.
    const done = cell(routine, 'Escribir "listo"');
    const empty = routine.cells.find((c) => c.kind === 'empty');
    expect(empty).toMatchObject({ x: no.x, y: no.y + no.height, width: no.width });
    expect(empty!.y + empty!.height).toBe(done.y + done.height);
    // The condition sits inside the triangle, above where the diagonals close in.
    const text = header.text!;
    const textWidth = Math.max(...text.lines.map((line) => line.reduce((n, t) => n + t.text.length, 0))) * 7.9;
    expect(text.x - textWidth / 2).toBeGreaterThan(header.x);
    expect(text.x + textWidth / 2).toBeLessThan(header.x + header.width);
    expectTiling(routine);
  });

  test('Si without SiNo leaves an empty No column', () => {
    const routine = main(`Algoritmo Uno
  Leer x
  Si x > 0 Entonces
    Escribir x
  FinSi
FinAlgoritmo`);
    const header = cell(routine, 'x > 0');
    const empty = routine.cells.find((c) => c.kind === 'empty')!;
    expect(empty.y).toBe(header.y + header.height);
    expect(empty.x + empty.width).toBe(header.x + header.width);
    expectTiling(routine);
  });

  test('Mientras and Para: a bar across the top, the body indented under it', () => {
    const routine = main(`Algoritmo Bucles
  i <- 0
  Mientras i < 3 Hacer
    i <- i + 1
  FinMientras
  Para j <- 1 Hasta 5 Con Paso 2 Hacer
    Escribir j
  FinPara
FinAlgoritmo`);
    const loop = cell(routine, 'Mientras i < 3');
    expect(loop).toMatchObject({ kind: 'loop', tone: 'loop', line: 3, traceLine: 3, x: 0, width: routine.width });
    const body = cell(routine, 'i <- i + 1');
    expect(body.x).toBe(loop.x + NASSI_LOOP_STRIP);
    expect(body.x + body.width).toBe(loop.x + loop.width);
    expect(body.y).toBeGreaterThan(loop.y);
    expect(body.y + body.height).toBe(loop.y + loop.height);
    expect(loop.text!.anchor).toBe('start');
    const para = cell(routine, 'Para j <- 1 Hasta 5 Con Paso 2');
    expect(para.kind).toBe('loop');
    expect(cell(routine, 'Escribir j').x).toBe(NASSI_LOOP_STRIP);
    expectTiling(routine);
  });

  test('Repetir: the body on top, the condition bar at the bottom', () => {
    const routine = main(`Algoritmo Rep
  Repetir
    Leer x
  Hasta Que x > 0
FinAlgoritmo`);
    const loop = cell(routine, 'Hasta Que x > 0');
    const body = cell(routine, 'Leer x');
    expect(loop.kind).toBe('repeat');
    expect(body.y).toBe(loop.y);
    expect(body.x).toBe(NASSI_LOOP_STRIP);
    expect(loop.text!.y).toBeGreaterThan(body.y + body.height);
    // Lights up with the Repetir line (what the interpreter reports), jumps to Hasta Que.
    expect(loop.traceLine).toBe(2);
    expect(loop.line).toBe(4);
    expectTiling(routine);
  });

  test('Segun: one column per case plus De Otro Modo, under a row of case labels', () => {
    const routine = main(`Algoritmo Menu
  Leer op
  Segun op Hacer
    1:
      Escribir "uno"
    2, 3:
      Escribir "dos o tres"
      Escribir "!"
    De Otro Modo:
      Escribir "otro"
  FinSegun
FinAlgoritmo`);
    const header = cell(routine, 'op');
    expect(header).toMatchObject({ kind: 'switch', tone: 'switch', line: 3 });
    const cases = routine.cells.filter((c) => c.kind === 'case');
    expect(cases.map(textOf)).toEqual(['1', '2, 3', 'De Otro Modo']);
    expect(cases.reduce((sum, c) => sum + c.width, 0)).toBe(header.width);
    cases.forEach((c) => expect(c.y).toBe(header.y + header.height));
    // The diagonals meet over the left edge of the De Otro Modo column.
    expect(header.details).toContain(`${cases[2].x},${header.y + header.height}`);
    const one = cell(routine, 'Escribir "uno"');
    expect(one.x).toBe(cases[0].x);
    expect(one.y).toBe(cases[0].y + cases[0].height);
    expect(cell(routine, 'Escribir "otro"').x).toBe(cases[2].x);
    expectTiling(routine);
  });

  test('nested structures and subprocess calls', () => {
    const diagram = nassiOf(`Funcion r <- Doble(x)
  r <- x * 2
FinFuncion
SubProceso Saludar
  Escribir "hola"
FinSubProceso
Algoritmo Nido
  Para i <- 1 Hasta 3 Hacer
    Si i MOD 2 = 0 Entonces
      Mientras i > 10 Hacer
        i <- i - 1
      FinMientras
    SiNo
      Saludar
      Escribir Doble(i)
    FinSi
  FinPara
FinAlgoritmo`);
    expect(diagram.routines.map((r) => r.label)).toEqual(['Algoritmo Nido', 'Funcion Doble', 'SubProceso Saludar']);
    const routine = diagram.routines[0];
    expect(cell(routine, 'Saludar').tone).toBe('call');
    const para = cell(routine, 'Para i <- 1 Hasta 3');
    const si = cell(routine, 'i MOD 2 = 0');
    expect(si.x).toBe(para.x + NASSI_LOOP_STRIP);
    const mientras = cell(routine, 'Mientras i > 10');
    expect(mientras.x).toBe(si.x);
    expect(cell(routine, 'i <- i - 1').x).toBe(si.x + NASSI_LOOP_STRIP);
    expectTiling(routine);
    expect(diagram.routines[1].cells[0]).toMatchObject({ kind: 'terminator' });
    expect(textOf(diagram.routines[1].cells[0])).toBe('Funcion r <- Doble(x)');
  });

  test('routine ids match the flowchart (the picker and the export find the same routine)', () => {
    const parsed = new Parser(`SubProceso A
FinSubProceso
Algoritmo B
  A
FinAlgoritmo`).parse();
    const flow = buildFlowDiagram(parsed.program!);
    const nassi = buildNassiDiagram(flow);
    expect(nassi.routines.map((r) => r.id)).toEqual(flow.routines.map((r) => r.id));
    expect(nassi.routines.map((r) => r.name)).toEqual(['B', 'A']);
  });

  test('every statement keeps its trace line (playback lights the same lines as the flowchart)', () => {
    const parsed = new Parser(`Algoritmo T
  Leer n
  Si n > 0 Entonces
    Escribir n
  FinSi
  Segun n Hacer
    1: Escribir 1
  FinSegun
FinAlgoritmo`).parse();
    const flow = buildFlowDiagram(parsed.program!).routines[0];
    const nassi = buildNassiDiagram({ routines: [flow] }).routines[0];
    const traced = (lines: Array<number | undefined>) => [...new Set(lines.filter((l): l is number => l !== undefined))].sort();
    expect(traced(nassi.cells.map((c) => c.traceLine))).toEqual(traced(flow.nodes.map((n) => n.traceLine)));
  });

  test('exports a light SVG with every box and label', () => {
    const routine = main(`Algoritmo Exp
  Leer a
  Si a > 1 Entonces
    Escribir "a & b"
  FinSi
FinAlgoritmo`);
    const { svg, width, height } = exportNassiToSvg(routine);
    expect(width).toBeGreaterThan(routine.width);
    expect(height).toBeGreaterThan(routine.height);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain('#f4efe6');
    expect(svg).toContain('&amp;');
    expect(svg).toContain('>Sí</text>');
    expect(svg).toContain('>No</text>');
    expect((svg.match(/<path /g) ?? []).length).toBeGreaterThanOrEqual(routine.cells.length);
  });

  test('lays out every bundled example, tiling each routine', () => {
    expect(examplePrograms.length).toBeGreaterThan(10);
    examplePrograms.forEach((example) => {
      const parsed = new Parser(example.source, { settings: normalizeEngineSettings(example.settings) }).parse();
      expect(parsed.program).not.toBeNull();
      buildNassiDiagram(buildFlowDiagram(parsed.program!)).routines.forEach(expectTiling);
    });
  });
});

describe('alternative input/output shapes', () => {
  test('Leer draws as a manual input and Escribir as a display; the classic style keeps the parallelogram', () => {
    expect(shapeForKind('input')).toBe('input-output');
    expect(shapeForKind('output')).toBe('input-output');
    expect(shapeForKind('input', 'alternative')).toBe('manual-input');
    expect(shapeForKind('output', 'alternative')).toBe('display');
    expect(shapeForKind('process', 'alternative')).toBe('process');
    // A manual input's slanted top: low on the left, high on the right.
    expect(shapeGeometry('manual-input', 100, 40).outline).toBe('M 0,7 L 100,-7 L 100,40 L 0,40 Z');
    // A display: pointed left side, rounded right side.
    expect(shapeGeometry('display', 100, 40).outline).toMatch(/^M 0,20 L 18,0 L 82,0 A 18 20 0 0 1 82,40 L 18,40 Z$/);
  });

  test('applyIoShapes marks Leer/Escribir nodes and the export draws them', () => {
    const parsed = new Parser(`Algoritmo IO
  Leer a
  Escribir a
  a <- 1
FinAlgoritmo`).parse();
    const classic = buildFlowDiagram(parsed.program!);
    expect(applyIoShapes(classic)).toBe(classic);
    const alternative = applyIoShapes(classic, 'alternative');
    const shapes = alternative.routines[0].nodes.map((n) => [n.kind, n.shape]);
    expect(shapes).toContainEqual(['input', 'manual-input']);
    expect(shapes).toContainEqual(['output', 'display']);
    expect(alternative.routines[0].nodes.find((n) => n.kind === 'process')?.shape).toBeUndefined();
    // Same sizes, so the layout does not move.
    expect(alternative.routines[0].nodes.map((n) => n.size)).toEqual(classic.routines[0].nodes.map((n) => n.size));

    const classicSvg = exportRoutineToSvg(layoutFlowDiagramSync(classic).routines[0]).svg;
    const altSvg = exportRoutineToSvg(layoutFlowDiagramSync(alternative).routines[0]).svg;
    expect(classicSvg).not.toContain(' A 18 ');
    expect(altSvg).toContain(' A 18 ');
  });
});
