// Editing the program from its flowchart. Every operation is a source-text
// transformation driven by the AST's source spans: it rewrites only the text
// of the statement it touches (or inserts / removes whole lines), so
// comments, blank lines, indentation and every untouched line stay as they
// were. New text follows the document's profile (semicolons, symbol or word
// operators), and every result is re-parsed under that profile: an edit
// that would not parse is refused, never applied.
//
// Blocks and connectors are named by their diagram ids (see model.ts): a
// block's `edit` ref says which statement it is, a connector's `slot` says
// which statement list (and position in it) it stands for.

import {
  Lexer,
  normalizeEngineSettings,
  Parser,
  type Diagnostic,
  type EngineSettings,
  type MainRoutineNode,
  type ProgramNode,
  type RoutineNode,
  type StatementNode,
  type SwitchCaseNode,
  type Token,
} from '@/src/engine';

import {
  buildFlowDiagram,
  type FlowEdge,
  type FlowInsertSlot,
  type FlowNode,
  type FlowNodeEditRef,
} from './model';

/** Statements the diagram's palette can insert. */
export type FlowInsertKind =
  | 'assign'
  | 'call'
  | 'define'
  | 'for'
  | 'if'
  | 'ifElse'
  | 'read'
  | 'repeat'
  | 'switch'
  | 'while'
  | 'write';

export const FLOW_INSERT_KINDS: readonly FlowInsertKind[] = [
  'write', 'read', 'assign', 'if', 'ifElse', 'switch', 'while', 'repeat', 'for', 'define', 'call',
];

/** The pieces of a block a student can edit. */
export type FlowFieldKey =
  | 'code'
  | 'collection'
  | 'condition'
  | 'end'
  | 'expression'
  | 'name'
  | 'names'
  | 'start'
  | 'step'
  | 'target'
  | 'targets'
  | 'type'
  | 'value'
  | 'values'
  | 'variable';

export interface FlowEditField {
  key: FlowFieldKey;
  value: string;
  /** Can be left empty (Para's Con Paso). */
  optional?: boolean;
}

export interface FlowEditable {
  /** The statement kind, or "routine" for a routine's Inicio block. */
  kind: StatementNode['kind'] | 'routine';
  fields: FlowEditField[];
  deletable: boolean;
  /** How many statements sit inside it (0 for simple statements). */
  nested: number;
}

export type FlowEditError =
  /** The block or connector is not in the program (it changed meanwhile). */
  | 'not-found'
  /** A required field was left empty. */
  | 'empty'
  /** Fields are one line each. */
  | 'multiline'
  /** The result would not parse under the document's profile. */
  | 'invalid'
  /** The text would turn the block into something else (more statements, another kind). */
  | 'structure'
  /** Inicio / Fin cannot be deleted. */
  | 'not-deletable'
  /** A call needs a subprocess, and the profile does not allow defining one. */
  | 'no-subprocess';

export type FlowEditResult =
  | { ok: true; source: string; /** The block to select (and, after an insert, edit) next. */ select: FlowNodeEditRef | null }
  | { ok: false; error: FlowEditError; field?: FlowFieldKey; diagnostic?: Diagnostic };

/* ------------------------------------------------------------------ */
/* Text helpers                                                        */
/* ------------------------------------------------------------------ */

class SourceText {
  readonly starts: number[] = [0];

  constructor(readonly text: string) {
    for (let i = 0; i < text.length; i += 1) if (text[i] === '\n') this.starts.push(i + 1);
  }

  get lineCount() {
    return this.starts.length;
  }

  /** Offset of the first character of a 1-based line. */
  lineStart(line: number): number {
    return this.starts[Math.min(Math.max(line, 1), this.starts.length) - 1];
  }

  /** Offset of the line's "\n" (or the end of the text). */
  lineEnd(line: number): number {
    const next = this.starts[line];
    if (next === undefined) return this.text.length;
    return this.text[next - 2] === '\r' ? next - 2 : next - 1;
  }

  lineText(line: number): string {
    return this.text.slice(this.lineStart(line), this.lineEnd(line));
  }

  lineOf(offset: number): number {
    let low = 0;
    let high = this.starts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (this.starts[mid] <= offset) low = mid;
      else high = mid - 1;
    }
    return low + 1;
  }

  indentOf(line: number): string {
    return /^[ \t]*/.exec(this.lineText(line))?.[0] ?? '';
  }

  isBlank(line: number): boolean {
    return line >= 1 && line <= this.lineCount && this.lineText(line).trim() === '';
  }
}

const QUOTES = new Set(['"', "'", '“', '”']);

/**
 * Scans one statement from `from`: it ends at a `;`, a `//` comment or the
 * end of the line (outside strings). Returns where its text ends (trailing
 * spaces trimmed) and, when it has one, the offset just past its `;`.
 */
function scanStatement(text: string, from: number): { end: number; semicolonEnd?: number } {
  let i = from;
  let quote = '';
  for (; i < text.length; i += 1) {
    const char = text[i];
    if (quote) {
      if (char === quote || (quote === '"' && (char === '“' || char === '”'))) quote = '';
      else if (char === '\n') break;
      continue;
    }
    if (QUOTES.has(char)) quote = char === "'" ? "'" : '"';
    else if (char === '\n' || char === ';' || (char === '/' && text[i + 1] === '/')) break;
  }
  let end = i;
  while (end > from && /[ \t\r]/.test(text[end - 1])) end -= 1;
  return text[i] === ';' ? { end, semicolonEnd: i + 1 } : { end };
}

/** Whether the rest of a line (from an offset) is only spaces or a comment. */
function restIsEmpty(text: string, from: number, lineEnd: number): boolean {
  const rest = text.slice(from, lineEnd).trim();
  return rest === '' || rest.startsWith('//');
}

/**
 * The indent step the document uses (the first line that is deeper than the
 * one above it), or a tab like PSeInt.
 */
export function detectIndentUnit(source: string): string {
  const lines = source.split('\n').filter((line) => line.trim() !== '');
  for (let i = 1; i < lines.length; i += 1) {
    const previous = /^[ \t]*/.exec(lines[i - 1])![0];
    const current = /^[ \t]*/.exec(lines[i])![0];
    if (current.length > previous.length && current.startsWith(previous)) return current.slice(previous.length);
  }
  return '\t';
}

/* ------------------------------------------------------------------ */
/* AST helpers                                                         */
/* ------------------------------------------------------------------ */

type Routine = MainRoutineNode | RoutineNode;
type Owner = Routine | StatementNode;

const STRUCTURES = new Set<StatementNode['kind']>(['if', 'while', 'for', 'forEach', 'repeat', 'switch']);

function isStructure(statement: StatementNode): boolean {
  return STRUCTURES.has(statement.kind);
}

/** The statement lists of a routine or statement, in source order. */
function listsOf(owner: Owner): Array<{ name: string; list: StatementNode[]; caseNode?: SwitchCaseNode }> {
  if ('type' in owner) return [{ name: 'body', list: owner.body }];
  switch (owner.kind) {
    case 'if':
      return [{ name: 'then', list: owner.thenBranch }, { name: 'else', list: owner.elseBranch }];
    case 'while':
    case 'for':
    case 'forEach':
    case 'repeat':
      return [{ name: 'body', list: owner.body }];
    case 'switch':
      return [
        ...owner.cases.map((caseNode, index) => ({ name: `case-${index}`, list: caseNode.body, caseNode })),
        { name: 'default', list: owner.defaultCase },
      ];
    default:
      return [];
  }
}

interface Located {
  statement: StatementNode;
  routine: Routine;
  owner: Owner;
  list: StatementNode[];
  index: number;
}

function routinesOf(program: ProgramNode): Routine[] {
  return [program.entry, ...program.routines];
}

function* walk(owner: Owner, routine: Routine): Generator<Located> {
  for (const { list } of listsOf(owner)) {
    for (let index = 0; index < list.length; index += 1) {
      const statement = list[index];
      yield { statement, routine, owner, list, index };
      yield* walk(statement, routine);
    }
  }
}

function* allStatements(program: ProgramNode): Generator<Located> {
  for (const routine of routinesOf(program)) yield* walk(routine, routine);
}

function locate(program: ProgramNode, offset: number): Located | null {
  for (const located of allStatements(program)) {
    if (located.statement.span?.start.offset === offset) return located;
  }
  return null;
}

function findOwner(program: ProgramNode, offset: number): { owner: Owner; routine: Routine } | null {
  for (const routine of routinesOf(program)) {
    if (routine.span?.start.offset === offset) return { owner: routine, routine };
  }
  const located = locate(program, offset);
  return located ? { owner: located.statement, routine: located.routine } : null;
}

function countStatements(program: ProgramNode): number {
  let count = 0;
  for (const located of allStatements(program)) if (located) count += 1;
  return count;
}

function startLine(statement: StatementNode): number {
  return statement.span!.start.line;
}

/** Last line of a statement: a structure's closer, or the statement's own line. */
function endLine(statement: StatementNode): number {
  return isStructure(statement) ? statement.span!.end.line : statement.span!.start.line;
}

function refFor(statement: StatementNode): FlowNodeEditRef {
  return { offset: statement.span!.start.offset, part: statement.kind === 'repeat' ? 'condition' : 'statement' };
}

/* ------------------------------------------------------------------ */
/* Parsing and lookup                                                  */
/* ------------------------------------------------------------------ */

function parse(source: string, settings: Partial<EngineSettings>) {
  return new Parser(source, { settings }).parse();
}

/** Finds a block of the diagram built from this program. */
function findNode(program: ProgramNode, nodeId: string): FlowNode | null {
  for (const routine of buildFlowDiagram(program).routines) {
    const node = routine.nodes.find((candidate) => candidate.id === nodeId);
    if (node) return node;
  }
  return null;
}

function findEdge(program: ProgramNode, edgeId: string): FlowEdge | null {
  for (const routine of buildFlowDiagram(program).routines) {
    const edge = routine.edges.find((candidate) => candidate.id === edgeId);
    if (edge) return edge;
  }
  return null;
}

/** The diagram id of the block an edit ref points at (after an edit, the ids change). */
export function findNodeIdByRef(
  routines: ReadonlyArray<{ id: string; nodes: ReadonlyArray<Pick<FlowNode, 'edit' | 'id'>> }>,
  ref: FlowNodeEditRef,
): { routineId: string; nodeId: string } | null {
  for (const routine of routines) {
    const node = routine.nodes.find((candidate) => candidate.edit?.offset === ref.offset && candidate.edit.part === ref.part);
    if (node) return { routineId: routine.id, nodeId: node.id };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Fields: the editable pieces of a statement and where they are        */
/* ------------------------------------------------------------------ */

interface FieldRange extends FlowEditField {
  from: number;
  to: number;
  /** For a missing optional piece: inserted at `from` as `${prefix}${value}`. */
  missing?: { prefix: string };
  /** For a present optional piece: what to remove when it is cleared. */
  clearFrom?: number;
}

interface Pieces {
  kind: FlowEditable['kind'];
  fields: FieldRange[];
}

class LineTokens {
  constructor(
    readonly tokens: Token[],
    private readonly text: string,
    private readonly codeEnd: number,
  ) {}

  get length() {
    return this.tokens.length;
  }

  word(index: number): string {
    const token = this.tokens[index];
    return token && token.kind === 'word' ? token.normalized : '';
  }

  /** First index >= from whose word is one of `words`, outside brackets. */
  find(words: string[], from = 0, kinds: Token['kind'][] = []): number {
    let depth = 0;
    for (let index = from; index < this.tokens.length; index += 1) {
      const token = this.tokens[index];
      if (token.kind === 'lparen' || token.kind === 'lbracket') depth += 1;
      else if (token.kind === 'rparen' || token.kind === 'rbracket') depth -= 1;
      else if (depth === 0 && (kinds.includes(token.kind) || (token.kind === 'word' && words.includes(token.normalized)))) {
        return index;
      }
    }
    return -1;
  }

  /** Text range of tokens [from, to): from the first token's start to just before the next token. */
  range(from: number, to: number): { from: number; to: number } | null {
    if (from >= to || from >= this.tokens.length) return null;
    const start = this.tokens[from].offset;
    let end = to < this.tokens.length ? this.tokens[to].offset : this.codeEnd;
    while (end > start && /[ \t\r]/.test(this.text[end - 1])) end -= 1;
    return { from: start, to: end };
  }
}

function tokensBetween(all: Token[], from: number, to: number): Token[] {
  return all.filter((token) => token.kind !== 'eof' && token.offset >= from && token.offset < to);
}

function field(key: FlowFieldKey, text: string, range: { from: number; to: number } | null, fallbackAt: number): FieldRange {
  const r = range ?? { from: fallbackAt, to: fallbackAt };
  return { key, value: text.slice(r.from, r.to), from: r.from, to: r.to };
}

function piecesOf(
  source: SourceText,
  tokens: Token[],
  program: ProgramNode,
  ref: FlowNodeEditRef,
): { pieces: Pieces; located: Located | null } | null {
  const text = source.text;

  if (ref.part === 'routine') {
    const routine = routinesOf(program).find((candidate) => candidate.span?.start.offset === ref.offset);
    if (!routine?.span) return null;
    const line = routine.span.start.line;
    const lineTokens = tokensBetween(tokens, ref.offset, source.lineEnd(line));
    // Funcion r <- Nombre(...): the name follows the arrow.
    const arrow = lineTokens.findIndex((token) => token.kind === 'arrow' || token.kind === 'eq');
    const name = lineTokens.slice(arrow >= 0 ? arrow + 1 : 1).find((token) => token.kind === 'word');
    if (!name) return null;
    return {
      pieces: { kind: 'routine', fields: [field('name', text, { from: name.offset, to: name.offset + name.lexeme.length }, name.offset)] },
      located: null,
    };
  }

  const located = locate(program, ref.offset);
  if (!located) return null;
  const { statement } = located;
  const start = ref.offset;

  if (ref.part === 'condition' && statement.kind === 'repeat') {
    const line = statement.span!.end.line;
    const lineStart = source.lineStart(line);
    const scan = scanStatement(text, lineStart);
    const lt = new LineTokens(tokensBetween(tokens, lineStart, scan.end), text, scan.end);
    const from = lt.word(1) === 'QUE' ? 2 : 1;
    return { pieces: { kind: 'repeat', fields: [field('condition', text, lt.range(from, lt.length), scan.end)] }, located };
  }

  if (isStructure(statement)) {
    // A header: from the statement to the end of its line (before a comment).
    const line = startLine(statement);
    const firstChild = listsOf(statement).flatMap(({ list }) => list)[0];
    const childOnLine = firstChild?.span && firstChild.span.start.line === line ? firstChild.span.start.offset : undefined;
    let codeEnd = childOnLine ?? scanStatement(text, start).end;
    while (codeEnd > start && /[ \t\r]/.test(text[codeEnd - 1])) codeEnd -= 1;
    const lt = new LineTokens(tokensBetween(tokens, start, codeEnd), text, codeEnd);

    switch (statement.kind) {
      case 'if': {
        const then = lt.find(['ENTONCES'], 1);
        return { pieces: { kind: 'if', fields: [field('condition', text, lt.range(1, then < 0 ? lt.length : then), codeEnd)] }, located };
      }
      case 'while': {
        const hacer = lt.find(['HACER'], 1);
        return { pieces: { kind: 'while', fields: [field('condition', text, lt.range(1, hacer < 0 ? lt.length : hacer), codeEnd)] }, located };
      }
      case 'switch': {
        const hacer = lt.find(['HACER'], 1);
        return { pieces: { kind: 'switch', fields: [field('expression', text, lt.range(1, hacer < 0 ? lt.length : hacer), codeEnd)] }, located };
      }
      case 'forEach': {
        const of = lt.find(['DE', 'EN'], 2);
        const hacer = lt.find(['HACER'], Math.max(of, 2));
        if (of < 0) return null;
        return {
          pieces: {
            kind: 'forEach',
            fields: [
              field('variable', text, lt.range(2, of), codeEnd),
              field('collection', text, lt.range(of + 1, hacer < 0 ? lt.length : hacer), codeEnd),
            ],
          },
          located,
        };
      }
      case 'for': {
        const assign = lt.find(['DESDE'], 1, ['arrow', 'eq']);
        const until = lt.find(['HASTA'], Math.max(assign, 1));
        if (assign < 0 || until < 0) return null;
        const withStep = lt.find(['CON'], until + 1);
        const paso = withStep >= 0 && lt.word(withStep + 1) === 'PASO' ? withStep + 1 : -1;
        const hacer = lt.find(['HACER'], until + 1);
        const endTo = withStep >= 0 ? withStep : hacer >= 0 ? hacer : lt.length;
        const endRange = lt.range(until + 1, endTo);
        const fields: FieldRange[] = [
          field('variable', text, lt.range(1, assign), codeEnd),
          field('start', text, lt.range(assign + 1, until), codeEnd),
          field('end', text, endRange, codeEnd),
        ];
        if (paso >= 0) {
          const step = field('step', text, lt.range(paso + 1, hacer >= 0 ? hacer : lt.length), codeEnd);
          fields.push({ ...step, optional: true, clearFrom: endRange?.to ?? lt.tokens[withStep].offset });
        } else {
          const at = endRange?.to ?? codeEnd;
          fields.push({ key: 'step', value: '', from: at, to: at, optional: true, missing: { prefix: ' Con Paso ' } });
        }
        return { pieces: { kind: 'for', fields }, located };
      }
      default:
        return null;
    }
  }

  // A simple statement: from its start to its `;`, comment or line end.
  const { end } = scanStatement(text, start);
  const lt = new LineTokens(tokensBetween(tokens, start, end), text, end);
  switch (statement.kind) {
    case 'assignment': {
      const arrow = lt.find([], 1, ['arrow', 'eq']);
      if (arrow < 0) break;
      return {
        pieces: {
          kind: 'assignment',
          fields: [field('target', text, lt.range(0, arrow), end), field('value', text, lt.range(arrow + 1, lt.length), end)],
        },
        located,
      };
    }
    case 'read':
      return { pieces: { kind: 'read', fields: [field('targets', text, lt.range(1, lt.length), end)] }, located };
    case 'write': {
      // Escribir [Sin Saltar] valores [Sin Saltar]: the keywords stay as written.
      const noNewline = (index: number) => {
        const word = lt.word(index);
        if (word === 'SINSALTAR' || word === 'SINBAJAR') return 1;
        if (word === 'SIN' && (lt.word(index + 1) === 'SALTAR' || lt.word(index + 1) === 'BAJAR')) return 2;
        return 0;
      };
      const from = 1 + noNewline(1);
      let to = lt.length;
      if (to - 2 >= from && noNewline(to - 2) === 2) to -= 2;
      else if (to - 1 >= from && noNewline(to - 1) === 1) to -= 1;
      return { pieces: { kind: 'write', fields: [field('values', text, lt.range(from, to), end)] }, located };
    }
    case 'define': {
      const como = lt.find(['COMO', 'ES'], 1);
      if (como < 0) break;
      return {
        pieces: {
          kind: 'define',
          fields: [field('names', text, lt.range(1, como), end), field('type', text, lt.range(como + 1, lt.length), end)],
        },
        located,
      };
    }
    default:
      break;
  }
  return { pieces: { kind: statement.kind, fields: [field('code', text, lt.range(0, lt.length), end)] }, located };
}

function nestedCount(statement: StatementNode): number {
  let count = 0;
  for (const located of walk(statement, { type: 'MainRoutine', headerKind: 'Algoritmo', name: '', body: [] })) if (located) count += 1;
  return count;
}

/**
 * What the inline editor shows for a block: its editable pieces as written
 * in the source, whether it can be deleted, and how much it contains.
 */
export function describeNode(source: string, settings: Partial<EngineSettings>, nodeId: string): FlowEditable | null {
  const parsed = parse(source, settings);
  if (!parsed.program) return null;
  const node = findNode(parsed.program, nodeId);
  if (!node?.edit) return null;
  const text = new SourceText(source);
  const found = piecesOf(text, new Lexer(source, settings).tokenize(), parsed.program, node.edit);
  if (!found) return null;
  return {
    kind: found.pieces.kind,
    fields: found.pieces.fields.map(({ key, value, optional }) => (optional ? { key, value, optional } : { key, value })),
    deletable: found.located !== null,
    nested: found.located ? nestedCount(found.located.statement) : 0,
  };
}

/* ------------------------------------------------------------------ */
/* Profile style                                                       */
/* ------------------------------------------------------------------ */

const WORD_TO_SYMBOL: Record<string, string> = { Y: '&&', O: '||', NO: '~', MOD: '%' };

/**
 * Y / O / NO / MOD written as && / || / ~ / % (outside strings), for profiles
 * without word operators. Only tried when the text as typed does not parse.
 */
export function toSymbolOperators(code: string): string {
  let out = '';
  let quote = '';
  let word = '';
  const flush = () => {
    const symbol = WORD_TO_SYMBOL[word.toUpperCase()];
    out += symbol ?? word;
    word = '';
  };
  for (const char of code) {
    if (quote) {
      out += char;
      if (char === quote) quote = '';
      continue;
    }
    if (/[\p{L}\p{Nd}_]/u.test(char)) {
      word += char;
      continue;
    }
    flush();
    if (char === '"' || char === "'") quote = char;
    out += char;
  }
  flush();
  return out.replace(/~ +/g, '~');
}

/** Whether new simple statements end in `;`: the profile forces it, or the routine already writes them. */
function wantsSemicolons(settings: Partial<EngineSettings>, source: SourceText, routine: Routine): boolean {
  if (normalizeEngineSettings(settings).forceSemicolon) return true;
  for (const { statement } of walk(routine, routine)) {
    if (isStructure(statement) || !statement.span) continue;
    if (scanStatement(source.text, statement.span.start.offset).semicolonEnd !== undefined) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Replace                                                             */
/* ------------------------------------------------------------------ */

function cleanValue(key: FlowFieldKey, value: string): string {
  let text = value.trim();
  // A `;` typed at the end belongs to the statement, not the piece; the source keeps its own.
  if (key === 'code' || key === 'values' || key === 'targets' || key === 'value' || key === 'type') text = text.replace(/\s*;+$/, '');
  return text;
}

/**
 * Rewrites the pieces of a block (its condition, the values of an Escribir,
 * a Para's header...). Pieces not in `values` keep their text.
 */
export function replaceStatementText(
  source: string,
  settings: Partial<EngineSettings>,
  nodeId: string,
  values: Partial<Record<FlowFieldKey, string>>,
): FlowEditResult {
  const parsed = parse(source, settings);
  if (!parsed.program) return { ok: false, error: 'not-found' };
  const node = findNode(parsed.program, nodeId);
  if (!node?.edit) return { ok: false, error: 'not-found' };
  const text = new SourceText(source);
  const found = piecesOf(text, new Lexer(source, settings).tokenize(), parsed.program, node.edit);
  if (!found) return { ok: false, error: 'not-found' };
  const ref = node.edit;

  const changes: Array<{ key: FlowFieldKey; from: number; to: number; text: string; wordy: boolean }> = [];
  for (const piece of found.pieces.fields) {
    const raw = values[piece.key];
    if (raw === undefined) continue;
    if (/[\r\n]/.test(raw.trim())) return { ok: false, error: 'multiline', field: piece.key };
    const value = cleanValue(piece.key, raw);
    if (value === piece.value.trim()) continue;
    if (!value) {
      if (!piece.optional) return { ok: false, error: 'empty', field: piece.key };
      if (piece.clearFrom !== undefined) changes.push({ key: piece.key, from: piece.clearFrom, to: piece.to, text: '', wordy: false });
      continue;
    }
    if (piece.missing) changes.push({ key: piece.key, from: piece.from, to: piece.from, text: `${piece.missing.prefix}${value}`, wordy: true });
    else changes.push({ key: piece.key, from: piece.from, to: piece.to, text: value, wordy: true });
  }
  if (changes.length === 0) return { ok: true, source, select: ref };

  const apply = (symbols: boolean) => {
    let next = source;
    for (const change of [...changes].sort((a, b) => b.from - a.from)) {
      const replacement = symbols && change.wordy ? toSymbolOperators(change.text) : change.text;
      next = next.slice(0, change.from) + replacement + next.slice(change.to);
    }
    return next;
  };

  const before = countStatements(parsed.program);
  const check = (next: string): FlowEditResult => {
    const result = parse(next, settings);
    if (!result.program) return { ok: false, error: 'invalid', diagnostic: result.diagnostics[0], field: changes[0].key };
    if (countStatements(result.program) !== before) return { ok: false, error: 'structure', field: changes[0].key };
    if (found.located) {
      const after = locate(result.program, ref.offset);
      const kept = after && (found.pieces.fields[0].key === 'code'
        ? !isStructure(after.statement)
        : after.statement.kind === found.located.statement.kind);
      if (!kept) return { ok: false, error: 'structure', field: changes[0].key };
    }
    return { ok: true, source: next, select: ref };
  };

  const first = check(apply(false));
  if (first.ok || first.error !== 'invalid' || normalizeEngineSettings(settings).wordOperators) return first;
  const converted = apply(true);
  if (converted === apply(false)) return first;
  const second = check(converted);
  return second.ok ? second : first;
}

/* ------------------------------------------------------------------ */
/* Insert                                                              */
/* ------------------------------------------------------------------ */

/** Lines of a new statement: [depth relative to the statement, text]. */
type Template = Array<[number, string]>;

const PLACEHOLDER_NAMES = ['x', 'y', 'z', 'n', 'm', 'a', 'b', 'c'];

/** Names the routine already uses (first seen first). */
function namesIn(routine: Routine): string[] {
  const names: string[] = [];
  const add = (name: string) => {
    if (!names.some((known) => known.toLowerCase() === name.toLowerCase())) names.push(name);
  };
  if (routine.type === 'Routine') routine.params.forEach((param) => add(param.name));
  for (const { statement } of walk(routine, routine)) {
    if (statement.kind === 'define') statement.names.forEach(add);
    else if (statement.kind === 'read') statement.targets.forEach((target) => target.kind === 'identifier' && add(target.name));
    else if (statement.kind === 'assignment' && statement.target.kind === 'identifier') add(statement.target.name);
  }
  return names;
}

function templateFor(
  kind: FlowInsertKind,
  names: string[],
  call: string,
): Template {
  const variable = names[0] ?? 'x';
  const fresh = PLACEHOLDER_NAMES.find((name) => !names.some((known) => known.toLowerCase() === name)) ?? 'valor';
  switch (kind) {
    case 'write':
      return [[0, 'Escribir "Hola"']];
    case 'read':
      return [[0, `Leer ${variable}`]];
    case 'assign':
      return [[0, `${variable} <- 0`]];
    case 'define':
      return [[0, `Definir ${fresh} Como Entero`]];
    case 'if':
      return [[0, `Si ${variable} > 0 Entonces`], [0, 'FinSi']];
    case 'ifElse':
      return [[0, `Si ${variable} > 0 Entonces`], [0, 'SiNo'], [0, 'FinSi']];
    case 'switch':
      return [[0, `Segun ${variable} Hacer`], [1, '1:'], [1, 'De Otro Modo:'], [0, 'FinSegun']];
    case 'while':
      return [[0, `Mientras ${variable} > 0 Hacer`], [0, 'FinMientras']];
    case 'repeat':
      return [[0, 'Repetir'], [0, `Hasta Que ${variable} > 0`]];
    case 'for':
      return [[0, 'Para i <- 1 Hasta 10 Hacer'], [0, 'FinPara']];
    case 'call':
      return [[0, call]];
  }
}

const SIMPLE_KINDS = new Set<FlowInsertKind>(['write', 'read', 'assign', 'define', 'call']);

interface InsertionPoint {
  /** Replace [from, to) (usually empty) with before + statement + after. */
  from: number;
  to: number;
  before: string;
  after: string;
  /** Indent of the new statement's lines after its first. */
  indent: string;
}

function lineFirstToken(tokens: Token[], source: SourceText, line: number): Token[] {
  return tokensBetween(tokens, source.lineStart(line), source.lineEnd(line));
}

/** Indent of a statement's own lines (one deeper than a label it shares its line with). */
function statementIndent(source: SourceText, statement: StatementNode, unit: string): string {
  const line = startLine(statement);
  const prefix = source.text.slice(source.lineStart(line), statement.span!.start.offset);
  return prefix.trim() === '' ? prefix : source.indentOf(line) + unit;
}

function afterLine(source: SourceText, line: number, indent: string): InsertionPoint {
  // An empty list often keeps a blank line for its first statement: fill it.
  if (line < source.lineCount && source.isBlank(line + 1)) {
    const blank = line + 1;
    return { from: source.lineStart(blank), to: source.lineEnd(blank), before: indent, after: '', indent };
  }
  const end = source.lineEnd(line);
  return { from: end, to: end, before: `\n${indent}`, after: '', indent };
}

function beforeLine(source: SourceText, line: number, before: string, indent: string): InsertionPoint {
  const start = source.lineStart(line);
  return { from: start, to: start, before, after: '\n', indent };
}

function insertionPoint(
  source: SourceText,
  tokens: Token[],
  owner: Owner,
  slot: FlowInsertSlot,
  unit: string,
): InsertionPoint | null {
  const entry = listsOf(owner).find((candidate) => candidate.name === slot.list);
  if (!entry || !owner.span) return null;
  const { list } = entry;
  const text = source.text;

  if (slot.index < list.length) {
    const statement = list[slot.index];
    const line = startLine(statement);
    const lineStart = source.lineStart(line);
    const prefix = text.slice(lineStart, statement.span!.start.offset);
    if (prefix.trim() === '') return { from: lineStart, to: lineStart, before: prefix, after: '\n', indent: prefix };
    // Shares its line with a label (`1: Escribir ...`): the new one takes the label's place.
    const indent = source.indentOf(line) + unit;
    const at = statement.span!.start.offset;
    return { from: at, to: at, before: '', after: `\n${indent}`, indent };
  }

  if (list.length > 0) {
    const last = list[list.length - 1];
    const indent = statementIndent(source, last, unit);
    const line = endLine(last);
    let at = source.lineEnd(line);
    if (!isStructure(last)) {
      const scan = scanStatement(text, last.span!.start.offset);
      const end = scan.semicolonEnd ?? scan.end;
      if (!restIsEmpty(text, end, at)) at = end;
    }
    return { from: at, to: at, before: `\n${indent}`, after: '', indent };
  }

  // An empty list: right below its header or marker line.
  const headerLine = owner.span.start.line;
  const headerIndent = source.indentOf(headerLine);
  const inner = headerIndent + unit;
  if ('type' in owner) return afterLine(source, headerLine, inner);

  const closer = owner.span.end.line;
  const findMarker = (from: number, test: (words: string[]) => boolean) => {
    for (let line = from; line < closer; line += 1) {
      const words = lineFirstToken(tokens, source, line).map((token) => token.normalized);
      if (test(words)) return line;
    }
    return -1;
  };

  switch (owner.kind) {
    case 'if': {
      if (slot.list === 'then') return afterLine(source, headerLine, inner);
      const thenLast = owner.thenBranch[owner.thenBranch.length - 1];
      const elseLine = findMarker(thenLast ? endLine(thenLast) + 1 : headerLine + 1, (words) => words[0] === 'SINO');
      if (elseLine >= 0) return afterLine(source, elseLine, source.indentOf(elseLine) + unit);
      // No SiNo yet: add one above FinSi.
      return beforeLine(source, closer, `${headerIndent}SiNo\n${inner}`, inner);
    }
    case 'switch': {
      if (slot.list.startsWith('case-')) {
        const caseNode = entry.caseNode;
        if (!caseNode?.span) return null;
        const caseLine = caseNode.span.start.line;
        return afterLine(source, caseLine, source.indentOf(caseLine) + unit);
      }
      const lastCase = owner.cases[owner.cases.length - 1];
      const lastBody = lastCase?.body[lastCase.body.length - 1];
      const from = lastBody ? endLine(lastBody) + 1 : lastCase?.span ? lastCase.span.start.line + 1 : headerLine + 1;
      const otherwise = findMarker(from, (words) => words[0] === 'DE' && words[1] === 'OTRO');
      if (otherwise >= 0) return afterLine(source, otherwise, source.indentOf(otherwise) + unit);
      const caseIndent = owner.cases[0]?.span ? source.indentOf(owner.cases[0].span.start.line) : inner;
      return beforeLine(source, closer, `${caseIndent}De Otro Modo:\n${caseIndent}${unit}`, caseIndent + unit);
    }
    default:
      return afterLine(source, headerLine, inner);
  }
}

/** A name for a new subprocess that the program does not use yet. */
function freshRoutineName(program: ProgramNode): string {
  const used = new Set(routinesOf(program).map((routine) => routine.name.toLowerCase()));
  for (const { routine } of allStatements(program)) namesIn(routine).forEach((name) => used.add(name.toLowerCase()));
  let name = 'MiSubproceso';
  for (let n = 2; used.has(name.toLowerCase()); n += 1) name = `MiSubproceso${n}`;
  return name;
}

/**
 * Inserts a new statement where a connector is, with placeholder text, and
 * says which block it became (so the diagram can open its editor).
 */
export function insertStatement(
  source: string,
  settings: Partial<EngineSettings>,
  edgeId: string,
  kind: FlowInsertKind,
): FlowEditResult {
  const parsed = parse(source, settings);
  if (!parsed.program) return { ok: false, error: 'not-found' };
  const program = parsed.program;
  const slot = findEdge(program, edgeId)?.slot;
  if (!slot) return { ok: false, error: 'not-found' };
  const owned = findOwner(program, slot.owner);
  if (!owned) return { ok: false, error: 'not-found' };

  const text = new SourceText(source);
  const tokens = new Lexer(source, settings).tokenize();
  const unit = detectIndentUnit(source);
  const point = insertionPoint(text, tokens, owned.owner, slot, unit);
  if (!point) return { ok: false, error: 'not-found' };

  // A call goes to a subprocess the program has, or to a new, empty one.
  let call = '';
  let newRoutine: string | null = null;
  if (kind === 'call') {
    const target = program.routines.find((routine) => routine !== owned.routine) ?? program.routines[0];
    if (target) {
      call = target.params.length ? `${target.name}(${target.params.map((param) => param.name).join(', ')})` : target.name;
    } else {
      if (!normalizeEngineSettings(settings).enableUserFunctions) return { ok: false, error: 'no-subprocess' };
      newRoutine = freshRoutineName(program);
      call = newRoutine;
    }
  }

  const semicolon = SIMPLE_KINDS.has(kind) && wantsSemicolons(settings, text, owned.routine) ? ';' : '';
  const template = templateFor(kind, namesIn(owned.routine), call);
  const body = template
    .map(([depth, line], index) => (index === 0 ? '' : point.indent + unit.repeat(depth)) + line)
    .join('\n') + semicolon;

  let next = source.slice(0, point.from) + point.before + body + point.after + source.slice(point.to);
  if (newRoutine) {
    const keyword = program.entry.headerKind === 'Proceso' ? 'SubProceso' : 'SubAlgoritmo';
    next = `${next.replace(/\s*$/, '')}\n\n${keyword} ${newRoutine}\nFin${keyword}\n`;
  }
  const offset = point.from + point.before.length;

  const result = parse(next, settings);
  if (!result.program) return { ok: false, error: 'invalid', diagnostic: result.diagnostics[0] };
  const inserted = locate(result.program, offset);
  return { ok: true, source: next, select: inserted ? refFor(inserted.statement) : null };
}

/* ------------------------------------------------------------------ */
/* Remove                                                              */
/* ------------------------------------------------------------------ */

/** Removes the text of lines [first, last] (whole lines, with their line break). */
function removeLines(source: SourceText, first: number, last: number): { from: number; to: number } {
  const from = source.lineStart(first);
  const nextStart = last < source.lineCount ? source.lineStart(last + 1) : source.text.length;
  // On the last line of the file, take the break before it instead.
  if (last >= source.lineCount && first > 1) return { from: source.lineEnd(first - 1), to: source.text.length };
  return { from, to: nextStart };
}

/** The statements of a structure as text, one level shallower, for "keep what is inside". */
function unwrappedBody(source: SourceText, statement: StatementNode, unit: string): string[] {
  const headerIndent = source.indentOf(startLine(statement));
  const lines: string[] = [];
  for (const { list } of listsOf(statement)) {
    if (list.length === 0) continue;
    const first = list[0];
    const last = list[list.length - 1];
    const firstIndent = statementIndent(source, first, unit);
    const depth = firstIndent.startsWith(headerIndent) ? firstIndent.length - headerIndent.length : unit.length;
    for (let line = startLine(first); line <= endLine(last); line += 1) {
      let content = source.lineText(line);
      // The first statement may share its line with a case label.
      if (line === startLine(first)) content = firstIndent + source.text.slice(first.span!.start.offset, source.lineEnd(line));
      const leading = /^[ \t]*/.exec(content)![0];
      lines.push(content.slice(Math.min(depth, leading.length)));
    }
  }
  return lines;
}

/**
 * Removes a block's statement. A structure goes with everything inside it,
 * unless `keepBody` is set: then what was inside takes its place.
 */
export function removeStatement(
  source: string,
  settings: Partial<EngineSettings>,
  nodeId: string,
  options: { keepBody?: boolean } = {},
): FlowEditResult {
  const parsed = parse(source, settings);
  if (!parsed.program) return { ok: false, error: 'not-found' };
  const node = findNode(parsed.program, nodeId);
  if (!node?.edit) return { ok: false, error: 'not-found' };
  if (node.edit.part === 'routine') return { ok: false, error: 'not-deletable' };
  const located = locate(parsed.program, node.edit.offset);
  if (!located?.statement.span) return { ok: false, error: 'not-found' };
  const { statement } = located;

  const text = new SourceText(source);
  const unit = detectIndentUnit(source);
  const start = statement.span!.start.offset;
  const first = startLine(statement);
  const last = endLine(statement);
  const ownLine = text.text.slice(text.lineStart(first), start).trim() === '';

  let from: number;
  let to: number;
  let replacement = '';

  if (isStructure(statement)) {
    const body = options.keepBody ? unwrappedBody(text, statement, unit) : [];
    if (ownLine) {
      ({ from, to } = removeLines(text, first, last));
      if (body.length) {
        // removeLines takes either the lines with their break, or (at the end of the file) the break before them.
        replacement = from === text.lineStart(first) ? `${body.join('\n')}${text.text[to - 1] === '\n' ? '\n' : ''}` : `\n${body.join('\n')}`;
      }
    } else {
      from = start;
      to = text.lineEnd(last);
      replacement = body.length ? `\n${body.join('\n')}` : '';
      while (from > 0 && /[ \t]/.test(text.text[from - 1])) from -= 1;
    }
  } else {
    const scan = scanStatement(text.text, start);
    const end = scan.semicolonEnd ?? scan.end;
    const lineEnd = text.lineEnd(first);
    if (ownLine && restIsEmpty(text.text, end, lineEnd)) {
      ({ from, to } = removeLines(text, first, first));
    } else {
      from = start;
      to = end;
      while (to < lineEnd && /[ \t]/.test(text.text[to])) to += 1;
      if (to >= lineEnd || text.text.startsWith('//', to)) while (from > 0 && /[ \t]/.test(text.text[from - 1])) from -= 1;
    }
  }

  const next = text.text.slice(0, from) + replacement + text.text.slice(to);
  const result = parse(next, settings);
  if (!result.program) return { ok: false, error: 'invalid', diagnostic: result.diagnostics[0] };

  // Select what took its place: the first statement at or after it, else the one before.
  let after: StatementNode | null = null;
  let previous: StatementNode | null = null;
  const routineEnd = located.routine.span?.end.offset ?? Infinity;
  const shift = replacement.length - (to - from);
  for (const { statement: candidate } of allStatements(result.program)) {
    const offset = candidate.span?.start.offset;
    if (offset === undefined) continue;
    if (offset >= from && offset <= routineEnd + shift) {
      if (!after || offset < after.span!.start.offset) after = candidate;
    } else if (offset < from && located.routine.span && offset >= located.routine.span.start.offset) {
      if (!previous || offset > previous.span!.start.offset) previous = candidate;
    }
  }
  const chosen = after ?? previous;
  return { ok: true, source: next, select: chosen ? refFor(chosen) : null };
}
