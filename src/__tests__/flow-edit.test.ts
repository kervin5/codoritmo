import {
  buildFlowDiagram,
  describeNode,
  detectIndentUnit,
  findNodeIdByRef,
  FLOW_INSERT_KINDS,
  insertStatement,
  layoutFlowDiagramSync,
  removeStatement,
  replaceStatementText,
  toSymbolOperators,
  type FlowEditResult,
  type FlowInsertKind,
  type FlowRoutineDiagram,
} from '@/src/diagram';
import { getAllProfiles, Parser, type EngineSettings } from '@/src/engine';

const STRICT: Partial<EngineSettings> = { forceSemicolon: true, wordOperators: false, colloquialConditions: false, lazySyntax: false };

function routineOf(source: string, settings: Partial<EngineSettings> = {}, index = 0): FlowRoutineDiagram {
  const parsed = new Parser(source, { settings }).parse();
  if (!parsed.program) throw new Error(parsed.diagnostics[0]?.message);
  return buildFlowDiagram(parsed.program).routines[index];
}

function nodeId(source: string, label: string, settings: Partial<EngineSettings> = {}) {
  const node = routineOf(source, settings).nodes.find((candidate) => candidate.label === label);
  if (!node) throw new Error(`no node ${label}`);
  return node.id;
}

/** The connector entering the block labelled `label` from above (or into Fin). */
function edgeInto(source: string, label: string, settings: Partial<EngineSettings> = {}) {
  const routine = routineOf(source, settings);
  const target = label === 'Fin'
    ? routine.nodes.find((node) => node.id.endsWith(':end'))!
    : routine.nodes.find((node) => node.label === label)!;
  const edge = routine.edges.find((candidate) => candidate.target === target.id && candidate.slot);
  if (!edge) throw new Error(`no slot edge into ${label}`);
  return edge.id;
}

function ok(result: FlowEditResult) {
  if (!result.ok) throw new Error(`edit failed: ${result.error} ${result.diagnostic?.message ?? ''}`);
  return result;
}

const BLANK = 'Algoritmo SinTitulo\n\nFinAlgoritmo\n';

describe('diagram model: insertion slots and edit refs', () => {
  it('gives every block but junctions and Fin an edit ref and sequence connectors a slot', () => {
    const routine = routineOf('Algoritmo a\n\tLeer x\n\tEscribir x\nFinAlgoritmo');
    expect(routine.nodes.filter((node) => node.kind !== 'junction' && !node.id.endsWith(':end')).every((node) => node.edit)).toBe(true);
    expect(routine.edges.map((edge) => edge.slot?.index).sort()).toEqual([0, 1, 2]);
  });

  it('gives a loop exit no slot', () => {
    const routine = routineOf('Algoritmo a\n\tMientras x > 0 Hacer\n\t\tx <- x - 1\n\tFinMientras\nFinAlgoritmo');
    const exit = routine.edges.find((edge) => edge.label === 'No')!;
    expect(exit.slot).toBeUndefined();
  });
});

describe('insertStatement', () => {
  it('builds a program from an empty Algoritmo, filling its blank line', () => {
    let source = BLANK;
    source = ok(insertStatement(source, {}, edgeInto(source, 'Fin'), 'read')).source;
    expect(source).toBe('Algoritmo SinTitulo\n\tLeer x\nFinAlgoritmo\n');
    source = ok(insertStatement(source, {}, edgeInto(source, 'Fin'), 'ifElse')).source;
    expect(source).toBe('Algoritmo SinTitulo\n\tLeer x\n\tSi x > 0 Entonces\n\tSiNo\n\tFinSi\nFinAlgoritmo\n');
    // Into the Sí arm, then the No arm.
    const routine = routineOf(source);
    const decision = routine.nodes.find((node) => node.kind === 'decision')!;
    const yes = routine.edges.find((edge) => edge.source === decision.id && edge.label === 'Sí')!;
    source = ok(insertStatement(source, {}, yes.id, 'write')).source;
    const no = routineOf(source).edges.find((edge) => edge.label === 'No')!;
    source = ok(insertStatement(source, {}, no.id, 'assign')).source;
    expect(source).toBe(
      'Algoritmo SinTitulo\n\tLeer x\n\tSi x > 0 Entonces\n\t\tEscribir "Hola"\n\tSiNo\n\t\tx <- 0\n\tFinSi\nFinAlgoritmo\n',
    );
  });

  it('adds SiNo when inserting into the empty No arm', () => {
    const source = 'Algoritmo a\n    Si x > 0 Entonces\n        Escribir 1\n    FinSi\nFinAlgoritmo';
    const no = routineOf(source).edges.find((edge) => edge.label === 'No')!;
    const result = ok(insertStatement(source, {}, no.id, 'write'));
    expect(result.source).toBe('Algoritmo a\n    Si x > 0 Entonces\n        Escribir 1\n    SiNo\n        Escribir "Hola"\n    FinSi\nFinAlgoritmo');
  });

  it('inserts between statements with their indentation and keeps comments', () => {
    const source = 'Algoritmo a\n  // pide un número\n  Leer x // aquí\n  Escribir x\nFinAlgoritmo';
    const result = ok(insertStatement(source, {}, edgeInto(source, 'Escribir x'), 'assign'));
    expect(result.source).toBe('Algoritmo a\n  // pide un número\n  Leer x // aquí\n  x <- 0\n  Escribir x\nFinAlgoritmo');
    expect(result.select).toEqual({ offset: result.source.indexOf('x <- 0'), part: 'statement' });
  });

  it('writes semicolons when the profile forces them (or the routine uses them)', () => {
    const forced = 'Algoritmo a\n\tLeer x;\nFinAlgoritmo';
    expect(ok(insertStatement(forced, STRICT, edgeInto(forced, 'Fin', STRICT), 'write')).source).toContain('\tEscribir "Hola";\n');
    expect(ok(insertStatement(forced, {}, edgeInto(forced, 'Fin'), 'write')).source).toContain('\tEscribir "Hola";\n');
    const plain = 'Algoritmo a\n\tLeer x\nFinAlgoritmo';
    expect(ok(insertStatement(plain, {}, edgeInto(plain, 'Fin'), 'write')).source).toContain('\tEscribir "Hola"\n');
  });

  it('opens a Repetir on its condition block', () => {
    const result = ok(insertStatement(BLANK, {}, edgeInto(BLANK, 'Fin'), 'repeat'));
    expect(result.source).toBe('Algoritmo SinTitulo\n\tRepetir\n\tHasta Que x > 0\nFinAlgoritmo\n');
    expect(result.select?.part).toBe('condition');
    const ids = findNodeIdByRef([routineOf(result.source)], result.select!);
    expect(routineOf(result.source).nodes.find((node) => node.id === ids?.nodeId)?.label).toBe('x > 0');
  });

  it('inserts into loop bodies, Segun cases and De Otro Modo', () => {
    let source = ok(insertStatement(BLANK, {}, edgeInto(BLANK, 'Fin'), 'switch')).source;
    expect(source).toBe('Algoritmo SinTitulo\n\tSegun x Hacer\n\t\t1:\n\t\tDe Otro Modo:\n\tFinSegun\nFinAlgoritmo\n');
    const lanes = () => routineOf(source).edges.filter((edge) => edge.kind === 'branch');
    source = ok(insertStatement(source, {}, lanes()[0].id, 'write')).source;
    source = ok(insertStatement(source, {}, lanes().find((edge) => edge.label === 'De Otro Modo')!.id, 'read')).source;
    expect(source).toBe('Algoritmo SinTitulo\n\tSegun x Hacer\n\t\t1:\n\t\t\tEscribir "Hola"\n\t\tDe Otro Modo:\n\t\t\tLeer x\n\tFinSegun\nFinAlgoritmo\n');

    let loop = ok(insertStatement(BLANK, {}, edgeInto(BLANK, 'Fin'), 'for')).source;
    const back = routineOf(loop).edges.find((edge) => edge.kind === 'loop')!;
    loop = ok(insertStatement(loop, {}, back.id, 'write')).source;
    expect(loop).toBe('Algoritmo SinTitulo\n\tPara i <- 1 Hasta 10 Hacer\n\t\tEscribir "Hola"\n\tFinPara\nFinAlgoritmo\n');
  });

  it('inserts before a statement that shares its line with a case label', () => {
    const source = 'Algoritmo a\n\tSegun x Hacer\n\t\t1: Escribir "uno"\n\tFinSegun\nFinAlgoritmo';
    const lane = routineOf(source).edges.find((edge) => edge.label === '1')!;
    expect(ok(insertStatement(source, {}, lane.id, 'read')).source).toBe(
      'Algoritmo a\n\tSegun x Hacer\n\t\t1: Leer x\n\t\t\tEscribir "uno"\n\tFinSegun\nFinAlgoritmo',
    );
  });

  it('calls an existing subprocess, or creates one', () => {
    const withSub = 'Algoritmo a\nFinAlgoritmo\n\nSubProceso Saludar(nombre)\n\tEscribir nombre\nFinSubProceso\n';
    expect(ok(insertStatement(withSub, {}, edgeInto(withSub, 'Fin'), 'call')).source).toContain('\tSaludar(nombre)\nFinAlgoritmo');
    const created = ok(insertStatement(BLANK, {}, edgeInto(BLANK, 'Fin'), 'call')).source;
    expect(created).toBe('Algoritmo SinTitulo\n\tMiSubproceso\nFinAlgoritmo\n\nSubAlgoritmo MiSubproceso\nFinSubAlgoritmo\n');
    const blocked = insertStatement(BLANK, { enableUserFunctions: false }, edgeInto(BLANK, 'Fin'), 'call');
    expect(blocked).toEqual({ ok: false, error: 'no-subprocess' });
  });

  it('every kind parses under every profile', () => {
    const failures: string[] = [];
    for (const profile of getAllProfiles()) {
      for (const kind of FLOW_INSERT_KINDS) {
        if (kind === 'call' && !profile.settings.enableUserFunctions) continue;
        const result = insertStatement(BLANK, profile.settings, edgeInto(BLANK, 'Fin', profile.settings), kind as FlowInsertKind);
        if (!result.ok) failures.push(`${profile.id}/${kind}: ${result.error} ${result.diagnostic?.message ?? ''}`);
      }
    }
    expect(failures).toEqual([]);
  });
});

describe('describeNode and replaceStatementText', () => {
  const program = [
    'Algoritmo demo',
    '\tDefinir x Como Entero;',
    '\tLeer x;',
    '\tSi x>3 Entonces // grande',
    '\t\tEscribir Sin Saltar "a", x;',
    '\tFinSi',
    '\tPara i <- 1 Hasta 3 Hacer',
    '\t\tx <- x + i;',
    '\tFinPara',
    '\tRepetir',
    '\t\tx <- x - 1;',
    '\tHasta Que x < 0',
    'FinAlgoritmo',
  ].join('\n');

  it('shows the pieces exactly as written', () => {
    expect(describeNode(program, {}, nodeId(program, 'x > 3'))?.fields).toEqual([{ key: 'condition', value: 'x>3' }]);
    expect(describeNode(program, {}, nodeId(program, 'Escribir Sin Saltar "a", x'))?.fields).toEqual([{ key: 'values', value: '"a", x' }]);
    expect(describeNode(program, {}, nodeId(program, 'Para i <- 1 Hasta 3'))?.fields).toEqual([
      { key: 'variable', value: 'i' },
      { key: 'start', value: '1' },
      { key: 'end', value: '3' },
      { key: 'step', value: '', optional: true },
    ]);
    expect(describeNode(program, {}, nodeId(program, 'x <- x + i'))?.fields).toEqual([
      { key: 'target', value: 'x' },
      { key: 'value', value: 'x + i' },
    ]);
    expect(describeNode(program, {}, nodeId(program, 'Definir x Como Entero'))?.fields.map((f) => f.value)).toEqual(['x', 'Entero']);
    const start = routineOf(program).nodes.find((node) => node.id.endsWith(':start'))!;
    expect(describeNode(program, {}, start.id)).toMatchObject({ kind: 'routine', fields: [{ key: 'name', value: 'demo' }], deletable: false });
    const si = describeNode(program, {}, nodeId(program, 'x > 3'));
    expect(si).toMatchObject({ deletable: true, nested: 1 });
  });

  it('rewrites only the piece, keeping comments, keywords and semicolons', () => {
    const condition = ok(replaceStatementText(program, {}, nodeId(program, 'x > 3'), { condition: 'x >= 10' })).source;
    expect(condition).toContain('\tSi x >= 10 Entonces // grande\n');
    const write = ok(replaceStatementText(program, {}, nodeId(program, 'Escribir Sin Saltar "a", x'), { values: '"b";' })).source;
    expect(write).toContain('\t\tEscribir Sin Saltar "b";\n');
    const repeat = ok(replaceStatementText(program, {}, nodeId(program, 'x < 0'), { condition: 'x <= 0' })).source;
    expect(repeat).toContain('\tHasta Que x <= 0\n');
  });

  it("adds and removes Para's Con Paso", () => {
    const id = nodeId(program, 'Para i <- 1 Hasta 3');
    const stepped = ok(replaceStatementText(program, {}, id, { end: '9', step: '2' })).source;
    expect(stepped).toContain('\tPara i <- 1 Hasta 9 Con Paso 2 Hacer\n');
    const back = ok(replaceStatementText(stepped, {}, nodeId(stepped, 'Para i <- 1 Hasta 9 Con Paso 2'), { step: '' })).source;
    expect(back).toContain('\tPara i <- 1 Hasta 9 Hacer\n');
  });

  it('refuses empty, multi-line, invalid and structure-changing text', () => {
    const id = nodeId(program, 'x > 3');
    expect(replaceStatementText(program, {}, id, { condition: '  ' })).toMatchObject({ ok: false, error: 'empty' });
    expect(replaceStatementText(program, {}, id, { condition: 'x\ny' })).toMatchObject({ ok: false, error: 'multiline' });
    const invalid = replaceStatementText(program, {}, id, { condition: 'x >' });
    expect(invalid).toMatchObject({ ok: false, error: 'invalid' });
    expect(!invalid.ok && invalid.diagnostic?.message).toBeTruthy();
    expect(replaceStatementText(program, {}, nodeId(program, 'Leer x'), { targets: 'x; Escribir 1' }))
      .toMatchObject({ ok: false });
  });

  it('writes symbol operators for profiles without word operators', () => {
    const source = 'Algoritmo a\n\tSi x > 0 Entonces\n\tFinSi\nFinAlgoritmo';
    const settings = { wordOperators: false, colloquialConditions: false };
    const result = ok(replaceStatementText(source, settings, nodeId(source, 'x > 0', settings), { condition: 'x > 0 Y NO x = 5' }));
    expect(result.source).toContain('Si x > 0 && ~x = 5 Entonces');
    expect(toSymbolOperators('a MOD 2 = 0 O b Y "Y"')).toBe('a % 2 = 0 || b && "Y"');
  });

  it('renames the algorithm', () => {
    const start = routineOf(program).nodes.find((node) => node.id.endsWith(':start'))!;
    expect(ok(replaceStatementText(program, {}, start.id, { name: 'Contador' })).source.startsWith('Algoritmo Contador\n')).toBe(true);
  });
});

describe('removeStatement', () => {
  it('removes a statement line, with its comment', () => {
    const source = 'Algoritmo a\n\tLeer x // dato\n\tEscribir x\nFinAlgoritmo';
    const result = ok(removeStatement(source, {}, nodeId(source, 'Leer x')));
    expect(result.source).toBe('Algoritmo a\n\tEscribir x\nFinAlgoritmo');
    expect(result.select).toEqual({ offset: result.source.indexOf('Escribir'), part: 'statement' });
  });

  it('removes a statement that shares its line with a case label', () => {
    const source = 'Algoritmo a\n\tSegun x Hacer\n\t\t1: Escribir "uno";\n\tFinSegun\nFinAlgoritmo';
    expect(ok(removeStatement(source, {}, nodeId(source, 'Escribir "uno"'))).source).toBe(
      'Algoritmo a\n\tSegun x Hacer\n\t\t1:\n\tFinSegun\nFinAlgoritmo',
    );
  });

  const loop = 'Algoritmo a\n\tMientras x > 0 Hacer\n\t\tEscribir x\n\t\tx <- x - 1\n\tFinMientras\n\tEscribir "fin"\nFinAlgoritmo';

  it('removes a structure with its body', () => {
    expect(ok(removeStatement(loop, {}, nodeId(loop, 'x > 0'))).source).toBe('Algoritmo a\n\tEscribir "fin"\nFinAlgoritmo');
  });

  it('or keeps its body, one level shallower', () => {
    expect(ok(removeStatement(loop, {}, nodeId(loop, 'x > 0'), { keepBody: true })).source).toBe(
      'Algoritmo a\n\tEscribir x\n\tx <- x - 1\n\tEscribir "fin"\nFinAlgoritmo',
    );
    const si = 'Algoritmo a\n\tSi x > 0 Entonces\n\t\tEscribir 1\n\tSiNo\n\t\tEscribir 2\n\tFinSi\nFinAlgoritmo';
    expect(ok(removeStatement(si, {}, nodeId(si, 'x > 0'), { keepBody: true })).source).toBe(
      'Algoritmo a\n\tEscribir 1\n\tEscribir 2\nFinAlgoritmo',
    );
  });

  it('removes a Repetir from its condition block', () => {
    const source = 'Algoritmo a\n\tRepetir\n\t\tLeer x\n\tHasta Que x > 0\nFinAlgoritmo';
    expect(ok(removeStatement(source, {}, nodeId(source, 'x > 0'), { keepBody: true })).source).toBe('Algoritmo a\n\tLeer x\nFinAlgoritmo');
  });

  it('does not delete Inicio', () => {
    const start = routineOf(loop).nodes.find((node) => node.id.endsWith(':start'))!;
    expect(removeStatement(loop, {}, start.id)).toEqual({ ok: false, error: 'not-deletable' });
  });
});

describe('detectIndentUnit', () => {
  it('finds the document indent or defaults to a tab', () => {
    expect(detectIndentUnit('Algoritmo a\n    Leer x\nFinAlgoritmo')).toBe('    ');
    expect(detectIndentUnit('Algoritmo a\nFinAlgoritmo')).toBe('\t');
  });
});

describe('layout', () => {
  it('keeps insertion slots on routed connectors', () => {
    const parsed = new Parser('Algoritmo a\n\tLeer x\nFinAlgoritmo').parse();
    const positioned = layoutFlowDiagramSync(buildFlowDiagram(parsed.program!));
    expect(positioned.routines[0].edges.every((edge) => edge.slot)).toBe(true);
  });
});
