// PROTOTYPE — Scratch-style blocks for PSeInt (Blockly). Block text keeps the
// PSeInt keywords in Spanish so students see the same words as in the code;
// only the palette's category names follow the UI language.

import * as Blockly from "blockly/core";

/**
 * Deep, slightly desaturated tones that sit on the dark editor (#141719) and
 * echo the code editor's syntax colours, so a block and the word it writes
 * read as the same thing. Every tone keeps white block text above 4.5:1
 * (WCAG AA); zelos draws shadow blocks 15% darker, which only raises it.
 */
export const COLORS = {
  /** Algoritmo … FinAlgoritmo: a calm frame so the blocks inside stand out. 8.0:1 */
  program: "#34574D",
  /** Escribir / Leer: types blue #9CC4E4. 5.5:1 */
  io: "#3A6E96",
  /** Definir / <- / variables: strings amber #E8BE8C. 5.0:1 */
  variables: "#93662C",
  /** Si / Mientras / Para: keyword mint #8FD9B6. 5.2:1 */
  control: "#2F7A62",
  /** Numbers, comparisons, logic: operators sage #9AA6A1. 5.0:1 */
  operators: "#557A3E",
  /** Text and functions: numbers violet #D2B3F2. 5.8:1 */
  text: "#7357A3",
  /** Arrays: a muted rose. 5.9:1 */
  arrays: "#9A4B65",
  /** Screen and timing: slate violet. 6.3:1 */
  screen: "#5C5B90",
  /** Code kept as text: neutral slate. 7.0:1 */
  raw: "#4F5B61",
};

const TYPES = [
  ["Entero", "Entero"],
  ["Real", "Real"],
  ["Caracter", "Caracter"],
  ["Logico", "Logico"],
];

const FUNCTIONS = [
  ["Raiz", "Raiz"],
  ["Abs", "Abs"],
  ["Trunc", "Trunc"],
  ["Redon", "Redon"],
  ["Azar", "Azar"],
  ["Longitud", "Longitud"],
  ["Mayusculas", "Mayusculas"],
  ["Minusculas", "Minusculas"],
  ["ConvertirANumero", "ConvertirANumero"],
  ["ConvertirATexto", "ConvertirATexto"],
  ["Sen", "Sen"],
  ["Cos", "Cos"],
  ["Ln", "Ln"],
  ["Exp", "Exp"],
];

const FUNCTIONS2 = [
  ["Aleatorio", "Aleatorio"],
  ["Concatenar", "Concatenar"],
];

/**
 * Code kept as text (ps_raw, ps_raw_top). Blockly core no longer ships
 * field_multilinetext (it moved to @blockly/field-multilineinput), so this
 * stand-in keeps line breaks in the value and shows them as ⏎ on one line,
 * both on the block and in the editor.
 */
const LINE_BREAK = " ⏎ ";

class FieldCode extends Blockly.FieldTextInput {
  constructor(value?: string, validator?: Blockly.FieldTextInputValidator, config?: Blockly.FieldTextInputConfig) {
    super(value, validator, config);
    this.maxDisplayLength = 60;
  }

  protected override getText_(): string {
    return String(this.getValue() ?? "").replace(/\n/g, LINE_BREAK);
  }

  protected override getEditorText_(value: unknown): string {
    return String(value ?? "").replace(/\n/g, LINE_BREAK);
  }

  protected override getValueFromEditorText_(text: string): string {
    return text.replace(/ ?⏎ ?/g, "\n");
  }
}

let defined = false;

export function defineBlocks(): void {
  if (defined) return;
  defined = true;
  if (!Blockly.registry.hasItem(Blockly.registry.Type.FIELD, "field_multilinetext")) {
    Blockly.fieldRegistry.register("field_multilinetext", FieldCode);
  }
  Blockly.common.defineBlocksWithJsonArray([
    /* ---------- program ---------- */
    {
      type: "ps_algoritmo",
      message0: "Algoritmo %1",
      args0: [{ type: "field_input", name: "NAME", text: "MiAlgoritmo" }],
      message1: "%1",
      args1: [{ type: "input_statement", name: "BODY" }],
      message2: "FinAlgoritmo",
      colour: COLORS.program,
      tooltip: "Aquí empieza y termina tu algoritmo.",
    },
    {
      type: "ps_raw_top",
      message0: "código %1",
      args0: [{ type: "field_multilinetext", name: "CODE", text: "" }],
      colour: COLORS.raw,
      tooltip: "Código que todavía no tiene bloque propio (por ejemplo un SubProceso). Se conserva tal cual.",
    },
    /* ---------- input / output ---------- */
    {
      type: "ps_escribir",
      message0: "Escribir %1 %2",
      args0: [
        { type: "input_value", name: "VALUE" },
        { type: "field_dropdown", name: "NEWLINE", options: [["↵", "TRUE"], ["sin saltar", "FALSE"]] },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: COLORS.io,
      tooltip: "Muestra un mensaje o un valor en la consola.",
    },
    {
      type: "ps_leer",
      message0: "Leer %1",
      args0: [{ type: "input_value", name: "TARGET" }],
      previousStatement: null,
      nextStatement: null,
      colour: COLORS.io,
      tooltip: "Pide un dato y lo guarda en una variable.",
    },
    /* ---------- variables ---------- */
    {
      type: "ps_definir",
      message0: "Definir %1 Como %2",
      args0: [
        { type: "field_input", name: "NAMES", text: "x" },
        { type: "field_dropdown", name: "TYPE", options: TYPES },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: COLORS.variables,
      tooltip: "Crea una o más variables (separadas por coma) de un tipo.",
    },
    {
      type: "ps_asignar",
      message0: "%1 <- %2",
      args0: [
        { type: "input_value", name: "TARGET" },
        { type: "input_value", name: "VALUE" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: COLORS.variables,
      tooltip: "Guarda un valor en una variable.",
    },
    {
      type: "ps_variable",
      message0: "%1",
      args0: [{ type: "field_input", name: "NAME", text: "x" }],
      output: null,
      colour: COLORS.variables,
      tooltip: "Una variable.",
    },
    /* ---------- control ---------- */
    {
      type: "ps_si",
      message0: "Si %1 Entonces",
      args0: [{ type: "input_value", name: "COND" }],
      message1: "%1",
      args1: [{ type: "input_statement", name: "THEN" }],
      message2: "FinSi",
      previousStatement: null,
      nextStatement: null,
      colour: COLORS.control,
    },
    {
      type: "ps_si_sino",
      message0: "Si %1 Entonces",
      args0: [{ type: "input_value", name: "COND" }],
      message1: "%1",
      args1: [{ type: "input_statement", name: "THEN" }],
      message2: "SiNo %1",
      args2: [{ type: "input_statement", name: "ELSE" }],
      message3: "FinSi",
      previousStatement: null,
      nextStatement: null,
      colour: COLORS.control,
    },
    {
      type: "ps_mientras",
      message0: "Mientras %1 Hacer",
      args0: [{ type: "input_value", name: "COND" }],
      message1: "%1",
      args1: [{ type: "input_statement", name: "BODY" }],
      message2: "FinMientras",
      previousStatement: null,
      nextStatement: null,
      colour: COLORS.control,
    },
    {
      type: "ps_repetir",
      message0: "Repetir",
      message1: "%1",
      args1: [{ type: "input_statement", name: "BODY" }],
      message2: "%1 %2",
      args2: [
        { type: "field_dropdown", name: "MODE", options: [["Hasta Que", "HASTA"], ["Mientras Que", "MIENTRAS"]] },
        { type: "input_value", name: "COND" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: COLORS.control,
    },
    {
      type: "ps_para",
      message0: "Para %1 <- %2 Hasta %3 Con Paso %4 Hacer",
      args0: [
        { type: "field_input", name: "VAR", text: "i" },
        { type: "input_value", name: "FROM" },
        { type: "input_value", name: "TO" },
        { type: "input_value", name: "STEP" },
      ],
      inputsInline: true,
      message1: "%1",
      args1: [{ type: "input_statement", name: "BODY" }],
      message2: "FinPara",
      previousStatement: null,
      nextStatement: null,
      colour: COLORS.control,
    },
    {
      type: "ps_para_cada",
      message0: "Para Cada %1 de %2 Hacer",
      args0: [
        { type: "field_input", name: "VAR", text: "x" },
        { type: "field_input", name: "ARRAY", text: "datos" },
      ],
      message1: "%1",
      args1: [{ type: "input_statement", name: "BODY" }],
      message2: "FinPara",
      previousStatement: null,
      nextStatement: null,
      colour: COLORS.control,
    },
    {
      type: "ps_raw",
      message0: "código %1",
      args0: [{ type: "field_multilinetext", name: "CODE", text: "" }],
      previousStatement: null,
      nextStatement: null,
      colour: COLORS.raw,
      tooltip: "Instrucciones que todavía no tienen bloque propio. Se conservan tal cual.",
    },
    /* ---------- arrays ---------- */
    {
      type: "ps_dimension",
      message0: "Dimension %1 [ %2 ]",
      args0: [
        { type: "field_input", name: "NAME", text: "datos" },
        { type: "input_value", name: "SIZE" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: COLORS.arrays,
      tooltip: "Crea un arreglo con un tamaño (escribe 3, 4 en una caja de código para una matriz).",
    },
    {
      type: "ps_elemento",
      message0: "%1 [ %2 ]",
      args0: [
        { type: "field_input", name: "NAME", text: "datos" },
        { type: "input_value", name: "INDEX" },
      ],
      inputsInline: true,
      output: null,
      colour: COLORS.arrays,
      tooltip: "Un elemento del arreglo.",
    },
    /* ---------- screen ---------- */
    {
      type: "ps_limpiar",
      message0: "Limpiar Pantalla",
      previousStatement: null,
      nextStatement: null,
      colour: COLORS.screen,
    },
    {
      type: "ps_esperar_tecla",
      message0: "Esperar Tecla",
      previousStatement: null,
      nextStatement: null,
      colour: COLORS.screen,
    },
    {
      type: "ps_esperar",
      message0: "Esperar %1 %2",
      args0: [
        { type: "input_value", name: "AMOUNT" },
        { type: "field_dropdown", name: "UNIT", options: [["Segundos", "Segundos"], ["Milisegundos", "Milisegundos"]] },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: COLORS.screen,
    },
    {
      type: "ps_llamar",
      message0: "llamar %1 ( %2 )",
      args0: [
        { type: "field_input", name: "NAME", text: "MiSubProceso" },
        { type: "field_input", name: "ARGS", text: "" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: COLORS.raw,
      tooltip: "Ejecuta un SubProceso.",
    },
    /* ---------- values ---------- */
    {
      type: "ps_numero",
      message0: "%1",
      args0: [{ type: "field_number", name: "NUM", value: 0 }],
      output: null,
      colour: COLORS.operators,
    },
    {
      type: "ps_texto",
      message0: "\" %1 \"",
      args0: [{ type: "field_input", name: "TEXT", text: "Hola" }],
      output: null,
      colour: COLORS.text,
    },
    {
      type: "ps_logico",
      message0: "%1",
      args0: [{ type: "field_dropdown", name: "VALUE", options: [["Verdadero", "Verdadero"], ["Falso", "Falso"]] }],
      output: null,
      colour: COLORS.operators,
    },
    {
      type: "ps_aritmetica",
      message0: "%1 %2 %3",
      args0: [
        { type: "input_value", name: "A" },
        {
          type: "field_dropdown",
          name: "OP",
          options: [["+", "+"], ["-", "-"], ["×", "*"], ["÷", "/"], ["^", "^"], ["MOD", "MOD"]],
        },
        { type: "input_value", name: "B" },
      ],
      inputsInline: true,
      output: null,
      colour: COLORS.operators,
    },
    {
      type: "ps_comparar",
      message0: "%1 %2 %3",
      args0: [
        { type: "input_value", name: "A" },
        {
          type: "field_dropdown",
          name: "OP",
          options: [["=", "="], ["≠", "<>"], ["<", "<"], [">", ">"], ["≤", "<="], ["≥", ">="]],
        },
        { type: "input_value", name: "B" },
      ],
      inputsInline: true,
      output: null,
      colour: COLORS.operators,
    },
    {
      type: "ps_logica",
      message0: "%1 %2 %3",
      args0: [
        { type: "input_value", name: "A" },
        { type: "field_dropdown", name: "OP", options: [["Y", "Y"], ["O", "O"]] },
        { type: "input_value", name: "B" },
      ],
      inputsInline: true,
      output: null,
      colour: COLORS.operators,
    },
    {
      type: "ps_no",
      message0: "NO %1",
      args0: [{ type: "input_value", name: "A" }],
      output: null,
      colour: COLORS.operators,
    },
    {
      type: "ps_unir",
      message0: "%1 , %2",
      args0: [
        { type: "input_value", name: "A" },
        { type: "input_value", name: "B" },
      ],
      inputsInline: true,
      output: null,
      colour: COLORS.text,
      tooltip: "Escribe varios valores seguidos (como las comas de Escribir).",
    },
    {
      type: "ps_funcion",
      message0: "%1 ( %2 )",
      args0: [
        { type: "field_dropdown", name: "NAME", options: FUNCTIONS },
        { type: "input_value", name: "A" },
      ],
      inputsInline: true,
      output: null,
      colour: COLORS.text,
    },
    {
      type: "ps_funcion2",
      message0: "%1 ( %2 , %3 )",
      args0: [
        { type: "field_dropdown", name: "NAME", options: FUNCTIONS2 },
        { type: "input_value", name: "A" },
        { type: "input_value", name: "B" },
      ],
      inputsInline: true,
      output: null,
      colour: COLORS.text,
    },
    {
      type: "ps_expresion",
      message0: "%1",
      args0: [{ type: "field_input", name: "CODE", text: "" }],
      output: null,
      colour: COLORS.raw,
      tooltip: "Una expresión escrita como código.",
    },
  ]);
}

/** The palette, grouped like Scratch's categories. Shadows give each slot a default. */
export function buildToolbox(labels: Record<string, string>): Blockly.utils.toolbox.ToolboxDefinition {
  const num = (n = 0) => ({ shadow: { type: "ps_numero", fields: { NUM: n } } });
  const text = (t = "Hola") => ({ shadow: { type: "ps_texto", fields: { TEXT: t } } });
  const variable = (name = "x") => ({ block: { type: "ps_variable", fields: { NAME: name } } });
  return {
    kind: "categoryToolbox",
    contents: [
      {
        kind: "category",
        name: labels.io,
        colour: COLORS.io,
        contents: [
          { kind: "block", type: "ps_escribir", inputs: { VALUE: text() } },
          { kind: "block", type: "ps_leer", inputs: { TARGET: variable() } },
        ],
      },
      {
        kind: "category",
        name: labels.variables,
        colour: COLORS.variables,
        contents: [
          { kind: "block", type: "ps_definir" },
          { kind: "block", type: "ps_asignar", inputs: { TARGET: variable(), VALUE: num() } },
          { kind: "block", type: "ps_variable" },
        ],
      },
      {
        kind: "category",
        name: labels.control,
        colour: COLORS.control,
        contents: [
          { kind: "block", type: "ps_si" },
          { kind: "block", type: "ps_si_sino" },
          { kind: "block", type: "ps_mientras" },
          { kind: "block", type: "ps_repetir" },
          { kind: "block", type: "ps_para", inputs: { FROM: num(1), TO: num(10), STEP: num(1) } },
          { kind: "block", type: "ps_para_cada" },
        ],
      },
      {
        kind: "category",
        name: labels.operators,
        colour: COLORS.operators,
        contents: [
          { kind: "block", type: "ps_numero" },
          { kind: "block", type: "ps_aritmetica", inputs: { A: num(1), B: num(1) } },
          { kind: "block", type: "ps_comparar", inputs: { A: num(1), B: num(1) } },
          { kind: "block", type: "ps_logica" },
          { kind: "block", type: "ps_no" },
          { kind: "block", type: "ps_logico" },
        ],
      },
      {
        kind: "category",
        name: labels.text,
        colour: COLORS.text,
        contents: [
          { kind: "block", type: "ps_texto" },
          { kind: "block", type: "ps_unir", inputs: { A: text("Total: "), B: num(0) } },
          { kind: "block", type: "ps_funcion", inputs: { A: num(16) } },
          { kind: "block", type: "ps_funcion2", inputs: { A: num(1), B: num(6) } },
        ],
      },
      {
        kind: "category",
        name: labels.arrays,
        colour: COLORS.arrays,
        contents: [
          { kind: "block", type: "ps_dimension", inputs: { SIZE: num(10) } },
          { kind: "block", type: "ps_elemento", inputs: { INDEX: num(1) } },
        ],
      },
      {
        kind: "category",
        name: labels.screen,
        colour: COLORS.screen,
        contents: [
          { kind: "block", type: "ps_limpiar" },
          { kind: "block", type: "ps_esperar", inputs: { AMOUNT: num(1) } },
          { kind: "block", type: "ps_esperar_tecla" },
          { kind: "block", type: "ps_llamar" },
          { kind: "block", type: "ps_raw" },
          { kind: "block", type: "ps_expresion" },
        ],
      },
    ],
  };
}
