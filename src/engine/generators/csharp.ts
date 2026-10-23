import type {
  AssignableExpressionNode,
  ExpressionNode,
  ProgramNode,
  RoutineNode,
  StatementNode,
  SwitchStatementNode,
} from "../types";
import { containsCall, escapeString, invertCondition, isAssignable, makeIdentifier, writesVariable } from "./shared";
import { Rendered, StructuredGenerator, ValueKind, wrap } from "./structured";
import { normalizeName, ScopeTypes, VariableInfo } from "./type-inference";

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

// Helpers and library members are PascalCase; translated names are always
// lowercase, so only the language's keywords can clash.
const RESERVED = new Set(
  `abstract as base bool break byte case catch char checked class const continue
  decimal default delegate do double else enum event explicit extern false finally
  fixed float for foreach goto if implicit in int interface internal is lock long
  namespace new null object operator out override params private protected public
  readonly ref return sbyte sealed short sizeof stackalloc static string struct
  switch this throw true try typeof uint ulong unchecked unsafe ushort using virtual
  void volatile while var dynamic yield async await nameof when value args`.split(/\s+/)
);

/** Library classes the generated code refers to, which the class name must avoid. */
const LIBRARY_CLASSES = new Set("Math String Console Thread DateTime Random CultureInfo Array".split(" "));

/**
 * Exports pseudocode to C#: one class with a static method per subprocess,
 * typed with the shared type inference. By-reference parameters use `ref`;
 * arrays are rectangular (`double[,]`), shared with the subprocesses that
 * receive them like in PSeInt.
 */
export class CSharpGenerator extends StructuredGenerator {
  protected readonly reserved = RESERVED;
  protected readonly prec = PREC;
  private resizers = new Set<number>();

  protected render(program: ProgramNode): string[] {
    this.resizers = new Set();
    const methods = [
      this.routine(null, program.entry.body, this.types.main),
      ...program.routines.map((routine) => this.routine(routine, routine.body, this.scopeOf(routine))),
    ];

    let className = makeIdentifier(program.entry.name, RESERVED).replace(/^_+/, "");
    className = className ? className[0].toUpperCase() + className.slice(1) : "Programa";
    if (LIBRARY_CLASSES.has(className)) className += "_";

    const members = [...this.fields(), ...methods, ...this.helpers()];
    const lines = [...this.header(), `class ${className}`, "{"];
    members.forEach((member, index) => {
      if (index > 0) lines.push("");
      lines.push(...member.map((line) => (line ? this.indent + line : line)));
    });
    lines.push("}");
    return lines;
  }

  // ---------------------------------------------------------------------------
  // Methods and declarations

  private routine(routine: RoutineNode | null, statements: StatementNode[], scope: ScopeTypes): string[] {
    const context = this.enter(routine, statements, scope);
    let header: string;
    if (!routine) {
      header = "static void Main()";
    } else {
      const params = routine.params.map((param) => {
        const info = scope.vars.get(normalizeName(param.name))!;
        const ref = param.byReference && !info.array ? "ref " : "";
        return `${ref}${this.typeName(info)} ${this.name(param.name)}`;
      });
      const type = context.returnType ? this.baseType(this.kindOf(context.returnType)) : "void";
      header = `static ${type} ${this.routineName(routine)}(${params.join(", ")})`;
    }

    const body: string[] = [];
    for (const info of this.locals({ skipAliases: true })) {
      if (context.declaredAtSite.has(info.key)) continue;
      const name = this.name(info.name);
      body.push(
        info.array
          ? `${this.typeName(info)} ${name} = null;`
          : `${this.baseType(this.variableKind(info))} ${name} = ${this.defaultValue(this.variableKind(info))};`
      );
    }
    body.push(...this.block(statements, 0));
    const last = statements[statements.length - 1];
    if (routine && context.returnType && last?.kind !== "return") {
      body.push(
        `return ${context.returnInfo ? this.identifier(context.returnInfo.name).code : this.defaultValue(this.kindOf(context.returnType))};`
      );
    }
    return [header, "{", ...body.map((line) => (line ? this.indent + line : line)), "}"];
  }

  private baseType(kind: ValueKind): string {
    return { int: "int", double: "double", bool: "bool", string: "string" }[kind];
  }

  private typeName(info: VariableInfo): string {
    if (this.typeOf({ kind: "identifier", name: info.name }) === "unknown") this.uses.add("sin_tipo");
    const base = this.baseType(this.variableKind(info));
    if (!info.array) return base;
    return `${base}[${",".repeat(info.array.dims.length - 1)}]`;
  }

  private defaultValue(kind: ValueKind): string {
    return { int: "0", double: "0.0", bool: "false", string: '""' }[kind];
  }

  // ---------------------------------------------------------------------------
  // Statements

  private braces(header: string, body: string[]): string[] {
    return [header, "{", ...body, "}"];
  }

  /** A condition plus the statements that must run right before testing it. */
  private condition(expression: ExpressionNode): { code: string; setup: string[] } {
    const { value, pre, post } = this.capture(() => this.expression(expression));
    if (post.length === 0) return { code: value.code, setup: pre };
    const temp = this.temp("condicion");
    return { code: temp, setup: [...pre, `bool ${temp} = ${value.code};`, ...post] };
  }

  protected statementLines(statement: StatementNode): string[] {
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
        const exit = this.condition(invertCondition(statement.condition));
        if (exit.setup.length === 0) {
          return this.braces(`while (${this.expression(statement.condition).code})`, this.block(statement.body));
        }
        return this.braces("while (true)", [
          ...[...exit.setup, `if (${exit.code}) break;`].map((line) => this.indent + line),
          ...this.block(statement.body),
        ]);
      }
      case "repeat": {
        const body = this.block(statement.body);
        const until = statement.mode === "until" ? statement.condition : invertCondition(statement.condition);
        const exit = this.condition(until);
        if (exit.setup.length === 0) {
          return ["do", "{", ...body, `} while (${this.expression(invertCondition(until)).code});`];
        }
        return this.braces("while (true)", [
          ...body,
          ...[...exit.setup, `if (${exit.code}) break;`].map((line) => this.indent + line),
        ]);
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
        return this.comments ? [`// ${this.expression(expression).code}`] : [];
      }
      case "clear":
        return ["Console.Clear();"];
      case "wait":
        if (statement.mode === "key") return ["Console.ReadKey(true);"];
        this.uses.add("threading");
        return [`Thread.Sleep(${this.integer(statement.durationMs!).code});`];
      case "return":
        if (!statement.expression || !this.context.returnType) return ["return;"];
        return [`return ${this.converted(statement.expression, this.kindOf(this.context.returnType))};`];
    }
  }

  private ifStatement(statement: Extract<StatementNode, { kind: "if" }>): string[] {
    const first = this.condition(statement.condition);
    const lines = [...first.setup, `if (${first.code})`, "{", ...this.block(statement.thenBranch), "}"];
    let otherwise = statement.elseBranch;
    while (otherwise.length === 1 && otherwise[0].kind === "if") {
      const nested = otherwise[0];
      const next = this.condition(nested.condition);
      if (next.setup.length > 0) break;
      lines.push(`else if (${next.code})`, "{", ...this.block(nested.thenBranch), "}");
      otherwise = nested.elseBranch;
    }
    if (otherwise.length > 0) lines.push("else", "{", ...this.block(otherwise), "}");
    return lines;
  }

  private dimension(statement: Extract<StatementNode, { kind: "dimension" }>): string[] {
    const lines: string[] = [];
    for (const item of statement.items) {
      const info = this.context.scope.vars.get(normalizeName(item.name));
      if (!info?.array) continue;
      const name = this.name(item.name);
      const kind = this.variableKind(info);
      const sizes = item.dimensions.map((dimension) => this.integer(dimension).code);
      if (statement.resize) {
        if (sizes.length > 2) {
          this.warn(statement, "EXPORT_RESIZE_DIMENSIONS", item.name);
          lines.push(`// Redimensionar ${item.name}: no se pudo traducir`);
          continue;
        }
        if (info.param) this.warn(statement, "EXPORT_RESIZE_PARAMETER", item.name);
        this.resizers.add(sizes.length);
        lines.push(`${name} = Redimensionar(${name}, ${sizes.join(", ")}, ${this.defaultValue(kind)});`);
        continue;
      }
      const declaration = this.context.declaredAtSite.has(info.key) ? `${this.typeName(info)} ` : "";
      lines.push(`${declaration}${name} = new ${this.baseType(kind)}[${sizes.join(", ")}];`);
      if (kind === "string") lines.push(...this.fillWithEmpty(name, sizes.length));
    }
    return lines;
  }

  /** New string arrays hold null: start them with "" like PSeInt. */
  private fillWithEmpty(name: string, dims: number): string[] {
    const counters = Array.from({ length: dims }, (_, index) => this.temp("ijklmn"[index] ?? `i${index}`));
    const lines = counters.map(
      (counter, index) =>
        `${this.indent.repeat(index)}for (int ${counter} = 0; ${counter} < ${name}.GetLength(${index}); ${counter}++)`
    );
    lines.push(`${this.indent.repeat(dims)}${name}[${counters.join(", ")}] = "";`);
    return lines;
  }

  private write(args: ExpressionNode[], newline: boolean): string[] {
    const method = newline ? "WriteLine" : "Write";
    if (args.length === 0) return newline ? ["Console.WriteLine();"] : [];
    const parts = args.map((arg) => this.capture(() => this.printable(arg)));
    if (parts.some((part) => part.pre.length > 0 || part.post.length > 0)) {
      const lines = parts.flatMap((part) => [...part.pre, `Console.Write(${part.value.code});`, ...part.post]);
      return newline ? [...lines, "Console.WriteLine();"] : lines;
    }
    const pieces = parts.map((part) => part.value);
    // Two numbers in a row would be added, not concatenated.
    if (pieces.length > 1 && pieces[0].kind !== "string" && pieces[1].kind !== "string") {
      pieces[0] = { code: `${wrap(pieces[0], PREC.primary)}.ToString()`, prec: PREC.primary, kind: "string" };
    }
    const code = pieces.map((piece, index) => (index === 0 ? piece.code : wrap(piece, PREC.additive + 1))).join(" + ");
    return [`Console.${method}(${code});`];
  }

  /** A value as PSeInt writes it: reals with up to 10 decimals, VERDADERO/FALSO. */
  private printable(arg: ExpressionNode): Rendered & { kind: ValueKind } {
    const kind = this.kind(arg);
    const rendered = this.expression(arg);
    if (kind === "double" || kind === "bool") return { code: this.texto(rendered), prec: PREC.primary, kind: "string" };
    return { ...rendered, kind };
  }

  private texto(rendered: Rendered): string {
    this.uses.add("texto");
    return `Texto(${rendered.code})`;
  }

  private asText(expression: ExpressionNode): Rendered {
    const kind = this.kind(expression);
    const rendered = this.expression(expression);
    if (kind === "string") return rendered;
    if (kind === "int") return { code: `${wrap(rendered, PREC.primary)}.ToString()`, prec: PREC.primary };
    return { code: this.texto(rendered), prec: PREC.primary };
  }

  private readValue(target: AssignableExpressionNode): string {
    switch (this.kind(target)) {
      case "int":
        return "int.Parse(Console.ReadLine())";
      case "double":
        this.uses.add("globalization");
        return "double.Parse(Console.ReadLine(), CultureInfo.InvariantCulture)";
      case "bool":
        this.uses.add("leer_logico");
        return "LeerLogico()";
      default:
        return "Console.ReadLine()";
    }
  }

  /** A value converted for a target of the given type (reals to int). */
  private converted(value: ExpressionNode, target: ValueKind): string {
    const rendered = this.expression(value);
    if (target === "int" && this.kind(value) === "double") return `(int) ${wrap(rendered, PREC.unary)}`;
    return rendered.code;
  }

  private forStatement(statement: Extract<StatementNode, { kind: "for" }>): string[] {
    const counterExpression: ExpressionNode = { kind: "identifier", name: statement.variable };
    const counter = this.expression(counterExpression).code;
    const start = this.converted(statement.start, this.kind(counterExpression));
    const endCode = wrap(this.expression(statement.end), PREC.relational + 1);
    const plan = this.forPlan(statement);
    let header: string;
    if (plan.step === null || plan.descending === null) {
      const step = statement.step
        ? wrap(this.expression(statement.step), PREC.relational + 1)
        : `(${wrap(this.expression(statement.start), PREC.relational + 1)} <= ${endCode} ? 1 : -1)`;
      header = `for (${counter} = ${start}; (${step} > 0 ? ${counter} <= ${endCode} : ${counter} >= ${endCode}); ${counter} += ${step})`;
    } else {
      const magnitude = Math.abs(plan.step);
      const update =
        magnitude === 1
          ? `${counter}${plan.descending ? "--" : "++"}`
          : `${counter} ${plan.descending ? "-=" : "+="} ${magnitude}`;
      header = `for (${counter} = ${start}; ${counter} ${plan.descending ? ">=" : "<="} ${endCode}; ${update})`;
    }
    const setup = [...this.pre, ...this.post];
    this.pre = [];
    this.post = [];
    return [...setup, ...this.braces(header, this.block(statement.body))];
  }

  private forEach(statement: Extract<StatementNode, { kind: "forEach" }>): string[] {
    const plan = this.forEachPlan(statement);
    if (!plan) return [`// Para Cada ${statement.variable}: no se pudo traducir`];
    const collection = this.expression(statement.collection).code;
    if (plan.alias.forEachAlias && !writesVariable(statement.body, plan.alias.key, this.inference)) {
      // foreach walks every element, also of a rectangular array.
      const type = this.baseType(this.variableKind(plan.collection));
      return this.braces(`foreach (${type} ${this.name(plan.alias.name)} in ${collection})`, this.block(statement.body));
    }
    // The body changes the element: walk the indices and use the element itself.
    const counters = this.forEachCounters(plan);
    const element = `${collection}[${counters.join(", ")}]`;
    const body = this.withAlias(plan.alias.key, element, () => this.block(statement.body, plan.depth - 1));
    const lines: string[] = [];
    counters.forEach((counter, index) => {
      const length = plan.depth === 1 ? `${collection}.Length` : `${collection}.GetLength(${index})`;
      lines.push(`${this.indent.repeat(index)}for (int ${counter} = 0; ${counter} < ${length}; ${counter}++)`);
    });
    const depth = this.indent.repeat(plan.depth - 1);
    return [...lines, `${depth}{`, ...body.map((line) => (line ? this.indent + line : line)), `${depth}}`];
  }

  private switchStatement(statement: SwitchStatementNode): string[] {
    if (this.switchCases(statement)) {
      const lines = [`switch (${this.expression(statement.expression).code})`, "{"];
      for (const switchCase of statement.cases) {
        lines.push(`${this.indent}${switchCase.values.map((value) => `case ${this.expression(value).code}:`).join(" ")}`);
        lines.push(...this.block(switchCase.body, 2), `${this.indent.repeat(2)}break;`);
      }
      if (statement.defaultCase.length > 0) {
        lines.push(`${this.indent}default:`, ...this.block(statement.defaultCase, 2), `${this.indent.repeat(2)}break;`);
      }
      lines.push("}");
      return lines;
    }
    if (statement.cases.length === 0) return statement.defaultCase.flatMap((child) => this.statement(child));
    let control = statement.expression;
    const lines: string[] = [];
    let temp: string | null = null;
    if (containsCall(control)) {
      temp = this.temp("opcion");
      lines.push(`${this.baseType(this.kind(control))} ${temp} = ${this.expression(control).code};`);
      control = { kind: "identifier", name: temp };
    }
    const branches = (): string[] => {
      const result: string[] = [];
      statement.cases.forEach((switchCase, index) => {
        const condition = switchCase.values
          .map((value) => {
            const rendered = this.binary("=", control, value, statement.expression);
            return switchCase.values.length > 1 ? wrap(rendered, PREC.or + 1) : rendered.code;
          })
          .join(" || ");
        result.push(`${index === 0 ? "" : "else "}if (${condition})`, "{", ...this.block(switchCase.body), "}");
      });
      if (statement.defaultCase.length > 0) result.push("else", "{", ...this.block(statement.defaultCase), "}");
      return result;
    };
    lines.push(...(temp ? this.withAlias(normalizeName(temp), temp, branches) : branches()));
    return lines;
  }

  // ---------------------------------------------------------------------------
  // Expressions

  protected toInteger(rendered: Rendered): Rendered {
    return { code: `(int) ${wrap(rendered, PREC.unary)}`, prec: PREC.unary };
  }

  protected stringLiteral(value: string): Rendered {
    // C# has no octal escapes: other control characters use \u.
    const code = [...value]
      .map((char) => {
        const point = char.charCodeAt(0);
        if (point >= 0x20 || "\n\r\t".includes(char)) return escapeString(char).slice(1, -1);
        return `\\u${point.toString(16).padStart(4, "0")}`;
      })
      .join("");
    return { code: `"${code}"`, prec: PREC.primary };
  }

  protected boolLiteral(value: boolean): Rendered {
    return { code: value ? "true" : "false", prec: PREC.primary };
  }

  protected numberLiteral(value: number): Rendered {
    let code = String(value);
    if (Number.isInteger(value) && Math.abs(value) > this.intLimit && !/[.e]/.test(code)) code += ".0";
    return { code, prec: value < 0 ? PREC.unary : PREC.primary };
  }

  protected arrayAccess(base: string, indices: Rendered[]): Rendered {
    return { code: `${base}[${indices.map((index) => index.code).join(", ")}]`, prec: PREC.primary };
  }

  protected unary(operator: string, operand: ExpressionNode): Rendered {
    const rendered = this.expression(operand);
    const symbol = operator === "-" ? "-" : "!";
    // `- -x` must not become the decrement operator.
    const code = rendered.code.startsWith("-") ? `(${rendered.code})` : wrap(rendered, PREC.unary);
    return { code: `${symbol}${code}`, prec: PREC.unary };
  }

  protected binary(operator: string, left: ExpressionNode, right: ExpressionNode, typedAs?: ExpressionNode): Rendered {
    const isText = this.kind(typedAs ?? left) === "string" || this.kind(right) === "string";
    if (operator === "+" && isText) {
      return this.infix(this.asText(left), "+", this.asText(right), PREC.additive);
    }
    if (isText && ["<", ">", "<=", ">="].includes(operator)) {
      return {
        code: `string.CompareOrdinal(${this.asText(left).code}, ${this.asText(right).code}) ${operator} 0`,
        prec: PREC.relational,
      };
    }
    if (isText && (operator === "=" || operator === "<>")) {
      return this.infix(this.asText(left), OPERATORS[operator][0], this.asText(right), PREC.equality);
    }
    if (operator === "^") return this.fn("Math.Pow", this.expression(left), this.expression(right));
    const [symbol, prec] = OPERATORS[operator] ?? [operator, PREC.primary];
    let leftCode = this.expression(left);
    if (operator === "/" && this.isInt(left) && this.isInt(right)) {
      // PSeInt division is always real, C#'s int division is not.
      leftCode =
        left.kind === "literal"
          ? { code: `${leftCode.code}.0`, prec: PREC.primary }
          : { code: `(double) ${wrap(leftCode, PREC.unary)}`, prec: PREC.unary };
    }
    return this.infix(leftCode, symbol, this.expression(right), prec);
  }

  protected constant(name: "PI" | "EULER"): Rendered {
    return { code: name === "PI" ? "Math.PI" : "Math.E", prec: PREC.primary };
  }

  protected routineCall(routine: RoutineNode, args: ExpressionNode[]): Rendered {
    const rendered = args.map((arg, index) => {
      const param = this.parameter(routine, index);
      if (!param || param.info.array) return this.expression(arg).code;
      const kind = this.variableKind(param.info);
      if (!param.byReference) return this.converted(arg, kind);
      if (!this.needsReferenceCopy(arg, kind)) return `ref ${this.expression(arg).code}`;
      // Copy the value into a variable of the parameter's type and back.
      const holder = this.temp("ref");
      this.pre.push(`${this.baseType(kind)} ${holder} = ${this.converted(arg, kind)};`);
      if (isAssignable(arg)) {
        const back = this.kind(arg) === "int" && kind === "double" ? `(int) ${holder}` : holder;
        this.post.push(`${this.expression(arg).code} = ${back};`);
      }
      return `ref ${holder}`;
    });
    return { code: `${this.routineName(routine)}(${rendered.join(", ")})`, prec: PREC.primary };
  }

  protected builtin(name: string, args: ExpressionNode[]): Rendered | null {
    const arg = (index: number) => this.expression(args[index]);
    const math = (fn: string) => this.fn(`Math.${fn}`, arg(0));
    const helper = (fn: string, use: string) => {
      this.uses.add(use);
      return this.fn(fn, ...args.map((_, index) => arg(index)));
    };
    const text = (index: number) => wrap(this.asText(args[index]), PREC.primary);
    switch (name) {
      case "RC":
      case "RAIZ":
        return math("Sqrt");
      case "ABS":
        return math("Abs");
      case "LN":
        return math("Log");
      case "EXP":
        return math("Exp");
      case "SEN":
      case "SIN":
        return math("Sin");
      case "COS":
        return math("Cos");
      case "TAN":
        return math("Tan");
      case "ASEN":
      case "ASIN":
        return math("Asin");
      case "ACOS":
        return math("Acos");
      case "ATAN":
        return math("Atan");
      case "TRUNC":
        return helper("Truncar", "truncar");
      case "REDON":
        return { code: `(int) Math.Round(${arg(0).code}, MidpointRounding.AwayFromZero)`, prec: PREC.unary };
      case "FECHAACTUAL":
        return helper("FechaActual", "fecha_actual");
      case "HORAACTUAL":
        return helper("HoraActual", "hora_actual");
      case "AZAR":
        this.uses.add("azar");
        return this.fn("Azar.Next", this.integer(args[0]));
      case "ALEATORIO":
        this.uses.add("azar");
        return this.fn("Azar.Next", this.integer(args[0]), this.integer(args[1], 1));
      case "LONGITUD":
        return { code: `${text(0)}.Length`, prec: PREC.primary };
      case "MAYUSCULAS":
        return { code: `${text(0)}.ToUpper()`, prec: PREC.primary };
      case "MINUSCULAS":
        return { code: `${text(0)}.ToLower()`, prec: PREC.primary };
      case "SUBCADENA": {
        const { from, length } = this.substringBounds(args, 0);
        return { code: `${text(0)}.Substring(${this.integer(from).code}, ${this.integer(length).code})`, prec: PREC.primary };
      }
      case "CONCATENAR":
        return this.infix(this.asText(args[0]), "+", this.asText(args[1]), PREC.additive);
      case "CONVERTIRANUMERO":
        this.uses.add("globalization");
        return { code: `double.Parse(${this.asText(args[0]).code}, CultureInfo.InvariantCulture)`, prec: PREC.primary };
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
    if (uses.has("texto")) uses.add("globalization");
    const lines = this.headerComment("//");
    if (lines.length > 0) lines.push("");
    lines.push("using System;");
    if (uses.has("globalization")) lines.push("using System.Globalization;");
    if (uses.has("threading")) lines.push("using System.Threading;");
    if (uses.has("sin_tipo") && this.comments) {
      lines.push(
        "",
        "// No se pudo determinar el tipo de algunas variables: se declaran como",
        "// string. Reemplácelo por el tipo adecuado (int, double o bool)."
      );
    }
    lines.push("");
    return lines;
  }

  private fields(): string[][] {
    return this.uses.has("azar") ? [["static Random Azar = new Random();"]] : [];
  }

  private helpers(): string[][] {
    const uses = this.uses;
    const comment = (...text: string[]) => (this.comments ? text.map((line) => `// ${line}`) : []);
    const body = (...lines: string[]) => lines.map((line) => this.indent + line);
    const method = (signature: string, ...lines: string[]) => [signature, "{", ...body(...lines), "}"];
    const blocks: string[][] = [];
    if (uses.has("leer_logico")) {
      blocks.push([
        ...comment("Lee VERDADERO o FALSO (también V, F, 1 o 0)."),
        ...method(
          "static bool LeerLogico()",
          'string valor = (Console.ReadLine() ?? "").Trim().ToUpper();',
          'return valor == "VERDADERO" || valor == "V" || valor == "1";'
        ),
      ]);
    }
    if (uses.has("texto")) {
      blocks.push([
        ...comment("Escribe un número como PSeInt: con hasta 10 decimales, sin ceros finales."),
        ...method("static string Texto(double valor)", 'return valor.ToString("0.##########", CultureInfo.InvariantCulture);'),
        "",
        ...method("static string Texto(bool valor)", 'return valor ? "VERDADERO" : "FALSO";'),
      ]);
    }
    if (uses.has("truncar")) {
      blocks.push([
        ...comment(
          "Como trunc() de PSeInt: un valor a menos de 1e-11 del entero siguiente",
          "se trunca a ese entero, así trunc(100*0.57) da 57 y no 56."
        ),
        ...method(
          "static int Truncar(double x)",
          "int t = (int) x;",
          "if (t + 1 - x < 1e-11) return t + 1;",
          "if (t - 1 - x > -1e-11) return t - 1;",
          "return t;"
        ),
      ]);
    }
    if (uses.has("fecha_actual")) {
      blocks.push([
        ...comment("Fecha actual como el número AAAAMMDD."),
        ...method("static int FechaActual()", "DateTime hoy = DateTime.Now;", "return hoy.Year * 10000 + hoy.Month * 100 + hoy.Day;"),
      ]);
    }
    if (uses.has("hora_actual")) {
      blocks.push([
        ...comment("Hora actual como el número HHMMSS."),
        ...method(
          "static int HoraActual()",
          "DateTime ahora = DateTime.Now;",
          "return ahora.Hour * 10000 + ahora.Minute * 100 + ahora.Second;"
        ),
      ]);
    }
    if (this.resizers.has(1)) {
      blocks.push([
        ...comment("Redimensionar: un arreglo nuevo con los valores que siguen dentro."),
        ...method(
          "static T[] Redimensionar<T>(T[] viejo, int n, T valorInicial)",
          "T[] nuevo = new T[n];",
          "for (int i = 0; i < n; i++)",
          `${this.indent}nuevo[i] = viejo != null && i < viejo.Length ? viejo[i] : valorInicial;`,
          "return nuevo;"
        ),
      ]);
    }
    if (this.resizers.has(2)) {
      blocks.push([
        ...method(
          "static T[,] Redimensionar<T>(T[,] viejo, int n, int m, T valorInicial)",
          "T[,] nuevo = new T[n, m];",
          "for (int i = 0; i < n; i++)",
          `${this.indent}for (int j = 0; j < m; j++)`,
          `${this.indent.repeat(2)}nuevo[i, j] = viejo != null && i < viejo.GetLength(0) && j < viejo.GetLength(1) ? viejo[i, j] : valorInicial;`,
          "return nuevo;"
        ),
      ]);
    }
    return blocks;
  }
}
