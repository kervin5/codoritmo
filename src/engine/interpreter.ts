import { Parser } from "./parser";
import { normalizeEngineSettings } from "./settings";
import {
  ArrayAccessExpressionNode,
  AssignableExpressionNode,
  DataType,
  Diagnostic,
  EngineSettings,
  ExecutionResult,
  ExpressionNode,
  isIntegerType,
  isLogicalType,
  isNumericType,
  MainRoutineNode,
  normalizeDataType,
  ParseResult,
  ProgramNode,
  Runtime,
  RoutineNode,
  StatementNode,
  typesCompatible,
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
}

interface ArrayValue {
  kind: "array";
  dimensions: number[];
  items: Array<ArrayValue | Cell>;
}

interface ExecutionContext {
  buffer: ReturnType<typeof createOutputBuffer>;
  routines: Map<string, RoutineNode>;
  runtime: Runtime;
  settings: EngineSettings;
}

class RuntimeError extends Error {
  constructor(public readonly diagnostic: Diagnostic) {
    super(diagnostic.message);
  }
}

class Scope {
  private readonly values = new Map<string, Cell>();

  constructor(private readonly parent?: Scope) {}

  define(name: string, initial: Partial<Cell> = {}): Cell {
    const cell: Cell = {
      value: null,
      initialized: false,
      protectedCounter: false,
      ...initial,
    };
    this.values.set(name.toLowerCase(), cell);
    return cell;
  }

  bind(name: string, cell: Cell): Cell {
    this.values.set(name.toLowerCase(), cell);
    return cell;
  }

  resolve(name: string): Cell | null {
    const local = this.values.get(name.toLowerCase());
    if (local) {
      return local;
    }

    return this.parent?.resolve(name) ?? null;
  }

  resolveLocal(name: string): Cell | null {
    return this.values.get(name.toLowerCase()) ?? null;
  }

  hasLocal(name: string): boolean {
    return this.values.has(name.toLowerCase());
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
            value: cloneValue(leafValue),
            initialized,
            protectedCounter: false,
            dataType,
          }
    ),
  };
}

function cloneValue(value: RuntimeValue): RuntimeValue {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (value.kind === "array") {
    return {
      kind: "array",
      dimensions: [...value.dimensions],
      items: value.items.map((item) =>
        "kind" in item
          ? (cloneValue(item) as ArrayValue)
          : {
              value: cloneValue(item.value),
              initialized: item.initialized,
              protectedCounter: item.protectedCounter,
              dataType: item.dataType,
            }
      ),
    };
  }

  return value;
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

export interface InterpreterOptions {
  random?: () => number;
  settings?: Partial<EngineSettings>;
}

export class Interpreter {
  private readonly random: () => number;
  private readonly settings: EngineSettings;

  constructor(options: InterpreterOptions = {}) {
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
    const buffer = createOutputBuffer();
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
    const scope = new Scope();
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
      routines,
      settings: this.settings,
    };
  }

  private async executeBlock(
    statements: StatementNode[],
    scope: Scope,
    context: ExecutionContext
  ): Promise<RuntimeValue | undefined> {
    for (const statement of statements) {
      const result = await this.executeStatement(statement, scope, context);
      if (result !== undefined) {
        return result;
      }
    }

    return undefined;
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
            });
            continue;
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
            const size = Number(value);
            if (!Number.isInteger(size) || size <= 0) {
              this.runtimeError(
                dimension,
                "Array dimensions must evaluate to positive integers.",
                "RUNTIME_ARRAY_DIMENSION"
              );
            }
            dimensions.push(size);
          }

          const existing = scope.resolve(item.name) ?? scope.define(item.name);
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

          // Check for integer truncation case (PSeInt error 314)
          // When assigning a real to an integer (ENTERO/NUMERICO), it should error if the value has a decimal part
          // REAL can accept decimal values, so only check for ENTERO/NUMERICO
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
          const cell = await this.resolveReference(
            target,
            scope,
            context,
            "read_target"
          );
          const rawInput = await context.runtime.read();

          // Convert input based on the cell's data type
          if (cell.dataType) {
            if (isNumericType(cell.dataType)) {
              cell.value = toNumber(rawInput);
            } else if (isLogicalType(cell.dataType)) {
              cell.value = toBoolean(rawInput);
            } else {
              cell.value = rawInput;
            }
          } else {
            cell.value = rawInput;
          }

          cell.initialized = true;
          cell.dataType ??= inferDataType(cell.value);
        }
        return undefined;
      }
      case "if": {
        const condition = await this.evaluateExpression(
          statement.condition,
          scope,
          context
        );
        const branch = toBoolean(condition)
          ? statement.thenBranch
          : statement.elseBranch;
        return this.executeBlock(branch, scope, context);
      }
      case "while":
        while (
          toBoolean(
            await this.evaluateExpression(statement.condition, scope, context)
          )
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
        if (statement.mode === "until") {
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
            !toBoolean(
              await this.evaluateExpression(statement.condition, scope, context)
            )
          );
          return undefined;
        }

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
          toBoolean(
            await this.evaluateExpression(statement.condition, scope, context)
          )
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
        if (
          !collection ||
          typeof collection !== "object" ||
          collection.kind !== "array"
        ) {
          this.runtimeError(
            statement.collection,
            "Para Cada requires an array collection.",
            "RUNTIME_FOR_EACH"
          );
        }
        const target = this.resolveIdentifierCell(
          statement.variable,
          scope,
          statement,
          "write"
        );
        for (const item of collection.items) {
          if ("kind" in item) {
            target.value = item;
            target.initialized = true;
          } else {
            if (context.settings.forceInitVars && !item.initialized) {
              this.runtimeError(
                statement.collection,
                "Cannot iterate over an uninitialized array element.",
                "RUNTIME_UNINITIALIZED"
              );
            }
            target.value = item.value;
            target.initialized = item.initialized;
          }
          target.dataType ??= inferDataType(target.value);
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
      }
      case "switch": {
        const value = await this.evaluateExpression(
          statement.expression,
          scope,
          context
        );
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
            caseValues.push(resolved);
          }
          if (caseValues.some((candidate) => candidate === value)) {
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
        await this.evaluateExpression(statement.expression, scope, context);
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

  private applyDataType(
    cell: Cell,
    dataType: string,
    settings: EngineSettings
  ): void {
    cell.dataType = dataType;

    if (
      cell.value &&
      typeof cell.value === "object" &&
      cell.value.kind === "array"
    ) {
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

  private async evaluateExpression(
    expression: ExpressionNode,
    scope: Scope,
    context: ExecutionContext
  ): Promise<RuntimeValue> {
    switch (expression.kind) {
      case "literal":
        return expression.value;
      case "group":
        return this.evaluateExpression(expression.expression, scope, context);
      case "identifier": {
        const routine = context.routines.get(expression.name.toLowerCase());
        if (
          !scope.resolve(expression.name) &&
          routine &&
          routine.params.length === 0
        ) {
          return this.callRoutine(routine, [], scope, context);
        }
        const cell = this.resolveIdentifierCell(
          expression.name,
          scope,
          expression,
          "read"
        );
        return cell.value;
      }
      case "arrayAccess": {
        const cell = await this.resolveReference(
          expression,
          scope,
          context,
          "read"
        );
        return cell.value;
      }
      case "call": {
        const routine = context.routines.get(expression.callee.toLowerCase());
        if (routine) {
          return this.callRoutine(routine, expression.args, scope, context);
        }
        return this.callBuiltIn(
          expression.callee,
          expression.args,
          scope,
          context
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
        return toNumber(left) / toNumber(right);
      case "%":
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
      return this.resolveIdentifierCell(
        expression.name,
        scope,
        expression,
        mode
      );
    }

    const base = await this.evaluateExpression(
      expression.target,
      scope,
      context
    );
    if (!base || typeof base !== "object" || base.kind !== "array") {
      this.runtimeError(
        expression,
        "Expected an array target.",
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
      const dimension = "kind" in current ? current.dimensions[0] : 0;
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
    context: ExecutionContext
  ): Promise<RuntimeValue> {
    const scope = new Scope(callerScope);

    for (let index = 0; index < routine.params.length; index += 1) {
      const parameter = routine.params[index]!;
      const argument = args[index];
      if (parameter.byReference) {
        if (
          !argument ||
          (argument.kind !== "identifier" && argument.kind !== "arrayAccess")
        ) {
          this.runtimeError(
            argument ?? null,
            "By-reference parameters require an assignable argument.",
            "RUNTIME_BY_REF"
          );
        }
        scope.bind(
          parameter.name,
          await this.resolveReference(argument, callerScope, context, "write")
        );
      } else {
        const value = argument
          ? cloneValue(
              await this.evaluateExpression(argument, callerScope, context)
            )
          : null;
        scope.define(parameter.name, {
          value,
          initialized: argument !== undefined,
          dataType: inferDataType(value),
        });
      }
    }

    const implicitReturnTarget =
      routine.returnTarget ??
      (routine.headerKind === "Funcion" ? routine.name : undefined);
    if (implicitReturnTarget && !scope.hasLocal(implicitReturnTarget)) {
      scope.define(implicitReturnTarget, {
        value: null,
        initialized: false,
      });
    }

    const returned = await this.executeBlock(routine.body, scope, context);
    if (returned !== undefined) {
      return returned;
    }

    if (implicitReturnTarget) {
      return scope.resolve(implicitReturnTarget)?.value ?? null;
    }

    return null;
  }

  private async callBuiltIn(
    name: string,
    args: ExpressionNode[],
    scope: Scope,
    context: ExecutionContext
  ): Promise<RuntimeValue> {
    const normalized = name
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toUpperCase();
    const values: RuntimeValue[] = [];
    for (const arg of args) {
      values.push(await this.evaluateExpression(arg, scope, context));
    }

    if (
      !context.settings.enableStringFunctions &&
      [
        "CONCATENAR",
        "LONGITUD",
        "MAYUSCULAS",
        "MINUSCULAS",
        "SUBCADENA",
      ].includes(normalized)
    ) {
      this.runtimeError(
        args[0] ?? null,
        `String function "${name}" is disabled in the current profile.`,
        "RUNTIME_STRING_FUNCTION_DISABLED"
      );
    }

    switch (normalized) {
      case "ABS":
        return Math.abs(toNumber(values[0] ?? 0));
      case "ACOS":
        return Math.acos(toNumber(values[0] ?? 0));
      case "ASEN":
      case "ASIN":
        return Math.asin(toNumber(values[0] ?? 0));
      case "ATAN":
        return Math.atan(toNumber(values[0] ?? 0));
      case "AZAR":
        return Math.floor(this.random() * toNumber(values[0] ?? 0));
      case "CONCATENAR":
        return values.map((value) => formatRuntimeValue(value)).join("");
      case "CONVERTIRANUMERO":
        return Number(values[0] ?? 0);
      case "CONVERTIRATEXTO":
        return formatRuntimeValue(values[0] ?? "");
      case "COS":
        return Math.cos(toNumber(values[0] ?? 0));
      case "EXP":
        return Math.exp(toNumber(values[0] ?? 0));
      case "LN":
        return Math.log(toNumber(values[0] ?? 0));
      case "LONGITUD":
        return formatRuntimeValue(values[0] ?? "").length;
      case "MAYUSCULAS":
        return formatRuntimeValue(values[0] ?? "").toUpperCase();
      case "MINUSCULAS":
        return formatRuntimeValue(values[0] ?? "").toLowerCase();
      case "RAIZ":
      case "RC":
        return Math.sqrt(toNumber(values[0] ?? 0));
      case "REDON":
        return Math.round(toNumber(values[0] ?? 0));
      case "SEN":
      case "SIN":
        return Math.sin(toNumber(values[0] ?? 0));
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
        return Math.tan(toNumber(values[0] ?? 0));
      case "TRUNC":
        return Math.trunc(toNumber(values[0] ?? 0));
      default:
        this.runtimeError(
          args[0] ?? null,
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
