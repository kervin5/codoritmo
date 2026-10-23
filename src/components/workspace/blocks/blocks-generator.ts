// PROTOTYPE — turns the PSeInt blocks into pseudocode text.

import * as Blockly from "blockly/core";

import { normalizeEngineSettings, type EngineSettings } from "@/src/engine";

/**
 * Lower binds tighter. PSeInt's NO binds looser than comparisons.
 * Blockly floors both orders before comparing them, so the levels are spaced
 * by 2 and "one notch looser than X" is written X + 1.
 */
export const Order = {
  ATOMIC: 0,
  CALL: 2,
  POWER: 4,
  UNARY: 6,
  MULTIPLICATIVE: 8,
  ADDITIVE: 10,
  RELATIONAL: 12,
  NOT: 14,
  AND: 16,
  OR: 18,
  LIST: 20,
  NONE: 99,
};

const textLiteral = (text: string) => (text.includes('"') ? `'${text}'` : `"${text}"`);

/**
 * How tightly free-typed code binds: a name, call, index or parenthesised
 * group is atomic (so `m[i, j]` can be a Leer or assignment target without
 * parentheses); a top-level comma is a list; anything else may need parentheses.
 */
function expressionOrder(code: string): number {
  const text = code.trim();
  if (!text) return Order.NONE;
  let depth = 0;
  let quote = "";
  let atomic = true;
  for (const char of text) {
    if (quote) {
      if (char === quote) quote = "";
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === "(" || char === "[") {
      depth++;
    } else if (char === ")" || char === "]") {
      depth--;
    } else if (depth === 0 && char === ",") {
      return Order.LIST;
    } else if (depth === 0 && /[\s+\-*/^%<>=&|~!:;]/.test(char)) {
      atomic = false;
    }
  }
  return atomic ? Order.ATOMIC : Order.NONE;
}

/**
 * The parts of a profile that change how the code has to be written. The
 * defaults are the desktop profile, whose output this generator always wrote.
 */
export interface CodeStyle {
  /** force_semicolon: every sequential instruction ends with `;`. */
  semicolons: boolean;
  /** word_operators off: `&&`, `||`, `~` and `%` instead of Y, O, NO and MOD. */
  symbolOperators: boolean;
}

export function codeStyle(settings: Partial<EngineSettings> = {}): CodeStyle {
  // Normalised like the parser does (colloquial conditions bring word operators back).
  const normalized = normalizeEngineSettings(settings);
  return { semicolons: normalized.forceSemicolon, symbolOperators: !normalized.wordOperators };
}

class PseudocodeGenerator extends Blockly.CodeGenerator {
  /** How the code is being written; set by workspaceToCode, or by useSettings before blockToCode. */
  style: CodeStyle = codeStyle();

  constructor() {
    super("PSeInt");
    this.INDENT = "\t";
  }

  /** Writes the following blockToCode calls for this profile. */
  useSettings(settings: Partial<EngineSettings> = {}): void {
    this.style = codeStyle(settings);
  }

  // Chain each statement to the one below it.
  override scrub_(block: Blockly.Block, code: string, thisOnly?: boolean): string {
    const next = block.nextConnection?.targetBlock();
    return thisOnly || !next ? code : code + this.blockToCode(next);
  }

  /**
   * Whole program: the Algoritmo plus any loose code blocks (e.g. SubProcesos),
   * top to bottom, written the way the document's profile requires.
   */
  override workspaceToCode(workspace?: Blockly.Workspace, settings: Partial<EngineSettings> = {}): string {
    if (!workspace) return "";
    this.useSettings(settings);
    this.init(workspace);
    const parts: string[] = [];
    for (const block of workspace.getTopBlocks(true)) {
      if (block.type !== "ps_algoritmo" && block.type !== "ps_raw_top") continue;
      const code = this.blockToCode(block);
      if (typeof code === "string" && code.trim()) parts.push(code.trimEnd());
    }
    return `${parts.join("\n\n")}\n`;
  }
}

export const pseudocode = new PseudocodeGenerator();
const g = pseudocode;
const value = (block: Blockly.Block, name: string, order: number) => g.valueToCode(block, name, order);
const body = (block: Blockly.Block, name: string) => g.statementToCode(block, name);
/** Ends a sequential instruction (not a block header or closer, which never take `;`). */
const end = () => (g.style.semicolons ? ";\n" : "\n");
const WORD_TO_SYMBOL: Record<string, string> = { Y: "&&", O: "||", MOD: "%" };
const operator = (op: string) => (g.style.symbolOperators ? WORD_TO_SYMBOL[op] ?? op : op);

/** A control structure kept as code; its own statements carry whatever `;` they were written with. */
const COMPOUND = /^(si|mientras|repetir|para|paracada|seg[uú]n)(\s|\(|$)/i;

/**
 * A statement kept as code. Its text never includes the `;` that ended it, so
 * under force_semicolon a one-line instruction gets it back. Multi-line code
 * (a Segun) and control structures are written exactly as they are.
 */
function rawStatement(code: string): string {
  const text = code.trimEnd();
  if (!g.style.semicolons || !text || text.includes("\n") || text.endsWith(";") || COMPOUND.test(text.trimStart())) {
    return `${code}\n`;
  }
  return `${text};\n`;
}

const forBlock: Record<string, (block: Blockly.Block) => string | [string, number]> = {
  ps_algoritmo: (b) => `Algoritmo ${b.getFieldValue("NAME") || "SinTitulo"}\n${body(b, "BODY")}FinAlgoritmo\n`,
  ps_raw_top: (b) => `${b.getFieldValue("CODE")}\n`,
  ps_raw: (b) => rawStatement(String(b.getFieldValue("CODE") ?? "")),

  ps_escribir: (b) =>
    `Escribir ${value(b, "VALUE", Order.LIST + 1)}${b.getFieldValue("NEWLINE") === "FALSE" ? " Sin Saltar" : ""}${end()}`,
  ps_leer: (b) => `Leer ${value(b, "TARGET", Order.LIST + 1)}${end()}`,

  ps_definir: (b) => `Definir ${b.getFieldValue("NAMES")} Como ${b.getFieldValue("TYPE")}${end()}`,
  ps_asignar: (b) => `${value(b, "TARGET", Order.ATOMIC)} <- ${value(b, "VALUE", Order.NONE)}${end()}`,
  ps_variable: (b) => [b.getFieldValue("NAME"), Order.ATOMIC],

  ps_si: (b) => `Si ${value(b, "COND", Order.NONE)} Entonces\n${body(b, "THEN")}FinSi\n`,
  ps_si_sino: (b) =>
    `Si ${value(b, "COND", Order.NONE)} Entonces\n${body(b, "THEN")}SiNo\n${body(b, "ELSE")}FinSi\n`,
  ps_mientras: (b) => `Mientras ${value(b, "COND", Order.NONE)} Hacer\n${body(b, "BODY")}FinMientras\n`,
  ps_repetir: (b) =>
    `Repetir\n${body(b, "BODY")}${b.getFieldValue("MODE") === "MIENTRAS" ? "Mientras Que" : "Hasta Que"} ${value(b, "COND", Order.NONE)}\n`,
  ps_para: (b) => {
    const step = value(b, "STEP", Order.NONE);
    // A default (shadow) step of 1 is left out, so PSeInt may count down when
    // the start is above the end; a step the student placed is always written.
    const stepBlock = b.getInputTargetBlock("STEP");
    const implicit = !step || (step === "1" && stepBlock?.isShadow());
    const withStep = implicit ? "" : ` Con Paso ${step}`;
    return `Para ${b.getFieldValue("VAR")} <- ${value(b, "FROM", Order.NONE)} Hasta ${value(b, "TO", Order.NONE)}${withStep} Hacer\n${body(b, "BODY")}FinPara\n`;
  },
  ps_para_cada: (b) =>
    `Para Cada ${b.getFieldValue("VAR")} de ${b.getFieldValue("ARRAY")} Hacer\n${body(b, "BODY")}FinPara\n`,

  ps_dimension: (b) => `Dimension ${b.getFieldValue("NAME")}[${value(b, "SIZE", Order.NONE)}]${end()}`,
  ps_elemento: (b) => [`${b.getFieldValue("NAME")}[${value(b, "INDEX", Order.NONE)}]`, Order.ATOMIC],

  ps_limpiar: () => `Limpiar Pantalla${end()}`,
  ps_esperar_tecla: () => `Esperar Tecla${end()}`,
  ps_esperar: (b) => `Esperar ${value(b, "AMOUNT", Order.NONE)} ${b.getFieldValue("UNIT")}${end()}`,
  ps_llamar: (b) => `${b.getFieldValue("NAME")}(${b.getFieldValue("ARGS")})${end()}`,

  ps_numero: (b) => {
    const n = Number(b.getFieldValue("NUM"));
    return [String(n), n < 0 ? Order.UNARY : Order.ATOMIC];
  },
  ps_texto: (b) => [textLiteral(b.getFieldValue("TEXT")), Order.ATOMIC],
  ps_logico: (b) => [b.getFieldValue("VALUE"), Order.ATOMIC],
  ps_aritmetica: (b) => {
    const op = b.getFieldValue("OP");
    const order =
      op === "^" ? Order.POWER : op === "*" || op === "/" || op === "MOD" ? Order.MULTIPLICATIVE : Order.ADDITIVE;
    // Blockly wraps an input when its order is >= the order passed here.
    // Left-associative: the left side may share our level, the right may not.
    // PSeInt rejects two operators in a row (`a * -1`), so a negative right side needs parentheses.
    const right = value(b, "B", order);
    return [`${value(b, "A", order + 1)} ${operator(op)} ${right.startsWith("-") ? `(${right})` : right}`, order];
  },
  ps_comparar: (b) => [`${value(b, "A", Order.RELATIONAL)} ${b.getFieldValue("OP")} ${value(b, "B", Order.RELATIONAL)}`, Order.RELATIONAL],
  ps_logica: (b) => {
    const order = b.getFieldValue("OP") === "Y" ? Order.AND : Order.OR;
    return [`${value(b, "A", order + 1)} ${operator(b.getFieldValue("OP"))} ${value(b, "B", order + 1)}`, order];
  },
  ps_no: (b) => [`${g.style.symbolOperators ? "~" : "NO "}${value(b, "A", Order.NOT)}`, Order.NOT],
  ps_unir: (b) => [`${value(b, "A", Order.LIST + 1)}, ${value(b, "B", Order.LIST + 1)}`, Order.LIST],
  ps_funcion: (b) => [`${b.getFieldValue("NAME")}(${value(b, "A", Order.NONE)})`, Order.CALL],
  ps_funcion2: (b) =>
    [`${b.getFieldValue("NAME")}(${value(b, "A", Order.NONE)}, ${value(b, "B", Order.NONE)})`, Order.CALL],
  ps_expresion: (b) => {
    const code = String(b.getFieldValue("CODE") ?? "");
    return [code, expressionOrder(code)];
  },
};

for (const [type, fn] of Object.entries(forBlock)) {
  pseudocode.forBlock[type] = (block) => fn(block);
}
