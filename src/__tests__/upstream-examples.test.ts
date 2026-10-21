import fs from "node:fs";
import path from "node:path";

import { Parser } from "../engine";
import type { EngineSettings } from "../engine";

// Upstream bundled examples (bin/ejemplos) contain {...} template markers that
// the desktop editor expands according to the active profile when the example
// is opened. This mirrors that expansion (as described by upstream's editor
// behaviour): the first two lines are a banner, {;} is an optional semicolon,
// {&} {|} {~} {%} are operators, {Proceso}/{FinProceso}/{SubProceso}/
// {FinSubProceso} are keywords, {Definir ...} lines exist only when variables
// must be defined, and {a#b} picks a for base-1 and b for base-0 arrays.
function expandExampleTemplate(source: string, settings: Partial<EngineSettings>): string {
  const lines = source.replace(/\r\n/g, "\n").split("\n").slice(2);
  const expanded = lines.map((original) => {
    let line = original;
    for (let start = line.indexOf("{"); start !== -1; start = line.indexOf("{")) {
      const end = line.indexOf("}", start);
      if (end === -1) {
        throw new Error(`Unterminated template marker in: ${original}`);
      }
      const inner = line.slice(start + 1, end);
      const before = line.slice(0, start);
      const after = line.slice(end + 1);
      const hash = inner.indexOf("#");
      if (hash !== -1) {
        line = before + (settings.baseZeroArrays ? inner.slice(hash + 1) : inner.slice(0, hash)) + after;
        continue;
      }
      const operators: Record<string, [string, string]> = {
        "&": ["Y", "&"],
        "|": ["O", "|"],
        "~": ["NO", "~"],
        "%": ["MOD", "%"],
      };
      if (inner === ";") {
        line = before + (settings.forceSemicolon ? ";" : "") + after;
      } else if (operators[inner]) {
        line = before + operators[inner][settings.wordOperators === false ? 1 : 0] + after;
      } else if (/^(proceso|finproceso|subproceso|finsubproceso)$/i.test(inner)) {
        line = before + inner + after;
      } else if (/^definir /i.test(inner)) {
        if (!settings.forceDefineVars) {
          line = "";
          break;
        }
        line = before + inner + after;
      } else {
        line = before + inner + after;
      }
    }
    return line;
  });
  return expanded.join("\n");
}

const examplesDirectory = path.join(process.cwd(), "fixtures/upstream/ejemplos");
const examples = fs
  .readdirSync(examplesDirectory)
  .filter((file) => file.endsWith(".psc"))
  .sort();

const variants: Array<[string, Partial<EngineSettings>]> = [
  ["default profile", {}],
  ["with Definir, semicolons and symbol operators", { forceDefineVars: true, forceSemicolon: true, wordOperators: false }],
  ["base-0 arrays", { baseZeroArrays: true }],
];

describe("upstream bundled examples", () => {
  it("has all 25 upstream examples", () => {
    expect(examples).toHaveLength(25);
  });

  describe.each(variants)("%s", (_label, settings) => {
    it.each(examples)("parses %s", (file) => {
      const template = fs.readFileSync(path.join(examplesDirectory, file), "utf8");
      // Examples without {;} markers (Coloquial) target the flexible profile.
      const effective = template.includes("{;}") ? settings : { ...settings, forceSemicolon: false };
      const source = expandExampleTemplate(template, effective);
      const result = new Parser(source, { settings: effective }).parse();
      expect(result.diagnostics).toEqual([]);
    });
  });
});
