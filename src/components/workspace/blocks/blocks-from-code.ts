// PROTOTYPE — turns PSeInt code into blocks (the reverse of blocks-generator).
// Statements and expressions without a block of their own are kept as code
// blocks holding their exact source text, so converting never loses anything
// but comments.

import type * as Blockly from "blockly/core";

import { Lexer, Parser } from "@/src/engine";
import type {
  EngineSettings,
  ExpressionNode,
  MainRoutineNode,
  ProgramNode,
  SourceSpan,
  StatementNode,
  Token,
} from "@/src/engine";
import { pseudocode } from "./blocks-generator";

type BlockState = Blockly.serialization.blocks.State;

export interface BlocksState {
  blocks: { languageVersion: 0; blocks: BlockState[] };
}

/** Function names offered by the ps_funcion / ps_funcion2 dropdowns, keyed by their normalised spelling. */
const FUNCTIONS_1 = new Map(
  [
    "Raiz", "Abs", "Trunc", "Redon", "Azar", "Longitud", "Mayusculas", "Minusculas",
    "ConvertirANumero", "ConvertirATexto", "Sen", "Cos", "Ln", "Exp",
  ].map((name) => [normalize(name), name])
);
// RC is PSeInt's other spelling of Raiz.
FUNCTIONS_1.set("RC", "Raiz");
const FUNCTIONS_2 = new Map(["Aleatorio", "Concatenar"].map((name) => [normalize(name), name]));

/** Definir types offered by the ps_definir dropdown. */
const TYPES: Record<string, string> = {
  ENTERO: "Entero", ENTERA: "Entero", ENTEROS: "Entero", ENTERAS: "Entero",
  REAL: "Real", REALES: "Real", NUMERO: "Real", NUMEROS: "Real",
  NUMERICO: "Real", NUMERICOS: "Real", NUMERICA: "Real", NUMERICAS: "Real",
  CARACTER: "Caracter", CARACTERES: "Caracter", CADENA: "Caracter", CADENAS: "Caracter",
  TEXTO: "Caracter", TEXTOS: "Caracter",
  LOGICO: "Logico", LOGICOS: "Logico", LOGICA: "Logico", LOGICAS: "Logico",
};

const ARITHMETIC: Record<string, string> = { "+": "+", "-": "-", "*": "*", "/": "/", "^": "^", "%": "MOD" };
const COMPARISON = new Set(["=", "<>", "<", ">", "<=", ">="]);

function normalize(word: string): string {
  return word.normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase();
}

/* ------------------------------------------------------------------ */
/* Source slicing                                                      */
/* ------------------------------------------------------------------ */

/**
 * Finds the exact source text of AST nodes. Parser spans are not exact
 * (a binary node ends at its operator, a string literal two characters early),
 * so a node's extent is the widest span of it and its descendants, snapped to
 * the real ends of the tokens there.
 */
class SourceText {
  private readonly tokens: Token[];

  constructor(
    readonly source: string,
    settings: Partial<EngineSettings>
  ) {
    this.tokens = new Lexer(source, settings).tokenize().filter((token) => token.kind !== "eof");
  }

  private tokenEnd(token: Token): number {
    return token.offset + token.lexeme.length + (token.kind === "string" ? 2 : 0);
  }

  /** Index of the last token starting before `offset`, or -1. */
  private lastTokenBefore(offset: number): number {
    let low = 0;
    let high = this.tokens.length - 1;
    let found = -1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (this.tokens[mid].offset < offset) {
        found = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return found;
  }

  range(node: object): [number, number] | null {
    const spans: SourceSpan[] = [];
    collectSpans(node, spans);
    if (spans.length === 0) return null;
    let start = Infinity;
    let end = -Infinity;
    for (const span of spans) {
      start = Math.min(start, span.start.offset);
      for (const offset of [span.start.offset + 1, span.end.offset]) {
        const index = this.lastTokenBefore(offset);
        if (index >= 0) end = Math.max(end, this.tokenEnd(this.tokens[index]));
      }
    }
    return end > start ? [start, end] : null;
  }

  text(node: object): string {
    const range = this.range(node);
    return range ? this.source.slice(range[0], range[1]) : "";
  }

  /** Like text(), with the indentation of the first line removed from the following ones. */
  block(node: object): string {
    const range = this.range(node);
    if (!range) return "";
    const lineStart = this.source.lastIndexOf("\n", range[0] - 1) + 1;
    const indent = this.source.slice(lineStart, range[0]);
    const lines = this.source.slice(range[0], range[1]).split("\n");
    if (!/^[ \t]*$/.test(indent) || !indent) return lines.join("\n");
    return lines.map((line, i) => (i > 0 && line.startsWith(indent) ? line.slice(indent.length) : line)).join("\n");
  }

  lines(node: object): number {
    return this.text(node).split("\n").length;
  }
}

function collectSpans(node: unknown, spans: SourceSpan[]): void {
  if (Array.isArray(node)) {
    for (const item of node) collectSpans(item, spans);
    return;
  }
  if (!node || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node)) {
    if (key === "span") {
      if (value) spans.push(value as SourceSpan);
    } else if (key !== "inferredTypes") {
      collectSpans(value, spans);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Code → blocks                                                       */
/* ------------------------------------------------------------------ */

class Converter {
  constructor(private readonly text: SourceText) {}

  /* ---------- expressions ---------- */

  private raw(expression: ExpressionNode): BlockState {
    while (expression.kind === "group") expression = expression.expression;
    return { type: "ps_expresion", fields: { CODE: this.text.text(expression) } };
  }

  private name(expression: ExpressionNode): string | null {
    return expression.kind === "identifier" ? expression.name : null;
  }

  expression(expression: ExpressionNode): BlockState {
    switch (expression.kind) {
      case "group":
        // Grouping is carried by the block tree; the generator adds the parentheses it needs.
        return this.expression(expression.expression);
      case "literal":
        if (expression.valueType === "number") return { type: "ps_numero", fields: { NUM: expression.value } };
        if (expression.valueType === "string") return { type: "ps_texto", fields: { TEXT: expression.value } };
        return { type: "ps_logico", fields: { VALUE: expression.value ? "Verdadero" : "Falso" } };
      case "identifier":
        return { type: "ps_variable", fields: { NAME: expression.name } };
      case "arrayAccess": {
        const name = this.name(expression.target);
        if (!name || expression.indices.length !== 1) return this.raw(expression);
        return {
          type: "ps_elemento",
          fields: { NAME: name },
          inputs: { INDEX: { block: this.expression(expression.indices[0]) } },
        };
      }
      case "binary": {
        const { operator } = expression;
        const inputs = {
          A: { block: this.expression(expression.left) },
          B: { block: this.expression(expression.right) },
        };
        if (operator in ARITHMETIC) return { type: "ps_aritmetica", fields: { OP: ARITHMETIC[operator] }, inputs };
        if (COMPARISON.has(operator)) return { type: "ps_comparar", fields: { OP: operator }, inputs };
        if (operator === "AND" || operator === "OR") {
          return { type: "ps_logica", fields: { OP: operator === "AND" ? "Y" : "O" }, inputs };
        }
        return this.raw(expression);
      }
      case "unary": {
        if (expression.operator === "NOT") {
          return { type: "ps_no", inputs: { A: { block: this.expression(expression.operand) } } };
        }
        let operand = expression.operand;
        while (operand.kind === "group") operand = operand.expression;
        if (expression.operator === "-" && operand.kind === "literal" && operand.valueType === "number") {
          return { type: "ps_numero", fields: { NUM: -(operand.value as number) } };
        }
        return this.raw(expression);
      }
      case "call": {
        const key = normalize(expression.callee);
        const source = this.text.text(expression);
        // A zero-argument builtin written without parentheses (PI) reads like a name.
        if (expression.args.length === 0 && /^[\p{L}_][\p{L}\p{Nd}_]*$/u.test(source)) {
          return { type: "ps_variable", fields: { NAME: source } };
        }
        if (expression.args.length === 1 && FUNCTIONS_1.has(key)) {
          return {
            type: "ps_funcion",
            fields: { NAME: FUNCTIONS_1.get(key) },
            inputs: { A: { block: this.expression(expression.args[0]) } },
          };
        }
        if (expression.args.length === 2 && FUNCTIONS_2.has(key)) {
          return {
            type: "ps_funcion2",
            fields: { NAME: FUNCTIONS_2.get(key) },
            inputs: {
              A: { block: this.expression(expression.args[0]) },
              B: { block: this.expression(expression.args[1]) },
            },
          };
        }
        return this.raw(expression);
      }
    }
  }

  /** Several values as one: `a, b, c` is unir(a, unir(b, c)). */
  private list(expressions: ExpressionNode[]): BlockState {
    const [first, ...rest] = expressions;
    if (rest.length === 0) return this.expression(first);
    return {
      type: "ps_unir",
      inputs: { A: { block: this.expression(first) }, B: { block: this.list(rest) } },
    };
  }

  /* ---------- statements ---------- */

  private rawStatement(statement: StatementNode): BlockState {
    return { type: "ps_raw", fields: { CODE: this.text.block(statement) } };
  }

  /** The statements as a chain of blocks linked through `next`, or undefined when empty. */
  chain(statements: StatementNode[]): BlockState | undefined {
    let first: BlockState | undefined;
    let last: BlockState | undefined;
    for (const statement of statements) {
      const blocks = this.statement(statement);
      for (const block of Array.isArray(blocks) ? blocks : [blocks]) {
        if (last) last.next = { block };
        else first = block;
        last = block;
      }
    }
    return first;
  }

  private body(statements: StatementNode[]): { block: BlockState } | undefined {
    const block = this.chain(statements);
    return block ? { block } : undefined;
  }

  private withInputs(block: BlockState, inputs: Record<string, { block: BlockState } | { shadow: BlockState } | undefined>): BlockState {
    const present = Object.fromEntries(Object.entries(inputs).filter(([, value]) => value));
    return Object.keys(present).length ? { ...block, inputs: present as BlockState["inputs"] } : block;
  }

  /** One block per statement, except `Dimension a[3], b[4]`, which becomes one block per array. */
  statement(statement: StatementNode): BlockState | BlockState[] {
    switch (statement.kind) {
      case "write":
        return {
          type: "ps_escribir",
          fields: { NEWLINE: statement.newline ? "TRUE" : "FALSE" },
          inputs: { VALUE: { block: this.list(statement.expressions) } },
        };
      case "read":
        // Several targets stay one `Leer a, b`, chained like Escribir's values.
        return { type: "ps_leer", inputs: { TARGET: { block: this.list(statement.targets) } } };
      case "assignment":
        return {
          type: "ps_asignar",
          inputs: { TARGET: { block: this.expression(statement.target) }, VALUE: { block: this.expression(statement.value) } },
        };
      case "define": {
        const type = TYPES[normalize(statement.dataType)];
        if (!type) return this.rawStatement(statement);
        return { type: "ps_definir", fields: { NAMES: statement.names.join(", "), TYPE: type } };
      }
      case "dimension":
        if (statement.resize || statement.items.some((item) => item.dimensions.length !== 1)) {
          return this.rawStatement(statement);
        }
        return statement.items.map((item) => ({
          type: "ps_dimension",
          fields: { NAME: item.name },
          inputs: { SIZE: { block: this.expression(item.dimensions[0]) } },
        }));
      case "if": {
        const hasElse = statement.elseBranch.length > 0;
        return this.withInputs(
          { type: hasElse ? "ps_si_sino" : "ps_si" },
          {
            COND: { block: this.expression(statement.condition) },
            THEN: this.body(statement.thenBranch),
            ELSE: hasElse ? this.body(statement.elseBranch) : undefined,
          }
        );
      }
      case "while":
        return this.withInputs(
          { type: "ps_mientras" },
          { COND: { block: this.expression(statement.condition) }, BODY: this.body(statement.body) }
        );
      case "repeat":
        return this.withInputs(
          { type: "ps_repetir", fields: { MODE: statement.mode === "while" ? "MIENTRAS" : "HASTA" } },
          { COND: { block: this.expression(statement.condition) }, BODY: this.body(statement.body) }
        );
      case "for":
        return this.withInputs(
          { type: "ps_para", fields: { VAR: statement.variable } },
          {
            FROM: { block: this.expression(statement.start) },
            TO: { block: this.expression(statement.end) },
            // Without Con Paso, a shadow 1 (which the generator leaves out) keeps PSeInt's default step.
            STEP: statement.step
              ? { block: this.expression(statement.step) }
              : { shadow: { type: "ps_numero", fields: { NUM: 1 } } },
            BODY: this.body(statement.body),
          }
        );
      case "forEach": {
        const array = this.name(statement.collection);
        if (!array) return this.rawStatement(statement);
        return this.withInputs(
          { type: "ps_para_cada", fields: { VAR: statement.variable, ARRAY: array } },
          { BODY: this.body(statement.body) }
        );
      }
      case "clear":
        return { type: "ps_limpiar" };
      case "wait": {
        if (statement.mode === "key") return { type: "ps_esperar_tecla" };
        const duration = statement.durationMs;
        if (!duration) return this.rawStatement(statement);
        // The parser turns `Esperar n Segundos` into n * 1000 with a literal that has no span.
        const seconds =
          duration.kind === "binary" &&
          duration.operator === "*" &&
          duration.right.kind === "literal" &&
          duration.right.value === 1000 &&
          !duration.right.span;
        return {
          type: "ps_esperar",
          fields: { UNIT: seconds ? "Segundos" : "Milisegundos" },
          inputs: { AMOUNT: { block: this.expression(seconds ? duration.left : duration) } },
        };
      }
      case "expression": {
        const call = statement.expression;
        if (call.kind === "identifier") return { type: "ps_llamar", fields: { NAME: call.name, ARGS: "" } };
        if (call.kind === "call") {
          return {
            type: "ps_llamar",
            fields: { NAME: call.callee, ARGS: call.args.map((arg) => this.text.text(arg)).join(", ") },
          };
        }
        return this.rawStatement(statement);
      }
      default:
        // Segun, Retornar, Redimensionar and anything newer: kept as code.
        return this.rawStatement(statement);
    }
  }

  algorithm(entry: MainRoutineNode): BlockState {
    return this.withInputs({ type: "ps_algoritmo", fields: { NAME: entry.name } }, { BODY: this.body(entry.body) });
  }
}

const LEFT = 24;
const TOP = 24;
const GAP = 64;
/** Rough heights, only to keep the top blocks apart and in order. */
const ALGORITHM_LINE_HEIGHT = 48;
const CODE_LINE_HEIGHT = 22;

/** Blockly serialization state for a parsed program: the main algorithm, then each SubProceso/Funcion as code. */
export function programToBlocksState(
  program: ProgramNode,
  source: string,
  settings: Partial<EngineSettings> = {}
): BlocksState {
  const text = new SourceText(source, settings);
  const converter = new Converter(text);
  const blocks: BlockState[] = [];
  let y = TOP;

  const main = converter.algorithm(program.entry);
  blocks.push({ ...main, x: LEFT, y });
  y += text.lines(program.entry) * ALGORITHM_LINE_HEIGHT + GAP;

  for (const routine of program.routines) {
    blocks.push({ type: "ps_raw_top", fields: { CODE: text.block(routine) }, x: LEFT, y });
    y += text.lines(routine) * CODE_LINE_HEIGHT + GAP;
  }

  return { blocks: { languageVersion: 0, blocks } };
}

function parse(source: string, settings: Partial<EngineSettings>) {
  const result = new Parser(source, { settings }).parse();
  const error = result.diagnostics.find((d) => d.severity === "error");
  return { program: error ? null : result.program, error };
}

/** Parses the code and converts it, or reports the first parse error. */
export function codeToBlocksState(
  source: string,
  settings: Partial<EngineSettings>
): { state: BlocksState } | { error: string } {
  const { program, error } = parse(source, settings);
  if (!program) return { error: error ? `${error.line}:${error.column} ${error.message}` : "No se pudo leer el código." };
  return { state: programToBlocksState(program, source, settings) };
}

/* ------------------------------------------------------------------ */
/* Generated line → block                                              */
/* ------------------------------------------------------------------ */

const line = (node: { span?: SourceSpan }) => node.span?.start.line ?? -1;

function nestedStatements(statement: StatementNode): StatementNode[][] {
  switch (statement.kind) {
    case "if":
      return [statement.thenBranch, statement.elseBranch];
    case "while":
    case "repeat":
    case "for":
    case "forEach":
      return [statement.body];
    case "switch":
      return [...statement.cases.map((c) => c.body), statement.defaultCase];
    default:
      return [];
  }
}

function eachStatement(statements: StatementNode[], visit: (statement: StatementNode) => void): void {
  for (const statement of statements) {
    visit(statement);
    for (const nested of nestedStatements(statement)) eachStatement(nested, visit);
  }
}

/** Which statement kinds each block produces. */
const BLOCK_KINDS: Record<string, StatementNode["kind"][]> = {
  ps_escribir: ["write"],
  ps_leer: ["read"],
  ps_asignar: ["assignment"],
  ps_definir: ["define"],
  ps_dimension: ["dimension"],
  ps_si: ["if"],
  ps_si_sino: ["if"],
  ps_mientras: ["while"],
  ps_repetir: ["repeat"],
  ps_para: ["for"],
  ps_para_cada: ["forEach"],
  ps_limpiar: ["clear"],
  ps_esperar_tecla: ["wait"],
  ps_esperar: ["wait"],
  ps_llamar: ["expression"],
};

/**
 * Maps each statement line of `source` (code generated from `workspace` by
 * `pseudocode.workspaceToCode` with the same settings) to the id of the block that wrote it. Lines
 * inside a code block (ps_raw, ps_raw_top) map to that block.
 */
export function lineToBlockMap(
  workspace: Blockly.Workspace,
  source: string,
  settings: Partial<EngineSettings>
): Map<number, string> {
  const map = new Map<number, string>();
  const { program } = parse(source, settings);
  if (!program) return map;

  const mapAll = (statements: StatementNode[], id: string) =>
    eachStatement(statements, (statement) => map.set(line(statement), id));

  /** Walks a chain of statement blocks beside the statements it produced. Returns the line after the chain. */
  const walk = (first: Blockly.Block | null, statements: StatementNode[], cursor: number): number => {
    let index = 0;
    for (let block = first; block; block = block.getNextBlock()) {
      if (!block.isEnabled()) continue; // the generator skips disabled blocks
      if (block.type === "ps_raw") {
        const end = cursor + String(block.getFieldValue("CODE") ?? "").split("\n").length - 1;
        const inside: StatementNode[] = [];
        while (index < statements.length && line(statements[index]) <= end) inside.push(statements[index++]);
        mapAll(inside, block.id);
        cursor = end + 1;
        continue;
      }
      const statement = statements[index++];
      if (!statement || !BLOCK_KINDS[block.type]?.includes(statement.kind)) return cursor; // out of step: stop here
      const at = line(statement);
      map.set(at, block.id);
      switch (statement.kind) {
        case "if": {
          const thenEnd = walk(block.getInputTargetBlock("THEN"), statement.thenBranch, at + 1);
          cursor =
            block.type === "ps_si_sino"
              ? walk(block.getInputTargetBlock("ELSE"), statement.elseBranch, thenEnd + 1) + 1
              : thenEnd + 1;
          break;
        }
        case "while":
        case "repeat":
        case "for":
        case "forEach":
          // The closing line (FinMientras, Hasta Que, FinPara) follows the body.
          cursor = walk(block.getInputTargetBlock("BODY"), statement.body, at + 1) + 1;
          break;
        default:
          cursor = at + 1;
      }
    }
    return cursor;
  };

  // Rebuild the layout of workspaceToCode: top blocks in order, separated by a blank line.
  pseudocode.useSettings(settings);
  pseudocode.init(workspace);
  let start = 1;
  for (const top of workspace.getTopBlocks(true)) {
    if (top.type !== "ps_algoritmo" && top.type !== "ps_raw_top") continue;
    const code = pseudocode.blockToCode(top);
    if (typeof code !== "string" || !code.trim()) continue;
    const end = start + code.trimEnd().split("\n").length - 1;
    if (top.type === "ps_algoritmo" && line(program.entry) === start) {
      map.set(start, top.id);
      walk(top.getInputTargetBlock("BODY"), program.entry.body, start + 1);
    } else if (top.type === "ps_raw_top") {
      for (const routine of program.routines) {
        if (line(routine) < start || line(routine) > end) continue;
        map.set(line(routine), top.id);
        mapAll(routine.body, top.id);
      }
    }
    start = end + 2;
  }
  return map;
}
