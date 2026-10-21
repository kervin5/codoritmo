import {
  AssignableExpressionNode,
  EngineSettings,
  ExpressionNode,
  GenerationResult,
  JavaScriptExportTarget,
  ProgramNode,
  RoutineNode,
  StatementNode,
  StaticType,
} from "./types";
import { BUILTIN_SIGNATURES, normalizeIdentifier } from "./checker";
import { formatNumber } from "./runtime";
import { normalizeEngineSettings } from "./settings";

// Generated code mirrors the interpreter (interpreter.ts): numbers print with
// formatNumber, the math built-ins check their domain, arrays are shared with
// subprocesses and Para Cada aliases each element.

const STRING_FUNCTIONS = [
  "CONCATENAR",
  "CONVERTIRANUMERO",
  "CONVERTIRATEXTO",
  "LONGITUD",
  "MAYUSCULAS",
  "MINUSCULAS",
  "SUBCADENA",
];

const RESERVED_WORDS = new Set([
  "arguments",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "eval",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "Infinity",
  "instanceof",
  "interface",
  "let",
  "Math",
  "NaN",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "pseint",
  "public",
  "return",
  "runtime",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "undefined",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

interface LocalNames {
  /** Lowercase name -> first spelling seen in the source. */
  names: Map<string, string>;
  /** Lowercase names created with Dimension. */
  arrays: Set<string>;
}

function forEachExpression(
  expression: ExpressionNode,
  visit: (expression: ExpressionNode) => void
): void {
  visit(expression);
  switch (expression.kind) {
    case "group":
      forEachExpression(expression.expression, visit);
      break;
    case "arrayAccess":
      forEachExpression(expression.target, visit);
      expression.indices.forEach((item) => forEachExpression(item, visit));
      break;
    case "call":
      expression.args.forEach((item) => forEachExpression(item, visit));
      break;
    case "unary":
      forEachExpression(expression.operand, visit);
      break;
    case "binary":
      forEachExpression(expression.left, visit);
      forEachExpression(expression.right, visit);
      break;
    default:
      break;
  }
}

function statementExpressions(statement: StatementNode): ExpressionNode[] {
  switch (statement.kind) {
    case "dimension":
      return statement.items.flatMap((item) => item.dimensions);
    case "assignment":
      return [statement.target, statement.value];
    case "write":
      return statement.expressions;
    case "read":
      return statement.targets;
    case "if":
    case "while":
    case "repeat":
      return [statement.condition];
    case "for":
      return [statement.start, statement.end, ...(statement.step ? [statement.step] : [])];
    case "forEach":
      return [statement.collection];
    case "switch":
      return [
        statement.expression,
        ...statement.cases.flatMap((item) => item.values),
      ];
    case "expression":
      return [statement.expression];
    case "wait":
      return statement.durationMs ? [statement.durationMs] : [];
    case "return":
      return statement.expression ? [statement.expression] : [];
    default:
      return [];
  }
}

function childBlocks(statement: StatementNode): StatementNode[][] {
  switch (statement.kind) {
    case "if":
      return [statement.thenBranch, statement.elseBranch];
    case "while":
    case "repeat":
    case "for":
    case "forEach":
      return [statement.body];
    case "switch":
      return [...statement.cases.map((item) => item.body), statement.defaultCase];
    default:
      return [];
  }
}

// Every variable a routine uses, so each one is declared once up front.
// Names are case-insensitive, as in PSeInt.
function collectLocalNames(
  statements: StatementNode[],
  routines: Map<string, RoutineNode>,
  locals: LocalNames = { names: new Map(), arrays: new Set() }
): LocalNames {
  const add = (name: string) => {
    const key = name.toLowerCase();
    if (!locals.names.has(key)) {
      locals.names.set(key, name);
    }
  };

  for (const statement of statements) {
    switch (statement.kind) {
      case "define":
        statement.names.forEach(add);
        break;
      case "dimension":
        statement.items.forEach((item) => {
          add(item.name);
          locals.arrays.add(item.name.toLowerCase());
        });
        break;
      case "for":
      case "forEach":
        add(statement.variable);
        break;
      default:
        break;
    }

    for (const expression of statementExpressions(statement)) {
      forEachExpression(expression, (item) => {
        // A bare routine name is a call, unless the routine also assigns it.
        if (item.kind === "identifier" && !routines.has(item.name.toLowerCase())) {
          add(item.name);
        }
      });
    }
    if (statement.kind === "assignment" && statement.target.kind === "identifier") {
      add(statement.target.name);
    }
    if (statement.kind === "read") {
      statement.targets.forEach((target) => {
        if (target.kind === "identifier") add(target.name);
      });
    }

    childBlocks(statement).forEach((block) =>
      collectLocalNames(block, routines, locals)
    );
  }

  return locals;
}

function escapeString(value: string): string {
  return JSON.stringify(value);
}

function indent(level: number): string {
  return "  ".repeat(level);
}

function sanitizeIdentifier(name: string): string {
  const sanitized = name.replace(/[^\p{L}\p{N}_$]/gu, "_");
  return /^\p{N}/u.test(sanitized) ? `_${sanitized}` : sanitized;
}

function executableRoutineName(name: string): string {
  return `__routine_${sanitizeIdentifier(name.toLowerCase())}`;
}

function executableCellName(name: string): string {
  return `v_${sanitizeIdentifier(name.toLowerCase())}`;
}

function standaloneVariableName(name: string): string {
  const sanitized = sanitizeIdentifier(name);
  return RESERVED_WORDS.has(sanitized) ? `${sanitized}_` : sanitized;
}

function readableRoutineName(name: string): string {
  const normalized = name.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const sanitized = normalized.replace(/[^\p{L}\p{N}_$]/gu, "_");
  if (!sanitized) {
    return "algoritmo";
  }

  const readable = sanitized.charAt(0).toLowerCase() + sanitized.slice(1);
  return RESERVED_WORDS.has(readable) ? `${readable}_` : readable;
}

function defaultLiteral(type: StaticType | undefined): string {
  switch (type) {
    case "num":
      return "0";
    case "bool":
      return "false";
    case "str":
      return '""';
    default:
      return "null";
  }
}

function baseName(expression: ExpressionNode): string | null {
  if (expression.kind === "identifier") return expression.name;
  if (expression.kind === "arrayAccess") return baseName(expression.target);
  return null;
}

// Helpers shared by the standalone export and generateExecutable(). The
// object is created once per program run, with the random source to use.
function helperLibrary(
  settings: EngineSettings,
  objectName: string,
  random: string
): string[] {
  const options = {
    allowConcatenation: settings.allowConcatenation,
    allowResizeArrays: settings.allowResizeArrays,
    baseZeroArrays: settings.baseZeroArrays,
  };

  return [
    `const ${objectName} = ((random) => {`,
    `  const settings = ${JSON.stringify(options)};`,
    "  class RuntimeError extends Error {}",
    '  RuntimeError.prototype.name = "PSeIntRuntimeError";',
    "  const fail = (message) => {",
    "    throw new RuntimeError(message);",
    "  };",
    "  // Numbers print rounded to 10 decimals and never in exponent notation.",
    `  const formatNumber = ${formatNumber.toString()};`,
    "  const format = (value) => {",
    '    if (typeof value === "boolean") return value ? "VERDADERO" : "FALSO";',
    "    if (value === null || value === undefined) return \"\";",
    '    if (typeof value === "number") return formatNumber(value);',
    "    return String(value);",
    "  };",
    "  const toNumber = (value) => {",
    '    if (typeof value === "number") return value;',
    '    if (typeof value === "boolean") return value ? 1 : 0;',
    '    if (typeof value === "string") return Number(value);',
    "    return 0;",
    "  };",
    "  const toBoolean = (value) => {",
    '    if (typeof value === "boolean") return value;',
    '    if (typeof value === "number") return value !== 0;',
    '    if (typeof value === "string") return value.length > 0;',
    "    return value !== null && value !== undefined;",
    "  };",
    "  const condition = (value) => {",
    '    if (typeof value === "boolean") return value;',
    "    if (value === null || value === undefined) return false;",
    '    return fail("La condición debe ser una expresión lógica.");',
    "  };",
    '  const comparable = (value) => typeof value === "string" ? value : toNumber(value);',
    "  const add = (left, right) => {",
    '    if (typeof left === "string" || typeof right === "string") {',
    "      if (!settings.allowConcatenation) {",
    "        fail('String concatenation with \"+\" is disabled in the current profile.');",
    "      }",
    "      return format(left) + format(right);",
    "    }",
    "    return toNumber(left) + toNumber(right);",
    "  };",
    "  const divide = (left, right) => {",
    '    if (toNumber(right) === 0) fail("División por cero.");',
    "    return toNumber(left) / toNumber(right);",
    "  };",
    "  const modulo = (left, right) => {",
    '    if (toNumber(right) === 0) fail("División por cero.");',
    "    return toNumber(left) % toNumber(right);",
    "  };",
    "  // Values within 1e-11 of the next integer truncate to it: trunc(100*0.57) is 57.",
    "  const trunc = (value) => {",
    "    const number = toNumber(value);",
    "    let truncated = Math.trunc(number);",
    "    if (truncated + 1 - number < 1e-11) {",
    "      truncated += 1;",
    "    } else if (truncated - 1 - number > -1e-11) {",
    "      truncated -= 1;",
    "    }",
    "    return truncated;",
    "  };",
    "  // Half away from zero: redon(-2.5) is -3.",
    "  const round = (value) => {",
    "    const number = toNumber(value);",
    "    return Math.trunc(number + (number < 0 ? -0.5 : 0.5));",
    "  };",
    "  const asin = (value) => {",
    "    const number = toNumber(value);",
    '    if (number < -1 || number > 1) fail("Argumento inválido para la función ASEN (debe estar en [-1;+1]).");',
    "    return Math.asin(number);",
    "  };",
    "  const acos = (value) => {",
    "    const number = toNumber(value);",
    '    if (number < -1 || number > 1) fail("Argumento inválido para la función ACOS (debe estar en [-1;+1]).");',
    "    return Math.acos(number);",
    "  };",
    "  const sqrt = (value) => {",
    "    const number = toNumber(value);",
    '    if (number < 0) fail("Raíz cuadrada de número negativo.");',
    "    return Math.sqrt(number);",
    "  };",
    "  const ln = (value) => {",
    "    const number = toNumber(value);",
    '    if (number <= 0) fail("Logaritmo de 0 o negativo.");',
    "    return Math.log(number);",
    "  };",
    "  const azar = (value) => {",
    "    const limit = Math.trunc(toNumber(value));",
    '    if (limit <= 0) fail("Azar de 0 o negativo.");',
    "    return Math.floor(random() * limit);",
    "  };",
    "  const aleatorio = (from, to) => {",
    "    let low = Math.trunc(toNumber(from));",
    "    let high = Math.trunc(toNumber(to));",
    "    if (high < low) [low, high] = [high, low];",
    "    return low + Math.floor(random() * (high - low + 1));",
    "  };",
    "  const currentDate = () => {",
    "    const now = new Date();",
    "    return now.getUTCFullYear() * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();",
    "  };",
    "  const currentTime = () => {",
    "    const now = new Date();",
    "    return now.getHours() * 10000 + now.getMinutes() * 100 + now.getSeconds();",
    "  };",
    "  const numericText = /^[+-]?(\\d+\\.?\\d*|\\.\\d+)$/;",
    "  const textToNumber = (value) => {",
    "    const text = format(value).trim();",
    "    if (!numericText.test(text)) fail(`No se puede convertir \"${text}\" a número.`);",
    "    return Number(text);",
    "  };",
    "  const substring = (value, from, to) => {",
    "    const source = format(value);",
    "    const start = Math.max(settings.baseZeroArrays ? 0 : 1, toNumber(from));",
    "    const end = Math.max(start, toNumber(to));",
    "    return settings.baseZeroArrays ? source.slice(start, end + 1) : source.slice(start - 1, end);",
    "  };",
    "  // Converts a line typed at a Leer prompt to the type the variable holds.",
    "  const read = (raw, expected) => {",
    "    let input = raw;",
    "    const upper = input.toUpperCase();",
    '    if (upper === "VERDADERO" || upper === "FALSO") input = upper;',
    '    if (expected === "bool" && input.length === 1) {',
    "      const letter = input.toUpperCase();",
    '      if (letter === "F" || letter === "0") input = "FALSO";',
    '      if (letter === "V" || letter === "1") input = "VERDADERO";',
    "    }",
    '    const guessed = numericText.test(input) ? "num" : input === "VERDADERO" || input === "FALSO" ? "bool" : "str";',
    "    const type = expected ?? guessed;",
    '    if (type !== "str" && guessed !== type) fail("No coinciden los tipos.");',
    '    return type === "num" ? Number(input) : type === "bool" ? input === "VERDADERO" : raw;',
    "  };",
    "  const dimensions = (sizes) => sizes.map((size) => {",
    '    if (typeof size !== "number") fail("Las dimensiones deben ser numéricas.");',
    '    if (!Number.isInteger(size)) fail("Las dimensiones solo pueden ser números enteros.");',
    "    if (size < 0 || (size === 0 && !settings.allowResizeArrays)) {",
    '      fail("Array dimensions must evaluate to positive integers.");',
    "    }",
    "    return size;",
    "  });",
    "  const array = (sizes, initial = null) => {",
    "    const build = ([size, ...rest]) =>",
    "      Array.from({ length: size }, () => rest.length > 0 ? build(rest) : initial);",
    "    return build(dimensions(sizes));",
    "  };",
    "  // Redimensionar: resizes in place, so subprocesses sharing the array see it.",
    "  const resize = (current, sizes, initial = null) => {",
    '    if (!Array.isArray(current)) fail("La variable no es un arreglo.");',
    "    const resized = array(sizes, initial);",
    "    const copy = (from, to) => {",
    "      for (let index = 0; index < Math.min(from.length, to.length); index += 1) {",
    "        if (Array.isArray(from[index]) && Array.isArray(to[index])) {",
    "          copy(from[index], to[index]);",
    "        } else if (!Array.isArray(from[index])) {",
    "          to[index] = from[index];",
    "        }",
    "      }",
    "    };",
    "    copy(current, resized);",
    "    current.splice(0, current.length, ...resized);",
    "  };",
    "  // Para Cada: every element of the array (all dimensions), as [array, index].",
    "  function* elements(collection) {",
    '    if (!Array.isArray(collection)) fail("Para Cada requires an array collection.");',
    "    for (let index = 0; index < collection.length; index += 1) {",
    "      if (Array.isArray(collection[index])) {",
    "        yield* elements(collection[index]);",
    "      } else {",
    "        yield [collection, index];",
    "      }",
    "    }",
    "  }",
    "  const arrayParameter = (value) => {",
    '    if (Array.isArray(value)) fail("Los arreglos solo pueden pasarse por referencia.");',
    "    return value;",
    "  };",
    "  return {",
    "    RuntimeError, fail, format, toNumber, toBoolean, condition, comparable, add, divide, modulo,",
    "    trunc, round, asin, acos, sqrt, ln, azar, aleatorio, currentDate, currentTime, textToNumber,",
    "    substring, read, dimensions, array, resize, elements, arrayParameter,",
    "  };",
    `})(${random});`,
  ];
}

// generateExecutable() keeps every variable in a cell ({ value }) so that
// Por Referencia parameters and Para Cada can alias it.
const EXECUTABLE_CELL_HELPERS = [
  "const __runtime_cell = (value = null) => ({ value });",
  'const __runtime_isArray = (value) => value !== null && typeof value === "object" && value.kind === "array";',
  "const __runtime_array = (dimensions, initial, depth = 0) => ({",
  '  kind: "array",',
  "  dimensions: dimensions.slice(depth),",
  "  items: Array.from({ length: dimensions[depth] }, () => depth + 1 < dimensions.length ? __runtime_array(dimensions, initial, depth + 1) : __runtime_cell(initial)),",
  "});",
  "const __runtime_dimension = (cell, name, sizes, initial) => {",
  "  const dimensions = __pseint.dimensions(sizes);",
  "  if (__runtime_isArray(cell.value)) __pseint.fail(`El arreglo \"${name}\" ya fue dimensionado.`);",
  "  cell.value = __runtime_array(dimensions, initial);",
  "};",
  "const __runtime_resize = (cell, name, sizes, initial) => {",
  "  const dimensions = __pseint.dimensions(sizes);",
  "  if (!__runtime_isArray(cell.value)) __pseint.fail(`\"${name}\" no es un arreglo.`);",
  "  if (cell.value.dimensions.length !== dimensions.length) {",
  '    __pseint.fail("No se puede cambiar la cantidad de dimensiones de un arreglo.");',
  "  }",
  "  const resized = __runtime_array(dimensions, initial);",
  "  const copy = (from, to) => {",
  "    for (let index = 0; index < Math.min(from.items.length, to.items.length); index += 1) {",
  "      const source = from.items[index];",
  '      if (source.kind === "array" && to.items[index].kind === "array") {',
  "        copy(source, to.items[index]);",
  '      } else if (source.kind !== "array") {',
  "        to.items[index] = source;",
  "      }",
  "    }",
  "  };",
  "  copy(cell.value, resized);",
  "  cell.value = resized;",
  "};",
  "const __runtime_leaves = (value) => {",
  '  if (!__runtime_isArray(value)) __pseint.fail("Para Cada requires an array collection.");',
  "  const cells = [];",
  "  const visit = (array) => {",
  "    for (const item of array.items) {",
  '      if (item.kind === "array") visit(item);',
  "      else cells.push(item);",
  "    }",
  "  };",
  "  visit(value);",
  "  return cells;",
  "};",
  "const __runtime_arrayCell = (arrayValue, indices) => {",
  '  if (!__runtime_isArray(arrayValue)) __pseint.fail("La variable no es un arreglo.");',
  "  if (indices.length !== arrayValue.dimensions.length) {",
  '    __pseint.fail("La cantidad de subíndices no coincide con las dimensiones del arreglo.");',
  "  }",
  "  let current = arrayValue;",
  "  for (let indexPosition = 0; indexPosition < indices.length; indexPosition += 1) {",
  "    const requestedIndex = __pseint.toNumber(indices[indexPosition]);",
  '    if (!Number.isInteger(requestedIndex)) __pseint.fail("Array indices must be integers.");',
  "    const offset = requestedIndex - (__runtime_settings.baseZeroArrays ? 0 : 1);",
  '    if (offset < 0 || offset >= current.items.length) __pseint.fail("Array index out of bounds.");',
  "    current = current.items[offset];",
  "  }",
  "  return current;",
  "};",
  "// Arrays are always shared with the subprocess; Por Valor on one is an error.",
  "const __runtime_shareArg = (cell, explicitByValue) => {",
  "  if (!__runtime_isArray(cell.value)) return __runtime_cell(cell.value);",
  '  if (explicitByValue) __pseint.fail("Los arreglos solo pueden pasarse por referencia.");',
  "  return cell;",
  "};",
  "const __runtime_valueArg = (value, explicitByValue) => {",
  '  if (__runtime_isArray(value) && explicitByValue) __pseint.fail("Los arreglos solo pueden pasarse por referencia.");',
  "  return __runtime_cell(value);",
  "};",
  "const __runtime_builtin = (name, values) => {",
  `  if (!__runtime_settings.enableStringFunctions && ${JSON.stringify(STRING_FUNCTIONS)}.includes(name)) {`,
  '    __pseint.fail(`String function "${name}" is disabled in the current profile.`);',
  "  }",
  "  const arg = (index) => __pseint.toNumber(values[index] ?? 0);",
  "  switch (name) {",
  '    case "ABS": return Math.abs(arg(0));',
  '    case "ACOS": return __pseint.acos(arg(0));',
  '    case "ALEATORIO": return __pseint.aleatorio(arg(0), arg(1));',
  '    case "ASEN": return __pseint.asin(arg(0));',
  '    case "ATAN": return Math.atan(arg(0));',
  '    case "AZAR": return __pseint.azar(arg(0));',
  '    case "CONCATENAR": return values.map(__pseint.format).join("");',
  '    case "CONVERTIRANUMERO": return __pseint.textToNumber(values[0] ?? "");',
  '    case "CONVERTIRATEXTO": return __pseint.format(values[0] ?? "");',
  '    case "COS": return Math.cos(arg(0));',
  '    case "EULER": return Math.E;',
  '    case "EXP": return Math.exp(arg(0));',
  '    case "FECHAACTUAL": return __pseint.currentDate();',
  '    case "HORAACTUAL": return __pseint.currentTime();',
  '    case "LN": return __pseint.ln(arg(0));',
  '    case "LONGITUD": return __pseint.format(values[0] ?? "").length;',
  '    case "MAYUSCULAS": return __pseint.format(values[0] ?? "").toUpperCase();',
  '    case "MINUSCULAS": return __pseint.format(values[0] ?? "").toLowerCase();',
  '    case "PI": return Math.PI;',
  '    case "RAIZ":',
  '    case "RC": return __pseint.sqrt(arg(0));',
  '    case "REDON": return __pseint.round(arg(0));',
  '    case "SEN": return Math.sin(arg(0));',
  '    case "SUBCADENA": return __pseint.substring(values[0] ?? "", values[1] ?? 1, values[2] ?? values[1] ?? 1);',
  '    case "TAN": return Math.tan(arg(0));',
  '    case "TRUNC": return __pseint.trunc(arg(0));',
  '    default: return __pseint.fail(`Unknown function "${name}".`);',
  "  }",
  "};",
];

interface JavaScriptGenerateOptions {
  target?: JavaScriptExportTarget;
}

export class JavaScriptGenerator {
  private readonly routines = new Map<string, RoutineNode>();
  private readonly settings: EngineSettings;
  private tempCounter = 0;
  /** Static types of the routine being generated (lowercase name -> type). */
  private types: Record<string, StaticType> = {};
  /** Standalone: lowercase variable name -> JavaScript expression. */
  private names = new Map<string, string>();

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
      "async function __runtime_entry(__runtime, __random = Math.random) {",
      ...helperLibrary(this.settings, "__pseint", "__random").map(
        (line) => `${indent(1)}${line}`
      ),
      ...EXECUTABLE_CELL_HELPERS.map((line) => `${indent(1)}${line}`),
    ];

    for (const routine of program.routines) {
      lines.push(...this.generateExecutableRoutine(routine, 1));
    }

    this.types = program.entry.inferredTypes ?? {};
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
    lines.push("", ...helperLibrary(this.settings, "pseint", "Math.random"));

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
    this.types = routine.inferredTypes ?? {};
    const lines: string[] = [];
    const locals = collectLocalNames(routine.body, this.routines);
    if (routine.returnTarget) {
      locals.names.set(routine.returnTarget.toLowerCase(), routine.returnTarget);
    }
    routine.params.forEach((parameter) =>
      locals.names.delete(parameter.name.toLowerCase())
    );

    const params = routine.params
      .map((parameter) => executableCellName(parameter.name))
      .join(", ");
    lines.push(
      `${indent(level)}async function ${executableRoutineName(
        routine.name
      )}(${params}) {`
    );
    lines.push(...this.generateExecutableLocals(locals, level + 1));

    const scope = new Set([
      ...locals.names.keys(),
      ...routine.params.map((item) => item.name.toLowerCase()),
    ]);
    lines.push(
      ...this.generateExecutableStatements(routine.body, level + 1, scope)
    );

    // Only `Funcion r <- nombre(...)` returns a value.
    lines.push(
      `${indent(level + 1)}return ${
        routine.returnTarget
          ? `${executableCellName(routine.returnTarget)}.value`
          : "null"
      };`
    );
    lines.push(`${indent(level)}}`);
    return lines;
  }

  private generateExecutableMain(
    statements: StatementNode[],
    level: number
  ): string[] {
    const locals = collectLocalNames(statements, this.routines);
    return [
      ...this.generateExecutableLocals(locals, level),
      ...this.generateExecutableStatements(
        statements,
        level,
        new Set(locals.names.keys())
      ),
    ];
  }

  // Uninitialized variables read as the default value of their type.
  private generateExecutableLocals(locals: LocalNames, level: number): string[] {
    return [...locals.names.keys()].map(
      (key) =>
        `${indent(level)}const ${executableCellName(key)} = __runtime_cell(${
          locals.arrays.has(key) ? "null" : defaultLiteral(this.types[key])
        });`
    );
  }

  private generateExecutableStatements(
    statements: StatementNode[],
    level: number,
    scope: Set<string>
  ): string[] {
    const lines: string[] = [];
    const expression = (node: ExpressionNode) =>
      this.generateExecutableExpression(node, scope);
    const condition = (node: ExpressionNode) =>
      `__pseint.condition(${expression(node)})`;

    for (const statement of statements) {
      switch (statement.kind) {
        case "define":
          break;
        case "dimension":
          for (const item of statement.items) {
            lines.push(
              `${indent(level)}${
                statement.resize ? "__runtime_resize" : "__runtime_dimension"
              }(${executableCellName(item.name)}, ${escapeString(
                item.name
              )}, [${item.dimensions.map(expression).join(", ")}], ${defaultLiteral(
                this.types[item.name.toLowerCase()]
              )});`
            );
          }
          break;
        case "assignment":
          lines.push(
            `${indent(level)}${this.generateExecutableReference(
              statement.target,
              scope
            )}.value = ${expression(statement.value)};`
          );
          break;
        case "write": {
          for (const item of statement.expressions) {
            lines.push(
              `${indent(level)}await __runtime.write(__pseint.format(${expression(
                item
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
                scope
              )}.value = __pseint.read(await __runtime.read(), ${this.expectedReadType(
                target
              )});`
            );
          }
          break;
        case "if":
          lines.push(`${indent(level)}if (${condition(statement.condition)}) {`);
          lines.push(
            ...this.generateExecutableStatements(
              statement.thenBranch,
              level + 1,
              scope
            )
          );
          if (statement.elseBranch.length > 0) {
            lines.push(`${indent(level)}} else {`);
            lines.push(
              ...this.generateExecutableStatements(
                statement.elseBranch,
                level + 1,
                scope
              )
            );
          }
          lines.push(`${indent(level)}}`);
          break;
        case "while":
          lines.push(
            `${indent(level)}while (${condition(statement.condition)}) {`
          );
          lines.push(
            ...this.generateExecutableStatements(statement.body, level + 1, scope)
          );
          lines.push(`${indent(level)}}`);
          break;
        case "repeat":
          lines.push(`${indent(level)}do {`);
          lines.push(
            ...this.generateExecutableStatements(statement.body, level + 1, scope)
          );
          lines.push(
            `${indent(level)}} while (${
              statement.mode === "while" ? "" : "!"
            }${condition(statement.condition)});`
          );
          break;
        case "for": {
          const counter = `${executableCellName(statement.variable)}.value`;
          const startName = this.nextTemp("start");
          const endName = this.nextTemp("end");
          const stepName = this.nextTemp("step");
          lines.push(
            `${indent(level)}const ${startName} = __pseint.toNumber(${expression(
              statement.start
            )});`
          );
          lines.push(
            `${indent(level)}const ${endName} = __pseint.toNumber(${expression(
              statement.end
            )});`
          );
          lines.push(
            `${indent(level)}const ${stepName} = ${
              statement.step
                ? `__pseint.toNumber(${expression(statement.step)})`
                : this.settings.deduceNegativeForStep
                ? `(${startName} > ${endName} ? -1 : 1)`
                : "1"
            };`
          );
          lines.push(
            `${indent(level)}if (${stepName} === 0) __pseint.fail("For loop step cannot be zero.");`
          );
          lines.push(
            `${indent(level)}for (${counter} = ${startName}; ${stepName} > 0 ? __pseint.toNumber(${counter}) <= ${endName} : __pseint.toNumber(${counter}) >= ${endName}; ${counter} = __pseint.toNumber(${counter}) + ${stepName}) {`
          );
          lines.push(
            ...this.generateExecutableStatements(statement.body, level + 1, scope)
          );
          lines.push(`${indent(level)}}`);
          break;
        }
        case "forEach": {
          // The loop variable is the element's own cell, so writing to it
          // changes the array.
          const cellName = this.nextTemp("element");
          lines.push(
            `${indent(level)}for (const ${cellName} of __runtime_leaves(${expression(
              statement.collection
            )})) {`
          );
          lines.push(
            `${indent(level + 1)}const ${executableCellName(
              statement.variable
            )} = ${cellName};`
          );
          lines.push(
            ...this.generateExecutableStatements(statement.body, level + 1, scope)
          );
          lines.push(`${indent(level)}}`);
          break;
        }
        case "switch": {
          const switchName = this.nextTemp("switchValue");
          lines.push(
            `${indent(level)}const ${switchName} = ${expression(
              statement.expression
            )};`
          );
          lines.push(`${indent(level)}switch (${switchName}) {`);
          for (const switchCase of statement.cases) {
            for (const value of switchCase.values) {
              lines.push(`${indent(level + 1)}case ${expression(value)}:`);
            }
            lines.push(`${indent(level + 1)}{`);
            lines.push(
              ...this.generateExecutableStatements(
                switchCase.body,
                level + 2,
                scope
              )
            );
            lines.push(`${indent(level + 2)}break;`);
            lines.push(`${indent(level + 1)}}`);
          }
          if (statement.defaultCase.length > 0) {
            lines.push(`${indent(level + 1)}default: {`);
            lines.push(
              ...this.generateExecutableStatements(
                statement.defaultCase,
                level + 2,
                scope
              )
            );
            lines.push(`${indent(level + 1)}}`);
          }
          lines.push(`${indent(level)}}`);
          break;
        }
        case "expression":
          lines.push(`${indent(level)}${expression(statement.expression)};`);
          break;
        case "clear":
          lines.push(`${indent(level)}await __runtime.clear();`);
          break;
        case "wait":
          if (statement.mode === "key") {
            lines.push(`${indent(level)}await __runtime.waitForKey();`);
          } else {
            lines.push(
              `${indent(level)}await __runtime.sleep(__pseint.toNumber(${expression(
                statement.durationMs!
              )}));`
            );
          }
          break;
        case "return":
          lines.push(
            `${indent(level)}return ${
              statement.expression ? expression(statement.expression) : "null"
            };`
          );
          break;
      }
    }

    return lines;
  }

  private expectedReadType(target: AssignableExpressionNode): string {
    const name = baseName(target);
    const type = name ? this.types[name.toLowerCase()] : undefined;
    return type ? escapeString(type) : "undefined";
  }

  private generateExecutableReference(
    expression: AssignableExpressionNode,
    scope: Set<string>
  ): string {
    if (expression.kind === "identifier") {
      return executableCellName(expression.name);
    }

    return `__runtime_arrayCell(${this.generateExecutableExpression(
      expression.target,
      scope
    )}, [${expression.indices
      .map((item) => this.generateExecutableExpression(item, scope))
      .join(", ")}])`;
  }

  private generateExecutableExpression(
    expression: ExpressionNode,
    scope: Set<string>
  ): string {
    switch (expression.kind) {
      case "literal":
        return typeof expression.value === "string"
          ? escapeString(expression.value)
          : String(expression.value);
      case "group":
        return `(${this.generateExecutableExpression(
          expression.expression,
          scope
        )})`;
      case "identifier": {
        const routine = this.routines.get(expression.name.toLowerCase());
        if (!scope.has(expression.name.toLowerCase()) && routine) {
          return this.generateExecutableCall(routine, [], scope);
        }
        return `${executableCellName(expression.name)}.value`;
      }
      case "arrayAccess":
        return `${this.generateExecutableReference(expression, scope)}.value`;
      case "call": {
        const routine = this.routines.get(expression.callee.toLowerCase());
        if (routine) {
          return this.generateExecutableCall(routine, expression.args, scope);
        }
        return `__runtime_builtin(${escapeString(
          normalizeIdentifier(expression.callee)
        )}, [${expression.args
          .map((item) => this.generateExecutableExpression(item, scope))
          .join(", ")}])`;
      }
      case "unary":
        return expression.operator === "-"
          ? `(-__pseint.toNumber(${this.generateExecutableExpression(
              expression.operand,
              scope
            )}))`
          : `(!__pseint.toBoolean(${this.generateExecutableExpression(
              expression.operand,
              scope
            )}))`;
      case "binary":
        return this.generateExecutableBinary(expression, scope);
    }
  }

  private generateExecutableCall(
    routine: RoutineNode,
    args: ExpressionNode[],
    scope: Set<string>
  ): string {
    if (args.length !== routine.params.length) {
      return `__pseint.fail(${escapeString(
        `"${routine.name}" espera ${routine.params.length} argumento(s).`
      )})`;
    }

    const renderedArgs = routine.params.map((parameter, index) => {
      const argument = args[index]!;
      if (parameter.byReference) {
        if (argument.kind !== "identifier" && argument.kind !== "arrayAccess") {
          return `__pseint.fail("By-reference parameters require an assignable argument.")`;
        }
        return this.generateExecutableReference(argument, scope);
      }
      const explicit = parameter.explicitByValue ? "true" : "false";
      if (
        argument.kind === "identifier" &&
        scope.has(argument.name.toLowerCase())
      ) {
        return `__runtime_shareArg(${executableCellName(
          argument.name
        )}, ${explicit})`;
      }
      return `__runtime_valueArg(${this.generateExecutableExpression(
        argument,
        scope
      )}, ${explicit})`;
    });

    return `(await ${executableRoutineName(routine.name)}(${renderedArgs.join(
      ", "
    )}))`;
  }

  private generateExecutableBinary(
    expression: ExpressionNode & { kind: "binary" },
    scope: Set<string>
  ): string {
    const left = this.generateExecutableExpression(expression.left, scope);
    const right = this.generateExecutableExpression(expression.right, scope);

    switch (expression.operator) {
      case "+":
        return `__pseint.add(${left}, ${right})`;
      case "-":
        return `(__pseint.toNumber(${left}) - __pseint.toNumber(${right}))`;
      case "*":
        return `(__pseint.toNumber(${left}) * __pseint.toNumber(${right}))`;
      case "/":
        return `__pseint.divide(${left}, ${right})`;
      case "%":
        return `__pseint.modulo(${left}, ${right})`;
      case "^":
        return `Math.pow(__pseint.toNumber(${left}), __pseint.toNumber(${right}))`;
      case "=":
        return `(${left} === ${right})`;
      case "<>":
        return `(${left} !== ${right})`;
      case "<":
      case ">":
      case "<=":
      case ">=":
        return `(__pseint.comparable(${left}) ${expression.operator} __pseint.comparable(${right}))`;
      case "AND":
        return `(__pseint.toBoolean(${left}) && __pseint.toBoolean(${right}))`;
      case "OR":
        return `(__pseint.toBoolean(${left}) || __pseint.toBoolean(${right}))`;
      default:
        return "null";
    }
  }

  private generateStandaloneMain(program: ProgramNode): string[] {
    this.types = program.entry.inferredTypes ?? {};
    return this.generateStandaloneRoutineLike(
      readableRoutineName(program.entry.name),
      [],
      program.entry.body,
      undefined
    );
  }

  private generateStandaloneRoutine(routine: RoutineNode): string[] {
    this.types = routine.inferredTypes ?? {};
    // Only `Funcion r <- nombre(...)` returns a value.
    return this.generateStandaloneRoutineLike(
      readableRoutineName(routine.name),
      routine.params,
      routine.body,
      routine.returnTarget
    );
  }

  private generateStandaloneRoutineLike(
    jsName: string,
    params: RoutineNode["params"],
    body: StatementNode[],
    returnTarget?: string
  ): string[] {
    const locals = collectLocalNames(body, this.routines);
    if (returnTarget) {
      locals.names.set(returnTarget.toLowerCase(), returnTarget);
    }

    this.names = new Map();
    for (const parameter of params) {
      this.names.set(
        parameter.name.toLowerCase(),
        standaloneVariableName(parameter.name)
      );
      locals.names.delete(parameter.name.toLowerCase());
    }
    for (const [key, spelling] of locals.names) {
      this.names.set(key, standaloneVariableName(spelling));
    }

    const lines: string[] = [];
    const renderedParams = params.map((parameter) =>
      parameter.byReference
        ? `${this.names.get(parameter.name.toLowerCase())} /* por referencia */`
        : this.names.get(parameter.name.toLowerCase())
    );
    lines.push(`async function ${jsName}(${renderedParams.join(", ")}) {`);

    for (const parameter of params) {
      if (parameter.explicitByValue) {
        const name = this.names.get(parameter.name.toLowerCase());
        lines.push(`${indent(1)}${name} = pseint.arrayParameter(${name});`);
      }
    }

    // Uninitialized variables hold the default value of their type.
    if (locals.names.size > 0) {
      const declarations = [...locals.names.keys()].map((key) => {
        const name = this.names.get(key)!;
        return locals.arrays.has(key) || !this.types[key]
          ? name
          : `${name} = ${defaultLiteral(this.types[key])}`;
      });
      lines.push(`${indent(1)}let ${declarations.join(", ")};`, "");
    }

    const bodyLines = this.generateStandaloneStatements(body, 1);
    lines.push(...bodyLines);

    if (returnTarget) {
      if (bodyLines.length > 0 && bodyLines[bodyLines.length - 1] !== "") {
        lines.push("");
      }
      lines.push(
        `${indent(1)}return ${this.names.get(returnTarget.toLowerCase())};`
      );
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
            const name = this.standaloneName(item.name);
            const sizes = item.dimensions
              .map((dimension) => this.generateStandaloneExpression(dimension))
              .join(", ");
            const initial = this.types[item.name.toLowerCase()];
            const initialArgument = initial ? `, ${defaultLiteral(initial)}` : "";
            lines.push(
              statement.resize
                ? `${indent(level)}pseint.resize(${name}, [${sizes}]${initialArgument});`
                : `${indent(level)}${name} = pseint.array([${sizes}]${initialArgument});`
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
            const expected = this.expectedReadType(target);
            lines.push(
              `${indent(level)}${this.generateStandaloneReference(
                target
              )} = pseint.read(await runtime.read()${
                expected === "undefined" ? "" : `, ${expected}`
              });`
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
          const variable = this.standaloneName(statement.variable);
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
            `${indent(level)}for (${variable} = ${start}; ${stepName} > 0 ? ${variable} <= ${finalName} : ${variable} >= ${finalName}; ${variable} += ${stepName}) {`
          );
          lines.push(
            ...this.generateStandaloneStatements(statement.body, level + 1)
          );
          lines.push(`${indent(level)}}`);
          break;
        }
        case "forEach": {
          // The loop variable stands for the element itself, so assigning to
          // it changes the array.
          const itemsName = this.nextTemp("items");
          const indexName = this.nextTemp("index");
          const key = statement.variable.toLowerCase();
          const previous = this.names.get(key);
          lines.push(
            `${indent(
              level
            )}for (const [${itemsName}, ${indexName}] of pseint.elements(${this.generateStandaloneExpression(
              statement.collection
            )})) {`
          );
          this.names.set(key, `${itemsName}[${indexName}]`);
          lines.push(
            ...this.generateStandaloneStatements(statement.body, level + 1)
          );
          if (previous) {
            this.names.set(key, previous);
          } else {
            this.names.delete(key);
          }
          lines.push(`${indent(level)}}`);
          break;
        }
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

  private standaloneName(name: string): string {
    return this.names.get(name.toLowerCase()) ?? standaloneVariableName(name);
  }

  /** The static type of an expression, when it is known. */
  private staticType(expression: ExpressionNode): StaticType | undefined {
    switch (expression.kind) {
      case "literal":
        return expression.valueType === "number"
          ? "num"
          : expression.valueType === "string"
          ? "str"
          : expression.valueType === "boolean"
          ? "bool"
          : undefined;
      case "group":
        return this.staticType(expression.expression);
      case "identifier":
      case "arrayAccess": {
        const name = baseName(expression)!;
        return this.routines.has(name.toLowerCase())
          ? undefined
          : this.types[name.toLowerCase()];
      }
      case "call":
        return this.routines.has(expression.callee.toLowerCase())
          ? undefined
          : BUILTIN_SIGNATURES[normalizeIdentifier(expression.callee)]?.returns;
      case "unary":
        return expression.operator === "-" ? "num" : "bool";
      case "binary":
        switch (expression.operator) {
          case "+": {
            const left = this.staticType(expression.left);
            const right = this.staticType(expression.right);
            if (left === "str" || right === "str") return "str";
            return left === "num" && right === "num" ? "num" : undefined;
          }
          case "-":
          case "*":
          case "/":
          case "%":
          case "^":
            return "num";
          default:
            return "bool";
        }
    }
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
    const rendered = this.generateStandaloneExpression(expression);
    return this.staticType(expression) === "str"
      ? rendered
      : `pseint.format(${rendered})`;
  }

  private generateStandaloneReference(
    expression: AssignableExpressionNode
  ): string {
    if (expression.kind === "identifier") {
      return this.standaloneName(expression.name);
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
        const key = expression.name.toLowerCase();
        const routine = this.routines.get(key);
        if (routine && !this.names.has(key)) {
          return `(await ${readableRoutineName(routine.name)}())`;
        }
        return this.standaloneName(expression.name);
      }
      case "arrayAccess":
        return this.generateStandaloneReference(expression);
      case "call": {
        const routine = this.routines.get(expression.callee.toLowerCase());
        if (routine) {
          return `(await ${readableRoutineName(routine.name)}(${expression.args
            .map((arg) => this.generateStandaloneExpression(arg))
            .join(", ")}))`;
        }

        const builtin = this.generateStandaloneBuiltinCall(
          expression.callee,
          expression.args
        );
        if (builtin) {
          return builtin;
        }

        return `${expression.callee}(${expression.args
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
    const normalized = normalizeIdentifier(name);
    const renderedArgs = args.map((arg) =>
      this.generateStandaloneExpression(arg)
    );
    const first = renderedArgs[0] ?? "0";
    const text = (index: number) =>
      args[index] && this.staticType(args[index]!) === "str"
        ? renderedArgs[index]!
        : `pseint.format(${renderedArgs[index] ?? '""'})`;

    if (
      !this.settings.enableStringFunctions &&
      STRING_FUNCTIONS.includes(normalized)
    ) {
      return `pseint.fail(${escapeString(
        `String function "${name}" is disabled in the current profile.`
      )})`;
    }

    switch (normalized) {
      case "ABS":
        return `Math.abs(${first})`;
      case "ACOS":
        return `pseint.acos(${first})`;
      case "ALEATORIO":
        return `pseint.aleatorio(${first}, ${renderedArgs[1] ?? "0"})`;
      case "ASEN":
        return `pseint.asin(${first})`;
      case "ATAN":
        return `Math.atan(${first})`;
      case "AZAR":
        return `pseint.azar(${first})`;
      case "CONCATENAR":
        return renderedArgs.map((_, index) => text(index)).join(" + ") || '""';
      case "CONVERTIRANUMERO":
        return `pseint.textToNumber(${renderedArgs[0] ?? '""'})`;
      case "CONVERTIRATEXTO":
        return `pseint.format(${renderedArgs[0] ?? '""'})`;
      case "COS":
        return `Math.cos(${first})`;
      case "EULER":
        return "Math.E";
      case "EXP":
        return `Math.exp(${first})`;
      case "FECHAACTUAL":
        return "pseint.currentDate()";
      case "HORAACTUAL":
        return "pseint.currentTime()";
      case "LN":
        return `pseint.ln(${first})`;
      case "LONGITUD":
        return `${text(0)}.length`;
      case "MAYUSCULAS":
        return `${text(0)}.toUpperCase()`;
      case "MINUSCULAS":
        return `${text(0)}.toLowerCase()`;
      case "PI":
        return "Math.PI";
      case "RAIZ":
      case "RC":
        return `pseint.sqrt(${first})`;
      case "REDON":
        return `pseint.round(${first})`;
      case "SEN":
        return `Math.sin(${first})`;
      case "SUBCADENA": {
        const start =
          renderedArgs[1] ?? (this.settings.baseZeroArrays ? "0" : "1");
        return `pseint.substring(${renderedArgs[0] ?? '""'}, ${start}, ${
          renderedArgs[2] ?? start
        })`;
      }
      case "TAN":
        return `Math.tan(${first})`;
      case "TRUNC":
        return `pseint.trunc(${first})`;
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
      case "+": {
        // Plain + is only safe when both sides are numbers or both are text.
        const leftType = this.staticType(expression.left);
        const rightType = this.staticType(expression.right);
        return leftType && leftType === rightType && leftType !== "bool"
          ? `(${left} + ${right})`
          : `pseint.add(${left}, ${right})`;
      }
      case "-":
        return `(${left} - ${right})`;
      case "*":
        return `(${left} * ${right})`;
      case "/":
        return `pseint.divide(${left}, ${right})`;
      case "%":
        return `pseint.modulo(${left}, ${right})`;
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
    const onRuntimeError =
      target === "node"
        ? ["    console.error(`Error: ${error.message}`);", "    process.exitCode = 1;"]
        : ["    console.error(`Error: ${error.message}`);"];
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
      "  } catch (error) {",
      "    if (!(error instanceof pseint.RuntimeError)) {",
      "      throw error;",
      "    }",
      "    await runtime.flush();",
      ...onRuntimeError,
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
