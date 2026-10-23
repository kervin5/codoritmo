import { engineMessage } from "../messages";
import { normalizeEngineSettings } from "../settings";
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
import {
  containsCall,
  declaredAtSite,
  escapeString,
  forDirection,
  invertCondition,
  isAssignable,
  makeIdentifier,
  offsetExpression,
  Rendered,
  walk,
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

export interface JavaGeneratorOptions {
  settings?: Partial<EngineSettings>;
  /** Explanatory comments in the output (on by default). */
  comments?: boolean;
}

const PREC = {
  ternary: 20,
  or: 30,
  and: 40,
  equality: 50,
  relational: 60,
  additive: 70,
  multiplicative: 80,
  unary: 90,
  primary: 100,
} as const;

const OPERATORS: Record<string, [string, number]> = {
  OR: ["||", PREC.or],
  AND: ["&&", PREC.and],
  "=": ["==", PREC.equality],
  "<>": ["!=", PREC.equality],
  "<": ["<", PREC.relational],
  ">": [">", PREC.relational],
  "<=": ["<=", PREC.relational],
  ">=": [">=", PREC.relational],
  "+": ["+", PREC.additive],
  "-": ["-", PREC.additive],
  "*": ["*", PREC.multiplicative],
  "/": ["/", PREC.multiplicative],
  "%": ["%", PREC.multiplicative],
};

const RESERVED = new Set(
  `abstract assert boolean break byte case catch char class const continue default
  do double else enum extends final finally float for goto if implements import
  instanceof int interface long native new package private protected public return
  short static strictfp super switch synchronized this throw throws transient try
  void volatile while true false null var yield record sealed permits
  main args entrada texto leer truncar redondear esperar redimensionar`.split(/\s+/)
);

/** Library classes the generated code refers to, which the class name must avoid. */
const LIBRARY_CLASSES = new Set(
  "Math String System Arrays BigDecimal RoundingMode LocalDate LocalTime BufferedReader InputStreamReader IOException Thread Integer Double".split(" ")
);

const INDENT = "    ";

interface RoutineContext {
  scope: ScopeTypes;
  routine: RoutineNode | null;
  /** Scalars kept in a one-element array so subprocesses can change them. */
  holders: Set<string>;
  /** Arrays declared where they are dimensioned instead of at the top. */
  declaredAtSite: Set<string>;
  /** Value type of the method, or null for void. */
  returnType: InferredType | null;
  names: Set<string>;
}

/**
 * Exports pseudocode to Java, following the layout of upstream PSeInt's
 * JavaExporter: one class with a static method per subprocess. Types come
 * from the shared type inference. A by-reference scalar parameter is a
 * one-element array (`int[] x`, used as `x[0]`); the caller keeps the
 * variable it passes in such an array too, or copies it in and out of one.
 */
export class JavaGenerator {
  private readonly settings: EngineSettings;
  private readonly comments: boolean;
  private inference!: TypeInference;
  private types!: ProgramTypes;
  private uses = new Set<string>();
  private resizers = new Map<string, { type: string; dims: number }>();
  private diagnostics: Diagnostic[] = [];
  private context!: RoutineContext;
  /** Statements to run before and after the one being generated. */
  private pre: string[] = [];
  private post: string[] = [];
  /** Code standing for Para Cada aliases while inside their loop. */
  private aliases = new Map<string, string>();

  constructor(options: JavaGeneratorOptions = {}) {
    this.settings = normalizeEngineSettings(options.settings);
    this.comments = options.comments ?? true;
  }

  generate(program: ProgramNode): GenerationResult {
    this.inference = new TypeInference(program);
    this.types = this.inference.run();
    this.uses = new Set();
    this.resizers = new Map();
    this.diagnostics = [];
    this.aliases = new Map();

    const methods = [
      this.routine(null, program.entry.body, this.types.main),
      ...program.routines.map((routine) =>
        this.routine(routine, routine.body, this.types.routines.get(normalizeName(routine.name))!)
      ),
    ];

    let className = makeIdentifier(program.entry.name, RESERVED).replace(/^_+/, "");
    className = className ? className[0].toUpperCase() + className.slice(1) : "Programa";
    if (LIBRARY_CLASSES.has(className)) className += "_";

    const members = [...this.fields(), ...methods, ...this.helpers()];
    const lines = [...this.header(), `class ${className} {`];
    members.forEach((member, index) => {
      if (index > 0 || this.comments) lines.push("");
      lines.push(...member.map((line) => (line ? INDENT + line : line)));
    });
    lines.push("}");
    return { code: `${lines.join("\n")}\n`, diagnostics: this.diagnostics };
  }

  // ---------------------------------------------------------------------------
  // Methods and declarations

  private name(name: string): string {
    return makeIdentifier(name, RESERVED);
  }

  private routine(routine: RoutineNode | null, statements: StatementNode[], scope: ScopeTypes): string[] {
    const returnInfo = scope.returnKey ? scope.vars.get(scope.returnKey)! : null;
    const returnType = returnInfo ? returnInfo.type : scope.returnType !== "unknown" ? scope.returnType : null;
    this.context = {
      scope,
      routine,
      holders: this.findHolders(statements, scope),
      declaredAtSite: declaredAtSite(statements, scope),
      returnType: routine ? returnType : null,
      names: new Set([...scope.vars.values()].map((info) => this.name(info.name))),
    };

    const lines: string[] = [];
    if (!routine) {
      lines.push("public static void main(String[] args) {");
    } else {
      const params = routine.params.map((param) => {
        const info = scope.vars.get(normalizeName(param.name))!;
        return `${this.isHolder(info.key) ? `${this.baseType(info.type)}[]` : this.javaType(info)} ${this.name(param.name)}`;
      });
      const type = this.context.returnType ? this.baseType(this.context.returnType) : "void";
      lines.push(`static ${type} ${this.name(routine.name)}(${params.join(", ")}) {`);
    }

    const locals = [...scope.vars.values()]
      .filter((info) => !info.param && !info.forEachAlias && !this.context.declaredAtSite.has(info.key))
      .sort((a, b) => this.name(a.name).localeCompare(this.name(b.name)));
    const body: string[] = [];
    for (const info of locals) {
      const name = this.name(info.name);
      if (info.array) {
        body.push(`${this.javaType(info)} ${name} = null;`);
      } else if (this.isHolder(info.key)) {
        body.push(`${this.baseType(info.type)}[] ${name} = {${this.defaultValue(info.type)}};`);
      } else {
        body.push(`${this.baseType(info.type)} ${name} = ${this.defaultValue(info.type)};`);
      }
    }
    body.push(...statements.flatMap((statement) => this.statement(statement)));

    const last = statements[statements.length - 1];
    if (routine && this.context.returnType && last?.kind !== "return") {
      body.push(
        `return ${returnInfo ? this.identifier(returnInfo.name).code : this.defaultValue(this.context.returnType)};`
      );
    }
    lines.push(...body.map((line) => INDENT + line), "}");
    return lines;
  }

  /** Local scalars passed (as themselves) to by-reference parameters. */
  private findHolders(statements: StatementNode[], scope: ScopeTypes): Set<string> {
    const holders = new Set<string>();
    for (const info of scope.vars.values()) {
      if (info.param?.byReference && !info.array) holders.add(info.key);
    }
    walk(statements, (node) => {
      if (node.kind !== "call") return;
      const call = node as Extract<ExpressionNode, { kind: "call" }>;
      const routine = this.inference.findRoutine(call.callee);
      if (!routine) return;
      const calleeScope = this.types.routines.get(normalizeName(routine.name))!;
      routine.params.forEach((param, index) => {
        const arg = call.args[index];
        if (!param.byReference || arg?.kind !== "identifier") return;
        if (calleeScope.vars.get(normalizeName(param.name))?.array) return;
        const info = scope.vars.get(normalizeName(arg.name));
        if (info && !info.param && !info.array && !info.forEachAlias) holders.add(info.key);
      });
    });
    return holders;
  }

  private isHolder(key: string): boolean {
    return this.context.holders.has(key) && !this.aliases.has(key);
  }

  private baseType(type: InferredType): string {
    switch (resolveType(type)) {
      case "int":
        return "int";
      case "double":
        return "double";
      case "bool":
        return "boolean";
      case "string":
        return "String";
      default:
        this.uses.add("sin_tipo");
        return "String";
    }
  }

  private javaType(info: VariableInfo): string {
    return this.baseType(info.type) + "[]".repeat(info.array?.dims.length ?? 0);
  }

  private defaultValue(type: InferredType): string {
    switch (resolveType(type)) {
      case "int":
        return "0";
      case "double":
        return "0.0";
      case "bool":
        return "false";
      default:
        return '""';
    }
  }

  /** Java type of a value once rendered (untyped values are strings). */
  private kind(expression: ExpressionNode): InferredType {
    const type = resolveType(this.typeOf(expression));
    if (type === "unknown") return "string";
    if (type === "double" && this.isInt(expression)) return "int";
    return type;
  }

  // ---------------------------------------------------------------------------
  // Statements

  private block(statements: StatementNode[]): string[] {
    return statements.flatMap((statement) => this.statement(statement)).map((line) => INDENT + line);
  }

  /** Lines of one statement, with the code hoisted out of its expressions. */
  private statement(statement: StatementNode): string[] {
    const saved = [this.pre, this.post];
    this.pre = [];
    this.post = [];
    const lines = this.statementLines(statement);
    const result = [...this.pre, ...lines, ...this.post];
    [this.pre, this.post] = saved;
    return result;
  }

  /**
   * A condition, plus the statements that must run right before testing it
   * (when it calls a subprocess with by-reference arguments).
   */
  private condition(expression: ExpressionNode): { code: Rendered; setup: string[] } {
    const saved = [this.pre, this.post];
    this.pre = [];
    this.post = [];
    let code = this.expression(expression);
    let setup = this.pre;
    if (this.post.length > 0) {
      const temp = this.temp("condicion");
      setup = [...setup, `boolean ${temp} = ${code.code};`, ...this.post];
      code = { code: temp, prec: PREC.primary };
    }
    [this.pre, this.post] = saved;
    return { code, setup };
  }

  private statementLines(statement: StatementNode): string[] {
    switch (statement.kind) {
      case "define":
        return [];
      case "dimension":
        return this.dimension(statement);
      case "assignment":
        return [`${this.expression(statement.target).code} = ${this.converted(statement.value, this.kind(statement.target))};`];
      case "write":
        return this.write(statement.expressions, statement.newline);
      case "read":
        return statement.targets.map((target) => `${this.expression(target).code} = ${this.readValue(target)};`);
      case "if":
        return this.ifStatement(statement);
      case "while": {
        const { code, setup } = this.condition(invertCondition(statement.condition));
        if (setup.length === 0) {
          return [`while (${this.expression(statement.condition).code}) {`, ...this.block(statement.body), "}"];
        }
        // The condition calls a subprocess with by-reference arguments.
        return [
          "while (true) {",
          ...[...setup, `if (${code.code}) break;`].map((line) => INDENT + line),
          ...this.block(statement.body),
          "}",
        ];
      }
      case "repeat": {
        const body = this.block(statement.body);
        const until =
          statement.mode === "until" ? statement.condition : invertCondition(statement.condition);
        const { code, setup } = this.condition(until);
        if (setup.length === 0) {
          return ["do {", ...body, `} while (${this.expression(invertCondition(until)).code});`];
        }
        return [
          "while (true) {",
          ...body,
          ...[...setup, `if (${code.code}) break;`].map((line) => INDENT + line),
          "}",
        ];
      }
      case "for":
        return this.forStatement(statement);
      case "forEach":
        return this.forEach(statement);
      case "switch":
        return this.switchStatement(statement);
      case "expression": {
        const expression = statement.expression;
        if (expression.kind === "identifier" && !this.context.scope.vars.has(normalizeName(expression.name))) {
          return [`${this.call(expression.name, []).code};`];
        }
        if (expression.kind === "call") return [`${this.expression(expression).code};`];
        // Java has no expression statements other than calls and assignments.
        return this.comments ? [`// ${this.expression(expression).code}`] : [];
      }
      case "clear":
        return [
          `System.out.print("\\033[2J\\033[H");${this.comments ? " // secuencia ANSI que borra la terminal" : ""}`,
        ];
      case "wait":
        if (statement.mode === "key") {
          this.uses.add("leer");
          return [`leer();${this.comments ? " // espera un Enter, no cualquier tecla" : ""}`];
        }
        this.uses.add("esperar");
        return [`esperar(${this.expression(statement.durationMs!).code});`];
      case "return": {
        if (!this.context.routine) return ["return;"];
        if (!statement.expression || !this.context.returnType) return ["return;"];
        return [`return ${this.converted(statement.expression, resolveType(this.context.returnType))};`];
      }
    }
  }

  private ifStatement(statement: Extract<StatementNode, { kind: "if" }>): string[] {
    const { code, setup } = this.condition(statement.condition);
    const lines = [...setup, `if (${code.code}) {`, ...this.block(statement.thenBranch)];
    let otherwise = statement.elseBranch;
    while (otherwise.length === 1 && otherwise[0].kind === "if") {
      const nested = otherwise[0];
      const next = this.condition(nested.condition);
      if (next.setup.length > 0) break;
      lines.push(`} else if (${next.code.code}) {`, ...this.block(nested.thenBranch));
      otherwise = nested.elseBranch;
    }
    if (otherwise.length > 0) lines.push("} else {", ...this.block(otherwise));
    lines.push("}");
    return lines;
  }

  private dimension(statement: Extract<StatementNode, { kind: "dimension" }>): string[] {
    const lines: string[] = [];
    for (const item of statement.items) {
      const info = this.context.scope.vars.get(normalizeName(item.name));
      if (!info?.array) continue;
      const name = this.name(item.name);
      const base = this.baseType(info.type);
      const sizes = item.dimensions.map((dimension) => this.integer(dimension).code);
      if (statement.resize) {
        if (sizes.length > 2) {
          this.warn(statement, "EXPORT_RESIZE_DIMENSIONS", item.name);
          lines.push(`// Redimensionar ${item.name}: no se pudo traducir`);
          continue;
        }
        if (info.param) {
          this.warn(statement, "EXPORT_RESIZE_PARAMETER", item.name);
        }
        this.uses.add("redimensionar");
        this.resizers.set(`${base}${sizes.length}`, { type: base, dims: sizes.length });
        lines.push(`${name} = redimensionar(${name}, ${sizes.join(", ")});`);
        continue;
      }
      const declaration = this.context.declaredAtSite.has(info.key) ? `${this.javaType(info)} ` : "";
      lines.push(`${declaration}${name} = new ${base}${sizes.map((size) => `[${size}]`).join("")};`);
      if (base === "String") lines.push(...this.fillWithEmpty(name, sizes.length));
    }
    return lines;
  }

  /** New String arrays hold null: start them with "" like PSeInt. */
  private fillWithEmpty(name: string, dims: number): string[] {
    this.uses.add("arrays");
    const lines: string[] = [];
    let row = name;
    for (let index = 0; index < dims - 1; index += 1) {
      const next = this.temp("fila");
      lines.push(`${INDENT.repeat(index)}for (String${"[]".repeat(dims - 1 - index)} ${next} : ${row}) {`);
      row = next;
    }
    lines.push(`${INDENT.repeat(dims - 1)}Arrays.fill(${row}, "");`);
    for (let index = dims - 2; index >= 0; index -= 1) lines.push(`${INDENT.repeat(index)}}`);
    return lines;
  }

  private warn(statement: StatementNode, code: "EXPORT_RESIZE_DIMENSIONS" | "EXPORT_RESIZE_PARAMETER", name: string): void {
    this.diagnostics.push({
      message: engineMessage(code, { name }),
      line: statement.span?.start.line ?? 0,
      column: statement.span?.start.column ?? 0,
      severity: "warning",
      code,
      params: { name },
    });
  }

  private write(args: ExpressionNode[], newline: boolean): string[] {
    const method = newline ? "println" : "print";
    if (args.length === 0) return newline ? ["System.out.println();"] : [];
    const saved = [this.pre, this.post];
    const parts = args.map((arg) => {
      this.pre = [];
      this.post = [];
      return { piece: this.printable(arg), pre: this.pre, post: this.post };
    });
    [this.pre, this.post] = saved;
    if (parts.some((part) => part.pre.length > 0 || part.post.length > 0)) {
      // A call changes by-reference arguments: print piece by piece so the
      // values around it are read when PSeInt reads them.
      const lines = parts.flatMap((part) => [
        ...part.pre,
        `System.out.print(${part.piece.code});`,
        ...part.post,
      ]);
      return newline ? [...lines, "System.out.println();"] : lines;
    }
    const pieces = parts.map((part) => part.piece);
    // Two numbers in a row would be added, not concatenated.
    if (pieces.length > 1 && pieces[0].kind === "int" && pieces[1].kind === "int") {
      pieces[0] = { ...pieces[0], code: `String.valueOf(${pieces[0].code})`, prec: PREC.primary };
    }
    const code = pieces
      .map((piece, index) => (index === 0 ? piece.code : wrap(piece, PREC.additive + 1)))
      .join(" + ");
    return [`System.out.${method}(${code});`];
  }

  /** A value as PSeInt writes it: reals rounded to 10 decimals, VERDADERO/FALSO. */
  private printable(arg: ExpressionNode): Rendered & { kind: InferredType } {
    const kind = this.kind(arg);
    const rendered = this.expression(arg);
    if (kind === "double" || kind === "bool") {
      return { code: this.texto(rendered), prec: PREC.primary, kind: "string" };
    }
    return { ...rendered, kind };
  }

  private texto(rendered: Rendered): string {
    this.uses.add("texto");
    return `texto(${rendered.code})`;
  }

  private asText(expression: ExpressionNode): Rendered {
    const kind = this.kind(expression);
    const rendered = this.expression(expression);
    if (kind === "string") return rendered;
    if (kind === "int") return { code: `String.valueOf(${rendered.code})`, prec: PREC.primary };
    return { code: this.texto(rendered), prec: PREC.primary };
  }

  private readValue(target: AssignableExpressionNode): string {
    switch (this.kind(target)) {
      case "int":
        this.uses.add("leer_entero");
        return "leerEntero()";
      case "double":
        this.uses.add("leer_real");
        return "leerReal()";
      case "bool":
        this.uses.add("leer_logico");
        return "leerLogico()";
      default:
        this.uses.add("leer");
        return "leer()";
    }
  }

  /** A value converted for a target of the given type (reals to int). */
  private converted(value: ExpressionNode, target: InferredType): string {
    const rendered = this.expression(value);
    if (target === "int" && this.kind(value) === "double") return `(int) ${wrap(rendered, PREC.unary)}`;
    return rendered.code;
  }

  private forStatement(statement: Extract<StatementNode, { kind: "for" }>): string[] {
    const counter = this.expression({ kind: "identifier", name: statement.variable }).code;
    const start = this.converted(statement.start, this.kind({ kind: "identifier", name: statement.variable }));
    const end = this.expression(statement.end);
    const endCode = wrap(end, PREC.relational + 1);
    const descending = forDirection(statement, this.settings);
    const stepValue = statement.step ? evaluateConstant(statement.step) : descending ? -1 : 1;

    let header: string;
    if (descending === null || stepValue === null) {
      // The direction is only known at run time.
      const step = statement.step
        ? wrap(this.expression(statement.step), PREC.relational + 1)
        : `(${wrap(this.expression(statement.start), PREC.relational + 1)} <= ${endCode} ? 1 : -1)`;
      header = `for (${counter} = ${start}; (${step} > 0 ? ${counter} <= ${endCode} : ${counter} >= ${endCode}); ${counter} += ${step}) {`;
    } else {
      const condition = `${counter} ${descending ? ">=" : "<="} ${endCode}`;
      const magnitude = Math.abs(stepValue);
      const update =
        magnitude === 1
          ? `${counter}${descending ? "--" : "++"}`
          : `${counter} ${descending ? "-=" : "+="} ${magnitude}`;
      header = `for (${counter} = ${start}; ${condition}; ${update}) {`;
    }
    const setup = [...this.pre, ...this.post];
    this.pre = [];
    this.post = [];
    return [...setup, header, ...this.block(statement.body), "}"];
  }

  private forEach(statement: Extract<StatementNode, { kind: "forEach" }>): string[] {
    const scope = this.context.scope;
    const alias = scope.vars.get(normalizeName(statement.variable))!;
    const collection =
      statement.collection.kind === "identifier"
        ? scope.vars.get(normalizeName(statement.collection.name))
        : undefined;
    if (!collection?.array) {
      this.diagnostics.push({
        message: engineMessage("EXPORT_FOREACH", { name: statement.variable }),
        line: statement.span?.start.line ?? 0,
        column: statement.span?.start.column ?? 0,
        severity: "warning",
        code: "EXPORT_FOREACH",
        params: { name: statement.variable },
      });
      return [`// Para Cada ${statement.variable}: no se pudo traducir`];
    }

    const depth = collection.array.dims.length;
    const base = this.baseType(collection.type);
    const lines: string[] = [];
    let element = this.expression(statement.collection).code;
    let aliasCode: string | null = null;
    if (alias.forEachAlias && !writesVariable(statement.body, alias.key, this.inference)) {
      for (let index = 0; index < depth; index += 1) {
        const last = index === depth - 1;
        const item = last ? this.name(alias.name) : this.temp(`${this.name(collection.name)}_fila`);
        lines.push(`${INDENT.repeat(index)}for (${base}${"[]".repeat(depth - 1 - index)} ${item} : ${element}) {`);
        element = item;
      }
    } else {
      // The body changes the element (or the alias is also a variable of
      // its own): walk the indices and use the element itself.
      for (let index = 0; index < depth; index += 1) {
        const counter = this.temp(`${this.name(collection.name)}_${"ijklmn"[index] ?? `i${index}`}`);
        lines.push(`${INDENT.repeat(index)}for (int ${counter} = 0; ${counter} < ${element}.length; ${counter}++) {`);
        element = `${element}[${counter}]`;
      }
      aliasCode = element;
    }

    const previous = this.aliases.get(alias.key);
    if (aliasCode) this.aliases.set(alias.key, aliasCode);
    const body = this.block(statement.body);
    if (previous === undefined) this.aliases.delete(alias.key);
    else this.aliases.set(alias.key, previous);
    const close = Array.from({ length: depth }, (_, index) => `${INDENT.repeat(depth - 1 - index)}}`);
    return [...lines, ...body.map((line) => INDENT.repeat(depth - 1) + line), ...close];
  }

  private switchStatement(statement: SwitchStatementNode): string[] {
    const kind = this.kind(statement.expression);
    const values = statement.cases.flatMap((switchCase) => switchCase.values);
    const intCases = values.every((value) => {
      const constant = evaluateConstant(value);
      return constant !== null && Number.isInteger(constant);
    });
    const textCases = values.every((value) => value.kind === "literal" && value.valueType === "string");
    if ((kind === "int" && intCases) || (kind === "string" && textCases)) {
      const lines = [`switch (${this.expression(statement.expression).code}) {`];
      for (const switchCase of statement.cases) {
        for (const value of switchCase.values) lines.push(`${INDENT}case ${this.expression(value).code}:`);
        lines.push(...this.block(switchCase.body).map((line) => INDENT + line));
        lines.push(`${INDENT}${INDENT}break;`);
      }
      if (statement.defaultCase.length > 0) {
        lines.push(`${INDENT}default:`, ...this.block(statement.defaultCase).map((line) => INDENT + line));
      }
      lines.push("}");
      return lines;
    }

    // switch only takes integers and texts: use an if/else chain.
    if (statement.cases.length === 0) return statement.defaultCase.flatMap((child) => this.statement(child));
    let control = statement.expression;
    const lines: string[] = [];
    let temp: string | null = null;
    if (containsCall(control)) {
      temp = this.temp("opcion");
      lines.push(`${this.baseType(this.typeOf(control))} ${temp} = ${this.expression(control).code};`);
      this.aliases.set(normalizeName(temp), temp);
      control = { kind: "identifier", name: temp };
    }
    statement.cases.forEach((switchCase, index) => {
      const condition = switchCase.values
        .map((value) => {
          // Typed as the original expression, not as the auxiliary variable.
          const rendered = this.binary("=", control, value, statement.expression);
          return switchCase.values.length > 1 ? wrap(rendered, PREC.or + 1) : rendered.code;
        })
        .join(" || ");
      lines.push(`${index === 0 ? "" : "} else "}if (${condition}) {`, ...this.block(switchCase.body));
    });
    if (statement.defaultCase.length > 0) lines.push("} else {", ...this.block(statement.defaultCase));
    lines.push("}");
    if (temp) this.aliases.delete(normalizeName(temp));
    return lines;
  }

  private temp(base: string): string {
    let name = base;
    for (let index = 2; this.context.names.has(name); index += 1) name = `${base}${index}`;
    this.context.names.add(name);
    return name;
  }

  // ---------------------------------------------------------------------------
  // Expressions

  private typeOf(expression: ExpressionNode): InferredType {
    return this.inference.typeOf(expression, this.context.scope);
  }

  /** Whether the expression has type int once translated. */
  private isInt(expression: ExpressionNode): boolean {
    if (this.typeOf(expression) === "int") return true;
    switch (expression.kind) {
      case "literal":
        return (
          typeof expression.value === "number" &&
          Number.isInteger(expression.value) &&
          Math.abs(expression.value) <= 2147483647
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

  private integer(expression: ExpressionNode, delta = 0): Rendered {
    const rendered = this.expression(offsetExpression(expression, delta));
    return this.isInt(expression) ? rendered : { code: `(int) ${wrap(rendered, PREC.unary)}`, prec: PREC.unary };
  }

  private index(expression: ExpressionNode): Rendered {
    return this.integer(expression, this.settings.baseZeroArrays ? 0 : -1);
  }

  expression(expression: ExpressionNode): Rendered {
    switch (expression.kind) {
      case "literal": {
        if (expression.valueType === "string") {
          return { code: escapeString(String(expression.value)), prec: PREC.primary };
        }
        if (expression.valueType === "boolean") {
          return { code: expression.value ? "true" : "false", prec: PREC.primary };
        }
        const value = expression.value as number;
        let code = String(value);
        // Integers beyond int's range are written as double literals.
        if (Number.isInteger(value) && Math.abs(value) > 2147483647 && !/[.e]/.test(code)) code += ".0";
        return { code, prec: value < 0 ? PREC.unary : PREC.primary };
      }
      case "group":
        return { code: `(${this.expression(expression.expression).code})`, prec: PREC.primary };
      case "identifier":
        return this.identifier(expression.name);
      case "arrayAccess": {
        const base =
          expression.target.kind === "identifier"
            ? this.identifier(expression.target.name).code
            : wrap(this.expression(expression.target), PREC.primary);
        const indices = expression.indices.map((index) => `[${this.index(index).code}]`).join("");
        return { code: `${base}${indices}`, prec: PREC.primary };
      }
      case "call":
        return this.call(expression.callee, expression.args);
      case "unary": {
        const operand = this.expression(expression.operand);
        const operator = expression.operator === "-" ? "-" : "!";
        // `- -x` must not become the decrement operator.
        const code = operand.code.startsWith("-") ? `(${operand.code})` : wrap(operand, PREC.unary);
        return { code: `${operator}${code}`, prec: PREC.unary };
      }
      case "binary":
        return this.binary(expression.operator, expression.left, expression.right);
    }
  }

  private identifier(name: string): Rendered {
    const key = normalizeName(name);
    const alias = this.aliases.get(key);
    if (alias) return { code: alias, prec: PREC.primary };
    if (!this.context.scope.vars.has(key)) {
      if (this.inference.findRoutine(name)) return this.call(name, []);
      if (isConstantBuiltin(name)) return this.constant(name);
    }
    const code = this.name(name);
    return { code: this.isHolder(key) ? `${code}[0]` : code, prec: PREC.primary };
  }

  private constant(name: string): Rendered {
    return { code: normalizeBuiltinName(name) === "PI" ? "Math.PI" : "Math.E", prec: PREC.primary };
  }

  private call(callee: string, args: ExpressionNode[]): Rendered {
    if (args.length === 0 && isConstantBuiltin(callee)) return this.constant(callee);
    const routine = this.inference.findRoutine(callee);
    if (routine) return this.routineCall(routine, args);
    const builtin = this.builtin(normalizeBuiltinName(callee), args);
    if (builtin) return builtin;
    return {
      code: `${this.name(callee)}(${args.map((arg) => this.expression(arg).code).join(", ")})`,
      prec: PREC.primary,
    };
  }

  private routineCall(routine: RoutineNode, args: ExpressionNode[]): Rendered {
    const calleeScope = this.types.routines.get(normalizeName(routine.name))!;
    const rendered = args.map((arg, index) => {
      const param = routine.params[index];
      const info = param ? calleeScope.vars.get(normalizeName(param.name)) : undefined;
      if (!param || !info || info.array) return this.expression(arg).code;
      const type = resolveType(info.type);
      if (!param.byReference) return this.converted(arg, type);
      if (arg.kind === "identifier" && this.isHolder(normalizeName(arg.name))) return this.name(arg.name);
      // Copy the value into a one-element array and back after the call.
      const holder = this.temp("ref");
      this.pre.push(`${this.baseType(info.type)}[] ${holder} = {${this.converted(arg, type)}};`);
      if (isAssignable(arg)) {
        const back = this.kind(arg) === "int" && type === "double" ? `(int) ${holder}[0]` : `${holder}[0]`;
        this.post.push(`${this.expression(arg).code} = ${back};`);
      }
      return holder;
    });
    return { code: `${this.name(routine.name)}(${rendered.join(", ")})`, prec: PREC.primary };
  }

  private binary(
    operator: string,
    left: ExpressionNode,
    right: ExpressionNode,
    typedAs?: ExpressionNode
  ): Rendered {
    const leftKind = this.kind(typedAs ?? left);
    const rightKind = this.kind(right);
    const isText = leftKind === "string" || rightKind === "string";

    if (operator === "+" && isText) {
      return {
        code: `${wrap(this.asText(left), PREC.additive)} + ${wrap(this.asText(right), PREC.additive + 1)}`,
        prec: PREC.additive,
      };
    }
    if (isText && ["=", "<>", "<", ">", "<=", ">="].includes(operator)) {
      const leftCode = wrap(this.asText(left), PREC.primary);
      const rightCode = this.asText(right).code;
      if (operator === "=") return { code: `${leftCode}.equals(${rightCode})`, prec: PREC.primary };
      if (operator === "<>") return { code: `!${leftCode}.equals(${rightCode})`, prec: PREC.unary };
      return { code: `${leftCode}.compareTo(${rightCode}) ${operator} 0`, prec: PREC.relational };
    }
    if (operator === "^") {
      return {
        code: `Math.pow(${this.expression(left).code}, ${this.expression(right).code})`,
        prec: PREC.primary,
      };
    }

    const [symbol, prec] = OPERATORS[operator] ?? [operator, PREC.primary];
    let leftCode = this.expression(left);
    if (operator === "/" && this.isInt(left) && this.isInt(right)) {
      // PSeInt division is always real, Java's int division is not.
      leftCode =
        left.kind === "literal"
          ? { code: `${leftCode.code}.0`, prec: PREC.primary }
          : { code: `(double) ${wrap(leftCode, PREC.unary)}`, prec: PREC.unary };
    }
    return {
      code: `${wrap(leftCode, prec)} ${symbol} ${wrap(this.expression(right), prec + 1)}`,
      prec,
    };
  }

  private builtin(name: string, args: ExpressionNode[]): Rendered | null {
    const arg = (index: number) => this.expression(args[index]).code;
    const math = (fn: string): Rendered => ({ code: `Math.${fn}(${arg(0)})`, prec: PREC.primary });
    const helper = (fn: string, use: string): Rendered => {
      this.uses.add(use);
      return { code: `${fn}(${args.map((_, index) => arg(index)).join(", ")})`, prec: PREC.primary };
    };
    const text = (index: number) => wrap(this.asText(args[index]), PREC.primary);
    switch (name) {
      case "RC":
      case "RAIZ":
        return math("sqrt");
      case "ABS":
        return math("abs");
      case "LN":
        return math("log");
      case "EXP":
        return math("exp");
      case "SEN":
      case "SIN":
        return math("sin");
      case "COS":
        return math("cos");
      case "TAN":
        return math("tan");
      case "ASEN":
      case "ASIN":
        return math("asin");
      case "ACOS":
        return math("acos");
      case "ATAN":
        return math("atan");
      case "TRUNC":
        return helper("truncar", "truncar");
      case "REDON":
        return helper("redondear", "redondear");
      case "FECHAACTUAL":
        return helper("fechaActual", "fecha_actual");
      case "HORAACTUAL":
        return helper("horaActual", "hora_actual");
      case "AZAR":
        return {
          code: `(int) (Math.random() * ${wrap(this.integer(args[0]), PREC.multiplicative + 1)})`,
          prec: PREC.unary,
        };
      case "ALEATORIO": {
        const low = wrap(this.integer(args[0]), PREC.additive);
        const high = wrap(this.integer(args[1]), PREC.additive);
        return {
          code: `${low} + (int) (Math.random() * (${high} - ${low} + 1))`,
          prec: PREC.additive,
        };
      }
      case "LONGITUD":
        return { code: `${text(0)}.length()`, prec: PREC.primary };
      case "MAYUSCULAS":
        return { code: `${text(0)}.toUpperCase()`, prec: PREC.primary };
      case "MINUSCULAS":
        return { code: `${text(0)}.toLowerCase()`, prec: PREC.primary };
      case "SUBCADENA": {
        const base = this.settings.baseZeroArrays ? 0 : -1;
        const from = this.integer(args[1], base).code;
        const to = this.integer(args[2], base + 1).code;
        return { code: `${text(0)}.substring(${from}, ${to})`, prec: PREC.primary };
      }
      case "CONCATENAR":
        return {
          code: `${wrap(this.asText(args[0]), PREC.additive)} + ${wrap(this.asText(args[1]), PREC.additive + 1)}`,
          prec: PREC.additive,
        };
      case "CONVERTIRANUMERO":
        return { code: `Double.parseDouble(${text(0)}.trim())`, prec: PREC.primary };
      case "CONVERTIRATEXTO":
        return this.asText(args[0]);
      default:
        return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Header, fields and helpers

  private header(): string[] {
    const uses = this.uses;
    const lines: string[] = [];
    if (this.comments) {
      lines.push(
        "// Este código fue generado por Codoritmo a partir del pseudocódigo.",
        "// Puede que no sea completamente correcto: revíselo antes de usarlo."
      );
    }
    const reads = ["leer", "leer_entero", "leer_real", "leer_logico"].some((use) => uses.has(use));
    const imports: string[] = [];
    if (reads) {
      imports.push("import java.io.BufferedReader;", "import java.io.IOException;", "import java.io.InputStreamReader;");
    }
    if (uses.has("texto")) imports.push("import java.math.BigDecimal;", "import java.math.RoundingMode;");
    if (uses.has("fecha_actual")) imports.push("import java.time.LocalDate;");
    if (uses.has("hora_actual")) imports.push("import java.time.LocalTime;");
    if (uses.has("arrays") || this.resizers.size > 0) imports.push("import java.util.Arrays;");
    if (imports.length > 0) {
      if (lines.length > 0) lines.push("");
      lines.push(...imports);
    }
    if (uses.has("sin_tipo") && this.comments) {
      lines.push(
        "",
        "// No se pudo determinar el tipo de algunas variables: se declaran como",
        "// String. Reemplácelo por el tipo adecuado (int, double o boolean)."
      );
    }
    if (lines.length > 0) lines.push("");
    return lines;
  }

  private fields(): string[][] {
    const reads = ["leer", "leer_entero", "leer_real", "leer_logico"].some((use) => this.uses.has(use));
    if (!reads) return [];
    return [["static BufferedReader entrada = new BufferedReader(new InputStreamReader(System.in));"]];
  }

  private helpers(): string[][] {
    const uses = this.uses;
    const comment = (...text: string[]) => (this.comments ? text.map((line) => `// ${line}`) : []);
    const body = (...lines: string[]) => lines.map((line) => INDENT + line);
    const blocks: string[][] = [];
    if (["leer", "leer_entero", "leer_real", "leer_logico"].some((use) => uses.has(use))) {
      blocks.push([
        ...comment("Lee una línea de la entrada."),
        "static String leer() {",
        ...body(
          "try {",
          `${INDENT}String linea = entrada.readLine();`,
          `${INDENT}return linea == null ? "" : linea;`,
          "} catch (IOException e) {",
          `${INDENT}return "";`,
          "}"
        ),
        "}",
      ]);
    }
    if (uses.has("leer_entero")) {
      blocks.push(["static int leerEntero() {", ...body("return Integer.parseInt(leer().trim());"), "}"]);
    }
    if (uses.has("leer_real")) {
      blocks.push(["static double leerReal() {", ...body("return Double.parseDouble(leer().trim());"), "}"]);
    }
    if (uses.has("leer_logico")) {
      blocks.push([
        ...comment("Lee VERDADERO o FALSO (también V, F, 1 o 0)."),
        "static boolean leerLogico() {",
        ...body(
          "String valor = leer().trim().toUpperCase();",
          'return valor.equals("VERDADERO") || valor.equals("V") || valor.equals("1");'
        ),
        "}",
      ]);
    }
    if (uses.has("texto")) {
      blocks.push([
        ...comment(
          "Escribe un número como PSeInt: redondeado a 10 decimales, sin ceros",
          "finales y sin notación exponencial."
        ),
        "static String texto(double valor) {",
        ...body(
          "if (Double.isNaN(valor) || Double.isInfinite(valor)) return String.valueOf(valor);",
          "return new BigDecimal(valor).setScale(10, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString();"
        ),
        "}",
        "",
        "static String texto(boolean valor) {",
        ...body('return valor ? "VERDADERO" : "FALSO";'),
        "}",
      ]);
    }
    if (uses.has("truncar")) {
      blocks.push([
        ...comment(
          "Como trunc() de PSeInt: un valor a menos de 1e-11 del entero siguiente",
          "se trunca a ese entero, así trunc(100*0.57) da 57 y no 56."
        ),
        "static int truncar(double x) {",
        ...body("int t = (int) x;", "if (t + 1 - x < 1e-11) return t + 1;", "if (t - 1 - x > -1e-11) return t - 1;", "return t;"),
        "}",
      ]);
    }
    if (uses.has("redondear")) {
      blocks.push([
        ...comment("Como redon() de PSeInt: redondea alejándose de cero (-2.5 da -3)."),
        "static int redondear(double x) {",
        ...body("return (int) (x < 0 ? x - 0.5 : x + 0.5);"),
        "}",
      ]);
    }
    if (uses.has("fecha_actual")) {
      blocks.push([
        ...comment("Fecha actual como el número AAAAMMDD."),
        "static int fechaActual() {",
        ...body("LocalDate hoy = LocalDate.now();", "return hoy.getYear() * 10000 + hoy.getMonthValue() * 100 + hoy.getDayOfMonth();"),
        "}",
      ]);
    }
    if (uses.has("hora_actual")) {
      blocks.push([
        ...comment("Hora actual como el número HHMMSS."),
        "static int horaActual() {",
        ...body("LocalTime ahora = LocalTime.now();", "return ahora.getHour() * 10000 + ahora.getMinute() * 100 + ahora.getSecond();"),
        "}",
      ]);
    }
    if (uses.has("esperar")) {
      blocks.push([
        "static void esperar(double milisegundos) {",
        ...body(
          "try {",
          `${INDENT}Thread.sleep((long) milisegundos);`,
          "} catch (InterruptedException e) {",
          `${INDENT}Thread.currentThread().interrupt();`,
          "}"
        ),
        "}",
      ]);
    }
    let first = true;
    for (const { type, dims } of this.resizers.values()) {
      const fill = type === "String";
      const lines = first
        ? comment("Redimensionar: un arreglo nuevo con los valores que siguen dentro.")
        : [];
      first = false;
      if (dims === 1) {
        lines.push(
          `static ${type}[] redimensionar(${type}[] viejo, int n) {`,
          ...body(
            `${type}[] nuevo = new ${type}[n];`,
            ...(fill ? ['Arrays.fill(nuevo, "");'] : []),
            "System.arraycopy(viejo, 0, nuevo, 0, Math.min(viejo.length, n));",
            "return nuevo;"
          ),
          "}"
        );
      } else {
        lines.push(
          `static ${type}[][] redimensionar(${type}[][] viejo, int n, int m) {`,
          ...body(
            `${type}[][] nuevo = new ${type}[n][m];`,
            "for (int i = 0; i < n; i++) {",
            ...(fill ? [`${INDENT}Arrays.fill(nuevo[i], "");`] : []),
            `${INDENT}if (i < viejo.length) System.arraycopy(viejo[i], 0, nuevo[i], 0, Math.min(viejo[i].length, m));`,
            "}",
            "return nuevo;"
          ),
          "}"
        );
      }
      blocks.push(lines);
    }
    return blocks;
  }
}
