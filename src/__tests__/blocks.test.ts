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
import { examplePrograms, Interpreter, Parser, parseInputText, type Runtime, type StatementNode } from "../engine";

// Under Jest, "blockly/core" resolves to Blockly's node entry, which loads an
// ESM-only jsdom; the browser build runs fine on the jsdom test environment.
jest.mock("blockly/core", () => jest.requireActual("../../node_modules/blockly/blockly_compressed.js"));

defineBlocks();

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
    // Coverage report: examples that became blocks with no code (raw/expresion) fallback.
    console.log(
      `blocks: ${fallbackFree.length}/${examplePrograms.length} examples convert with no code fallback.\n` +
        `With fallback: ${withFallback.join(", ")}`
    );
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

    const fallbacks = blockTypes(workspace).filter((type) => type === "ps_raw" || type === "ps_expresion");
    (fallbacks.length === 0 ? fallbackFree : withFallback).push(
      fallbacks.length === 0 ? example.id : `${example.id} (${fallbacks.length})`
    );
  });

  it("converts most examples without code fallback", () => {
    expect(fallbackFree.length).toBeGreaterThanOrEqual(examplePrograms.length / 2);
  });
});

describe("generator", () => {
  it.each([
    ["x <- (a + b) * c", "x <- (a + b) * c"],
    ["x <- a - (b - c)", "x <- a - (b - c)"],
    ["x <- a - b - c", "x <- a - b - c"],
    ["x <- a ^ (b ^ c)", "x <- a ^ (b ^ c)"],
    ["x <- 2 * (-1)", "x <- 2 * (-1)"],
    ["x <- a + b * c", "x <- a + b * c"],
    ["l <- NO (a Y b)", "l <- NO (a Y b)"],
    ["l <- NO x > 3", "l <- NO x > 3"],
    ["l <- (NO a) Y b", "l <- NO a Y b"],
    ["l <- a O b Y c", "l <- a O b Y c"],
    ["l <- (a O b) Y c", "l <- (a O b) Y c"],
    ["l <- (a < b) = c", "l <- (a < b) = c"],
    ["x <- 10 MOD 3", "x <- 10 MOD 3"],
    ["x <- Raiz(16) + Aleatorio(1, 6)", "x <- Raiz(16) + Aleatorio(1, 6)"],
    ["Leer m[1, 2]", "Leer m[1, 2]"],
  ])("%s", (line, expected) => {
    expect(bodyOf(toCode(program(line)))).toBe(expected);
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
    const code = toCode(program("Para i <- 10 Hasta 1 Con Paso -2 Hacer\nEscribir i\nFinPara\nPara j <- 1 Hasta 3\nEscribir j\nFinPara"));
    expect(bodyOf(code)).toBe("Para i <- 10 Hasta 1 Con Paso -2 Hacer\n\tEscribir i\nFinPara\nPara j <- 1 Hasta 3 Hacer\n\tEscribir j\nFinPara");
  });

  it("keeps an explicit Con Paso 1", () => {
    expect(bodyOf(toCode(program("Para i <- 3 Hasta 1 Con Paso 1 Hacer\nEscribir i\nFinPara")))).toContain("Con Paso 1");
  });

  it("writes Repetir Mientras Que and Hasta Que", () => {
    const code = toCode(program("Repetir\nx <- x + 1\nMientras Que x < 3\nRepetir\nx <- x - 1\nHasta Que x = 0"));
    expect(bodyOf(code)).toBe("Repetir\n\tx <- x + 1\nMientras Que x < 3\nRepetir\n\tx <- x - 1\nHasta Que x = 0");
  });

  it("maps every statement kind with a block", () => {
    const source = program(
      [
        "Definir n, m Como Entero",
        "Dimension datos[5]",
        "Leer n",
        "Si n > 0 Entonces",
        "Escribir 1",
        "SiNo",
        "Escribir 2",
        "FinSi",
        "Mientras n > 0 Hacer",
        "n <- n - 1",
        "FinMientras",
        "Para Cada x de datos Hacer",
        "Escribir x",
        "FinPara",
        "Limpiar Pantalla",
        "Esperar Tecla",
        "Esperar 2 Segundos",
        "Esperar 300 Milisegundos",
      ].join("\n")
    );
    const workspace = blocksFor(source);
    expect(blockTypes(workspace)).not.toContain("ps_raw");
    expect(blockTypes(workspace)).not.toContain("ps_expresion");
    expect(bodyOf(pseudocode.workspaceToCode(workspace))).toContain("Esperar 2 Segundos\nEsperar 300 Milisegundos");
  });

  it("keeps statements without a block as code, and routines as top code blocks", () => {
    const source = [
      "SubProceso Saludar(nombre)",
      '    Escribir "Hola ", nombre',
      "FinSubProceso",
      "",
      "Algoritmo Prueba",
      "    Segun x Hacer",
      "        1: Escribir 1",
      "        De Otro Modo: Escribir 2",
      "    FinSegun",
      "    Dimension m[2, 3]",
      '    Saludar("Ana")',
      "FinAlgoritmo",
    ].join("\n");
    const workspace = blocksFor(source);
    const top = workspace.getTopBlocks(true);
    expect(top.map((block) => block.type)).toEqual(["ps_algoritmo", "ps_raw_top"]);
    expect(top[1].getFieldValue("CODE")).toBe(
      'SubProceso Saludar(nombre)\n    Escribir "Hola ", nombre\nFinSubProceso'
    );
    const raws = workspace.getBlocksByType("ps_raw", true).map((block) => block.getFieldValue("CODE"));
    expect(raws).toEqual(["Segun x Hacer\n    1: Escribir 1\n    De Otro Modo: Escribir 2\nFinSegun", "Dimension m[2, 3]"]);
    expect(workspace.getBlocksByType("ps_llamar", false)[0].getFieldValue("ARGS")).toBe('"Ana"');
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
    while: ["ps_mientras"],
    repeat: ["ps_repetir"],
    for: ["ps_para"],
    forEach: ["ps_para_cada"],
    clear: ["ps_limpiar"],
    wait: ["ps_esperar", "ps_esperar_tecla"],
    expression: ["ps_llamar"],
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
    const workspace = blocksFor(example.source);
    const code = pseudocode.workspaceToCode(workspace);
    const map = lineToBlockMap(workspace, code, {});
    const parsed = new Parser(code, { settings: {} }).parse().program!;

    const main = statementsOf(parsed.entry.body);
    expect(main.length).toBeGreaterThan(0);
    for (const statement of main) {
      const line = statement.span!.start.line;
      const block = workspace.getBlockById(map.get(line) ?? "");
      expect([line, block?.type]).toEqual([line, expect.any(String)]);
      // A statement maps to its own block, or to the code block that holds it.
      const allowed = [...(kindsOf[statement.kind] ?? []), "ps_raw"];
      expect([line, allowed]).toEqual([line, expect.arrayContaining([block!.type])]);
    }
    for (const routine of parsed.routines) {
      for (const statement of statementsOf(routine.body)) {
        expect(workspace.getBlockById(map.get(statement.span!.start.line) ?? "")?.type).toBe("ps_raw_top");
      }
    }
  });

  it("follows code blocks of several lines and disabled blocks", () => {
    const workspace = blocksFor(
      program("Segun x Hacer\n1: Escribir 1\nFinSegun\nSi x > 0 Entonces\nEscribir 2\nFinSi\nEscribir 3")
    );
    const disabled = workspace.getBlocksByType("ps_escribir", false).find((b) => b.getParent()?.type === "ps_si")!;
    disabled.setDisabledReason(true, "test");
    const code = pseudocode.workspaceToCode(workspace);
    expect(code).toBe("Algoritmo Prueba\n\tSegun x Hacer\n\t1: Escribir 1\n\tFinSegun\n\tSi x > 0 Entonces\n\tFinSi\n\tEscribir 3\nFinAlgoritmo\n");
    const map = lineToBlockMap(workspace, code, {});
    const typeAt = (line: number) => workspace.getBlockById(map.get(line)!)?.type;
    expect([2, 3, 5, 7].map(typeAt)).toEqual(["ps_raw", "ps_raw", "ps_si", "ps_escribir"]);
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
