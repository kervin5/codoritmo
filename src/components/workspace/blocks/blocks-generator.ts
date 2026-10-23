// Turns the PSeInt blocks into pseudocode text.

import * as Blockly from "blockly/core";

import { normalizeEngineSettings, type EngineSettings } from "@/src/engine";
import { blockData } from "./blocks-defs";
import type { CallBlock, RoutineBlock } from "./blocks-routines";

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
  EQUALITY: 14,
  NOT: 16,
  AND: 18,
  OR: 20,
  LIST: 22,
  NONE: 99,
};

const normalize = (word: string) =>
  word.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, "").toUpperCase();

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
  /** overload_equal: `=` may assign. */
  equalAssigns: boolean;
  /** coloquial_conditions: `x Es Par`, `a Es Mayor Que b`. */
  colloquial: boolean;
  /** lazy_syntax: optional keywords (Entonces, Hacer) may be left out. */
  lazy: boolean;
}

export function codeStyle(settings: Partial<EngineSettings> = {}): CodeStyle {
  // Normalised like the parser does (colloquial conditions bring word operators back).
  const normalized = normalizeEngineSettings(settings);
  return {
    semicolons: normalized.forceSemicolon,
    symbolOperators: !normalized.wordOperators,
    equalAssigns: normalized.overloadEqual,
    colloquial: normalized.colloquialConditions,
    lazy: normalized.lazySyntax,
  };
}

/** Marks the line a block starts on while generating, to map lines back to blocks. */
const MARK = /\u0001([^\u0002]*)\u0002/g;
const mark = (id: string) => `\u0001${id}\u0002`;

/** Top blocks that write code; anything else lying on the workspace is ignored. */
const TOP_TYPES = new Set(["ps_algoritmo", "ps_subproceso", "ps_raw_top"]);

class PseudocodeGenerator extends Blockly.CodeGenerator {
  /** How the code is being written; set by workspaceToCode, or by useSettings before blockToCode. */
  style: CodeStyle = codeStyle();
  /** While true, each statement's first line carries a marker with its block id. */
  marking = false;

  constructor() {
    super("PSeInt");
    this.INDENT = "\t";
  }

  /** Writes the following blockToCode calls for this profile. */
  useSettings(settings: Partial<EngineSettings> = {}): void {
    this.style = codeStyle(settings);
  }

  // Chain each statement to the one below it (on the same line, if the program wrote them so).
  override scrub_(block: Blockly.Block, code: string, thisOnly?: boolean): string {
    const next = block.nextConnection?.targetBlock();
    if (thisOnly || !next) return code;
    const nextCode = this.blockToCode(next);
    const joined = next.isEnabled() && blockData(next).spell?.join === "1" && code.endsWith("\n");
    return joined && typeof nextCode === "string" ? `${code.slice(0, -1)} ${nextCode}` : code + nextCode;
  }

  /**
   * Whole program: the top blocks that write code (the Algoritmo, each
   * SubProceso/Funcion, loose comments), top to bottom, separated by the
   * blank lines they were written with, in the style of the document's profile.
   */
  override workspaceToCode(workspace?: Blockly.Workspace, settings: Partial<EngineSettings> = {}): string {
    return this.generate(workspace, settings).code;
  }

  /** The code, and which block wrote each line (1-based). */
  generate(workspace: Blockly.Workspace | undefined, settings: Partial<EngineSettings>, marking = false) {
    const lines = new Map<number, string>();
    if (!workspace) return { code: "", lines };
    this.useSettings(settings);
    this.marking = marking;
    let text = "";
    try {
      this.init(workspace);
      for (const block of workspace.getTopBlocks(true)) {
        if (!block.isEnabled() || !writesCode(block)) continue;
        // Each part is indented the way it was written (a tab unless it said otherwise).
        this.INDENT = blockData(block).indent ?? "\t";
        const code = this.blockToCode(block);
        if (typeof code !== "string" || !code.trim()) continue;
        const blank = blockData(block).blank ?? 1;
        if (text) text += "\n".repeat(blank + 1);
        text += code.trimEnd();
      }
    } finally {
      this.marking = false;
      this.INDENT = "\t";
    }
    const out = `${text}\n`.split("\n").map((line, index) => {
      let first: string | null = null;
      const clean = line.replace(MARK, (_, id: string) => {
        first ??= id;
        return "";
      });
      if (first) lines.set(index + 1, first);
      // Blank lines inside an indented body come back without the indentation.
      return clean.trim() ? clean : "";
    });
    return { code: out.join("\n"), lines };
  }
}

/** A top block writes code if it is a program part, or a stack made only of comments. */
function writesCode(block: Blockly.Block): boolean {
  if (TOP_TYPES.has(block.type)) return true;
  for (let b: Blockly.Block | null = block; b; b = b.getNextBlock()) if (b.type !== "ps_comentario") return false;
  return block.type === "ps_comentario";
}

export const pseudocode = new PseudocodeGenerator();
const g = pseudocode;
const value = (block: Blockly.Block, name: string, order: number) => g.valueToCode(block, name, order);
const body = (block: Blockly.Block, name: string) => g.statementToCode(block, name);
/** Ends a sequential instruction (not a block header or closer, which never take `;`). */
const end = () => (g.style.semicolons ? ";\n" : "\n");

/** The way the program spelled something, while it still means `canonical` (by `same`). */
function spelled(
  block: Blockly.Block,
  key: string,
  canonical: string,
  same = (a: string, b: string) => normalize(a) === normalize(b)
) {
  const spelling = blockData(block).spell?.[key];
  return spelling && same(spelling, canonical) ? spelling : canonical;
}

/** Keywords another word may stand for. */
const KEYWORD_ALIASES: Record<string, string[]> = { DE: ["EN"] };

/**
 * A keyword (or phrase), in the case the program wrote it (`entonces`,
 * `FINSI`). An optional keyword the program left out (`Si x` without
 * Entonces) stays out while the profile allows flexible syntax. Returns the
 * text with a leading space, or "".
 */
function kw(block: Blockly.Block, phrase: string): string {
  const spell = blockData(block).spell ?? {};
  const words = phrase.split(" ").map((word) => {
    const key = normalize(word);
    const spelling = spell[`k:${key}`];
    if (spelling === undefined) return word;
    if (spelling === "") return g.style.lazy ? "" : word;
    const same = normalize(spelling) === key || (KEYWORD_ALIASES[key] ?? []).includes(normalize(spelling));
    // `Fin Si` in two words needs flexible syntax.
    return same && (!/\s/.test(spelling) || g.style.lazy) ? spelling : word;
  });
  const text = words.filter(Boolean).join(" ");
  return text ? ` ${text}` : "";
}
/** kw() without the leading space, for a keyword that starts a line. */
const lead = (block: Blockly.Block, phrase: string) => kw(block, phrase).slice(1);

const WORD_TO_SYMBOL: Record<string, string> = { Y: "&&", O: "||", MOD: "%", NO: "~" };
const SYMBOLS: Record<string, string[]> = { Y: ["&&", "&"], O: ["||", "|"], MOD: ["%"], NO: ["~", "!"] };
/** Y, O, MOD and NO: symbols when the profile has no word operators, else as the program wrote them. */
function operator(block: Blockly.Block, op: string): string {
  if (g.style.symbolOperators) return WORD_TO_SYMBOL[op] ?? op;
  return spelled(block, "op", op, (a, b) => normalize(a) === b || (SYMBOLS[b] ?? []).includes(a));
}

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

const textLiteral = (block: Blockly.Block, text: string) => {
  const quote = blockData(block).spell?.quote === "'" ? "'" : '"';
  if (!text.includes(quote)) return `${quote}${text}${quote}`;
  return text.includes('"') ? `'${text}'` : `"${text}"`;
};

/** Indents every line of `code` one more level. */
const indent = (code: string) => g.prefixLines(code, g.INDENT);

/** `name[index]`, or `name(index)` when the program indexed with parentheses. */
const indexed = (block: Blockly.Block, name: string, index: string, key = "bracket") =>
  blockData(block).spell?.[key] === "(" ? `${name}(${index})` : `${name}[${index}]`;

/** The assignment arrow as written: `<-`, `:=`, `=` (with overload_equal), or `Desde` in a Para (flexible syntax). */
function arrow(block: Blockly.Block, desde = false): string {
  return spelled(block, "arrow", "<-", (a) =>
    a === ":=" || a === "←" || (a === "=" && g.style.equalAssigns) || (desde && g.style.lazy && normalize(a) === "DESDE")
  );
}

const ROUTINE_CLOSERS: Record<string, string> = {
  SubProceso: "FinSubProceso",
  SubAlgoritmo: "FinSubAlgoritmo",
  Funcion: "FinFuncion",
};

function routine(b: Blockly.Block): string {
  const def = b as RoutineBlock;
  const kind = String(b.getFieldValue("KIND") ?? "SubProceso");
  const params: string[] = [];
  for (let i = 0; i < def.params; i++) {
    const mode = b.getFieldValue(`MODE${i}`);
    const byValue = (a: string) => /^por\s+(valor|copia)$/i.test(a);
    const passing =
      mode === "REF" ? kw(b, "Por Referencia") : mode === "VAL" ? ` ${spelled(b, `mode${i}`, "Por Valor", byValue)}` : "";
    params.push(`${b.getFieldValue(`PARAM${i}`)}${passing}`);
  }
  // `Funcion r = Nombre` is always allowed.
  const resultArrow = spelled(b, "arrow", "<-", (a) => a === "=");
  const result = def.result ? `${b.getFieldValue("RESULT")} ${resultArrow} ` : "";
  const list = def.params || def.parens ? `(${params.join(", ")})` : "";
  const keyword = spelled(b, "kw", kind);
  // Any routine closer ends any routine.
  const closer = spelled(b, "end", ROUTINE_CLOSERS[kind] ?? "FinSubProceso", (a) =>
    ["FINFUNCION", "FINSUBPROCESO", "FINSUBALGORITMO"].includes(normalize(a))
  );
  return `${keyword} ${result}${b.getFieldValue("NAME") || "SinNombre"}${list}\n${body(b, "BODY")}${closer}\n`;
}

function call(b: Blockly.Block): string {
  const block = b as CallBlock;
  const args = block.args.map((_, i) => value(b, `ARG${i}`, Order.LIST));
  return block.parens || args.length ? `${block.routine}(${args.join(", ")})` : block.routine;
}

function segun(b: Blockly.Block): string {
  const cases = (b as Blockly.Block & { cases: number }).cases;
  const inline = new Set(blockData(b).inline ?? []);
  const arm = (label: string, input: string, index: number) => {
    const code = indent(body(b, input));
    if (inline.has(index) && code.trim()) {
      const [first, ...rest] = code.split("\n");
      return `${g.INDENT}${label} ${first.trimStart()}\n${rest.join("\n")}`;
    }
    return `${g.INDENT}${label}\n${code}`;
  };
  let code = `${lead(b, "Segun")} ${value(b, "VALUE", Order.NONE)}${kw(b, "Hacer")}\n`;
  for (let i = 0; i < cases; i++) code += arm(`${value(b, `CASE${i}`, Order.LIST + 1)}:`, `DO${i}`, i);
  if (b.getInput("OTHERWISE")) {
    code += arm(`${spelled(b, "otherwise", lead(b, "De Otro Modo"))}:`, "OTHERWISE", -1);
  }
  return `${code}${lead(b, "FinSegun")}\n`;
}

const COLLOQUIAL_COMPARISONS: Record<string, string[]> = {
  "=": ["ESIGUALA", "ESIGUALQUE", "ES"],
  "<>": ["ESDISTINTODE", "ESDISTINTADE", "ESDISTINTOA", "ESDISTINTAA", "ESDISTINTO", "ESDISTINTA"],
  "<": ["ESMENORQUE", "ESMENORA", "ESMENOR"],
  ">": ["ESMAYORQUE", "ESMAYORA", "ESMAYOR"],
  "<=": ["ESMENOROIGUALQUE", "ESMENOROIGUALA", "ESMENOROIGUAL", "ESIGUALOMENORQUE", "ESIGUALOMENORA", "ESIGUALOMENOR"],
  ">=": ["ESMAYOROIGUALQUE", "ESMAYOROIGUALA", "ESMAYOROIGUAL", "ESIGUALOMAYORQUE", "ESIGUALOMAYORA", "ESIGUALOMAYOR"],
};

/** The comparison as written: `==`, `!=`, or a colloquial phrase (`Es Mayor Que`) the profile allows. */
function comparisonOperator(b: Blockly.Block, op: string): { text: string; colloquial: boolean } {
  const spelling = blockData(b).spell?.op;
  if (!spelling) return { text: op, colloquial: false };
  if (/^[\p{L}\s]+$/u.test(spelling)) {
    return g.style.colloquial && COLLOQUIAL_COMPARISONS[op]?.includes(normalize(spelling))
      ? { text: spelling, colloquial: true }
      : { text: op, colloquial: false };
  }
  const symbols: Record<string, string[]> = { "=": ["=="], "<>": ["!="] };
  return { text: symbols[op]?.includes(spelling) ? spelling : op, colloquial: false };
}

const WAIT_UNITS: Record<string, string[]> = { Segundos: ["SEGUNDO"], Milisegundos: ["MILISEGUNDO"] };

const forBlock: Record<string, (block: Blockly.Block) => string | [string, number]> = {
  ps_algoritmo: (b) => {
    const keyword = String(b.getFieldValue("KEYWORD") ?? "Algoritmo");
    const closer = spelled(b, "end", keyword === "Proceso" ? "FinProceso" : "FinAlgoritmo", (a) =>
      ["FINPROCESO", "FINALGORITMO"].includes(normalize(a))
    );
    return `${spelled(b, "kw", keyword)} ${b.getFieldValue("NAME") || "SinTitulo"}\n${body(b, "BODY")}${closer}\n`;
  },
  ps_subproceso: routine,
  ps_raw_top: (b) => `${b.getFieldValue("CODE")}\n`,
  ps_raw: (b) => rawStatement(String(b.getFieldValue("CODE") ?? "")),
  ps_comentario: (b) => {
    const text = String(b.getFieldValue("TEXT") ?? "");
    return `//${text && blockData(b).spell?.tight !== "1" ? " " : ""}${text}\n`;
  },

  ps_escribir: (b) => {
    const synonyms = ["ESCRIBIR", "MOSTRAR", "IMPRIMIR", "INFORMAR"];
    const keyword = spelled(b, "kw", "Escribir", (a) => synonyms.includes(normalize(a)));
    const values = value(b, "VALUE", Order.LIST + 1);
    if (b.getFieldValue("NEWLINE") !== "FALSE") return `${keyword} ${values}${end()}`;
    const noNewline = spelled(b, "nonewline", "Sin Saltar", (a) => ["SINSALTAR", "SINBAJAR"].includes(normalize(a)));
    return blockData(b).spell?.before === "1"
      ? `${keyword} ${noNewline} ${values}${end()}`
      : `${keyword} ${values} ${noNewline}${end()}`;
  },
  ps_leer: (b) => `${lead(b, "Leer")} ${value(b, "TARGET", Order.LIST + 1)}${end()}`,

  ps_definir: (b) => {
    const type = String(b.getFieldValue("TYPE"));
    const typeName = spelled(b, "type", type, (a) => TYPE_OF[normalize(a)] === type);
    const short = blockData(b).spell?.es;
    if (short && /^(es|son)$/i.test(short)) return `${b.getFieldValue("NAMES")} ${short} ${typeName}${end()}`;
    return `${lead(b, "Definir")} ${b.getFieldValue("NAMES")}${kw(b, "Como")} ${typeName}${end()}`;
  },
  ps_asignar: (b) => `${value(b, "TARGET", Order.ATOMIC)} ${arrow(b)} ${value(b, "VALUE", Order.NONE)}${end()}`,
  ps_variable: (b) => [b.getFieldValue("NAME"), Order.ATOMIC],

  ps_si: (b) =>
    `${lead(b, "Si")} ${value(b, "COND", Order.NONE)}${kw(b, "Entonces")}\n${body(b, "THEN")}${lead(b, "FinSi")}\n`,
  ps_si_sino: (b) =>
    `${lead(b, "Si")} ${value(b, "COND", Order.NONE)}${kw(b, "Entonces")}\n${body(b, "THEN")}${lead(b, "SiNo")}\n${body(b, "ELSE")}${lead(b, "FinSi")}\n`,
  ps_segun: segun,
  ps_mientras: (b) =>
    `${lead(b, "Mientras")} ${value(b, "COND", Order.NONE)}${kw(b, "Hacer")}\n${body(b, "BODY")}${lead(b, "FinMientras")}\n`,
  ps_repetir: (b) => {
    const closer = b.getFieldValue("MODE") === "MIENTRAS" ? "Mientras Que" : "Hasta Que";
    return `${lead(b, "Repetir")}\n${body(b, "BODY")}${lead(b, closer)} ${value(b, "COND", Order.NONE)}\n`;
  },
  ps_para: (b) => {
    const step = value(b, "STEP", Order.NONE);
    // A default (shadow) step of 1 is left out, so PSeInt may count down when
    // the start is above the end; a step the student placed is always written.
    const stepBlock = b.getInputTargetBlock("STEP");
    const implicit = !step || (step === "1" && stepBlock?.isShadow());
    const withStep = implicit ? "" : `${kw(b, "Con Paso")} ${step}`;
    const from = value(b, "FROM", Order.NONE);
    const to = value(b, "TO", Order.NONE);
    return `${lead(b, "Para")} ${b.getFieldValue("VAR")} ${arrow(b, true)} ${from}${kw(b, "Hasta")} ${to}${withStep}${kw(b, "Hacer")}\n${body(b, "BODY")}${lead(b, "FinPara")}\n`;
  },
  ps_para_cada: (b) =>
    `${spelled(b, "kw", lead(b, "Para Cada"))} ${b.getFieldValue("VAR")}${kw(b, "de")} ${b.getFieldValue("ARRAY")}${kw(b, "Hacer")}\n${body(b, "BODY")}${lead(b, "FinPara")}\n`,

  ps_dimension: (b) => {
    const keyword = String(b.getFieldValue("KEYWORD") ?? "Dimension");
    const same = (a: string, c: string) => normalize(a).replace(/AR$/, "") === normalize(c).replace(/AR$/, "");
    const word = spelled(b, "kw", keyword, same);
    const items: string[] = [];
    for (let i = 0; b.getInput(`SIZE${i}`); i++) {
      items.push(indexed(b, b.getFieldValue(`NAME${i}`), value(b, `SIZE${i}`, Order.LIST + 1), `bracket${i}`));
    }
    return `${word} ${items.join(", ")}${end()}`;
  },
  ps_elemento: (b) => [indexed(b, b.getFieldValue("NAME"), value(b, "INDEX", Order.LIST + 1)), Order.ATOMIC],

  ps_limpiar: (b) => {
    const synonyms = ["LIMPIARPANTALLA", "BORRARPANTALLA"];
    return `${spelled(b, "kw", "Limpiar Pantalla", (a) => synonyms.includes(normalize(a)))}${end()}`;
  },
  ps_esperar_tecla: (b) => {
    const synonyms = ["ESPERARTECLA", "ESPERARUNATECLA"];
    return `${spelled(b, "kw", "Esperar Tecla", (a) => synonyms.includes(normalize(a)))}${end()}`;
  },
  ps_esperar: (b) => {
    const unit = String(b.getFieldValue("UNIT"));
    const word = spelled(b, "unit", unit, (a, c) => normalize(a) === normalize(c) || WAIT_UNITS[c]?.includes(normalize(a)));
    return `${lead(b, "Esperar")} ${value(b, "AMOUNT", Order.NONE)} ${word}${end()}`;
  },

  ps_llamada: (b) => `${call(b)}${end()}`,
  ps_llamada_valor: (b) => [call(b), Order.CALL],
  ps_retornar: (b) => {
    const result = value(b, "VALUE", Order.NONE);
    const keyword = spelled(b, "kw", "Retornar", (a) => ["RETORNAR", "RETURN"].includes(normalize(a)));
    return `${keyword}${result ? ` ${result}` : ""}${end()}`;
  },

  ps_numero: (b) => {
    const n = Number(b.getFieldValue("NUM"));
    const spelling = blockData(b).spell?.num;
    const text = spelling !== undefined && Number(spelling) === n ? spelling : String(n);
    return [text, n < 0 ? Order.UNARY : Order.ATOMIC];
  },
  ps_texto: (b) => [textLiteral(b, b.getFieldValue("TEXT")), Order.ATOMIC],
  ps_logico: (b) => [spelled(b, "value", b.getFieldValue("VALUE")), Order.ATOMIC],
  ps_aritmetica: (b) => {
    const op = b.getFieldValue("OP");
    const order =
      op === "^" ? Order.POWER : op === "*" || op === "/" || op === "MOD" ? Order.MULTIPLICATIVE : Order.ADDITIVE;
    // Blockly wraps an input when its order is >= the order passed here.
    // Left-associative: the left side may share our level, the right may not.
    // PSeInt rejects two operators in a row (`a * -1`), so a negative right side needs parentheses.
    const right = value(b, "B", order);
    return [`${value(b, "A", order + 1)} ${operator(b, op)} ${right.startsWith("-") ? `(${right})` : right}`, order];
  },
  // The operand is wrapped unless it is a name, number or call: `-(a + b)`, `-(x ^ 2)`.
  ps_negativo: (b) => [`-${value(b, "A", Order.POWER)}`, Order.UNARY],
  ps_comparar: (b) => {
    const op = b.getFieldValue("OP");
    const { text, colloquial } = comparisonOperator(b, op);
    // `=` and `<>` bind looser than `<`, `>`, `<=`, `>=`: `a < b = c > d`.
    const order = colloquial || op === "=" || op === "<>" ? Order.EQUALITY : Order.RELATIONAL;
    const operands = colloquial ? Order.RELATIONAL : order;
    return [`${value(b, "A", operands)} ${text} ${value(b, "B", operands)}`, order];
  },
  ps_logica: (b) => {
    const order = b.getFieldValue("OP") === "Y" ? Order.AND : Order.OR;
    return [`${value(b, "A", order + 1)} ${operator(b, b.getFieldValue("OP"))} ${value(b, "B", order + 1)}`, order];
  },
  ps_no: (b) => {
    const word = operator(b, "NO");
    // NO takes a whole comparison (`NO x > 3`), and another NO (`NO NO x`);
    // the symbol reads as if it bound tighter, so it gets parentheses: `~(x > 3)`.
    if (!/^\p{L}/u.test(word)) return [`${word}${value(b, "A", Order.UNARY)}`, Order.NOT];
    return [`${word} ${value(b, "A", Order.NOT + 1)}`, Order.NOT];
  },
  ps_es: (b) => colloquial(b, `Es ${b.getFieldValue("WHAT")}`),
  ps_es_divisible: (b) => colloquial(b, `Es ${b.getFieldValue("WHAT")}`, value(b, "B", Order.ADDITIVE)),
  ps_unir: (b) => [`${value(b, "A", Order.LIST + 1)}, ${value(b, "B", Order.LIST + 1)}`, Order.LIST],
  ps_constante: (b) => [
    `${spelled(b, "name", b.getFieldValue("NAME"))}${blockData(b).spell?.parens === "1" ? "()" : ""}`,
    Order.ATOMIC,
  ],
  ps_funcion: (b) => [`${spelled(b, "name", b.getFieldValue("NAME"))}(${value(b, "A", Order.NONE)})`, Order.CALL],
  ps_funcion2: (b) => [
    `${spelled(b, "name", b.getFieldValue("NAME"))}(${value(b, "A", Order.NONE)}, ${value(b, "B", Order.NONE)})`,
    Order.CALL,
  ],
  ps_funcion3: (b) => [
    `${spelled(b, "name", b.getFieldValue("NAME"))}(${value(b, "A", Order.NONE)}, ${value(b, "B", Order.NONE)}, ${value(b, "C", Order.NONE)})`,
    Order.CALL,
  ],
  ps_expresion: (b) => {
    const code = String(b.getFieldValue("CODE") ?? "");
    return [code, expressionOrder(code)];
  },
};

const TYPE_OF: Record<string, string> = {
  ENTERO: "Entero", ENTERA: "Entero", ENTEROS: "Entero", ENTERAS: "Entero",
  REAL: "Real", REALES: "Real", NUMERO: "Real", NUMEROS: "Real",
  NUMERICO: "Real", NUMERICOS: "Real", NUMERICA: "Real", NUMERICAS: "Real",
  CARACTER: "Caracter", CARACTERES: "Caracter", CADENA: "Caracter", CADENAS: "Caracter",
  TEXTO: "Caracter", TEXTOS: "Caracter",
  LOGICO: "Logico", LOGICOS: "Logico", LOGICA: "Logico", LOGICAS: "Logico",
};

/**
 * `x Es Par`, `n Es Divisible Por 3`. Written that way when the profile has
 * colloquial conditions; otherwise as the comparison PSeInt reads it as.
 */
function colloquial(b: Blockly.Block, phrase: string, right?: string): [string, number] {
  const left = value(b, "A", Order.ADDITIVE);
  if (g.style.colloquial) {
    const words = spelled(b, "phrase", phrase);
    return [`${left} ${words}${right === undefined ? "" : ` ${right}`}`, Order.EQUALITY];
  }
  const mod = operator(b, "MOD");
  const what = normalize(phrase);
  const code: Record<string, string> = {
    ESPAR: `${left} ${mod} 2 = 0`,
    ESIMPAR: `${left} ${mod} 2 <> 0`,
    ESPOSITIVO: `${left} > 0`,
    ESNEGATIVO: `${left} < 0`,
    ESCERO: `${left} = 0`,
    ESENTERO: `Trunc(${left}) = ${left}`,
  };
  return [code[what] ?? `${left} ${mod} ${right} = 0`, Order.EQUALITY];
}

/** Sequential instructions: they end with `;` when the profile asks for it, or when the program wrote one. */
const SIMPLE = new Set([
  "ps_escribir", "ps_leer", "ps_definir", "ps_asignar", "ps_dimension", "ps_limpiar",
  "ps_esperar_tecla", "ps_esperar", "ps_llamada", "ps_retornar",
]);

/** Statements write the blank lines before them, their `;` and trailing comment, and (while mapping) their marker. */
function statementCode(block: Blockly.Block, code: string): string {
  const data = blockData(block);
  if (data.spell?.semi === "1" && !g.style.semicolons && SIMPLE.has(block.type)) code = code.replace("\n", ";\n");
  const comment = block.getCommentText();
  if (comment !== null) {
    const at = code.indexOf("\n");
    const tail = ` //${comment ? " " : ""}${comment}`;
    code = at < 0 ? code + tail : `${code.slice(0, at)}${tail}${code.slice(at)}`;
  }
  if (g.marking) {
    code =
      block.type === "ps_raw" || block.type === "ps_raw_top"
        ? code.replace(/^(.*)$/gm, (line) => (line ? mark(block.id) + line : line))
        : mark(block.id) + code;
  }
  const blank = data.blank ?? 0;
  return block.getParent() && blank > 0 ? "\n".repeat(blank) + code : code;
}

for (const [type, fn] of Object.entries(forBlock)) {
  pseudocode.forBlock[type] = (block) => {
    const result = fn(block);
    if (Array.isArray(result)) {
      return blockData(block).paren ? [`(${result[0]})`, Order.ATOMIC] : result;
    }
    return statementCode(block, result);
  };
}
