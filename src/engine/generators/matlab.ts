import type {
  AssignableExpressionNode,
  ExpressionNode,
  ProgramNode,
  RoutineNode,
  StatementNode,
} from "../types";
import { invertCondition, isAssignable, makeIdentifier, offsetExpression, uninitializedReads, walk, writesVariable } from "./shared";
import { Rendered, StructuredGenerator, ValueKind, wrap } from "./structured";
import { normalizeName, ScopeTypes, VariableInfo } from "./type-inference";

const PREC = {
  or: 10,
  and: 20,
  comparison: 30,
  additive: 40,
  multiplicative: 50,
  unary: 60,
  power: 70,
  primary: 100,
} as const;

const OPERATORS: Record<string, [string, number]> = {
  OR: ["||", PREC.or],
  AND: ["&&", PREC.and],
  "=": ["==", PREC.comparison],
  "<>": ["~=", PREC.comparison],
  "<": ["<", PREC.comparison],
  ">": [">", PREC.comparison],
  "<=": ["<=", PREC.comparison],
  ">=": [">=", PREC.comparison],
  "+": ["+", PREC.additive],
  "-": ["-", PREC.additive],
  "*": ["*", PREC.multiplicative],
  "/": ["/", PREC.multiplicative],
};

const RESERVED = new Set(
  `break case catch classdef continue else elseif end for function global if otherwise
  parfor persistent return spmd switch try while true false pi ans
  abs acos asin atan cell char clc clock cos disp exp fix fprintf input iscell ischar
  islogical isnan isinf length log lower max min num2str numel pause randi regexprep rem
  repmat round sin size sprintf sqrt str2double strcmp tan upper zeros
  texto leer_logico comparar_texto redimensionar fecha_actual hora_actual`.split(/\s+/)
);

/** What a call needs to know about a function: its outputs. */
interface Signature {
  /** Name of the variable holding the result, when the function returns one. */
  result: string | null;
  /** Parameters returned after the result: by-reference scalars and changed arrays. */
  outputs: number[];
}

/**
 * Exports pseudocode to a MatLab/Octave function file: the algorithm is the
 * main function and subprocesses are local functions after it. MatLab passes
 * everything by value, so by-reference parameters and arrays a function
 * changes are returned as extra outputs and assigned back by the caller
 * (`[r, x] = siguiente(x)`). Texts are char arrays; arrays of texts are cells.
 */
export class MatLabGenerator extends StructuredGenerator {
  protected readonly reserved = RESERVED;
  protected readonly prec = PREC;
  protected readonly intLimit = Number.MAX_SAFE_INTEGER;
  private mainName = "programa";
  private signatures = new Map<string, Signature>();

  protected extraNames(): string[] {
    return [this.mainName];
  }

  protected render(program: ProgramNode): string[] {
    this.mainName = makeIdentifier(program.entry.name, RESERVED).replace(/^_+/, "") || "programa";
    this.signatures = new Map();
    for (const routine of program.routines) {
      const scope = this.scopeOf(routine);
      const returns = Boolean(scope.returnKey) || scope.returnType !== "unknown";
      this.signatures.set(normalizeName(routine.name), {
        result: returns ? (scope.returnKey ? this.name(scope.vars.get(scope.returnKey)!.name) : "resultado") : null,
        outputs: routine.params.flatMap((param, index) => {
          const info = scope.vars.get(normalizeName(param.name));
          if (info?.array) return this.changesArray(routine.body, info.key) ? [index] : [];
          return param.byReference ? [index] : [];
        }),
      });
    }

    const main = this.routine(null, program.entry.body, this.types.main);
    const functions = program.routines.map((routine) => this.routine(routine, routine.body, this.scopeOf(routine)));
    const lines = [...main];
    for (const block of [...functions, ...this.helpers()]) lines.push("", ...block);
    return lines;
  }

  /** Whether a function's body may change the elements (or size) of array `key`. */
  private changesArray(statements: StatementNode[], key: string): boolean {
    let found = false;
    const isElement = (expression: ExpressionNode) =>
      expression.kind === "arrayAccess" &&
      expression.target.kind === "identifier" &&
      normalizeName(expression.target.name) === key;
    walk(statements, (node) => {
      if (found) return;
      const value = node as StatementNode | ExpressionNode;
      switch (value.kind) {
        case "assignment":
          found = isElement(value.target);
          break;
        case "read":
          found = value.targets.some(isElement);
          break;
        case "dimension":
          found = value.items.some((item) => normalizeName(item.name) === key);
          break;
        case "call":
          // Handed to another subprocess, which may change it.
          found = value.args.some((arg) => arg.kind === "identifier" && normalizeName(arg.name) === key);
          break;
        case "forEach":
          found =
            value.collection.kind === "identifier" &&
            normalizeName(value.collection.name) === key &&
            writesVariable(value.body, normalizeName(value.variable), this.inference);
          break;
      }
    });
    return found;
  }

  // ---------------------------------------------------------------------------
  // Functions

  private signature(routine: RoutineNode): Signature {
    return this.signatures.get(normalizeName(routine.name))!;
  }

  private routine(routine: RoutineNode | null, statements: StatementNode[], scope: ScopeTypes): string[] {
    const signature = routine ? this.signature(routine) : null;
    const context = this.enter(routine, statements, scope, signature?.result ? [signature.result] : []);
    const body: string[] = [];
    if (!routine) body.push(...this.headerComment("%"));
    // Reading a variable before assigning it is an error: those variables
    // start with the default value of their type, as in PSeInt.
    for (const key of [...uninitializedReads(statements, scope)].sort()) {
      const info = scope.vars.get(key)!;
      if (!info.array) body.push(`${this.name(info.name)} = ${this.defaultValue(this.variableKind(info))};`);
    }
    if (signature?.result && !scope.returnKey && context.returnType) {
      body.push(`${signature.result} = ${this.defaultValue(this.kindOf(context.returnType))};`);
    }
    body.push(...this.block(statements, 0));

    let header = `function ${this.mainName}()`;
    if (routine && signature) {
      const outputs = [
        ...(signature.result ? [signature.result] : []),
        ...signature.outputs.map((index) => this.name(routine.params[index].name)),
      ];
      const params = routine.params.map((param) => this.name(param.name)).join(", ");
      const assigned = outputs.length === 0 ? "" : outputs.length === 1 ? `${outputs[0]} = ` : `[${outputs.join(", ")}] = `;
      header = `function ${assigned}${this.routineName(routine)}(${params})`;
    }
    return [header, ...body.map((line) => (line ? this.indent + line : line)), "end"];
  }

  private defaultValue(kind: ValueKind): string {
    return { int: "0", double: "0", bool: "false", string: "''" }[kind];
  }

  // ---------------------------------------------------------------------------
  // Statements

  /** A condition plus the statements that must run right before testing it. */
  private condition(expression: ExpressionNode): { code: string; setup: string[] } {
    const { value, pre, post } = this.capture(() => this.expression(expression));
    if (pre.length === 0 && post.length === 0) return { code: value.code, setup: [] };
    const temp = this.temp("condicion");
    return { code: temp, setup: [...pre, `${temp} = ${value.code};`, ...post] };
  }

  private breakIf(code: string): string[] {
    return [`if ${code}`, `${this.indent}break;`, "end"];
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
        const test = this.condition(statement.condition);
        if (test.setup.length === 0) return [`while ${test.code}`, ...this.block(statement.body), "end"];
        const exit = this.condition(invertCondition(statement.condition));
        return [
          "while true",
          ...[...exit.setup, ...this.breakIf(exit.code)].map((line) => this.indent + line),
          ...this.block(statement.body),
          "end",
        ];
      }
      case "repeat": {
        // MatLab has no do-while loop.
        const until = statement.mode === "until" ? statement.condition : invertCondition(statement.condition);
        const body = this.block(statement.body);
        const exit = this.condition(until);
        return ["while true", ...body, ...[...exit.setup, ...this.breakIf(exit.code)].map((line) => this.indent + line), "end"];
      }
      case "for":
        return this.forStatement(statement);
      case "forEach":
        return this.forEach(statement);
      case "switch": {
        const lines = [`switch ${this.expression(statement.expression).code}`];
        for (const switchCase of statement.cases) {
          const values = switchCase.values.map((value) => this.expression(value).code);
          lines.push(`${this.indent}case ${values.length === 1 ? values[0] : `{${values.join(", ")}}`}`);
          lines.push(...this.block(switchCase.body, 2));
        }
        if (statement.defaultCase.length > 0) lines.push(`${this.indent}otherwise`, ...this.block(statement.defaultCase, 2));
        lines.push("end");
        return lines;
      }
      case "expression":
        return this.expressionStatement(statement.expression);
      case "clear":
        return ["clc;"];
      case "wait":
        if (statement.mode === "key") return ["pause;"];
        return [`pause(${wrap(this.expression(statement.durationMs!), PREC.multiplicative)} / 1000);`];
      case "return": {
        const result = this.context.routine ? this.signature(this.context.routine).result : null;
        if (!statement.expression || !result) return ["return;"];
        return [`${result} = ${this.converted(statement.expression, this.kindOf(this.context.returnType!))};`, "return;"];
      }
    }
  }

  private expressionStatement(expression: ExpressionNode): string[] {
    const name = expression.kind === "identifier" ? expression.name : expression.kind === "call" ? expression.callee : null;
    const routine = name && !this.context.scope.vars.has(normalizeName(name)) ? this.inference.findRoutine(name) : undefined;
    if (!routine) return [`${this.expression(expression).code};`];
    const args = expression.kind === "call" ? expression.args : [];
    const signature = this.signature(routine);
    const call = `${this.routineName(routine)}(${this.callArgs(args)})`;
    const targets = signature.outputs.map((index) => this.outputTarget(args[index]));
    if (targets.length === 0) return [`${call};`];
    if (signature.result) targets.unshift("~");
    return [`${targets.length === 1 ? targets[0] : `[${targets.join(", ")}]`} = ${call};`];
  }

  private ifStatement(statement: Extract<StatementNode, { kind: "if" }>): string[] {
    const first = this.condition(statement.condition);
    const lines = [...first.setup, `if ${first.code}`, ...this.block(statement.thenBranch)];
    let otherwise = statement.elseBranch;
    while (otherwise.length === 1 && otherwise[0].kind === "if") {
      const nested = otherwise[0];
      const next = this.condition(nested.condition);
      if (next.setup.length > 0) break;
      lines.push(`elseif ${next.code}`, ...this.block(nested.thenBranch));
      otherwise = nested.elseBranch;
    }
    if (otherwise.length > 0) lines.push("else", ...this.block(otherwise));
    lines.push("end");
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
      if (sizes.length === 1) sizes.unshift("1");
      if (statement.resize) {
        if (sizes.length > 2) {
          this.warn(statement, "EXPORT_RESIZE_DIMENSIONS", item.name);
          lines.push(`% Redimensionar ${item.name}: no se pudo traducir`);
          continue;
        }
        if (info.param) this.warn(statement, "EXPORT_RESIZE_PARAMETER", item.name);
        this.uses.add("redimensionar");
        lines.push(`${name} = redimensionar(${name}, [${sizes.join(", ")}], ${this.defaultValue(kind)});`);
        continue;
      }
      const value =
        kind === "string"
          ? `repmat({''}, ${sizes.join(", ")})`
          : `${kind === "bool" ? "false" : "zeros"}(${sizes.join(", ")})`;
      lines.push(`${name} = ${value};`);
    }
    return lines;
  }

  private write(args: ExpressionNode[], newline: boolean): string[] {
    const parts = args.map((arg) => this.capture(() => this.piece(arg)));
    if (parts.some((part) => part.pre.length > 0 || part.post.length > 0)) {
      const lines = parts.flatMap((part) => [...part.pre, this.fprintf([part.value], false), ...part.post]);
      return newline ? [...lines, "fprintf('\\n');"] : lines;
    }
    if (parts.length === 0 && !newline) return [];
    return [this.fprintf(parts.map((part) => part.value), newline)];
  }

  private fprintf(pieces: { format: string; value?: string }[], newline: boolean): string {
    const format = pieces.map((piece) => piece.format).join("") + (newline ? "\\n" : "");
    const values = pieces.flatMap((piece) => (piece.value ? [piece.value] : []));
    return `fprintf(${["'" + format + "'", ...values].join(", ")});`;
  }

  /** One value of Escribir: literal texts go into the format itself. */
  private piece(arg: ExpressionNode): { format: string; value?: string } {
    if (arg.kind === "literal" && arg.valueType === "string") {
      const text = String(arg.value);
      let format = "";
      for (const char of text) {
        const point = char.charCodeAt(0);
        if (char === "%") format += "%%";
        else if (char === "\\") format += "\\\\";
        else if (char === "'") format += "''";
        else if (char === "\n") format += "\\n";
        else if (char === "\t") format += "\\t";
        else if (point < 0x20) format += `\\x${point.toString(16)}`;
        else format += char;
      }
      return { format };
    }
    const kind = this.kind(arg);
    if (kind === "int") return { format: "%d", value: this.expression(arg).code };
    return { format: "%s", value: this.asText(arg).code };
  }

  private texto(rendered: Rendered): Rendered {
    this.uses.add("texto");
    return this.fn("texto", rendered);
  }

  private asText(expression: ExpressionNode): Rendered {
    const kind = this.kind(expression);
    const rendered = this.expression(expression);
    if (kind === "string") return rendered;
    if (kind === "int") return this.fn("num2str", rendered);
    return this.texto(rendered);
  }

  private readValue(target: AssignableExpressionNode): string {
    switch (this.kind(target)) {
      case "string":
        return "input('', 's')";
      case "bool":
        this.uses.add("leer_logico");
        return "leer_logico()";
      default:
        return "input('')";
    }
  }

  private converted(value: ExpressionNode, target: ValueKind): string {
    const rendered = this.expression(value);
    if (target === "int" && this.kind(value) === "double") return this.toInteger(rendered).code;
    return rendered.code;
  }

  private forStatement(statement: Extract<StatementNode, { kind: "for" }>): string[] {
    const counter = this.expression({ kind: "identifier", name: statement.variable }).code;
    const plan = this.forPlan(statement);
    const start = this.expression(statement.start);
    const end = this.expression(statement.end);
    if (this.isPlainCountingLoop(statement, plan)) {
      const step = plan.step === 1 ? "" : `${plan.step}:`;
      return [`for ${counter} = ${wrap(start, PREC.additive)}:${step}${wrap(end, PREC.additive)}`, ...this.block(statement.body), "end"];
    }
    // A while loop keeps PSeInt's semantics: the body may change the
    // counter, and it ends one step past the limit.
    const lines = [`${counter} = ${start.code};`];
    const endCode = wrap(end, PREC.comparison + 1);
    let condition: string;
    let update: string;
    if (plan.descending !== null && plan.step !== null) {
      condition = `${counter} ${plan.descending ? ">=" : "<="} ${endCode}`;
      update = `${counter} = ${counter} ${plan.step < 0 ? "-" : "+"} ${Math.abs(plan.step)};`;
    } else {
      const step = this.temp("paso");
      lines.push(
        statement.step
          ? `${step} = ${this.expression(statement.step).code};`
          : `if ${counter} <= ${endCode}`,
        ...(statement.step ? [] : [`${this.indent}${step} = 1;`, "else", `${this.indent}${step} = -1;`, "end"])
      );
      condition = `(${step} > 0 && ${counter} <= ${endCode}) || (${step} < 0 && ${counter} >= ${endCode})`;
      update = `${counter} = ${counter} + ${step};`;
    }
    return [...lines, `while ${condition}`, ...this.block(statement.body), `${this.indent}${update}`, "end"];
  }

  private forEach(statement: Extract<StatementNode, { kind: "forEach" }>): string[] {
    const plan = this.forEachPlan(statement);
    if (!plan) return [`% Para Cada ${statement.variable}: no se pudo traducir`];
    const collection = this.name(plan.collection.name);
    const counters = this.forEachCounters(plan);
    const open = this.variableKind(plan.collection) === "string" ? ["{", "}"] : ["(", ")"];
    const element = `${collection}${open[0]}${counters.join(", ")}${open[1]}`;
    const lines = counters.map((counter, index) => {
      const size = plan.depth === 1 ? `numel(${collection})` : `size(${collection}, ${index + 1})`;
      return `${this.indent.repeat(index)}for ${counter} = 1:${size}`;
    });
    const body = this.withAlias(plan.alias.key, element, () => this.block(statement.body, plan.depth));
    const close = counters.map((_, index) => `${this.indent.repeat(plan.depth - 1 - index)}end`);
    return [...lines, ...body, ...close];
  }

  // ---------------------------------------------------------------------------
  // Expressions

  protected toInteger(rendered: Rendered): Rendered {
    return this.fn("fix", rendered);
  }

  protected indexShift(): number {
    return this.settings.baseZeroArrays ? 1 : 0;
  }

  protected stringLiteral(value: string): Rendered {
    const parts: string[] = [];
    let text = "";
    for (const char of value) {
      const point = char.charCodeAt(0);
      if (point < 0x20) {
        if (text) parts.push(`'${text}'`);
        text = "";
        parts.push(`char(${point})`);
      } else {
        text += char === "'" ? "''" : char;
      }
    }
    if (text || parts.length === 0) parts.push(`'${text}'`);
    return { code: parts.length === 1 ? parts[0] : `[${parts.join(", ")}]`, prec: PREC.primary };
  }

  protected boolLiteral(value: boolean): Rendered {
    return { code: value ? "true" : "false", prec: PREC.primary };
  }

  protected arrayAccess(base: string, indices: Rendered[], info: VariableInfo | undefined): Rendered {
    const [open, close] = info && this.variableKind(info) === "string" ? ["{", "}"] : ["(", ")"];
    return { code: `${base}${open}${indices.map((index) => index.code).join(", ")}${close}`, prec: PREC.primary };
  }

  protected unary(operator: string, operand: ExpressionNode): Rendered {
    return { code: `${operator === "-" ? "-" : "~"}${wrap(this.expression(operand), PREC.unary)}`, prec: PREC.unary };
  }

  protected binary(operator: string, left: ExpressionNode, right: ExpressionNode): Rendered {
    const isText = this.kind(left) === "string" || this.kind(right) === "string";
    if (operator === "+" && isText) return this.concat(left, right);
    if (isText && operator === "=") return this.fn("strcmp", this.asText(left), this.asText(right));
    if (isText && operator === "<>") return { code: `~${this.fn("strcmp", this.asText(left), this.asText(right)).code}`, prec: PREC.unary };
    if (isText && ["<", ">", "<=", ">="].includes(operator)) {
      this.uses.add("comparar_texto");
      return { code: `comparar_texto(${this.asText(left).code}, ${this.asText(right).code}) ${operator} 0`, prec: PREC.comparison };
    }
    if (operator === "^") {
      return { code: `${wrap(this.expression(left), PREC.power + 1)} ^ ${wrap(this.expression(right), PREC.power + 1)}`, prec: PREC.power };
    }
    // rem keeps the dividend's sign, like PSeInt's %.
    if (operator === "%") return this.fn("rem", this.expression(left), this.expression(right));
    const [symbol, prec] = OPERATORS[operator] ?? [operator, PREC.primary];
    return this.infix(this.expression(left), symbol, this.expression(right), prec);
  }

  private concat(left: ExpressionNode, right: ExpressionNode): Rendered {
    return { code: `[${this.asText(left).code}, ${this.asText(right).code}]`, prec: PREC.primary };
  }

  protected constant(name: "PI" | "EULER"): Rendered {
    return name === "PI" ? { code: "pi", prec: PREC.primary } : this.fn("exp", "1");
  }

  private callArgs(args: ExpressionNode[]): string {
    return args.map((arg) => this.expression(arg).code).join(", ");
  }

  private outputTarget(arg: ExpressionNode | undefined): string {
    return arg && isAssignable(arg) ? this.expression(arg).code : "~";
  }

  protected routineCall(routine: RoutineNode, args: ExpressionNode[]): Rendered {
    const signature = this.signature(routine);
    const call = `${this.routineName(routine)}(${this.callArgs(args)})`;
    if (signature.outputs.length === 0) return { code: call, prec: PREC.primary };
    // Outputs are assigned back before the statement that uses the result.
    const result = this.temp("resultado");
    const targets = [result, ...signature.outputs.map((index) => this.outputTarget(args[index]))];
    this.pre.push(`[${targets.join(", ")}] = ${call};`);
    return { code: result, prec: PREC.primary };
  }

  protected builtin(name: string, args: ExpressionNode[]): Rendered | null {
    const arg = (index: number) => this.expression(args[index]);
    const plain = (fn: string) => this.fn(fn, arg(0));
    switch (name) {
      case "RC":
      case "RAIZ":
        return plain("sqrt");
      case "ABS":
        return plain("abs");
      case "LN":
        return plain("log");
      case "EXP":
        return plain("exp");
      case "SEN":
      case "SIN":
        return plain("sin");
      case "COS":
        return plain("cos");
      case "TAN":
        return plain("tan");
      case "ASEN":
      case "ASIN":
        return plain("asin");
      case "ACOS":
        return plain("acos");
      case "ATAN":
        return plain("atan");
      case "TRUNC":
        return plain("fix");
      case "REDON":
        // round() rounds halves away from zero, like PSeInt.
        return plain("round");
      case "FECHAACTUAL":
        this.uses.add("fecha_actual");
        return this.fn("fecha_actual");
      case "HORAACTUAL":
        this.uses.add("hora_actual");
        return this.fn("hora_actual");
      case "AZAR":
        return this.infix(this.fn("randi", this.integer(args[0])), "-", { code: "1", prec: PREC.primary }, PREC.additive);
      case "ALEATORIO":
        return this.fn("randi", `[${this.integer(args[0]).code}, ${this.integer(args[1]).code}]`);
      case "LONGITUD":
        return this.fn("length", this.asText(args[0]));
      case "MAYUSCULAS":
        return this.fn("upper", this.asText(args[0]));
      case "MINUSCULAS":
        return this.fn("lower", this.asText(args[0]));
      case "SUBCADENA": {
        const shift = this.settings.baseZeroArrays ? 1 : 0;
        const from = this.integer(offsetExpression(args[1], shift));
        const to = this.integer(offsetExpression(args[2], shift));
        const range = `${wrap(from, PREC.additive)}:${wrap(to, PREC.additive)}`;
        if (args[0].kind === "identifier" && this.kind(args[0]) === "string") {
          return { code: `${this.expression(args[0]).code}(${range})`, prec: PREC.primary };
        }
        // Only a variable can be indexed: keep the text in one first.
        const temp = this.temp("texto_aux");
        this.pre.push(`${temp} = ${this.asText(args[0]).code};`);
        return { code: `${temp}(${range})`, prec: PREC.primary };
      }
      case "CONCATENAR":
        return this.concat(args[0], args[1]);
      case "CONVERTIRANUMERO":
        return this.fn("str2double", this.asText(args[0]));
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
    const comment = (text: string) => (this.comments ? [`${this.indent}% ${text}`] : []);
    const body = (...lines: string[]) => lines.map((line) => this.indent + line);
    const blocks: string[][] = [];
    if (uses.has("texto")) {
      blocks.push([
        "function t = texto(valor)",
        ...comment("Escribe un valor como PSeInt: los reales con hasta 10 decimales."),
        ...body(
          "if islogical(valor)",
          `${this.indent}if valor`,
          `${this.indent.repeat(2)}t = 'VERDADERO';`,
          `${this.indent}else`,
          `${this.indent.repeat(2)}t = 'FALSO';`,
          `${this.indent}end`,
          "elseif isnan(valor) || isinf(valor)",
          `${this.indent}t = num2str(valor);`,
          "else",
          `${this.indent}t = regexprep(regexprep(sprintf('%.10f', valor), '0+$', ''), '\\.$', '');`,
          `${this.indent}if strcmp(t, '-0')`,
          `${this.indent.repeat(2)}t = '0';`,
          `${this.indent}end`,
          "end"
        ),
        "end",
      ]);
    }
    if (uses.has("leer_logico")) {
      blocks.push([
        "function valor = leer_logico()",
        ...comment("Lee VERDADERO o FALSO (también V, F, 1 o 0)."),
        ...body("texto_leido = upper(strtrim(input('', 's')));", "valor = any(strcmp(texto_leido, {'VERDADERO', 'V', '1'}));"),
        "end",
      ]);
    }
    if (uses.has("comparar_texto")) {
      blocks.push([
        "function r = comparar_texto(a, b)",
        ...comment("Compara dos textos letra por letra: negativo, cero o positivo."),
        ...body(
          "n = min(length(a), length(b));",
          "diferentes = find(a(1:n) ~= b(1:n), 1);",
          "if isempty(diferentes)",
          `${this.indent}r = length(a) - length(b);`,
          "else",
          `${this.indent}r = double(a(diferentes)) - double(b(diferentes));`,
          "end"
        ),
        "end",
      ]);
    }
    if (uses.has("redimensionar")) {
      blocks.push([
        "function nuevo = redimensionar(viejo, tamano, valor)",
        ...comment("Cambia el tamaño de un arreglo conservando los valores que siguen dentro."),
        ...body(
          "if iscell(viejo)",
          `${this.indent}nuevo = repmat({valor}, tamano);`,
          "else",
          `${this.indent}nuevo = repmat(valor, tamano);`,
          "end",
          "filas = min(size(viejo, 1), tamano(1));",
          "columnas = min(size(viejo, 2), tamano(2));",
          "nuevo(1:filas, 1:columnas) = viejo(1:filas, 1:columnas);"
        ),
        "end",
      ]);
    }
    if (uses.has("fecha_actual")) {
      blocks.push([
        "function r = fecha_actual()",
        ...comment("Fecha actual como el número AAAAMMDD."),
        ...body("c = clock();", "r = c(1) * 10000 + c(2) * 100 + c(3);"),
        "end",
      ]);
    }
    if (uses.has("hora_actual")) {
      blocks.push([
        "function r = hora_actual()",
        ...comment("Hora actual como el número HHMMSS."),
        ...body("c = clock();", "r = c(4) * 10000 + c(5) * 100 + fix(c(6));"),
        "end",
      ]);
    }
    return blocks;
  }
}
