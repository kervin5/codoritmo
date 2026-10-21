import type {
  AssignableExpressionNode,
  Diagnostic,
  EngineSettings,
  ExpressionNode,
  GenerationResult,
  ProgramNode,
  RoutineNode,
  StatementNode,
  SwitchStatementNode,
} from "../types";
import { normalizeEngineSettings } from "../settings";
import {
  evaluateConstant,
  InferredType,
  isNumericType,
  normalizeBuiltinName,
  normalizeName,
  ProgramTypes,
  resolveType,
  ScopeTypes,
  TypeInference,
  VariableInfo,
} from "./type-inference";

export interface CFamilyGeneratorOptions {
  settings?: Partial<EngineSettings>;
  /** Explanatory comments in the output (on by default). */
  comments?: boolean;
}

/** A rendered expression and the precedence of its outermost operator. */
export interface Rendered {
  code: string;
  prec: number;
}

export const PREC = {
  ternary: 20,
  or: 30,
  and: 40,
  equality: 50,
  relational: 60,
  shift: 65,
  additive: 70,
  multiplicative: 80,
  unary: 90,
  primary: 100,
} as const;

const BINARY_PRECEDENCE: Record<string, number> = {
  OR: PREC.or,
  AND: PREC.and,
  "=": PREC.equality,
  "<>": PREC.equality,
  "<": PREC.relational,
  ">": PREC.relational,
  "<=": PREC.relational,
  ">=": PREC.relational,
  "+": PREC.additive,
  "-": PREC.additive,
  "*": PREC.multiplicative,
  "/": PREC.multiplicative,
  "%": PREC.multiplicative,
};

const C_OPERATORS: Record<string, string> = {
  OR: " || ",
  AND: " && ",
  "=": "==",
  "<>": "!=",
  "<": "<",
  ">": ">",
  "<=": "<=",
  ">=": ">=",
  "+": "+",
  "-": "-",
  "*": "*",
  "/": "/",
  "%": "%",
};

const INVERTED_RELATIONAL: Record<string, string> = {
  "=": "<>",
  "<>": "=",
  "<": ">=",
  ">=": "<",
  ">": "<=",
  "<=": ">",
};

const RESERVED_WORDS = new Set(
  `auto bool break case catch char class const continue default delete do double
  else enum extern false float for friend goto if inline int long main namespace
  new operator private protected public register return short signed sizeof static
  struct switch template this throw true try typedef typename union unsigned using
  virtual void volatile while and or not xor
  printf scanf getchar strcpy strcat strcmp strlen strncpy sprintf atof rand
  pow sqrt fabs abs log exp sin cos tan asin acos atan floor fmod round
  cout cin endl string std clock toupper tolower
  esperar mayusculas minusculas subcadena convertiratexto get_aux_buffer leer_logico
  ARREGLO_MAX MAX_STRLEN MAX_BUFFERS SIN_TIPO M_PI`.split(/\s+/)
);

export function toIdentifier(name: string): string {
  let identifier = normalizeName(name).replace(/[^a-z0-9_]/g, "_");
  if (!identifier) identifier = "variable";
  if (/^\d/.test(identifier)) identifier = `_${identifier}`;
  if (RESERVED_WORDS.has(identifier)) identifier = `${identifier}_`;
  return identifier;
}

export function escapeCString(value: string): string {
  let escaped = "";
  for (const char of value) {
    switch (char) {
      case "\\":
        escaped += "\\\\";
        break;
      case '"':
        escaped += '\\"';
        break;
      case "\n":
        escaped += "\\n";
        break;
      case "\r":
        escaped += "\\r";
        break;
      case "\t":
        escaped += "\\t";
        break;
      default:
        escaped +=
          char.charCodeAt(0) < 0x20
            ? `\\x${char.charCodeAt(0).toString(16).padStart(2, "0")}`
            : char;
    }
  }
  return `"${escaped}"`;
}

export function wrap(rendered: Rendered, minPrec: number): string {
  return rendered.prec < minPrec ? `(${rendered.code})` : rendered.code;
}

/** Context of the routine currently being generated. */
export interface RoutineContext {
  scope: ScopeTypes;
  routine: RoutineNode | null;
}

/**
 * Shared skeleton for the C and C++ exporters, mirroring upstream PSeInt's
 * CppExporter/CExporter layout: includes and helper prototypes, forward
 * declarations for subprocesses, `main`, the subprocesses, then helper
 * definitions. Language differences live in the abstract hooks.
 */
export abstract class CFamilyGenerator {
  protected readonly settings: EngineSettings;
  protected readonly comments: boolean;
  protected inference!: TypeInference;
  protected types!: ProgramTypes;
  protected uses = new Set<string>();
  protected diagnostics: Diagnostic[] = [];
  protected context!: RoutineContext;

  constructor(options: CFamilyGeneratorOptions = {}) {
    this.settings = normalizeEngineSettings(options.settings);
    this.comments = options.comments ?? true;
  }

  generate(program: ProgramNode): GenerationResult {
    this.inference = new TypeInference(program);
    const types = this.inference.run();
    this.types = types;
    this.uses = new Set();
    this.diagnostics = [];
    this.forEachDepth = 0;

    const body: string[] = [];
    const prototypes: string[] = [];

    this.context = { scope: types.main, routine: null };
    body.push(...this.generateRoutine(null, program.entry.body, types.main));

    for (const routine of program.routines) {
      const scope = types.routines.get(normalizeName(routine.name))!;
      this.context = { scope, routine };
      const lines = this.generateRoutine(routine, routine.body, scope);
      prototypes.push(`${lines[0].slice(0, -2)};`);
      if (this.comments) body.push("");
      body.push(...lines);
    }

    const footer = this.footer();
    const lines = [...this.header()];
    if (prototypes.length > 0) {
      if (this.comments) {
        lines.push(this.comment("Declaraciones adelantadas de los subprocesos"));
      }
      lines.push(...prototypes);
      if (this.comments) lines.push("");
    }
    lines.push(...body);
    if (footer.length > 0) {
      if (this.comments) lines.push("");
      lines.push(...footer);
    }

    return { code: `${lines.join("\n")}\n`, diagnostics: this.diagnostics };
  }

  // ---------------------------------------------------------------------------
  // Language hooks

  protected abstract header(): string[];
  protected abstract footer(): string[];
  protected abstract comment(text: string): string;
  /** Declaration of a variable, local or parameter. */
  protected abstract declaration(
    info: VariableInfo,
    asParameter: boolean
  ): string;
  /** Return type of a subprocess with the given value type. */
  protected abstract returnTypeName(type: InferredType): string;
  protected abstract returnStatement(info: VariableInfo, value: string): string;
  protected abstract write(args: ExpressionNode[], newline: boolean): string[];
  protected abstract read(targets: AssignableExpressionNode[]): string[];
  protected abstract assign(
    target: AssignableExpressionNode,
    value: ExpressionNode
  ): string;
  protected abstract forEachLoop(
    alias: VariableInfo,
    collection: VariableInfo,
    dims: string[]
  ): { open: string[]; aliasExpression: string };
  protected abstract clearScreen(): string;
  protected abstract waitKey(): string;
  protected abstract stringBinary(
    operator: string,
    left: ExpressionNode,
    right: ExpressionNode
  ): Rendered;
  protected abstract builtin(name: string, args: ExpressionNode[]): Rendered | null;
  /** How a by-reference scalar parameter is read inside its subprocess. */
  protected abstract referenceParameter(name: string): string;
  /** How an argument is passed to a by-reference scalar parameter. */
  protected abstract referenceArgument(arg: Rendered): string;
  protected abstract castToInt(rendered: Rendered): Rendered;

  /** Parameter list of a subprocess without parameters. */
  protected emptyParameterList(): string {
    return "";
  }
  protected abstract castToDouble(rendered: Rendered): Rendered;

  // ---------------------------------------------------------------------------
  // Routines and declarations

  private generateRoutine(
    routine: RoutineNode | null,
    statements: StatementNode[],
    scope: ScopeTypes
  ): string[] {
    const lines: string[] = [];
    const returnInfo = scope.returnKey ? scope.vars.get(scope.returnKey)! : null;

    if (!routine) {
      lines.push("int main() {");
    } else {
      const returnType = returnInfo
        ? this.returnTypeName(resolveType(returnInfo.type))
        : scope.returnType !== "unknown"
        ? this.returnTypeName(resolveType(scope.returnType))
        : "void";
      const params = routine.params.map((param) =>
        this.declaration(scope.vars.get(normalizeName(param.name))!, true)
      );
      lines.push(
        `${returnType} ${toIdentifier(routine.name)}(${
          params.length > 0 ? params.join(", ") : this.emptyParameterList()
        }) {`
      );
    }

    const locals = [...scope.vars.values()]
      .filter((info) => !info.param && !info.forEachAlias)
      .sort((a, b) => toIdentifier(a.name).localeCompare(toIdentifier(b.name)));
    for (const info of locals) {
      lines.push(`\t${this.declaration(info, false)};`);
    }

    lines.push(...this.statements(statements, 1));

    if (!routine) {
      lines.push("\treturn 0;");
    } else if (returnInfo) {
      lines.push(
        `\t${this.returnStatement(returnInfo, toIdentifier(returnInfo.name))}`
      );
    }
    lines.push("}");
    return lines;
  }

  /** Array suffix (`[10][ARREGLO_MAX]`) for a declaration. */
  protected arraySuffix(info: VariableInfo, asParameter: boolean): string {
    if (!info.array) return "";
    return info.array.dims
      .map((dim, index) => {
        if (asParameter && index === 0) return "[]";
        if (dim === null) {
          this.uses.add("arreglo_max");
          return "[ARREGLO_MAX]";
        }
        return `[${dim}]`;
      })
      .join("");
  }

  protected variableType(info: VariableInfo): InferredType {
    return resolveType(info.type);
  }

  protected baseTypeName(type: InferredType): string {
    switch (type) {
      case "int":
        return "int";
      case "double":
      case "number":
        return "double";
      case "bool":
        this.uses.add("bool");
        return "bool";
      case "string":
        this.uses.add("string");
        return "string";
      default:
        this.uses.add("sin_tipo");
        return "SIN_TIPO";
    }
  }

  // ---------------------------------------------------------------------------
  // Statements

  protected statements(statements: StatementNode[], level: number): string[] {
    const lines: string[] = [];
    for (const statement of statements) {
      lines.push(
        ...this.statement(statement).map((line) => "\t".repeat(level) + line)
      );
    }
    return lines;
  }

  /** Lines for one statement, relative to its own indentation. */
  private statement(statement: StatementNode): string[] {
    const nested = (body: StatementNode[]) => this.statements(body, 1);

    switch (statement.kind) {
      case "define":
      case "dimension":
        return [];
      case "assignment":
        return [this.assign(statement.target, statement.value)];
      case "write":
        return this.write(statement.expressions, statement.newline);
      case "read":
        return this.read(statement.targets);
      case "if": {
        const lines = [
          `if (${this.expression(statement.condition).code}) {`,
          ...nested(statement.thenBranch),
        ];
        if (statement.elseBranch.length > 0) {
          lines.push("} else {", ...nested(statement.elseBranch));
        }
        lines.push("}");
        return lines;
      }
      case "while":
        return [
          `while (${this.expression(statement.condition).code}) {`,
          ...nested(statement.body),
          "}",
        ];
      case "repeat": {
        const condition =
          statement.mode === "while"
            ? statement.condition
            : this.invertCondition(statement.condition);
        return [
          "do {",
          ...nested(statement.body),
          `} while (${this.expression(condition).code});`,
        ];
      }
      case "for":
        return [this.forHeader(statement), ...nested(statement.body), "}"];
      case "forEach":
        return this.forEach(statement, nested);
      case "switch":
        return this.switchStatement(statement, nested);
      case "expression": {
        const expression = statement.expression;
        if (expression.kind === "identifier") {
          return [`${this.expression({ kind: "call", callee: expression.name, args: [] }).code};`];
        }
        return [`${this.expression(expression).code};`];
      }
      case "clear":
        return [this.clearScreen()];
      case "wait":
        if (statement.mode === "key") return [this.waitKey()];
        this.uses.add("esperar");
        return [`esperar(${this.expression(statement.durationMs!).code});`];
      case "return": {
        if (!this.context.routine) return ["return 0;"];
        return [
          statement.expression
            ? `return ${this.expression(statement.expression).code};`
            : "return;",
        ];
      }
    }
  }

  private invertCondition(condition: ExpressionNode): ExpressionNode {
    if (condition.kind === "group") return this.invertCondition(condition.expression);
    if (condition.kind === "unary" && condition.operator === "NOT") {
      return condition.operand;
    }
    if (condition.kind === "binary" && INVERTED_RELATIONAL[condition.operator]) {
      return { ...condition, operator: INVERTED_RELATIONAL[condition.operator] };
    }
    return {
      kind: "unary",
      operator: "NOT",
      operand: { kind: "group", expression: condition },
    };
  }

  private forHeader(statement: Extract<StatementNode, { kind: "for" }>): string {
    const variable = this.expression({ kind: "identifier", name: statement.variable }).code;
    const start = this.expression(statement.start).code;
    const end = this.expression(statement.end);
    const stepValue = statement.step ? evaluateConstant(statement.step) : 1;
    let descending: boolean | null;
    if (statement.step) {
      descending = stepValue === null ? null : stepValue < 0;
    } else if (this.settings.deduceNegativeForStep) {
      const startValue = evaluateConstant(statement.start);
      const endValue = evaluateConstant(statement.end);
      descending =
        startValue !== null && endValue !== null ? startValue > endValue : null;
    } else {
      descending = false;
    }

    const init = `${variable}=${start}`;
    if (descending === null) {
      // The direction is only known at run time.
      const step = statement.step
        ? wrap(this.expression(statement.step), PREC.relational + 1)
        : `(${start}<=${end.code} ? 1 : -1)`;
      const endCode = wrap(end, PREC.relational + 1);
      return `for (${init}; (${step}>0 ? ${variable}<=${endCode} : ${variable}>=${endCode}); ${variable}+=${step}) {`;
    }

    const condition = `${variable}${descending ? ">=" : "<="}${wrap(end, PREC.relational + 1)}`;
    const magnitude = stepValue === null ? null : Math.abs(stepValue);
    let update: string;
    if (magnitude === 1) {
      update = `${descending ? "--" : "++"}${variable}`;
    } else if (statement.step && magnitude !== null) {
      update = `${variable}${descending ? "-=" : "+="}${magnitude}`;
    } else {
      update = `${variable}+=${this.expression(statement.step!).code}`;
    }
    return `for (${init}; ${condition}; ${update}) {`;
  }

  private forEach(
    statement: Extract<StatementNode, { kind: "forEach" }>,
    nested: (body: StatementNode[]) => string[]
  ): string[] {
    const scope = this.context.scope;
    const alias = scope.vars.get(normalizeName(statement.variable))!;
    const collection =
      statement.collection.kind === "identifier"
        ? scope.vars.get(normalizeName(statement.collection.name))
        : undefined;
    if (!collection?.array) {
      this.diagnostics.push({
        message: `Para Cada needs an array variable to export (${statement.variable}).`,
        line: statement.span?.start.line ?? 0,
        column: statement.span?.start.column ?? 0,
        severity: "warning",
        code: "EXPORT_FOREACH",
      });
      return [this.comment(`Para Cada ${statement.variable}: no se pudo traducir`)];
    }

    const dims = collection.array.dims.map((dim) => {
      if (dim !== null) return String(dim);
      this.uses.add("arreglo_max");
      return "ARREGLO_MAX";
    });
    const loop = this.forEachLoop(alias, collection, dims);
    const previous = this.aliasExpressions.get(alias.key);
    this.aliasExpressions.set(alias.key, loop.aliasExpression);
    this.forEachDepth += 1;
    const body = nested(statement.body);
    this.forEachDepth -= 1;
    if (previous === undefined) this.aliasExpressions.delete(alias.key);
    else this.aliasExpressions.set(alias.key, previous);
    return [...loop.open, ...body, "}"];
  }

  /** Expressions that stand for Para Cada aliases while inside their loop. */
  protected aliasExpressions = new Map<string, string>();
  /** Nesting depth of Para Cada loops, for naming auxiliary variables. */
  protected forEachDepth = 0;

  private switchStatement(
    statement: SwitchStatementNode,
    nested: (body: StatementNode[]) => string[]
  ): string[] {
    const type = resolveType(this.typeOf(statement.expression));
    if (type === "string") {
      // switch only works on integers: fall back to an if/else chain.
      const lines: string[] = [];
      statement.cases.forEach((switchCase, index) => {
        const condition = switchCase.values
          .map((value) =>
            this.expression({
              kind: "binary",
              operator: "=",
              left: statement.expression,
              right: value,
            })
          )
          .map((rendered) =>
            switchCase.values.length > 1 ? wrap(rendered, PREC.or + 1) : rendered.code
          )
          .join(" || ");
        lines.push(`${index === 0 ? "" : "} else "}if (${condition}) {`);
        lines.push(...nested(switchCase.body));
      });
      if (statement.defaultCase.length > 0) {
        lines.push(statement.cases.length > 0 ? "} else {" : "{");
        lines.push(...nested(statement.defaultCase));
      }
      if (lines.length > 0) lines.push("}");
      return lines;
    }

    let control = this.expression(statement.expression);
    if (type !== "int" && type !== "bool") control = this.castToInt(control);
    const lines = [`switch (${control.code}) {`];
    for (const switchCase of statement.cases) {
      for (const value of switchCase.values) {
        lines.push(`case ${this.expression(value).code}:`);
      }
      lines.push(...nested(switchCase.body), "\tbreak;");
    }
    if (statement.defaultCase.length > 0) {
      lines.push("default:", ...nested(statement.defaultCase));
    }
    lines.push("}");
    return lines;
  }

  // ---------------------------------------------------------------------------
  // Expressions

  protected typeOf(expression: ExpressionNode): InferredType {
    return this.inference.typeOf(expression, this.context.scope);
  }

  protected variableOf(expression: ExpressionNode): VariableInfo | undefined {
    const name =
      expression.kind === "identifier"
        ? expression.name
        : expression.kind === "arrayAccess" && expression.target.kind === "identifier"
        ? expression.target.name
        : null;
    return name ? this.context.scope.vars.get(normalizeName(name)) : undefined;
  }

  protected isStringLiteral(expression: ExpressionNode): boolean {
    return expression.kind === "literal" && expression.valueType === "string";
  }

  /** `expression + delta`, folding constants (`i+1` - 1 becomes `i`). */
  protected offset(expression: ExpressionNode, delta: number): Rendered {
    if (delta === 0) return this.expression(expression);
    const constant = evaluateConstant(expression);
    if (constant !== null) {
      const value = constant + delta;
      return { code: String(value), prec: value < 0 ? PREC.unary : PREC.primary };
    }
    if (
      expression.kind === "binary" &&
      (expression.operator === "+" || expression.operator === "-")
    ) {
      const right = evaluateConstant(expression.right);
      if (right !== null) {
        const value = (expression.operator === "+" ? right : -right) + delta;
        if (value === 0) return this.expression(expression.left);
        const left = this.expression(expression.left);
        return {
          code: `${wrap(left, PREC.additive)}${value > 0 ? "+" : "-"}${Math.abs(value)}`,
          prec: PREC.additive,
        };
      }
    }
    const rendered = this.expression(expression);
    return {
      code: `${wrap(rendered, PREC.additive)}${delta > 0 ? "+" : "-"}${Math.abs(delta)}`,
      prec: PREC.additive,
    };
  }

  /** An integer-valued rendering, casting when the type is not integer. */
  protected integer(expression: ExpressionNode, delta = 0): Rendered {
    const rendered = this.offset(expression, delta);
    return this.isCInt(expression) ? rendered : this.castToInt(rendered);
  }

  protected index(expression: ExpressionNode): Rendered {
    return this.integer(expression, this.settings.baseZeroArrays ? 0 : -1);
  }

  expression(expression: ExpressionNode): Rendered {
    switch (expression.kind) {
      case "literal":
        if (expression.valueType === "string") {
          return { code: escapeCString(String(expression.value)), prec: PREC.primary };
        }
        if (expression.valueType === "boolean") {
          this.uses.add("bool");
          return { code: expression.value ? "true" : "false", prec: PREC.primary };
        }
        return {
          code: String(expression.value),
          prec: (expression.value as number) < 0 ? PREC.unary : PREC.primary,
        };
      case "group":
        return {
          code: `(${this.expression(expression.expression).code})`,
          prec: PREC.primary,
        };
      case "identifier":
        return this.identifier(expression.name);
      case "arrayAccess": {
        const base =
          expression.target.kind === "identifier"
            ? this.identifier(expression.target.name).code
            : wrap(this.expression(expression.target), PREC.primary);
        const indices = expression.indices
          .map((index) => `[${this.index(index).code}]`)
          .join("");
        return { code: `${base}${indices}`, prec: PREC.primary };
      }
      case "call":
        return this.call(expression.callee, expression.args);
      case "unary": {
        const operand = this.expression(expression.operand);
        return {
          code: `${expression.operator === "-" ? "-" : "!"}${wrap(operand, PREC.unary)}`,
          prec: PREC.unary,
        };
      }
      case "binary":
        return this.binary(expression.operator, expression.left, expression.right);
    }
  }

  private identifier(name: string): Rendered {
    const key = normalizeName(name);
    const alias = this.aliasExpressions.get(key);
    if (alias) return { code: alias, prec: PREC.primary };

    const info = this.context.scope.vars.get(key);
    if (!info) {
      if (this.inference.findRoutine(name)) return this.call(name, []);
      if (normalizeBuiltinName(name) === "PI") {
        this.uses.add("math");
        this.uses.add("pi");
        return { code: "M_PI", prec: PREC.primary };
      }
    }
    if (info?.param?.byReference && !info.array && !this.passesByPointer(info)) {
      return { code: this.referenceParameter(toIdentifier(name)), prec: PREC.primary };
    }
    return { code: toIdentifier(name), prec: PREC.primary };
  }

  /** Whether a by-reference parameter is already passed as a pointer (C strings). */
  protected passesByPointer(info: VariableInfo): boolean {
    void info;
    return false;
  }

  private call(callee: string, args: ExpressionNode[]): Rendered {
    // The parser turns a bare PI into a zero-argument call.
    if (args.length === 0 && normalizeBuiltinName(callee) === "PI") {
      this.uses.add("math");
      this.uses.add("pi");
      return { code: "M_PI", prec: PREC.primary };
    }
    const builtin = this.builtin(normalizeBuiltinName(callee), args);
    if (builtin) return builtin;

    const routine = this.inference.findRoutine(callee);
    if (!routine) {
      return {
        code: `${toIdentifier(callee)}(${args.map((arg) => this.expression(arg).code).join(", ")})`,
        prec: PREC.primary,
      };
    }

    const calleeScope = this.calleeScope(routine);
    const rendered = args.map((arg, index) => {
      const param = routine.params[index];
      const value = this.expression(arg);
      if (!param?.byReference) return value.code;
      const info = calleeScope?.vars.get(normalizeName(param.name));
      if (!info || info.array || this.passesByPointer(info)) return value.code;
      return this.referenceArgument(value);
    });
    return {
      code: `${toIdentifier(routine.name)}(${rendered.join(", ")})`,
      prec: PREC.primary,
    };
  }

  protected calleeScope(routine: RoutineNode): ScopeTypes | undefined {
    return this.types.routines.get(normalizeName(routine.name));
  }

  protected binary(
    operator: string,
    left: ExpressionNode,
    right: ExpressionNode
  ): Rendered {
    const leftType = resolveType(this.typeOf(left));
    const rightType = resolveType(this.typeOf(right));
    const isString = leftType === "string" || rightType === "string";

    if (isString && (operator === "+" || INVERTED_RELATIONAL[operator])) {
      return this.stringBinary(operator, left, right);
    }

    if (operator === "^") {
      this.uses.add("math");
      return {
        code: `pow(${this.expression(left).code}, ${this.expression(right).code})`,
        prec: PREC.primary,
      };
    }

    if (operator === "%" && !(this.isCInt(left) && this.isCInt(right))) {
      this.uses.add("math");
      return {
        code: `fmod(${this.expression(left).code}, ${this.expression(right).code})`,
        prec: PREC.primary,
      };
    }

    const prec = BINARY_PRECEDENCE[operator] ?? PREC.primary;
    let leftCode = this.expression(left);
    if (operator === "/" && this.isCInt(left) && this.isCInt(right)) {
      // PSeInt division is always real, C's integer division is not.
      leftCode = isIntegerLiteral(left)
        ? { code: `${leftCode.code}.0`, prec: PREC.primary }
        : this.castToDouble(leftCode);
    }
    const rightCode = this.expression(right);
    return {
      code: `${wrap(leftCode, prec)}${C_OPERATORS[operator] ?? operator}${wrap(rightCode, prec + 1)}`,
      prec,
    };
  }

  protected isNumeric(expression: ExpressionNode): boolean {
    return isNumericType(this.typeOf(expression));
  }

  /** Whether the expression has an integer type once translated. */
  protected isCInt(expression: ExpressionNode): boolean {
    if (this.typeOf(expression) === "int") return true;
    switch (expression.kind) {
      case "literal":
        return typeof expression.value === "number" && Number.isInteger(expression.value);
      case "group":
        return this.isCInt(expression.expression);
      case "unary":
        return expression.operator === "-" && this.isCInt(expression.operand);
      case "binary":
        return (
          ["+", "-", "*", "%"].includes(expression.operator) &&
          this.isCInt(expression.left) &&
          this.isCInt(expression.right)
        );
      default:
        return false;
    }
  }
}

function isIntegerLiteral(expression: ExpressionNode): boolean {
  return (
    expression.kind === "literal" &&
    typeof expression.value === "number" &&
    Number.isInteger(expression.value)
  );
}

/** Character count of SubCadena(s, desde, hasta): hasta-desde+1. */
export function substringLength(
  generator: CFamilyGenerator,
  from: ExpressionNode,
  to: ExpressionNode
): string {
  const fromValue = evaluateConstant(from);
  const toValue = evaluateConstant(to);
  if (fromValue !== null && toValue !== null) return String(toValue - fromValue + 1);
  const toCode = generator.expression(to);
  const fromCode = generator.expression(from);
  return `${wrap(toCode, PREC.additive)}-${wrap(fromCode, PREC.additive + 1)}+1`;
}
