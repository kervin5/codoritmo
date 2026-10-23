import type {
  AssignableExpressionNode,
  ExpressionNode,
  ProgramNode,
  RoutineNode,
  StatementNode,
  SwitchStatementNode,
} from "../types";
import { containsCall, invertCondition, isAssignable, makeIdentifier, walk } from "./shared";
import { Rendered, StructuredGenerator, ValueKind, wrap } from "./structured";
import { normalizeName, ScopeTypes, VariableInfo } from "./type-inference";

// Pascal's and/or bind tighter than comparisons, so comparisons inside them
// are parenthesized. A negated operand is parenthesized too (a * (-b)).
const PREC = {
  relational: 10,
  unary: 15,
  additive: 20,
  multiplicative: 30,
  not: 40,
  primary: 100,
} as const;

const OPERATORS: Record<string, [string, number]> = {
  OR: ["or", PREC.additive],
  AND: ["and", PREC.multiplicative],
  "=": ["=", PREC.relational],
  "<>": ["<>", PREC.relational],
  "<": ["<", PREC.relational],
  ">": [">", PREC.relational],
  "<=": ["<=", PREC.relational],
  ">=": [">=", PREC.relational],
  "+": ["+", PREC.additive],
  "-": ["-", PREC.additive],
  "*": ["*", PREC.multiplicative],
  "/": ["/", PREC.multiplicative],
  "%": ["mod", PREC.multiplicative],
};

// Pascal ignores case; translated names must also avoid the routines the
// generated code calls.
const RESERVED = new Set(
  `and array as asm begin case class const constructor destructor div do downto else
  end except exports file finalization finally for function goto if implementation in
  inherited initialization inline interface is label library mod nil not object of
  on operator or out packed procedure program property raise record repeat
  resourcestring self set shl shr string then threadvar to try type unit until uses
  var while with xor result exit break continue true false
  integer real boolean char byte word longint int64 double
  abs arccos arcsin arctan copy cos delay exp floattostr formatfloat high inttostr
  length ln low lowercase power random randomize read readkey readln round setlength
  sin sqr sqrt strtofloat tan trim trunc uppercase write writeln clrscr date time now
  decodedate decodetime max min pi
  texto truncar redondear resto leerlogico fechaactual horaactual`.split(/\s+/)
);

const TYPE_NAMES: Record<ValueKind, string> = { int: "Integer", double: "Real", bool: "Boolean", string: "String" };
const KIND_WORDS: Record<ValueKind, string> = { int: "Entero", double: "Real", bool: "Logico", string: "Texto" };

/**
 * Exports pseudocode to Free Pascal (objfpc mode). Arrays with a constant
 * size are static and keep the pseudocode's indices (`array[1..10] of Real`);
 * arrays sized at run time, resized, or shared with subprocesses are dynamic
 * (`array of Real`, sized with SetLength, indexed from 0) and passed as `var`
 * parameters, so Redimensionar also works inside a subprocess.
 */
export class PascalGenerator extends StructuredGenerator {
  protected readonly reserved = RESERVED;
  protected readonly prec = PREC;
  protected readonly indent = "  ";
  private programName = "programa";
  /** Arrays (per scope) that must be dynamic. */
  private dynamicArrays = new Map<ScopeTypes, Set<string>>();
  /** Named dynamic array types in use: name -> declaration. */
  private arrayTypes = new Map<string, string>();

  protected extraNames(): string[] {
    return [this.programName];
  }

  protected render(program: ProgramNode): string[] {
    this.programName = makeIdentifier(program.entry.name, RESERVED).replace(/^_+/, "") || "programa";
    this.arrayTypes = new Map();
    this.findDynamicArrays(program);
    const routines = program.routines.map((routine) => this.routine(routine, routine.body, this.scopeOf(routine)));
    const main = this.routine(null, program.entry.body, this.types.main);
    const helpers = this.helpers();

    const lines = [...this.headerComment("//")];
    if (lines.length > 0) lines.push("");
    lines.push(`program ${this.programName};`, "", "{$mode objfpc}{$H+}");
    const units = [
      ...(this.uses.has("sysutils") || this.uses.has("texto") || this.uses.has("fecha") ? ["SysUtils"] : []),
      ...(this.uses.has("math") ? ["Math"] : []),
      ...(this.uses.has("crt") ? ["Crt"] : []),
    ];
    if (units.length > 0) lines.push("", "uses", `${this.indent}${units.join(", ")};`);
    if (this.arrayTypes.size > 0) {
      lines.push("", "type", ...[...this.arrayTypes].map(([name, type]) => `${this.indent}${name} = ${type};`));
    }
    if (this.uses.has("sin_tipo") && this.comments) {
      lines.push(
        "",
        "// No se pudo determinar el tipo de algunas variables: se declaran como",
        "// String. Reemplácelo por el tipo adecuado (Integer, Real o Boolean)."
      );
    }
    for (const block of [...helpers, ...routines]) lines.push("", ...block);
    lines.push("", ...main);
    return lines;
  }

  /**
   * Arrays that cannot be static: sized at run time, resized, parameters,
   * or passed to a subprocess (static array types would have to match).
   */
  private findDynamicArrays(program: ProgramNode): void {
    this.dynamicArrays = new Map();
    const scopes: [ScopeTypes, StatementNode[]][] = [
      [this.types.main, program.entry.body],
      ...program.routines.map((routine): [ScopeTypes, StatementNode[]] => [this.scopeOf(routine), routine.body]),
    ];
    for (const [scope, statements] of scopes) {
      const dynamic = new Set<string>();
      for (const info of scope.vars.values()) {
        const shape = info.array;
        if (shape && (info.param || shape.dynamic || shape.dims.some((dim) => dim === null))) dynamic.add(info.key);
      }
      walk(statements, (node) => {
        if (node.kind !== "call") return;
        const call = node as Extract<ExpressionNode, { kind: "call" }>;
        if (!this.inference.findRoutine(call.callee)) return;
        for (const arg of call.args) {
          if (arg.kind === "identifier" && scope.vars.get(normalizeName(arg.name))?.array) dynamic.add(normalizeName(arg.name));
        }
      });
      this.dynamicArrays.set(scope, dynamic);
    }
  }

  private isDynamic(info: VariableInfo | undefined): boolean {
    return Boolean(info?.array && this.dynamicArrays.get(this.context.scope)?.has(info.key));
  }

  // ---------------------------------------------------------------------------
  // Routines and declarations

  private routine(routine: RoutineNode | null, statements: StatementNode[], scope: ScopeTypes): string[] {
    const context = this.enter(routine, statements, scope);
    const body = this.block(statements);
    if (!routine && this.uses.has("random")) body.unshift(`${this.indent}Randomize;`);
    const last = statements[statements.length - 1];
    if (routine && context.returnType && last?.kind !== "return") {
      body.push(
        `${this.indent}Result := ${context.returnInfo ? this.identifier(context.returnInfo.name).code : this.defaultValue(this.kindOf(context.returnType))};`
      );
    }

    const declarations = this.locals({ skipAliases: true })
      .map((info) => `${this.indent}${this.name(info.name)}: ${this.typeName(info)};`)
      .concat([...context.temps].map(([name, kind]) => `${this.indent}${name}: ${TYPE_NAMES[kind]};`));
    const variables = declarations.length > 0 ? ["var", ...declarations] : [];

    if (!routine) return [...variables, ...(variables.length > 0 ? [""] : []), "begin", ...body, "end."];
    const params = routine.params.map((param) => {
      const info = scope.vars.get(normalizeName(param.name))!;
      return `${param.byReference || info.array ? "var " : ""}${this.name(param.name)}: ${this.typeName(info)}`;
    });
    const signature = params.length > 0 ? `(${params.join("; ")})` : "";
    const header = context.returnType
      ? `function ${this.routineName(routine)}${signature}: ${TYPE_NAMES[this.kindOf(context.returnType)]};`
      : `procedure ${this.routineName(routine)}${signature};`;
    return [header, ...variables, "begin", ...body, "end;"];
  }

  private typeName(info: VariableInfo): string {
    if (this.typeOf({ kind: "identifier", name: info.name }) === "unknown") this.uses.add("sin_tipo");
    const kind = this.variableKind(info);
    const shape = info.array;
    if (!shape) return TYPE_NAMES[kind];
    if (!this.isDynamic(info)) {
      const base = this.settings.baseZeroArrays ? 0 : 1;
      return `array[${shape.dims.map((dim) => `${base}..${base + (dim ?? 1) - 1}`).join(", ")}] of ${TYPE_NAMES[kind]}`;
    }
    const depth = shape.dims.length;
    const name = `T${depth === 1 ? "Arreglo" : depth === 2 ? "Matriz" : `Arreglo${depth}D`}${KIND_WORDS[kind]}`;
    this.arrayTypes.set(name, `${"array of ".repeat(depth)}${TYPE_NAMES[kind]}`);
    return name;
  }

  private defaultValue(kind: ValueKind): string {
    return { int: "0", double: "0.0", bool: "False", string: "''" }[kind];
  }

  // ---------------------------------------------------------------------------
  // Statements

  /** `begin ... end` around a block, for the bodies of if, while, for... */
  private compound(statements: StatementNode[], terminator = ";"): string[] {
    return ["begin", ...this.block(statements), `end${terminator}`];
  }

  protected statementLines(statement: StatementNode): string[] {
    switch (statement.kind) {
      case "define":
        return [];
      case "dimension":
        return this.dimension(statement);
      case "assignment":
        return [`${this.expression(statement.target).code} := ${this.converted(statement.value, this.kind(statement.target))};`];
      case "write":
        return this.write(statement.expressions, statement.newline);
      case "read":
        return statement.targets.map((target) => this.read(target));
      case "if":
        return this.ifStatement(statement);
      case "while": {
        const { value, pre, post } = this.capture(() => this.expression(statement.condition).code);
        if (pre.length === 0 && post.length === 0) return [`while ${value} do`, ...this.compound(statement.body)];
        // The condition calls a subprocess with by-reference arguments.
        const exit = this.temp("salir", "bool");
        return [
          "repeat",
          ...[...pre, `${exit} := not (${value});`, ...post, `if not ${exit} then`, ...this.compound(statement.body)].map(
            (line) => this.indent + line
          ),
          `until ${exit};`,
        ];
      }
      case "repeat": {
        const until = statement.mode === "until" ? statement.condition : invertCondition(statement.condition);
        const body = this.block(statement.body);
        const { value, pre, post } = this.capture(() => this.expression(until).code);
        if (pre.length === 0 && post.length === 0) return ["repeat", ...body, `until ${value};`];
        const exit = this.temp("salir", "bool");
        return ["repeat", ...body, ...[...pre, `${exit} := ${value};`, ...post].map((line) => this.indent + line), `until ${exit};`];
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
        this.uses.add("crt");
        return ["ClrScr;"];
      case "wait":
        this.uses.add("crt");
        if (statement.mode === "key") return ["ReadKey;"];
        return [`Delay(${this.integer(statement.durationMs!).code});`];
      case "return":
        if (!statement.expression || !this.context.returnType) return ["Exit;"];
        return [`Exit(${this.converted(statement.expression, this.kindOf(this.context.returnType))});`];
    }
  }

  private ifStatement(statement: Extract<StatementNode, { kind: "if" }>): string[] {
    const lines = [`if ${this.expression(statement.condition).code} then`];
    let otherwise = statement.elseBranch;
    let then = statement.thenBranch;
    while (otherwise.length === 1 && otherwise[0].kind === "if") {
      const nested = otherwise[0];
      const next = this.capture(() => this.expression(nested.condition).code);
      if (next.pre.length > 0 || next.post.length > 0) break;
      lines.push(...this.compound(then, ""), `else if ${next.value} then`);
      then = nested.thenBranch;
      otherwise = nested.elseBranch;
    }
    if (otherwise.length === 0) return [...lines, ...this.compound(then)];
    return [...lines, ...this.compound(then, ""), "else", ...this.compound(otherwise)];
  }

  private dimension(statement: Extract<StatementNode, { kind: "dimension" }>): string[] {
    const lines: string[] = [];
    for (const item of statement.items) {
      const info = this.context.scope.vars.get(normalizeName(item.name));
      if (!info?.array || !this.isDynamic(info)) continue;
      // SetLength keeps the values that still fit, so it also resizes.
      const sizes = item.dimensions.map((dimension) => this.integer(dimension).code);
      lines.push(`SetLength(${this.name(item.name)}, ${sizes.join(", ")});`);
    }
    return lines;
  }

  private write(args: ExpressionNode[], newline: boolean): string[] {
    const method = newline ? "WriteLn" : "Write";
    if (args.length === 0) return newline ? ["WriteLn;"] : [];
    const parts = args.map((arg) => this.capture(() => this.printable(arg)));
    if (parts.some((part) => part.pre.length > 0 || part.post.length > 0)) {
      const lines = parts.flatMap((part) => [...part.pre, `Write(${part.value.code});`, ...part.post]);
      return newline ? [...lines, "WriteLn;"] : lines;
    }
    return [`${method}(${parts.map((part) => part.value.code).join(", ")});`];
  }

  /** A value as PSeInt writes it: reals with up to 10 decimals, VERDADERO/FALSO. */
  private printable(arg: ExpressionNode): Rendered {
    const kind = this.kind(arg);
    const rendered = this.expression(arg);
    return kind === "double" || kind === "bool" ? this.texto(rendered) : rendered;
  }

  private texto(rendered: Rendered): Rendered {
    this.uses.add("texto");
    return this.fn("Texto", rendered);
  }

  private asText(expression: ExpressionNode): Rendered {
    const kind = this.kind(expression);
    const rendered = this.expression(expression);
    if (kind === "string") return rendered;
    if (kind === "int") {
      this.uses.add("sysutils");
      return this.fn("IntToStr", rendered);
    }
    return this.texto(rendered);
  }

  private read(target: AssignableExpressionNode): string {
    if (this.kind(target) === "bool") {
      this.uses.add("leer_logico");
      return `${this.expression(target).code} := LeerLogico;`;
    }
    return `ReadLn(${this.expression(target).code});`;
  }

  private converted(value: ExpressionNode, target: ValueKind): string {
    const rendered = this.expression(value);
    if (target === "int" && this.kind(value) === "double") return this.toInteger(rendered).code;
    return rendered.code;
  }

  private forStatement(statement: Extract<StatementNode, { kind: "for" }>): string[] {
    const counterExpression: ExpressionNode = { kind: "identifier", name: statement.variable };
    const counterInfo = this.context.scope.vars.get(normalizeName(statement.variable));
    const counter = this.expression(counterExpression).code;
    const plan = this.forPlan(statement);
    const start = this.converted(statement.start, this.kind(counterExpression));
    if (
      this.isPlainCountingLoop(statement, plan) &&
      Math.abs(plan.step!) === 1 &&
      this.kind(counterExpression) === "int" &&
      !counterInfo?.param &&
      this.isInt(statement.start) &&
      this.isInt(statement.end)
    ) {
      const direction = plan.descending ? "downto" : "to";
      return [`for ${counter} := ${start} ${direction} ${this.expression(statement.end).code} do`, ...this.compound(statement.body)];
    }

    // A while loop keeps PSeInt's semantics: the counter may be real, the
    // body may change it, and it ends one step past the limit.
    const lines = [`${counter} := ${start};`];
    const end = wrap(this.expression(statement.end), PREC.relational + 1);
    let condition: string;
    let update: string;
    if (plan.descending !== null && plan.step !== null) {
      condition = `${counter} ${plan.descending ? ">=" : "<="} ${end}`;
      update = `${counter} := ${counter} ${plan.step < 0 ? "-" : "+"} ${Math.abs(plan.step)};`;
    } else {
      const kind = statement.step ? this.kind(statement.step) : "int";
      const step = this.temp("paso", kind === "double" ? "double" : "int");
      lines.push(
        statement.step
          ? `${step} := ${this.expression(statement.step).code};`
          : `if ${counter} <= ${end} then ${step} := 1 else ${step} := -1;`
      );
      condition = `((${step} > 0) and (${counter} <= ${end})) or ((${step} < 0) and (${counter} >= ${end}))`;
      update = `${counter} := ${counter} + ${step};`;
    }
    return [...lines, `while ${condition} do`, "begin", ...this.block(statement.body), `${this.indent}${update}`, "end;"];
  }

  private forEach(statement: Extract<StatementNode, { kind: "forEach" }>): string[] {
    const plan = this.forEachPlan(statement);
    if (!plan) return [`// Para Cada ${statement.variable}: no se pudo traducir`];
    const collection = this.expression(statement.collection).code;
    const counters = this.forEachCounters(plan, "int");
    const element = `${collection}[${counters.join(", ")}]`;
    const lines: string[] = [];
    counters.forEach((counter, index) => {
      const row = index === 0 ? collection : `${collection}[${counters.slice(0, index).join(", ")}]`;
      lines.push(`${this.indent.repeat(index)}for ${counter} := Low(${row}) to High(${row}) do`);
    });
    const depth = this.indent.repeat(plan.depth - 1);
    const body = this.withAlias(plan.alias.key, element, () => this.block(statement.body, plan.depth));
    return [...lines, `${depth}begin`, ...body, `${depth}end;`];
  }

  private switchStatement(statement: SwitchStatementNode): string[] {
    if (this.switchCases(statement)) {
      const lines = [`case ${this.expression(statement.expression).code} of`];
      for (const switchCase of statement.cases) {
        lines.push(`${this.indent}${switchCase.values.map((value) => this.expression(value).code).join(", ")}:`);
        lines.push(...this.compound(switchCase.body).map((line) => this.indent.repeat(2) + line));
      }
      if (statement.defaultCase.length > 0) lines.push("else", ...this.block(statement.defaultCase));
      lines.push("end;");
      return lines;
    }
    if (statement.cases.length === 0) return statement.defaultCase.flatMap((child) => this.statement(child));
    let control = statement.expression;
    const lines: string[] = [];
    let temp: string | null = null;
    if (containsCall(control)) {
      temp = this.temp("opcion", this.kind(control));
      lines.push(`${temp} := ${this.expression(control).code};`);
      control = { kind: "identifier", name: temp };
    }
    const branches = (): string[] => {
      const result: string[] = [];
      statement.cases.forEach((switchCase, index) => {
        const condition = switchCase.values
          .map((value) => {
            const rendered = this.binary("=", control, value, statement.expression);
            return switchCase.values.length > 1 ? wrap(rendered, PREC.additive + 1) : rendered.code;
          })
          .join(" or ");
        const last = index === statement.cases.length - 1 && statement.defaultCase.length === 0;
        result.push(`${index === 0 ? "" : "else "}if ${condition} then`, ...this.compound(switchCase.body, last ? ";" : ""));
      });
      if (statement.defaultCase.length > 0) result.push("else", ...this.compound(statement.defaultCase));
      return result;
    };
    lines.push(...(temp ? this.withAlias(normalizeName(temp), temp, branches) : branches()));
    return lines;
  }

  // ---------------------------------------------------------------------------
  // Expressions

  protected toInteger(rendered: Rendered): Rendered {
    return this.fn("Trunc", rendered);
  }

  /** Static arrays keep the pseudocode's indices; dynamic ones start at 0. */
  protected indexShift(array: VariableInfo | undefined): number {
    if (array && !this.isDynamic(array)) return 0;
    return this.settings.baseZeroArrays ? 0 : -1;
  }

  protected numberLiteral(value: number): Rendered {
    let code = String(value);
    if (Number.isInteger(value) && Math.abs(value) > this.intLimit && !/[.e]/.test(code)) code += ".0";
    return { code, prec: value < 0 ? PREC.unary : PREC.primary };
  }

  protected stringLiteral(value: string): Rendered {
    let code = "";
    let open = false;
    for (const char of value) {
      const point = char.charCodeAt(0);
      if (point < 0x20) {
        if (open) code += "'";
        open = false;
        code += `#${point}`;
      } else {
        if (!open) code += "'";
        open = true;
        code += char === "'" ? "''" : char;
      }
    }
    if (open) code += "'";
    return { code: code || "''", prec: PREC.primary };
  }

  protected boolLiteral(value: boolean): Rendered {
    return { code: value ? "True" : "False", prec: PREC.primary };
  }

  protected arrayAccess(base: string, indices: Rendered[]): Rendered {
    return { code: `${base}[${indices.map((index) => index.code).join(", ")}]`, prec: PREC.primary };
  }

  protected unary(operator: string, operand: ExpressionNode): Rendered {
    if (operator === "-") return { code: `-${wrap(this.expression(operand), PREC.additive + 1)}`, prec: PREC.unary };
    return { code: `not ${wrap(this.expression(operand), PREC.not)}`, prec: PREC.not };
  }

  protected binary(operator: string, left: ExpressionNode, right: ExpressionNode, typedAs?: ExpressionNode): Rendered {
    const isText = this.kind(typedAs ?? left) === "string" || this.kind(right) === "string";
    if (operator === "+" && isText) return this.infix(this.asText(left), "+", this.asText(right), PREC.additive);
    if (operator === "^") {
      this.uses.add("math");
      return this.fn("Power", this.expression(left), this.expression(right));
    }
    if (operator === "%" && !(this.isInt(left) && this.isInt(right))) {
      // mod only takes integers.
      this.uses.add("resto");
      return this.fn("Resto", this.expression(left), this.expression(right));
    }
    const [symbol, prec] = OPERATORS[operator] ?? [operator, PREC.primary];
    if (isText && prec === PREC.relational) return this.infix(this.asText(left), symbol, this.asText(right), prec);
    return this.infix(this.expression(left), symbol, this.expression(right), prec);
  }

  protected constant(name: "PI" | "EULER"): Rendered {
    return name === "PI" ? { code: "Pi", prec: PREC.primary } : this.fn("Exp", "1");
  }

  protected routineCall(routine: RoutineNode, args: ExpressionNode[]): Rendered {
    const rendered = args.map((arg, index) => {
      const param = this.parameter(routine, index);
      if (!param || param.info.array) return this.expression(arg).code;
      const kind = this.variableKind(param.info);
      if (!param.byReference) return this.converted(arg, kind);
      if (!this.needsReferenceCopy(arg, kind)) return this.expression(arg).code;
      // A var parameter needs a variable of exactly its type.
      const holder = this.temp("ref", kind);
      this.pre.push(`${holder} := ${this.converted(arg, kind)};`);
      if (isAssignable(arg)) {
        const back = this.kind(arg) === "int" && kind === "double" ? `Trunc(${holder})` : holder;
        this.post.push(`${this.expression(arg).code} := ${back};`);
      }
      return holder;
    });
    const name = this.routineName(routine);
    return { code: rendered.length > 0 ? `${name}(${rendered.join(", ")})` : name, prec: PREC.primary };
  }

  protected builtin(name: string, args: ExpressionNode[]): Rendered | null {
    const arg = (index: number) => this.expression(args[index]);
    const plain = (fn: string) => this.fn(fn, arg(0));
    const math = (fn: string) => {
      this.uses.add("math");
      return plain(fn);
    };
    const helper = (fn: string, use: string) => {
      this.uses.add(use);
      return args.length > 0 ? this.fn(fn, ...args.map((_, index) => arg(index))) : { code: fn, prec: PREC.primary };
    };
    const sysutils = (fn: string) => {
      this.uses.add("sysutils");
      return this.fn(fn, this.asText(args[0]));
    };
    switch (name) {
      case "RC":
      case "RAIZ":
        return plain("Sqrt");
      case "ABS":
        return plain("Abs");
      case "LN":
        return plain("Ln");
      case "EXP":
        return plain("Exp");
      case "SEN":
      case "SIN":
        return plain("Sin");
      case "COS":
        return plain("Cos");
      case "TAN":
        return plain("Tan");
      case "ASEN":
      case "ASIN":
        return math("ArcSin");
      case "ACOS":
        return math("ArcCos");
      case "ATAN":
        return plain("ArcTan");
      case "TRUNC":
        return helper("Truncar", "truncar");
      case "REDON":
        return helper("Redondear", "redondear");
      case "FECHAACTUAL":
        this.uses.add("fecha");
        return helper("FechaActual", "fecha_actual");
      case "HORAACTUAL":
        this.uses.add("fecha");
        return helper("HoraActual", "hora_actual");
      case "AZAR":
        this.uses.add("random");
        return this.fn("Random", this.integer(args[0]));
      case "ALEATORIO": {
        this.uses.add("random");
        const low = this.integer(args[0]);
        const span = this.integer({ kind: "binary", operator: "-", left: args[1], right: args[0] }, 1);
        return this.infix(low, "+", this.fn("Random", span), PREC.additive);
      }
      case "LONGITUD":
        return this.fn("Length", this.asText(args[0]));
      case "MAYUSCULAS":
        return sysutils("UpperCase");
      case "MINUSCULAS":
        return sysutils("LowerCase");
      case "SUBCADENA": {
        const { from, length } = this.substringBounds(args, 1);
        return this.fn("Copy", this.asText(args[0]), this.integer(from), this.integer(length));
      }
      case "CONCATENAR":
        return this.infix(this.asText(args[0]), "+", this.asText(args[1]), PREC.additive);
      case "CONVERTIRANUMERO":
        this.uses.add("convertir_a_numero");
        return this.fn("ConvertirANumero", this.asText(args[0]));
      case "CONVERTIRATEXTO":
        return this.asText(args[0]);
      default:
        return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers

  private helpers(): string[][] {
    const uses = this.uses;
    const comment = (...text: string[]) => (this.comments ? text.map((line) => `// ${line}`) : []);
    const body = (...lines: string[]) => ["begin", ...lines.map((line) => this.indent + line), "end;"];
    const blocks: string[][] = [];
    const point = ["f := DefaultFormatSettings;", "f.DecimalSeparator := '.';"];
    if (uses.has("texto")) {
      blocks.push([
        ...comment("Escribe un número como PSeInt: con hasta 10 decimales, sin ceros finales."),
        "function Texto(valor: Real): String; overload;",
        "var",
        `${this.indent}f: TFormatSettings;`,
        ...body(...point, "Result := FormatFloat('0.##########', valor, f);"),
        "",
        "function Texto(valor: Boolean): String; overload;",
        ...body("if valor then Result := 'VERDADERO' else Result := 'FALSO';"),
      ]);
    }
    if (uses.has("convertir_a_numero")) {
      blocks.push([
        ...comment("Convierte un texto con punto decimal en número."),
        "function ConvertirANumero(valor: String): Real;",
        "var",
        `${this.indent}f: TFormatSettings;`,
        ...body(...point, "Result := StrToFloat(Trim(valor), f);"),
      ]);
      uses.add("sysutils");
    }
    if (uses.has("leer_logico")) {
      blocks.push([
        ...comment("Lee VERDADERO o FALSO (también V, F, 1 o 0)."),
        "function LeerLogico: Boolean;",
        "var",
        `${this.indent}valor: String;`,
        ...body("ReadLn(valor);", "valor := UpperCase(Trim(valor));", "Result := (valor = 'VERDADERO') or (valor = 'V') or (valor = '1');"),
      ]);
      uses.add("sysutils");
    }
    if (uses.has("truncar")) {
      blocks.push([
        ...comment(
          "Como trunc() de PSeInt: un valor a menos de 1e-11 del entero siguiente",
          "se trunca a ese entero, así trunc(100*0.57) da 57 y no 56."
        ),
        "function Truncar(x: Real): Integer;",
        ...body(
          "Result := Trunc(x);",
          "if Result + 1 - x < 1e-11 then Result := Result + 1",
          "else if Result - 1 - x > -1e-11 then Result := Result - 1;"
        ),
      ]);
    }
    if (uses.has("redondear")) {
      blocks.push([
        ...comment("Como redon() de PSeInt: redondea alejándose de cero (-2.5 da -3); Round redondea al par."),
        "function Redondear(x: Real): Integer;",
        ...body("if x < 0 then Result := Trunc(x - 0.5) else Result := Trunc(x + 0.5);"),
      ]);
    }
    if (uses.has("resto")) {
      blocks.push([
        ...comment("Resto de una división con decimales (mod solo acepta enteros)."),
        "function Resto(a, b: Real): Real;",
        ...body("Result := a - b * Int(a / b);"),
      ]);
    }
    if (uses.has("fecha_actual")) {
      blocks.push([
        ...comment("Fecha actual como el número AAAAMMDD."),
        "function FechaActual: Integer;",
        "var",
        `${this.indent}anio, mes, dia: Word;`,
        ...body("DecodeDate(Date, anio, mes, dia);", "Result := anio * 10000 + mes * 100 + dia;"),
      ]);
    }
    if (uses.has("hora_actual")) {
      blocks.push([
        ...comment("Hora actual como el número HHMMSS."),
        "function HoraActual: Integer;",
        "var",
        `${this.indent}hora, minuto, segundo, milisegundo: Word;`,
        ...body("DecodeTime(Time, hora, minuto, segundo, milisegundo);", "Result := hora * 10000 + minuto * 100 + segundo;"),
      ]);
    }
    return blocks;
  }
}
