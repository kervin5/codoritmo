import { normalizeIdentifier } from "./checker";
import { Parser } from "./parser";
import { normalizeEngineSettings } from "./settings";
import {
  ArrayAccessExpressionNode,
  AssignableExpressionNode,
  DataType,
  Diagnostic,
  EngineSettings,
  ExecutionResult,
  ExecutionStatementEvent,
  ExpressionNode,
  isIntegerType,
  isLogicalType,
  isNumericType,
  isTextType,
  MainRoutineNode,
  normalizeDataType,
  ParseResult,
  ProgramNode,
  Runtime,
  RoutineNode,
  StatementNode,
  StaticType,
  typesCompatible,
  VariableSnapshot,
  VariableSnapshotValue,
} from "./types";
import { createOutputBuffer, formatRuntimeValue } from "./runtime";

type ScalarValue = boolean | number | string | null;
type RuntimeValue = ArrayValue | ScalarValue;
type ReferenceMode = "loop_counter" | "read" | "read_target" | "write";

interface Cell {
  dataType?: string;
  initialized: boolean;
  protectedCounter: boolean;
  value: RuntimeValue;
  /** How the variable came to exist: Definir, use, or as a parameter/return. */
  origin?: "define" | "usage" | "param";
  definedBy?: StatementNode;
}

interface ArrayValue {
  kind: "array";
  dimensions: number[];
  items: Array<ArrayValue | Cell>;
}

interface ExecutionContext {
  buffer: ReturnType<typeof createOutputBuffer>;
  callDepth: number;
  routineName: string | null;
  routines: Map<string, RoutineNode>;
  runtime: Runtime;
  settings: EngineSettings;
  /** Shared across routine calls so the budget covers the whole run. */
  counter: { steps: number; lastStatement: StatementNode | null };
}

class RuntimeError extends Error {
  constructor(public readonly diagnostic: Diagnostic) {
    super(diagnostic.message);
  }
}

class ExecutionStopped extends Error {
  constructor() {
    super("Execution stopped.");
  }
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function snapshotValue(value: RuntimeValue): VariableSnapshotValue {
  if (value !== null && typeof value === "object") {
    return value.items.map((item) =>
      "kind" in item ? snapshotValue(item) : snapshotValue(item.value)
    );
  }

  return value;
}

class Scope {
  private readonly values = new Map<string, Cell>();
  private readonly displayNames = new Map<string, string>();

  /** Static types inferred for the routine this scope belongs to. */
  constructor(readonly inferredTypes: Record<string, StaticType> = {}) {}

  snapshot(): VariableSnapshot[] {
    // Routine scopes are flat: a subprocess never sees its caller's variables.
    const visible: VariableSnapshot[] = [];
    for (const [key, cell] of this.values) {
      visible.push({
        name: this.displayNames.get(key) ?? key,
        dataType: cell.dataType,
        initialized: cell.initialized,
        scopeDepth: 0,
        value: snapshotValue(cell.value),
      });
    }

    return visible;
  }

  define(name: string, initial: Partial<Cell> = {}): Cell {
    const cell: Cell = {
      value: null,
      initialized: false,
      protectedCounter: false,
      ...initial,
    };
    this.values.set(name.toLowerCase(), cell);
    this.displayNames.set(name.toLowerCase(), name);
    return cell;
  }

  bind(name: string, cell: Cell): Cell {
    this.values.set(name.toLowerCase(), cell);
    this.displayNames.set(name.toLowerCase(), name);
    return cell;
  }

  unbind(name: string): void {
    this.values.delete(name.toLowerCase());
  }

  resolve(name: string): Cell | null {
    return this.values.get(name.toLowerCase()) ?? null;
  }

  resolveLocal(name: string): Cell | null {
    return this.resolve(name);
  }

  hasLocal(name: string): boolean {
    return this.values.has(name.toLowerCase());
  }

  staticType(name: string): StaticType | undefined {
    return this.inferredTypes[name.toLowerCase()];
  }
}

function createDefaultValue(dataType: string | undefined): RuntimeValue {
  const normalized = normalizeDataType(dataType ?? "");
  if (!normalized) return null;

  switch (normalized) {
    case DataType.ENTERO:
    case DataType.NUMERICO:
    case DataType.REAL:
      return 0;
    case DataType.LOGICO:
      return false;
    case DataType.CADENA:
    case DataType.CARACTER:
    case DataType.TEXTO:
      return "";
    default:
      return null;
  }
}

function defaultForStaticType(type: StaticType | undefined): ScalarValue {
  switch (type) {
    case "num":
      return 0;
    case "bool":
      return false;
    case "str":
      return "";
    default:
      return null;
  }
}

function inferDataType(value: RuntimeValue): string | undefined {
  if (typeof value === "boolean") {
    return DataType.LOGICO;
  }

  if (typeof value === "number") {
    return DataType.REAL;
  }

  if (typeof value === "string") {
    return DataType.CARACTER;
  }

  return undefined;
}

function staticTypeOfValue(value: RuntimeValue): StaticType | undefined {
  if (typeof value === "number") return "num";
  if (typeof value === "string") return "str";
  if (typeof value === "boolean") return "bool";
  return undefined;
}

function staticTypeOfDataType(dataType: string | undefined): StaticType | undefined {
  if (!dataType) return undefined;
  if (isNumericType(dataType)) return "num";
  if (isLogicalType(dataType)) return "bool";
  if (isTextType(dataType)) return "str";
  return undefined;
}

function createArray(
  dimensions: number[],
  leafValue: RuntimeValue = null,
  initialized = false,
  dataType?: string
): ArrayValue {
  const [current, ...rest] = dimensions;
  return {
    kind: "array",
    dimensions,
    items: Array.from({ length: current }, () =>
      rest.length > 0
        ? createArray(rest, leafValue, initialized, dataType)
        : {
            value: leafValue,
            initialized,
            protectedCounter: false,
            dataType,
          }
    ),
  };
}

function isArrayValue(value: RuntimeValue): value is ArrayValue {
  return value !== null && typeof value === "object" && value.kind === "array";
}

/** All element cells of an array, in row-major order. */
function arrayLeaves(array: ArrayValue): Cell[] {
  const cells: Cell[] = [];
  for (const item of array.items) {
    if ("kind" in item) {
      cells.push(...arrayLeaves(item));
    } else {
      cells.push(item);
    }
  }
  return cells;
}

function toBoolean(value: RuntimeValue): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    return value.length > 0;
  }

  return value !== null;
}

function toNumber(value: RuntimeValue): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  return 0;
}

function toNumberOrString(value: RuntimeValue): number | string {
  return typeof value === "string" ? value : toNumber(value);
}

const numericInputPattern = /^[+-]?(\d+\.?\d*|\.\d+)$/;

// Type of a value typed by the user at a Leer prompt.
function guessInputType(input: string): StaticType {
  if (numericInputPattern.test(input)) {
    return "num";
  }
  const upper = input.toUpperCase();
  if (upper === "VERDADERO" || upper === "FALSO") {
    return "bool";
  }
  return "str";
}

export interface InterpreterLimits {
  /**
   * Hand control back to the event loop every N steps so timers, messages
   * and (on the main thread) rendering can run during long executions.
   */
  yieldEvery?: number;
  /** Abort with RUNTIME_STEP_LIMIT once this many steps have run. */
  maxSteps?: number;
  /** Keep only the most recent N console lines in the result. */
  maxOutputLines?: number;
}

export interface InterpreterHooks {
  /**
   * Called before every statement runs. Returning a promise suspends the
   * program until it settles, which is how a step debugger can pause.
   */
  onStatement?: (event: ExecutionStatementEvent) => void | Promise<void>;
  /** Polled every step; returning true ends the run with state "stopped". */
  shouldStop?: () => boolean;
  /**
   * How to yield every `limits.yieldEvery` steps. Defaults to setTimeout(0),
   * which browsers clamp to 4ms or more; hosts can supply something cheaper.
   */
  yieldToHost?: () => Promise<void>;
}

export interface InterpreterOptions {
  hooks?: InterpreterHooks;
  limits?: InterpreterLimits;
  random?: () => number;
  settings?: Partial<EngineSettings>;
}

export class Interpreter {
  private readonly hooks: InterpreterHooks;
  private readonly limits: InterpreterLimits;
  private readonly random: () => number;
  private readonly settings: EngineSettings;

  constructor(options: InterpreterOptions = {}) {
    this.hooks = options.hooks ?? {};
    this.limits = options.limits ?? {};
    this.random = options.random ?? Math.random;
    this.settings = normalizeEngineSettings(options.settings);
  }

  parse(source: string): ParseResult {
    return new Parser(source, { settings: this.settings }).parse();
  }

  async execute(
    program: ProgramNode,
    runtime: Runtime
  ): Promise<ExecutionResult> {
    const buffer = createOutputBuffer(this.limits.maxOutputLines);
    const routines = new Map<string, RoutineNode>();

    for (const routine of program.routines) {
      routines.set(routine.name.toLowerCase(), routine);
    }

    try {
      await this.executeMain(program.entry, runtime, buffer, routines);
      return {
        output: buffer.snapshot(),
        diagnostics: [],
        state: "ok",
      };
    } catch (error) {
      if (error instanceof RuntimeError) {
        return {
          output: buffer.snapshot(),
          diagnostics: [error.diagnostic],
          state: "runtime_error",
        };
      }

      if (error instanceof ExecutionStopped) {
        return {
          output: buffer.snapshot(),
          diagnostics: [],
          state: "stopped",
        };
      }

      throw error;
    }
  }

  async run(source: string, runtime: Runtime): Promise<ExecutionResult> {
    const parsed = this.parse(source);
    if (!parsed.program) {
      return {
        output: [],
        diagnostics: parsed.diagnostics,
        state: "parse_error",
      };
    }

    return this.execute(parsed.program, runtime);
  }

  private async executeMain(
    main: MainRoutineNode,
    runtime: Runtime,
    buffer: ReturnType<typeof createOutputBuffer>,
    routines: Map<string, RoutineNode>
  ): Promise<void> {
    const scope = new Scope(main.inferredTypes);
    const context = this.createContext(runtime, buffer, routines);
    await this.executeBlock(main.body, scope, context);
  }

  private createContext(
    runtime: Runtime,
    buffer: ReturnType<typeof createOutputBuffer>,
    routines: Map<string, RoutineNode>
  ): ExecutionContext {
    return {
      runtime,
      buffer,
      callDepth: 0,
      routineName: null,
      routines,
      settings: this.settings,
      counter: { steps: 0, lastStatement: null },
    };
  }

  /**
   * Counts one unit of work. Blocks count too, so loops with an empty body
   * still advance the budget and can be stopped.
   */
  private step(
    statement: StatementNode | null,
    context: ExecutionContext
  ): Promise<void> | undefined {
    context.counter.steps += 1;
    if (statement) {
      context.counter.lastStatement = statement;
    }

    if (this.hooks.shouldStop?.()) {
      throw new ExecutionStopped();
    }

    const { maxSteps, yieldEvery } = this.limits;
    if (maxSteps !== undefined && context.counter.steps > maxSteps) {
      this.runtimeError(
        context.counter.lastStatement,
        `Execution stopped after ${maxSteps} steps. The program may contain an infinite loop.`,
        "RUNTIME_STEP_LIMIT"
      );
    }

    if (yieldEvery && context.counter.steps % yieldEvery === 0) {
      return (this.hooks.yieldToHost ?? yieldToEventLoop)().then(() => {
        if (this.hooks.shouldStop?.()) {
          throw new ExecutionStopped();
        }
      });
    }

    return undefined;
  }

  private async executeBlock(
    statements: StatementNode[],
    scope: Scope,
    context: ExecutionContext
  ): Promise<RuntimeValue | undefined> {
    const blockStep = this.step(null, context);
    if (blockStep) {
      await blockStep;
    }

    for (const statement of statements) {
      const statementStep = this.step(statement, context);
      if (statementStep) {
        await statementStep;
      }

      if (this.hooks.onStatement) {
        await this.hooks.onStatement({
          line: statement.span?.start.line ?? 1,
          column: statement.span?.start.column ?? 1,
          kind: statement.kind,
          callDepth: context.callDepth,
          routine: context.routineName,
          step: context.counter.steps,
          variables: () => scope.snapshot(),
        });
      }

      const result = await this.executeStatement(statement, scope, context);
      if (result !== undefined) {
        return result;
      }
    }

    return undefined;
  }

  private async evaluateCondition(
    expression: ExpressionNode,
    scope: Scope,
    context: ExecutionContext
  ): Promise<boolean> {
    const value = await this.evaluateExpression(expression, scope, context);
    if (typeof value === "boolean") {
      return value;
    }
    if (value === null) {
      return false;
    }
    this.runtimeError(
      expression,
      "La condición debe ser una expresión lógica.",
      "RUNTIME_CONDITION_NOT_LOGICAL"
    );
  }

  private async executeStatement(
    statement: StatementNode,
    scope: Scope,
    context: ExecutionContext
  ): Promise<RuntimeValue | undefined> {
    switch (statement.kind) {
      case "define":
        for (const name of statement.names) {
          const normalizedType = normalizeDataType(statement.dataType);
          const local = scope.resolveLocal(name);

          if (!local) {
            scope.define(name, {
              value: createDefaultValue(normalizedType ?? undefined),
              initialized: !context.settings.forceInitVars,
              dataType: normalizedType ?? undefined,
              origin: "define",
              definedBy: statement,
            });
            continue;
          }

          // A variable can only be defined before it is used (and only once).
          if (
            local.origin === "usage" ||
            (local.origin === "define" && local.definedBy !== statement)
          ) {
            this.runtimeError(
              statement,
              `La variable "${name}" ya estaba definida o fue utilizada antes de Definir.`,
              "RUNTIME_ALREADY_DEFINED"
            );
          }

          this.applyDataType(local, normalizedType ?? "", context.settings);
        }
        return undefined;
      case "dimension":
        for (const item of statement.items) {
          const dimensions: number[] = [];
          for (const dimension of item.dimensions) {
            const value = await this.evaluateExpression(
              dimension,
              scope,
              context
            );
            if (typeof value !== "number") {
              this.runtimeError(
                dimension,
                "Las dimensiones deben ser numéricas.",
                "RUNTIME_ARRAY_DIMENSION"
              );
            }
            if (!Number.isInteger(value)) {
              this.runtimeError(
                dimension,
                "Las dimensiones solo pueden ser números enteros.",
                "RUNTIME_ARRAY_DIMENSION"
              );
            }
            if (value < 0 || (value === 0 && !context.settings.allowResizeArrays)) {
              this.runtimeError(
                dimension,
                "Array dimensions must evaluate to positive integers.",
                "RUNTIME_ARRAY_DIMENSION"
              );
            }
            dimensions.push(value);
          }

          if (statement.resize) {
            this.resizeArray(item.name, dimensions, scope, statement);
            continue;
          }

          const existing = scope.resolve(item.name) ?? scope.define(item.name);
          if (isArrayValue(existing.value)) {
            this.runtimeError(
              statement,
              `El arreglo "${item.name}" ya fue dimensionado.`,
              "RUNTIME_ARRAY_REDIMENSIONED"
            );
          }
          const leafType = existing.dataType;
          existing.value = createArray(
            dimensions,
            leafType ? createDefaultValue(leafType) : null,
            leafType ? !context.settings.forceInitVars : false,
            leafType
          );
          existing.initialized = true;
        }
        return undefined;
      case "assignment": {
        const target = await this.resolveReference(
          statement.target,
          scope,
          context,
          "write"
        );
        const value = await this.evaluateExpression(
          statement.value,
          scope,
          context
        );

        if (isArrayValue(value)) {
          this.runtimeError(
            statement,
            "No se puede asignar un arreglo completo.",
            "RUNTIME_ARRAY_ASSIGNMENT"
          );
        }

        // Type checking - only if target has a declared type
        if (target.dataType) {
          const valueType = inferDataType(value);
          if (valueType && !typesCompatible(target.dataType, valueType)) {
            this.runtimeError(
              statement,
              "No coinciden los tipos.",
              "RUNTIME_TYPE_MISMATCH"
            );
          }

          // PSeInt error 314: an Entero variable cannot hold a decimal value.
          if (
            isIntegerType(target.dataType) &&
            typeof value === "number" &&
            !Number.isInteger(value)
          ) {
            this.runtimeError(
              statement,
              "No coinciden los tipos, el valor a asignar debe ser un entero.",
              "RUNTIME_TYPE_INTEGER"
            );
          }
        }

        target.value = value;
        target.initialized = true;
        target.dataType ??= inferDataType(target.value);
        return undefined;
      }
      case "write": {
        for (const expression of statement.expressions) {
          const value = await this.evaluateExpression(
            expression,
            scope,
            context
          );
          if (isArrayValue(value)) {
            this.runtimeError(
              expression,
              "Faltan subíndices para el arreglo.",
              "RUNTIME_ARRAY_MISSING_INDEX"
            );
          }
          const output = formatRuntimeValue(value);
          context.buffer.write(output, false);
          await context.runtime.write(output, false);
        }
        if (statement.newline) {
          context.buffer.write("", true);
          await context.runtime.write("", true);
        }
        return undefined;
      }
      case "read": {
        for (const target of statement.targets) {
          await this.readInto(target, statement, scope, context);
        }
        return undefined;
      }
      case "if": {
        const branch = (await this.evaluateCondition(
          statement.condition,
          scope,
          context
        ))
          ? statement.thenBranch
          : statement.elseBranch;
        return this.executeBlock(branch, scope, context);
      }
      case "while":
        while (
          await this.evaluateCondition(statement.condition, scope, context)
        ) {
          const loopResult = await this.executeBlock(
            statement.body,
            scope,
            context
          );
          if (loopResult !== undefined) {
            return loopResult;
          }
        }
        return undefined;
      case "repeat":
        do {
          const loopResult = await this.executeBlock(
            statement.body,
            scope,
            context
          );
          if (loopResult !== undefined) {
            return loopResult;
          }
        } while (
          (await this.evaluateCondition(statement.condition, scope, context)) ===
          (statement.mode === "while")
        );
        return undefined;
      case "for": {
        const counter = this.resolveIdentifierCell(
          statement.variable,
          scope,
          statement,
          "loop_counter"
        );
        const previousProtection = counter.protectedCounter;

        const start = toNumber(
          await this.evaluateExpression(statement.start, scope, context)
        );
        const end = toNumber(
          await this.evaluateExpression(statement.end, scope, context)
        );
        const step = statement.step
          ? toNumber(
              await this.evaluateExpression(statement.step, scope, context)
            )
          : context.settings.deduceNegativeForStep && start > end
          ? -1
          : 1;

        if (step === 0) {
          this.runtimeError(
            statement.start,
            "For loop step cannot be zero.",
            "RUNTIME_FOR_STEP"
          );
        }

        const forward = step > 0;
        counter.protectedCounter = context.settings.protectForCounter;

        try {
          for (
            counter.value = start, counter.initialized = true;
            forward
              ? toNumber(counter.value) <= end
              : toNumber(counter.value) >= end;
            counter.value = toNumber(counter.value) + step
          ) {
            const loopResult = await this.executeBlock(
              statement.body,
              scope,
              context
            );
            if (loopResult !== undefined) {
              return loopResult;
            }
          }
        } finally {
          counter.protectedCounter = previousProtection;
          if (context.settings.protectForCounter) {
            counter.initialized = false;
          } else {
            counter.initialized = true;
          }
        }
        return undefined;
      }
      case "forEach": {
        const collection = await this.evaluateExpression(
          statement.collection,
          scope,
          context
        );
        if (!isArrayValue(collection)) {
          this.runtimeError(
            statement.collection,
            "Para Cada requires an array collection.",
            "RUNTIME_FOR_EACH"
          );
        }
        // The loop variable is an alias of each element: assigning to it
        // (or reading into it) changes the array.
        const previous = scope.resolveLocal(statement.variable);
        try {
          for (const item of arrayLeaves(collection)) {
            scope.bind(statement.variable, item);
            const loopResult = await this.executeBlock(
              statement.body,
              scope,
              context
            );
            if (loopResult !== undefined) {
              return loopResult;
            }
          }
        } finally {
          if (previous) {
            scope.bind(statement.variable, previous);
          } else {
            scope.unbind(statement.variable);
          }
        }
        return undefined;
      }
      case "switch": {
        const value = await this.evaluateExpression(
          statement.expression,
          scope,
          context
        );
        if (typeof value === "boolean" || isArrayValue(value)) {
          this.runtimeError(
            statement.expression,
            "La expresión de Segun debe ser numérica o de texto.",
            "RUNTIME_SWITCH_TYPE"
          );
        }
        if (
          context.settings.integerOnlySwitch &&
          !Number.isInteger(toNumber(value))
        ) {
          this.runtimeError(
            statement.expression,
            "Segun only accepts integer control values in the current profile.",
            "RUNTIME_SWITCH_INTEGER_ONLY"
          );
        }

        let matched = false;
        for (const switchCase of statement.cases) {
          const caseValues: RuntimeValue[] = [];
          for (const caseValue of switchCase.values) {
            const resolved = await this.evaluateExpression(
              caseValue,
              scope,
              context
            );
            if (
              context.settings.integerOnlySwitch &&
              !Number.isInteger(toNumber(resolved))
            ) {
              this.runtimeError(
                caseValue,
                "Segun only accepts integer case values in the current profile.",
                "RUNTIME_SWITCH_INTEGER_ONLY"
              );
            }
            if (
              typeof resolved === "boolean" ||
              (value !== null &&
                resolved !== null &&
                typeof resolved !== typeof value)
            ) {
              this.runtimeError(
                caseValue,
                "El valor de la opción no coincide con el tipo de la expresión de Segun.",
                "RUNTIME_SWITCH_TYPE"
              );
            }
            caseValues.push(resolved);
          }
          if (caseValues.some((candidate) => this.valuesEqual(candidate, value))) {
            matched = true;
            const caseResult = await this.executeBlock(
              switchCase.body,
              scope,
              context
            );
            if (caseResult !== undefined) {
              return caseResult;
            }
            break;
          }
        }

        if (!matched && statement.defaultCase.length > 0) {
          return this.executeBlock(statement.defaultCase, scope, context);
        }

        return undefined;
      }
      case "expression":
        await this.evaluateExpression(statement.expression, scope, context, true);
        return undefined;
      case "clear":
        context.buffer.clear();
        await context.runtime.clear();
        return undefined;
      case "wait":
        if (statement.mode === "key") {
          await context.runtime.waitForKey();
          return undefined;
        }
        await context.runtime.sleep(
          toNumber(
            await this.evaluateExpression(statement.durationMs!, scope, context)
          )
        );
        return undefined;
      case "return":
        return statement.expression
          ? await this.evaluateExpression(statement.expression, scope, context)
          : null;
    }
  }

  private async readInto(
    target: AssignableExpressionNode,
    statement: StatementNode,
    scope: Scope,
    context: ExecutionContext
  ): Promise<void> {
    const cell = await this.resolveReference(
      target,
      scope,
      context,
      "read_target"
    );
    if (isArrayValue(cell.value)) {
      this.runtimeError(
        statement,
        "Faltan subíndices para el arreglo.",
        "RUNTIME_ARRAY_MISSING_INDEX"
      );
    }

    let rawInput: string;
    try {
      rawInput = await context.runtime.read();
    } catch (error) {
      this.runtimeError(
        statement,
        `Sin entradas disponibles${error instanceof Error && error.message ? ` (${error.message})` : ""}.`,
        "RUNTIME_NO_INPUT"
      );
    }

    // The type the variable must hold: from Definir, from what the program
    // does with it elsewhere (static inference), or from its current value.
    const baseName = this.baseName(target);
    const expected =
      staticTypeOfDataType(cell.dataType) ??
      scope.staticType(baseName) ??
      (cell.initialized ? staticTypeOfValue(cell.value) : undefined);

    let input = rawInput;
    const upper = input.toUpperCase();
    if (upper === "VERDADERO" || upper === "FALSO") {
      input = upper;
    }
    if (expected === "bool" && input.length === 1) {
      const letter = input.toUpperCase();
      if (letter === "F" || letter === "0") input = "FALSO";
      if (letter === "V" || letter === "1") input = "VERDADERO";
    }

    const guessed = guessInputType(input);
    const finalType = expected ?? guessed;
    if (finalType !== "str" && guessed !== finalType) {
      this.runtimeError(
        statement,
        `No coinciden los tipos (${baseName}).`,
        "RUNTIME_INPUT_TYPE"
      );
    }
    if (
      finalType === "num" &&
      isIntegerType(cell.dataType) &&
      input.includes(".")
    ) {
      this.runtimeError(
        statement,
        `No coinciden los tipos (${baseName}), el valor ingresado debe ser un entero.`,
        "RUNTIME_INPUT_INTEGER"
      );
    }

    cell.value =
      finalType === "num"
        ? Number(input)
        : finalType === "bool"
          ? input === "VERDADERO"
          : rawInput;
    cell.initialized = true;
    cell.dataType ??= inferDataType(cell.value);
  }

  private baseName(target: ExpressionNode): string {
    if (target.kind === "identifier") return target.name;
    if (target.kind === "arrayAccess") return this.baseName(target.target);
    return "";
  }

  private resizeArray(
    name: string,
    dimensions: number[],
    scope: Scope,
    statement: StatementNode
  ): void {
    const cell = scope.resolve(name);
    if (!cell || !isArrayValue(cell.value)) {
      this.runtimeError(
        statement,
        `"${name}" no es un arreglo.`,
        "RUNTIME_ARRAY_TARGET"
      );
    }
    const current = cell.value;
    if (current.dimensions.length !== dimensions.length) {
      this.runtimeError(
        statement,
        "No se puede cambiar la cantidad de dimensiones de un arreglo.",
        "RUNTIME_RESIZE_DIMENSIONS"
      );
    }
    const leafType =
      cell.dataType ??
      arrayLeaves(current).find((leaf) => leaf.dataType)?.dataType;
    const resized = createArray(
      dimensions,
      leafType ? createDefaultValue(leafType) : null,
      leafType ? !this.settings.forceInitVars : false,
      leafType
    );
    const copy = (from: ArrayValue, to: ArrayValue) => {
      const shared = Math.min(from.items.length, to.items.length);
      for (let index = 0; index < shared; index += 1) {
        const source = from.items[index]!;
        const destination = to.items[index]!;
        if ("kind" in source && "kind" in destination) {
          copy(source, destination);
        } else if (!("kind" in source)) {
          to.items[index] = source;
        }
      }
    };
    copy(current, resized);
    cell.value = resized;
  }

  private valuesEqual(left: RuntimeValue, right: RuntimeValue): boolean {
    if (typeof left === "number" && typeof right === "number") {
      return left === right;
    }
    return left === right;
  }

  private applyDataType(
    cell: Cell,
    dataType: string,
    settings: EngineSettings
  ): void {
    cell.dataType = dataType;

    if (isArrayValue(cell.value)) {
      this.applyArrayLeafType(cell.value, dataType, !settings.forceInitVars);
      cell.initialized = true;
      return;
    }

    if (!cell.initialized) {
      cell.value = createDefaultValue(dataType);
      cell.initialized = !settings.forceInitVars;
      return;
    }

    if (cell.value === null) {
      cell.value = createDefaultValue(dataType);
    }
  }

  private applyArrayLeafType(
    arrayValue: ArrayValue,
    dataType: string,
    initializedByDefault: boolean
  ): void {
    for (const item of arrayValue.items) {
      if ("kind" in item) {
        this.applyArrayLeafType(item, dataType, initializedByDefault);
        continue;
      }

      item.dataType = dataType;
      if (!item.initialized) {
        item.value = createDefaultValue(dataType);
        item.initialized = initializedByDefault;
      }
    }
  }

  // Uninitialized variables read as the default value of their type.
  private readCellValue(cell: Cell, name: string, scope: Scope): RuntimeValue {
    if (cell.initialized || cell.value !== null) {
      return cell.value;
    }
    return (
      createDefaultValue(cell.dataType) ??
      defaultForStaticType(scope.staticType(name))
    );
  }

  private async evaluateExpression(
    expression: ExpressionNode,
    scope: Scope,
    context: ExecutionContext,
    asStatement = false
  ): Promise<RuntimeValue> {
    switch (expression.kind) {
      case "literal":
        return expression.value;
      case "group":
        return this.evaluateExpression(expression.expression, scope, context);
      case "identifier": {
        const routine = context.routines.get(expression.name.toLowerCase());
        if (!scope.resolve(expression.name) && routine) {
          if (routine.params.length > 0) {
            this.runtimeError(
              expression,
              `Faltan argumentos para "${routine.name}".`,
              "RUNTIME_ARGUMENT_COUNT"
            );
          }
          return this.callRoutine(routine, [], scope, context, expression, asStatement);
        }
        const cell = this.resolveIdentifierCell(
          expression.name,
          scope,
          expression,
          "read"
        );
        return this.readCellValue(cell, expression.name, scope);
      }
      case "arrayAccess": {
        const cell = await this.resolveReference(
          expression,
          scope,
          context,
          "read"
        );
        return this.readCellValue(cell, this.baseName(expression), scope);
      }
      case "call": {
        const routine = context.routines.get(expression.callee.toLowerCase());
        if (routine) {
          return this.callRoutine(routine, expression.args, scope, context, expression, asStatement);
        }
        return this.callBuiltIn(
          expression.callee,
          expression.args,
          scope,
          context,
          expression
        );
      }
      case "unary": {
        const operand = await this.evaluateExpression(
          expression.operand,
          scope,
          context
        );
        if (expression.operator === "-") {
          return -toNumber(operand);
        }
        return !toBoolean(operand);
      }
      case "binary":
        return this.evaluateBinary(expression, scope, context);
    }
  }

  private async evaluateBinary(
    expression: ExpressionNode & { kind: "binary" },
    scope: Scope,
    context: ExecutionContext
  ): Promise<RuntimeValue> {
    if (expression.operator === "AND") {
      const left = await this.evaluateExpression(
        expression.left,
        scope,
        context
      );
      if (!toBoolean(left)) {
        return false;
      }
      const right = await this.evaluateExpression(
        expression.right,
        scope,
        context
      );
      return toBoolean(right);
    }

    if (expression.operator === "OR") {
      const left = await this.evaluateExpression(
        expression.left,
        scope,
        context
      );
      if (toBoolean(left)) {
        return true;
      }
      const right = await this.evaluateExpression(
        expression.right,
        scope,
        context
      );
      return toBoolean(right);
    }

    const left = await this.evaluateExpression(expression.left, scope, context);
    const right = await this.evaluateExpression(
      expression.right,
      scope,
      context
    );

    switch (expression.operator) {
      case "+":
        if (typeof left === "string" || typeof right === "string") {
          if (!context.settings.allowConcatenation) {
            this.runtimeError(
              expression,
              'String concatenation with "+" is disabled in the current profile.',
              "RUNTIME_CONCAT_DISABLED"
            );
          }
          return `${formatRuntimeValue(left)}${formatRuntimeValue(right)}`;
        }
        return toNumber(left) + toNumber(right);
      case "-":
        return toNumber(left) - toNumber(right);
      case "*":
        return toNumber(left) * toNumber(right);
      case "/":
        if (toNumber(right) === 0) {
          this.runtimeError(expression, "División por cero.", "RUNTIME_DIVISION_BY_ZERO");
        }
        return toNumber(left) / toNumber(right);
      case "%":
        if (toNumber(right) === 0) {
          this.runtimeError(expression, "División por cero.", "RUNTIME_DIVISION_BY_ZERO");
        }
        return toNumber(left) % toNumber(right);
      case "^":
        return Math.pow(toNumber(left), toNumber(right));
      case "=":
        return left === right;
      case "<>":
        return left !== right;
      case "<":
        return toNumberOrString(left) < toNumberOrString(right);
      case ">":
        return toNumberOrString(left) > toNumberOrString(right);
      case "<=":
        return toNumberOrString(left) <= toNumberOrString(right);
      case ">=":
        return toNumberOrString(left) >= toNumberOrString(right);
      default:
        return null;
    }
  }

  private resolveIdentifierCell(
    name: string,
    scope: Scope,
    node: { span?: { start: { line: number; column: number } } } | null,
    mode: ReferenceMode
  ): Cell {
    let cell = scope.resolve(name);
    if (!cell) {
      if (
        this.settings.forceDefineVars ||
        (mode === "read" && this.settings.forceInitVars)
      ) {
        const message =
          mode === "read"
            ? `Variable "${name}" must be defined before use.`
            : `Variable "${name}" must be defined with Definir before assignment or input.`;
        this.runtimeError(node, message, "RUNTIME_DEFINE_REQUIRED");
      }

      cell = scope.define(name, {
        value: null,
        initialized: false,
        dataType: undefined,
        origin: "usage",
      });
    }

    if (
      (mode === "write" || mode === "read_target" || mode === "loop_counter") &&
      cell.protectedCounter
    ) {
      this.runtimeError(
        node,
        `Cannot modify the protected Para counter "${name}".`,
        "RUNTIME_PROTECTED_COUNTER"
      );
    }

    if (mode === "read") {
      this.ensureReadableCell(cell, name, node);
    } else if (this.settings.forceDefineVars && !cell.dataType) {
      this.runtimeError(
        node,
        `Variable "${name}" must be defined with Definir before assignment or input.`,
        "RUNTIME_DEFINE_REQUIRED"
      );
    }

    return cell;
  }

  private ensureReadableCell(
    cell: Cell,
    name: string,
    node: { span?: { start: { line: number; column: number } } } | null
  ): void {
    if (this.settings.forceDefineVars && !cell.dataType) {
      this.runtimeError(
        node,
        `Variable "${name}" must be defined before use.`,
        "RUNTIME_DEFINE_REQUIRED"
      );
    }

    if (this.settings.forceInitVars && !cell.initialized) {
      this.runtimeError(
        node,
        `Variable "${name}" is not initialized.`,
        "RUNTIME_UNINITIALIZED"
      );
    }
  }

  private async resolveReference(
    expression: AssignableExpressionNode,
    scope: Scope,
    context: ExecutionContext,
    mode: ReferenceMode
  ): Promise<Cell> {
    if (expression.kind === "identifier") {
      const cell = this.resolveIdentifierCell(
        expression.name,
        scope,
        expression,
        mode
      );
      if (mode !== "read" && isArrayValue(cell.value)) {
        this.runtimeError(
          expression,
          `Faltan subíndices para el arreglo (${expression.name}).`,
          "RUNTIME_ARRAY_MISSING_INDEX"
        );
      }
      return cell;
    }

    const baseCell =
      expression.target.kind === "identifier"
        ? scope.resolve(expression.target.name)
        : null;
    const base = baseCell
      ? baseCell.value
      : await this.evaluateExpression(expression.target, scope, context);
    if (!isArrayValue(base)) {
      this.runtimeError(
        expression,
        `La variable (${this.baseName(expression)}) no es un arreglo.`,
        "RUNTIME_ARRAY_TARGET"
      );
    }

    const indices: number[] = [];
    for (const indexExpression of expression.indices) {
      const value = await this.evaluateExpression(
        indexExpression,
        scope,
        context
      );
      indices.push(toNumber(value));
    }

    const cell = this.resolveArrayCell(base, indices, expression);
    if (mode === "read") {
      this.ensureReadableArrayCell(cell, expression);
    } else if (this.settings.forceDefineVars && !cell.dataType) {
      this.runtimeError(
        expression,
        "Array elements must be typed with Definir before assignment or input.",
        "RUNTIME_DEFINE_REQUIRED"
      );
    }
    return cell;
  }

  private ensureReadableArrayCell(
    cell: Cell,
    node: { span?: { start: { line: number; column: number } } } | null
  ): void {
    if (this.settings.forceDefineVars && !cell.dataType) {
      this.runtimeError(
        node,
        "Array elements must be typed with Definir before use.",
        "RUNTIME_DEFINE_REQUIRED"
      );
    }

    if (this.settings.forceInitVars && !cell.initialized) {
      this.runtimeError(
        node,
        "Array element is not initialized.",
        "RUNTIME_UNINITIALIZED"
      );
    }
  }

  private resolveArrayCell(
    array: ArrayValue,
    indices: number[],
    expression: ArrayAccessExpressionNode
  ): Cell {
    if (indices.length !== array.dimensions.length) {
      this.runtimeError(
        expression,
        "La cantidad de subíndices no coincide con las dimensiones del arreglo.",
        "RUNTIME_ARRAY_DIMENSION"
      );
    }

    let current: ArrayValue | Cell = array;

    for (
      let indexPosition = 0;
      indexPosition < indices.length;
      indexPosition += 1
    ) {
      const requestedIndex = indices[indexPosition];
      if (!Number.isInteger(requestedIndex)) {
        this.runtimeError(
          expression,
          "Array indices must be integers.",
          "RUNTIME_ARRAY_INDEX"
        );
      }

      const offset = this.settings.baseZeroArrays
        ? requestedIndex
        : requestedIndex - 1;
      const dimension = "kind" in current ? current.items.length : 0;
      if (!("kind" in current) || offset < 0 || offset >= dimension) {
        this.runtimeError(
          expression,
          "Array index out of bounds.",
          "RUNTIME_ARRAY_BOUNDS"
        );
      }

      const next: ArrayValue | Cell = current.items[offset]!;
      if (indexPosition === indices.length - 1) {
        if ("kind" in next) {
          this.runtimeError(
            expression,
            "Expected an array element, not a nested array.",
            "RUNTIME_ARRAY_ELEMENT"
          );
        }
        return next;
      }

      if (!("kind" in next)) {
        this.runtimeError(
          expression,
          "Missing nested array dimension.",
          "RUNTIME_ARRAY_DIMENSION"
        );
      }

      current = next;
    }

    this.runtimeError(
      expression,
      "Expected an array element.",
      "RUNTIME_ARRAY_ELEMENT"
    );
  }

  private async callRoutine(
    routine: RoutineNode,
    args: ExpressionNode[],
    callerScope: Scope,
    context: ExecutionContext,
    callNode: ExpressionNode,
    asStatement: boolean
  ): Promise<RuntimeValue> {
    if (args.length !== routine.params.length) {
      this.runtimeError(
        callNode,
        `"${routine.name}" espera ${routine.params.length} argumento(s).`,
        "RUNTIME_ARGUMENT_COUNT"
      );
    }
    if (!asStatement && !routine.returnTarget) {
      this.runtimeError(
        callNode,
        `"${routine.name}" no devuelve ningún valor.`,
        "RUNTIME_NO_RETURN_VALUE"
      );
    }

    // Each call gets its own variables: routines do not see the caller's.
    const scope = new Scope(routine.inferredTypes);

    for (let index = 0; index < routine.params.length; index += 1) {
      const parameter = routine.params[index]!;
      const argument = args[index]!;
      if (parameter.byReference) {
        if (argument.kind !== "identifier" && argument.kind !== "arrayAccess") {
          this.runtimeError(
            argument,
            "By-reference parameters require an assignable argument.",
            "RUNTIME_BY_REF"
          );
        }
        const cell =
          argument.kind === "identifier"
            ? this.resolveIdentifierCell(argument.name, callerScope, argument, "write")
            : await this.resolveReference(argument, callerScope, context, "write");
        scope.bind(parameter.name, cell);
        continue;
      }

      const value = await this.evaluateExpression(argument, callerScope, context);
      if (isArrayValue(value)) {
        // Arrays are always shared with the caller.
        if (parameter.explicitByValue) {
          this.runtimeError(
            argument,
            "Los arreglos solo pueden pasarse por referencia.",
            "RUNTIME_ARRAY_BY_VALUE"
          );
        }
        const cell =
          argument.kind === "identifier" ? callerScope.resolve(argument.name) : null;
        if (cell) {
          scope.bind(parameter.name, cell);
        } else {
          scope.define(parameter.name, { value, initialized: true, origin: "param" });
        }
        continue;
      }

      scope.define(parameter.name, {
        value,
        initialized: true,
        dataType: inferDataType(value),
        origin: "param",
      });
    }

    const implicitReturnTarget = routine.returnTarget;
    if (implicitReturnTarget && !scope.hasLocal(implicitReturnTarget)) {
      scope.define(implicitReturnTarget, {
        value: null,
        initialized: false,
        origin: "param",
      });
    }

    const returned = await this.executeBlock(routine.body, scope, {
      ...context,
      callDepth: context.callDepth + 1,
      routineName: routine.name,
    });
    if (returned !== undefined) {
      return returned;
    }

    if (implicitReturnTarget) {
      const cell = scope.resolve(implicitReturnTarget);
      return cell ? this.readCellValue(cell, implicitReturnTarget, scope) : null;
    }

    return null;
  }

  private async callBuiltIn(
    name: string,
    args: ExpressionNode[],
    scope: Scope,
    context: ExecutionContext,
    node: ExpressionNode
  ): Promise<RuntimeValue> {
    const normalized = normalizeIdentifier(name);
    const values: RuntimeValue[] = [];
    for (const arg of args) {
      values.push(await this.evaluateExpression(arg, scope, context));
    }

    if (
      !context.settings.enableStringFunctions &&
      [
        "CONCATENAR",
        "CONVERTIRANUMERO",
        "CONVERTIRATEXTO",
        "LONGITUD",
        "MAYUSCULAS",
        "MINUSCULAS",
        "SUBCADENA",
      ].includes(normalized)
    ) {
      this.runtimeError(
        node,
        `String function "${name}" is disabled in the current profile.`,
        "RUNTIME_STRING_FUNCTION_DISABLED"
      );
    }

    const arg = (index: number) => toNumber(values[index] ?? 0);
    const domainError = (message: string): never =>
      this.runtimeError(node, message, "RUNTIME_DOMAIN");

    switch (normalized) {
      case "ABS":
        return Math.abs(arg(0));
      case "ACOS":
        if (arg(0) < -1 || arg(0) > 1) {
          domainError("Argumento inválido para la función ACOS (debe estar en [-1;+1]).");
        }
        return Math.acos(arg(0));
      case "ASEN":
        if (arg(0) < -1 || arg(0) > 1) {
          domainError("Argumento inválido para la función ASEN (debe estar en [-1;+1]).");
        }
        return Math.asin(arg(0));
      case "ATAN":
        return Math.atan(arg(0));
      case "AZAR": {
        const limit = Math.trunc(arg(0));
        if (limit <= 0) {
          domainError("Azar de 0 o negativo.");
        }
        return Math.floor(this.random() * limit);
      }
      case "ALEATORIO": {
        let low = Math.trunc(arg(0));
        let high = Math.trunc(arg(1));
        if (high < low) {
          [low, high] = [high, low];
        }
        return low + Math.floor(this.random() * (high - low + 1));
      }
      case "CONCATENAR":
        return values.map((value) => formatRuntimeValue(value)).join("");
      case "CONVERTIRANUMERO": {
        const text = formatRuntimeValue(values[0] ?? "").trim();
        if (!numericInputPattern.test(text)) {
          this.runtimeError(
            node,
            `No se puede convertir "${text}" a número.`,
            "RUNTIME_CONVERSION"
          );
        }
        return Number(text);
      }
      case "CONVERTIRATEXTO":
        return formatRuntimeValue(values[0] ?? "");
      case "COS":
        return Math.cos(arg(0));
      case "EULER":
        return Math.E;
      case "EXP":
        return Math.exp(arg(0));
      case "FECHAACTUAL": {
        const now = new Date();
        return (
          now.getUTCFullYear() * 10000 +
          (now.getUTCMonth() + 1) * 100 +
          now.getUTCDate()
        );
      }
      case "HORAACTUAL": {
        const now = new Date();
        return now.getHours() * 10000 + now.getMinutes() * 100 + now.getSeconds();
      }
      case "LN":
        if (arg(0) <= 0) {
          domainError("Logaritmo de 0 o negativo.");
        }
        return Math.log(arg(0));
      case "LONGITUD":
        return formatRuntimeValue(values[0] ?? "").length;
      case "MAYUSCULAS":
        return formatRuntimeValue(values[0] ?? "").toUpperCase();
      case "MINUSCULAS":
        return formatRuntimeValue(values[0] ?? "").toLowerCase();
      case "PI":
        return Math.PI;
      case "RAIZ":
      case "RC":
        if (arg(0) < 0) {
          domainError("Raíz cuadrada de número negativo.");
        }
        return Math.sqrt(arg(0));
      case "REDON": {
        // Half away from zero: redon(-2.5) is -3.
        const value = arg(0);
        return Math.trunc(value + (value < 0 ? -0.5 : 0.5));
      }
      case "SEN":
        return Math.sin(arg(0));
      case "SUBCADENA": {
        const source = formatRuntimeValue(values[0] ?? "");
        const startIndex = Math.max(
          context.settings.baseZeroArrays ? 0 : 1,
          toNumber(values[1] ?? 1)
        );
        const endIndex = Math.max(
          startIndex,
          toNumber(values[2] ?? startIndex)
        );
        return context.settings.baseZeroArrays
          ? source.slice(startIndex, endIndex + 1)
          : source.slice(startIndex - 1, endIndex);
      }
      case "TAN":
        return Math.tan(arg(0));
      case "TRUNC": {
        // Values within 1e-11 of the next integer (what the user sees once
        // output is rounded to 10 decimals) truncate to it: trunc(100*0.57)
        // is 57, not 56.
        const value = arg(0);
        let truncated = Math.trunc(value);
        if (truncated + 1 - value < 1e-11) {
          truncated += 1;
        } else if (truncated - 1 - value > -1e-11) {
          truncated -= 1;
        }
        return truncated;
      }
      default:
        this.runtimeError(
          node,
          `Unknown function "${name}".`,
          "RUNTIME_FUNCTION"
        );
    }
  }

  private runtimeError(
    node: { span?: { start: { line: number; column: number } } } | null,
    message: string,
    code: string
  ): never {
    const span = node?.span;
    throw new RuntimeError({
      message,
      line: span?.start.line ?? 1,
      column: span?.start.column ?? 1,
      severity: "error",
      code,
    });
  }
}
