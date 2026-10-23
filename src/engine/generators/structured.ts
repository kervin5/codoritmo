import { engineMessage } from "../messages";
import { normalizeEngineSettings } from "../settings";
import type {
  Diagnostic,
  EngineSettings,
  ExpressionNode,
  ForEachStatementNode,
  ForStatementNode,
  GenerationResult,
  ProgramNode,
  RoutineNode,
  StatementNode,
} from "../types";
import {
  countersReadOutside,
  declaredAtSite,
  forDirection,
  isAssignable,
  makeIdentifier,
  offsetExpression,
  Rendered,
  wrap,
  writesVariable,
} from "./shared";
import {
  evaluateConstant,
  InferredType,
  isConstantBuiltin,
  normalizeBuiltinName,
  normalizeName,
  ProgramTypes,
  resolveType,
  ScopeTypes,
  TypeInference,
  VariableInfo,
} from "./type-inference";

export interface StructuredGeneratorOptions {
  settings?: Partial<EngineSettings>;
  /** Explanatory comments in the output (on by default). */
  comments?: boolean;
}

/** The type of a value once translated: untyped values become texts. */
export type ValueKind = "int" | "double" | "string" | "bool";

export interface RoutineContext {
  scope: ScopeTypes;
  routine: RoutineNode | null;
  /** Names already used in the routine, so auxiliary names do not clash. */
  names: Set<string>;
  /** Auxiliary variables created on the way, for languages that declare them first. */
  temps: Map<string, ValueKind>;
  countersReadOutside: Set<string>;
  /** Arrays dimensioned once at the top level of the routine. */
  declaredAtSite: Set<string>;
  /** Type of the value the routine returns, or null. */
  returnType: InferredType | null;
  /** Variable holding the return value, if any. */
  returnInfo: VariableInfo | null;
}

/** Precedence levels every language defines (higher binds tighter). */
export interface Precedence {
  primary: number;
  unary: number;
  multiplicative: number;
  additive: number;
}

/** What a Para loop needs: its direction and step, when known up front. */
export interface ForPlan {
  /** True counting down, false up, null when only known at run time. */
  descending: boolean | null;
  /** Constant step, or null when it is only known at run time. */
  step: number | null;
}

/** The pieces of a Para Cada loop over a known array. */
export interface ForEachPlan {
  alias: VariableInfo;
  collection: VariableInfo;
  depth: number;
}

/**
 * Base of the exporters that translate the AST statement by statement into a
 * structured language (C#, PHP, Pascal, Visual Basic, QBasic, MatLab). It
 * keeps what they all share: the type inference, the routine being
 * generated, auxiliary names, Para Cada aliases, code hoisted before and after
 * a statement (calls with by-reference arguments), and expression dispatch.
 * Each language renders the actual syntax.
 */
export abstract class StructuredGenerator {
  protected readonly settings: EngineSettings;
  protected readonly comments: boolean;
  protected inference!: TypeInference;
  protected types!: ProgramTypes;
  protected program!: ProgramNode;
  protected uses = new Set<string>();
  protected diagnostics: Diagnostic[] = [];
  protected context!: RoutineContext;
  /** Statements to run before and after the one being generated. */
  protected pre: string[] = [];
  protected post: string[] = [];
  /** Code standing for Para Cada aliases (and auxiliaries) while in scope. */
  protected aliases = new Map<string, string>();
  /** Translated subprocess names, kept apart from every variable name. */
  private routineNames = new Map<string, string>();

  protected abstract readonly reserved: Set<string>;
  protected abstract readonly prec: Precedence;
  protected readonly indent: string = "    ";
  /** Largest integer literal the language's integer type holds. */
  protected readonly intLimit: number = 2147483647;

  constructor(options: StructuredGeneratorOptions = {}) {
    this.settings = normalizeEngineSettings(options.settings);
    this.comments = options.comments ?? true;
  }

  generate(program: ProgramNode): GenerationResult {
    this.program = program;
    this.inference = new TypeInference(program);
    this.types = this.inference.run();
    this.uses = new Set();
    this.diagnostics = [];
    this.aliases = new Map();
    this.pre = [];
    this.post = [];
    this.routineNames = new Map();
    const taken = new Set<string>(this.extraNames());
    for (const scope of [this.types.main, ...this.types.routines.values()]) {
      for (const info of scope.vars.values()) taken.add(this.name(info.name));
    }
    for (const routine of program.routines) {
      let name = this.routineIdentifier(routine.name);
      while (taken.has(name)) name += "_";
      taken.add(name);
      this.routineNames.set(normalizeName(routine.name), name);
    }
    const code = this.render(program);
    return { code: `${code.join("\n")}\n`, diagnostics: this.diagnostics };
  }

  /** The whole output file, line by line. */
  protected abstract render(program: ProgramNode): string[];

  // ---------------------------------------------------------------------------
  // Routines and names

  protected name(name: string): string {
    return makeIdentifier(name, this.reserved);
  }

  /** Names subprocesses must not take besides variables (the program's own name...). */
  protected extraNames(): string[] {
    return [];
  }

  /** Identifier for a subprocess name, before keeping it apart from variables. */
  protected routineIdentifier(name: string): string {
    return this.name(name);
  }

  protected routineName(routine: RoutineNode): string {
    return this.routineNames.get(normalizeName(routine.name)) ?? this.routineIdentifier(routine.name);
  }

  protected scopeOf(routine: RoutineNode): ScopeTypes {
    return this.types.routines.get(normalizeName(routine.name))!;
  }

  /** Makes `routine` the one being generated. */
  protected enter(routine: RoutineNode | null, statements: StatementNode[], scope: ScopeTypes, names: Iterable<string> = []): RoutineContext {
    const returnInfo = routine && scope.returnKey ? scope.vars.get(scope.returnKey)! : null;
    const returnType = !routine
      ? null
      : returnInfo
        ? returnInfo.type
        : scope.returnType !== "unknown"
          ? scope.returnType
          : null;
    this.context = {
      scope,
      routine,
      names: new Set([
        ...[...scope.vars.values()].map((info) => this.name(info.name)),
        ...this.routineNames.values(),
        ...this.extraNames(),
        ...names,
      ]),
      temps: new Map(),
      countersReadOutside: countersReadOutside(statements),
      declaredAtSite: declaredAtSite(statements, scope),
      returnType,
      returnInfo,
    };
    return this.context;
  }

  /** Local variables of the routine (not parameters), sorted by name. */
  protected locals(options: { skipAliases?: boolean } = {}): VariableInfo[] {
    return [...this.context.scope.vars.values()]
      .filter((info) => !info.param && !(options.skipAliases && info.forEachAlias))
      .sort((a, b) => this.name(a.name).localeCompare(this.name(b.name)));
  }

  /** A fresh auxiliary name that clashes with no variable of the routine. */
  protected temp(base: string, kind?: ValueKind): string {
    let name = base;
    for (let index = 2; this.context.names.has(name); index += 1) name = `${base}${index}`;
    this.context.names.add(name);
    if (kind) this.context.temps.set(name, kind);
    return name;
  }

  /** Runs `fn` with `key` standing for `code` (or for nothing new when null). */
  protected withAlias<T>(key: string, code: string | null, fn: () => T): T {
    const previous = this.aliases.get(key);
    if (code !== null) this.aliases.set(key, code);
    try {
      return fn();
    } finally {
      if (previous === undefined) this.aliases.delete(key);
      else this.aliases.set(key, previous);
    }
  }

  protected warn(
    statement: StatementNode,
    code: "EXPORT_FOREACH" | "EXPORT_RESIZE_DIMENSIONS" | "EXPORT_RESIZE_PARAMETER",
    name: string
  ): void {
    this.diagnostics.push({
      message: engineMessage(code, { name }),
      line: statement.span?.start.line ?? 0,
      column: statement.span?.start.column ?? 0,
      severity: "warning",
      code,
      params: { name },
    });
  }

  // ---------------------------------------------------------------------------
  // Statements

  protected abstract statementLines(statement: StatementNode): string[];

  /** Lines of one statement, with the code hoisted out of its expressions. */
  protected statement(statement: StatementNode): string[] {
    const { value, pre, post } = this.capture(() => this.statementLines(statement));
    return [...pre, ...value, ...post];
  }

  protected block(statements: StatementNode[], depth = 1): string[] {
    const prefix = this.indent.repeat(depth);
    return statements.flatMap((statement) => this.statement(statement)).map((line) => (line ? prefix + line : line));
  }

  /** Runs `fn` collecting the code it hoists before and after itself. */
  protected capture<T>(fn: () => T): { value: T; pre: string[]; post: string[] } {
    const saved = [this.pre, this.post];
    this.pre = [];
    this.post = [];
    try {
      const value = fn();
      return { value, pre: this.pre, post: this.post };
    } finally {
      [this.pre, this.post] = saved;
    }
  }

  protected forPlan(statement: ForStatementNode): ForPlan {
    const descending = forDirection(statement, this.settings);
    const step = statement.step ? evaluateConstant(statement.step) : descending === null ? null : descending ? -1 : 1;
    return { descending: step === null ? null : descending, step };
  }

  /**
   * Whether a Para loop can be a native counting loop whose counter cannot be
   * changed by the body and is not meaningful after the loop (Pascal's for,
   * MatLab's for over a range): constant step, counter written nowhere in the
   * body and not read outside the loop.
   */
  protected isPlainCountingLoop(statement: ForStatementNode, plan: ForPlan): boolean {
    const key = normalizeName(statement.variable);
    return (
      plan.descending !== null &&
      plan.step !== null &&
      !this.aliases.has(key) &&
      !this.context.countersReadOutside.has(key) &&
      !writesVariable(statement.body, key, this.inference)
    );
  }

  /** The Para Cada loop's variables, or null (with a warning) when it cannot be translated. */
  protected forEachPlan(statement: ForEachStatementNode): ForEachPlan | null {
    const scope = this.context.scope;
    const alias = scope.vars.get(normalizeName(statement.variable))!;
    const collection =
      statement.collection.kind === "identifier"
        ? scope.vars.get(normalizeName(statement.collection.name))
        : undefined;
    if (!collection?.array) {
      this.warn(statement, "EXPORT_FOREACH", statement.variable);
      return null;
    }
    return { alias, collection, depth: collection.array.dims.length };
  }

  /** Counter names for walking the indices of a Para Cada collection. */
  protected forEachCounters(plan: ForEachPlan, kind?: ValueKind): string[] {
    return Array.from({ length: plan.depth }, (_, index) =>
      this.temp(`${this.name(plan.collection.name)}_${"ijklmn"[index] ?? `i${index}`}`, kind)
    );
  }

  /** Whether every case of a Segun is a constant integer, or every one a text literal. */
  protected switchCases(statement: Extract<StatementNode, { kind: "switch" }>): "int" | "string" | null {
    const values = statement.cases.flatMap((switchCase) => switchCase.values);
    const kind = this.kind(statement.expression);
    if (
      kind === "int" &&
      values.every((value) => {
        const constant = evaluateConstant(value);
        return constant !== null && Number.isInteger(constant);
      })
    ) {
      return "int";
    }
    if (kind === "string" && values.every((value) => value.kind === "literal" && value.valueType === "string")) {
      return "string";
    }
    return null;
  }

  /**
   * SubCadena(s, desde, hasta) as a start position (in `base`) and a length.
   */
  protected substringBounds(args: ExpressionNode[], base: 0 | 1): { from: ExpressionNode; length: ExpressionNode } {
    const shift = base - (this.settings.baseZeroArrays ? 0 : 1);
    const from = offsetExpression(args[1], shift);
    if (sameExpression(args[1], args[2])) return { from, length: { kind: "literal", value: 1, valueType: "number" } };
    const length = offsetExpression({ kind: "binary", operator: "-", left: args[2], right: args[1] }, 1);
    const constant = evaluateConstant(length);
    return {
      from,
      length: constant !== null ? { kind: "literal", value: constant, valueType: "number" } : length,
    };
  }

  // ---------------------------------------------------------------------------
  // Types

  protected typeOf(expression: ExpressionNode): InferredType {
    return this.inference.typeOf(expression, this.context.scope);
  }

  protected isNumeric(expression: ExpressionNode): boolean {
    const type = this.typeOf(expression);
    return type === "number" || type === "int" || type === "double";
  }

  /** Whether the expression is an integer once translated. */
  protected isInt(expression: ExpressionNode): boolean {
    if (this.typeOf(expression) === "int") return true;
    switch (expression.kind) {
      case "literal":
        return (
          typeof expression.value === "number" &&
          Number.isInteger(expression.value) &&
          Math.abs(expression.value) <= this.intLimit
        );
      case "group":
        return this.isInt(expression.expression);
      case "unary":
        return expression.operator === "-" && this.isInt(expression.operand);
      case "binary":
        return (
          ["+", "-", "*", "%"].includes(expression.operator) &&
          this.isInt(expression.left) &&
          this.isInt(expression.right)
        );
      default:
        return false;
    }
  }

  /** The translated type of a value: untyped values are texts. */
  protected kind(expression: ExpressionNode): ValueKind {
    const type = this.kindOf(this.typeOf(expression));
    return type === "double" && this.isInt(expression) ? "int" : type;
  }

  protected kindOf(type: InferredType): ValueKind {
    const resolved = resolveType(type);
    return resolved === "int" || resolved === "double" || resolved === "bool" ? resolved : "string";
  }

  protected variableKind(info: VariableInfo): ValueKind {
    return this.kindOf(info.type);
  }

  /** Information about the parameter at `index` of a subprocess. */
  protected parameter(routine: RoutineNode, index: number): { byReference: boolean; info: VariableInfo } | null {
    const param = routine.params[index];
    if (!param) return null;
    const info = this.scopeOf(routine).vars.get(normalizeName(param.name));
    return info ? { byReference: param.byReference, info } : null;
  }

  // ---------------------------------------------------------------------------
  // Expressions

  /** Renders a real value as an integer (truncating), for indices and sizes. */
  protected abstract toInteger(rendered: Rendered): Rendered;

  /** An integer rendering of `expression + delta`. */
  protected integer(expression: ExpressionNode, delta = 0): Rendered {
    const rendered = this.expression(offsetExpression(expression, delta));
    return this.isInt(expression) ? rendered : this.toInteger(rendered);
  }

  /** How much to add to a pseudocode index to get the language's index. */
  protected indexShift(array: VariableInfo | undefined): number {
    void array; // Languages with per-array indexing look at it.
    return this.settings.baseZeroArrays ? 0 : -1;
  }

  protected index(expression: ExpressionNode, array?: VariableInfo): Rendered {
    return this.integer(expression, this.indexShift(array));
  }

  expression(expression: ExpressionNode): Rendered {
    switch (expression.kind) {
      case "literal":
        if (expression.valueType === "string") return this.stringLiteral(String(expression.value));
        if (expression.valueType === "boolean") return this.boolLiteral(Boolean(expression.value));
        return this.numberLiteral(expression.value as number);
      case "group":
        return { code: `(${this.expression(expression.expression).code})`, prec: this.prec.primary };
      case "identifier":
        return this.identifier(expression.name);
      case "arrayAccess": {
        const info =
          expression.target.kind === "identifier"
            ? this.context.scope.vars.get(normalizeName(expression.target.name))
            : undefined;
        const base =
          expression.target.kind === "identifier"
            ? this.identifier(expression.target.name)
            : this.expression(expression.target);
        return this.arrayAccess(
          wrap(base, this.prec.primary),
          expression.indices.map((index) => this.index(index, info)),
          info
        );
      }
      case "call":
        return this.call(expression.callee, expression.args);
      case "unary":
        return this.unary(expression.operator, expression.operand);
      case "binary":
        return this.binary(expression.operator, expression.left, expression.right);
    }
  }

  protected abstract stringLiteral(value: string): Rendered;
  protected abstract boolLiteral(value: boolean): Rendered;
  protected numberLiteral(value: number): Rendered {
    return { code: String(value), prec: value < 0 ? this.prec.unary : this.prec.primary };
  }
  /** A variable of the routine by its translated name. */
  protected variable(name: string, info?: VariableInfo): Rendered {
    void info; // Languages that render arrays differently look at it.
    return { code: name, prec: this.prec.primary };
  }
  protected abstract arrayAccess(base: string, indices: Rendered[], info: VariableInfo | undefined): Rendered;
  protected abstract unary(operator: string, operand: ExpressionNode): Rendered;
  protected abstract binary(operator: string, left: ExpressionNode, right: ExpressionNode, typedAs?: ExpressionNode): Rendered;
  protected abstract constant(name: "PI" | "EULER"): Rendered;
  protected abstract builtin(name: string, args: ExpressionNode[]): Rendered | null;
  protected abstract routineCall(routine: RoutineNode, args: ExpressionNode[]): Rendered;

  protected identifier(name: string): Rendered {
    const key = normalizeName(name);
    const alias = this.aliases.get(key);
    if (alias) return { code: alias, prec: this.prec.primary };
    const info = this.context.scope.vars.get(key);
    if (!info) {
      if (this.inference.findRoutine(name)) return this.call(name, []);
      if (isConstantBuiltin(name)) return this.constant(normalizeBuiltinName(name) as "PI" | "EULER");
    }
    return this.variable(this.name(name), info);
  }

  protected call(callee: string, args: ExpressionNode[]): Rendered {
    if (args.length === 0 && isConstantBuiltin(callee)) {
      return this.constant(normalizeBuiltinName(callee) as "PI" | "EULER");
    }
    const routine = this.inference.findRoutine(callee);
    if (routine) return this.routineCall(routine, args);
    const builtin = this.builtin(normalizeBuiltinName(callee), args);
    if (builtin) return builtin;
    return {
      code: `${this.name(callee)}(${args.map((arg) => this.expression(arg).code).join(", ")})`,
      prec: this.prec.primary,
    };
  }

  /** Renders `left op right` with the usual left-associative wrapping. */
  protected infix(left: Rendered, symbol: string, right: Rendered, prec: number): Rendered {
    return { code: `${wrap(left, prec)} ${symbol} ${wrap(right, prec + 1)}`, prec };
  }

  /** A function-call rendering. */
  protected fn(name: string, ...args: (Rendered | string)[]): Rendered {
    return {
      code: `${name}(${args.map((arg) => (typeof arg === "string" ? arg : arg.code)).join(", ")})`,
      prec: this.prec.primary,
    };
  }

  /**
   * Whether an argument for a by-reference parameter of type `kind` has to go
   * through an auxiliary variable: it is not a variable or array element, or
   * it has another type.
   */
  protected needsReferenceCopy(arg: ExpressionNode, kind: ValueKind): boolean {
    return !isAssignable(arg) || this.kind(arg) !== kind;
  }

  /** The explanatory header comment, in the language's comment syntax. */
  protected headerComment(prefix: string): string[] {
    if (!this.comments) return [];
    return [
      `${prefix} Este código fue generado por Codoritmo a partir del pseudocódigo.`,
      `${prefix} Puede que no sea completamente correcto: revíselo antes de usarlo.`,
    ];
  }
}

/** Whether two expressions are written the same (positions aside). */
function sameExpression(a: ExpressionNode, b: ExpressionNode): boolean {
  const strip = (node: ExpressionNode) => JSON.stringify(node, (key, value) => (key === "span" ? undefined : value));
  return strip(a) === strip(b);
}

export { wrap };
export type { Rendered };
