export type DiagnosticSeverity = "error" | "warning";

// Single source of truth for PSeInt data types
export const DataType = {
  ENTERO: "ENTERO",
  NUMERICO: "NUMERICO",
  REAL: "REAL",
  LOGICO: "LOGICO",
  CADENA: "CADENA",
  CARACTER: "CARACTER",
  TEXTO: "TEXTO",
} as const;

// Type derived from the DataType object
export type DataType = (typeof DataType)[keyof typeof DataType];

// Type categories for type compatibility checking
export type TypeCategory = "NUMERICO" | "LOGICO" | "TEXTO" | "UNKNOWN";

// Mapping from DataType to its category
export const TYPE_CATEGORIES: Record<DataType, TypeCategory> = {
  [DataType.ENTERO]: "NUMERICO",
  [DataType.NUMERICO]: "NUMERICO",
  [DataType.REAL]: "NUMERICO",
  [DataType.LOGICO]: "LOGICO",
  [DataType.CADENA]: "TEXTO",
  [DataType.CARACTER]: "TEXTO",
  [DataType.TEXTO]: "TEXTO",
};

// Check if a type is numeric
export function isNumericType(type: DataType | string | undefined): boolean {
  if (!type) return false;
  const normalized = type.toUpperCase();
  return (
    normalized === DataType.ENTERO ||
    normalized === DataType.NUMERICO ||
    normalized === DataType.REAL
  );
}

// Check if a type is text/string
export function isTextType(type: DataType | string): boolean {
  const normalized = type.toUpperCase() as DataType;
  return (
    normalized === DataType.CADENA ||
    normalized === DataType.CARACTER ||
    normalized === DataType.TEXTO
  );
}

// Check if a type is logical/boolean
export function isLogicalType(type: DataType | string): boolean {
  const normalized = type.toUpperCase() as DataType;
  return normalized === DataType.LOGICO;
}

// Check if a type is integer (ENTERO or NUMERICO, not REAL)
export function isIntegerType(type: DataType | string | undefined): boolean {
  if (!type) return false;
  const normalized = type.toUpperCase();
  return normalized === DataType.ENTERO || normalized === DataType.NUMERICO;
}

// Normalize a data type string to a DataType, or return null if invalid
export function normalizeDataType(type: string | undefined): DataType | null {
  if (!type) return null;
  const normalized = type
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase();

  // Check if it's a valid DataType by checking against our enum
  if (Object.values(DataType).includes(normalized as DataType)) {
    return normalized as DataType;
  }

  return null;
}

// Get the category of a type
export function getTypeCategory(
  type: DataType | string | undefined
): TypeCategory {
  if (!type) return "UNKNOWN";
  const normalized = type.toUpperCase() as DataType;
  return TYPE_CATEGORIES[normalized] ?? "UNKNOWN";
}

// Check if two types are compatible for assignment
export function typesCompatible(
  declaredType: DataType | string | undefined,
  valueType: DataType | string | undefined
): boolean {
  // If declared type is unknown/undefined, allow any value (dynamic typing)
  if (!declaredType) {
    return true;
  }

  // If value type is unknown, allow it
  if (!valueType) {
    return true;
  }

  const declaredCategory = getTypeCategory(declaredType);
  const valueCategory = getTypeCategory(valueType);

  // If either is unknown, allow it (dynamic typing)
  if (declaredCategory === "UNKNOWN" || valueCategory === "UNKNOWN") {
    return true;
  }

  // Same category is always compatible
  if (declaredCategory === valueCategory) {
    return true;
  }

  // NUMERICO can accept any numeric type
  if (declaredCategory === "NUMERICO" && valueCategory === "NUMERICO") {
    return true;
  }

  return false;
}

export interface SourcePosition {
  offset: number;
  line: number;
  column: number;
}

export interface SourceSpan {
  start: SourcePosition;
  end: SourcePosition;
}

export interface Diagnostic {
  message: string;
  line: number;
  column: number;
  severity: DiagnosticSeverity;
  code?: string;
}

export const TokenKind = {
  WORD: "word",
  NUMBER: "number",
  STRING: "string",
  INVALID: "invalid",
  ARROW: "arrow",
  PLUS: "plus",
  MINUS: "minus",
  STAR: "star",
  SLASH: "slash",
  MOD: "mod",
  POWER: "power",
  LT: "lt",
  GT: "gt",
  EQ: "eq",
  NEQ: "neq",
  LEQ: "leq",
  GEQ: "geq",
  AND: "and",
  OR: "or",
  NOT: "not",
  LPAREN: "lparen",
  RPAREN: "rparen",
  LBRACKET: "lbracket",
  RBRACKET: "rbracket",
  COMMA: "comma",
  SEMICOLON: "semicolon",
  COLON: "colon",
  EOF: "eof",
} as const;

export type TokenKind = (typeof TokenKind)[keyof typeof TokenKind];

export interface Token {
  kind: TokenKind;
  lexeme: string;
  normalized: string;
  line: number;
  column: number;
  offset: number;
}

export interface ParameterNode {
  name: string;
  byReference: boolean;
  span?: SourceSpan;
}

export interface MainRoutineNode {
  type: "MainRoutine";
  headerKind: "Proceso" | "Algoritmo";
  name: string;
  body: StatementNode[];
  span?: SourceSpan;
}

export interface RoutineNode {
  type: "Routine";
  headerKind: "SubProceso" | "SubAlgoritmo" | "Funcion";
  name: string;
  returnTarget?: string;
  params: ParameterNode[];
  body: StatementNode[];
  span?: SourceSpan;
}

export interface ProgramNode {
  type: "Program";
  entry: MainRoutineNode;
  routines: RoutineNode[];
  span?: SourceSpan;
}

export interface DefineStatementNode {
  kind: "define";
  dataType: string;
  names: string[];
  span?: SourceSpan;
}

export interface DimensionItemNode {
  name: string;
  dimensions: ExpressionNode[];
  span?: SourceSpan;
}

export interface DimensionStatementNode {
  kind: "dimension";
  items: DimensionItemNode[];
  span?: SourceSpan;
}

export interface AssignmentStatementNode {
  kind: "assignment";
  target: AssignableExpressionNode;
  value: ExpressionNode;
  span?: SourceSpan;
}

export interface WriteStatementNode {
  kind: "write";
  expressions: ExpressionNode[];
  newline: boolean;
  span?: SourceSpan;
}

export interface ReadStatementNode {
  kind: "read";
  targets: AssignableExpressionNode[];
  span?: SourceSpan;
}

export interface IfStatementNode {
  kind: "if";
  condition: ExpressionNode;
  thenBranch: StatementNode[];
  elseBranch: StatementNode[];
  span?: SourceSpan;
}

export interface WhileStatementNode {
  kind: "while";
  condition: ExpressionNode;
  body: StatementNode[];
  span?: SourceSpan;
}

export interface RepeatStatementNode {
  kind: "repeat";
  mode: "until" | "while";
  condition: ExpressionNode;
  body: StatementNode[];
  span?: SourceSpan;
}

export interface ForStatementNode {
  kind: "for";
  variable: string;
  start: ExpressionNode;
  end: ExpressionNode;
  step?: ExpressionNode;
  body: StatementNode[];
  span?: SourceSpan;
}

export interface ForEachStatementNode {
  kind: "forEach";
  variable: string;
  collection: ExpressionNode;
  body: StatementNode[];
  span?: SourceSpan;
}

export interface SwitchCaseNode {
  values: ExpressionNode[];
  body: StatementNode[];
  span?: SourceSpan;
}

export interface SwitchStatementNode {
  kind: "switch";
  expression: ExpressionNode;
  cases: SwitchCaseNode[];
  defaultCase: StatementNode[];
  span?: SourceSpan;
}

export interface ExpressionStatementNode {
  kind: "expression";
  expression: ExpressionNode;
  span?: SourceSpan;
}

export interface ClearStatementNode {
  kind: "clear";
  span?: SourceSpan;
}

export interface WaitStatementNode {
  kind: "wait";
  mode: "key" | "time";
  durationMs?: ExpressionNode;
  span?: SourceSpan;
}

export interface ReturnStatementNode {
  kind: "return";
  expression?: ExpressionNode;
  span?: SourceSpan;
}

export type StatementNode =
  | AssignmentStatementNode
  | ClearStatementNode
  | DefineStatementNode
  | DimensionStatementNode
  | ExpressionStatementNode
  | ForEachStatementNode
  | ForStatementNode
  | IfStatementNode
  | ReadStatementNode
  | RepeatStatementNode
  | ReturnStatementNode
  | SwitchStatementNode
  | WaitStatementNode
  | WhileStatementNode
  | WriteStatementNode;

export interface LiteralExpressionNode {
  kind: "literal";
  value: number | string | boolean;
  valueType: "number" | "string" | "boolean";
  span?: SourceSpan;
}

export interface IdentifierExpressionNode {
  kind: "identifier";
  name: string;
  span?: SourceSpan;
}

export interface ArrayAccessExpressionNode {
  kind: "arrayAccess";
  target: ExpressionNode;
  indices: ExpressionNode[];
  span?: SourceSpan;
}

export interface CallExpressionNode {
  kind: "call";
  callee: string;
  args: ExpressionNode[];
  span?: SourceSpan;
}

export interface BinaryExpressionNode {
  kind: "binary";
  operator: string;
  left: ExpressionNode;
  right: ExpressionNode;
  span?: SourceSpan;
}

export interface UnaryExpressionNode {
  kind: "unary";
  operator: string;
  operand: ExpressionNode;
  span?: SourceSpan;
}

export interface GroupExpressionNode {
  kind: "group";
  expression: ExpressionNode;
  span?: SourceSpan;
}

export type ExpressionNode =
  | ArrayAccessExpressionNode
  | BinaryExpressionNode
  | CallExpressionNode
  | GroupExpressionNode
  | IdentifierExpressionNode
  | LiteralExpressionNode
  | UnaryExpressionNode;

export type AssignableExpressionNode =
  | ArrayAccessExpressionNode
  | IdentifierExpressionNode;

export interface ParseResult {
  program: ProgramNode | null;
  diagnostics: Diagnostic[];
}

export type ExecutionState = "ok" | "parse_error" | "runtime_error" | "paused";

export interface ExecutionResult {
  output: string[];
  diagnostics: Diagnostic[];
  state: ExecutionState;
}

export interface GenerationResult {
  code: string | null;
  diagnostics: Diagnostic[];
}

export type JavaScriptExportTarget = "browser" | "node";

export interface EngineSettings {
  forceDefineVars: boolean;
  forceInitVars: boolean;
  baseZeroArrays: boolean;
  allowConcatenation: boolean;
  allowDynamicDimensions: boolean;
  overloadEqual: boolean;
  colloquialConditions: boolean;
  lazySyntax: boolean;
  wordOperators: boolean;
  enableUserFunctions: boolean;
  enableStringFunctions: boolean;
  integerOnlySwitch: boolean;
  deduceNegativeForStep: boolean;
  allowAccents: boolean;
  allowRepeatWhile: boolean;
  allowForEach: boolean;
  protectForCounter: boolean;
}

export type SettingSupportStatus =
  | "implemented"
  | "partial"
  | "not_applicable"
  | "missing";

export interface EngineSettingDefinition {
  key?: keyof EngineSettings;
  upstreamName: string;
  label: string;
  description: string;
  scope: "editor" | "generator" | "parser" | "runtime";
  status: SettingSupportStatus;
}

export interface EngineProfile {
  id: string;
  label: string;
  description: string;
  settings: EngineSettings;
}

export interface FixtureArgumentParseResult {
  input: string[];
  settings: Partial<EngineSettings>;
  unsupported: string[];
}

export interface Runtime {
  write(value: string, newline?: boolean): void | Promise<void>;
  read(): string | Promise<string>;
  clear(): void | Promise<void>;
  sleep(ms: number): Promise<void>;
  waitForKey(): Promise<void>;
}

export interface BrowserRuntimeOptions {
  input?: string[];
  onAwaitingInputChange?: (awaiting: boolean) => void;
  onOutput?: (output: string[]) => void;
  onAwaitingKeyChange?: (awaiting: boolean) => void;
  random?: () => number;
}

export interface BrowserRuntimeController {
  runtime: Runtime;
  continueKey(): void;
  getOutput(): string[];
  isAwaitingInput(): boolean;
  isAwaitingKey(): boolean;
  reset(input?: string[]): void;
  submitInput(value: string): void;
}

export interface ExampleProgram {
  id: string;
  label: string;
  description: string;
  input?: string;
  profileId?: string;
  settings?: Partial<EngineSettings>;
  source: string;
}

export interface FixtureManifestEntry {
  id: string;
  file: string;
  expectation: "success" | "parse_error" | "runtime_error";
  input?: string[];
  profileId?: string;
  settings?: Partial<EngineSettings>;
}
