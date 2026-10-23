// Evaluar: the value of an expression at one step of a run, as PSeInt's
// step-by-step debugger offers. The expression goes through the real Parser,
// the same static type rules as a program (checker), and the real
// Interpreter, but against a copy of the variables recorded at that step, so
// the running program never changes.
//
// The program's own functions can be called: they run on those copies, with
// Escribir discarded, Leer refused, and a step budget so an endless loop
// can't freeze the page.

import { checkStandaloneExpression, staticTypeOfDataType } from "./checker";
import { Interpreter } from "./interpreter";
import { engineMessage, type DiagnosticParams, type EngineMessageCode } from "./messages";
import { Parser } from "./parser";
import type {
  Diagnostic,
  EngineSettings,
  ExpressionNode,
  ProgramNode,
  StaticType,
  VariableSnapshot,
  VariableSnapshotValue,
} from "./types";

/** Work allowed per evaluation, mostly for calls to the program's functions. */
export const EVALUATION_MAX_STEPS = 20_000;

export type EvaluationResult =
  | { ok: true; value: VariableSnapshotValue }
  | { ok: false; diagnostic: Diagnostic };

export interface EvaluationOptions {
  /** The parsed program, so its functions can be called and its inferred types used. */
  program?: ProgramNode | null;
  /** The routine the step belongs to (null = the main algorithm). */
  routine?: string | null;
  maxSteps?: number;
}

function failure(code: EngineMessageCode, params?: DiagnosticParams, column = 1): EvaluationResult {
  return {
    ok: false,
    diagnostic: {
      message: engineMessage(code, params),
      line: 1,
      column,
      severity: "error",
      code,
      ...(params && { params }),
    },
  };
}

/** Every name the expression reads as a variable, and every routine it calls. */
function collectNames(
  expression: ExpressionNode,
  routineNames: Set<string>,
  found: { variables: { name: string; column: number }[]; calls: string[] }
): void {
  switch (expression.kind) {
    case "literal":
      return;
    case "group":
      collectNames(expression.expression, routineNames, found);
      return;
    case "identifier":
      if (routineNames.has(expression.name.toLowerCase())) found.calls.push(expression.name);
      else found.variables.push({ name: expression.name, column: expression.span?.start.column ?? 1 });
      return;
    case "arrayAccess":
      collectNames(expression.target, routineNames, found);
      for (const index of expression.indices) collectNames(index, routineNames, found);
      return;
    case "call":
      if (routineNames.has(expression.callee.toLowerCase())) found.calls.push(expression.callee);
      for (const arg of expression.args) collectNames(arg, routineNames, found);
      return;
    case "unary":
      collectNames(expression.operand, routineNames, found);
      return;
    case "binary":
      collectNames(expression.left, routineNames, found);
      collectNames(expression.right, routineNames, found);
      return;
  }
}

function firstLeaf(value: VariableSnapshotValue): VariableSnapshotValue {
  let current = value;
  while (Array.isArray(current)) {
    const next: VariableSnapshotValue | undefined = current.find((item) => item !== null);
    if (next === undefined) return null;
    current = next;
  }
  return current;
}

function typeOfValue(value: VariableSnapshotValue): StaticType | null {
  if (typeof value === "number") return "num";
  if (typeof value === "string") return "str";
  if (typeof value === "boolean") return "bool";
  return null;
}

/**
 * Evaluates `expression` against the variables recorded at one step.
 * Never changes the program: it works on copies, and refuses Leer.
 */
export async function evaluateExpressionAt(
  expression: string,
  variables: VariableSnapshot[],
  settings: Partial<EngineSettings>,
  options: EvaluationOptions = {}
): Promise<EvaluationResult> {
  const text = expression.replace(/\r?\n/g, " ").trim();
  if (!text) return failure("PARSE_EXPRESSION");

  const routines = options.program?.routines ?? [];
  const routineNames = new Set(routines.map((routine) => routine.name.toLowerCase()));
  const parsed = new Parser(text, { settings }).parseStandaloneExpression(routineNames);
  if (!parsed.expression) return { ok: false, diagnostic: parsed.diagnostics[0] };

  const known = new Map(variables.map((variable) => [variable.name.toLowerCase(), variable]));
  const names = { variables: [] as { name: string; column: number }[], calls: [] as string[] };
  collectNames(parsed.expression, routineNames, names);
  const unknown = names.variables.find((variable) => !known.has(variable.name.toLowerCase()));
  if (unknown) return failure("EVAL_UNKNOWN_VARIABLE", { name: unknown.name }, unknown.column);

  const routine = options.routine
    ? routines.find((r) => r.name.toLowerCase() === options.routine!.toLowerCase())
    : options.program?.entry;
  const inferredTypes = routine?.inferredTypes ?? {};

  // Variable types for the checker: declared, else from the value, else inferred.
  const types: Record<string, StaticType> = {};
  const arrays: string[] = [];
  for (const variable of variables) {
    const key = variable.name.toLowerCase();
    if (Array.isArray(variable.value)) arrays.push(key);
    const type =
      (variable.dataType ? staticTypeOfDataType(variable.dataType) : null) ??
      typeOfValue(firstLeaf(variable.value)) ??
      inferredTypes[key] ??
      null;
    if (type) types[key] = type;
  }
  const typeError = checkStandaloneExpression(parsed.expression, types, arrays, routines);
  if (typeError) return { ok: false, diagnostic: typeError };

  const maxSteps = options.maxSteps ?? EVALUATION_MAX_STEPS;
  const interpreter = new Interpreter({ settings, limits: { maxSteps } });
  const result = await interpreter.evaluateDetached(parsed.expression, variables, {
    routines,
    inferredTypes,
    readerName: names.calls[0],
  });
  if (!result.ok && result.diagnostic.code === "RUNTIME_STEP_LIMIT") {
    return failure("EVAL_TOO_LONG", { steps: maxSteps });
  }
  return result;
}
