// Scratch-style blocks for PSeInt (Blockly). Block text keeps the PSeInt
// keywords in Spanish so students see the same words as in the code; only the
// palette's category names follow the UI language.

import * as Blockly from "blockly/core";

import { defineRoutineBlocks } from "./blocks-routines";

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
  /** Si / Mientras / Para / Segun: keyword mint #8FD9B6. 5.2:1 */
  control: "#2F7A62",
  /** Numbers, comparisons, logic: operators sage #9AA6A1. 5.0:1 */
  operators: "#557A3E",
  /** Text and functions: numbers violet #D2B3F2. 5.8:1 */
  text: "#7357A3",
  /** Arrays: a muted rose. 5.9:1 */
  arrays: "#9A4B65",
  /** Screen and timing: slate violet. 6.3:1 */
  screen: "#5C5B90",
  /** SubProceso / Funcion and their calls: a deep coral, Scratch's "My Blocks". 5.6:1 */
  routines: "#A64B3E",
  /** // comments: the editor's comment grey-green, deepened. 7.6:1 */
  comment: "#46524E",
  /** Code kept as text: neutral slate. 7.0:1 */
  raw: "#4F5B61",
};

/* ------------------------------------------------------------------ */
/* Block data                                                          */
/* ------------------------------------------------------------------ */

/**
 * What a block remembers about how its code was written, kept in Blockly's
 * `data` string (serialized, never shown) so code → blocks → code gives the
 * same text back: blank lines before it, the original spelling of keywords,
 * operators and names, and parentheses the program wrote but did not need.
 */
export interface BlockData {
  /** Blank lines before this statement (or top block). */
  blank?: number;
  /** Original spellings, by field or keyword key; used only while they still mean the same. */
  spell?: Record<string, string>;
  /** The expression was written inside parentheses. */
  paren?: 1;
  /** Top blocks: the indentation unit, when it is not a tab. */
  indent?: string;
  /** Segun: cases (by index, or -1 for De Otro Modo) whose first statement shares the case's line. */
  inline?: number[];
}

export function blockData(block: Blockly.Block): BlockData {
  if (!block.data) return {};
  try {
    const data = JSON.parse(block.data);
    return data && typeof data === "object" ? (data as BlockData) : {};
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

const TYPES = [
  ["Entero", "Entero"],
  ["Real", "Real"],
  ["Caracter", "Caracter"],
  ["Logico", "Logico"],
];

/** One-argument functions, as PSeInt spells them. */
export const FUNCTION_NAMES_1 = [
  "Raiz", "RC", "Abs", "Trunc", "Redon", "Azar", "Longitud", "Mayusculas", "Minusculas",
  "ConvertirANumero", "ConvertirATexto", "Sen", "Cos", "Tan", "Asen", "Acos", "Atan", "Ln", "Exp",
];
export const FUNCTION_NAMES_2 = ["Aleatorio", "Concatenar"];
/** Functions without arguments, usually written without parentheses. */
export const FUNCTION_NAMES_0 = ["PI", "EULER", "FechaActual", "HoraActual"];
export const FUNCTION_NAMES_3 = ["Subcadena"];
const options = (names: string[]) => names.map((name) => [name, name]);

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

/** Small round + and − buttons that grow or shrink a block (parameters, cases, arrays). */
function icon(path: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">` +
    `<circle cx="9" cy="9" r="8" fill="rgba(0,0,0,0.28)"/>` +
    `<path d="${path}" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
const PLUS = icon("M9 5v8M5 9h8");
const MINUS = icon("M5 9h8");

export function plusMinus(
  input: Blockly.Input,
  onPlus: (block: Blockly.Block) => void,
  onMinus: ((block: Blockly.Block) => void) | null,
  labels: { plus: string; minus: string }
): void {
  const click = (change: (block: Blockly.Block) => void) => (field: Blockly.FieldImage) => {
    const block = field.getSourceBlock();
    if (block && !block.isInFlyout) mutate(block, () => change(block));
  };
  input.appendField(new Blockly.FieldImage(PLUS, 18, 18, labels.plus, click(onPlus)), "PLUS");
  if (onMinus) input.appendField(new Blockly.FieldImage(MINUS, 18, 18, labels.minus, click(onMinus)), "MINUS");
}

type Stateful = Blockly.Block & { saveExtraState?: () => unknown };

/**
 * Runs a change to a block's shape as one undoable step: a "mutation" change
 * event carries the extra state before and after (as Blockly's own mutators do).
 */
export function mutate(block: Blockly.Block, change: () => void): void {
  const state = () => JSON.stringify((block as Stateful).saveExtraState?.() ?? null);
  const group = Blockly.Events.getGroup();
  if (!group) Blockly.Events.setGroup(true);
  try {
    const before = state();
    change();
    const after = state();
    if (before !== after && Blockly.Events.isEnabled()) {
      const BlockChange = Blockly.Events.get(Blockly.Events.BLOCK_CHANGE);
      Blockly.Events.fire(new BlockChange(block, "mutation", null, before, after));
    }
  } finally {
    if (!group) Blockly.Events.setGroup(false);
  }
  if ("render" in block && typeof block.render === "function" && (block as Blockly.BlockSvg).rendered) {
    (block as Blockly.BlockSvg).render();
  }
}

/** Names PSeInt accepts: a letter or _, then letters, digits or _. */
export function identifier(text: string): string | null {
  const cleaned = text.trim().replace(/\s+/g, "_");
  return /^[\p{L}_][\p{L}\p{Nd}_]*$/u.test(cleaned) ? cleaned : null;
}

/* ------------------------------------------------------------------ */
/* Blocks whose shape changes                                          */
/* ------------------------------------------------------------------ */

type SegunBlock = Blockly.Block & { cases: number; otherwise: boolean; updateShape(): void };

/** Segun x Hacer, one value socket and body per case, and an optional De Otro Modo. */
const SEGUN = {
  init(this: SegunBlock) {
    this.cases = 1;
    this.otherwise = false;
    this.appendValueInput("VALUE").appendField("Segun");
    this.appendEndRowInput("HACER").appendField("Hacer");
    const end = this.appendDummyInput("END").appendField("FinSegun");
    plusMinus(
      end,
      (block) => {
        (block as SegunBlock).cases++;
        (block as SegunBlock).updateShape();
      },
      (block) => {
        const segun = block as SegunBlock;
        if (segun.cases > 1) segun.cases--;
        else segun.otherwise = false;
        segun.updateShape();
      },
      { plus: "Agregar un caso", minus: "Quitar el último caso" }
    );
    this.setInputsInline(true);
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour(COLORS.control);
    this.setTooltip("Elige qué hacer según el valor. Usa la coma para varios valores en un caso; + agrega casos.");
    this.updateShape();
  },
  saveExtraState(this: SegunBlock) {
    return { cases: this.cases, ...(this.otherwise ? { otherwise: true } : {}) };
  },
  loadExtraState(this: SegunBlock, state: { cases?: number; otherwise?: boolean }) {
    this.cases = Math.max(0, state.cases ?? 1);
    this.otherwise = !!state.otherwise;
    this.updateShape();
  },
  /** Adds or removes inputs at the end, so the blocks in the cases that stay are kept. */
  updateShape(this: SegunBlock) {
    let existing = 0;
    while (this.getInput(`CASE${existing}`)) existing++;
    for (let i = existing - 1; i >= this.cases; i--) {
      this.removeInput(`DO${i}`);
      this.removeInput(`COLON${i}`);
      this.removeInput(`CASE${i}`);
    }
    for (let i = existing; i < this.cases; i++) {
      this.appendValueInput(`CASE${i}`);
      this.appendEndRowInput(`COLON${i}`).appendField(":");
      this.appendStatementInput(`DO${i}`);
      const before = this.getInput("OTHERWISE_LABEL") ? "OTHERWISE_LABEL" : "END";
      this.moveInputBefore(`CASE${i}`, before);
      this.moveInputBefore(`COLON${i}`, before);
      this.moveInputBefore(`DO${i}`, before);
    }
    if (this.otherwise && !this.getInput("OTHERWISE")) {
      this.appendEndRowInput("OTHERWISE_LABEL").appendField("De Otro Modo:");
      this.appendStatementInput("OTHERWISE");
      this.moveInputBefore("OTHERWISE_LABEL", "END");
      this.moveInputBefore("OTHERWISE", "END");
    } else if (!this.otherwise && this.getInput("OTHERWISE")) {
      this.removeInput("OTHERWISE");
      this.removeInput("OTHERWISE_LABEL");
    }
  },
  customContextMenu(this: SegunBlock, items: (Blockly.ContextMenuRegistry.ContextMenuOption | Blockly.ContextMenuRegistry.LegacyContextMenuOption)[]) {
    if (this.isInFlyout) return;
    items.push({
      text: this.otherwise ? "Quitar De Otro Modo" : "Agregar De Otro Modo",
      enabled: this.isEditable(),
      callback: () =>
        mutate(this, () => {
          this.otherwise = !this.otherwise;
          this.updateShape();
        }),
    } satisfies Blockly.ContextMenuRegistry.LegacyContextMenuOption);
  },
};

type DimensionBlock = Blockly.Block & { items: number; updateShape(): void };

/** Dimension (or Redimensionar) one or more arrays: `Dimension a[3], m[2, 4]`. */
const DIMENSION = {
  init(this: DimensionBlock) {
    this.items = 1;
    this.appendDummyInput("KW").appendField(
      new Blockly.FieldDropdown([
        ["Dimension", "Dimension"],
        ["Redimensionar", "Redimensionar"],
      ]),
      "KEYWORD"
    );
    const end = this.appendDummyInput("END").appendField("]");
    plusMinus(
      end,
      (block) => {
        (block as DimensionBlock).items++;
        (block as DimensionBlock).updateShape();
      },
      (block) => {
        const dimension = block as DimensionBlock;
        if (dimension.items > 1) dimension.items--;
        dimension.updateShape();
      },
      { plus: "Agregar otro arreglo", minus: "Quitar el último arreglo" }
    );
    this.setInputsInline(true);
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour(COLORS.arrays);
    this.setTooltip(
      "Crea arreglos con su tamaño. Para una matriz, une los tamaños con el bloque de coma (3 , 4). + agrega otro arreglo."
    );
    this.updateShape();
  },
  saveExtraState(this: DimensionBlock) {
    return this.items === 1 ? null : { items: this.items };
  },
  loadExtraState(this: DimensionBlock, state: { items?: number } | null) {
    this.items = Math.max(1, state?.items ?? 1);
    this.updateShape();
  },
  updateShape(this: DimensionBlock) {
    let existing = 0;
    while (this.getInput(`SIZE${existing}`)) existing++;
    for (let i = existing - 1; i >= this.items; i--) this.removeInput(`SIZE${i}`);
    for (let i = existing; i < this.items; i++) {
      const input = this.appendValueInput(`SIZE${i}`);
      if (i > 0) input.appendField("] ,");
      input.appendField(new Blockly.FieldTextInput(i === 0 ? "datos" : "otro"), `NAME${i}`).appendField("[");
      this.moveInputBefore(`SIZE${i}`, "END");
    }
  },
};

type AlgorithmBlock = Blockly.Block;

/** Algoritmo (or Proceso) … FinAlgoritmo. */
const ALGORITHM = {
  init(this: AlgorithmBlock) {
    const closer = new Blockly.FieldLabel("FinAlgoritmo");
    this.appendDummyInput("HEADER")
      .appendField(
        new Blockly.FieldDropdown(
          [
            ["Algoritmo", "Algoritmo"],
            ["Proceso", "Proceso"],
          ],
          (value) => {
            closer.setValue(value === "Proceso" ? "FinProceso" : "FinAlgoritmo");
            return value;
          }
        ),
        "KEYWORD"
      )
      .appendField(new Blockly.FieldTextInput("MiAlgoritmo"), "NAME");
    this.appendStatementInput("BODY");
    this.appendDummyInput("END").appendField(closer, "CLOSER");
    this.setColour(COLORS.program);
    this.setTooltip("Aquí empieza y termina tu algoritmo.");
  },
};

/* ------------------------------------------------------------------ */
/* Definitions                                                         */
/* ------------------------------------------------------------------ */

let defined = false;

export function defineBlocks(): void {
  if (defined) return;
  defined = true;
  if (!Blockly.registry.hasItem(Blockly.registry.Type.FIELD, "field_multilinetext")) {
    Blockly.fieldRegistry.register("field_multilinetext", FieldCode);
  }
  Blockly.Blocks["ps_algoritmo"] = ALGORITHM;
  Blockly.Blocks["ps_segun"] = SEGUN;
  Blockly.Blocks["ps_dimension"] = DIMENSION;
  defineRoutineBlocks();
  Blockly.common.defineBlocksWithJsonArray([
    /* ---------- program ---------- */
    {
      type: "ps_raw_top",
      message0: "código %1",
      args0: [{ type: "field_multilinetext", name: "CODE", text: "" }],
      colour: COLORS.raw,
      tooltip: "Código que todavía no tiene bloque propio. Se conserva tal cual.",
    },
    {
      type: "ps_comentario",
      message0: "// %1",
      args0: [{ type: "field_input", name: "TEXT", text: "comentario" }],
      previousStatement: null,
      nextStatement: null,
      colour: COLORS.comment,
      tooltip: "Un comentario: una nota para quien lee el código. No se ejecuta.",
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
      type: "ps_elemento",
      message0: "%1 [ %2 ]",
      args0: [
        { type: "field_input", name: "NAME", text: "datos" },
        { type: "input_value", name: "INDEX" },
      ],
      inputsInline: true,
      output: null,
      colour: COLORS.arrays,
      tooltip: "Un elemento del arreglo. En una matriz, une los índices con el bloque de coma (i , j).",
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
      type: "ps_negativo",
      message0: "- %1",
      args0: [{ type: "input_value", name: "A" }],
      inputsInline: true,
      output: null,
      colour: COLORS.operators,
      tooltip: "El valor con el signo cambiado.",
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
      type: "ps_es",
      message0: "%1 Es %2",
      args0: [
        { type: "input_value", name: "A" },
        {
          type: "field_dropdown",
          name: "WHAT",
          options: [
            ["Par", "Par"],
            ["Impar", "Impar"],
            ["Positivo", "Positivo"],
            ["Negativo", "Negativo"],
            ["Cero", "Cero"],
            ["Entero", "Entero"],
          ],
        },
      ],
      inputsInline: true,
      output: null,
      colour: COLORS.operators,
      tooltip: "Una condición coloquial de PSeInt (con el perfil que las permite).",
    },
    {
      type: "ps_es_divisible",
      message0: "%1 Es %2 %3",
      args0: [
        { type: "input_value", name: "A" },
        {
          type: "field_dropdown",
          name: "WHAT",
          options: [
            ["Divisible Por", "Divisible Por"],
            ["Multiplo De", "Multiplo De"],
          ],
        },
        { type: "input_value", name: "B" },
      ],
      inputsInline: true,
      output: null,
      colour: COLORS.operators,
      tooltip: "Una condición coloquial de PSeInt (con el perfil que las permite).",
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
      tooltip: "Varios valores seguidos: los de Escribir o Leer, los índices de una matriz o los valores de un caso.",
    },
    {
      type: "ps_constante",
      message0: "%1",
      args0: [{ type: "field_dropdown", name: "NAME", options: options(FUNCTION_NAMES_0) }],
      output: null,
      colour: COLORS.text,
      tooltip: "Un valor que da PSeInt: π, e, la fecha o la hora de hoy.",
    },
    {
      type: "ps_funcion",
      message0: "%1 ( %2 )",
      args0: [
        { type: "field_dropdown", name: "NAME", options: options(FUNCTION_NAMES_1) },
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
        { type: "field_dropdown", name: "NAME", options: options(FUNCTION_NAMES_2) },
        { type: "input_value", name: "A" },
        { type: "input_value", name: "B" },
      ],
      inputsInline: true,
      output: null,
      colour: COLORS.text,
    },
    {
      type: "ps_funcion3",
      message0: "%1 ( %2 , %3 , %4 )",
      args0: [
        { type: "field_dropdown", name: "NAME", options: options(FUNCTION_NAMES_3) },
        { type: "input_value", name: "A" },
        { type: "input_value", name: "B" },
        { type: "input_value", name: "C" },
      ],
      inputsInline: true,
      output: null,
      colour: COLORS.text,
      tooltip: "La parte del texto entre dos posiciones.",
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
          {
            kind: "block",
            type: "ps_segun",
            extraState: { cases: 2, otherwise: true },
            inputs: { VALUE: variable("opcion"), CASE0: num(1), CASE1: num(2) },
          },
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
          { kind: "block", type: "ps_negativo" },
          { kind: "block", type: "ps_comparar", inputs: { A: num(1), B: num(1) } },
          { kind: "block", type: "ps_logica" },
          { kind: "block", type: "ps_no" },
          { kind: "block", type: "ps_logico" },
          { kind: "block", type: "ps_es" },
          { kind: "block", type: "ps_es_divisible", inputs: { B: num(3) } },
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
          { kind: "block", type: "ps_constante" },
          { kind: "block", type: "ps_funcion2", inputs: { A: num(1), B: num(6) } },
          { kind: "block", type: "ps_funcion3", inputs: { A: text(), B: num(1), C: num(2) } },
        ],
      },
      {
        kind: "category",
        name: labels.arrays,
        colour: COLORS.arrays,
        contents: [
          { kind: "block", type: "ps_dimension", inputs: { SIZE0: num(10) } },
          { kind: "block", type: "ps_elemento", inputs: { INDEX: num(1) } },
        ],
      },
      {
        kind: "category",
        name: labels.routines,
        colour: COLORS.routines,
        custom: ROUTINES_CATEGORY,
      },
      {
        kind: "category",
        name: labels.screen,
        colour: COLORS.screen,
        contents: [
          { kind: "block", type: "ps_limpiar" },
          { kind: "block", type: "ps_esperar", inputs: { AMOUNT: num(1) } },
          { kind: "block", type: "ps_esperar_tecla" },
          { kind: "block", type: "ps_comentario" },
          { kind: "block", type: "ps_raw" },
          { kind: "block", type: "ps_expresion" },
        ],
      },
    ],
  };
}

/** The dynamic "Mis subprocesos" category (see routinesFlyout). */
export const ROUTINES_CATEGORY = "PS_ROUTINES";
