import type {
  AssignableExpressionNode,
  EngineSettings,
  ExpressionNode,
  ForStatementNode,
  StatementNode,
} from "../types";
import { evaluateConstant, normalizeName, ScopeTypes, TypeInference } from "./type-inference";

/**
 * Helpers shared by the exporters that work on the AST rather than on
 * rendered C code like the C family does.
 */

const INVERTED_RELATIONAL: Record<string, string> = {
  "=": "<>",
  "<>": "=",
  "<": ">=",
  ">=": "<",
  ">": "<=",
  "<=": ">",
};

/** Logical negation, flipping a comparison instead of wrapping it in NO. */
export function invertCondition(condition: ExpressionNode): ExpressionNode {
  if (condition.kind === "group") return invertCondition(condition.expression);
  if (condition.kind === "unary" && condition.operator === "NOT") {
    return condition.operand;
  }
  if (condition.kind === "binary" && INVERTED_RELATIONAL[condition.operator]) {
    return { ...condition, operator: INVERTED_RELATIONAL[condition.operator] };
  }
  return {
    kind: "unary",
    operator: "NOT",
    operand: { kind: "group", expression: condition },
  };
}

function numberLiteral(value: number): ExpressionNode {
  return value < 0
    ? { kind: "unary", operator: "-", operand: { kind: "literal", value: -value, valueType: "number" } }
    : { kind: "literal", value, valueType: "number" };
}

/** `expression + delta`, folding constants (`i+1` - 1 becomes `i`). */
export function offsetExpression(expression: ExpressionNode, delta: number): ExpressionNode {
  if (delta === 0) return expression;
  const constant = evaluateConstant(expression);
  if (constant !== null) return numberLiteral(constant + delta);
  if (
    expression.kind === "binary" &&
    (expression.operator === "+" || expression.operator === "-")
  ) {
    const right = evaluateConstant(expression.right);
    if (right !== null) {
      const value = (expression.operator === "+" ? right : -right) + delta;
      if (value === 0) return expression.left;
      return {
        kind: "binary",
        operator: value > 0 ? "+" : "-",
        left: expression.left,
        right: numberLiteral(Math.abs(value)),
      };
    }
  }
  return {
    kind: "binary",
    operator: delta > 0 ? "+" : "-",
    left: expression,
    right: numberLiteral(Math.abs(delta)),
  };
}

/**
 * Direction of a Para loop: true when it counts down, false when it counts
 * up, null when only known at run time (a non-constant step, or bounds that
 * decide it with deduce_negative_for_step).
 */
export function forDirection(
  statement: ForStatementNode,
  settings: EngineSettings
): boolean | null {
  if (statement.step) {
    const step = evaluateConstant(statement.step);
    return step === null ? null : step < 0;
  }
  if (!settings.deduceNegativeForStep) return false;
  const start = evaluateConstant(statement.start);
  const end = evaluateConstant(statement.end);
  return start !== null && end !== null ? start > end : null;
}

/** Walks every node below `node`, statements and expressions alike. */
export function walk(node: unknown, visit: (node: { kind?: string }) => void): void {
  if (Array.isArray(node)) {
    node.forEach((child) => walk(child, visit));
    return;
  }
  if (!node || typeof node !== "object") return;
  visit(node as { kind?: string });
  for (const [key, child] of Object.entries(node)) {
    if (key !== "span") walk(child, visit);
  }
}

/**
 * Whether the statements write to a variable: assign it, read it with Leer,
 * use it as a Para counter or pass it to a by-reference parameter. Used to
 * decide whether a Para Cada alias needs an index loop to write through.
 */
export function writesVariable(
  statements: StatementNode[],
  key: string,
  inference: TypeInference
): boolean {
  let found = false;
  const isTarget = (expression: ExpressionNode) =>
    expression.kind === "identifier" && normalizeName(expression.name) === key;
  walk(statements, (node) => {
    if (found) return;
    const value = node as StatementNode | ExpressionNode;
    switch (value.kind) {
      case "assignment":
        found = isTarget(value.target);
        break;
      case "read":
        found = value.targets.some(isTarget);
        break;
      case "for":
        found = normalizeName(value.variable) === key;
        break;
      case "call": {
        const routine = inference.findRoutine(value.callee);
        found = Boolean(
          routine?.params.some((param, index) => param.byReference && value.args[index] && isTarget(value.args[index]))
        );
        break;
      }
    }
  });
  return found;
}

/** Whether an expression can be the target of an assignment. */
export function isAssignable(expression: ExpressionNode): boolean {
  return expression.kind === "identifier" || expression.kind === "arrayAccess";
}

/**
 * A double-quoted string literal. Other control characters use octal escapes,
 * which Python and Java read the same way (Java's \u escapes are not safe:
 * they are expanded before the string is parsed).
 */
export function escapeString(value: string): string {
  let escaped = "";
  for (const char of value) {
    switch (char) {
      case "\\":
        escaped += "\\\\";
        break;
      case '"':
        escaped += '\\"';
        break;
      case "\n":
        escaped += "\\n";
        break;
      case "\r":
        escaped += "\\r";
        break;
      case "\t":
        escaped += "\\t";
        break;
      default:
        escaped +=
          char.charCodeAt(0) < 0x20
            ? `\\${char.charCodeAt(0).toString(8).padStart(3, "0")}`
            : char;
    }
  }
  return `"${escaped}"`;
}

/** Turns a pseudocode name into an identifier that avoids reserved words. */
export function makeIdentifier(name: string, reserved: Set<string>): string {
  let identifier = normalizeName(name).replace(/[^a-z0-9_]/g, "_");
  if (!identifier) identifier = "variable";
  if (/^\d/.test(identifier)) identifier = `_${identifier}`;
  if (reserved.has(identifier)) identifier = `${identifier}_`;
  return identifier;
}

/** A rendered expression and the precedence of its outermost operator. */
export interface Rendered {
  code: string;
  prec: number;
}

export function wrap(rendered: Rendered, minPrec: number): string {
  return rendered.prec < minPrec ? `(${rendered.code})` : rendered.code;
}

/** Whether an expression calls anything (so it must be evaluated only once). */
export function containsCall(expression: ExpressionNode): boolean {
  let found = false;
  walk(expression, (node) => {
    if (node.kind === "call") found = true;
  });
  return found;
}

/**
 * Para counters whose value is read outside the loops that count with them
 * (after the loop, before it...). Those loops cannot use a native counting
 * loop that leaves the counter on the last value (or undefined) instead of
 * one step past the limit.
 */
export function countersReadOutside(statements: StatementNode[]): Set<string> {
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

/**
 * Arrays dimensioned exactly once, directly in the body of the routine (not
 * inside a block): they can be declared right where they are dimensioned.
 */
export function declaredAtSite(statements: StatementNode[], scope: ScopeTypes): Set<string> {
  const counts = new Map<string, number>();
  walk(statements, (node) => {
    const statement = node as StatementNode;
    if (statement.kind !== "dimension" || statement.resize) return;
    for (const item of statement.items) {
      const key = normalizeName(item.name);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  });
  const result = new Set<string>();
  for (const statement of statements) {
    if (statement.kind !== "dimension" || statement.resize) continue;
    for (const item of statement.items) {
      const key = normalizeName(item.name);
      const info = scope.vars.get(key);
      if (counts.get(key) === 1 && info?.array && !info.param) result.add(key);
    }
  }
  return result;
}

/**
 * Variables that may be read before anything is assigned to them, found
 * with a definite-assignment pass over the statements. Languages that fail
 * (or warn) on such reads start those variables with their default value.
 */
export function uninitializedReads(statements: StatementNode[], scope: ScopeTypes): Set<string> {
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
