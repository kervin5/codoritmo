import type {
  AssignableExpressionNode,
  ExpressionNode,
  ParameterNode,
  ProgramNode,
  RoutineNode,
  StatementNode,
} from "../types";

/**
 * Static type inference for typed export targets (C, C++, and later Java...).
 *
 * Modelled on upstream PSeInt's TiposExporter: every statement imposes a type
 * constraint on the variables it touches (conditions are logical, dimensions
 * and indices are integer, assignments unify target and value...). The pass
 * runs to a fixed point over the whole program so that types also flow across
 * subprocess calls (argument -> parameter, and back for by-reference
 * parameters and arrays).
 *
 * "number" is a numeric value whose precision is still undetermined (an
 * integer literal, for example). It joins with "int" to "int" and with
 * "double" to "double", and resolves to "double" at the end, matching PSeInt
 * where plain numbers are real unless declared otherwise.
 */
export type InferredType =
  | "unknown"
  | "number"
  | "int"
  | "double"
  | "string"
  | "bool";

export interface ArrayShape {
  /** Size of each dimension when it is a compile-time constant, else null. */
  dims: (number | null)[];
}

export interface VariableInfo {
  /** Normalized (case and accent insensitive) variable name. */
  key: string;
  /** Name as first written in the source. */
  name: string;
  type: InferredType;
  /** Fixed by a Definir statement. */
  declared: boolean;
  array: ArrayShape | null;
  param: ParameterNode | null;
  /** Only ever used as the alias of a Para Cada loop. */
  forEachAlias: boolean;
}

export interface ScopeTypes {
  routine: RoutineNode | null;
  vars: Map<string, VariableInfo>;
  /** Variable holding the return value (Funcion r <- Nombre(...)). */
  returnKey: string | null;
  /** Type of explicit Retornar expressions, when there is no return variable. */
  returnType: InferredType;
}

export interface ProgramTypes {
  main: ScopeTypes;
  routines: Map<string, ScopeTypes>;
}

const STRING_BUILTINS = new Set([
  "CONCATENAR",
  "CONVERTIRATEXTO",
  "MAYUSCULAS",
  "MINUSCULAS",
  "SUBCADENA",
]);
const INTEGER_BUILTINS = new Set([
  "ALEATORIO",
  "AZAR",
  "LONGITUD",
  "REDON",
  "TRUNC",
]);
const REAL_BUILTINS = new Set([
  "ABS",
  "ACOS",
  "ASEN",
  "ASIN",
  "ATAN",
  "CONVERTIRANUMERO",
  "COS",
  "EXP",
  "LN",
  "RAIZ",
  "RC",
  "SEN",
  "SIN",
  "TAN",
]);
const RELATIONAL_OPERATORS = new Set(["=", "<>", "<", ">", "<=", ">="]);

export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function normalizeBuiltinName(name: string): string {
  return normalizeName(name).toUpperCase();
}

export function isBuiltinFunction(name: string): boolean {
  const normalized = normalizeBuiltinName(name);
  return (
    STRING_BUILTINS.has(normalized) ||
    INTEGER_BUILTINS.has(normalized) ||
    REAL_BUILTINS.has(normalized)
  );
}

export function isNumericType(type: InferredType): boolean {
  return type === "number" || type === "int" || type === "double";
}

/** Least upper bound of two types; on a category conflict the first wins. */
export function joinTypes(a: InferredType, b: InferredType): InferredType {
  if (a === b || b === "unknown") return a;
  if (a === "unknown") return b;
  if (isNumericType(a) && isNumericType(b)) {
    if (a === "double" || b === "double") return "double";
    return "int";
  }
  return a;
}

/** Final type used for declarations: undetermined numbers become real. */
export function resolveType(type: InferredType): InferredType {
  return type === "number" ? "double" : type;
}

export function mapDeclaredType(dataType: string): InferredType {
  switch (normalizeBuiltinName(dataType)) {
    case "ENTERO":
      return "int";
    case "REAL":
    case "NUMERO":
    case "NUMERICO":
    case "NUMERICA":
      return "double";
    case "LOGICO":
    case "LOGICA":
      return "bool";
    case "CARACTER":
    case "TEXTO":
    case "CADENA":
      return "string";
    default:
      return "unknown";
  }
}

/** Evaluates constant integer expressions such as `10` or `2*5`. */
export function evaluateConstant(expression: ExpressionNode): number | null {
  switch (expression.kind) {
    case "literal":
      return typeof expression.value === "number" ? expression.value : null;
    case "group":
      return evaluateConstant(expression.expression);
    case "unary": {
      const value = evaluateConstant(expression.operand);
      return expression.operator === "-" && value !== null ? -value : null;
    }
    case "binary": {
      const left = evaluateConstant(expression.left);
      const right = evaluateConstant(expression.right);
      if (left === null || right === null) return null;
      switch (expression.operator) {
        case "+":
          return left + right;
        case "-":
          return left - right;
        case "*":
          return left * right;
        default:
          return null;
      }
    }
    default:
      return null;
  }
}

export class TypeInference {
  private readonly routineNodes = new Map<string, RoutineNode>();
  private readonly result: ProgramTypes;
  private changed = false;

  constructor(private readonly program: ProgramNode) {
    for (const routine of program.routines) {
      this.routineNodes.set(normalizeName(routine.name), routine);
    }

    const routines = new Map<string, ScopeTypes>();
    for (const routine of program.routines) {
      routines.set(normalizeName(routine.name), this.createScope(routine));
    }
    this.result = { main: this.createScope(null), routines };
  }

  static infer(program: ProgramNode): ProgramTypes {
    return new TypeInference(program).run();
  }

  run(): ProgramTypes {
    for (let pass = 0; pass < 25; pass += 1) {
      this.changed = false;
      this.visitStatements(this.program.entry.body, this.result.main);
      for (const routine of this.program.routines) {
        const scope = this.result.routines.get(normalizeName(routine.name))!;
        this.visitStatements(routine.body, scope);
      }
      if (!this.changed) break;
    }
    return this.result;
  }

  // ---------------------------------------------------------------------------
  // Queries shared with the generators

  findRoutine(name: string): RoutineNode | undefined {
    return this.routineNodes.get(normalizeName(name));
  }

  private createScope(routine: RoutineNode | null): ScopeTypes {
    const scope: ScopeTypes = {
      routine,
      vars: new Map(),
      returnKey: null,
      returnType: "unknown",
    };
    if (routine) {
      for (const param of routine.params) {
        this.variable(scope, param.name).param = param;
      }
      if (routine.returnTarget) {
        scope.returnKey = this.variable(scope, routine.returnTarget).key;
      }
    }
    return scope;
  }

  private variable(scope: ScopeTypes, name: string): VariableInfo {
    const key = normalizeName(name);
    let info = scope.vars.get(key);
    if (!info) {
      info = {
        key,
        name,
        type: "unknown",
        declared: false,
        array: null,
        param: null,
        forEachAlias: false,
      };
      scope.vars.set(key, info);
      this.changed = true;
    }
    return info;
  }

  private merge(info: VariableInfo, type: InferredType): void {
    if (info.declared || type === "unknown") return;
    const next = joinTypes(info.type, type);
    if (next !== info.type) {
      info.type = next;
      this.changed = true;
    }
  }

  private setArray(info: VariableInfo, shape: ArrayShape): void {
    if (info.array) {
      if (info.array.dims.length !== shape.dims.length) return;
      const dims = info.array.dims.map((dim, index) => dim ?? shape.dims[index]);
      if (dims.some((dim, index) => dim !== info.array!.dims[index])) {
        info.array = { dims };
        this.changed = true;
      }
      return;
    }
    info.array = { dims: [...shape.dims] };
    this.changed = true;
  }

  routineReturnType(routine: RoutineNode): InferredType {
    const scope = this.result.routines.get(normalizeName(routine.name));
    if (!scope) return "unknown";
    if (scope.returnKey) return scope.vars.get(scope.returnKey)?.type ?? "unknown";
    return scope.returnType;
  }

  /** Type of an expression with what is known so far. */
  typeOf(expression: ExpressionNode, scope: ScopeTypes): InferredType {
    switch (expression.kind) {
      case "literal":
        if (expression.valueType === "string") return "string";
        if (expression.valueType === "boolean") return "bool";
        return Number.isInteger(expression.value) ? "number" : "double";
      case "group":
        return this.typeOf(expression.expression, scope);
      case "identifier": {
        const info = scope.vars.get(normalizeName(expression.name));
        if (info) return info.type;
        const routine = this.findRoutine(expression.name);
        if (routine) return this.routineReturnType(routine);
        if (normalizeBuiltinName(expression.name) === "PI") return "double";
        return "unknown";
      }
      case "arrayAccess":
        return expression.target.kind === "identifier"
          ? scope.vars.get(normalizeName(expression.target.name))?.type ??
              "unknown"
          : "unknown";
      case "call": {
        const builtin = normalizeBuiltinName(expression.callee);
        if (STRING_BUILTINS.has(builtin)) return "string";
        if (INTEGER_BUILTINS.has(builtin)) return "int";
        if (REAL_BUILTINS.has(builtin)) return "double";
        const routine = this.findRoutine(expression.callee);
        return routine ? this.routineReturnType(routine) : "unknown";
      }
      case "unary":
        if (expression.operator === "-") {
          const operand = this.typeOf(expression.operand, scope);
          return isNumericType(operand) ? operand : "number";
        }
        return "bool";
      case "binary": {
        const op = expression.operator;
        if (RELATIONAL_OPERATORS.has(op) || op === "AND" || op === "OR") {
          return "bool";
        }
        const left = this.typeOf(expression.left, scope);
        const right = this.typeOf(expression.right, scope);
        if (op === "+" && (left === "string" || right === "string")) {
          return "string";
        }
        if (op === "/" || op === "^") return "double";
        if (left === "double" || right === "double") return "double";
        const integral = (type: InferredType) =>
          type === "int" || type === "number";
        if (
          integral(left) &&
          integral(right) &&
          (left === "int" || right === "int")
        ) {
          return "int";
        }
        return "number";
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Constraint collection

  /** Pushes an expected type into the variables an expression is made of. */
  private apply(
    expression: ExpressionNode,
    type: InferredType,
    scope: ScopeTypes
  ): void {
    if (type === "unknown") return;
    switch (expression.kind) {
      case "identifier": {
        const key = normalizeName(expression.name);
        const info = scope.vars.get(key);
        if (info) {
          this.merge(info, type);
        } else if (
          !this.findRoutine(expression.name) &&
          normalizeBuiltinName(expression.name) !== "PI"
        ) {
          this.merge(this.variable(scope, expression.name), type);
        }
        break;
      }
      case "arrayAccess":
        if (expression.target.kind === "identifier") {
          this.merge(this.variable(scope, expression.target.name), type);
        }
        break;
      case "group":
        this.apply(expression.expression, type, scope);
        break;
      case "unary":
        if (expression.operator === "-") {
          if (isNumericType(type)) this.apply(expression.operand, type, scope);
        } else {
          this.apply(expression.operand, "bool", scope);
        }
        break;
      case "binary": {
        const op = expression.operator;
        if (op === "AND" || op === "OR") {
          this.apply(expression.left, "bool", scope);
          this.apply(expression.right, "bool", scope);
        } else if (op === "+" && type === "string") {
          this.apply(expression.left, "string", scope);
          this.apply(expression.right, "string", scope);
        } else if (["+", "-", "*", "/", "^", "%"].includes(op)) {
          if (!isNumericType(type)) break;
          const operandType =
            type === "int" && ["+", "-", "*", "%"].includes(op)
              ? "int"
              : "number";
          this.apply(expression.left, operandType, scope);
          this.apply(expression.right, operandType, scope);
        }
        break;
      }
      default:
        break;
    }
  }

  private applyTarget(
    target: AssignableExpressionNode,
    type: InferredType,
    scope: ScopeTypes
  ): void {
    const name =
      target.kind === "identifier"
        ? target.name
        : target.target.kind === "identifier"
        ? target.target.name
        : null;
    if (name) this.merge(this.variable(scope, name), type);
  }

  private visitExpression(expression: ExpressionNode, scope: ScopeTypes): void {
    switch (expression.kind) {
      case "group":
        this.visitExpression(expression.expression, scope);
        break;
      case "identifier": {
        if (
          !this.findRoutine(expression.name) &&
          normalizeBuiltinName(expression.name) !== "PI"
        ) {
          this.variable(scope, expression.name);
        }
        break;
      }
      case "arrayAccess":
        if (expression.target.kind === "identifier") {
          const info = this.variable(scope, expression.target.name);
          if (!info.array) {
            this.setArray(info, {
              dims: expression.indices.map(() => null),
            });
          }
        }
        for (const index of expression.indices) {
          this.visitExpression(index, scope);
          this.apply(index, "int", scope);
        }
        break;
      case "unary":
        this.visitExpression(expression.operand, scope);
        break;
      case "binary": {
        this.visitExpression(expression.left, scope);
        this.visitExpression(expression.right, scope);
        if (RELATIONAL_OPERATORS.has(expression.operator)) {
          const left = this.typeOf(expression.left, scope);
          const right = this.typeOf(expression.right, scope);
          const widen = (type: InferredType) =>
            type === "int" ? "number" : type;
          if (left !== "unknown") this.apply(expression.right, widen(left), scope);
          if (right !== "unknown") this.apply(expression.left, widen(right), scope);
        } else {
          this.apply(expression, this.typeOf(expression, scope), scope);
        }
        break;
      }
      case "call":
        for (const arg of expression.args) this.visitExpression(arg, scope);
        this.visitCall(expression.callee, expression.args, scope);
        break;
      default:
        break;
    }
  }

  private visitCall(
    callee: string,
    args: ExpressionNode[],
    scope: ScopeTypes
  ): void {
    const builtin = normalizeBuiltinName(callee);
    if (REAL_BUILTINS.has(builtin) && builtin !== "CONVERTIRANUMERO") {
      args.forEach((arg) => this.apply(arg, "number", scope));
      return;
    }
    switch (builtin) {
      case "AZAR":
      case "ALEATORIO":
        args.forEach((arg) => this.apply(arg, "int", scope));
        return;
      case "REDON":
      case "TRUNC":
      case "CONVERTIRATEXTO":
        args.forEach((arg) => this.apply(arg, "number", scope));
        return;
      case "LONGITUD":
      case "MAYUSCULAS":
      case "MINUSCULAS":
      case "CONVERTIRANUMERO":
      case "CONCATENAR":
        args.forEach((arg) => this.apply(arg, "string", scope));
        return;
      case "SUBCADENA":
        if (args[0]) this.apply(args[0], "string", scope);
        args.slice(1).forEach((arg) => this.apply(arg, "int", scope));
        return;
    }

    const routine = this.findRoutine(callee);
    if (!routine) return;
    const callee_scope = this.result.routines.get(normalizeName(routine.name))!;
    routine.params.forEach((param, index) => {
      const arg = args[index];
      if (!arg) return;
      const paramInfo = this.variable(callee_scope, param.name);
      const argType = this.typeOf(arg, scope);
      this.merge(paramInfo, argType);

      const argArray =
        arg.kind === "identifier"
          ? scope.vars.get(normalizeName(arg.name))?.array ?? null
          : null;
      if (argArray) this.setArray(paramInfo, argArray);
      if (paramInfo.array && arg.kind === "identifier") {
        this.setArray(this.variable(scope, arg.name), paramInfo.array);
      }

      // Arrays and by-reference parameters share storage with the argument.
      if (param.byReference || paramInfo.array) {
        this.apply(arg, paramInfo.type, scope);
      }
    });
  }

  private visitStatements(statements: StatementNode[], scope: ScopeTypes): void {
    for (const statement of statements) {
      this.visitStatement(statement, scope);
    }
  }

  private visitStatement(statement: StatementNode, scope: ScopeTypes): void {
    switch (statement.kind) {
      case "define": {
        const type = mapDeclaredType(statement.dataType);
        for (const name of statement.names) {
          const info = this.variable(scope, name);
          if (!info.declared && type !== "unknown") {
            info.type = type;
            info.declared = true;
            this.changed = true;
          }
        }
        break;
      }
      case "dimension":
        for (const item of statement.items) {
          item.dimensions.forEach((dimension) => {
            this.visitExpression(dimension, scope);
            this.apply(dimension, "int", scope);
          });
          const info = this.variable(scope, item.name);
          const dims = item.dimensions.map((dimension) => {
            const value = evaluateConstant(dimension);
            return value !== null && Number.isInteger(value) && value > 0
              ? value
              : null;
          });
          if (!info.array || info.array.dims.length !== dims.length) {
            info.array = { dims };
            this.changed = true;
          } else {
            this.setArray(info, { dims });
          }
        }
        break;
      case "assignment": {
        this.visitExpression(statement.value, scope);
        if (statement.target.kind === "arrayAccess") {
          this.visitExpression(statement.target, scope);
        }
        this.applyTarget(statement.target, this.typeOf(statement.value, scope), scope);
        const targetType = this.typeOf(statement.target, scope);
        this.apply(
          statement.value,
          targetType === "int" ? "number" : targetType,
          scope
        );
        break;
      }
      case "read":
        for (const target of statement.targets) {
          if (target.kind === "arrayAccess") {
            this.visitExpression(target, scope);
          } else {
            this.variable(scope, target.name);
          }
        }
        break;
      case "write":
        statement.expressions.forEach((expression) =>
          this.visitExpression(expression, scope)
        );
        break;
      case "if":
        this.visitExpression(statement.condition, scope);
        this.apply(statement.condition, "bool", scope);
        this.visitStatements(statement.thenBranch, scope);
        this.visitStatements(statement.elseBranch, scope);
        break;
      case "while":
      case "repeat":
        this.visitExpression(statement.condition, scope);
        this.apply(statement.condition, "bool", scope);
        this.visitStatements(statement.body, scope);
        break;
      case "for": {
        const counter = this.variable(scope, statement.variable);
        const bounds = [statement.start, statement.end];
        if (statement.step) bounds.push(statement.step);
        for (const bound of bounds) {
          this.visitExpression(bound, scope);
          const type = this.typeOf(bound, scope);
          this.merge(counter, type === "double" ? "double" : "int");
        }
        for (const bound of bounds) this.apply(bound, counter.type, scope);
        this.visitStatements(statement.body, scope);
        break;
      }
      case "forEach": {
        this.visitExpression(statement.collection, scope);
        const alias = this.variable(scope, statement.variable);
        if (!alias.forEachAlias && alias.type === "unknown" && !alias.array) {
          alias.forEachAlias = true;
        }
        if (statement.collection.kind === "identifier") {
          const collection = this.variable(scope, statement.collection.name);
          this.merge(alias, collection.type);
          this.visitStatements(statement.body, scope);
          this.merge(collection, alias.type);
        } else {
          this.visitStatements(statement.body, scope);
        }
        break;
      }
      case "switch": {
        this.visitExpression(statement.expression, scope);
        let type = this.typeOf(statement.expression, scope);
        for (const switchCase of statement.cases) {
          for (const value of switchCase.values) {
            this.visitExpression(value, scope);
            type = joinTypes(type, this.typeOf(value, scope));
          }
          this.visitStatements(switchCase.body, scope);
        }
        this.visitStatements(statement.defaultCase, scope);
        // C and C++ can only switch over integers; anything else non-textual
        // is treated as an integer like upstream does.
        this.apply(
          statement.expression,
          type === "string" ? "string" : type === "double" ? "double" : "int",
          scope
        );
        break;
      }
      case "expression":
        if (statement.expression.kind === "identifier") {
          // A bare subprocess call without parentheses.
          if (this.findRoutine(statement.expression.name)) break;
        }
        this.visitExpression(statement.expression, scope);
        break;
      case "wait":
        if (statement.durationMs) {
          this.visitExpression(statement.durationMs, scope);
          this.apply(statement.durationMs, "number", scope);
        }
        break;
      case "return":
        if (statement.expression) {
          this.visitExpression(statement.expression, scope);
          const type = joinTypes(
            scope.returnType,
            this.typeOf(statement.expression, scope)
          );
          if (type !== scope.returnType) {
            scope.returnType = type;
            this.changed = true;
          }
        }
        break;
      case "clear":
        break;
    }
  }
}
