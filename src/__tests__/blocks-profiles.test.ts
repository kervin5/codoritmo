/**
 * @jest-environment jsdom
 */
import * as Blockly from "blockly/core";

import { defineBlocks } from "../components/workspace/blocks/blocks-defs";
import { codeToBlocksState, lineToBlockMap } from "../components/workspace/blocks/blocks-from-code";
import { pseudocode } from "../components/workspace/blocks/blocks-generator";
import {
  examplePrograms,
  getEngineProfile,
  normalizeEngineSettings,
  Parser,
  type EngineSettings,
} from "../engine";

// See blocks.test.ts: the browser build of Blockly runs on jsdom.
jest.mock("blockly/core", () => jest.requireActual("../../node_modules/blockly/blockly_compressed.js"));

defineBlocks();

function settingsOf(id: string): EngineSettings {
  const profile = getEngineProfile(id);
  if (!profile) throw new Error(`no profile ${id}`);
  return profile.settings;
}

function blocksFor(source: string, settings: Partial<EngineSettings>): Blockly.Workspace {
  const result = codeToBlocksState(source, settings);
  if ("error" in result) throw new Error(result.error);
  const workspace = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(result.state, workspace);
  return workspace;
}

/** Code → blocks → code, both ways under the same profile, as the Bloques mode does. */
const roundTrip = (source: string, settings: Partial<EngineSettings>) =>
  pseudocode.workspaceToCode(blocksFor(source, settings), settings);

const errorsOf = (source: string, settings: Partial<EngineSettings>) =>
  new Parser(source, { settings })
    .parse()
    .diagnostics.filter((d) => d.severity === "error")
    .map((d) => `${d.line}:${d.column} ${d.code ?? ""} ${d.message}`);

// Real school profiles: CUC requires `;`, has word operators off and strict
// syntax; AIEP requires `;` with word operators; Estricto has symbols only.
const CUC = settingsOf("CUC");
const AIEP = settingsOf("AIEP");
const ESTRICTO = settingsOf("estricto");

describe("Bloques keeps the profile's form", () => {
  const semicolons = [
    "Algoritmo Notas",
    "\tDefinir n, i Como Entero;",
    "\tDefinir total Como Real;",
    "\tDimension notas[5];",
    "\tLimpiar Pantalla;",
    '\tEscribir "Cuantas notas?" Sin Saltar;',
    "\tLeer n;",
    "\ttotal <- 0;",
    "\tPara i <- 1 Hasta n Con Paso 1 Hacer",
    "\t\tLeer notas[i];",
    "\t\ttotal <- total + notas[i];",
    "\tFinPara",
    "\tSi total > 10 && n % 2 = 0 Entonces",
    '\t\tEscribir "par", total;',
    "\tSiNo",
    "\t\tMientras ~(n > 3 || n < 0) Hacer",
    "\t\t\tn <- n - 1;",
    "\t\tFinMientras",
    "\tFinSi",
    "\tRepetir",
    "\t\tn <- n + 1;",
    "\tHasta Que n >= 10",
    "\tEsperar 1 Segundos;",
    "\tEsperar Tecla;",
    "FinAlgoritmo",
    "",
  ].join("\n");

  it("writes ; and symbol operators for a profile that requires them (CUC)", () => {
    // The source is valid under CUC to begin with.
    expect(errorsOf(semicolons, CUC)).toEqual([]);
    const code = roundTrip(semicolons, CUC);
    expect(code).toBe(semicolons);
    expect(errorsOf(code, CUC)).toEqual([]);
  });

  it("writes ; with word operators when the profile keeps them (AIEP)", () => {
    const source = semicolons
      .replace("total > 10 && n % 2 = 0", "total > 10 Y n MOD 2 = 0")
      .replace("~(n > 3 || n < 0)", "NO (n > 3 O n < 0)");
    expect(errorsOf(source, AIEP)).toEqual([]);
    const code = roundTrip(source, AIEP);
    expect(code).toBe(source);
    expect(errorsOf(code, AIEP)).toEqual([]);
  });

  it("writes symbol operators without ; (Estricto)", () => {
    const source = [
      "Algoritmo Logica",
      "\tDefinir a, b Como Logico;",
      "\tDefinir x Como Entero;",
      "\tLeer a, b, x;",
      "\tSi ~a && (b || x % 3 = 1) Entonces",
      '\t\tEscribir "si";',
      "\tFinSi",
      "FinAlgoritmo",
      "",
    ].join("\n");
    expect(errorsOf(source, ESTRICTO)).toEqual([]);
    const code = roundTrip(source, ESTRICTO);
    expect(code).toBe(source.replace(/;\n/g, "\n"));
    expect(errorsOf(code, ESTRICTO)).toEqual([]);
  });

  it("puts the ; back on statements kept as code, and keeps the ones inside a Segun", () => {
    const source = [
      "Algoritmo Codigo",
      "\tDefinir x Como Entero;",
      "\tDimension m[2, 3];",
      "\tRedimensionar m[4, 4];",
      "\tSegun x Hacer",
      "\t\t1: Escribir 1;",
      "\t\tDe Otro Modo: Escribir 2;",
      "\tFinSegun",
      '\tSaludar("Ana");',
      "FinAlgoritmo",
      "",
      "SubProceso Saludar(nombre)",
      '\tEscribir "Hola ", nombre;',
      "FinSubProceso",
      "",
    ].join("\n");
    const settings = { ...AIEP, allowResizeArrays: true };
    expect(errorsOf(source, settings)).toEqual([]);
    const code = roundTrip(source, settings);
    expect(code).toBe(source);
    expect(errorsOf(code, settings)).toEqual([]);
  });

  it("adds the ; to a code block typed without one", () => {
    const workspace = blocksFor("Algoritmo A\n\tx <- 1;\nFinAlgoritmo\n", AIEP);
    const raw = workspace.newBlock("ps_raw");
    raw.setFieldValue("Retornar x", "CODE");
    workspace.getBlocksByType("ps_asignar", false)[0].nextConnection!.connect(raw.previousConnection!);
    expect(pseudocode.workspaceToCode(workspace, AIEP)).toBe("Algoritmo A\n\tx <- 1;\n\tRetornar x;\nFinAlgoritmo\n");
  });

  it("writes the desktop style without settings (the old behaviour)", () => {
    const code = roundTrip(semicolons, CUC);
    const workspace = blocksFor(code, CUC);
    const plain = pseudocode.workspaceToCode(workspace);
    expect(plain).not.toContain(";");
    expect(plain).toContain("total > 10 Y n MOD 2 = 0");
    expect(plain).toContain("NO (n > 3 O n < 0)");
    expect(errorsOf(plain, {})).toEqual([]);
    // This is what editing in Bloques used to write for a CUC document: it no longer parses there.
    expect(errorsOf(plain, CUC)).toEqual(expect.arrayContaining([expect.stringContaining("PARSE_MISSING_SEMICOLON")]));
  });

  it("maps lines to blocks under the profile", () => {
    const workspace = blocksFor(semicolons, CUC);
    const code = pseudocode.workspaceToCode(workspace, CUC);
    const map = lineToBlockMap(workspace, code, CUC);
    const lines = code.split("\n");
    const typeAt = (text: string) => workspace.getBlockById(map.get(lines.indexOf(text) + 1)!)?.type;
    expect(typeAt("\t\ttotal <- total + notas[i];")).toBe("ps_asignar");
    expect(typeAt("\tEsperar Tecla;")).toBe("ps_esperar_tecla");
    expect(typeAt("\tHasta Que n >= 10")).toBeUndefined(); // a closer, not a statement
  });
});

describe("every example, written in a profile's style", () => {
  // The settings that change how code must be written, on top of the defaults.
  const styles: [string, Partial<EngineSettings>][] = [
    ["semicolons", { forceSemicolon: true }],
    ["symbol operators", { wordOperators: false, colloquialConditions: false }],
    ["both", { forceSemicolon: true, wordOperators: false, colloquialConditions: false }],
  ];

  describe.each(styles)("%s", (_name, overrides) => {
    const settings = normalizeEngineSettings(overrides);

    // Examples written entirely as blocks: code kept as text (a SubProceso, a
    // Segun) is the student's own, written for the desktop profile, and is not rewritten.
    const CODE_BLOCKS = new Set(["ps_raw", "ps_raw_top", "ps_expresion"]);
    const fallbackFree = examplePrograms.filter((example) =>
      blocksFor(example.source, {})
        .getAllBlocks(false)
        .every((b) => !CODE_BLOCKS.has(b.type))
    );

    it("covers a good share of the examples", () => {
      expect(fallbackFree.length).toBeGreaterThanOrEqual(10);
    });

    it.each(fallbackFree.map((example) => [example.id, example] as const))("%s", (_id, example) => {
      const code = pseudocode.workspaceToCode(blocksFor(example.source, {}), settings);
      expect(errorsOf(code, settings)).toEqual([]);
      // Reading it back under the profile and writing it again is stable.
      expect(roundTrip(code, settings)).toBe(code);
    });
  });
});
