/**
 * @jest-environment node
 */
import { exampleConcepts, examplePrograms, exampleTopics } from "../engine/examples";
import { Interpreter, Parser, type Runtime } from "../engine";

async function run(source: string, input: string[], random: number) {
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
    clear() {},
    async sleep() {},
    async waitForKey() {},
  };
  const result = await new Interpreter({ random: () => random }).run(source, runtime);
  return { ...result, output: pending ? [...output, pending] : output };
}

// Every keyword a student can meet should appear in at least one example.
const KEYWORDS: [string, RegExp][] = [
  ["Definir", /\bDefinir\b/],
  ["Dimension", /\bDimension\b/],
  ["Redimensionar", /\bRedimensionar\b/],
  ["Leer", /\bLeer\b/],
  ["Escribir", /\bEscribir\b/],
  ["Sin Saltar", /\bSin Saltar\b/],
  ["Si/SiNo", /\bSiNo\b/],
  ["Segun", /\bSegun\b/],
  ["De Otro Modo", /\bDe Otro Modo\b/],
  ["Mientras", /\bMientras\b.*\bHacer\b/],
  ["Repetir…Hasta Que", /\bHasta Que\b/],
  ["Repetir…Mientras Que", /\bMientras Que\b/],
  ["Para", /\bPara\b.*\bHasta\b/],
  ["Con Paso", /\bCon Paso\b/],
  ["Para Cada", /\bPara Cada\b/],
  ["SubProceso", /\bSubProceso\b/],
  ["Funcion", /\bFuncion\b/],
  ["Por Referencia", /\bPor Referencia\b/],
  ["Por Valor", /\bPor Valor\b/],
  ["Limpiar Pantalla", /\bLimpiar Pantalla\b/],
  ["Esperar Tecla", /\bEsperar Tecla\b/],
  ["Esperar … Segundo", /\bEsperar \d+ Segundo/],
  ["Y / O / NO", /\bY\b[\s\S]*\bO\b[\s\S]*\bNO\b|\bNO\b/],
  ["MOD", /\bMOD\b/],
  ["Verdadero/Falso", /\bVerdadero\b/],
  ["Es Multiplo De", /\bEs Multiplo De\b/],
];

const FUNCTIONS = [
  "Azar", "Aleatorio", "Trunc", "Redon", "Abs", "Raiz", "RC", "Ln", "Exp", "Sen", "Cos", "ATan", "PI",
  "Longitud", "Subcadena", "Mayusculas", "Minusculas", "Concatenar", "ConvertirANumero", "ConvertirATexto",
];

describe("example library", () => {
  it("has unique ids and a reasonable size", () => {
    const ids = examplePrograms.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(40);
  });

  it("fills every topic and level", () => {
    for (const topic of exampleTopics) {
      expect(examplePrograms.filter((e) => e.topic === topic).length).toBeGreaterThanOrEqual(4);
    }
    for (const level of [1, 2, 3] as const) {
      expect(examplePrograms.some((e) => e.level === level)).toBe(true);
    }
  });

  it("tags every concept at least once and only known concepts", () => {
    const used = new Set(examplePrograms.flatMap((e) => e.concepts));
    for (const concept of exampleConcepts) expect([concept, used.has(concept)]).toEqual([concept, true]);
    for (const concept of used) expect(exampleConcepts).toContain(concept);
  });

  it("covers every keyword and built-in function", () => {
    const all = examplePrograms.map((e) => e.source).join("\n");
    for (const [name, pattern] of KEYWORDS) expect([name, pattern.test(all)]).toEqual([name, true]);
    for (const name of FUNCTIONS) expect([name, new RegExp(`\\b${name}\\b`).test(all)]).toEqual([name, true]);
  });

  it.each(examplePrograms.map((e) => [e.id, e] as const))("%s parses cleanly", (_id, example) => {
    const result = new Parser(example.source, { settings: example.settings }).parse();
    expect(result.diagnostics).toEqual([]);
  });

  it.each(examplePrograms.map((e) => [e.id, e] as const))(
    "%s runs to the end with its sample input, whatever the random numbers",
    async (_id, example) => {
      const input = example.input?.split("\n") ?? [];
      for (const random of [0, 0.37, 0.999]) {
        const result = await run(example.source, input, random);
        expect([random, result.diagnostics]).toEqual([random, []]);
        expect(result.state).toBe("ok");
        expect(result.output.length).toBeGreaterThan(0);
      }
    }
  );

  it.each(examplePrograms.filter((e) => e.input).map((e) => [e.id, e] as const))(
    "%s prompts before every read",
    async (_id, example) => {
      // Each Leer should follow something written, so the student knows what to type.
      const lines = example.source.split("\n").map((l) => l.trim());
      lines.forEach((line, i) => {
        if (/^Leer\b/.test(line) && !/^Leer\b/.test(lines[i - 1] ?? "")) {
          const before = lines.slice(Math.max(0, i - 3), i).join(" ");
          expect([line, /Escribir|Leer|MostrarMenu|Repetir/.test(before)]).toEqual([line, true]);
        }
      });
    }
  );
});
