import {
  Diagnostic,
  ExpressionNode,
  MainRoutineNode,
  normalizeDataType,
  ProgramNode,
  RoutineNode,
  StatementNode,
  StaticType,
  DataType,
} from "./types";

// Static checks that PSeInt performs before running a program. Variable
// types are inferred per routine from Definir, from assignments and from how
// variables are used (an operand of `*` is a number, a condition is logical,
// and so on). Conflicts are syntax errors, as in PSeInt. The inferred types
// are stored on each routine so the interpreter can validate Leer input and
// give uninitialized variables a default value.

type MaybeType = StaticType | null;

interface BuiltinSignature {
  params: StaticType[];
  returns: StaticType;
}

const num: StaticType = "num";
const str: StaticType = "str";
const bool: StaticType = "bool";

/** Predefined functions by normalized name. */
export const BUILTIN_SIGNATURES: Record<string, BuiltinSignature> = {
  ABS: { params: [num], returns: num },
  ACOS: { params: [num], returns: num },
  ALEATORIO: { params: [num, num], returns: num },
  ASEN: { params: [num], returns: num },
  ATAN: { params: [num], returns: num },
  AZAR: { params: [num], returns: num },
  CONCATENAR: { params: [str, str], returns: str },
  CONVERTIRANUMERO: { params: [str], returns: num },
  CONVERTIRATEXTO: { params: [num], returns: str },
  COS: { params: [num], returns: num },
  EULER: { params: [], returns: num },
  EXP: { params: [num], returns: num },
  FECHAACTUAL: { params: [], returns: num },
  HORAACTUAL: { params: [], returns: num },
  LN: { params: [num], returns: num },
  LONGITUD: { params: [str], returns: num },
  MAYUSCULAS: { params: [str], returns: str },
  MINUSCULAS: { params: [str], returns: str },
  PI: { params: [], returns: num },
  RAIZ: { params: [num], returns: num },
  RC: { params: [num], returns: num },
  REDON: { params: [num], returns: num },
  SEN: { params: [num], returns: num },
  SUBCADENA: { params: [str, num, num], returns: str },
  TAN: { params: [num], returns: num },
  TRUNC: { params: [num], returns: num },
};

export function normalizeIdentifier(name: string): string {
  return name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase();
}

export function staticTypeOfDataType(dataType: string): MaybeType {
  switch (normalizeDataType(dataType)) {
    case DataType.ENTERO:
    case DataType.REAL:
    case DataType.NUMERICO:
      return num;
    case DataType.LOGICO:
      return bool;
    case DataType.CARACTER:
    case DataType.CADENA:
    case DataType.TEXTO:
      return str;
    default:
      return null;
  }
}

class CheckError extends Error {
  constructor(public readonly diagnostic: Diagnostic) {
    super(diagnostic.message);
  }
}

type Routine = MainRoutineNode | RoutineNode;

interface Spanned {
  span?: { start: { line: number; column: number } };
}

const typeNames: Record<StaticType, string> = {
  num: "numérico",
  str: "caracter",
  bool: "lógico",
};

class RoutineChecker {
  readonly env = new Map<string, StaticType>();
  /** Names dimensioned as arrays in this routine. */
  private readonly arrays = new Set<string>();
  private line = 1;

  constructor(
    private readonly routine: Routine,
    private readonly routines: Map<string, RoutineNode>,
    private readonly returnTypes: Map<string, MaybeType>,
    private readonly report: boolean
  ) {}

  run(): Diagnostic | null {
    this.line = this.routine.span?.start.line ?? 1;
    try {
      this.block(this.routine.body);
      return null;
    } catch (error) {
      if (error instanceof CheckError) {
        return error.diagnostic;
      }
      throw error;
    }
  }

  private fail(node: Spanned | null, message: string, code: string): void {
    if (!this.report) {
      return;
    }
    throw new CheckError({
      message,
      line: node?.span?.start.line ?? this.line,
      column: node?.span?.start.column ?? 1,
      severity: "error",
      code,
    });
  }

  private block(statements: StatementNode[]): void {
    for (const statement of statements) {
      this.line = statement.span?.start.line ?? this.line;
      this.statement(statement);
    }
  }

  private isOwnReturnTarget(name: string): boolean {
    return (
      this.routine.type === "Routine" &&
      this.routine.returnTarget !== undefined &&
      this.routine.returnTarget.toLowerCase() === name.toLowerCase()
    );
  }

  private isRoutineName(name: string): boolean {
    return this.routines.has(name.toLowerCase());
  }

  private checkNotRoutineName(name: string, node: Spanned): void {
    if (this.isRoutineName(name) && !this.isOwnReturnTarget(name)) {
      this.fail(
        node,
        `"${name}" is the name of a routine and cannot be used as a variable.`,
        "PARSE_NAME_IS_ROUTINE"
      );
    }
  }

  private statement(statement: StatementNode): void {
    switch (statement.kind) {
      case "define": {
        const type = staticTypeOfDataType(statement.dataType);
        for (const name of statement.names) {
          if (type) {
            this.env.set(name.toLowerCase(), type);
          }
        }
        return;
      }
      case "dimension":
        for (const item of statement.items) {
          this.checkNotRoutineName(item.name, item);
          this.arrays.add(item.name.toLowerCase());
          for (const dimension of item.dimensions) {
            this.expect(dimension, num, "Array dimensions must be numeric.");
          }
        }
        return;
      case "assignment": {
        const name = this.targetName(statement.target);
        this.checkNotRoutineName(name, statement);
        if (statement.target.kind === "arrayAccess") {
          for (const index of statement.target.indices) {
            this.expect(index, num, "Array indices must be numeric.");
          }
        }
        const valueType = this.typeOf(statement.value);
        const targetType = this.env.get(name.toLowerCase()) ?? null;
        if (targetType && valueType && targetType !== valueType) {
          this.fail(
            statement,
            `No coinciden los tipos: no se puede asignar un valor ${typeNames[valueType]} a "${name}" (${typeNames[targetType]}).`,
            "PARSE_TYPE_MISMATCH"
          );
        } else if (!targetType && valueType) {
          this.env.set(name.toLowerCase(), valueType);
        } else if (targetType && !valueType) {
          this.unify(statement.value, targetType);
        }
        return;
      }
      case "write":
        for (const expression of statement.expressions) {
          this.typeOf(expression);
        }
        return;
      case "read":
        for (const target of statement.targets) {
          this.checkNotRoutineName(this.targetName(target), statement);
          if (target.kind === "arrayAccess") {
            for (const index of target.indices) {
              this.expect(index, num, "Array indices must be numeric.");
            }
          }
        }
        return;
      case "if":
        this.condition(statement.condition, "Si");
        this.block(statement.thenBranch);
        this.block(statement.elseBranch);
        return;
      case "while":
        this.condition(statement.condition, "Mientras");
        this.block(statement.body);
        return;
      case "repeat":
        this.block(statement.body);
        this.line = statement.condition.span?.start.line ?? this.line;
        this.condition(statement.condition, "Repetir");
        return;
      case "for": {
        const counterType = this.env.get(statement.variable.toLowerCase());
        if (counterType && counterType !== num) {
          this.fail(statement, "The Para counter must be numeric.", "PARSE_TYPE_MISMATCH");
        }
        this.env.set(statement.variable.toLowerCase(), num);
        this.expect(statement.start, num, "The Para start value must be numeric.");
        this.expect(statement.end, num, "The Para end value must be numeric.");
        if (statement.step) {
          this.expect(statement.step, num, "The Para step must be numeric.");
        }
        this.block(statement.body);
        return;
      }
      case "forEach": {
        const collectionType = this.typeOf(statement.collection);
        const variable = statement.variable.toLowerCase();
        if (collectionType && !this.env.has(variable)) {
          this.env.set(variable, collectionType);
        }
        this.block(statement.body);
        const variableType = this.env.get(variable);
        if (variableType && !collectionType) {
          this.unify(statement.collection, variableType);
        }
        return;
      }
      case "switch":
        this.typeOf(statement.expression);
        for (const switchCase of statement.cases) {
          for (const value of switchCase.values) {
            this.typeOf(value);
          }
          this.block(switchCase.body);
        }
        this.block(statement.defaultCase);
        return;
      case "expression":
        this.typeOf(statement.expression, true);
        return;
      case "return":
        if (statement.expression) {
          this.typeOf(statement.expression);
        }
        return;
      case "clear":
      case "wait":
        if (statement.kind === "wait" && statement.durationMs) {
          this.expect(statement.durationMs, num, "Esperar needs a numeric duration.");
        }
        return;
    }
  }

  private targetName(target: ExpressionNode): string {
    if (target.kind === "identifier") {
      return target.name;
    }
    if (target.kind === "arrayAccess") {
      return this.targetName(target.target);
    }
    return "";
  }

  private condition(expression: ExpressionNode, construct: string): void {
    const type = this.typeOf(expression);
    if (type && type !== bool) {
      this.fail(
        { span: { start: { line: this.line, column: 1 } } },
        `The condition of ${construct} must be a logical expression.`,
        "PARSE_CONDITION_NOT_LOGICAL"
      );
    }
    if (!type) {
      this.unify(expression, bool);
    }
  }

  private expect(expression: ExpressionNode, type: StaticType, message: string): void {
    const actual = this.typeOf(expression);
    if (actual && actual !== type) {
      this.fail(expression, message, "PARSE_TYPE_MISMATCH");
    }
    if (!actual) {
      this.unify(expression, type);
    }
  }

  // Gives an untyped variable the type its usage requires.
  private unify(expression: ExpressionNode, type: StaticType): void {
    if (expression.kind === "group") {
      this.unify(expression.expression, type);
      return;
    }
    const name =
      expression.kind === "identifier"
        ? expression.name
        : expression.kind === "arrayAccess"
          ? this.targetName(expression)
          : null;
    if (!name || (expression.kind === "identifier" && this.isRoutineName(name) && !this.env.has(name.toLowerCase()))) {
      return;
    }
    if (!this.env.has(name.toLowerCase())) {
      this.env.set(name.toLowerCase(), type);
    }
  }

  private typeOf(expression: ExpressionNode, asStatement = false): MaybeType {
    switch (expression.kind) {
      case "literal":
        return expression.valueType === "number" ? num : expression.valueType === "string" ? str : bool;
      case "group":
        return this.typeOf(expression.expression);
      case "identifier": {
        const key = expression.name.toLowerCase();
        const routine = this.routines.get(key);
        if (routine && !this.env.has(key) && !this.isOwnReturnTarget(expression.name)) {
          if (routine.params.length > 0) {
            this.fail(
              expression,
              `The routine "${expression.name}" needs arguments.`,
              "PARSE_MISSING_ARGUMENTS"
            );
          }
          return this.callResult(routine, asStatement, expression);
        }
        return this.env.get(key) ?? null;
      }
      case "arrayAccess":
        for (const index of expression.indices) {
          this.expect(index, num, "Array indices must be numeric.");
        }
        return this.env.get(this.targetName(expression).toLowerCase()) ?? null;
      case "call": {
        const routine = this.routines.get(expression.callee.toLowerCase());
        if (routine) {
          if (expression.args.length !== routine.params.length) {
            this.fail(
              expression,
              `The routine "${routine.name}" expects ${routine.params.length} argument(s).`,
              "PARSE_ARGUMENT_COUNT"
            );
          }
          routine.params.forEach((param, index) => {
            const arg = expression.args[index];
            if (!arg) {
              return;
            }
            if (param.byReference && arg.kind !== "identifier" && arg.kind !== "arrayAccess") {
              this.fail(
                expression,
                `The argument for "${param.name}" is passed by reference and must be a variable.`,
                "PARSE_BY_REFERENCE_ARGUMENT"
              );
            }
            this.typeOf(arg);
          });
          return this.callResult(routine, asStatement, expression);
        }
        const signature = BUILTIN_SIGNATURES[normalizeIdentifier(expression.callee)];
        if (!signature) {
          return null;
        }
        if (expression.args.length !== signature.params.length) {
          this.fail(
            expression,
            `The function "${expression.callee}" expects ${signature.params.length} argument(s).`,
            "PARSE_ARGUMENT_COUNT"
          );
        }
        expression.args.forEach((arg, index) => {
          if (arg.kind === "identifier" && this.arrays.has(arg.name.toLowerCase())) {
            this.fail(
              arg,
              `The function "${expression.callee}" cannot receive a whole array.`,
              "PARSE_ARRAY_ARGUMENT"
            );
          }
          const paramType = signature.params[index];
          if (paramType) {
            this.expect(arg, paramType, `Wrong argument type for "${expression.callee}".`);
          } else {
            this.typeOf(arg);
          }
        });
        return signature.returns;
      }
      case "unary": {
        if (expression.operator === "NOT") {
          const type = this.typeOf(expression.operand);
          if (type && type !== bool) {
            this.fail(expression, "NO can only be applied to logical values.", "PARSE_NOT_OPERAND");
          }
          if (!type) {
            this.unify(expression.operand, bool);
          }
          return bool;
        }
        this.expect(expression.operand, num, "The sign can only be applied to numbers.");
        return num;
      }
      case "binary":
        return this.binaryType(expression);
    }
  }

  private callResult(routine: RoutineNode, asStatement: boolean, node: Spanned): MaybeType {
    const returnType = this.returnTypes.get(routine.name.toLowerCase()) ?? null;
    if (!asStatement && !routine.returnTarget) {
      this.fail(node, `The routine "${routine.name}" does not return a value.`, "PARSE_NO_RETURN_VALUE");
    }
    return returnType;
  }

  private binaryType(expression: ExpressionNode & { kind: "binary" }): MaybeType {
    const { operator, left, right } = expression;
    if (operator === "AND" || operator === "OR") {
      for (const side of [left, right]) {
        const type = this.typeOf(side);
        if (type && type !== bool) {
          this.fail(expression, "Y/O can only be applied to logical values.", "PARSE_LOGICAL_OPERAND");
        }
        if (!type) {
          this.unify(side, bool);
        }
      }
      return bool;
    }

    if (["-", "*", "/", "%", "^"].includes(operator)) {
      this.expect(left, num, `The operator ${operator} only applies to numbers.`);
      this.expect(right, num, `The operator ${operator} only applies to numbers.`);
      return num;
    }

    const leftType = this.typeOf(left);
    const rightType = this.typeOf(right);

    if (operator === "+") {
      if (leftType === bool || rightType === bool) {
        this.fail(expression, "The operator + does not apply to logical values.", "PARSE_TYPE_MISMATCH");
      }
      if (leftType && rightType && leftType !== rightType) {
        this.fail(expression, "The operands of + must have the same type.", "PARSE_TYPE_MISMATCH");
      }
      if (leftType && !rightType) {
        this.unify(right, leftType);
      } else if (rightType && !leftType) {
        this.unify(left, rightType);
      }
      return leftType ?? rightType;
    }

    // Comparisons: both sides share a type.
    if (leftType && !rightType) {
      this.unify(right, leftType);
    } else if (rightType && !leftType) {
      this.unify(left, rightType);
    }
    return bool;
  }
}

export function checkProgram(program: ProgramNode): Diagnostic | null {
  const routines = new Map(program.routines.map((routine) => [routine.name.toLowerCase(), routine]));
  const returnTypes = new Map<string, MaybeType>();

  // Infer return types first (twice, so routines calling each other settle).
  for (let round = 0; round < 2; round += 1) {
    for (const routine of program.routines) {
      const checker = new RoutineChecker(routine, routines, returnTypes, false);
      checker.run();
      const target = routine.returnTarget?.toLowerCase();
      returnTypes.set(routine.name.toLowerCase(), target ? checker.env.get(target) ?? null : null);
    }
  }

  let first: Diagnostic | null = null;
  for (const routine of [program.entry, ...program.routines]) {
    const checker = new RoutineChecker(routine, routines, returnTypes, true);
    const diagnostic = checker.run();
    routine.inferredTypes = Object.fromEntries(checker.env);
    if (diagnostic && (!first || diagnostic.line < first.line)) {
      first = diagnostic;
    }
  }
  return first;
}
