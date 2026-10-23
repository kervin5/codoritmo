import type {
  AssignableExpressionNode,
  ExpressionNode,
  ProgramNode,
  RoutineNode,
  StatementNode,
  SwitchStatementNode,
} from "../types";
import { makeIdentifier } from "./shared";
import { Rendered, StructuredGenerator, ValueKind, wrap } from "./structured";
import { normalizeName, ScopeTypes, VariableInfo } from "./type-inference";

const PREC = {
  or: 10,
  and: 20,
  not: 25,
  comparison: 30,
  concat: 40,
  additive: 50,
  mod: 55,
  multiplicative: 60,
  unary: 70,
  power: 80,
  primary: 100,
} as const;

const OPERATORS: Record<string, [string, number]> = {
  OR: ["OrElse", PREC.or],
  AND: ["AndAlso", PREC.and],
  "=": ["=", PREC.comparison],
  "<>": ["<>", PREC.comparison],
  "<": ["<", PREC.comparison],
  ">": [">", PREC.comparison],
  "<=": ["<=", PREC.comparison],
  ">=": [">=", PREC.comparison],
  "+": ["+", PREC.additive],
  "-": ["-", PREC.additive],
  "*": ["*", PREC.multiplicative],
  "/": ["/", PREC.multiplicative],
  "%": ["Mod", PREC.mod],
};

// Visual Basic ignores case: translated names (always lowercase) must also
// avoid the helpers and VB functions the generated code calls.
const RESERVED = new Set(
  `addhandler addressof alias and andalso as boolean byref byte byval call case catch
  cbool cbyte cchar cdate cdbl cdec char cint class clng cobj const continue csbyte
  cshort csng cstr ctype cuint culng cushort date decimal declare default delegate
  dim directcast do double each else elseif end endif enum erase error event exit
  false finally for friend function get gettype getxmlnamespace global gosub goto
  handles if implements imports in inherits integer interface is isnot let lib like
  long loop me mod module mustinherit mustoverride mybase myclass namespace narrowing
  new next not nothing notinheritable notoverridable object of on operator option
  optional or orelse out overloads overridable overrides paramarray partial private
  property protected public raiseevent readonly redim rem removehandler resume return
  sbyte select set shadows shared short single static step stop string structure sub
  synclock then throw to true try trycast typeof uinteger ulong ushort using variant
  wend when while widening with withevents writeonly xor
  main console math thread random len mid ucase lcase val fix
  azar texto truncar leerlogico fechaactual horaactual redimensionar`.split(/\s+/)
);

/**
 * Exports pseudocode to Visual Basic .NET: a Module with Sub Main and one
 * Sub or Function per subprocess. Arrays keep the pseudocode's indices
 * (`Dim a(10)` has room for a(1) to a(10)), By-reference parameters are
 * ByRef, and Para maps to For ... Next, which counts like PSeInt.
 */
export class VisualBasicGenerator extends StructuredGenerator {
  protected readonly reserved = RESERVED;
  protected readonly prec = PREC;
  private moduleName = "Programa";

  protected extraNames(): string[] {
    return [this.moduleName.toLowerCase()];
  }

  protected render(program: ProgramNode): string[] {
    const name = makeIdentifier(program.entry.name, RESERVED).replace(/^_+/, "");
    this.moduleName = name ? name[0].toUpperCase() + name.slice(1) : "Programa";
    const routines = [
      this.routine(null, program.entry.body, this.types.main),
      ...program.routines.map((routine) => this.routine(routine, routine.body, this.scopeOf(routine))),
    ];
    const members = [...this.fields(), ...routines, ...this.helpers()];
    const lines = [...this.header(), `Module ${this.moduleName}`];
    members.forEach((member, index) => {
      if (index > 0) lines.push("");
      lines.push(...member.map((line) => (line ? this.indent + line : line)));
    });
    lines.push("End Module");
    return lines;
  }

  // ---------------------------------------------------------------------------
  // Routines and declarations

  private routine(routine: RoutineNode | null, statements: StatementNode[], scope: ScopeTypes): string[] {
    const context = this.enter(routine, statements, scope);
    let header = "Sub Main()";
    let footer = "End Sub";
    if (routine) {
      const params = routine.params.map((param) => {
        const info = scope.vars.get(normalizeName(param.name))!;
        const byRef = param.byReference && !info.array ? "ByRef " : "";
        return `${byRef}${this.name(param.name)}${this.arraySuffix(info)} As ${this.typeName(info)}`;
      });
      const name = this.routineName(routine);
      if (context.returnType) {
        header = `Function ${name}(${params.join(", ")}) As ${this.baseType(this.kindOf(context.returnType))}`;
        footer = "End Function";
      } else {
        header = `Sub ${name}(${params.join(", ")})`;
      }
    }

    const body: string[] = [];
    for (const info of this.locals({ skipAliases: true })) {
      if (context.declaredAtSite.has(info.key)) continue;
      const name = this.name(info.name);
      if (info.array) body.push(`Dim ${name}${this.arraySuffix(info)} As ${this.typeName(info)}`);
      else body.push(`Dim ${name} As ${this.typeName(info)}${this.variableKind(info) === "string" ? ' = ""' : ""}`);
    }
    body.push(...this.block(statements, 0));
    const last = statements[statements.length - 1];
    if (routine && context.returnType && last?.kind !== "return") {
      body.push(
        `Return ${context.returnInfo ? this.identifier(context.returnInfo.name).code : this.defaultValue(this.kindOf(context.returnType))}`
      );
    }
    return [header, ...body.map((line) => (line ? this.indent + line : line)), footer];
  }

  /** `()` or `(,)` after the name of an array declared without a size. */
  private arraySuffix(info: VariableInfo): string {
    return info.array ? `(${",".repeat(info.array.dims.length - 1)})` : "";
  }

  private baseType(kind: ValueKind): string {
    return { int: "Integer", double: "Double", bool: "Boolean", string: "String" }[kind];
  }

  private typeName(info: VariableInfo): string {
    if (this.typeOf({ kind: "identifier", name: info.name }) === "unknown") this.uses.add("sin_tipo");
    return this.baseType(this.variableKind(info));
  }

  private defaultValue(kind: ValueKind): string {
    return { int: "0", double: "0.0", bool: "False", string: '""' }[kind];
  }

  // ---------------------------------------------------------------------------
  // Statements

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
        return statement.targets.map((target) => `${this.expression(target).code} = ${this.readValue(target)}`);
      case "if":
        return this.ifStatement(statement);
      case "while":
        return [`Do While ${this.expression(statement.condition).code}`, ...this.block(statement.body), "Loop"];
      case "repeat":
        return [
          "Do",
          ...this.block(statement.body),
          `Loop ${statement.mode === "until" ? "Until" : "While"} ${this.expression(statement.condition).code}`,
        ];
      case "for":
        return this.forStatement(statement);
      case "forEach":
        return this.forEach(statement);
      case "switch":
        return this.switchStatement(statement);
      case "expression": {
        const expression = statement.expression;
        if (expression.kind === "identifier" && !this.context.scope.vars.has(normalizeName(expression.name))) {
          return [this.call(expression.name, []).code];
        }
        if (expression.kind === "call") return [this.expression(expression).code];
        return this.comments ? [`' ${this.expression(expression).code}`] : [];
      }
      case "clear":
        return ["Console.Clear()"];
      case "wait":
        if (statement.mode === "key") return ["Console.ReadKey(True)"];
        this.uses.add("threading");
        return [`Thread.Sleep(${this.integer(statement.durationMs!).code})`];
      case "return":
        if (!statement.expression || !this.context.returnType) return ["Return"];
        return [`Return ${this.converted(statement.expression, this.kindOf(this.context.returnType))}`];
    }
  }

  private ifStatement(statement: Extract<StatementNode, { kind: "if" }>): string[] {
    const lines = [`If ${this.expression(statement.condition).code} Then`, ...this.block(statement.thenBranch)];
    let otherwise = statement.elseBranch;
    while (otherwise.length === 1 && otherwise[0].kind === "if") {
      const nested = otherwise[0];
      lines.push(`ElseIf ${this.expression(nested.condition).code} Then`, ...this.block(nested.thenBranch));
      otherwise = nested.elseBranch;
    }
    if (otherwise.length > 0) lines.push("Else", ...this.block(otherwise));
    lines.push("End If");
    return lines;
  }

  /** Upper bound for a dimension of `size` elements in the pseudocode's base. */
  private upperBound(size: ExpressionNode): string {
    return this.integer(size, this.settings.baseZeroArrays ? -1 : 0).code;
  }

  private dimension(statement: Extract<StatementNode, { kind: "dimension" }>): string[] {
    const lines: string[] = [];
    for (const item of statement.items) {
      const info = this.context.scope.vars.get(normalizeName(item.name));
      if (!info?.array) continue;
      const name = this.name(item.name);
      const bounds = item.dimensions.map((dimension) => this.upperBound(dimension));
      if (statement.resize) {
        if (info.param) this.warn(statement, "EXPORT_RESIZE_PARAMETER", item.name);
        if (bounds.length === 1) {
          lines.push(`ReDim Preserve ${name}(${bounds[0]})`);
        } else {
          // ReDim Preserve can only change the last dimension.
          this.uses.add("redimensionar");
          lines.push(`${name} = Redimensionar(${name}, ${bounds.join(", ")})`);
        }
        continue;
      }
      if (this.context.declaredAtSite.has(info.key)) {
        lines.push(`Dim ${name}(${bounds.join(", ")}) As ${this.typeName(info)}`);
      } else {
        lines.push(`ReDim ${name}(${bounds.join(", ")})`);
      }
    }
    return lines;
  }

  private write(args: ExpressionNode[], newline: boolean): string[] {
    const method = newline ? "WriteLine" : "Write";
    if (args.length === 0) return newline ? ["Console.WriteLine()"] : [];
    const pieces = args.map((arg) => this.printable(arg));
    const code = pieces.map((piece, index) => (index === 0 ? wrap(piece, PREC.concat) : wrap(piece, PREC.concat + 1))).join(" & ");
    return [`Console.${method}(${code})`];
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
    if (kind === "int") return this.fn("CStr", rendered);
    return this.texto(rendered);
  }

  private readValue(target: AssignableExpressionNode): string {
    switch (this.kind(target)) {
      case "int":
        return "Integer.Parse(Console.ReadLine())";
      case "double":
        this.uses.add("globalization");
        return "Double.Parse(Console.ReadLine(), CultureInfo.InvariantCulture)";
      case "bool":
        this.uses.add("leer_logico");
        return "LeerLogico()";
      default:
        return "Console.ReadLine()";
    }
  }

  /** A value converted for a target of the given type (reals are truncated for Integer). */
  private converted(value: ExpressionNode, target: ValueKind): string {
    const rendered = this.expression(value);
    if (target === "int" && this.kind(value) === "double") return `CInt(Fix(${rendered.code}))`;
    return rendered.code;
  }

  private forStatement(statement: Extract<StatementNode, { kind: "for" }>): string[] {
    const counterExpression: ExpressionNode = { kind: "identifier", name: statement.variable };
    const counter = this.expression(counterExpression).code;
    const plan = this.forPlan(statement);
    let step = "";
    if (statement.step) {
      if (plan.step !== 1) step = ` Step ${this.expression(statement.step).code}`;
    } else if (plan.descending === null) {
      step = ` Step If(${this.expression(statement.start).code} <= ${this.expression(statement.end).code}, 1, -1)`;
    } else if (plan.descending) {
      step = " Step -1";
    }
    // For ... Next evaluates the limit and step once, lets the body change the
    // counter and leaves it one step past the limit, like PSeInt.
    return [
      `For ${counter} = ${this.converted(statement.start, this.kind(counterExpression))} To ${this.expression(statement.end).code}${step}`,
      ...this.block(statement.body),
      "Next",
    ];
  }

  private forEach(statement: Extract<StatementNode, { kind: "forEach" }>): string[] {
    const plan = this.forEachPlan(statement);
    if (!plan) return [`' Para Cada ${statement.variable}: no se pudo traducir`];
    const collection = this.expression(statement.collection).code;
    const counters = this.forEachCounters(plan);
    const element = `${collection}(${counters.join(", ")})`;
    const body = this.withAlias(plan.alias.key, element, () => this.block(statement.body, plan.depth));
    const first = this.settings.baseZeroArrays ? 0 : 1;
    const lines = counters.map((counter, index) => {
      const upper = plan.depth === 1 ? `UBound(${collection})` : `UBound(${collection}, ${index + 1})`;
      return `${this.indent.repeat(index)}For ${counter} As Integer = ${first} To ${upper}`;
    });
    const close = counters.map((_, index) => `${this.indent.repeat(plan.depth - 1 - index)}Next`);
    return [...lines, ...body, ...close];
  }

  private switchStatement(statement: SwitchStatementNode): string[] {
    // Select Case compares numbers and texts alike.
    const lines = [`Select Case ${this.expression(statement.expression).code}`];
    for (const switchCase of statement.cases) {
      lines.push(`${this.indent}Case ${switchCase.values.map((value) => this.expression(value).code).join(", ")}`);
      lines.push(...this.block(switchCase.body, 2));
    }
    if (statement.defaultCase.length > 0) {
      lines.push(`${this.indent}Case Else`, ...this.block(statement.defaultCase, 2));
    }
    lines.push("End Select");
    return lines;
  }

  // ---------------------------------------------------------------------------
  // Expressions

  protected toInteger(rendered: Rendered): Rendered {
    return this.fn("CInt", { code: `Fix(${rendered.code})`, prec: PREC.primary });
  }

  /** Arrays are sized so the pseudocode's indices can be used as they are. */
  protected indexShift(): number {
    return 0;
  }

  protected stringLiteral(value: string): Rendered {
    const named: Record<string, string> = { "\n": "vbLf", "\r": "vbCr", "\t": "vbTab" };
    const parts: string[] = [];
    let text = "";
    for (const char of value) {
      if (char.charCodeAt(0) < 0x20) {
        if (text) parts.push(`"${text}"`);
        text = "";
        parts.push(named[char] ?? `ChrW(${char.charCodeAt(0)})`);
      } else {
        text += char === '"' ? '""' : char;
      }
    }
    if (text || parts.length === 0) parts.push(`"${text}"`);
    return { code: parts.join(" & "), prec: parts.length > 1 ? PREC.concat : PREC.primary };
  }

  protected boolLiteral(value: boolean): Rendered {
    return { code: value ? "True" : "False", prec: PREC.primary };
  }

  protected arrayAccess(base: string, indices: Rendered[]): Rendered {
    return { code: `${base}(${indices.map((index) => index.code).join(", ")})`, prec: PREC.primary };
  }

  protected unary(operator: string, operand: ExpressionNode): Rendered {
    if (operator === "-") return { code: `-${wrap(this.expression(operand), PREC.unary)}`, prec: PREC.unary };
    return { code: `Not ${wrap(this.expression(operand), PREC.not)}`, prec: PREC.not };
  }

  protected binary(operator: string, left: ExpressionNode, right: ExpressionNode): Rendered {
    const isText = this.kind(left) === "string" || this.kind(right) === "string";
    if (operator === "+" && isText) return this.infix(this.asText(left), "&", this.asText(right), PREC.concat);
    if (operator === "^") {
      return { code: `${wrap(this.expression(left), PREC.power)} ^ ${wrap(this.expression(right), PREC.power + 1)}`, prec: PREC.power };
    }
    const [symbol, prec] = OPERATORS[operator] ?? [operator, PREC.primary];
    if (isText && prec === PREC.comparison) return this.infix(this.asText(left), symbol, this.asText(right), prec);
    return this.infix(this.expression(left), symbol, this.expression(right), prec);
  }

  protected constant(name: "PI" | "EULER"): Rendered {
    return { code: name === "PI" ? "Math.PI" : "Math.E", prec: PREC.primary };
  }

  protected routineCall(routine: RoutineNode, args: ExpressionNode[]): Rendered {
    // ByRef copies values of other types in and out by itself.
    const rendered = args.map((arg, index) => {
      const param = this.parameter(routine, index);
      if (!param || param.info.array || param.byReference) return this.expression(arg).code;
      return this.converted(arg, this.variableKind(param.info));
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
        return this.fn("CInt", `Math.Round(${arg(0).code}, MidpointRounding.AwayFromZero)`);
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
        return this.fn("Len", this.asText(args[0]));
      case "MAYUSCULAS":
        return this.fn("UCase", this.asText(args[0]));
      case "MINUSCULAS":
        return this.fn("LCase", this.asText(args[0]));
      case "SUBCADENA": {
        const { from, length } = this.substringBounds(args, 1);
        return this.fn("Mid", this.asText(args[0]), this.integer(from), this.integer(length));
      }
      case "CONCATENAR":
        return this.infix(this.asText(args[0]), "&", this.asText(args[1]), PREC.concat);
      case "CONVERTIRANUMERO":
        return this.fn("Val", this.asText(args[0]));
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
    const lines = this.headerComment("'");
    if (lines.length > 0) lines.push("");
    const imports: string[] = [];
    if (uses.has("globalization")) imports.push("Imports System.Globalization");
    if (uses.has("threading")) imports.push("Imports System.Threading");
    if (imports.length > 0) lines.push(...imports, "");
    if (uses.has("sin_tipo") && this.comments) {
      lines.push(
        "' No se pudo determinar el tipo de algunas variables: se declaran como",
        "' String. Reemplácelo por el tipo adecuado (Integer, Double o Boolean).",
        ""
      );
    }
    return lines;
  }

  private fields(): string[][] {
    return this.uses.has("azar") ? [["Private ReadOnly Azar As New Random()"]] : [];
  }

  private helpers(): string[][] {
    const uses = this.uses;
    const comment = (...text: string[]) => (this.comments ? text.map((line) => `' ${line}`) : []);
    const body = (...lines: string[]) => lines.map((line) => this.indent + line);
    const blocks: string[][] = [];
    if (uses.has("leer_logico")) {
      blocks.push([
        ...comment("Lee VERDADERO o FALSO (también V, F, 1 o 0)."),
        "Function LeerLogico() As Boolean",
        ...body('Dim valor As String = UCase(Trim(Console.ReadLine()))', 'Return valor = "VERDADERO" OrElse valor = "V" OrElse valor = "1"'),
        "End Function",
      ]);
    }
    if (uses.has("texto")) {
      blocks.push([
        ...comment("Escribe un número como PSeInt: con hasta 10 decimales, sin ceros finales."),
        "Function Texto(valor As Double) As String",
        ...body('Return valor.ToString("0.##########", CultureInfo.InvariantCulture)'),
        "End Function",
        "",
        "Function Texto(valor As Boolean) As String",
        ...body('Return If(valor, "VERDADERO", "FALSO")'),
        "End Function",
      ]);
    }
    if (uses.has("truncar")) {
      blocks.push([
        ...comment(
          "Como trunc() de PSeInt: un valor a menos de 1e-11 del entero siguiente",
          "se trunca a ese entero, así trunc(100*0.57) da 57 y no 56."
        ),
        "Function Truncar(x As Double) As Integer",
        ...body(
          "Dim t As Integer = CInt(Fix(x))",
          "If t + 1 - x < 0.00000000001 Then Return t + 1",
          "If t - 1 - x > -0.00000000001 Then Return t - 1",
          "Return t"
        ),
        "End Function",
      ]);
    }
    if (uses.has("fecha_actual")) {
      blocks.push([
        ...comment("Fecha actual como el número AAAAMMDD."),
        "Function FechaActual() As Integer",
        ...body("Return Now.Year * 10000 + Now.Month * 100 + Now.Day"),
        "End Function",
      ]);
    }
    if (uses.has("hora_actual")) {
      blocks.push([
        ...comment("Hora actual como el número HHMMSS."),
        "Function HoraActual() As Integer",
        ...body("Return Now.Hour * 10000 + Now.Minute * 100 + Now.Second"),
        "End Function",
      ]);
    }
    if (uses.has("redimensionar")) {
      blocks.push([
        ...comment("Redimensionar una matriz conservando los valores que siguen dentro."),
        "Function Redimensionar(Of T)(viejo As T(,), n As Integer, m As Integer) As T(,)",
        ...body(
          "Dim nuevo(n, m) As T",
          "If viejo IsNot Nothing Then",
          `${this.indent}For i As Integer = 0 To Math.Min(n, viejo.GetUpperBound(0))`,
          `${this.indent.repeat(2)}For j As Integer = 0 To Math.Min(m, viejo.GetUpperBound(1))`,
          `${this.indent.repeat(3)}nuevo(i, j) = viejo(i, j)`,
          `${this.indent.repeat(2)}Next`,
          `${this.indent}Next`,
          "End If",
          "Return nuevo"
        ),
        "End Function",
      ]);
    }
    return blocks;
  }
}
