/**
 * @jest-environment jsdom
 */
import * as Blockly from "blockly/core";

import { defineBlocks } from "../components/workspace/blocks/blocks-defs";
import {
  codeToBlocksState,
  lineToBlockMap,
  programToBlocksState,
} from "../components/workspace/blocks/blocks-from-code";
import { pseudocode } from "../components/workspace/blocks/blocks-generator";
import { routinesFlyout } from "../components/workspace/blocks/blocks-routines";
import { examplePrograms, Interpreter, Parser, parseInputText, type Runtime, type StatementNode } from "../engine";

// Under Jest, "blockly/core" resolves to Blockly's node entry, which loads an
// ESM-only jsdom; the browser build runs fine on the jsdom test environment.
jest.mock("blockly/core", () => jest.requireActual("../../node_modules/blockly/blockly_compressed.js"));

defineBlocks();

const CODE_BLOCKS = new Set(["ps_raw", "ps_raw_top", "ps_expresion"]);

function load(state: object): Blockly.Workspace {
  const workspace = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(state, workspace);
  return workspace;
}

function blocksFor(source: string): Blockly.Workspace {
  const result = codeToBlocksState(source, {});
  if ("error" in result) throw new Error(result.error);
  return load(result.state);
}

const toCode = (source: string) => pseudocode.workspaceToCode(blocksFor(source));

/** The body of the main algorithm as generated, without the header, footer and indentation. */
const bodyOf = (code: string) =>
  code
    .split("\n")
    .slice(1, -2)
    .map((line) => line.replace(/^\t/, ""))
    .join("\n");

const program = (body: string) => `Algoritmo Prueba\n${body}\nFinAlgoritmo\n`;
/** A program written the way the generator writes it: the body indented with tabs. */
const indented = (body: string) => program(body.replace(/^/gm, "\t"));

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

async function run(source: string, input: string[]) {
  const queue = [...input];
  const output: string[] = [];
  let pending = "";
  const runtime: Runtime = {
    write(value, newline = true) {
      pending += value;
      if (newline) {
        output.push(pending);
        pending = "";
      }
    },
    read() {
      if (queue.length === 0) throw new Error("ran out of sample input");
      return queue.shift()!;
    },
    clear() {
      output.push("<limpiar>");
    },
    async sleep() {},
    async waitForKey() {},
  };
  const result = await new Interpreter({ random: seeded(42) }).run(source, runtime);
  return { state: result.state, diagnostics: result.diagnostics, output: pending ? [...output, pending] : output };
}

function blockTypes(workspace: Blockly.Workspace): string[] {
  return workspace.getAllBlocks(false).map((block) => block.type);
}

describe("blocks round trip of every example", () => {
  const fallbackFree: string[] = [];
  const withFallback: string[] = [];

  afterAll(() => {
    // Examples that became blocks with no code (raw/expresion) fallback.
    if (withFallback.length) console.log(`With code fallback: ${withFallback.join(", ")}`);
  });

  it.each(examplePrograms.map((example) => [example.id, example] as const))("%s", async (_id, example) => {
    const parsed = new Parser(example.source, { settings: {} }).parse();
    expect(parsed.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    const workspace = load(programToBlocksState(parsed.program!, example.source));
    const code = pseudocode.workspaceToCode(workspace);

    const reparsed = new Parser(code, { settings: {} }).parse();
    expect(reparsed.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    // Converting the generated code again is stable.
    expect(toCode(code)).toBe(code);

    const input = parseInputText(example.input ?? "");
    const [original, regenerated] = await Promise.all([run(example.source, input), run(code, input)]);
    expect(regenerated).toEqual(original);

    // The default profile gives the very same text back, comments and blank lines included.
    expect(code).toBe(example.source);

    const fallbacks = blockTypes(workspace).filter((type) => CODE_BLOCKS.has(type));
    (fallbacks.length === 0 ? fallbackFree : withFallback).push(
      fallbacks.length === 0 ? example.id : `${example.id} (${fallbacks.length})`
    );
  });

  it("converts every example without code fallback", () => {
    expect(withFallback).toEqual([]);
  });
});

/** The same blocks with nothing remembered about how the code was written (as if built by hand). */
function plain(workspace: Blockly.Workspace): Blockly.Workspace {
  for (const block of workspace.getAllBlocks(false)) block.data = null;
  return workspace;
}

describe("generator", () => {
  // Blocks built by hand: only the parentheses the tree needs.
  it.each([
    ["x <- (a + b) * c", "x <- (a + b) * c"],
    ["x <- a - (b - c)", "x <- a - (b - c)"],
    ["x <- a - b - c", "x <- a - b - c"],
    ["x <- a ^ (b ^ c)", "x <- a ^ (b ^ c)"],
    ["x <- 2 * (-1)", "x <- 2 * (-1)"],
    ["x <- a + b * c", "x <- a + b * c"],
    ["x <- -(a + b)", "x <- -(a + b)"],
    ["x <- -(a ^ 2)", "x <- -(a ^ 2)"],
    ["x <- (-a) ^ 2", "x <- (-a) ^ 2"],
    ["l <- NO (a Y b)", "l <- NO (a Y b)"],
    ["l <- NO x > 3", "l <- NO x > 3"],
    ["l <- NO NO x", "l <- NO NO x"],
    ["l <- (NO a) Y b", "l <- NO a Y b"],
    ["l <- a O b Y c", "l <- a O b Y c"],
    ["l <- (a O b) Y c", "l <- (a O b) Y c"],
    ["l <- (a < b) = c", "l <- a < b = c"],
    ["l <- a = (b = c)", "l <- a = (b = c)"],
    ["x <- 10 % 3", "x <- 10 MOD 3"],
    ["x <- Raiz(16) + Aleatorio(1, 6)", "x <- Raiz(16) + Aleatorio(1, 6)"],
    ["Leer m[1, 2]", "Leer m[1, 2]"],
  ])("%s", (line, expected) => {
    expect(bodyOf(pseudocode.workspaceToCode(plain(blocksFor(program(line)))))).toBe(expected);
  });

  // Converted code keeps how it was written, parentheses and spellings included.
  it.each([
    "l <- (NO a) Y b",
    "x <- (a)",
    "x <- 10 % 3",
    "Mostrar \"hola\"",
    "escribir Sin Saltar \"a\", b",
    "Definir n Como Enteros",
    "x := 1",
    "Si a == b Y c != d Entonces\n\tx <- raiz(2)\nFinSi",
    "si x > 0 entonces\n\tx <- 0\nfinsi",
    "Mientras x > 0\n\tx <- x - 1\nFinMientras",
    "Para i Desde 1 Hasta 3\n\tEscribir i\nFinPara",
    "Para Cada x En datos Hacer\n\tEscribir x\nFinPara",
    "Dimension a(3), m[2, 4]",
    "Leer a(1)",
    "a <- 1; b <- 2",
    "Escribir 1;",
    "x <- .5 + 1.50",
    "t <- 'hola'",
    "Borrar Pantalla",
    "Esperar 1 Segundo",
    "Esperar Una Tecla",
    "x <- PI * FechaActual() + euler",
  ])("%s", (body) => {
    const source = indented(body);
    expect(toCode(source)).toBe(source);
  });

  it("writes several values and Sin Saltar", () => {
    expect(bodyOf(toCode(program('Escribir "a", 1, x Sin Saltar\nEscribir "fin"')))).toBe(
      'Escribir "a", 1, x Sin Saltar\nEscribir "fin"'
    );
  });

  it("keeps Leer with several targets as one statement", () => {
    expect(bodyOf(toCode(program("Leer a, b[2]")))).toBe("Leer a, b[2]");
  });

  it("writes Para with Con Paso, and leaves out an implicit step", () => {
    const code = toCode(program("Para i <- 10 Hasta 1 Con Paso -2 Hacer\nEscribir i\nFinPara\nPara j <- 1 Hasta 3 Hacer\nEscribir j\nFinPara"));
    expect(bodyOf(code)).toBe("Para i <- 10 Hasta 1 Con Paso -2 Hacer\n\tEscribir i\nFinPara\nPara j <- 1 Hasta 3 Hacer\n\tEscribir j\nFinPara");
  });

  it("keeps an explicit Con Paso 1", () => {
    expect(bodyOf(toCode(program("Para i <- 3 Hasta 1 Con Paso 1 Hacer\nEscribir i\nFinPara")))).toContain("Con Paso 1");
  });

  it("writes Repetir Mientras Que and Hasta Que", () => {
    const code = toCode(program("Repetir\nx <- x + 1\nMientras Que x < 3\nRepetir\nx <- x - 1\nHasta Que x = 0"));
    expect(bodyOf(code)).toBe("Repetir\n\tx <- x + 1\nMientras Que x < 3\nRepetir\n\tx <- x - 1\nHasta Que x = 0");
  });

  it("gives every statement kind a block", () => {
    const source = [
      "Funcion r <- Doble(x Por Valor)",
      "\tr <- x * 2",
      "FinFuncion",
      "",
      "SubProceso Cambiar(a Por Referencia)",
      "\ta <- -a",
      "\tRetornar",
      "FinSubProceso",
      "",
      "Algoritmo Prueba",
      "\tDefinir n, m Como Entero",
      "\tDimension datos[5], m2[2, 3]",
      "\tRedimensionar datos[10]",
      "\tLeer n",
      "\tSi n Es Par Y n Es Divisible Por 3 Entonces",
      "\t\tEscribir Subcadena(\"hola\", 1, 2), Tan(1), Asen(1)",
      "\tSiNo",
      "\t\tEscribir Doble(n)",
      "\tFinSi",
      "\tSegun n Hacer",
      "\t\t1, 2:",
      "\t\t\tCambiar(n)",
      "\t\tDe Otro Modo:",
      "\t\t\tm2[1, 2] <- 0",
      "\tFinSegun",
      "\tMientras n > 0 Hacer",
      "\t\tn <- n - 1",
      "\tFinMientras",
      "\tPara Cada x de datos Hacer",
      "\t\tEscribir x",
      "\tFinPara",
      "\tLimpiar Pantalla",
      "\tEsperar Tecla",
      "\tEsperar 2 Segundos",
      "\tEsperar 300 Milisegundos",
      "FinAlgoritmo",
      "",
    ].join("\n");
    const workspace = blocksFor(source);
    expect(blockTypes(workspace).filter((type) => CODE_BLOCKS.has(type))).toEqual([]);
    expect(pseudocode.workspaceToCode(workspace)).toBe(source);
  });
});

describe("comments and blank lines", () => {
  const source = [
    "// Suma dos números",
    "//sin espacio",
    "",
    "SubProceso Saludar(nombre)",
    '\tEscribir "Hola ", nombre // saluda',
    "FinSubProceso",
    "",
    "",
    "// El algoritmo",
    "Algoritmo Prueba",
    "\t// primero",
    "\tx <- 1",
    "",
    "\tSi x > 0 Entonces",
    "\t\t// dentro",
    '\t\tSaludar("Ana")',
    "\t\t// al final del Si",
    "\tSiNo",
    "\t\t// en el SiNo",
    "\tFinSi // fin",
    "\t// antes del cierre",
    "FinAlgoritmo",
    "// al final",
    "",
  ].join("\n");

  it("keeps every comment and blank line", () => {
    expect(toCode(source)).toBe(source.replace("\tFinSi // fin\n", "\tFinSi\n\t// fin\n"));
  });

  it("makes comment lines comment blocks, and a trailing comment the block's comment", () => {
    const workspace = blocksFor(source);
    const comments = workspace.getBlocksByType("ps_comentario", false).map((b) => b.getFieldValue("TEXT"));
    expect(comments).toEqual(expect.arrayContaining(["Suma dos números", "primero", "dentro", "en el SiNo", "al final"]));
    const write = workspace.getBlocksByType("ps_escribir", false)[0];
    expect(write.getCommentText()).toBe("saluda");
    // Loose comments at the top are a stack of their own, before the SubProceso.
    expect(workspace.getTopBlocks(true).map((b) => b.type)).toEqual([
      "ps_comentario",
      "ps_subproceso",
      "ps_comentario",
      "ps_algoritmo",
      "ps_comentario",
    ]);
  });

  it("keeps the indentation a program was written with", () => {
    const spaces = "Algoritmo A\n    Si x > 0 Entonces\n        x <- 1\n    FinSi\nFinAlgoritmo\n";
    expect(toCode(spaces)).toBe(spaces);
  });
});

describe("Segun", () => {
  it("has a socket and body per case, several values per case, and De Otro Modo", () => {
    const source = indented(
      ["Segun letra Hacer", '\t"a", "e":', "\t\tv <- v + 1", '\t" ":', "\t\te <- e + 1", "\tDe Otro Modo:", "\t\totros <- otros + 1", "FinSegun"].join("\n")
    );
    const workspace = blocksFor(source);
    const segun = workspace.getBlocksByType("ps_segun", false)[0];
    expect(segun.saveExtraState!()).toEqual({ cases: 2, otherwise: true });
    expect(segun.getInputTargetBlock("CASE0")?.type).toBe("ps_unir");
    expect(segun.getInputTargetBlock("DO1")?.type).toBe("ps_asignar");
    expect(pseudocode.workspaceToCode(workspace)).toBe(source);
  });

  it("keeps a case written on one line, and `5, 6 o 7` as a list", () => {
    const source = program("Segun x Hacer\n\t1: Escribir 1\n\t5, 6 o 7:\n\t\tEscribir 2\n\tDe Otro Modo: Escribir 3\nFinSegun");
    expect(bodyOf(toCode(source))).toBe("Segun x Hacer\n\t1: Escribir 1\n\t5, 6, 7:\n\t\tEscribir 2\n\tDe Otro Modo: Escribir 3\nFinSegun");
  });

  it("keeps a comment before the first case", () => {
    const source = indented("Segun x Hacer\n\t// los casos\n\t1:\n\t\tEscribir 1\nFinSegun");
    expect(toCode(source)).toBe(source.replace("\t\t// los casos\n\t\t1:\n", "\t\t1:\n\t\t\t// los casos\n"));
  });

  it("grows and shrinks with + and −, keeping the blocks in the cases that stay", () => {
    const workspace = blocksFor(program("Segun x Hacer\n\t1:\n\t\tEscribir 1\n\t2:\n\t\tEscribir 2\nFinSegun"));
    const segun = workspace.getBlocksByType("ps_segun", false)[0];
    click(segun, "PLUS");
    expect(segun.getInput("CASE2")).toBeTruthy();
    click(segun, "MINUS");
    click(segun, "MINUS");
    expect(segun.getInput("CASE1")).toBeNull();
    expect(segun.getInputTargetBlock("DO0")?.type).toBe("ps_escribir");
  });
});

/** Clicks a + / − button on a block. */
function click(block: Blockly.Block, name: "PLUS" | "MINUS") {
  const field = block.getField(name) as unknown as { showEditor_: () => void };
  field.showEditor_();
}

describe("SubProcesos and Funciones", () => {
  const source = [
    "Funcion corte <- Particionar(datos, izquierda, derecha)",
    "\tcorte <- izquierda",
    "FinFuncion",
    "",
    "SubProceso Ver(texto Por Referencia)",
    "\tEscribir texto",
    "FinSubProceso",
    "",
    "SubProceso Saludar",
    '\tEscribir "hola"',
    "FinSubProceso",
    "",
    "Algoritmo Prueba",
    "\tc <- Particionar(d, 1, 2) + 1",
    '\tVer(t)',
    "\tSaludar",
    "FinAlgoritmo",
    "",
  ].join("\n");

  it("makes a definition block per routine and call blocks with a socket per argument", () => {
    const workspace = blocksFor(source);
    const defs = workspace.getBlocksByType("ps_subproceso", false);
    expect(defs.map((d) => [d.getFieldValue("KIND"), d.getFieldValue("NAME")])).toEqual([
      ["Funcion", "Particionar"],
      ["SubProceso", "Ver"],
      ["SubProceso", "Saludar"],
    ]);
    expect(defs[0].getFieldValue("RESULT")).toBe("corte");
    expect(defs[1].getFieldValue("MODE0")).toBe("REF");
    const reporter = workspace.getBlocksByType("ps_llamada_valor", false)[0];
    expect([reporter.getInput("ARG2"), reporter.getInput("ARG3")].map(Boolean)).toEqual([true, false]);
    expect(workspace.getBlocksByType("ps_llamada", false).map((b) => b.saveExtraState!())).toEqual([
      { name: "Ver", args: ["texto"] },
      { name: "Saludar", args: [], parens: false },
    ]);
    expect(pseudocode.workspaceToCode(workspace)).toBe(source);
  });

  it("renames every call when the definition is renamed", () => {
    const workspace = blocksFor(source);
    const def = workspace.getBlocksByType("ps_subproceso", false)[0];
    def.setFieldValue("Partir", "NAME");
    const code = pseudocode.workspaceToCode(workspace);
    expect(code).toContain("Funcion corte <- Partir(datos, izquierda, derecha)");
    expect(code).toContain("c <- Partir(d, 1, 2) + 1");
  });

  it("refuses a name another routine has, and a name that is not one", () => {
    const workspace = blocksFor(source);
    const def = workspace.getBlocksByType("ps_subproceso", false)[2];
    def.setFieldValue("ver", "NAME");
    expect(def.getFieldValue("NAME")).toBe("ver2");
    def.setFieldValue("dos palabras!", "NAME");
    expect(def.getFieldValue("NAME")).toBe("ver2");
  });

  it("adds and removes a socket on every call when a parameter is added or removed", () => {
    const workspace = blocksFor(source);
    const def = workspace.getBlocksByType("ps_subproceso", false)[1];
    click(def, "PLUS");
    expect(def.getField("PARAM1")).toBeTruthy();
    const call = workspace.getBlocksByType("ps_llamada", false)[0];
    expect(call.getInput("ARG1")).toBeTruthy();
    click(def, "MINUS");
    click(def, "MINUS");
    expect(call.getInput("ARG0")).toBeNull();
    expect(pseudocode.workspaceToCode(workspace)).toContain("SubProceso Ver()\n");
    expect(pseudocode.workspaceToCode(workspace)).toContain("\tVer()\n");
  });

  it("undoes a parameter change on the definition and its calls together", async () => {
    const workspace = blocksFor(source);
    const def = workspace.getBlocksByType("ps_subproceso", false)[1];
    click(def, "PLUS");
    await new Promise((resolve) => setTimeout(resolve, 10));
    // Definition and call changed as one undoable step.
    expect(new Set(workspace.getUndoStack().map((e) => e.group)).size).toBe(1);
    workspace.undo(false);
    expect(def.getField("PARAM1")).toBeNull();
    expect(workspace.getBlocksByType("ps_llamada", false)[0].getInput("ARG1")).toBeNull();
  });

  it("offers new definitions, Retornar and a call for each routine in the palette", () => {
    const workspace = blocksFor(source);
    const items = routinesFlyout(workspace as Blockly.WorkspaceSvg) as { type?: string; extraState?: { name?: string } }[];
    const calls = items.filter((item) => item.type?.startsWith("ps_llamada")).map((item) => `${item.type}:${item.extraState?.name}`);
    expect(items.slice(0, 3).map((item) => item.type)).toEqual(["ps_subproceso", "ps_subproceso", "ps_retornar"]);
    expect(calls).toEqual(["ps_llamada:Particionar", "ps_llamada_valor:Particionar", "ps_llamada:Saludar", "ps_llamada:Ver"]);
  });
});

describe("lineToBlockMap", () => {
  const kindsOf: Record<string, string[]> = {
    write: ["ps_escribir"],
    read: ["ps_leer"],
    assignment: ["ps_asignar"],
    define: ["ps_definir"],
    dimension: ["ps_dimension"],
    if: ["ps_si", "ps_si_sino"],
    switch: ["ps_segun"],
    while: ["ps_mientras"],
    repeat: ["ps_repetir"],
    for: ["ps_para"],
    forEach: ["ps_para_cada"],
    clear: ["ps_limpiar"],
    wait: ["ps_esperar", "ps_esperar_tecla"],
    expression: ["ps_llamada"],
    return: ["ps_retornar"],
  };

  function statementsOf(body: StatementNode[], into: StatementNode[] = []): StatementNode[] {
    for (const statement of body) {
      into.push(statement);
      if (statement.kind === "if") {
        statementsOf(statement.thenBranch, into);
        statementsOf(statement.elseBranch, into);
      } else if (statement.kind === "switch") {
        for (const c of statement.cases) statementsOf(c.body, into);
        statementsOf(statement.defaultCase, into);
      } else if ("body" in statement) {
        statementsOf(statement.body, into);
      }
    }
    return into;
  }

  it.each(examplePrograms.map((example) => [example.id, example] as const))("%s", (_id, example) => {
    const result = codeToBlocksState(example.source, {});
    if ("error" in result) throw new Error(result.error);
    const workspace = load(result.state);
    const code = pseudocode.workspaceToCode(workspace);
    const parsed = new Parser(code, { settings: {} }).parse().program!;
    // Both maps: the one made while converting (for the code as loaded) and the generated code's.
    for (const map of [result.lines, lineToBlockMap(workspace, code, {})]) {
      for (const statement of [parsed.entry, ...parsed.routines].flatMap((part) => statementsOf(part.body))) {
        const line = statement.span!.start.line;
        const block = workspace.getBlockById(map.get(line) ?? "");
        expect([line, kindsOf[statement.kind]]).toEqual([line, expect.arrayContaining([block?.type])]);
      }
      for (const part of [parsed.entry, ...parsed.routines]) {
        const header = workspace.getBlockById(map.get(part.span!.start.line) ?? "");
        expect(header?.type).toBe(part.type === "MainRoutine" ? "ps_algoritmo" : "ps_subproceso");
      }
    }
  });

  it("follows code blocks of several lines, and skips disabled blocks", () => {
    const workspace = blocksFor(program("Si x > 0 Entonces\nEscribir 2\nFinSi\nEscribir 3"));
    const raw = workspace.newBlock("ps_raw");
    raw.setFieldValue("Escribir 1\nEscribir 1", "CODE");
    workspace.getBlocksByType("ps_algoritmo", false)[0].getInput("BODY")!.connection!.connect(raw.previousConnection!);
    raw.nextConnection!.connect(workspace.getBlocksByType("ps_si", false)[0].previousConnection!);
    const disabled = workspace.getBlocksByType("ps_escribir", false).find((b) => b.getParent()?.type === "ps_si")!;
    disabled.setDisabledReason(true, "test");
    const code = pseudocode.workspaceToCode(workspace);
    expect(code).toBe("Algoritmo Prueba\n\tEscribir 1\n\tEscribir 1\n\tSi x > 0 Entonces\n\tFinSi\n\tEscribir 3\nFinAlgoritmo\n");
    const map = lineToBlockMap(workspace, code, {});
    const typeAt = (line: number) => workspace.getBlockById(map.get(line)!)?.type;
    expect([1, 2, 3, 4, 6].map(typeAt)).toEqual(["ps_algoritmo", "ps_raw", "ps_raw", "ps_si", "ps_escribir"]);
  });

  it("is empty for code the blocks did not write", () => {
    const workspace = blocksFor(program("Escribir 1"));
    expect(lineToBlockMap(workspace, "otra cosa\n", {}).size).toBe(0);
  });
});

describe("codeToBlocksState", () => {
  it("returns an error for code that does not parse", () => {
    const result = codeToBlocksState("Algoritmo Roto\n  Si x > Entonces\nFinAlgoritmo\n", {});
    expect(result).toEqual({ error: expect.any(String) });
  });

  it("returns a state Blockly can load", () => {
    const result = codeToBlocksState(program("Escribir 1"), {});
    expect("state" in result && result.state.blocks.blocks[0].type).toBe("ps_algoritmo");
  });
});
