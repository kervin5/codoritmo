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

export interface PythonGeneratorOptions {
  settings?: Partial<EngineSettings>;
  /** Explanatory comments in the output (on by default). */
  comments?: boolean;
}

const PREC = {
  or: 30,
  and: 40,
  not: 45,
  comparison: 50,
  additive: 70,
  multiplicative: 80,
  unary: 90,
  power: 95,
  primary: 100,
} as const;

const COMPARISONS: Record<string, string> = {
  "=": "==",
  "<>": "!=",
  "<": "<",
  ">": ">",
  "<=": "<=",
  ">=": ">=",
};

const RESERVED = new Set(
  `False None True and as assert async await break class continue def del elif
  else except finally for from global if import in is lambda nonlocal not or pass
  raise return try while with yield match case
  print input int float str bool len range abs round min max sum list type
  math random time datetime Decimal ROUND_HALF_UP localcontext
  main texto truncar redondear fecha_actual hora_actual leer_logico redimensionar`.split(/\s+/)
);

const INDENT = "    ";

/** What a call site needs to know about a subprocess. */
interface Signature {
  name: string;
  /** Positions of by-reference scalar parameters, returned after the result. */
  outputs: number[];
  returnsValue: boolean;
}

interface RoutineContext {
  scope: ScopeTypes;
  routine: RoutineNode | null;
  signature: Signature | null;
  /** Para counters whose value is read outside of their loops. */
  countersReadOutside: Set<string>;
  /** Names already used in the function, so auxiliary names do not clash. */
  names: Set<string>;
}

/**
 * Exports pseudocode to Python 3, in the spirit of upstream PSeInt's
 * PythonExporter: subprocesses become functions, the algorithm becomes
 * `main()`. By-reference parameters are returned in a tuple and assigned
 * back by the caller (`a, b = intercambiar(a, b)`); arrays are lists, which
 * Python already shares with the function.
 */
export class PythonGenerator {
  private readonly settings: EngineSettings;
  private readonly comments: boolean;
  private inference!: TypeInference;
  private types!: ProgramTypes;
  private signatures = new Map<string, Signature>();
  private uses = new Set<string>();
  private diagnostics: Diagnostic[] = [];
  private context!: RoutineContext;
  /** Statements that must run before the one being generated (hoisted calls). */
  private pre: string[] = [];
  /** Code standing for Para Cada aliases while inside their loop. */
  private aliases = new Map<string, string>();

  constructor(options: PythonGeneratorOptions = {}) {
    this.settings = normalizeEngineSettings(options.settings);
    this.comments = options.comments ?? true;
  }

  generate(program: ProgramNode): GenerationResult {
    this.inference = new TypeInference(program);
    this.types = this.inference.run();
    this.uses = new Set();
    this.diagnostics = [];
    this.aliases = new Map();
    this.signatures = new Map();

    const variableNames = new Set<string>();
    for (const scope of [this.types.main, ...this.types.routines.values()]) {
      for (const info of scope.vars.values()) variableNames.add(this.name(info.name));
    }
    const routineNames = new Set<string>();
    for (const routine of program.routines) {
      const scope = this.types.routines.get(normalizeName(routine.name))!;
      // Functions and variables share one namespace in Python.
      let name = makeIdentifier(routine.name, RESERVED);
      while (variableNames.has(name) || routineNames.has(name)) name += "_";
      routineNames.add(name);
      this.signatures.set(normalizeName(routine.name), {
        name,
        outputs: routine.params.flatMap((param, index) =>
          param.byReference && !scope.vars.get(normalizeName(param.name))?.array ? [index] : []
        ),
        returnsValue: Boolean(scope.returnKey) || scope.returnType !== "unknown",
      });
    }

    const functions = program.routines.map((routine) =>
      this.routine(routine, routine.body, this.types.routines.get(normalizeName(routine.name))!)
    );
    const main = this.routine(null, program.entry.body, this.types.main);

    const lines = [...this.header()];
    for (const block of [...this.helpers(), ...functions, main]) {
      if (lines.length > 0) lines.push("", "");
      lines.push(...block);
    }
    lines.push("", "", 'if __name__ == "__main__":', `${INDENT}main()`);
    return { code: `${lines.join("\n")}\n`, diagnostics: this.diagnostics };
  }

  // ---------------------------------------------------------------------------
  // Routines

  private name(name: string): string {
    return makeIdentifier(name, RESERVED);
  }

  private routine(
    routine: RoutineNode | null,
    statements: StatementNode[],
    scope: ScopeTypes
  ): string[] {
    const signature = routine ? this.signatures.get(normalizeName(routine.name))! : null;
    this.context = {
      scope,
      routine,
      signature,
      countersReadOutside: countersReadOutside(statements),
      names: new Set([
        ...[...scope.vars.values()].map((info) => this.name(info.name)),
        ...[...this.signatures.values()].map((other) => other.name),
      ]),
    };

    const params = routine ? routine.params.map((param) => this.name(param.name)) : [];
    const lines = [`def ${signature ? signature.name : "main"}(${params.join(", ")}):`];

    const body: string[] = [];
    // Python cannot read a variable before assigning it; PSeInt reads the
    // default value of its type, so those variables start with it.
    for (const key of [...this.uninitializedReads(statements, scope)].sort()) {
      const info = scope.vars.get(key)!;
      if (info.array) continue;
      body.push(`${this.name(info.name)}${this.annotation(info)} = ${this.defaultValue(info.type)}`);
    }
    body.push(...statements.flatMap((statement) => this.statement(statement)));

    const last = statements[statements.length - 1];
    if (signature && last?.kind !== "return") {
      const values = this.returnValues(scope.returnKey ? this.name(scope.vars.get(scope.returnKey)!.name) : null);
      if (values) body.push(`return ${values}`);
    }
    lines.push(...(body.length > 0 ? body : ["pass"]).map((line) => INDENT + line));
    return lines;
  }

  /** The value a function returns: its result, then by-reference parameters. */
  private returnValues(result: string | null): string | null {
    const signature = this.context.signature;
    if (!signature) return null;
    const outputs = signature.outputs.map((index) =>
      this.name(this.context.routine!.params[index].name)
    );
    const values = [...(signature.returnsValue ? [result ?? "None"] : []), ...outputs];
    return values.length > 0 ? values.join(", ") : null;
  }

  private annotation(info: VariableInfo): string {
    if (!info.declared) return "";
    const type = this.typeName(info.type);
    return type ? `: ${type}` : "";
  }

  private typeName(type: InferredType): string | null {
    switch (resolveType(type)) {
      case "int":
        return "int";
      case "double":
        return "float";
      case "string":
        return "str";
      case "bool":
        return "bool";
      default:
        return null;
    }
  }

  private defaultValue(type: InferredType): string {
    switch (resolveType(type)) {
      case "int":
        return "0";
      case "double":
        return "0.0";
      case "bool":
        return "False";
      default:
        // Untyped variables print as nothing in PSeInt, like an empty text.
        return '""';
    }
  }

  /**
   * Variables that may be read before anything is assigned to them, found
   * with a definite-assignment pass over the statements.
   */
  private uninitializedReads(statements: StatementNode[], scope: ScopeTypes): Set<string> {
    const found = new Set<string>();
    const reads = (node: unknown, assigned: Set<string>) =>
      walk(node, (child) => {
        if (child.kind !== "identifier") return;
        const key = normalizeName((child as { name: string }).name);
        const info = scope.vars.get(key);
        if (info && !info.forEachAlias && !assigned.has(key)) found.add(key);
      });
    const intersect = (sets: Set<string>[]) =>
      new Set([...sets[0]].filter((key) => sets.every((set) => set.has(key))));
    const target = (expression: AssignableExpressionNode, assigned: Set<string>) => {
      if (expression.kind === "identifier") assigned.add(normalizeName(expression.name));
      else reads(expression, assigned);
    };

    const flow = (body: StatementNode[], assigned: Set<string>): Set<string> => {
      for (const statement of body) {
        switch (statement.kind) {
          case "dimension":
            for (const item of statement.items) {
              reads(item.dimensions, assigned);
              assigned.add(normalizeName(item.name));
            }
            break;
          case "assignment":
            reads(statement.value, assigned);
            target(statement.target, assigned);
            break;
          case "read":
            statement.targets.forEach((expression) => target(expression, assigned));
            break;
          case "write":
            reads(statement.expressions, assigned);
            break;
          case "if": {
            reads(statement.condition, assigned);
            const then = flow(statement.thenBranch, new Set(assigned));
            const otherwise = flow(statement.elseBranch, new Set(assigned));
            assigned = intersect([then, otherwise]);
            break;
          }
          case "while":
            reads(statement.condition, assigned);
            flow(statement.body, new Set(assigned));
            break;
          case "repeat":
            assigned = flow(statement.body, assigned);
            reads(statement.condition, assigned);
            break;
          case "for": {
            reads([statement.start, statement.end, statement.step], assigned);
            const key = normalizeName(statement.variable);
            flow(statement.body, new Set([...assigned, key]));
            // The counter is always assigned when it is read after the loop
            // (the loop is then a while loop that starts by assigning it).
            assigned.add(key);
            break;
          }
          case "forEach":
            reads(statement.collection, assigned);
            flow(statement.body, new Set([...assigned, normalizeName(statement.variable)]));
            break;
          case "switch": {
            reads(statement.expression, assigned);
            statement.cases.forEach((switchCase) => reads(switchCase.values, assigned));
            const branches = statement.cases.map((switchCase) =>
              flow(switchCase.body, new Set(assigned))
            );
            branches.push(flow(statement.defaultCase, new Set(assigned)));
            assigned = intersect(branches);
            break;
          }
          case "expression":
            if (statement.expression.kind !== "identifier") reads(statement.expression, assigned);
            break;
          case "wait":
            reads(statement.durationMs, assigned);
            break;
          case "return":
            reads(statement.expression, assigned);
            break;
          default:
            break;
        }
      }
      return assigned;
    };

    const initial = new Set<string>();
    if (scope.routine) {
      for (const param of scope.routine.params) initial.add(normalizeName(param.name));
    }
    const assigned = flow(statements, initial);
    if (scope.returnKey && !assigned.has(scope.returnKey)) found.add(scope.returnKey);
    return found;
  }

  // ---------------------------------------------------------------------------
  // Statements

  private block(statements: StatementNode[]): string[] {
    const lines = statements.flatMap((statement) => this.statement(statement));
    return (lines.length > 0 ? lines : ["pass"]).map((line) => INDENT + line);
  }

  /** Lines of one statement, preceded by any calls hoisted out of it. */
  private statement(statement: StatementNode): string[] {
    const saved = this.pre;
    this.pre = [];
    const lines = this.statementLines(statement);
    const pre = this.pre;
    this.pre = saved;
    return [...pre, ...lines];
  }

  private statementLines(statement: StatementNode): string[] {
    switch (statement.kind) {
      case "define":
        return statement.names.flatMap((name) => {
          const info = this.context.scope.vars.get(normalizeName(name));
          if (!info || info.array) return [];
          const type = this.typeName(info.type);
          return type ? [`${this.name(name)}: ${type}`] : [];
        });
      case "dimension":
        return this.dimension(statement);
      case "assignment":
        return [`${this.expression(statement.target).code} = ${this.converted(statement.value, statement.target)}`];
      case "write":
        return this.write(statement.expressions, statement.newline);
      case "read":
        return statement.targets.map((target) => `${this.expression(target).code} = ${this.readValue(target)}`);
      case "if":
        return this.ifStatement(statement);
      case "while": {
        const exit = this.expression(invertCondition(statement.condition)).code;
        if (this.pre.length === 0) {
          return [`while ${this.expression(statement.condition).code}:`, ...this.block(statement.body)];
        }
        // The condition calls a function with by-reference parameters.
        const pre = this.pre;
        this.pre = [];
        return [
          "while True:",
          ...[...pre, `if ${exit}:`, `${INDENT}break`].map((line) => INDENT + line),
          ...this.block(statement.body),
        ];
      }
      case "repeat": {
        const until =
          statement.mode === "until" ? statement.condition : invertCondition(statement.condition);
        const body = this.block(statement.body);
        const saved = this.pre;
        this.pre = [];
        const exit = [`if ${this.expression(until).code}:`, `${INDENT}break`];
        const pre = this.pre;
        this.pre = saved;
        return [
          "while True:",
          ...(body[0] === `${INDENT}pass` ? [] : body),
          ...[...pre, ...exit].map((line) => INDENT + line),
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
          return this.callStatement(expression.name, []);
        }
        if (expression.kind === "call" && this.signatures.has(normalizeName(expression.callee))) {
          return this.callStatement(expression.callee, expression.args);
        }
        return [this.expression(expression).code];
      }
      case "clear":
        return [
          `print("\\033[2J\\033[H", end="")${this.comments ? "  # secuencia ANSI que borra la terminal" : ""}`,
        ];
      case "wait":
        if (statement.mode === "key") {
          return [`input()${this.comments ? "  # espera un Enter, no cualquier tecla" : ""}`];
        }
        this.uses.add("time");
        return [`time.sleep(${wrap(this.expression(statement.durationMs!), PREC.multiplicative)} / 1000)`];
      case "return": {
        if (!this.context.signature) return ["return"];
        const value = statement.expression ? this.expression(statement.expression).code : null;
        const values = this.returnValues(value);
        return [values ? `return ${values}` : "return"];
      }
    }
  }

  private ifStatement(statement: Extract<StatementNode, { kind: "if" }>): string[] {
    const lines = [`if ${this.expression(statement.condition).code}:`, ...this.block(statement.thenBranch)];
    let otherwise = statement.elseBranch;
    // Si ... SiNo Si ... becomes elif while nothing has to run in between.
    while (otherwise.length === 1 && otherwise[0].kind === "if") {
      const nested = otherwise[0];
      const saved = this.pre;
      this.pre = [];
      const condition = this.expression(nested.condition).code;
      const hoisted = this.pre;
      this.pre = saved;
      if (hoisted.length > 0) break;
      lines.push(`elif ${condition}:`, ...this.block(nested.thenBranch));
      otherwise = nested.elseBranch;
    }
    if (otherwise.length > 0) lines.push("else:", ...this.block(otherwise));
    return lines;
  }

  private dimension(statement: Extract<StatementNode, { kind: "dimension" }>): string[] {
    return statement.items.map((item) => {
      const info = this.context.scope.vars.get(normalizeName(item.name));
      const fill = this.defaultValue(info?.type ?? "unknown");
      const sizes = item.dimensions.map((dimension) => this.integer(dimension));
      const name = this.name(item.name);
      if (statement.resize) {
        this.uses.add("redimensionar");
        return `redimensionar(${name}, [${sizes.map((size) => size.code).join(", ")}], ${fill})`;
      }
      // Each row must be a different list: [[0] * 3] * 2 would share one.
      let value = `[${fill}] * ${wrap(sizes[sizes.length - 1], PREC.multiplicative + 1)}`;
      for (const size of sizes.slice(0, -1).reverse()) {
        value = `[${value} for _ in range(${size.code})]`;
      }
      return `${name} = ${value}`;
    });
  }

  private write(args: ExpressionNode[], newline: boolean): string[] {
    const saved = this.pre;
    const parts = args.map((arg) => {
      this.pre = [];
      return { value: this.printable(arg), pre: this.pre };
    });
    this.pre = saved;
    if (parts.some((part) => part.pre.length > 0)) {
      // A call changes by-reference arguments: print piece by piece so the
      // values before it are written before it runs, as in PSeInt.
      const lines = parts.flatMap((part) => [...part.pre, `print(${part.value}, end="")`]);
      return newline ? [...lines, "print()"] : lines;
    }
    const values = parts.map((part) => part.value);
    if (values.length === 0 && !newline) return [];
    const options = [...(values.length > 1 ? ['sep=""'] : []), ...(newline ? [] : ['end=""'])];
    return [`print(${[...values, ...options].join(", ")})`];
  }

  /** An expression as print shows it: texts and integers as they are. */
  private printable(arg: ExpressionNode): string {
    const type = resolveType(this.typeOf(arg));
    const rendered = this.expression(arg);
    if (type === "string" || (type === "int" && this.isInt(arg))) return rendered.code;
    return this.texto(rendered);
  }

  private texto(rendered: Rendered): string {
    this.uses.add("texto");
    return `texto(${rendered.code})`;
  }

  /** Text form of any value, for concatenation. */
  private asText(expression: ExpressionNode): Rendered {
    const rendered = this.expression(expression);
    if (resolveType(this.typeOf(expression)) === "string") return rendered;
    return { code: this.texto(rendered), prec: PREC.primary };
  }

  private readValue(target: AssignableExpressionNode): string {
    switch (resolveType(this.typeOf(target))) {
      case "int":
        return "int(input())";
      case "double":
        return "float(input())";
      case "bool":
        this.uses.add("leer_logico");
        return "leer_logico()";
      default:
        return "input()";
    }
  }

  /** A value for a target, truncated when the target is an integer. */
  private converted(value: ExpressionNode, target: ExpressionNode): string {
    const rendered = this.expression(value);
    if (resolveType(this.typeOf(target)) === "int" && !this.isInt(value) && this.isNumeric(value)) {
      return `int(${rendered.code})`;
    }
    return rendered.code;
  }

  private forStatement(statement: Extract<StatementNode, { kind: "for" }>): string[] {
    const key = normalizeName(statement.variable);
    const counter = this.expression({ kind: "identifier", name: statement.variable }).code;
    const descending = forDirection(statement, this.settings);
    const stepValue = statement.step ? evaluateConstant(statement.step) : descending ? -1 : 1;
    const start = this.expression(statement.start);
    const end = this.expression(statement.end);

    const usesRange =
      descending !== null &&
      stepValue !== null &&
      Number.isInteger(stepValue) &&
      this.isInt(statement.start) &&
      this.isInt(statement.end) &&
      !this.aliases.has(key) &&
      !this.context.countersReadOutside.has(key) &&
      !writesVariable(statement.body, key, this.inference);
    if (usesRange) {
      const limit = this.expression(offsetExpression(statement.end, descending ? -1 : 1)).code;
      const args = [start.code, limit];
      if (stepValue !== 1) args.push(String(stepValue));
      if (args.length === 2 && start.code === "0") args.shift();
      return [`for ${counter} in range(${args.join(", ")}):`, ...this.block(statement.body)];
    }

    // A while loop keeps PSeInt's semantics: the counter may be real, the
    // body may change it, and it ends one step past the limit.
    const lines = [`${counter} = ${start.code}`];
    const endCode = wrap(end, PREC.comparison + 1);
    let condition: string;
    let update: string;
    if (descending !== null && stepValue !== null) {
      condition = `${counter} ${descending ? ">=" : "<="} ${endCode}`;
      update = `${counter} ${stepValue < 0 ? "-=" : "+="} ${Math.abs(stepValue)}`;
    } else {
      const step = this.temp("paso");
      lines.push(
        statement.step
          ? `${step} = ${this.expression(statement.step).code}`
          : `${step} = 1 if ${counter} <= ${endCode} else -1`
      );
      condition = `(${step} > 0 and ${counter} <= ${endCode}) or (${step} < 0 and ${counter} >= ${endCode})`;
      update = `${counter} += ${step}`;
    }
    const body = this.block(statement.body);
    lines.push(`while ${condition}:`, ...(body[0] === `${INDENT}pass` ? [] : body), INDENT + update);
    return lines;
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
        message: `Para Cada needs an array variable to export (${statement.variable}).`,
        line: statement.span?.start.line ?? 0,
        column: statement.span?.start.column ?? 0,
        severity: "warning",
        code: "EXPORT_FOREACH",
      });
      return [`# Para Cada ${statement.variable}: no se pudo traducir`];
    }

    const name = this.expression(statement.collection).code;
    const depth = collection.array.dims.length;
    const lines: string[] = [];
    let element = name;
    let aliasCode: string | null = null;
    if (writesVariable(statement.body, alias.key, this.inference)) {
      // The body changes the element: walk the indices and write through.
      for (let index = 0; index < depth; index += 1) {
        const counter = this.temp(`${this.name(collection.name)}_${"ijklmn"[index] ?? `i${index}`}`);
        lines.push(`${INDENT.repeat(index)}for ${counter} in range(len(${element})):`);
        element = `${element}[${counter}]`;
      }
      aliasCode = element;
    } else {
      for (let index = 0; index < depth; index += 1) {
        const item = index === depth - 1 ? this.name(alias.name) : this.temp(`${this.name(collection.name)}_fila`);
        lines.push(`${INDENT.repeat(index)}for ${item} in ${element}:`);
        element = item;
      }
    }

    const previous = this.aliases.get(alias.key);
    if (aliasCode) this.aliases.set(alias.key, aliasCode);
    const body = this.block(statement.body);
    if (previous === undefined) this.aliases.delete(alias.key);
    else this.aliases.set(alias.key, previous);
    return [...lines, ...body.map((line) => INDENT.repeat(depth - 1) + line)];
  }

  private switchStatement(statement: SwitchStatementNode): string[] {
    if (statement.cases.length === 0) {
      return statement.defaultCase.flatMap((child) => this.statement(child));
    }
    let control: ExpressionNode = statement.expression;
    const lines: string[] = [];
    let temp: string | null = null;
    if (containsCall(control)) {
      // Evaluated once, as PSeInt does.
      temp = this.temp("opcion");
      lines.push(`${temp} = ${this.expression(control).code}`);
      control = { kind: "identifier", name: temp };
      this.aliases.set(normalizeName(temp), temp);
    }
    statement.cases.forEach((switchCase, index) => {
      const values = switchCase.values;
      const subject = wrap(this.expression(control), PREC.comparison + 1);
      const condition =
        values.length === 1
          ? this.expression({ kind: "binary", operator: "=", left: control, right: values[0] }).code
          : `${subject} in (${values.map((value) => this.expression(value).code).join(", ")})`;
      lines.push(`${index === 0 ? "if" : "elif"} ${condition}:`, ...this.block(switchCase.body));
    });
    if (statement.defaultCase.length > 0) lines.push("else:", ...this.block(statement.defaultCase));
    if (temp) this.aliases.delete(normalizeName(temp));
    return lines;
  }

  /** A fresh auxiliary name that clashes with no variable of the function. */
  private temp(base: string): string {
    let name = base;
    for (let index = 2; this.context.names.has(name); index += 1) name = `${base}${index}`;
    this.context.names.add(name);
    return name;
  }

  // ---------------------------------------------------------------------------
  // Subprocess calls

  private callArgs(args: ExpressionNode[]): string {
    return args.map((arg) => this.expression(arg).code).join(", ");
  }

  private callStatement(callee: string, args: ExpressionNode[]): string[] {
    const routine = this.inference.findRoutine(callee);
    const signature = this.signatures.get(normalizeName(callee));
    if (!routine || !signature) return [this.expression({ kind: "call", callee, args }).code];
    const call = `${signature.name}(${this.callArgs(args)})`;
    if (signature.outputs.length === 0) return [call];
    const targets = signature.outputs.map((index) => this.outputTarget(args[index]));
    if (signature.returnsValue) targets.unshift("_");
    return [`${targets.join(", ")} = ${call}`];
  }

  private outputTarget(arg: ExpressionNode | undefined): string {
    return arg && isAssignable(arg) ? this.expression(arg).code : "_";
  }

  private routineCall(routine: RoutineNode, args: ExpressionNode[]): Rendered {
    const signature = this.signatures.get(normalizeName(routine.name))!;
    const call = `${signature.name}(${this.callArgs(args)})`;
    if (signature.outputs.length === 0) return { code: call, prec: PREC.primary };
    // A function with by-reference parameters returns a tuple: unpack it
    // before the statement that uses the result.
    const result = this.temp("resultado");
    const targets = [result, ...signature.outputs.map((index) => this.outputTarget(args[index]))];
    this.pre.push(`${targets.join(", ")} = ${call}`);
    return { code: result, prec: PREC.primary };
  }

  // ---------------------------------------------------------------------------
  // Expressions

  private typeOf(expression: ExpressionNode): InferredType {
    return this.inference.typeOf(expression, this.context.scope);
  }

  private isNumeric(expression: ExpressionNode): boolean {
    const type = this.typeOf(expression);
    return type === "number" || type === "int" || type === "double";
  }

  /** Whether the expression evaluates to a Python int. */
  private isInt(expression: ExpressionNode): boolean {
    if (this.typeOf(expression) === "int") return true;
    switch (expression.kind) {
      case "literal":
        return typeof expression.value === "number" && Number.isInteger(expression.value);
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

  /** An int-valued rendering of `expression + delta`. */
  private integer(expression: ExpressionNode, delta = 0): Rendered {
    const rendered = this.expression(offsetExpression(expression, delta));
    return this.isInt(expression) ? rendered : { code: `int(${rendered.code})`, prec: PREC.primary };
  }

  private index(expression: ExpressionNode): Rendered {
    return this.integer(expression, this.settings.baseZeroArrays ? 0 : -1);
  }

  expression(expression: ExpressionNode): Rendered {
    switch (expression.kind) {
      case "literal":
        if (expression.valueType === "string") {
          return { code: escapeString(String(expression.value)), prec: PREC.primary };
        }
        if (expression.valueType === "boolean") {
          return { code: expression.value ? "True" : "False", prec: PREC.primary };
        }
        return {
          code: String(expression.value),
          prec: (expression.value as number) < 0 ? PREC.unary : PREC.primary,
        };
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
        if (expression.operator === "-") {
          return { code: `-${wrap(this.expression(expression.operand), PREC.unary)}`, prec: PREC.unary };
        }
        return { code: `not ${wrap(this.expression(expression.operand), PREC.not)}`, prec: PREC.not };
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
    return { code: this.name(name), prec: PREC.primary };
  }

  private constant(name: string): Rendered {
    this.uses.add("math");
    return { code: normalizeBuiltinName(name) === "PI" ? "math.pi" : "math.e", prec: PREC.primary };
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

  private binary(operator: string, left: ExpressionNode, right: ExpressionNode): Rendered {
    const leftType = resolveType(this.typeOf(left));
    const rightType = resolveType(this.typeOf(right));
    switch (operator) {
      case "AND":
      case "OR": {
        const prec = operator === "AND" ? PREC.and : PREC.or;
        return {
          code: `${wrap(this.expression(left), prec)} ${operator.toLowerCase()} ${wrap(this.expression(right), prec + 1)}`,
          prec,
        };
      }
      case "+":
        if (leftType === "string" || rightType === "string") {
          return {
            code: `${wrap(this.asText(left), PREC.additive)} + ${wrap(this.asText(right), PREC.additive + 1)}`,
            prec: PREC.additive,
          };
        }
        break;
      case "%": {
        // Python's % follows the sign of the divisor; PSeInt's, like C's
        // fmod, follows the dividend (-7 % 3 is -1).
        this.uses.add("math");
        const code = `math.fmod(${this.expression(left).code}, ${this.expression(right).code})`;
        return {
          code: this.isInt(left) && this.isInt(right) ? `int(${code})` : code,
          prec: PREC.primary,
        };
      }
      case "^":
        return {
          code: `${wrap(this.expression(left), PREC.primary)} ** ${wrap(this.expression(right), PREC.unary)}`,
          prec: PREC.power,
        };
    }
    if (COMPARISONS[operator]) {
      return {
        code: `${wrap(this.expression(left), PREC.comparison + 1)} ${COMPARISONS[operator]} ${wrap(this.expression(right), PREC.comparison + 1)}`,
        prec: PREC.comparison,
      };
    }
    const prec = operator === "+" || operator === "-" ? PREC.additive : PREC.multiplicative;
    return {
      code: `${wrap(this.expression(left), prec)} ${operator} ${wrap(this.expression(right), prec + 1)}`,
      prec,
    };
  }

  private builtin(name: string, args: ExpressionNode[]): Rendered | null {
    const arg = (index: number) => this.expression(args[index]).code;
    const math = (fn: string): Rendered => {
      this.uses.add("math");
      return { code: `math.${fn}(${arg(0)})`, prec: PREC.primary };
    };
    const helper = (fn: string): Rendered => {
      this.uses.add(fn);
      return { code: `${fn}(${args.map((_, index) => arg(index)).join(", ")})`, prec: PREC.primary };
    };
    const text = (index: number) => wrap(this.asText(args[index]), PREC.primary);
    switch (name) {
      case "RC":
      case "RAIZ":
        return math("sqrt");
      case "ABS":
        return { code: `abs(${arg(0)})`, prec: PREC.primary };
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
        return helper("truncar");
      case "REDON":
        return helper("redondear");
      case "FECHAACTUAL":
        return helper("fecha_actual");
      case "HORAACTUAL":
        return helper("hora_actual");
      case "AZAR":
        this.uses.add("random");
        return { code: `random.randrange(${this.integer(args[0]).code})`, prec: PREC.primary };
      case "ALEATORIO":
        this.uses.add("random");
        return {
          code: `random.randint(${this.integer(args[0]).code}, ${this.integer(args[1]).code})`,
          prec: PREC.primary,
        };
      case "LONGITUD":
        return { code: `len(${this.asText(args[0]).code})`, prec: PREC.primary };
      case "MAYUSCULAS":
        return { code: `${text(0)}.upper()`, prec: PREC.primary };
      case "MINUSCULAS":
        return { code: `${text(0)}.lower()`, prec: PREC.primary };
      case "SUBCADENA": {
        const base = this.settings.baseZeroArrays ? 0 : -1;
        const from = this.integer(args[1], base).code;
        const to = this.integer(args[2], base + 1).code;
        return { code: `${text(0)}[${from}:${to}]`, prec: PREC.primary };
      }
      case "CONCATENAR":
        return {
          code: `${wrap(this.asText(args[0]), PREC.additive)} + ${wrap(this.asText(args[1]), PREC.additive + 1)}`,
          prec: PREC.additive,
        };
      case "CONVERTIRANUMERO":
        return { code: `float(${arg(0)})`, prec: PREC.primary };
      case "CONVERTIRATEXTO":
        return this.asText(args[0]);
      default:
        return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Header and helpers

  private header(): string[] {
    const lines: string[] = [];
    if (this.comments) {
      lines.push(
        "# Este código fue generado por Codoritmo a partir del pseudocódigo.",
        "# Puede que no sea completamente correcto: revíselo antes de usarlo."
      );
    }
    const uses = this.uses;
    if (uses.has("texto") || uses.has("truncar") || uses.has("redondear")) uses.add("math");
    const imports: string[] = [];
    if (uses.has("math")) imports.push("import math");
    if (uses.has("random")) imports.push("import random");
    if (uses.has("time")) imports.push("import time");
    if (uses.has("fecha_actual") || uses.has("hora_actual")) imports.push("from datetime import datetime");
    if (uses.has("texto")) imports.push("from decimal import Decimal, ROUND_HALF_UP, localcontext");
    if (imports.length > 0) {
      if (lines.length > 0) lines.push("");
      lines.push(...imports);
    }
    return lines;
  }

  private helpers(): string[][] {
    const uses = this.uses;
    const doc = (text: string) => (this.comments ? [`${INDENT}"""${text}"""`] : []);
    const blocks: string[][] = [];
    if (uses.has("texto")) {
      blocks.push([
        "def texto(valor):",
        ...doc("Escribe un valor como PSeInt: los reales redondeados a 10 decimales."),
        `${INDENT}if isinstance(valor, bool):`,
        `${INDENT}${INDENT}return "VERDADERO" if valor else "FALSO"`,
        `${INDENT}if not isinstance(valor, float) or math.isinf(valor) or math.isnan(valor):`,
        `${INDENT}${INDENT}return str(valor)`,
        `${INDENT}with localcontext() as contexto:`,
        `${INDENT}${INDENT}contexto.prec = 400`,
        `${INDENT}${INDENT}cadena = format(Decimal(valor).quantize(Decimal("1e-10"), ROUND_HALF_UP), "f")`,
        `${INDENT}cadena = cadena.rstrip("0").rstrip(".")`,
        `${INDENT}return "0" if cadena == "-0" else cadena`,
      ]);
    }
    if (uses.has("truncar")) {
      blocks.push([
        "def truncar(x):",
        ...doc("Como trunc() de PSeInt: trunc(100*0.57) da 57 y no 56."),
        `${INDENT}t = math.trunc(x)`,
        `${INDENT}if t + 1 - x < 1e-11:`,
        `${INDENT}${INDENT}return t + 1`,
        `${INDENT}if t - 1 - x > -1e-11:`,
        `${INDENT}${INDENT}return t - 1`,
        `${INDENT}return t`,
      ]);
    }
    if (uses.has("redondear")) {
      blocks.push([
        "def redondear(x):",
        ...doc("Como redon() de PSeInt: redondea alejándose de cero (-2.5 da -3)."),
        `${INDENT}return math.trunc(x - 0.5 if x < 0 else x + 0.5)`,
      ]);
    }
    if (uses.has("fecha_actual")) {
      blocks.push([
        "def fecha_actual():",
        ...doc("Fecha actual como el número AAAAMMDD."),
        `${INDENT}hoy = datetime.now()`,
        `${INDENT}return hoy.year * 10000 + hoy.month * 100 + hoy.day`,
      ]);
    }
    if (uses.has("hora_actual")) {
      blocks.push([
        "def hora_actual():",
        ...doc("Hora actual como el número HHMMSS."),
        `${INDENT}ahora = datetime.now()`,
        `${INDENT}return ahora.hour * 10000 + ahora.minute * 100 + ahora.second`,
      ]);
    }
    if (uses.has("leer_logico")) {
      blocks.push([
        "def leer_logico():",
        ...doc("Lee VERDADERO o FALSO (también V, F, 1 o 0)."),
        `${INDENT}return input().strip().upper() in ("VERDADERO", "V", "1")`,
      ]);
    }
    if (uses.has("redimensionar")) {
      blocks.push([
        "def redimensionar(arreglo, tamanos, valor):",
        ...doc("Cambia el tamaño de un arreglo conservando los valores que siguen dentro."),
        `${INDENT}del arreglo[tamanos[0]:]`,
        `${INDENT}while len(arreglo) < tamanos[0]:`,
        `${INDENT}${INDENT}arreglo.append([] if len(tamanos) > 1 else valor)`,
        `${INDENT}if len(tamanos) > 1:`,
        `${INDENT}${INDENT}for fila in arreglo:`,
        `${INDENT}${INDENT}${INDENT}redimensionar(fila, tamanos[1:], valor)`,
      ]);
    }
    return blocks;
  }
}

function containsCall(expression: ExpressionNode): boolean {
  let found = false;
  walk(expression, (node) => {
    if (node.kind === "call") found = true;
  });
  return found;
}

/**
 * Para counters whose value is read outside the loops that count with them
 * (after the loop, before it...). Those loops cannot use range(), which
 * leaves the counter on the last value instead of one step past the limit.
 */
function countersReadOutside(statements: StatementNode[]): Set<string> {
  const counters = new Set<string>();
  walk(statements, (node) => {
    if (node.kind === "for") counters.add(normalizeName((node as { variable: string }).variable));
  });
  const result = new Set<string>();
  const visit = (node: unknown, active: Set<string>): void => {
    if (Array.isArray(node)) {
      node.forEach((child) => visit(child, active));
      return;
    }
    if (!node || typeof node !== "object") return;
    const value = node as StatementNode | ExpressionNode;
    switch (value.kind) {
      case "for": {
        visit([value.start, value.end, value.step], active);
        visit(value.body, new Set([...active, normalizeName(value.variable)]));
        return;
      }
      case "identifier": {
        const key = normalizeName(value.name);
        if (counters.has(key) && !active.has(key)) result.add(key);
        return;
      }
      case "assignment":
        if (value.target.kind === "arrayAccess") visit(value.target, active);
        visit(value.value, active);
        return;
      case "read":
        for (const target of value.targets) {
          if (target.kind === "arrayAccess") visit(target, active);
        }
        return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (key !== "span") visit(child, active);
    }
  };
  visit(statements, new Set());
  return result;
}
