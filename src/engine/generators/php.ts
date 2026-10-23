import type {
  AssignableExpressionNode,
  ExpressionNode,
  ProgramNode,
  RoutineNode,
  StatementNode,
  SwitchStatementNode,
} from "../types";
import { containsCall, invertCondition, isAssignable, makeIdentifier, uninitializedReads, writesVariable } from "./shared";
import { Rendered, StructuredGenerator, ValueKind, wrap } from "./structured";
import { normalizeName, ScopeTypes } from "./type-inference";

const PREC = {
  ternary: 20,
  or: 30,
  and: 40,
  equality: 50,
  relational: 60,
  concat: 65,
  additive: 70,
  multiplicative: 80,
  unary: 90,
  power: 95,
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

/** Variables carry a `$`: only these names are off limits for them. */
const RESERVED_VARIABLES = new Set(["this", "globals"]);

/**
 * Function names live with PHP's keywords and global functions: the keywords,
 * the helpers and the most common functions a subprocess could be named after.
 */
const RESERVED_FUNCTIONS = new Set(
  `abstract and array as break callable case catch class clone const continue declare
  default die do echo else elseif empty enddeclare endfor endforeach endif endswitch
  endwhile enum eval exit extends final finally fn for foreach function global goto
  if implements include include_once instanceof insteadof interface isset list match
  namespace new or print private protected public readonly require require_once
  return static switch throw trait try unset use var while xor yield parent self
  true false null int float bool string iterable object mixed void never
  abs max min sort count sum round floor ceil pow sqrt rand date time sleep strlen
  substr implode explode trim range shuffle print_r printf sprintf key next reset
  current end each fgets fopen mb_strlen
  texto truncar leer_logico redimensionar`.split(/\s+/)
);

/**
 * Exports pseudocode to PHP for the command line. Subprocesses become
 * functions and the algorithm the script's main code. Arrays keep the
 * pseudocode's indices (`array_fill(1, 10, 0)`) and are passed by reference
 * (`&$v`), since PHP would copy them; so are by-reference parameters.
 */
export class PhpGenerator extends StructuredGenerator {
  protected readonly reserved = RESERVED_VARIABLES;
  protected readonly prec = PREC;
  protected readonly intLimit = Number.MAX_SAFE_INTEGER;

  protected routineIdentifier(name: string): string {
    return makeIdentifier(name, RESERVED_FUNCTIONS);
  }

  protected render(program: ProgramNode): string[] {
    const functions = program.routines.map((routine) => this.routine(routine, routine.body, this.scopeOf(routine)));
    const main = this.routine(null, program.entry.body, this.types.main);
    const lines = ["<?php", ...this.headerComment("//")];
    for (const block of [...this.helpers(), ...functions]) lines.push("", ...block);
    lines.push("", ...main);
    return lines;
  }

  // ---------------------------------------------------------------------------
  // Routines

  private routine(routine: RoutineNode | null, statements: StatementNode[], scope: ScopeTypes): string[] {
    const context = this.enter(routine, statements, scope);
    const body: string[] = [];
    // Reading a variable before assigning it is a warning in PHP: those
    // variables start with the default value of their type.
    for (const key of [...uninitializedReads(statements, scope)].sort()) {
      const info = scope.vars.get(key)!;
      if (!info.array) body.push(`${this.variable(this.name(info.name)).code} = ${this.defaultValue(this.variableKind(info))};`);
    }
    body.push(...this.block(statements, 0));
    if (!routine) return body;

    const last = statements[statements.length - 1];
    if (context.returnType && last?.kind !== "return") {
      body.push(
        `return ${context.returnInfo ? this.identifier(context.returnInfo.name).code : this.defaultValue(this.kindOf(context.returnType))};`
      );
    }
    const params = routine.params.map((param) => {
      const info = scope.vars.get(normalizeName(param.name))!;
      return `${param.byReference || info.array ? "&" : ""}$${this.name(param.name)}`;
    });
    return [
      `function ${this.routineName(routine)}(${params.join(", ")})`,
      "{",
      ...body.map((line) => (line ? this.indent + line : line)),
      "}",
    ];
  }

  private defaultValue(kind: ValueKind): string {
    return { int: "0", double: "0.0", bool: "false", string: "''" }[kind];
  }

  // ---------------------------------------------------------------------------
  // Statements

  private braces(header: string, body: string[]): string[] {
    return [`${header} {`, ...body, "}"];
  }

  private condition(expression: ExpressionNode): { code: string; setup: string[] } {
    const { value, pre, post } = this.capture(() => this.expression(expression));
    if (post.length === 0) return { code: value.code, setup: pre };
    const temp = this.variable(this.temp("condicion")).code;
    return { code: temp, setup: [...pre, `${temp} = ${value.code};`, ...post] };
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
          ...[...exit.setup, `if (${exit.code}) {`, `${this.indent}break;`, "}"].map((line) => this.indent + line),
          ...this.block(statement.body),
        ]);
      }
      case "repeat": {
        const body = this.block(statement.body);
        const until = statement.mode === "until" ? statement.condition : invertCondition(statement.condition);
        const exit = this.condition(until);
        if (exit.setup.length === 0) {
          return ["do {", ...body, `} while (${this.expression(invertCondition(until)).code});`];
        }
        return this.braces("while (true)", [
          ...body,
          ...[...exit.setup, `if (${exit.code}) {`, `${this.indent}break;`, "}"].map((line) => this.indent + line),
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
        return [`${this.expression(expression).code};`];
      }
      case "clear":
        return [`echo "\\033[2J\\033[H";${this.comments ? " // secuencia ANSI que borra la terminal" : ""}`];
      case "wait":
        if (statement.mode === "key") return [`fgets(STDIN);${this.comments ? " // espera un Enter" : ""}`];
        return [`usleep(${this.toInteger({ code: `${wrap(this.expression(statement.durationMs!), PREC.multiplicative)} * 1000`, prec: PREC.multiplicative }).code});`];
      case "return":
        if (!statement.expression || !this.context.returnType) return ["return;"];
        return [`return ${this.converted(statement.expression, this.kindOf(this.context.returnType))};`];
    }
  }

  private ifStatement(statement: Extract<StatementNode, { kind: "if" }>): string[] {
    const first = this.condition(statement.condition);
    const lines = [...first.setup, `if (${first.code}) {`, ...this.block(statement.thenBranch)];
    let otherwise = statement.elseBranch;
    while (otherwise.length === 1 && otherwise[0].kind === "if") {
      const nested = otherwise[0];
      const next = this.condition(nested.condition);
      if (next.setup.length > 0) break;
      lines.push(`} elseif (${next.code}) {`, ...this.block(nested.thenBranch));
      otherwise = nested.elseBranch;
    }
    if (otherwise.length > 0) lines.push("} else {", ...this.block(otherwise));
    lines.push("}");
    return lines;
  }

  private dimension(statement: Extract<StatementNode, { kind: "dimension" }>): string[] {
    const base = this.settings.baseZeroArrays ? 0 : 1;
    const lines: string[] = [];
    for (const item of statement.items) {
      const info = this.context.scope.vars.get(normalizeName(item.name));
      if (!info?.array) continue;
      const name = this.variable(this.name(item.name)).code;
      const fill = this.defaultValue(this.variableKind(info));
      const sizes = item.dimensions.map((dimension) => this.integer(dimension).code);
      if (statement.resize) {
        if (info.param) this.warn(statement, "EXPORT_RESIZE_PARAMETER", item.name);
        this.uses.add("redimensionar");
        lines.push(`${name} = redimensionar(${name}, [${sizes.join(", ")}], ${fill});`);
        continue;
      }
      // array_fill copies the inner array into every row.
      let value = fill;
      for (const size of [...sizes].reverse()) value = `array_fill(${base}, ${size}, ${value})`;
      lines.push(`${name} = ${value};`);
    }
    return lines;
  }

  private write(args: ExpressionNode[], newline: boolean): string[] {
    const parts = args.map((arg) => this.capture(() => this.printable(arg)));
    if (parts.some((part) => part.pre.length > 0 || part.post.length > 0)) {
      const lines = parts.flatMap((part) => [...part.pre, `echo ${part.value.code};`, ...part.post]);
      return newline ? [...lines, "echo PHP_EOL;"] : lines;
    }
    const values = [...parts.map((part) => part.value.code), ...(newline ? ["PHP_EOL"] : [])];
    return values.length > 0 ? [`echo ${values.join(", ")};`] : [];
  }

  /** A value as PSeInt writes it: reals with up to 10 decimals, VERDADERO/FALSO. */
  private printable(arg: ExpressionNode): Rendered {
    const kind = this.kind(arg);
    const rendered = this.expression(arg);
    return kind === "double" || kind === "bool" ? this.texto(rendered) : rendered;
  }

  private texto(rendered: Rendered): Rendered {
    this.uses.add("texto");
    return this.fn("texto", rendered);
  }

  private asText(expression: ExpressionNode): Rendered {
    const kind = this.kind(expression);
    const rendered = this.expression(expression);
    if (kind === "string") return rendered;
    if (kind === "int") return { code: `(string) ${wrap(rendered, PREC.unary)}`, prec: PREC.unary };
    return this.texto(rendered);
  }

  private readValue(target: AssignableExpressionNode): string {
    switch (this.kind(target)) {
      case "int":
        return "(int) fgets(STDIN)";
      case "double":
        return "(float) fgets(STDIN)";
      case "bool":
        this.uses.add("leer_logico");
        return "leer_logico()";
      default:
        return 'rtrim(fgets(STDIN), "\\r\\n")';
    }
  }

  private converted(value: ExpressionNode, target: ValueKind): string {
    const rendered = this.expression(value);
    if (target === "int" && this.kind(value) === "double") return this.toInteger(rendered).code;
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
    // Walking by reference (&$x) lets the body change the elements.
    const byReference = writesVariable(statement.body, plan.alias.key, this.inference);
    const ref = byReference ? "&" : "";
    const lines: string[] = [];
    const references: string[] = [];
    let element = this.expression(statement.collection).code;
    for (let index = 0; index < plan.depth; index += 1) {
      const item =
        index === plan.depth - 1
          ? this.variable(this.name(plan.alias.name)).code
          : this.variable(this.temp(`${this.name(plan.collection.name)}_fila`)).code;
      lines.push(`${this.indent.repeat(index)}foreach (${element} as ${ref}${item}) {`);
      references.push(item);
      element = item;
    }
    const body = this.block(statement.body, plan.depth);
    const close = Array.from({ length: plan.depth }, (_, index) => `${this.indent.repeat(plan.depth - 1 - index)}}`);
    const unset = byReference ? [`unset(${references.reverse().join(", ")});`] : [];
    return [...lines, ...body, ...close, ...unset];
  }

  private switchStatement(statement: SwitchStatementNode): string[] {
    if (this.switchCases(statement)) {
      const lines = [`switch (${this.expression(statement.expression).code}) {`];
      for (const switchCase of statement.cases) {
        for (const value of switchCase.values) lines.push(`${this.indent}case ${this.expression(value).code}:`);
        lines.push(...this.block(switchCase.body, 2), `${this.indent.repeat(2)}break;`);
      }
      if (statement.defaultCase.length > 0) {
        lines.push(`${this.indent}default:`, ...this.block(statement.defaultCase, 2));
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
      lines.push(`${this.variable(temp).code} = ${this.expression(control).code};`);
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
        result.push(`${index === 0 ? "" : "} else"}if (${condition}) {`, ...this.block(switchCase.body));
      });
      if (statement.defaultCase.length > 0) result.push("} else {", ...this.block(statement.defaultCase));
      result.push("}");
      return result;
    };
    lines.push(...(temp ? this.withAlias(normalizeName(temp), this.variable(temp).code, branches) : branches()));
    return lines;
  }

  // ---------------------------------------------------------------------------
  // Expressions

  protected toInteger(rendered: Rendered): Rendered {
    return { code: `(int) ${wrap(rendered, PREC.unary)}`, prec: PREC.unary };
  }

  /** Arrays are filled from the pseudocode's base, so its indices are used as they are. */
  protected indexShift(): number {
    return 0;
  }

  protected variable(name: string): Rendered {
    return { code: `$${name}`, prec: PREC.primary };
  }

  protected stringLiteral(value: string): Rendered {
    if (!/[\x00-\x1f]/.test(value)) {
      return { code: `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`, prec: PREC.primary };
    }
    const named: Record<string, string> = { "\n": "\\n", "\r": "\\r", "\t": "\\t" };
    let escaped = "";
    for (const char of value) {
      const code = char.charCodeAt(0);
      if (char === "\\" || char === '"' || char === "$") escaped += `\\${char}`;
      else if (code < 0x20) escaped += named[char] ?? `\\x${code.toString(16).padStart(2, "0")}`;
      else escaped += char;
    }
    return { code: `"${escaped}"`, prec: PREC.primary };
  }

  protected boolLiteral(value: boolean): Rendered {
    return { code: value ? "true" : "false", prec: PREC.primary };
  }

  protected arrayAccess(base: string, indices: Rendered[]): Rendered {
    return { code: `${base}${indices.map((index) => `[${index.code}]`).join("")}`, prec: PREC.primary };
  }

  protected unary(operator: string, operand: ExpressionNode): Rendered {
    const rendered = this.expression(operand);
    if (operator === "-") {
      const code = rendered.code.startsWith("-") ? `(${rendered.code})` : wrap(rendered, PREC.unary);
      return { code: `-${code}`, prec: PREC.unary };
    }
    return { code: `!${wrap(rendered, PREC.unary)}`, prec: PREC.unary };
  }

  protected binary(operator: string, left: ExpressionNode, right: ExpressionNode, typedAs?: ExpressionNode): Rendered {
    const isText = this.kind(typedAs ?? left) === "string" || this.kind(right) === "string";
    if (operator === "+" && isText) return this.infix(this.asText(left), ".", this.asText(right), PREC.concat);
    if (isText && (operator === "=" || operator === "<>")) {
      // Strict comparison: "1e3" == "1000" is true in PHP.
      return this.infix(this.asText(left), operator === "=" ? "===" : "!==", this.asText(right), PREC.equality);
    }
    if (isText && ["<", ">", "<=", ">="].includes(operator)) {
      return { code: `strcmp(${this.asText(left).code}, ${this.asText(right).code}) ${operator} 0`, prec: PREC.relational };
    }
    if (operator === "^") {
      return { code: `${wrap(this.expression(left), PREC.power + 1)} ** ${wrap(this.expression(right), PREC.unary)}`, prec: PREC.power };
    }
    if (operator === "%" && !(this.isInt(left) && this.isInt(right))) {
      // % works on integers only; fmod keeps the decimals (and the dividend's sign).
      return this.fn("fmod", this.expression(left), this.expression(right));
    }
    const [symbol, prec] = OPERATORS[operator] ?? [operator, PREC.primary];
    return this.infix(this.expression(left), symbol, this.expression(right), prec);
  }

  protected constant(name: "PI" | "EULER"): Rendered {
    return { code: name === "PI" ? "M_PI" : "M_E", prec: PREC.primary };
  }

  protected routineCall(routine: RoutineNode, args: ExpressionNode[]): Rendered {
    const rendered = args.map((arg, index) => {
      const param = this.parameter(routine, index);
      if (!param || param.info.array) return this.expression(arg).code;
      if (!param.byReference) return this.converted(arg, this.variableKind(param.info));
      if (isAssignable(arg)) return this.expression(arg).code;
      // Only variables can be passed by reference.
      const holder = this.variable(this.temp("ref")).code;
      this.pre.push(`${holder} = ${this.expression(arg).code};`);
      return holder;
    });
    return { code: `${this.routineName(routine)}(${rendered.join(", ")})`, prec: PREC.primary };
  }

  protected builtin(name: string, args: ExpressionNode[]): Rendered | null {
    const arg = (index: number) => this.expression(args[index]);
    const math = (fn: string) => this.fn(fn, arg(0));
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
        this.uses.add("truncar");
        return this.fn("truncar", arg(0));
      case "REDON":
        // round() already rounds halves away from zero, like PSeInt.
        return this.toInteger(this.fn("round", arg(0)));
      case "FECHAACTUAL":
        return { code: "(int) date('Ymd')", prec: PREC.unary };
      case "HORAACTUAL":
        return { code: "(int) date('His')", prec: PREC.unary };
      case "AZAR":
        return this.fn("rand", "0", this.integer(args[0], -1));
      case "ALEATORIO":
        return this.fn("rand", this.integer(args[0]), this.integer(args[1]));
      case "LONGITUD":
        return this.fn("mb_strlen", this.asText(args[0]));
      case "MAYUSCULAS":
        return this.fn("mb_strtoupper", this.asText(args[0]));
      case "MINUSCULAS":
        return this.fn("mb_strtolower", this.asText(args[0]));
      case "SUBCADENA": {
        const { from, length } = this.substringBounds(args, 0);
        return this.fn("mb_substr", this.asText(args[0]), this.integer(from), this.integer(length));
      }
      case "CONCATENAR":
        return this.infix(this.asText(args[0]), ".", this.asText(args[1]), PREC.concat);
      case "CONVERTIRANUMERO":
        return this.fn("floatval", this.asText(args[0]));
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
    const fn = (signature: string, ...lines: string[]) => [signature, "{", ...lines.map((line) => this.indent + line), "}"];
    const blocks: string[][] = [];
    if (uses.has("texto")) {
      blocks.push([
        ...comment("Escribe un valor como PSeInt: los reales con hasta 10 decimales, VERDADERO o FALSO."),
        ...fn(
          "function texto($valor)",
          "if (is_bool($valor)) {",
          `${this.indent}return $valor ? 'VERDADERO' : 'FALSO';`,
          "}",
          "if (!is_float($valor) || is_nan($valor) || is_infinite($valor)) {",
          `${this.indent}return (string) $valor;`,
          "}",
          "$texto = rtrim(rtrim(number_format($valor, 10, '.', ''), '0'), '.');",
          "return $texto === '-0' ? '0' : $texto;"
        ),
      ]);
    }
    if (uses.has("truncar")) {
      blocks.push([
        ...comment("Como trunc() de PSeInt: trunc(100*0.57) da 57 y no 56."),
        ...fn(
          "function truncar($x)",
          "$t = (int) $x;",
          "if ($t + 1 - $x < 1e-11) {",
          `${this.indent}return $t + 1;`,
          "}",
          "if ($t - 1 - $x > -1e-11) {",
          `${this.indent}return $t - 1;`,
          "}",
          "return $t;"
        ),
      ]);
    }
    if (uses.has("leer_logico")) {
      blocks.push([
        ...comment("Lee VERDADERO o FALSO (también V, F, 1 o 0)."),
        ...fn(
          "function leer_logico()",
          "$valor = strtoupper(trim((string) fgets(STDIN)));",
          "return $valor === 'VERDADERO' || $valor === 'V' || $valor === '1';"
        ),
      ]);
    }
    if (uses.has("redimensionar")) {
      const base = this.settings.baseZeroArrays ? 0 : 1;
      blocks.push([
        ...comment("Cambia el tamaño de un arreglo conservando los valores que siguen dentro."),
        ...fn(
          "function redimensionar($viejo, $tamanos, $valor)",
          "$nuevo = [];",
          "$n = array_shift($tamanos);",
          `for ($i = ${base}; $i < ${base} + $n; $i++) {`,
          `${this.indent}$anterior = $viejo[$i] ?? null;`,
          `${this.indent}if ($tamanos) {`,
          `${this.indent.repeat(2)}$nuevo[$i] = redimensionar(is_array($anterior) ? $anterior : [], $tamanos, $valor);`,
          `${this.indent}} else {`,
          `${this.indent.repeat(2)}$nuevo[$i] = $anterior ?? $valor;`,
          `${this.indent}}`,
          "}",
          "return $nuevo;"
        ),
      ]);
    }
    return blocks;
  }
}
