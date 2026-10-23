/**
 * @jest-environment jsdom
 */
import fs from "node:fs";
import path from "node:path";

import * as Blockly from "blockly/core";

import { defineBlocks } from "../components/workspace/blocks/blocks-defs";
import { codeToBlocksState } from "../components/workspace/blocks/blocks-from-code";
import { pseudocode } from "../components/workspace/blocks/blocks-generator";
import {
  examplePrograms,
  parseFixtureArguments,
  Parser,
  type EngineSettings,
  type ExpressionNode,
  type StatementNode,
} from "../engine";
import { normalizeDataType } from "../engine/types";

// See blocks.test.ts: the browser build of Blockly runs on jsdom.
jest.mock("blockly/core", () => jest.requireActual("../../node_modules/blockly/blockly_compressed.js"));

defineBlocks();

/**
 * How much of what students write becomes real blocks. Every app example and
 * every upstream PSeInt test program that parses is converted; each block that
 * keeps code as text ("código" blocks and free-typed expressions) is counted by
 * the statement or expression it holds. Kinds outside KNOWN_RAW_KINDS are a
 * regression. Run with BLOCKS_COVERAGE_REPORT=1 for the full list.
 *
 * Before SubProceso/Funcion, Segun, matrix, Redimensionar, colloquial and
 * builtin blocks: 109/189 programs fully as blocks, 195 code blocks (32 + 7
 * SubProceso, 17 + 10 + 4 Funcion and 2 SubAlgoritmo as one code block each,
 * 30 Segun, 32 + 2 multi-index accesses, 14 Subcadena, 10 Redimensionar,
 * 7 multi-dimension Dimension, 7 unary minus, 11 Acos/Asen/Atan, …). Now
 * every program converts with no code block, so the allowlist is empty.
 */
const KNOWN_RAW_KINDS: Record<string, number> = {};

interface Program {
  id: string;
  source: string;
  settings: Partial<EngineSettings>;
}

const CODE_BLOCKS = new Set(["ps_raw", "ps_raw_top", "ps_expresion"]);

function upstreamPrograms(): Program[] {
  const directory = path.join(process.cwd(), "fixtures/upstream/interp");
  return fs
    .readdirSync(directory)
    .filter((file) => file.endsWith(".psc"))
    .sort()
    .map((file) => {
      const argsFile = path.join(directory, file.replace(/\.psc$/, ".arg"));
      const args = fs.existsSync(argsFile) ? fs.readFileSync(argsFile, "utf8") : "";
      return {
        id: `upstream/${file.replace(/\.psc$/, "")}`,
        source: fs.readFileSync(path.join(directory, file), "utf8"),
        settings: parseFixtureArguments(args).settings,
      };
    });
}

const parses = (source: string, settings: Partial<EngineSettings>) =>
  new Parser(source, { settings }).parse().diagnostics.every((d) => d.severity !== "error");

const programs: Program[] = [
  ...examplePrograms.map((example) => ({ id: example.id, source: example.source, settings: {} })),
  ...upstreamPrograms().filter((program) => parses(program.source, program.settings)),
];

/** What a free-typed expression holds, e.g. `call:SUBCADENA` or `unary:-`. */
function expressionKind(expression: ExpressionNode): string {
  switch (expression.kind) {
    case "call":
      return `call:${expression.callee.toUpperCase()}/${expression.args.length}`;
    case "unary":
    case "binary":
      return `${expression.kind}:${expression.operator}`;
    case "arrayAccess":
      return `arrayAccess:${expression.indices.length}`;
    case "group":
      return expressionKind(expression.expression);
    default:
      return expression.kind;
  }
}

function statementKind(statement: StatementNode): string {
  if (statement.kind === "dimension") return statement.resize ? "redimension" : "dimension";
  if (statement.kind === "wait") return `wait:${statement.mode}`;
  return statement.kind;
}

/** Classifies a code block by parsing its text again. */
function rawKind(block: Blockly.Block, settings: Partial<EngineSettings>): string {
  const code = String(block.getFieldValue("CODE") ?? "");
  if (block.type === "ps_raw_top") {
    const word = code.replace(/^(\s*\/\/.*\n)*/, "").trim().split(/[\s(]/)[0];
    return `top:${word}`;
  }
  const loose = { ...settings, forceSemicolon: false };
  if (block.type === "ps_raw") {
    const parsed = new Parser(`Algoritmo T\n${code}\nFinAlgoritmo\n`, { settings: loose }).parse();
    const statement = parsed.program?.entry.body[0];
    return statement ? `statement:${statementKind(statement)}` : "statement:?";
  }
  const parsed = new Parser(`Algoritmo T\nx <- ${code}\nFinAlgoritmo\n`, { settings: loose }).parse();
  const statement = parsed.program?.entry.body[0];
  return statement?.kind === "assignment" ? `expression:${expressionKind(statement.value)}` : "expression:?";
}

/** The program's meaning: its AST without positions, parentheses or type spellings. */
function meaning(source: string, settings: Partial<EngineSettings>): string {
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (!node || typeof node !== "object") return node;
    const record = node as Record<string, unknown>;
    if (record.kind === "group") return strip(record.expression);
    return Object.fromEntries(
      Object.entries(record)
        .filter(([key]) => key !== "span" && key !== "inferredTypes")
        .map(([key, value]) => [
          key,
          key === "dataType" && typeof value === "string" ? normalizeDataType(value) ?? value : strip(value),
        ])
    );
  };
  return JSON.stringify(strip(new Parser(source, { settings }).parse().program));
}

/** The text of each `//` comment (outside strings). */
function commentsOf(source: string): string[] {
  const comments: string[] = [];
  for (const line of source.split("\n")) {
    let quote = "";
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (quote) {
        if (char === quote) quote = "";
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === "/" && line[i + 1] === "/") {
        const text = line.slice(i + 2).trim();
        if (text) comments.push(text);
        break;
      }
    }
  }
  return comments;
}

describe("blocks coverage", () => {
  const byKind = new Map<string, string[]>();
  let clean = 0;
  let rawBlocks = 0;

  beforeAll(() => {
    for (const program of programs) {
      const result = codeToBlocksState(program.source, program.settings);
      if ("error" in result) throw new Error(`${program.id}: ${result.error}`);
      const workspace = new Blockly.Workspace();
      Blockly.serialization.workspaces.load(result.state, workspace);
      const raws = workspace.getAllBlocks(false).filter((block) => CODE_BLOCKS.has(block.type));
      if (raws.length === 0) clean++;
      rawBlocks += raws.length;
      for (const block of raws) {
        const kind = rawKind(block, program.settings);
        byKind.set(kind, [...(byKind.get(kind) ?? []), program.id]);
      }
      workspace.dispose();
    }
    const identical = programs.filter((program) => {
      const result = codeToBlocksState(program.source, program.settings);
      if ("error" in result) return false;
      const workspace = new Blockly.Workspace();
      Blockly.serialization.workspaces.load(result.state, workspace);
      const same = pseudocode.workspaceToCode(workspace, program.settings) === program.source;
      workspace.dispose();
      return same;
    });
    const identicalExamples = identical.filter((program) => !program.id.startsWith("upstream/")).length;
    const kinds = [...byKind].sort((a, b) => b[1].length - a[1].length);
    console.log(
      `Blocks coverage: ${clean}/${programs.length} programs fully as blocks, ${rawBlocks} code blocks.\n` +
        `Byte-identical round trip: ${identicalExamples}/${examplePrograms.length} examples, ` +
        `${identical.length - identicalExamples}/${programs.length - examplePrograms.length} upstream programs.\n` +
        kinds
          .map(([kind, ids]) =>
            `  ${kind}: ${ids.length}${process.env.BLOCKS_COVERAGE_REPORT ? ` (${[...new Set(ids)].join(", ")})` : ""}`
          )
          .join("\n")
    );
  });

  it("keeps no code blocks outside the known remaining kinds", () => {
    const counts = Object.fromEntries([...byKind].map(([kind, ids]) => [kind, ids.length]));
    const regressions = Object.entries(counts).filter(([kind, count]) => count > (KNOWN_RAW_KINDS[kind] ?? 0));
    expect(regressions).toEqual([]);
  });

  it("round-trips every program: the same program (AST) with its comments, parsing under its profile, and stable", () => {
    const failures: string[] = [];
    for (const program of programs) {
      const result = codeToBlocksState(program.source, program.settings);
      if ("error" in result) continue;
      const workspace = new Blockly.Workspace();
      Blockly.serialization.workspaces.load(result.state, workspace);
      const code = pseudocode.workspaceToCode(workspace, program.settings);
      workspace.dispose();
      const errors = new Parser(code, { settings: program.settings })
        .parse()
        .diagnostics.filter((d) => d.severity === "error");
      if (errors.length) {
        failures.push(`${program.id}: ${errors[0].line}:${errors[0].column} ${errors[0].message}`);
        continue;
      }
      const lost = commentsOf(program.source).filter((comment) => !code.includes(comment));
      if (lost.length) failures.push(`${program.id}: lost comment ${JSON.stringify(lost[0])}`);
      if (meaning(code, program.settings) !== meaning(program.source, program.settings)) {
        failures.push(`${program.id}: a different program`);
        continue;
      }
      const again = codeToBlocksState(code, program.settings);
      if ("error" in again) continue;
      const second = new Blockly.Workspace();
      Blockly.serialization.workspaces.load(again.state, second);
      if (pseudocode.workspaceToCode(second, program.settings) !== code) failures.push(`${program.id}: not stable`);
      second.dispose();
    }
    expect(failures).toEqual([]);
  });
});
