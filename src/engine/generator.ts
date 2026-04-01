import {
  AssignableExpressionNode,
  EngineSettings,
  ExpressionNode,
  GenerationResult,
  JavaScriptExportTarget,
  ProgramNode,
  RoutineNode,
  StatementNode,
} from "./types";
import { normalizeEngineSettings } from "./settings";

function collectLocalNames(
  statements: StatementNode[],
  names: Set<string>
): void {
  for (const statement of statements) {
    switch (statement.kind) {
      case "define":
        statement.names.forEach((name) => names.add(name));
        break;
      case "dimension":
        statement.items.forEach((item) => names.add(item.name));
        break;
      case "assignment":
        if (statement.target.kind === "identifier") {
          names.add(statement.target.name);
        }
        break;
      case "if":
        collectLocalNames(statement.thenBranch, names);
        collectLocalNames(statement.elseBranch, names);
        break;
      case "while":
      case "repeat":
      case "for":
      case "forEach":
        collectLocalNames(statement.body, names);
        if (statement.kind === "for") {
          names.add(statement.variable);
        }
        if (statement.kind === "forEach") {
          names.add(statement.variable);
        }
        break;
      case "switch":
        statement.cases.forEach((item) => collectLocalNames(item.body, names));
        collectLocalNames(statement.defaultCase, names);
        break;
      default:
        break;
    }
  }
}

function escapeString(value: string): string {
  return JSON.stringify(value);
}

function indent(level: number): string {
  return "  ".repeat(level);
}

function executableRoutineName(name: string): string {
  return `__routine_${name.replace(/[^\w$]/g, "_")}`;
}

function readableRoutineName(name: string): string {
  const normalized = name.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const sanitized = normalized.replace(/[^\p{L}\p{N}_$]/gu, "_");
  if (!sanitized) {
    return "algoritmo";
  }

  return sanitized.charAt(0).toLowerCase() + sanitized.slice(1);
}

function programUsesArrays(program: ProgramNode): boolean {
  if (program.entry.body.some((statement) => statement.kind === "dimension")) {
    return true;
  }

  return program.routines.some((routine) =>
    routine.body.some((statement) => statement.kind === "dimension")
  );
}

interface JavaScriptGenerateOptions {
  target?: JavaScriptExportTarget;
}

export class JavaScriptGenerator {
  private readonly routines = new Map<string, RoutineNode>();
  private readonly settings: EngineSettings;
  private tempCounter = 0;

  constructor(options: { settings?: Partial<EngineSettings> } = {}) {
    this.settings = normalizeEngineSettings(options.settings);
  }

  generate(
    program: ProgramNode,
    options: JavaScriptGenerateOptions = {}
  ): GenerationResult {
    const target = options.target ?? "browser";
    this.initialize(program);

    return this.generateStandalone(program, target);
  }

  generateExecutable(program: ProgramNode): GenerationResult {
    this.initialize(program);

    const lines: string[] = [
      `const __runtime_settings = ${JSON.stringify(this.settings)};`,
      "const __runtime_cell = (value = null) => ({ value });",
      "const __runtime_clone = (value) => {",
      '  if (value === null || typeof value !== "object") return value;',
      '  if (value.kind === "array") {',
      "    return {",
      '      kind: "array",',
      "      dimensions: [...value.dimensions],",
      '      items: value.items.map((item) => item.kind === "array" ? __runtime_clone(item) : __runtime_cell(__runtime_clone(item.value))),',
      "    };",
      "  }",
      "  return value;",
      "};",
      "const __runtime_array = (dimensions, depth = 0) => ({",
      '  kind: "array",',
      "  dimensions: dimensions.slice(depth),",
      "  items: Array.from({ length: dimensions[depth] }, () => depth + 1 < dimensions.length ? __runtime_array(dimensions, depth + 1) : __runtime_cell(null)),",
      "});",
      'const __runtime_number = (value) => typeof value === "number" ? value : typeof value === "boolean" ? (value ? 1 : 0) : Number(value ?? 0);',
      'const __runtime_truthy = (value) => typeof value === "boolean" ? value : typeof value === "number" ? value !== 0 : typeof value === "string" ? value.length > 0 : value !== null;',
      'const __runtime_format = (value) => typeof value === "boolean" ? (value ? "VERDADERO" : "FALSO") : value == null ? "" : String(value);',
      "const __runtime_arrayCell = (arrayValue, indices) => {",
      "  let current = arrayValue;",
      "  for (let indexPosition = 0; indexPosition < indices.length; indexPosition += 1) {",
      "    const requestedIndex = __runtime_number(indices[indexPosition]);",
      "    const zeroBased = requestedIndex - (__runtime_settings.baseZeroArrays ? 0 : 1);",
      "    if (!Number.isInteger(requestedIndex) || zeroBased < 0 || zeroBased >= current.dimensions[0]) {",
      '      throw new Error("Array index out of bounds.");',
      "    }",
      "    const next = current.items[zeroBased];",
      "    if (indexPosition === indices.length - 1) {",
      '      if (next.kind === "array") throw new Error("Expected an array element.");',
      "      return next;",
      "    }",
      '    if (next.kind !== "array") throw new Error("Missing nested array dimension.");',
      "    current = next;",
      "  }",
      '  throw new Error("Expected an array element.");',
      "};",
      "const __runtime_builtin = (name, values, random = Math.random) => {",
      '  if (!__runtime_settings.enableStringFunctions && ["CONCATENAR", "LONGITUD", "MAYUSCULAS", "MINUSCULAS", "SUBCADENA"].includes(name)) {',
      '    throw new Error(`String function "${name}" is disabled in the current profile.`);',
      "  }",
      "  switch (name) {",
      '    case "ABS": return Math.abs(__runtime_number(values[0]));',
      '    case "ACOS": return Math.acos(__runtime_number(values[0]));',
      '    case "ASEN":',
      '    case "ASIN": return Math.asin(__runtime_number(values[0]));',
      '    case "ATAN": return Math.atan(__runtime_number(values[0]));',
      '    case "AZAR": return Math.floor(random() * __runtime_number(values[0]));',
      '    case "CONCATENAR": return values.map(__runtime_format).join("");',
      '    case "CONVERTIRANUMERO": return Number(values[0] ?? 0);',
      '    case "CONVERTIRATEXTO": return __runtime_format(values[0]);',
      '    case "COS": return Math.cos(__runtime_number(values[0]));',
      '    case "EXP": return Math.exp(__runtime_number(values[0]));',
      '    case "LN": return Math.log(__runtime_number(values[0]));',
      '    case "LONGITUD": return __runtime_format(values[0]).length;',
      '    case "MAYUSCULAS": return __runtime_format(values[0]).toUpperCase();',
      '    case "MINUSCULAS": return __runtime_format(values[0]).toLowerCase();',
      '    case "RAIZ":',
      '    case "RC": return Math.sqrt(__runtime_number(values[0]));',
      '    case "REDON": return Math.round(__runtime_number(values[0]));',
      '    case "SEN":',
      '    case "SIN": return Math.sin(__runtime_number(values[0]));',
      '    case "SUBCADENA": {',
      "      const source = __runtime_format(values[0]);",
      "      const start = Math.max(__runtime_settings.baseZeroArrays ? 0 : 1, __runtime_number(values[1]));",
      "      const end = Math.max(start, __runtime_number(values[2]));",
      "      return __runtime_settings.baseZeroArrays ? source.slice(start, end + 1) : source.slice(start - 1, end);",
      "    }",
      '    case "TAN": return Math.tan(__runtime_number(values[0]));',
      '    case "TRUNC": return Math.trunc(__runtime_number(values[0]));',
      "    default: throw new Error(`Unknown built-in function: ${name}`);",
      "  }",
      "};",
      "async function __runtime_entry(__runtime, __random = Math.random) {",
    ];

    for (const routine of program.routines) {
      lines.push(...this.generateExecutableRoutine(routine, 1));
    }

    lines.push(...this.generateExecutableMain(program.entry.body, 1));
    lines.push("}");

    return {
      code: lines.join("\n"),
      diagnostics: [],
    };
  }

  generateStandalone(
    program: ProgramNode,
    target: JavaScriptExportTarget
  ): GenerationResult {
    this.initialize(program);

    const entryName = readableRoutineName(program.entry.name);
    const lines: string[] = [
      target === "browser"
        ? "// Standalone browser export generated by Codoritmo."
        : "// Standalone Node.js export generated by Codoritmo.",
    ];

    lines.push("", ...this.generateStandaloneRuntimePrelude(target));

    if (programUsesArrays(program)) {
      lines.push(
        "",
        "function createRuntimeArray(dimensions) {",
        "  const [size, ...rest] = dimensions;",
        "  return Array.from({ length: size }, () => rest.length > 0 ? createRuntimeArray(rest) : undefined);",
        "}"
      );
    }

    for (const routine of program.routines) {
      lines.push("", ...this.generateStandaloneRoutine(routine));
    }

    lines.push(
      "",
      ...this.generateStandaloneMain(program),
      "",
      ...this.generateStandaloneEntrypoint(entryName, target)
    );

    return {
      code: lines.join("\n"),
      diagnostics: [],
    };
  }

  private initialize(program: ProgramNode): void {
    this.routines.clear();
    this.tempCounter = 0;

    for (const routine of program.routines) {
      this.routines.set(routine.name.toLowerCase(), routine);
    }
  }

  private generateExecutableRoutine(
    routine: RoutineNode,
    level: number
  ): string[] {
    const lines: string[] = [];
    const locals = new Set<string>();
    collectLocalNames(routine.body, locals);
    routine.params.forEach((parameter) => locals.delete(parameter.name));
    if (routine.returnTarget) {
      locals.add(routine.returnTarget);
    } else if (routine.headerKind === "Funcion") {
      locals.add(routine.name);
    }

    const params = routine.params.map((parameter) => parameter.name).join(", ");
    lines.push(
      `${indent(level)}async function ${executableRoutineName(
        routine.name
      )}(${params}) {`
    );

    for (const local of locals) {
      lines.push(`${indent(level + 1)}const ${local} = __runtime_cell(null);`);
    }

    lines.push(
      ...this.generateExecutableStatements(
        routine.body,
        level + 1,
        new Set([...locals, ...routine.params.map((item) => item.name)])
      )
    );

    const returnCell =
      routine.returnTarget ??
      (routine.headerKind === "Funcion" ? routine.name : null);
    lines.push(
      `${indent(level + 1)}return ${
        returnCell ? `${returnCell}.value` : "null"
      };`
    );
    lines.push(`${indent(level)}}`);
    return lines;
  }

  private generateExecutableMain(
    statements: StatementNode[],
    level: number
  ): string[] {
    const locals = new Set<string>();
    collectLocalNames(statements, locals);
    const lines: string[] = [];

    for (const local of locals) {
      lines.push(`${indent(level)}const ${local} = __runtime_cell(null);`);
    }

    lines.push(...this.generateExecutableStatements(statements, level, locals));
    return lines;
  }

  private generateExecutableStatements(
    statements: StatementNode[],
    level: number,
    locals: Set<string>
  ): string[] {
    const lines: string[] = [];

    for (const statement of statements) {
      switch (statement.kind) {
        case "define":
          for (const name of statement.names) {
            if (!locals.has(name)) {
              lines.push(
                `${indent(level)}const ${name} = __runtime_cell(null);`
              );
              locals.add(name);
            }
          }
          break;
        case "dimension":
          for (const item of statement.items) {
            if (!locals.has(item.name)) {
              lines.push(
                `${indent(level)}const ${item.name} = __runtime_cell(null);`
              );
              locals.add(item.name);
            }
            lines.push(
              `${indent(level)}${
                item.name
              }.value = __runtime_array([${item.dimensions
                .map((dimension) =>
                  this.generateExecutableExpression(dimension, locals)
                )
                .join(", ")}]);`
            );
          }
          break;
        case "assignment":
          lines.push(
            `${indent(level)}${this.generateExecutableReference(
              statement.target,
              locals
            )}.value = ${this.generateExecutableExpression(
              statement.value,
              locals
            )};`
          );
          break;
        case "write": {
          for (const expression of statement.expressions) {
            lines.push(
              `${indent(
                level
              )}await __runtime.write(__runtime_format(${this.generateExecutableExpression(
                expression,
                locals
              )}), false);`
            );
          }
          if (statement.newline) {
            lines.push(`${indent(level)}await __runtime.write("", true);`);
          }
          break;
        }
        case "read":
          for (const target of statement.targets) {
            lines.push(
              `${indent(level)}${this.generateExecutableReference(
                target,
                locals
              )}.value = await __runtime.read();`
            );
          }
          break;
        case "if":
          lines.push(
            `${indent(
              level
            )}if (__runtime_truthy(${this.generateExecutableExpression(
              statement.condition,
              locals
            )})) {`
          );
          lines.push(
            ...this.generateExecutableStatements(
              statement.thenBranch,
              level + 1,
              locals
            )
          );
          if (statement.elseBranch.length > 0) {
            lines.push(`${indent(level)}} else {`);
            lines.push(
              ...this.generateExecutableStatements(
                statement.elseBranch,
                level + 1,
                locals
              )
            );
          }
          lines.push(`${indent(level)}}`);
          break;
        case "while":
          lines.push(
            `${indent(
              level
            )}while (__runtime_truthy(${this.generateExecutableExpression(
              statement.condition,
              locals
            )})) {`
          );
          lines.push(
            ...this.generateExecutableStatements(
              statement.body,
              level + 1,
              locals
            )
          );
          lines.push(`${indent(level)}}`);
          break;
        case "repeat":
          lines.push(`${indent(level)}do {`);
          lines.push(
            ...this.generateExecutableStatements(
              statement.body,
              level + 1,
              locals
            )
          );
          lines.push(
            `${indent(level)}} while (${
              statement.mode === "while" ? "" : "!"
            }__runtime_truthy(${this.generateExecutableExpression(
              statement.condition,
              locals
            )}));`
          );
          break;
        case "for": {
          const endName = this.nextTemp("end");
          const stepName = this.nextTemp("step");
          const comparator = `(__runtime_number(${stepName}) > 0 ? ${statement.variable}.value <= __runtime_number(${endName}) : ${statement.variable}.value >= __runtime_number(${endName}))`;
          lines.push(
            `${indent(level)}${
              statement.variable
            }.value = __runtime_number(${this.generateExecutableExpression(
              statement.start,
              locals
            )});`
          );
          lines.push(
            `${indent(
              level
            )}const ${endName} = ${this.generateExecutableExpression(
              statement.end,
              locals
            )};`
          );
          lines.push(
            `${indent(level)}const ${stepName} = ${
              statement.step
                ? this.generateExecutableExpression(statement.step, locals)
                : this.settings.deduceNegativeForStep
                ? `(__runtime_number(${statement.variable}.value) > __runtime_number(${endName}) ? -1 : 1)`
                : "1"
            };`
          );
          lines.push(
            `${indent(level)}for (; ${comparator}; ${
              statement.variable
            }.value = __runtime_number(${
              statement.variable
            }.value) + __runtime_number(${stepName})) {`
          );
          lines.push(
            ...this.generateExecutableStatements(
              statement.body,
              level + 1,
              locals
            )
          );
          lines.push(`${indent(level)}}`);
          break;
        }
        case "forEach":
          lines.push(
            `${indent(
              level
            )}for (const __item of ${this.generateExecutableExpression(
              statement.collection,
              locals
            )}.items) {`
          );
          lines.push(
            `${indent(level + 1)}${
              statement.variable
            }.value = __item.kind === "array" ? __item : __item.value;`
          );
          lines.push(
            ...this.generateExecutableStatements(
              statement.body,
              level + 1,
              locals
            )
          );
          lines.push(`${indent(level)}}`);
          break;
        case "switch": {
          const switchName = this.nextTemp("switchValue");
          lines.push(
            `${indent(
              level
            )}const ${switchName} = ${this.generateExecutableExpression(
              statement.expression,
              locals
            )};`
          );
          lines.push(`${indent(level)}switch (${switchName}) {`);
          for (const switchCase of statement.cases) {
            for (const value of switchCase.values) {
              lines.push(
                `${indent(level + 1)}case ${this.generateExecutableExpression(
                  value,
                  locals
                )}:`
              );
            }
            lines.push(
              ...this.generateExecutableStatements(
                switchCase.body,
                level + 2,
                locals
              )
            );
            lines.push(`${indent(level + 2)}break;`);
          }
          if (statement.defaultCase.length > 0) {
            lines.push(`${indent(level + 1)}default:`);
            lines.push(
              ...this.generateExecutableStatements(
                statement.defaultCase,
                level + 2,
                locals
              )
            );
          }
          lines.push(`${indent(level)}}`);
          break;
        }
        case "expression":
          lines.push(
            `${indent(level)}${this.generateExecutableExpression(
              statement.expression,
              locals
            )};`
          );
          break;
        case "clear":
          lines.push(`${indent(level)}await __runtime.clear();`);
          break;
        case "wait":
          if (statement.mode === "key") {
            lines.push(`${indent(level)}await __runtime.waitForKey();`);
          } else {
            lines.push(
              `${indent(
                level
              )}await __runtime.sleep(__runtime_number(${this.generateExecutableExpression(
                statement.durationMs!,
                locals
              )}));`
            );
          }
          break;
        case "return":
          lines.push(
            `${indent(level)}return ${
              statement.expression
                ? this.generateExecutableExpression(
                    statement.expression,
                    locals
                  )
                : "null"
            };`
          );
          break;
      }
    }

    return lines;
  }

  private generateExecutableReference(
    expression: AssignableExpressionNode,
    locals: Set<string>
  ): string {
    if (expression.kind === "identifier") {
      return expression.name;
    }

    return `__runtime_arrayCell(${this.generateExecutableExpression(
      expression.target,
      locals
    )}, [${expression.indices
      .map((item) => this.generateExecutableExpression(item, locals))
      .join(", ")}])`;
  }

  private generateExecutableExpression(
    expression: ExpressionNode,
    locals: Set<string>
  ): string {
    switch (expression.kind) {
      case "literal":
        return typeof expression.value === "string"
          ? escapeString(expression.value)
          : String(expression.value);
      case "group":
        return `(${this.generateExecutableExpression(
          expression.expression,
          locals
        )})`;
      case "identifier": {
        const routine = this.routines.get(expression.name.toLowerCase());
        if (
          !locals.has(expression.name) &&
          routine &&
          routine.params.length === 0
        ) {
          return `await ${executableRoutineName(routine.name)}()`;
        }
        return `${expression.name}.value`;
      }
      case "arrayAccess":
        return `${this.generateExecutableReference(expression, locals)}.value`;
      case "call": {
        const routine = this.routines.get(expression.callee.toLowerCase());
        if (!routine) {
          return `__runtime_builtin(${escapeString(
            expression.callee
              .normalize("NFD")
              .replace(/\p{Diacritic}/gu, "")
              .toUpperCase()
          )}, [${expression.args
            .map((item) => this.generateExecutableExpression(item, locals))
            .join(", ")}], __random)`;
        }

        return `await ${executableRoutineName(routine.name)}(${routine.params
          .map((parameter, index) => {
            const argument = expression.args[index];
            if (!argument) {
              return "__runtime_cell(null)";
            }
            if (parameter.byReference) {
              return this.generateExecutableReference(
                argument as AssignableExpressionNode,
                locals
              );
            }
            return `__runtime_cell(__runtime_clone(${this.generateExecutableExpression(
              argument,
              locals
            )}))`;
          })
          .join(", ")})`;
      }
      case "unary":
        return expression.operator === "-"
          ? `(-__runtime_number(${this.generateExecutableExpression(
              expression.operand,
              locals
            )}))`
          : `(!__runtime_truthy(${this.generateExecutableExpression(
              expression.operand,
              locals
            )}))`;
      case "binary":
        return this.generateExecutableBinary(expression, locals);
    }
  }

  private generateExecutableBinary(
    expression: ExpressionNode & { kind: "binary" },
    locals: Set<string>
  ): string {
    const left = this.generateExecutableExpression(expression.left, locals);
    const right = this.generateExecutableExpression(expression.right, locals);

    switch (expression.operator) {
      case "+":
        return `((typeof ${left} === "string" || typeof ${right} === "string") ? (__runtime_settings.allowConcatenation ? __runtime_format(${left}) + __runtime_format(${right}) : (() => { throw new Error("String concatenation with + is disabled in the current profile."); })()) : __runtime_number(${left}) + __runtime_number(${right}))`;
      case "-":
        return `(__runtime_number(${left}) - __runtime_number(${right}))`;
      case "*":
        return `(__runtime_number(${left}) * __runtime_number(${right}))`;
      case "/":
        return `(__runtime_number(${left}) / __runtime_number(${right}))`;
      case "%":
        return `(__runtime_number(${left}) % __runtime_number(${right}))`;
      case "^":
        return `Math.pow(__runtime_number(${left}), __runtime_number(${right}))`;
      case "=":
        return `(${left} === ${right})`;
      case "<>":
        return `(${left} !== ${right})`;
      case "<":
      case ">":
      case "<=":
      case ">=":
        return `(${left} ${expression.operator} ${right})`;
      case "AND":
        return `(__runtime_truthy(${left}) && __runtime_truthy(${right}))`;
      case "OR":
        return `(__runtime_truthy(${left}) || __runtime_truthy(${right}))`;
      default:
        return "null";
    }
  }

  private generateStandaloneMain(program: ProgramNode): string[] {
    return this.generateStandaloneRoutineLike(
      readableRoutineName(program.entry.name),
      [],
      program.entry.body,
      undefined
    );
  }

  private generateStandaloneRoutine(routine: RoutineNode): string[] {
    const implicitReturnTarget =
      routine.returnTarget ??
      (routine.headerKind === "Funcion" ? routine.name : undefined);

    return this.generateStandaloneRoutineLike(
      readableRoutineName(routine.name),
      routine.params,
      routine.body,
      implicitReturnTarget
    );
  }

  private generateStandaloneRoutineLike(
    jsName: string,
    params: RoutineNode["params"],
    body: StatementNode[],
    implicitReturnTarget?: string
  ): string[] {
    const locals = new Set<string>();
    collectLocalNames(body, locals);
    params.forEach((parameter) => locals.delete(parameter.name));
    if (implicitReturnTarget) {
      locals.add(implicitReturnTarget);
    }

    const lines: string[] = [];
    const renderedParams = params.map((parameter) =>
      parameter.byReference
        ? `${parameter.name} /* por referencia */`
        : parameter.name
    );
    lines.push(`async function ${jsName}(${renderedParams.join(", ")}) {`);

    if (locals.size > 0) {
      lines.push(`${indent(1)}let ${[...locals].join(", ")};`, "");
    }

    const bodyLines = this.generateStandaloneStatements(body, 1);
    lines.push(...bodyLines);

    if (implicitReturnTarget) {
      if (bodyLines.length > 0 && bodyLines[bodyLines.length - 1] !== "") {
        lines.push("");
      }
      lines.push(`${indent(1)}return ${implicitReturnTarget};`);
    }

    lines.push("}");
    return lines;
  }

  private generateStandaloneStatements(
    statements: StatementNode[],
    level: number
  ): string[] {
    const lines: string[] = [];

    for (const statement of statements) {
      switch (statement.kind) {
        case "define":
          break;
        case "dimension":
          for (const item of statement.items) {
            lines.push(
              `${indent(level)}${
                item.name
              } = createRuntimeArray([${item.dimensions
                .map((dimension) =>
                  this.generateStandaloneExpression(dimension)
                )
                .join(", ")}]);`
            );
          }
          break;
        case "assignment":
          lines.push(
            `${indent(level)}${this.generateStandaloneReference(
              statement.target
            )} = ${this.generateStandaloneExpression(statement.value)};`
          );
          break;
        case "write":
          lines.push(
            `${indent(
              level
            )}await runtime.write(${this.generateStandaloneWriteExpression(
              statement.expressions
            )}, ${statement.newline ? "true" : "false"});`
          );
          break;
        case "read":
          for (const target of statement.targets) {
            lines.push(
              `${indent(level)}${this.generateStandaloneReference(
                target
              )} = await runtime.read();`
            );
          }
          break;
        case "if":
          lines.push(
            `${indent(level)}if (${this.generateStandaloneExpression(
              statement.condition
            )}) {`
          );
          lines.push(
            ...this.generateStandaloneStatements(
              statement.thenBranch,
              level + 1
            )
          );
          if (statement.elseBranch.length > 0) {
            lines.push(`${indent(level)}} else {`);
            lines.push(
              ...this.generateStandaloneStatements(
                statement.elseBranch,
                level + 1
              )
            );
          }
          lines.push(`${indent(level)}}`);
          break;
        case "while":
          lines.push(
            `${indent(level)}while (${this.generateStandaloneExpression(
              statement.condition
            )}) {`
          );
          lines.push(
            ...this.generateStandaloneStatements(statement.body, level + 1)
          );
          lines.push(`${indent(level)}}`);
          break;
        case "repeat":
          lines.push(`${indent(level)}do {`);
          lines.push(
            ...this.generateStandaloneStatements(statement.body, level + 1)
          );
          lines.push(
            `${indent(level)}} while (${
              statement.mode === "while" ? "" : "!"
            }(${this.generateStandaloneExpression(statement.condition)}));`
          );
          break;
        case "for": {
          const finalName = this.nextTemp("final");
          const stepName = this.nextTemp("step");
          const start = this.generateStandaloneExpression(statement.start);
          const end = this.generateStandaloneExpression(statement.end);
          const step = statement.step
            ? this.generateStandaloneExpression(statement.step)
            : this.settings.deduceNegativeForStep
            ? `(${start} > ${end} ? -1 : 1)`
            : "1";
          lines.push(`${indent(level)}const ${finalName} = ${end};`);
          lines.push(`${indent(level)}const ${stepName} = ${step};`);
          lines.push(
            `${indent(level)}for (${
              statement.variable
            } = ${start}; ${stepName} > 0 ? ${
              statement.variable
            } <= ${finalName} : ${statement.variable} >= ${finalName}; ${
              statement.variable
            } += ${stepName}) {`
          );
          lines.push(
            ...this.generateStandaloneStatements(statement.body, level + 1)
          );
          lines.push(`${indent(level)}}`);
          break;
        }
        case "forEach":
          lines.push(
            `${indent(
              level
            )}for (const __item of ${this.generateStandaloneExpression(
              statement.collection
            )}) {`
          );
          lines.push(`${indent(level + 1)}${statement.variable} = __item;`);
          lines.push(
            ...this.generateStandaloneStatements(statement.body, level + 1)
          );
          lines.push(`${indent(level)}}`);
          break;
        case "switch":
          lines.push(
            `${indent(level)}switch (${this.generateStandaloneExpression(
              statement.expression
            )}) {`
          );
          for (const switchCase of statement.cases) {
            for (const value of switchCase.values) {
              lines.push(
                `${indent(level + 1)}case ${this.generateStandaloneExpression(
                  value
                )}:`
              );
            }
            lines.push(
              ...this.generateStandaloneStatements(switchCase.body, level + 2)
            );
            lines.push(`${indent(level + 2)}break;`);
          }
          if (statement.defaultCase.length > 0) {
            lines.push(`${indent(level + 1)}default:`);
            lines.push(
              ...this.generateStandaloneStatements(
                statement.defaultCase,
                level + 2
              )
            );
          }
          lines.push(`${indent(level)}}`);
          break;
        case "expression":
          lines.push(
            `${indent(level)}${this.generateStandaloneExpression(
              statement.expression
            )};`
          );
          break;
        case "clear":
          lines.push(`${indent(level)}await runtime.clear();`);
          break;
        case "wait":
          if (statement.mode === "key") {
            lines.push(`${indent(level)}await runtime.waitForKey();`);
          } else {
            lines.push(
              `${indent(
                level
              )}await runtime.sleep(${this.generateStandaloneExpression(
                statement.durationMs!
              )});`
            );
          }
          break;
        case "return":
          lines.push(
            `${indent(level)}return ${
              statement.expression
                ? this.generateStandaloneExpression(statement.expression)
                : "null"
            };`
          );
          break;
      }
    }

    return lines;
  }

  private generateStandaloneWriteExpression(
    expressions: ExpressionNode[]
  ): string {
    if (expressions.length === 0) {
      return '""';
    }

    return expressions
      .map((expression) => this.generateStandaloneDisplayExpression(expression))
      .join(" + ");
  }

  private generateStandaloneDisplayExpression(
    expression: ExpressionNode
  ): string {
    if (expression.kind === "literal" && expression.valueType === "string") {
      return escapeString(String(expression.value));
    }

    return `String(${this.generateStandaloneExpression(expression)})`;
  }

  private generateStandaloneReference(
    expression: AssignableExpressionNode
  ): string {
    if (expression.kind === "identifier") {
      return expression.name;
    }

    const base = this.generateStandaloneExpression(expression.target);
    const suffix = expression.indices
      .map(
        (indexExpression) =>
          `[${this.generateStandaloneArrayIndex(indexExpression)}]`
      )
      .join("");

    return `${base}${suffix}`;
  }

  private generateStandaloneArrayIndex(expression: ExpressionNode): string {
    const rendered = this.generateStandaloneExpression(expression);
    return this.settings.baseZeroArrays ? rendered : `(${rendered} - 1)`;
  }

  private generateStandaloneExpression(expression: ExpressionNode): string {
    switch (expression.kind) {
      case "literal":
        if (expression.valueType === "string") {
          return escapeString(String(expression.value));
        }
        if (expression.valueType === "boolean") {
          return expression.value ? "true" : "false";
        }
        return String(expression.value);
      case "group":
        return `(${this.generateStandaloneExpression(expression.expression)})`;
      case "identifier": {
        const routine = this.routines.get(expression.name.toLowerCase());
        if (routine && routine.params.length === 0) {
          return `await ${readableRoutineName(routine.name)}()`;
        }
        return expression.name;
      }
      case "arrayAccess":
        return this.generateStandaloneReference(expression);
      case "call": {
        const builtin = this.generateStandaloneBuiltinCall(
          expression.callee,
          expression.args
        );
        if (builtin) {
          return builtin;
        }

        const routine = this.routines.get(expression.callee.toLowerCase());
        if (!routine) {
          return `${expression.callee}(${expression.args
            .map((arg) => this.generateStandaloneExpression(arg))
            .join(", ")})`;
        }

        return `await ${readableRoutineName(routine.name)}(${expression.args
          .map((arg) => this.generateStandaloneExpression(arg))
          .join(", ")})`;
      }
      case "unary":
        return expression.operator === "-"
          ? `(-${this.generateStandaloneExpression(expression.operand)})`
          : `(!${this.generateStandaloneExpression(expression.operand)})`;
      case "binary":
        return this.generateStandaloneBinary(expression);
    }
  }

  private generateStandaloneBuiltinCall(
    name: string,
    args: ExpressionNode[]
  ): string | null {
    const normalized = name
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toUpperCase();
    const renderedArgs = args.map((arg) =>
      this.generateStandaloneExpression(arg)
    );

    switch (normalized) {
      case "ABS":
        return `Math.abs(${renderedArgs[0] ?? "0"})`;
      case "ACOS":
        return `Math.acos(${renderedArgs[0] ?? "0"})`;
      case "ASEN":
      case "ASIN":
        return `Math.asin(${renderedArgs[0] ?? "0"})`;
      case "ATAN":
        return `Math.atan(${renderedArgs[0] ?? "0"})`;
      case "AZAR":
        return `Math.floor(Math.random() * (${renderedArgs[0] ?? "0"}))`;
      case "CONCATENAR":
        return renderedArgs.map((arg) => `String(${arg})`).join(" + ") || '""';
      case "CONVERTIRANUMERO":
        return `Number(${renderedArgs[0] ?? "0"})`;
      case "CONVERTIRATEXTO":
        return `String(${renderedArgs[0] ?? '""'})`;
      case "COS":
        return `Math.cos(${renderedArgs[0] ?? "0"})`;
      case "EXP":
        return `Math.exp(${renderedArgs[0] ?? "0"})`;
      case "LN":
        return `Math.log(${renderedArgs[0] ?? "0"})`;
      case "LONGITUD":
        return `String(${renderedArgs[0] ?? '""'}).length`;
      case "MAYUSCULAS":
        return `String(${renderedArgs[0] ?? '""'}).toUpperCase()`;
      case "MINUSCULAS":
        return `String(${renderedArgs[0] ?? '""'}).toLowerCase()`;
      case "RAIZ":
      case "RC":
        return `Math.sqrt(${renderedArgs[0] ?? "0"})`;
      case "REDON":
        return `Math.round(${renderedArgs[0] ?? "0"})`;
      case "SEN":
      case "SIN":
        return `Math.sin(${renderedArgs[0] ?? "0"})`;
      case "SUBCADENA": {
        const source = `String(${renderedArgs[0] ?? '""'})`;
        const start =
          renderedArgs[1] ?? (this.settings.baseZeroArrays ? "0" : "1");
        const end = renderedArgs[2] ?? start;
        return this.settings.baseZeroArrays
          ? `${source}.slice(${start}, (${end}) + 1)`
          : `${source}.slice((${start}) - 1, ${end})`;
      }
      case "TAN":
        return `Math.tan(${renderedArgs[0] ?? "0"})`;
      case "TRUNC":
        return `Math.trunc(${renderedArgs[0] ?? "0"})`;
      default:
        return null;
    }
  }

  private generateStandaloneBinary(
    expression: ExpressionNode & { kind: "binary" }
  ): string {
    const left = this.generateStandaloneExpression(expression.left);
    const right = this.generateStandaloneExpression(expression.right);

    switch (expression.operator) {
      case "+":
        return `(${left} + ${right})`;
      case "-":
        return `(${left} - ${right})`;
      case "*":
        return `(${left} * ${right})`;
      case "/":
        return `(${left} / ${right})`;
      case "%":
        return `(${left} % ${right})`;
      case "^":
        return `Math.pow(${left}, ${right})`;
      case "=":
        return `(${left} === ${right})`;
      case "<>":
        return `(${left} !== ${right})`;
      case "<":
      case ">":
      case "<=":
      case ">=":
        return `(${left} ${expression.operator} ${right})`;
      case "AND":
        return `(${left} && ${right})`;
      case "OR":
        return `(${left} || ${right})`;
      default:
        return "null";
    }
  }

  private generateStandaloneRuntimePrelude(
    target: JavaScriptExportTarget
  ): string[] {
    if (target === "node") {
      return [
        "function createNodeRuntime() {",
        "  const readline = require('node:readline/promises');",
        "  const { stdin: input, stdout: output } = require('node:process');",
        "  const rl = readline.createInterface({ input, output });",
        "  let pendingLine = '';",
        "  return {",
        "    async write(value, newline = true) {",
        "      pendingLine += String(value ?? '');",
        "      if (newline) {",
        "        output.write(`${pendingLine}\\n`);",
        "        pendingLine = '';",
        "      }",
        "    },",
        "    async read() {",
        "      return await rl.question('');",
        "    },",
        "    async clear() {",
        "      output.write('\\x1Bc');",
        "      pendingLine = '';",
        "    },",
        "    async sleep(ms) {",
        "      await new Promise((resolve) => setTimeout(resolve, ms));",
        "    },",
        "    async waitForKey() {",
        "      await rl.question('Presiona Enter para continuar...');",
        "    },",
        "    async flush() {",
        "      if (pendingLine.length > 0) {",
        "        output.write(pendingLine);",
        "        pendingLine = '';",
        "      }",
        "    },",
        "    async close() {",
        "      await rl.close();",
        "    },",
        "  };",
        "}",
        "const runtime = createNodeRuntime();",
      ];
    }

    return [
      "function createBrowserRuntime() {",
      "  let pendingLine = '';",
      "  return {",
      "    async write(value, newline = true) {",
      "      pendingLine += String(value ?? '');",
      "      if (newline) {",
      "        console.log(pendingLine);",
      "        pendingLine = '';",
      "      }",
      "    },",
      "    async read() {",
      "      return window.prompt('') ?? '';",
      "    },",
      "    async clear() {",
      "      console.clear();",
      "      pendingLine = '';",
      "    },",
      "    async sleep(ms) {",
      "      await new Promise((resolve) => setTimeout(resolve, ms));",
      "    },",
      "    async waitForKey() {",
      "      window.confirm('Presiona Aceptar para continuar.');",
      "    },",
      "    async flush() {",
      "      if (pendingLine.length > 0) {",
      "        console.log(pendingLine);",
      "        pendingLine = '';",
      "      }",
      "    },",
      "  };",
      "}",
      "const runtime = createBrowserRuntime();",
    ];
  }

  private generateStandaloneEntrypoint(
    entryName: string,
    target: JavaScriptExportTarget
  ): string[] {
    const finalizer =
      target === "node"
        ? [
            "  } finally {",
            "    if (typeof runtime.flush === 'function') {",
            "      await runtime.flush();",
            "    }",
            "    if (typeof runtime.close === 'function') {",
            "      await runtime.close();",
            "    }",
            "  }",
          ]
        : [
            "  } finally {",
            "    if (typeof runtime.flush === 'function') {",
            "      await runtime.flush();",
            "    }",
            "  }",
          ];

    return [
      "(async () => {",
      "  try {",
      `    await ${entryName}();`,
      ...finalizer,
      "})();",
    ];
  }

  private nextTemp(prefix: string): string {
    this.tempCounter += 1;
    return `__${prefix}_${this.tempCounter}`;
  }
}

export async function runGeneratedJavaScript(
  code: string,
  runtime: {
    write(value: string, newline?: boolean): void | Promise<void>;
    read(): string | Promise<string>;
    clear(): void | Promise<void>;
    sleep(ms: number): Promise<void>;
    waitForKey(): Promise<void>;
  },
  random?: () => number
): Promise<void> {
  const factory = new Function(
    "__runtime",
    "__random",
    `${code}\nreturn __runtime_entry(__runtime, __random);`
  ) as (
    runtimeArg: typeof runtime,
    randomArg: (() => number) | undefined
  ) => Promise<void>;
  await factory(runtime, random);
}
