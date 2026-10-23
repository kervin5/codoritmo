// Every diagnostic the engine produces, keyed by its stable code. The engine
// stays UI-agnostic: a Diagnostic carries `code` and `params`, plus `message`
// filled from these English templates as a fallback. The UI looks the code up
// in its dictionary (`engineMessages`) to show the student's language.
//
// Placeholders are `{name}`. Params whose key ends in "Type" hold a
// StaticType ("num", "str", "bool") and are translated through the type
// names table.

import type { StaticType } from "./types";

export const engineMessageTemplates = {
  // Program structure
  PARSE_DUPLICATE_ENTRY: "Only one Proceso or Algoritmo is allowed per program.",
  PARSE_USER_ROUTINES_DISABLED: "SubProceso and Funcion are disabled in the current profile.",
  PARSE_DUPLICATE_ROUTINE: 'The routine "{name}" is already defined.',
  PARSE_TOP_LEVEL: 'Unexpected "{token}": instructions must go inside a Proceso or Algoritmo.',
  PARSE_MISSING_ENTRY: "The program needs a Proceso or Algoritmo.",
  PARSE_MISSING_ENTRY_NAME: "Missing the name after {keyword}.",
  PARSE_MISSING_ROUTINE_NAME: "Missing the routine name after {keyword}.",
  PARSE_MISSING_ROUTINE_NAME_AFTER_RETURN: "Missing the routine name after the return variable.",
  PARSE_MISSING_PARAMS_RPAREN: 'Missing ")" to close the parameter list.',
  PARSE_MISSING_PARAM_NAME: "Missing a parameter name.",
  PARSE_PARAM_PASSING_MODE: "Por must be followed by Referencia, Valor or Copia.",
  PARSE_MISSING_CLOSER: "Missing {closer} to close {opener}.",
  PARSE_MISPLACED_KEYWORD: '"{token}" cannot go here.',
  PARSE_MISSING_SEMICOLON: 'Missing ";" at the end of the instruction.',
  PARSE_TRAILING_TOKENS: 'Unexpected "{token}" after the instruction.',
  PARSE_TRAILING_TOKENS_HEADER: 'Unexpected "{token}" after the header.',
  PARSE_INVALID_INSTRUCTION: '"{token}" is not a valid instruction.',
  PARSE_IDENTIFIER_ACCENTS_DISABLED: "Names with accents are disabled in the current profile.",

  // Definir and Dimension
  PARSE_DEFINE_MISSING_NAME: "Missing a variable name after Definir.",
  PARSE_DEFINE_MISSING_NAME_AFTER_COMMA: 'Missing a variable name after ",".',
  PARSE_DEFINE_MISSING_COMO: "Missing Como after the variable names.",
  PARSE_DEFINE_MISSING_TYPE: "Missing a data type after Como (Entero, Real, Caracter or Logico).",
  PARSE_RESIZE_DISABLED: "Redimensionar is disabled in the current profile.",
  PARSE_DIMENSION_MISSING_NAME: "Missing the array name after {keyword}.",
  PARSE_DIMENSION_MISSING_LBRACKET: 'Missing "[" after the array name.',
  PARSE_DIMENSION_MISSING_CLOSE: 'Missing "{bracket}" after the dimensions.',
  PARSE_DYNAMIC_DIMENSION_DISABLED: "Array sizes must be fixed numbers in the current profile.",
  PARSE_DIMENSION_NOT_INTEGER: "Array sizes must be whole numbers.",
  PARSE_DIMENSION_NOT_POSITIVE: "Array sizes must be greater than zero.",

  // Instructions
  PARSE_WRITE_EMPTY: "{keyword} needs at least one value to show.",
  PARSE_READ_EMPTY: "{keyword} needs at least one variable.",
  PARSE_MISSING_CONDITION: "Missing a condition after {keyword}.",
  PARSE_MISSING_ENTONCES: "Missing Entonces after the condition.",
  PARSE_MISSING_HACER_WHILE: "Missing Hacer after the Mientras condition.",
  PARSE_REPEAT_WHILE_DISABLED: "Repetir ... Mientras Que is disabled in the current profile.",
  PARSE_FOR_EACH_DISABLED: "Para Cada is disabled in the current profile.",
  PARSE_FOR_EACH_MISSING_VARIABLE: "Missing the variable after Para Cada.",
  PARSE_FOR_EACH_MISSING_DE: "Missing De after the Para Cada variable.",
  PARSE_FOR_EACH_MISSING_HACER: "Missing Hacer after the Para Cada array.",
  PARSE_FOR_MISSING_VARIABLE: "Missing the counter variable after Para.",
  PARSE_EQUAL_ASSIGNMENT_DISABLED: 'Assigning with "=" is disabled in the current profile; use "<-".',
  PARSE_FOR_LAZY_SYNTAX_DISABLED: 'Missing "<-" after the Para counter.',
  PARSE_FOR_STEP_ORDER_DISABLED: "Con Paso must come after Hasta in the current profile.",
  PARSE_FOR_MISSING_START: 'Missing "<-" and the start value after the Para counter.',
  PARSE_FOR_MISSING_HASTA: "Missing Hasta in the Para loop.",
  PARSE_FOR_MISSING_HACER: "Missing Hacer at the end of the Para line.",
  PARSE_FOR_STEP: "Missing the step value after Con Paso.",
  PARSE_SWITCH_MISSING_EXPRESSION: "Missing the value to compare after Segun.",
  PARSE_SWITCH_MISSING_HACER: "Missing Hacer after the Segun value.",
  PARSE_SWITCH_INTEGER_ONLY_CONTROL: "Segun only accepts numeric values in the current profile.",
  PARSE_SWITCH_INTEGER_ONLY: "Segun options must be numbers in the current profile.",
  PARSE_SWITCH_DEFAULT_COLON: 'Missing ":" after De Otro Modo.',
  PARSE_SWITCH_CASE_COLON: 'Missing ":" after the option value.',
  PARSE_CLEAR_MISSING_PANTALLA: "Missing Pantalla after {keyword}.",
  PARSE_WAIT_MISSING_TECLA: "Missing Tecla after Esperar Una.",
  PARSE_WAIT_MISSING_DURATION: "Esperar needs a duration or Tecla.",
  PARSE_WAIT_UNIT: "Missing the time unit after Esperar (Segundos or Milisegundos).",
  PARSE_ASSIGNMENT_MISSING_VALUE: "Missing the value to assign.",

  // Expressions
  PARSE_DIVISIBLE_MISSING_POR: "Missing Por after Es Divisible.",
  PARSE_MULTIPLE_MISSING_DE: "Missing De after Es Multiplo.",
  PARSE_GREATER_MISSING_IGUAL: "Missing Igual after Mayor O.",
  PARSE_LESS_MISSING_IGUAL: "Missing Igual after Menor O.",
  PARSE_CONSECUTIVE_OPERATORS: "There are two operators in a row.",
  PARSE_CALL_MISSING_RPAREN: 'Missing ")" to close the argument list.',
  PARSE_ARRAY_INDEX: "Missing the array index.",
  PARSE_INDEX_MISSING_RBRACKET: 'Missing "]" after the array index.',
  PARSE_GROUP_MISSING_RPAREN: 'Missing ")" to close the parenthesis.',
  PARSE_EXPRESSION: "Missing an expression.",
  PARSE_UNEXPECTED_TOKEN: 'Unexpected "{token}" in the expression.',
  PARSE_ASSIGNABLE: "Expected a variable or array element here.",

  // Type checks before running
  PARSE_NAME_IS_ROUTINE: '"{name}" is the name of a routine and cannot be used as a variable.',
  PARSE_DIMENSION_TYPE: "Array sizes must be numeric.",
  PARSE_INDEX_TYPE: "Array indices must be numeric.",
  PARSE_TYPE_MISMATCH: 'Type mismatch: cannot assign a {valueType} value to "{name}" ({targetType}).',
  PARSE_FOR_COUNTER_TYPE: "The Para counter must be numeric.",
  PARSE_FOR_START_TYPE: "The Para start value must be numeric.",
  PARSE_FOR_END_TYPE: "The Para end value must be numeric.",
  PARSE_FOR_STEP_TYPE: "The Para step must be numeric.",
  PARSE_WAIT_DURATION_TYPE: "The Esperar duration must be numeric.",
  PARSE_CONDITION_NOT_LOGICAL: "The condition of {construct} must be true or false (a logical expression).",
  PARSE_MISSING_ARGUMENTS: 'The routine "{name}" needs arguments.',
  PARSE_ARGUMENT_COUNT: '"{name}" expects {count} argument(s).',
  PARSE_BY_REFERENCE_ARGUMENT: 'The argument for "{name}" is passed by reference, so it must be a variable.',
  PARSE_ARRAY_ARGUMENT: 'The function "{name}" cannot receive a whole array.',
  PARSE_ARGUMENT_TYPE: 'Wrong argument type for "{name}".',
  PARSE_NOT_OPERAND: "NO only applies to logical values.",
  PARSE_SIGN_OPERAND: "The sign only applies to numbers.",
  PARSE_NO_RETURN_VALUE: 'The routine "{name}" does not return a value.',
  PARSE_LOGICAL_OPERAND: "Y and O only apply to logical values.",
  PARSE_ARITHMETIC_OPERAND: "The operator {operator} only applies to numbers.",
  PARSE_PLUS_LOGICAL: "The operator + does not apply to logical values.",
  PARSE_PLUS_MIXED_TYPES: "Both sides of + must have the same type.",

  // While running
  RUNTIME_STEP_LIMIT: "Execution stopped after {steps} steps. The program may contain an infinite loop.",
  RUNTIME_CONDITION_NOT_LOGICAL: "The condition must be true or false (a logical expression).",
  RUNTIME_ALREADY_DEFINED: 'The variable "{name}" was already defined or was used before Definir.',
  RUNTIME_DIMENSION_TYPE: "Array sizes must be numeric.",
  RUNTIME_DIMENSION_NOT_INTEGER: "Array sizes must be whole numbers.",
  RUNTIME_DIMENSION_NOT_POSITIVE: "Array sizes must be greater than zero.",
  RUNTIME_ARRAY_REDIMENSIONED: 'The array "{name}" was already dimensioned.',
  RUNTIME_ARRAY_ASSIGNMENT: "A whole array cannot be assigned at once.",
  RUNTIME_TYPE_MISMATCH: "Type mismatch.",
  RUNTIME_TYPE_INTEGER: "Type mismatch: the value to assign must be a whole number.",
  RUNTIME_ARRAY_MISSING_INDEX: "Missing indices for the array.",
  RUNTIME_ARRAY_MISSING_INDEX_NAMED: 'Missing indices for the array "{name}".',
  RUNTIME_FOR_STEP: "The Para step cannot be zero.",
  RUNTIME_FOR_EACH: "Para Cada needs an array.",
  RUNTIME_SWITCH_TYPE: "The Segun value must be a number or text.",
  RUNTIME_SWITCH_CASE_TYPE: "The option value does not match the type of the Segun value.",
  RUNTIME_SWITCH_INTEGER_ONLY: "Segun only accepts whole numbers in the current profile.",
  RUNTIME_SWITCH_INTEGER_ONLY_CASE: "Segun options must be whole numbers in the current profile.",
  RUNTIME_NO_INPUT: "No input available.",
  RUNTIME_NO_INPUT_DETAIL: "No input available ({detail}).",
  RUNTIME_INPUT_TYPE: 'Type mismatch: the value entered does not fit "{name}".',
  RUNTIME_INPUT_INTEGER: 'Type mismatch: "{name}" needs a whole number.',
  RUNTIME_ARRAY_TARGET: '"{name}" is not an array.',
  RUNTIME_RESIZE_DIMENSIONS: "The number of dimensions of an array cannot change.",
  RUNTIME_MISSING_ARGUMENTS: 'Missing arguments for "{name}".',
  RUNTIME_ARGUMENT_COUNT: '"{name}" expects {count} argument(s).',
  RUNTIME_CONCAT_DISABLED: 'Joining text with "+" is disabled in the current profile.',
  RUNTIME_DIVISION_BY_ZERO: "Division by zero.",
  RUNTIME_PROTECTED_COUNTER: 'The Para counter "{name}" cannot be changed inside its loop.',
  RUNTIME_DEFINE_REQUIRED: 'The variable "{name}" must be declared with Definir before you assign or read into it.',
  RUNTIME_DEFINE_REQUIRED_READ: 'The variable "{name}" must be declared with Definir before you use it.',
  RUNTIME_UNINITIALIZED: 'The variable "{name}" has no value yet.',
  RUNTIME_ELEMENT_DEFINE_REQUIRED: "Array elements must have a type from Definir before you assign or read into them.",
  RUNTIME_ELEMENT_DEFINE_REQUIRED_READ: "Array elements must have a type from Definir before you use them.",
  RUNTIME_ELEMENT_UNINITIALIZED: "This array element has no value yet.",
  RUNTIME_ARRAY_DIMENSION: "The number of indices does not match the dimensions of the array.",
  RUNTIME_ARRAY_NESTED_DIMENSION: "Missing an index for one of the array dimensions.",
  RUNTIME_ARRAY_INDEX: "Array indices must be whole numbers.",
  RUNTIME_ARRAY_BOUNDS: "Array index out of range.",
  RUNTIME_ARRAY_ELEMENT: "Expected an array element.",
  RUNTIME_ARRAY_NESTED_ELEMENT: "Expected an array element, not a whole row of the array.",
  RUNTIME_NO_RETURN_VALUE: '"{name}" does not return a value.',
  RUNTIME_BY_REF: "A parameter passed by reference needs a variable as its argument.",
  RUNTIME_ARRAY_BY_VALUE: "Arrays can only be passed by reference.",
  RUNTIME_STRING_FUNCTION_DISABLED: 'The text function "{name}" is disabled in the current profile.',
  RUNTIME_DOMAIN_ACOS: "Invalid argument for ACOS (it must be between -1 and 1).",
  RUNTIME_DOMAIN_ASEN: "Invalid argument for ASEN (it must be between -1 and 1).",
  RUNTIME_DOMAIN_AZAR: "AZAR needs a number greater than zero.",
  RUNTIME_DOMAIN_LN: "Logarithm of zero or a negative number.",
  RUNTIME_DOMAIN_RC: "Square root of a negative number.",
  RUNTIME_CONVERSION: 'Cannot convert "{text}" to a number.',
  RUNTIME_FUNCTION: 'Unknown function "{name}".',
  RUNTIME_INTERNAL: "Internal error: {detail}",
  RUNTIME_WORKER_FAILED: "The interpreter stopped unexpectedly.",

  // Evaluar (expressions typed while the program is paused)
  EVAL_UNKNOWN_VARIABLE: 'There is no variable "{name}" at this step.',
  EVAL_READS_INPUT: '"{name}" asks for input with Leer, so it cannot be evaluated here.',
  EVAL_TOO_LONG: "The calculation took more than {steps} steps, so it was stopped.",

  // Code export
  EXPORT_FOREACH: 'Para Cada needs an array variable to be exported ({name}).',
  EXPORT_RESIZE_DIMENSIONS: "Redimensionar can only be exported for arrays of one or two dimensions ({name}).",
  EXPORT_RESIZE_PARAMETER: "Redimensionar on a parameter does not resize the caller's array in the exported code ({name}).",
} as const satisfies Record<string, string>;

export type EngineMessageCode = keyof typeof engineMessageTemplates;

export const engineTypeNames: Record<StaticType, string> = {
  num: "numeric",
  str: "text",
  bool: "logical",
};

export type DiagnosticParams = Record<string, number | string>;

/** Fills a template, translating `*Type` params through `typeNames`. */
export function fillEngineMessage(
  template: string,
  params: DiagnosticParams | undefined,
  typeNames: Record<StaticType, string>,
): string {
  return Object.entries(params ?? {}).reduce((result, [key, value]) => {
    const text = key.endsWith("Type") ? typeNames[value as StaticType] ?? String(value) : String(value);
    return result.replaceAll(`{${key}}`, text);
  }, template);
}

/** The English fallback text the engine stores in `Diagnostic.message`. */
export function engineMessage(code: EngineMessageCode, params?: DiagnosticParams): string {
  return fillEngineMessage(engineMessageTemplates[code], params, engineTypeNames);
}
