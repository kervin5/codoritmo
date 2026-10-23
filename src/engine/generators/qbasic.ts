import type {
  AssignableExpressionNode,
  ExpressionNode,
  ProgramNode,
  RoutineNode,
  StatementNode,
} from "../types";
import { isAssignable, makeIdentifier } from "./shared";
import { Rendered, StructuredGenerator, ValueKind, wrap } from "./structured";
import { normalizeName, ScopeTypes, VariableInfo } from "./type-inference";

const PREC = {
  or: 10,
  and: 20,
  not: 25,
  relational: 30,
  additive: 40,
  mod: 50,
  multiplicative: 60,
  unary: 70,
  power: 80,
  primary: 100,
} as const;

const OPERATORS: Record<string, [string, number]> = {
  OR: ["OR", PREC.or],
  AND: ["AND", PREC.and],
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
  "%": ["MOD", PREC.mod],
};

const RESERVED = new Set(
  `abs access alias and any append as asc atn base beep binary bload bsave call
  case cdbl chain chdir chr cint circle clear clng close cls color com common const
  cos csng csrlin cvd cvdmbf cvi cvl cvs cvsmbf data date declare def defdbl defint
  deflng defsng defstr dim do double draw else elseif end environ eof eqv erase erdev
  erl err error exit exp field files fix for fre free function get gosub goto hex if
  imp inkey inp input instr int integer ioctl is key kill lbound lcase left len let
  line list loc locate lock lof log long loop lprint lset ltrim mid mkd mkdir mki mkl
  mks mod name next not oct off on open option or out output paint palette pcopy peek
  pen play pmap point poke pos preset print pset put random randomize read redim rem
  reset restore resume return right rmdir rnd rset rtrim run screen seek seg select
  sgn shared shell sin single sleep sound space spc sqr static step stick stop str
  strig string sub swap system tab tan then time timer to troff tron type ubound
  ucase unlock until using val varptr varseg view wait wend while width window write
  xor verdadero falso pi
  texto textologico truncar redondear resto arcsen arccos leerlogico esperar
  fechaactual horaactual`.split(/\s+/)
);

const TYPE_NAMES: Record<ValueKind, string> = { int: "LONG", double: "DOUBLE", bool: "INTEGER", string: "STRING" };
const SUFFIXES: Record<ValueKind, string> = { int: "&", double: "#", bool: "%", string: "$" };

/**
 * Exports pseudocode to QBasic, in the dialect QB64 also compiles. Integers
 * are LONG, logical values INTEGER (-1 or 0, so NOT works); arrays keep the
 * pseudocode's indices (`DIM a(1 TO 10)`). QBasic passes variables by
 * reference, so arguments for by-value parameters go in parentheses.
 */
export class QBasicGenerator extends StructuredGenerator {
  protected readonly reserved = RESERVED;
  protected readonly prec = PREC;
  private declarations: string[] = [];

  protected name(name: string): string {
    let identifier = makeIdentifier(name, RESERVED).replace(/^_+/, "v");
    // Names starting with FN are user functions in QBasic.
    if (identifier.startsWith("fn")) identifier = `v${identifier}`;
    return identifier;
  }

  protected render(program: ProgramNode): string[] {
    this.declarations = [];
    const routines = program.routines.map((routine) => this.routine(routine, routine.body, this.scopeOf(routine)));
    const main = this.routine(null, program.entry.body, this.types.main);
    const helpers = this.helpers();

    const lines = this.headerComment("'");
    if (lines.length > 0) lines.push("");
    if (this.declarations.length > 0) lines.push(...this.declarations, "");
    if (this.uses.has("bool")) lines.push("CONST VERDADERO = -1, FALSO = 0", "");
    if (this.uses.has("sin_tipo") && this.comments) {
      lines.push(
        "' No se pudo determinar el tipo de algunas variables: se declaran como",
        "' STRING. Reemplácelo por el tipo adecuado (LONG, DOUBLE o INTEGER).",
        ""
      );
    }
    if (this.uses.has("random")) lines.push("RANDOMIZE TIMER");
    lines.push(...main, "END");
    for (const block of [...routines, ...helpers]) lines.push("", ...block);
    return lines;
  }

  // ---------------------------------------------------------------------------
  // Routines and declarations

  private routine(routine: RoutineNode | null, statements: StatementNode[], scope: ScopeTypes): string[] {
    const context = this.enter(routine, statements, scope);
    const body = this.block(statements, routine ? 1 : 0);
    const last = statements[statements.length - 1];
    if (routine && context.returnType && last?.kind !== "return") {
      body.push(
        `${this.indent}${this.functionName(routine)} = ${context.returnInfo ? this.identifier(context.returnInfo.name).code : this.defaultValue(this.kindOf(context.returnType))}`
      );
    }
    const prefix = routine ? this.indent : "";
    const variables = this.locals({ skipAliases: true })
      .filter((info) => !info.array)
      .map((info) => `${prefix}DIM ${this.name(info.name)} AS ${this.typeName(info)}`)
      .concat([...context.temps].map(([name, kind]) => `${prefix}DIM ${name} AS ${TYPE_NAMES[kind]}`));
    if (!routine) return [...variables, ...body];

    const params = routine.params.map((param) => {
      const info = scope.vars.get(normalizeName(param.name))!;
      const dims = info.array ? `(${",".repeat(info.array.dims.length - 1)})` : "";
      return `${this.name(param.name)}${dims} AS ${this.typeName(info)}`;
    });
    const signature = params.length > 0 ? ` (${params.join(", ")})` : "";
    const header = context.returnType
      ? `FUNCTION ${this.functionName(routine)}${signature}`
      : `SUB ${this.routineName(routine)}${signature}`;
    this.declarations.push(`DECLARE ${header}`);
    return [header, ...variables, ...body, context.returnType ? "END FUNCTION" : "END SUB"];
  }

  /** A FUNCTION's name carries the suffix of its type. */
  private functionName(routine: RoutineNode): string {
    const type = this.scopeOf(routine).returnKey
      ? this.scopeOf(routine).vars.get(this.scopeOf(routine).returnKey!)!.type
      : this.scopeOf(routine).returnType;
    return `${this.routineName(routine)}${SUFFIXES[this.kindOf(type)]}`;
  }

  private returnsValue(routine: RoutineNode): boolean {
    const scope = this.scopeOf(routine);
    return Boolean(scope.returnKey) || scope.returnType !== "unknown";
  }

  private typeName(info: VariableInfo): string {
    if (this.typeOf({ kind: "identifier", name: info.name }) === "unknown") this.uses.add("sin_tipo");
    return TYPE_NAMES[this.variableKind(info)];
  }

  private defaultValue(kind: ValueKind): string {
    return { int: "0", double: "0", bool: "0", string: '""' }[kind];
  }

  // ---------------------------------------------------------------------------
  // Statements

  /** A condition plus the statements that must run right before testing it. */
  private condition(expression: ExpressionNode): { code: string; setup: string[] } {
    const { value, pre, post } = this.capture(() => this.expression(expression));
    if (pre.length === 0 && post.length === 0) return { code: value.code, setup: [] };
    const temp = this.temp("condicion", "bool");
    return { code: temp, setup: [...pre, `${temp} = ${value.code}`, ...post] };
  }

  protected statementLines(statement: StatementNode): string[] {
    switch (statement.kind) {
      case "define":
        return [];
      case "dimension":
        return this.dimension(statement);
      case "assignment":
        return [`${this.expression(statement.target).code} = ${this.converted(statement.value, this.kind(statement.target))}`];
      case "write":
        return this.write(statement.expressions, statement.newline);
      case "read":
        return statement.targets.map((target) => this.read(target));
      case "if":
        return this.ifStatement(statement);
      case "while": {
        const test = this.condition(statement.condition);
        if (test.setup.length === 0) return [`DO WHILE ${test.code}`, ...this.block(statement.body), "LOOP"];
        return [
          "DO",
          ...[...test.setup, `IF NOT ${test.code} THEN EXIT DO`].map((line) => this.indent + line),
          ...this.block(statement.body),
          "LOOP",
        ];
      }
      case "repeat": {
        const body = this.block(statement.body);
        const test = this.condition(statement.condition);
        const keyword = statement.mode === "until" ? "UNTIL" : "WHILE";
        if (test.setup.length === 0) return ["DO", ...body, `LOOP ${keyword} ${test.code}`];
        return ["DO", ...body, ...test.setup.map((line) => this.indent + line), `LOOP ${keyword} ${test.code}`];
      }
      case "for":
        return this.forStatement(statement);
      case "forEach":
        return this.forEach(statement);
      case "switch": {
        // SELECT CASE compares numbers and texts alike.
        const lines = [`SELECT CASE ${this.expression(statement.expression).code}`];
        for (const switchCase of statement.cases) {
          lines.push(`${this.indent}CASE ${switchCase.values.map((value) => this.expression(value).code).join(", ")}`);
          lines.push(...this.block(switchCase.body, 2));
        }
        if (statement.defaultCase.length > 0) lines.push(`${this.indent}CASE ELSE`, ...this.block(statement.defaultCase, 2));
        lines.push("END SELECT");
        return lines;
      }
      case "expression":
        return this.expressionStatement(statement.expression);
      case "clear":
        return ["CLS"];
      case "wait":
        if (statement.mode === "key") return ['DO: LOOP WHILE INKEY$ = ""'];
        this.uses.add("esperar");
        return [`Esperar ${this.byValue(statement.durationMs!).code}`];
      case "return": {
        const routine = this.context.routine;
        if (!routine) return ["END"];
        if (!statement.expression || !this.context.returnType) return [this.context.returnType ? "EXIT FUNCTION" : "EXIT SUB"];
        return [
          `${this.functionName(routine)} = ${this.converted(statement.expression, this.kindOf(this.context.returnType))}`,
          "EXIT FUNCTION",
        ];
      }
    }
  }

  private expressionStatement(expression: ExpressionNode): string[] {
    const name = expression.kind === "identifier" ? expression.name : expression.kind === "call" ? expression.callee : null;
    const routine = name && !this.context.scope.vars.has(normalizeName(name)) ? this.inference.findRoutine(name) : undefined;
    if (!routine) return this.comments ? [`' ${this.expression(expression).code}`] : [];
    const args = expression.kind === "call" ? expression.args : [];
    if (this.returnsValue(routine)) {
      // A FUNCTION cannot be called as a statement: keep its result aside.
      const kind = this.kindOf(this.inference.routineReturnType(routine));
      const temp = this.temp("resultado", kind);
      return [`${temp} = ${this.routineCall(routine, args).code}`];
    }
    const rendered = this.callArgs(routine, args);
    return [`CALL ${this.routineName(routine)}${rendered.length > 0 ? `(${rendered.join(", ")})` : ""}`];
  }

  private ifStatement(statement: Extract<StatementNode, { kind: "if" }>): string[] {
    const first = this.condition(statement.condition);
    const lines = [...first.setup, `IF ${first.code} THEN`, ...this.block(statement.thenBranch)];
    let otherwise = statement.elseBranch;
    while (otherwise.length === 1 && otherwise[0].kind === "if") {
      const nested = otherwise[0];
      const next = this.condition(nested.condition);
      if (next.setup.length > 0) break;
      lines.push(`ELSEIF ${next.code} THEN`, ...this.block(nested.thenBranch));
      otherwise = nested.elseBranch;
    }
    if (otherwise.length > 0) lines.push("ELSE", ...this.block(otherwise));
    lines.push("END IF");
    return lines;
  }

  private dimension(statement: Extract<StatementNode, { kind: "dimension" }>): string[] {
    const base = this.settings.baseZeroArrays ? 0 : 1;
    const lines: string[] = [];
    for (const item of statement.items) {
      const info = this.context.scope.vars.get(normalizeName(item.name));
      if (!info?.array) continue;
      const bounds = item.dimensions
        .map((dimension) => `${base} TO ${this.integer(dimension, base - 1).code}`)
        .join(", ");
      const keyword = statement.resize ? "REDIM PRESERVE" : this.context.declaredAtSite.has(info.key) ? "DIM" : "REDIM";
      if (statement.resize && info.param) this.warn(statement, "EXPORT_RESIZE_PARAMETER", item.name);
      lines.push(`${keyword} ${this.name(item.name)}(${bounds}) AS ${this.typeName(info)}`);
    }
    return lines;
  }

  private write(args: ExpressionNode[], newline: boolean): string[] {
    const parts = args.map((arg) => this.capture(() => this.printable(arg)));
    if (parts.some((part) => part.pre.length > 0 || part.post.length > 0)) {
      const lines = parts.flatMap((part) => [...part.pre, `PRINT ${part.value.code};`, ...part.post]);
      return newline ? [...lines, "PRINT"] : lines;
    }
    if (parts.length === 0) return newline ? ["PRINT"] : [];
    return [`PRINT ${parts.map((part) => part.value.code).join("; ")}${newline ? "" : ";"}`];
  }

  /**
   * A value as PSeInt writes it. PRINT puts spaces around numbers, so they
   * are turned into text first.
   */
  private printable(arg: ExpressionNode): Rendered {
    return this.asText(arg);
  }

  private asText(expression: ExpressionNode): Rendered {
    const kind = this.kind(expression);
    const rendered = this.expression(expression);
    switch (kind) {
      case "string":
        return rendered;
      case "int":
        return this.fn("LTRIM$", this.fn("STR$", rendered));
      case "double":
        this.uses.add("texto");
        return this.fn("Texto$", rendered);
      case "bool":
        this.uses.add("texto_logico");
        return this.fn("TextoLogico$", rendered);
    }
  }

  private read(target: AssignableExpressionNode): string {
    const code = this.expression(target).code;
    switch (this.kind(target)) {
      case "string":
        return `LINE INPUT ${code}`;
      case "bool":
        this.uses.add("leer_logico");
        return `${code} = LeerLogico%`;
      default:
        // The empty prompt and the comma leave out INPUT's question mark.
        return `INPUT "", ${code}`;
    }
  }

  /**
   * An argument for one of the helper procedures: a variable goes in
   * parentheses so it is passed as a copy, which may have another type.
   */
  private byValue(expression: ExpressionNode, kind: ValueKind = "double"): Rendered {
    const rendered = this.expression(expression);
    return isAssignable(expression) && this.kind(expression) !== kind ? { code: `(${rendered.code})`, prec: PREC.primary } : rendered;
  }

  private converted(value: ExpressionNode, target: ValueKind): string {
    const rendered = this.expression(value);
    if (target === "int" && this.kind(value) === "double") return this.toInteger(rendered).code;
    return rendered.code;
  }

  private forStatement(statement: Extract<StatementNode, { kind: "for" }>): string[] {
    const counterExpression: ExpressionNode = { kind: "identifier", name: statement.variable };
    const counter = this.expression(counterExpression).code;
    const plan = this.forPlan(statement);
    const lines: string[] = [];
    let step = "";
    if (statement.step) {
      if (plan.step !== 1) step = ` STEP ${this.expression(statement.step).code}`;
    } else if (plan.descending === null) {
      const temp = this.temp("paso", "int");
      lines.push(`${temp} = 1`, `IF ${this.expression(statement.start).code} > ${this.expression(statement.end).code} THEN ${temp} = -1`);
      step = ` STEP ${temp}`;
    } else if (plan.descending) {
      step = " STEP -1";
    }
    // FOR ... NEXT evaluates the limit and step once, lets the body change
    // the counter and leaves it one step past the limit, like PSeInt.
    const start = this.converted(statement.start, this.kind(counterExpression));
    return [
      ...lines,
      `FOR ${counter} = ${start} TO ${this.expression(statement.end).code}${step}`,
      ...this.block(statement.body),
      `NEXT ${counter}`,
    ];
  }

  private forEach(statement: Extract<StatementNode, { kind: "forEach" }>): string[] {
    const plan = this.forEachPlan(statement);
    if (!plan) return [`' Para Cada ${statement.variable}: no se pudo traducir`];
    const collection = this.name(plan.collection.name);
    const counters = this.forEachCounters(plan, "int");
    const element = `${collection}(${counters.join(", ")})`;
    const lines = counters.map((counter, index) => {
      const dimension = plan.depth === 1 ? "" : `, ${index + 1}`;
      return `${this.indent.repeat(index)}FOR ${counter} = LBOUND(${collection}${dimension}) TO UBOUND(${collection}${dimension})`;
    });
    const body = this.withAlias(plan.alias.key, element, () => this.block(statement.body, plan.depth));
    const close = [...counters].reverse().map((counter, index) => `${this.indent.repeat(plan.depth - 1 - index)}NEXT ${counter}`);
    return [...lines, ...body, ...close];
  }

  // ---------------------------------------------------------------------------
  // Expressions

  protected toInteger(rendered: Rendered): Rendered {
    return this.fn("FIX", rendered);
  }

  /** Arrays are dimensioned from the pseudocode's base. */
  protected indexShift(): number {
    return 0;
  }

  protected numberLiteral(value: number): Rendered {
    let code = String(value);
    // Literals with decimals are single precision unless marked as DOUBLE.
    if (/e/i.test(code)) code = code.replace(/e\+?/i, "D");
    else if (!Number.isInteger(value) || Math.abs(value) > this.intLimit) code += "#";
    return { code, prec: value < 0 ? PREC.unary : PREC.primary };
  }

  protected stringLiteral(value: string): Rendered {
    const parts: string[] = [];
    let text = "";
    for (const char of value) {
      const point = char.charCodeAt(0);
      if (point < 0x20 || char === '"') {
        if (text) parts.push(`"${text}"`);
        text = "";
        parts.push(`CHR$(${point})`);
      } else {
        text += char;
      }
    }
    if (text || parts.length === 0) parts.push(`"${text}"`);
    return { code: parts.join(" + "), prec: parts.length > 1 ? PREC.additive : PREC.primary };
  }

  protected boolLiteral(value: boolean): Rendered {
    this.uses.add("bool");
    return { code: value ? "VERDADERO" : "FALSO", prec: PREC.primary };
  }

  protected arrayAccess(base: string, indices: Rendered[]): Rendered {
    return { code: `${base}(${indices.map((index) => index.code).join(", ")})`, prec: PREC.primary };
  }

  protected unary(operator: string, operand: ExpressionNode): Rendered {
    if (operator === "-") return { code: `-${wrap(this.expression(operand), PREC.unary)}`, prec: PREC.unary };
    return { code: `NOT ${wrap(this.expression(operand), PREC.not)}`, prec: PREC.not };
  }

  protected binary(operator: string, left: ExpressionNode, right: ExpressionNode): Rendered {
    const isText = this.kind(left) === "string" || this.kind(right) === "string";
    if (operator === "+" && isText) return this.infix(this.asText(left), "+", this.asText(right), PREC.additive);
    if (operator === "^") {
      return { code: `${wrap(this.expression(left), PREC.power)} ^ ${wrap(this.expression(right), PREC.power + 1)}`, prec: PREC.power };
    }
    if (operator === "%" && !(this.isInt(left) && this.isInt(right))) {
      // MOD rounds its operands to integers.
      this.uses.add("resto");
      return this.fn("Resto#", this.byValue(left), this.byValue(right));
    }
    const [symbol, prec] = OPERATORS[operator] ?? [operator, PREC.primary];
    if (isText && prec === PREC.relational) return this.infix(this.asText(left), symbol, this.asText(right), prec);
    return this.infix(this.expression(left), symbol, this.expression(right), prec);
  }

  protected constant(name: "PI" | "EULER"): Rendered {
    return name === "PI" ? { code: "4 * ATN(1)", prec: PREC.multiplicative } : this.fn("EXP", "1");
  }

  private callArgs(routine: RoutineNode, args: ExpressionNode[]): string[] {
    return args.map((arg, index) => {
      const param = this.parameter(routine, index);
      if (!param) return this.expression(arg).code;
      if (param.info.array) {
        return arg.kind === "identifier" ? `${this.name(arg.name)}()` : this.expression(arg).code;
      }
      const kind = this.variableKind(param.info);
      if (!param.byReference) {
        // Variables are passed by reference; parentheses pass a copy.
        const code = this.converted(arg, kind);
        return isAssignable(arg) && this.kind(arg) === kind ? `(${code})` : code;
      }
      if (!this.needsReferenceCopy(arg, kind)) return this.expression(arg).code;
      const holder = this.temp("ref", kind);
      this.pre.push(`${holder} = ${this.converted(arg, kind)}`);
      if (isAssignable(arg)) this.post.push(`${this.expression(arg).code} = ${this.converted({ kind: "identifier", name: holder }, this.kind(arg))}`);
      return holder;
    });
  }

  protected routineCall(routine: RoutineNode, args: ExpressionNode[]): Rendered {
    const rendered = this.callArgs(routine, args);
    const name = this.returnsValue(routine) ? this.functionName(routine) : this.routineName(routine);
    return { code: rendered.length > 0 ? `${name}(${rendered.join(", ")})` : name, prec: PREC.primary };
  }

  protected builtin(name: string, args: ExpressionNode[]): Rendered | null {
    const arg = (index: number) => this.expression(args[index]);
    const plain = (fn: string) => this.fn(fn, arg(0));
    const helper = (fn: string, use: string) => {
      this.uses.add(use);
      return args.length > 0 ? this.fn(fn, ...args.map((value) => this.byValue(value))) : { code: fn, prec: PREC.primary };
    };
    switch (name) {
      case "RC":
      case "RAIZ":
        return plain("SQR");
      case "ABS":
        return plain("ABS");
      case "LN":
        return plain("LOG");
      case "EXP":
        return plain("EXP");
      case "SEN":
      case "SIN":
        return plain("SIN");
      case "COS":
        return plain("COS");
      case "TAN":
        return plain("TAN");
      case "ASEN":
      case "ASIN":
        return helper("ArcSen#", "arcsen");
      case "ACOS":
        return helper("ArcCos#", "arccos");
      case "ATAN":
        return plain("ATN");
      case "TRUNC":
        return plain("FIX");
      case "REDON":
        return helper("Redondear&", "redondear");
      case "FECHAACTUAL":
        return helper("FechaActual&", "fecha_actual");
      case "HORAACTUAL":
        return helper("HoraActual&", "hora_actual");
      case "AZAR":
        this.uses.add("random");
        return this.fn("INT", `RND * ${wrap(this.expression(args[0]), PREC.multiplicative + 1)}`);
      case "ALEATORIO": {
        this.uses.add("random");
        const span = this.expression({
          kind: "binary",
          operator: "+",
          left: { kind: "binary", operator: "-", left: args[1], right: args[0] },
          right: { kind: "literal", value: 1, valueType: "number" },
        });
        return this.infix(this.integer(args[0]), "+", this.fn("INT", `RND * (${span.code})`), PREC.additive);
      }
      case "LONGITUD":
        return this.fn("LEN", this.asText(args[0]));
      case "MAYUSCULAS":
        return this.fn("UCASE$", this.asText(args[0]));
      case "MINUSCULAS":
        return this.fn("LCASE$", this.asText(args[0]));
      case "SUBCADENA": {
        const { from, length } = this.substringBounds(args, 1);
        return this.fn("MID$", this.asText(args[0]), this.integer(from), this.integer(length));
      }
      case "CONCATENAR":
        return this.infix(this.asText(args[0]), "+", this.asText(args[1]), PREC.additive);
      case "CONVERTIRANUMERO":
        return this.fn("VAL", this.asText(args[0]));
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
    const comment = (text: string) => (this.comments ? [`' ${text}`] : []);
    const body = (...lines: string[]) => lines.map((line) => this.indent + line);
    const blocks: string[][] = [];
    const define = (header: string, end: string, text: string, ...lines: string[]) => {
      this.declarations.push(`DECLARE ${header}`);
      blocks.push([...comment(text), header, ...body(...lines), end]);
    };
    if (uses.has("texto")) {
      define(
        "FUNCTION Texto$ (valor AS DOUBLE)",
        "END FUNCTION",
        "Escribe un número como PSeInt: redondeado a 10 decimales, sin espacios.",
        "DIM v AS DOUBLE, t AS STRING",
        "v = valor",
        "IF ABS(v) < 100000 THEN v = FIX(v * 1D+10 + SGN(v) * .5#) / 1D+10",
        "t = LTRIM$(STR$(v))",
        'IF LEFT$(t, 1) = "." THEN t = "0" + t',
        'IF LEFT$(t, 2) = "-." THEN t = "-0" + MID$(t, 2)',
        "Texto$ = t"
      );
    }
    if (uses.has("texto_logico")) {
      define(
        "FUNCTION TextoLogico$ (valor AS INTEGER)",
        "END FUNCTION",
        "Escribe un valor lógico como PSeInt.",
        'IF valor THEN TextoLogico$ = "VERDADERO" ELSE TextoLogico$ = "FALSO"'
      );
    }
    if (uses.has("leer_logico")) {
      define(
        "FUNCTION LeerLogico% ()",
        "END FUNCTION",
        "Lee VERDADERO o FALSO (también V, F, 1 o 0).",
        "DIM t AS STRING",
        "LINE INPUT t",
        "t = UCASE$(LTRIM$(RTRIM$(t)))",
        'LeerLogico% = (t = "VERDADERO" OR t = "V" OR t = "1")'
      );
    }
    if (uses.has("redondear")) {
      define(
        "FUNCTION Redondear& (x AS DOUBLE)",
        "END FUNCTION",
        "Como redon() de PSeInt: redondea alejándose de cero (-2.5 da -3).",
        "Redondear& = SGN(x) * INT(ABS(x) + .5#)"
      );
    }
    if (uses.has("resto")) {
      define(
        "FUNCTION Resto# (a AS DOUBLE, b AS DOUBLE)",
        "END FUNCTION",
        "Resto de una división con decimales (MOD redondea a enteros).",
        "Resto# = a - b * FIX(a / b)"
      );
    }
    if (uses.has("arcsen")) {
      define(
        "FUNCTION ArcSen# (x AS DOUBLE)",
        "END FUNCTION",
        "Arco seno a partir del arco tangente.",
        "IF ABS(x) = 1 THEN ArcSen# = SGN(x) * 2 * ATN(1) ELSE ArcSen# = ATN(x / SQR(1 - x * x))"
      );
    }
    if (uses.has("arccos")) {
      define(
        "FUNCTION ArcCos# (x AS DOUBLE)",
        "END FUNCTION",
        "Arco coseno a partir del arco tangente.",
        "IF x = -1 THEN ArcCos# = 4 * ATN(1) ELSE ArcCos# = 2 * ATN(1) - ATN(x / SQR(1 - x * x))"
      );
    }
    if (uses.has("fecha_actual")) {
      define(
        "FUNCTION FechaActual& ()",
        "END FUNCTION",
        "Fecha actual como el número AAAAMMDD (DATE$ es mm-dd-aaaa).",
        "FechaActual& = VAL(RIGHT$(DATE$, 4)) * 10000 + VAL(LEFT$(DATE$, 2)) * 100 + VAL(MID$(DATE$, 4, 2))"
      );
    }
    if (uses.has("hora_actual")) {
      define(
        "FUNCTION HoraActual& ()",
        "END FUNCTION",
        "Hora actual como el número HHMMSS (TIME$ es hh:mm:ss).",
        "HoraActual& = VAL(LEFT$(TIME$, 2)) * 10000 + VAL(MID$(TIME$, 4, 2)) * 100 + VAL(RIGHT$(TIME$, 2))"
      );
    }
    if (uses.has("esperar")) {
      define(
        "SUB Esperar (milisegundos AS DOUBLE)",
        "END SUB",
        "Espera la cantidad de milisegundos indicada.",
        "DIM inicio AS DOUBLE",
        "inicio = TIMER",
        "DO: LOOP WHILE TIMER - inicio < milisegundos / 1000 AND TIMER >= inicio"
      );
    }
    return blocks;
  }
}
