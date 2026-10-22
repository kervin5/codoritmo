import type {
  EngineSettings,
  ExpressionNode,
  ForStatementNode,
  StatementNode,
} from "../types";
import { evaluateConstant, normalizeName, TypeInference } from "./type-inference";

/**
 * Helpers shared by the Python and Java exporters, which work on the AST
 * rather than on rendered C code like the C family does.
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
