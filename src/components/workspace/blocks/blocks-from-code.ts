// Turns PSeInt code into blocks (the reverse of blocks-generator). Every
// statement and expression the language has gets a real block; comments and
// blank lines come along, and spellings the blocks would otherwise normalise
// (Mostrar, `%`, Enteros, …) are remembered in the block's data, so converting
// back writes the same program. The rare thing without a block is kept as a
// code block holding its exact text, so converting never loses anything.

import type * as Blockly from "blockly/core";

import { Lexer, Parser } from "@/src/engine";
import type {
  EngineSettings,
  ExpressionNode,
  MainRoutineNode,
  ProgramNode,
  RoutineNode,
  SourceSpan,
  StatementNode,
  Token,
} from "@/src/engine";
import { FUNCTION_NAMES_0, FUNCTION_NAMES_1, FUNCTION_NAMES_2, FUNCTION_NAMES_3, type BlockData } from "./blocks-defs";
import { pseudocode } from "./blocks-generator";

type BlockState = Blockly.serialization.blocks.State;

export interface BlocksState {
  blocks: { languageVersion: 0; blocks: BlockState[] };
}

function normalize(word: string): string {
  return word.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, "").toUpperCase();
}

const byKey = (names: string[]) => new Map(names.map((name) => [normalize(name), name]));
const FUNCTIONS_0 = byKey(FUNCTION_NAMES_0);
const FUNCTIONS_1 = byKey(FUNCTION_NAMES_1);
const FUNCTIONS_2 = byKey(FUNCTION_NAMES_2);
const FUNCTIONS_3 = byKey(FUNCTION_NAMES_3);

/** Definir types offered by the ps_definir dropdown. */
const TYPES: Record<string, string> = {
  ENTERO: "Entero", ENTERA: "Entero", ENTEROS: "Entero", ENTERAS: "Entero",
  REAL: "Real", REALES: "Real", NUMERO: "Real", NUMEROS: "Real",
  NUMERICO: "Real", NUMERICOS: "Real", NUMERICA: "Real", NUMERICAS: "Real",
  CARACTER: "Caracter", CARACTERES: "Caracter", CADENA: "Caracter", CADENAS: "Caracter",
  TEXTO: "Caracter", TEXTOS: "Caracter",
  LOGICO: "Logico", LOGICOS: "Logico", LOGICA: "Logico", LOGICAS: "Logico",
};

/** Keywords the generator writes, as it writes them; the program's own spelling is kept when it differs. */
const KEYWORDS: Record<string, string> = Object.fromEntries(
  [
    "Si", "Entonces", "SiNo", "FinSi", "Mientras", "Hacer", "FinMientras", "Repetir", "Hasta", "Que",
    "Para", "Con", "Paso", "FinPara", "Cada", "de", "Segun", "FinSegun", "De", "Otro", "Modo", "Leer",
    "Definir", "Como", "Por", "Referencia", "Esperar",
  ].map((word) => [normalize(word), word])
);
// `Para Cada x de a` writes "de"; `De Otro Modo` writes "De" (each block asks for its own).
KEYWORDS.DE = "";

const ARITHMETIC: Record<string, string> = { "+": "+", "-": "-", "*": "*", "/": "/", "^": "^", "%": "MOD" };
const COMPARISON = new Set(["=", "<>", "<", ">", "<=", ">="]);

/* ------------------------------------------------------------------ */
/* Source text                                                         */
/* ------------------------------------------------------------------ */

/**
 * Finds the exact source text of AST nodes. Parser spans are not exact
 * (a binary node ends at its operator, a string literal two characters early),
 * so a node's extent is the widest span of it and its descendants, snapped to
 * the real ends of the tokens there.
 */
class SourceText {
  readonly tokens: Token[];
  private readonly lineStarts: number[] = [0];

  constructor(
    readonly source: string,
    settings: Partial<EngineSettings>
  ) {
    this.tokens = new Lexer(source, settings).tokenize().filter((token) => token.kind !== "eof");
    for (let i = 0; i < source.length; i++) if (source[i] === "\n") this.lineStarts.push(i + 1);
  }

  tokenEnd(token: Token): number {
    return token.offset + token.lexeme.length + (token.kind === "string" ? 2 : 0);
  }

  /** Index of the last token starting before `offset`, or -1. */
  lastTokenBefore(offset: number): number {
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

  /** 1-based line of an offset. */
  lineAt(offset: number): number {
    let low = 0;
    let high = this.lineStarts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (this.lineStarts[mid] <= offset) low = mid;
      else high = mid - 1;
    }
    return low + 1;
  }

  startLine(node: object): number {
    const range = this.range(node);
    return range ? this.lineAt(range[0]) : -1;
  }

  endLine(node: object): number {
    const range = this.range(node);
    return range ? this.lineAt(range[1] - 1) : -1;
  }

  /** The first token at or after `offset` (and before `limit`) that `match` accepts. */
  findToken(offset: number, limit: number, match: (token: Token, index: number) => boolean): Token | null {
    for (let i = Math.max(0, this.lastTokenBefore(offset) + 1); i < this.tokens.length; i++) {
      const token = this.tokens[i];
      if (token.offset >= limit) break;
      if (match(token, i)) return token;
    }
    return null;
  }

  /** Tokens inside [start, end). */
  tokensIn(start: number, end: number): Token[] {
    const from = this.lastTokenBefore(start) + 1;
    const to = this.lastTokenBefore(end);
    return this.tokens.slice(from, to + 1);
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
/* Comments and blank lines                                            */
/* ------------------------------------------------------------------ */

interface Comment {
  /** The text after `//`, without the one space that usually follows it. */
  text: string;
  /** Written as `//text`, without that space. */
  tight: boolean;
  /** There is code before it on the same line. */
  trailing: boolean;
}

/** Each source line's `//` comment, outside strings (which never span lines). */
function scanComments(source: string): { comments: Map<number, Comment>; blank: Set<number> } {
  const comments = new Map<number, Comment>();
  const blank = new Set<number>();
  source.split("\n").forEach((rawLine, index) => {
    const line = rawLine.replace(/\r$/, "");
    if (!line.trim()) {
      blank.add(index + 1);
      return;
    }
    let quote = "";
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (quote) {
        if (char === quote || (quote === '"' && (char === "“" || char === "”"))) quote = "";
      } else if (char === '"' || char === "“" || char === "”") {
        quote = '"';
      } else if (char === "'") {
        quote = "'";
      } else if (char === "/" && line[i + 1] === "/") {
        const after = line.slice(i + 2);
        comments.set(index + 1, {
          text: after.startsWith(" ") ? after.slice(1) : after,
          tight: after !== "" && !after.startsWith(" "),
          trailing: line.slice(0, i).trim() !== "",
        });
        return;
      }
    }
  });
  return { comments, blank };
}

/* ------------------------------------------------------------------ */
/* Code → blocks                                                       */
/* ------------------------------------------------------------------ */

type Inputs = Record<string, { block: BlockState } | { shadow: BlockState } | undefined>;

class Converter {
  /** The next source line not yet turned into blocks. */
  private line = 1;
  private readonly comments: Map<number, Comment>;
  private readonly blankLines: Set<number>;
  private readonly used = new Set<number>();
  /** Trailing comments on lines that have no block of their own (a FinSi), placed before what comes next. */
  private orphans: BlockState[] = [];
  private nextId = 0;
  /** Source line → id of the block that runs it. */
  readonly lines = new Map<number, string>();

  constructor(
    private readonly text: SourceText,
    private readonly routines: Map<string, RoutineNode>
  ) {
    const scan = scanComments(text.source);
    this.comments = scan.comments;
    this.blankLines = scan.blank;
  }

  private id(): string {
    return `ps${++this.nextId}`;
  }

  private routine(name: string): RoutineNode | undefined {
    return this.routines.get(normalize(name));
  }

  /* ---------- layout ---------- */

  private comment(comment: Comment, blank = 0): BlockState {
    const data: BlockData = {};
    if (blank) data.blank = blank;
    if (comment.tight) data.spell = { tight: "1" };
    return withData({ type: "ps_comentario", id: this.id(), fields: { TEXT: comment.text } }, data);
  }

  /**
   * Lines from the cursor up to (not including) `until`: comment lines become
   * comment blocks, and the blank lines right before `until` are counted.
   */
  private gap(until: number): { blocks: BlockState[]; blank: number } {
    const blocks = this.orphans;
    this.orphans = [];
    let blank = 0;
    for (; this.line < until; this.line++) {
      const comment = this.comments.get(this.line);
      if (this.blankLines.has(this.line)) {
        blank++;
      } else if (comment && !this.used.has(this.line)) {
        this.used.add(this.line);
        blocks.push(this.comment(comment, blank));
        blank = 0;
      } else {
        blank = 0;
      }
    }
    return { blocks, blank };
  }

  /** Trailing comments on lines `from`..`to` no block took become comment blocks of their own. */
  private collectOrphans(from: number, to: number): void {
    for (let line = from; line <= to; line++) {
      const comment = this.comments.get(line);
      if (comment && !this.used.has(line)) {
        this.used.add(line);
        this.orphans.push(this.comment(comment));
      }
    }
  }

  /**
   * Moves past a line with no block of its own (a case label, SiNo): comments
   * before it, and one trailing on it, go at the start of what follows.
   */
  private skipLine(line: number): void {
    const before = this.gap(line);
    this.orphans.push(...before.blocks);
    this.collectOrphans(line, line);
    this.line = Math.max(this.line, line + 1);
  }

  /** Places what the statement on `line` needs: the blank lines before it and its trailing comment. */
  private decorate(block: BlockState, line: number, blank: number): BlockState {
    const comment = this.comments.get(line);
    if (comment?.trailing && !this.used.has(line)) {
      this.used.add(line);
      block.icons = { comment: { text: comment.text, pinned: false, height: 80, width: 200 } };
    }
    if (blank) block.data = JSON.stringify({ ...parseData(block.data), blank });
    return block;
  }

  /* ---------- expressions ---------- */

  private raw(expression: ExpressionNode): BlockState {
    while (expression.kind === "group") expression = expression.expression;
    return { type: "ps_expresion", fields: { CODE: this.text.text(expression) } };
  }

  /** Source text between two operands: how the operator was written. */
  private between(left: ExpressionNode, right: ExpressionNode): string | null {
    const a = this.text.range(left);
    const b = this.text.range(right);
    if (!a || !b || b[0] < a[1]) return null;
    return this.text.source.slice(a[1], b[0]).trim();
  }

  expression(expression: ExpressionNode): BlockState {
    switch (expression.kind) {
      case "group": {
        // The generator adds the parentheses a block tree needs; these were written anyway.
        const inner = this.expression(expression.expression);
        return withData(inner, { ...parseData(inner.data), paren: 1 });
      }
      case "literal": {
        const source = this.text.text(expression);
        if (expression.valueType === "number") {
          const block: BlockState = { type: "ps_numero", fields: { NUM: expression.value } };
          return source && source !== String(expression.value) ? withData(block, { spell: { num: source } }) : block;
        }
        if (expression.valueType === "string") {
          const block: BlockState = { type: "ps_texto", fields: { TEXT: expression.value } };
          return source.startsWith("'") ? withData(block, { spell: { quote: "'" } }) : block;
        }
        const word = expression.value ? "Verdadero" : "Falso";
        return spell({ type: "ps_logico", fields: { VALUE: word } }, "value", source, word);
      }
      case "identifier": {
        // A routine without arguments, called without parentheses.
        const routine = this.routine(expression.name);
        if (routine) return this.call("ps_llamada_valor", expression.name, routine, [], false);
        return { type: "ps_variable", fields: { NAME: expression.name } };
      }
      case "arrayAccess": {
        if (expression.target.kind !== "identifier") return this.raw(expression);
        const block: BlockState = {
          type: "ps_elemento",
          fields: { NAME: expression.target.name },
          inputs: { INDEX: { block: this.list(expression.indices) } },
        };
        return this.bracket(block, expression.target, "bracket");
      }
      case "binary":
        return this.binary(expression);
      case "unary": {
        let operand = expression.operand;
        if (expression.operator === "NOT") {
          const range = this.text.range(expression);
          const inner = this.text.range(operand);
          const word = range && inner && inner[0] > range[0] ? this.text.source.slice(range[0], inner[0]).trim() : "";
          return spell({ type: "ps_no", inputs: { A: { block: this.expression(operand) } } }, "op", word, "NO");
        }
        while (operand.kind === "group") operand = operand.expression;
        if (expression.operator === "-" && operand === expression.operand && operand.kind === "literal" && operand.valueType === "number") {
          const source = this.text.text(expression).replace(/\s+/g, "");
          const block: BlockState = { type: "ps_numero", fields: { NUM: -(operand.value as number) } };
          return source !== String(-(operand.value as number)) ? withData(block, { spell: { num: source } }) : block;
        }
        return { type: "ps_negativo", inputs: { A: { block: this.expression(expression.operand) } } };
      }
      case "call": {
        const routine = this.routine(expression.callee);
        if (routine) return this.call("ps_llamada_valor", expression.callee, routine, expression.args, true);
        const key = normalize(expression.callee);
        const source = this.text.text(expression);
        if (expression.args.length === 0) {
          // PI, EULER, FechaActual, HoraActual: usually written without parentheses.
          const constant = FUNCTIONS_0.get(key);
          if (!constant) return this.raw(expression);
          const word = source.replace(/\s*\(\s*\)$/, "");
          const block = spell({ type: "ps_constante", fields: { NAME: constant } }, "name", word, constant);
          return word === source ? block : withData(block, { spell: { parens: "1" } });
        }
        const table = [FUNCTIONS_1, FUNCTIONS_2, FUNCTIONS_3][expression.args.length - 1];
        const name = table?.get(key);
        if (!name) return this.raw(expression);
        const type = ["ps_funcion", "ps_funcion2", "ps_funcion3"][expression.args.length - 1];
        const inputs = Object.fromEntries(
          expression.args.map((arg, i) => ["ABC"[i], { block: this.expression(arg) }])
        );
        return spell({ type, fields: { NAME: name }, inputs }, "name", expression.callee, name);
      }
    }
  }

  /** Remembers `a(1)`: an index written in parentheses. */
  private bracket(block: BlockState, name: object, key: string): BlockState {
    const at = this.text.range(name)?.[1];
    const next = at === undefined ? null : this.text.findToken(at, Infinity, () => true);
    return next?.kind === "lparen" ? withData(block, { spell: { [key]: "(" } }) : block;
  }

  private binary(expression: Extract<ExpressionNode, { kind: "binary" }>): BlockState {
    const colloquial = this.colloquial(expression);
    if (colloquial) return colloquial;
    const { operator } = expression;
    const inputs = {
      A: { block: this.expression(expression.left) },
      B: { block: this.expression(expression.right) },
    };
    const written = this.between(expression.left, expression.right) ?? "";
    if (operator in ARITHMETIC) {
      const op = ARITHMETIC[operator];
      return spell({ type: "ps_aritmetica", fields: { OP: op }, inputs }, "op", written, op);
    }
    if (COMPARISON.has(operator)) return spell({ type: "ps_comparar", fields: { OP: operator }, inputs }, "op", written, operator);
    if (operator === "AND" || operator === "OR") {
      const op = operator === "AND" ? "Y" : "O";
      return spell({ type: "ps_logica", fields: { OP: op }, inputs }, "op", written, op);
    }
    return this.raw(expression);
  }

  /**
   * `x Es Par`, `n Es Divisible Por 3`…: the parser turns them into
   * comparisons with numbers that have no place in the source.
   */
  private colloquial(expression: Extract<ExpressionNode, { kind: "binary" }>): BlockState | null {
    const { operator, left, right } = expression;
    const spanless = (node: ExpressionNode, value?: number) =>
      node.kind === "literal" && !node.span && (value === undefined || node.value === value);
    const range = this.text.range(expression);
    if (!range) return null;
    /** The words from `Es` to the end of the condition, as written. */
    const phrase = (from: ExpressionNode) => {
      const start = this.text.range(from)?.[1] ?? range[0];
      const es = this.text.findToken(start, range[1], (token) => token.normalized === "ES");
      return es ? this.text.source.slice(es.offset, range[1]).trim() : "";
    };
    const es = (value: ExpressionNode, what: string) =>
      spell({ type: "ps_es", fields: { WHAT: what }, inputs: { A: { block: this.expression(value) } } }, "phrase", phrase(value), `Es ${what}`);

    if (operator === "=" && left.kind === "call" && !left.span && left.args[0] === right) return es(right, "Entero");
    if (!spanless(right, 0)) {
      return null;
    }
    if (left.kind === "binary" && left.operator === "%" && (operator === "=" || operator === "<>")) {
      if (spanless(left.right, 2)) return es(left.left, operator === "=" ? "Par" : "Impar");
      if (operator === "=") {
        const word = this.text.tokensIn(range[0], range[1]).find((t) => t.normalized === "DIVISIBLE" || t.normalized === "MULTIPLO");
        if (!word) return null;
        const what = word.normalized === "DIVISIBLE" ? "Divisible Por" : "Multiplo De";
        const from = this.text.findToken(this.text.range(left.left)?.[1] ?? range[0], range[1], (t) => t.normalized === "ES");
        const words = this.text.source.slice((from ?? word).offset, this.text.range(left.right)?.[0] ?? range[1]).trim();
        return spell(
          {
            type: "ps_es_divisible",
            fields: { WHAT: what },
            inputs: { A: { block: this.expression(left.left) }, B: { block: this.expression(left.right) } },
          },
          "phrase",
          words,
          `Es ${what}`
        );
      }
      return null;
    }
    if (operator === ">") return es(left, "Positivo");
    if (operator === "<") return es(left, "Negativo");
    if (operator === "=") return es(left, "Cero");
    return null;
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

  private call(type: string, name: string, routine: RoutineNode, args: ExpressionNode[], parens: boolean): BlockState {
    const params = routine.params.map((param) => param.name);
    // A call with a different number of arguments is still written as it was.
    const names = args.length === params.length ? params : args.map((_, i) => params[i] ?? `arg${i + 1}`);
    return {
      type,
      extraState: { name, args: names, ...(parens || args.length ? {} : { parens: false }) },
      inputs: Object.fromEntries(args.map((arg, i) => [`ARG${i}`, { block: this.expression(arg) }])),
    };
  }

  /* ---------- statements ---------- */

  private rawStatement(statement: StatementNode): BlockState {
    return { type: "ps_raw", fields: { CODE: this.text.block(statement) } };
  }

  /**
   * Remembers how the statement's own keywords were written (`entonces`,
   * `FinMientras` as `finmientras`), and which optional ones it left out:
   * everything in the statement's range outside its expressions and bodies.
   */
  private keywords(block: BlockState, node: StatementNode | RoutineNode | MainRoutineNode): BlockState {
    const range = this.text.range(node);
    if (!range) return block;
    const skip: [number, number][] = [];
    const children = "type" in node ? [node.body] : Object.entries(node).filter(([key]) => key !== "span").map(([, v]) => v);
    for (const child of children.flat()) {
      if (child && typeof child === "object") {
        const inner = this.text.range(child);
        if (inner) skip.push(inner);
      }
    }
    const spelling: Record<string, string> = {};
    const seen = new Set<string>();
    const tokens = this.text.tokensIn(range[0], range[1]).filter(
      (token) => token.kind === "word" && !skip.some(([a, b]) => token.offset >= a && token.offset < b)
    );
    tokens.forEach((token, i) => {
      seen.add(token.normalized);
      const next = tokens[i + 1];
      // A closer in two words: `Fin Si`.
      if (token.normalized === "FIN" && next && this.text.lineAt(next.offset) === this.text.lineAt(token.offset)) {
        const key = `FIN${next.normalized}`;
        spelling[`k:${key}`] = this.text.source.slice(token.offset, this.text.tokenEnd(next));
        seen.add(key);
        return;
      }
      const canonical = KEYWORDS[token.normalized];
      if (canonical !== undefined && token.lexeme !== canonical) spelling[`k:${token.normalized}`] = token.lexeme;
      if ("kind" in node && node.kind === "forEach") {
        if (token.normalized === "EN") spelling["k:DE"] = token.lexeme;
        if (token.normalized === "PARACADA") spelling.kw = token.lexeme;
      }
    });
    // Optional keywords left out (flexible syntax).
    const optional: Record<string, string> = { if: "ENTONCES", while: "HACER", for: "HACER", forEach: "HACER", switch: "HACER" };
    const expected = "kind" in node ? optional[node.kind] : undefined;
    if (expected && !seen.has(expected)) spelling[`k:${expected}`] = "";
    return Object.keys(spelling).length ? withData(block, { spell: spelling }) : block;
  }

  /**
   * The statements as a chain of blocks linked through `next` (with the
   * comments between them), up to the line `end` that closes their body.
   */
  chain(statements: StatementNode[], end: number): BlockState | undefined {
    const items: BlockState[] = [];
    let previousEnd = -1;
    for (const statement of statements) {
      const start = this.text.startLine(statement);
      // Two statements on one line (`a <- 1; b <- 2`) stay on one line.
      const sameLine = start === previousEnd && items.length > 0;
      const before = this.gap(start);
      items.push(...before.blocks);
      this.line = Math.max(this.line, start + 1);
      let block = this.keywords(this.statement(statement), statement);
      // An optional `;` the program wrote is kept.
      const range = this.text.range(statement);
      if (range && this.text.findToken(range[1], Infinity, () => true)?.kind === "semicolon") {
        block = withData(block, { spell: { semi: "1" } });
      }
      if (sameLine) block = withData(block, { spell: { join: "1" } });
      block.id = this.id();
      const last = this.text.endLine(statement);
      for (let line = start; line <= (block.type === "ps_raw" ? last : start); line++) {
        if (!this.lines.has(line)) this.lines.set(line, block.id);
      }
      items.push(this.decorate(block, start, before.blank));
      previousEnd = last;
      this.collectOrphans(start, last);
      this.line = Math.max(this.line, last + 1);
    }
    items.push(...this.gap(end).blocks);
    for (let i = 1; i < items.length; i++) items[i - 1].next = { block: items[i] };
    return items[0];
  }

  private body(statements: StatementNode[], end: number): { block: BlockState } | undefined {
    const block = this.chain(statements, end);
    return block ? { block } : undefined;
  }

  private withInputs(block: BlockState, inputs: Inputs): BlockState {
    const present = Object.fromEntries(Object.entries(inputs).filter(([, value]) => value));
    return Object.keys(present).length ? { ...block, inputs: { ...block.inputs, ...present } as BlockState["inputs"] } : block;
  }

  /** The first word of a statement, as written. */
  private keyword(statement: StatementNode): string {
    const range = this.text.range(statement);
    if (!range) return "";
    return this.text.findToken(range[0], range[1], () => true)?.lexeme ?? "";
  }

  private statement(statement: StatementNode): BlockState {
    const range = this.text.range(statement)!;
    switch (statement.kind) {
      case "write": {
        const block: BlockState = {
          type: "ps_escribir",
          fields: { NEWLINE: statement.newline ? "TRUE" : "FALSE" },
          inputs: { VALUE: { block: this.list(statement.expressions) } },
        };
        const spelling: Record<string, string> = {};
        const keyword = this.keyword(statement);
        if (keyword !== "Escribir") spelling.kw = keyword;
        if (!statement.newline) {
          const tokens = this.text.tokensIn(range[0], range[1]);
          const index = tokens.findIndex((t) => ["SIN", "SINSALTAR", "SINBAJAR"].includes(t.normalized));
          if (index >= 0) {
            const first = tokens[index];
            const last = first.normalized === "SIN" ? tokens[index + 1] : first;
            const words = this.text.source.slice(first.offset, this.text.tokenEnd(last));
            if (words !== "Sin Saltar") spelling.nonewline = words;
            const firstValue = this.text.range(statement.expressions[0]);
            if (firstValue && first.offset < firstValue[0]) spelling.before = "1";
          }
        }
        return Object.keys(spelling).length ? withData(block, { spell: spelling }) : block;
      }
      case "read":
        // Several targets stay one `Leer a, b`, chained like Escribir's values.
        return { type: "ps_leer", inputs: { TARGET: { block: this.list(statement.targets) } } };
      case "assignment": {
        const arrow = this.between(statement.target, statement.value) ?? "<-";
        return spell(
          {
            type: "ps_asignar",
            inputs: { TARGET: { block: this.expression(statement.target) }, VALUE: { block: this.expression(statement.value) } },
          },
          "arrow",
          arrow,
          "<-"
        );
      }
      case "define": {
        const type = TYPES[normalize(statement.dataType)];
        if (!type) return this.rawStatement(statement);
        const spelling: Record<string, string> = {};
        if (statement.dataType !== type) spelling.type = statement.dataType;
        const keyword = this.keyword(statement);
        if (normalize(keyword) !== "DEFINIR") {
          const es = this.text.tokensIn(range[0], range[1]).find((t) => t.normalized === "ES" || t.normalized === "SON");
          if (es) spelling.es = es.lexeme;
        }
        const block: BlockState = { type: "ps_definir", fields: { NAMES: statement.names.join(", "), TYPE: type } };
        return Object.keys(spelling).length ? withData(block, { spell: spelling }) : block;
      }
      case "dimension": {
        const keyword = statement.resize ? "Redimensionar" : "Dimension";
        const fields: Record<string, string> = { KEYWORD: keyword };
        const inputs: Inputs = {};
        const brackets: Record<string, string> = {};
        statement.items.forEach((item, i) => {
          fields[`NAME${i}`] = item.name;
          inputs[`SIZE${i}`] = { block: this.list(item.dimensions) };
          const itemRange = this.text.range(item);
          const open = itemRange && this.text.findToken(itemRange[0], itemRange[1], (t) => t.kind === "lparen" || t.kind === "lbracket");
          if (open?.kind === "lparen") brackets[`bracket${i}`] = "(";
        });
        const block: BlockState = {
          type: "ps_dimension",
          ...(statement.items.length > 1 ? { extraState: { items: statement.items.length } } : {}),
          fields,
          inputs: inputs as BlockState["inputs"],
        };
        const spelled = spell(block, "kw", this.keyword(statement), keyword);
        return Object.keys(brackets).length ? withData(spelled, { spell: brackets }) : spelled;
      }
      case "if": {
        const close = this.text.endLine(statement);
        // The SiNo of this Si: the first one after the Entonces branch.
        const thenEnd = statement.thenBranch.length
          ? this.text.range(statement.thenBranch[statement.thenBranch.length - 1])![1]
          : this.text.range(statement.condition)?.[1] ?? range[0];
        const sino = this.text.findToken(thenEnd, range[1], (token) => token.normalized === "SINO");
        const elseLine = sino ? this.text.lineAt(sino.offset) : close;
        const cond = { block: this.expression(statement.condition) };
        const then = this.body(statement.thenBranch, elseLine);
        if (!sino) return this.withInputs({ type: "ps_si" }, { COND: cond, THEN: then });
        this.skipLine(elseLine);
        const otherwise = this.body(statement.elseBranch, close);
        return this.withInputs({ type: "ps_si_sino" }, { COND: cond, THEN: then, ELSE: otherwise });
      }
      case "while":
        return this.withInputs(
          { type: "ps_mientras" },
          {
            COND: { block: this.expression(statement.condition) },
            BODY: this.body(statement.body, this.text.endLine(statement)),
          }
        );
      case "repeat": {
        const close = this.text.startLine(statement.condition);
        return this.withInputs(
          { type: "ps_repetir", fields: { MODE: statement.mode === "while" ? "MIENTRAS" : "HASTA" } },
          { BODY: this.body(statement.body, close), COND: { block: this.expression(statement.condition) } }
        );
      }
      case "for": {
        const variable = this.text.findToken(range[0], range[1], (t) => t.lexeme === statement.variable);
        const from = this.text.range(statement.start);
        const arrow = variable && from ? this.text.source.slice(this.text.tokenEnd(variable), from[0]).trim() : "<-";
        const block = this.withInputs(
          { type: "ps_para", fields: { VAR: statement.variable } },
          {
            FROM: { block: this.expression(statement.start) },
            TO: { block: this.expression(statement.end) },
            // Without Con Paso, a shadow 1 (which the generator leaves out) keeps PSeInt's default step.
            STEP: statement.step
              ? { block: this.expression(statement.step) }
              : { shadow: { type: "ps_numero", fields: { NUM: 1 } } },
            BODY: this.body(statement.body, this.text.endLine(statement)),
          }
        );
        return spell(block, "arrow", arrow, "<-");
      }
      case "forEach": {
        if (statement.collection.kind !== "identifier") return this.rawStatement(statement);
        return this.withInputs(
          { type: "ps_para_cada", fields: { VAR: statement.variable, ARRAY: statement.collection.name } },
          { BODY: this.body(statement.body, this.text.endLine(statement)) }
        );
      }
      case "switch":
        return this.switch(statement, range);
      case "clear":
        return spell({ type: "ps_limpiar" }, "kw", this.text.text(statement), "Limpiar Pantalla");
      case "wait": {
        if (statement.mode === "key") {
          return spell({ type: "ps_esperar_tecla" }, "kw", this.text.text(statement), "Esperar Tecla");
        }
        const duration = statement.durationMs;
        if (!duration) return this.rawStatement(statement);
        // The parser turns `Esperar n Segundos` into n * 1000 with a literal that has no span.
        const seconds =
          duration.kind === "binary" &&
          duration.operator === "*" &&
          duration.right.kind === "literal" &&
          duration.right.value === 1000 &&
          !duration.right.span;
        const amount = seconds ? duration.left : duration;
        const unit = seconds ? "Segundos" : "Milisegundos";
        const amountEnd = this.text.range(amount)?.[1] ?? range[0];
        const word = this.text.source.slice(amountEnd, range[1]).trim();
        return spell(
          { type: "ps_esperar", fields: { UNIT: unit }, inputs: { AMOUNT: { block: this.expression(amount) } } },
          "unit",
          word,
          unit
        );
      }
      case "return":
        return spell(
          this.withInputs({ type: "ps_retornar" }, { VALUE: statement.expression ? { block: this.expression(statement.expression) } : undefined }),
          "kw",
          this.keyword(statement),
          "Retornar"
        );
      case "expression": {
        const call = statement.expression;
        const name = call.kind === "identifier" ? call.name : call.kind === "call" ? call.callee : null;
        const routine = name ? this.routine(name) : undefined;
        if (!name || !routine) return this.rawStatement(statement);
        return this.call("ps_llamada", name, routine, call.kind === "call" ? call.args : [], call.kind === "call");
      }
    }
  }

  private switch(statement: Extract<StatementNode, { kind: "switch" }>, range: [number, number]): BlockState {
    const close = this.text.endLine(statement);
    // Where each case starts, and where De Otro Modo does.
    const caseLines = statement.cases.map((c) => this.text.startLine(c.values[0]));
    let afterCases = this.text.range(statement.expression)?.[1] ?? range[0];
    const last = statement.cases[statement.cases.length - 1];
    if (last) afterCases = this.text.range(last.body.length ? last.body : last.values)?.[1] ?? afterCases;
    const otherwiseToken = this.text.findToken(
      afterCases,
      range[1],
      (t, i) => t.normalized === "DEOTROMODO" || (t.normalized === "DE" && this.text.tokens[i + 1]?.normalized === "OTRO")
    );
    const otherwiseLine = otherwiseToken ? this.text.lineAt(otherwiseToken.offset) : null;

    const inputs: Inputs = { VALUE: { block: this.expression(statement.expression) } };
    const inline: number[] = [];
    statement.cases.forEach((c, i) => {
      const caseLine = caseLines[i];
      const end = caseLines[i + 1] ?? otherwiseLine ?? close;
      inputs[`CASE${i}`] = { block: this.list(c.values) };
      const firstLine = c.body.length ? this.text.startLine(c.body[0]) : -1;
      if (firstLine === caseLine) inline.push(i);
      else this.skipLine(caseLine);
      inputs[`DO${i}`] = this.body(c.body, end);
    });
    if (otherwiseLine !== null) {
      const firstLine = statement.defaultCase.length ? this.text.startLine(statement.defaultCase[0]) : -1;
      if (firstLine === otherwiseLine) inline.push(-1);
      else this.skipLine(otherwiseLine);
      inputs.OTHERWISE = this.body(statement.defaultCase, close);
    }
    const spelling: Record<string, string> = {};
    if (otherwiseToken) {
      const colon = this.text.findToken(otherwiseToken.offset, range[1], (t) => t.kind === "colon");
      const words = colon ? this.text.source.slice(otherwiseToken.offset, colon.offset).trim() : "";
      if (words && words !== "De Otro Modo") spelling.otherwise = words;
    }
    const block = this.withInputs(
      {
        type: "ps_segun",
        extraState: { cases: statement.cases.length, ...(otherwiseLine !== null ? { otherwise: true } : {}) },
      },
      inputs
    );
    const data: BlockData = {};
    if (inline.length) data.inline = inline;
    if (Object.keys(spelling).length) data.spell = spelling;
    return Object.keys(data).length ? withData(block, data) : block;
  }

  /* ---------- top level ---------- */

  algorithm(entry: MainRoutineNode): BlockState {
    const start = this.text.startLine(entry);
    const close = this.text.endLine(entry);
    const keyword = entry.headerKind;
    const block = this.withInputs(
      { type: "ps_algoritmo", id: this.id(), fields: { KEYWORD: keyword, NAME: entry.name } },
      { BODY: this.enter(start, () => this.body(entry.body, close)) }
    );
    this.lines.set(start, block.id!);
    return spellEnds(block, this.text, entry, keyword, keyword === "Proceso" ? "FinProceso" : "FinAlgoritmo");
  }

  routineBlock(routine: RoutineNode): BlockState {
    const start = this.text.startLine(routine);
    const close = this.text.endLine(routine);
    const fields: Record<string, string> = { KIND: routine.headerKind, NAME: routine.name };
    const spelling: Record<string, string> = {};
    if (routine.returnTarget) fields.RESULT = routine.returnTarget;
    routine.params.forEach((param, i) => {
      fields[`PARAM${i}`] = param.name;
      fields[`MODE${i}`] = param.byReference ? "REF" : param.explicitByValue ? "VAL" : "";
      if (param.explicitByValue) {
        const words = this.text.text(param).slice(param.name.length).trim();
        if (words !== "Por Valor") spelling[`mode${i}`] = words;
      }
    });
    const range = this.text.range(routine)!;
    const parens = !!this.text.findToken(range[0], range[1], (t) => t.kind === "lparen" && this.text.lineAt(t.offset) === start);
    const block = this.withInputs(
      {
        type: "ps_subproceso",
        id: this.id(),
        extraState: {
          params: routine.params.length,
          ...(parens || routine.params.length ? {} : { parens: false }),
          ...(routine.returnTarget ? { result: true } : {}),
        },
        fields,
      },
      { BODY: this.enter(start, () => this.body(routine.body, close)) }
    );
    if (routine.returnTarget) {
      const arrow = this.text.findToken(range[0], range[1], (t) => t.kind === "arrow" || t.kind === "eq");
      if (arrow && arrow.lexeme !== "<-") spelling.arrow = arrow.lexeme;
    }
    if (Object.keys(spelling).length) block.data = JSON.stringify({ spell: spelling });
    this.lines.set(start, block.id!);
    const closer = { SubProceso: "FinSubProceso", SubAlgoritmo: "FinSubAlgoritmo", Funcion: "FinFuncion" }[routine.headerKind];
    return this.keywords(spellEnds(block, this.text, routine, routine.headerKind, closer), routine);
  }

  /** Converts a body that starts after the header on line `start`, then moves past its closer. */
  private enter<T>(start: number, convert: () => T): T {
    this.line = Math.max(this.line, start + 1);
    return convert();
  }

  /** The indentation of the first indented line between a header and its closer. */
  private indentOf(start: number, end: number): string | null {
    const lines = this.text.source.split("\n");
    for (let line = start + 1; line < end; line++) {
      const text = lines[line - 1] ?? "";
      if (!text.trim()) continue;
      const indent = /^[ \t]*/.exec(text)![0];
      if (indent) return indent;
    }
    return null;
  }

  /** The top level: comments before each part, and the blank lines between parts. */
  top(program: ProgramNode): BlockState[] {
    const parts = [program.entry, ...program.routines].sort(
      (a, b) => (this.text.range(a)?.[0] ?? 0) - (this.text.range(b)?.[0] ?? 0)
    );
    const blocks: BlockState[] = [];
    const place = (block: BlockState, blank: number) => {
      // Top blocks always say how many blank lines precede them (the generator's default is one).
      block.data = JSON.stringify({ ...parseData(block.data), blank: blocks.length ? blank : 0 });
      blocks.push(block);
    };
    for (const part of parts) {
      const start = this.text.startLine(part);
      const before = this.gap(start);
      if (before.blocks.length) {
        // Loose comments form a stack of their own, carrying the blank lines before the first.
        const [first, ...rest] = before.blocks;
        const firstBlank = parseData(first.data).blank ?? 0;
        const comments = rest.length ? chainOf(before.blocks) : first;
        place(comments, firstBlank);
      }
      let block = part.type === "MainRoutine" ? this.algorithm(part) : this.routineBlock(part);
      this.decorate(block, start, 0);
      const indent = this.indentOf(start, this.text.endLine(part));
      if (indent && indent !== "\t") block = withData(block, { indent });
      place(block, before.blank);
      const end = this.text.endLine(part);
      this.collectOrphans(start, end);
      this.line = Math.max(this.line, end + 1);
    }
    const tail = this.gap(this.text.lineAt(this.text.source.length) + 1);
    if (tail.blocks.length) {
      const firstBlank = parseData(tail.blocks[0].data).blank ?? 0;
      place(chainOf(tail.blocks), firstBlank);
    }
    return blocks;
  }
}

function chainOf(blocks: BlockState[]): BlockState {
  for (let i = 1; i < blocks.length; i++) blocks[i - 1].next = { block: blocks[i] };
  return blocks[0];
}

function parseData(data: string | undefined): BlockData {
  if (!data) return {};
  try {
    return JSON.parse(data) as BlockData;
  } catch {
    return {};
  }
}

function withData(block: BlockState, data: BlockData): BlockState {
  const merged = { ...parseData(block.data), ...data };
  if (data.spell) merged.spell = { ...parseData(block.data).spell, ...data.spell };
  return Object.keys(merged).length ? { ...block, data: JSON.stringify(merged) } : block;
}

/** Remembers `written` under `key` when it differs from what the block writes by itself. */
function spell(block: BlockState, key: string, written: string, canonical: string): BlockState {
  return written && written !== canonical ? withData(block, { spell: { [key]: written } }) : block;
}

/** The header keyword and closer of an Algoritmo or routine, as written. */
function spellEnds(block: BlockState, text: SourceText, node: object, keyword: string, closer: string): BlockState {
  const range = text.range(node);
  if (!range) return block;
  const first = text.findToken(range[0], range[1], () => true);
  const lastIndex = text.lastTokenBefore(range[1]);
  const last = text.tokens[lastIndex];
  let closerText = last?.lexeme ?? "";
  // `Fin SubProceso`, written as two words.
  if (last && normalize(last.lexeme) !== normalize(closer) && text.tokens[lastIndex - 1]?.normalized === "FIN") {
    closerText = text.source.slice(text.tokens[lastIndex - 1].offset, text.tokenEnd(last));
  }
  let result = spell(block, "kw", first?.lexeme ?? "", keyword);
  result = spell(result, "end", closerText, closer);
  return result;
}

const LEFT = 24;
const TOP = 24;
const GAP = 48;
/** Rough heights, only to keep the top blocks apart and in order (the editor lays them out again once drawn). */
const LINE_HEIGHT = 40;

/** Blockly serialization state for a parsed program, and which block runs each source line. */
export function convertProgram(
  program: ProgramNode,
  source: string,
  settings: Partial<EngineSettings> = {}
): { state: BlocksState; lines: Map<number, string> } {
  const text = new SourceText(source, settings);
  const routines = new Map(program.routines.map((routine) => [normalize(routine.name), routine]));
  const converter = new Converter(text, routines);
  const blocks = converter.top(program);
  let y = TOP;
  for (const block of blocks) {
    block.x = LEFT;
    block.y = y;
    y += countLines(block) * LINE_HEIGHT + GAP;
  }
  return { state: { blocks: { languageVersion: 0, blocks } }, lines: converter.lines };
}

/** Blockly serialization state for a parsed program: each part (Algoritmo, SubProceso, comments) as a top block. */
export function programToBlocksState(
  program: ProgramNode,
  source: string,
  settings: Partial<EngineSettings> = {}
): BlocksState {
  return convertProgram(program, source, settings).state;
}

function countLines(block: BlockState): number {
  let lines = 1;
  for (const input of Object.values(block.inputs ?? {})) {
    if (isStatement(input.block)) lines += countChain(input.block!);
  }
  return lines + 1;
}

function countChain(block: BlockState): number {
  let lines = 0;
  for (let b: BlockState | undefined = block; b; b = b.next?.block) {
    const nested = Object.values(b.inputs ?? {}).filter((input) => input.block?.next !== undefined || isStatement(input.block));
    lines += 1 + nested.reduce((sum, input) => sum + countChain(input.block!), 0);
  }
  return lines;
}

const STATEMENT_TYPES = /^ps_(escribir|leer|definir|asignar|si|si_sino|segun|mientras|repetir|para|para_cada|dimension|limpiar|esperar|esperar_tecla|llamada|retornar|comentario|raw)$/;
const isStatement = (block: BlockState | undefined) => !!block && STATEMENT_TYPES.test(block.type);

function parse(source: string, settings: Partial<EngineSettings>) {
  const result = new Parser(source, { settings }).parse();
  const error = result.diagnostics.find((d) => d.severity === "error");
  return { program: error ? null : result.program, error };
}

/**
 * Parses the code and converts it, or reports the first parse error. `lines`
 * maps each line of `source` that runs a statement to that statement's block.
 */
export function codeToBlocksState(
  source: string,
  settings: Partial<EngineSettings>
): { state: BlocksState; lines: Map<number, string> } | { error: string } {
  const { program, error } = parse(source, settings);
  if (!program) return { error: error ? `${error.line}:${error.column} ${error.message}` : "No se pudo leer el código." };
  return convertProgram(program, source, settings);
}

/* ------------------------------------------------------------------ */
/* Generated line → block                                              */
/* ------------------------------------------------------------------ */

/**
 * Maps each line of `source` (code generated from `workspace` by
 * `pseudocode.workspaceToCode` with the same settings) to the id of the block
 * that wrote it: a statement, an Algoritmo or SubProceso header, or each line
 * of a code block. Empty when `source` is not that code.
 */
export function lineToBlockMap(
  workspace: Blockly.Workspace,
  source: string,
  settings: Partial<EngineSettings>
): Map<number, string> {
  const { code, lines } = pseudocode.generate(workspace, settings, true);
  return code === source ? lines : new Map();
}
