/**
 * @jest-environment node
 */
import { exampleConcepts, examplePrograms, exampleTopics } from "../engine/examples";
import { Interpreter, Parser, type Runtime } from "../engine";

async function run(source: string, input: string[], random: number | (() => number)) {
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
  const result = await new Interpreter({ random: typeof random === "number" ? () => random : random }).run(source, runtime);
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

/** A small seeded generator, so each "seed" gives different random data. */
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const numbersAfter = (output: string[], title: string) => {
  const line = output.find((l) => l.startsWith(title));
  if (!line) throw new Error(`no "${title}" line in:\n${output.join("\n")}`);
  return line.slice(title.length).trim().split(/\s+/).filter(Boolean).map(Number);
};

describe("sorting and searching examples", () => {
  const library = examplePrograms.filter((e) => e.topic === "sorting");
  const sorts = library.filter((e) => e.source.includes('MostrarDatos("Después: "'));
  const SEEDS = [1, 42, 2024, 99991];

  it("has every sorting algorithm and both searches", () => {
    expect(sorts.map((e) => e.id).sort()).toEqual(
      ["bubble-sort", "counting-sort", "heap-sort", "insertion-sort", "merge-sort", "quicksort", "selection-sort", "shell-sort"]
    );
    expect(library.map((e) => e.id)).toEqual(expect.arrayContaining(["binary-search", "search-comparison"]));
  });

  it.each(library.map((e) => [e.id, e] as const))("%s reads only the size n and keeps big outputs small", async (_id, example) => {
    // The complexity analyser feeds one number and measures the run.
    const reads = example.source.split("\n").filter((l) => /^\s*Leer\b/.test(l));
    expect(reads.map((l) => l.trim())).toEqual(["Leer n"]);
    expect(example.input).toMatch(/^\d+$/);
    for (const n of [1, 512]) {
      const result = await run(example.source, [String(n)], seeded(n));
      expect([n, result.diagnostics]).toEqual([n, []]);
      expect(result.state).toBe("ok");
      expect(result.output.length).toBeLessThan(30);
      expect(Math.max(...result.output.map((l) => l.length))).toBeLessThan(200);
    }
  });

  it.each(library.map((e) => [e.id, e] as const))("%s has complexity metadata", (_id, example) => {
    const c = example.complexity;
    expect(c).toBeDefined();
    for (const value of [c!.best, c!.average, c!.worst, c!.space]) expect(value).toMatch(/^O\(.+\)$/);
  });

  it("describes the complexity of the classic algorithms outside the topic too", () => {
    for (const id of ["linear-search", "primes", "fibonacci", "gcd-lcm", "hanoi"]) {
      expect([id, examplePrograms.find((e) => e.id === id)?.complexity?.worst]).toEqual([id, expect.stringMatching(/^O\(/)]);
    }
  });

  it.each(sorts.map((e) => [e.id, e] as const))("%s sorts any size and any data", async (_id, example) => {
    // Print the whole array at every size so the result can be checked.
    expect(example.source).toContain("n <= 30");
    const source = example.source.replace("n <= 30", "n <= 1000");
    for (const n of [1, 2, 10, 50]) {
      for (const seed of SEEDS) {
        const result = await run(source, [String(n)], seeded(seed * 7919 + n));
        expect(result.state).toBe("ok");
        const before = numbersAfter(result.output, "Antes:");
        const after = numbersAfter(result.output, "Después:");
        expect(before).toHaveLength(n);
        // Same numbers, in non-decreasing order.
        expect(after).toEqual([...before].sort((a, b) => a - b));
      }
    }
  });

  it("binary search finds every value that is in the list, and only those", async () => {
    const example = examplePrograms.find((e) => e.id === "binary-search")!;
    for (const n of [1, 2, 3, 10, 50, 511, 512]) {
      for (const seed of SEEDS) {
        const { output, state } = await run(example.source, [String(n)], seeded(seed + n));
        expect(state).toBe("ok");
        const target = Number(/Buscando el (\d+)/.exec(output.join("\n"))![1]);
        const found = /está en la posición (\d+)/.exec(output.join("\n"));
        // The list holds 2, 4, …, 2n: even targets are there, odd ones aren't.
        if (target % 2 === 0) expect([target, Number(found?.[1])]).toEqual([target, target / 2]);
        else expect([target, found]).toEqual([target, null]);
        const steps = Number(/Comparaciones: (\d+)/.exec(output.join("\n"))![1]);
        expect(steps).toBeLessThanOrEqual(Math.floor(Math.log2(n)) + 1);
      }
    }
  });

  it("the search comparison counts linear and binary comparisons", async () => {
    const example = examplePrograms.find((e) => e.id === "search-comparison")!;
    for (const n of [1, 10, 100, 512]) {
      const { output } = await run(example.source, [String(n)], seeded(n));
      const rows = output
        .map((l) => /Buscar el (\d+) -> comparaciones: lineal (\d+), binaria (\d+)/.exec(l))
        .filter((m): m is RegExpExecArray => m !== null)
        .map((m) => m.slice(1).map(Number));
      expect(rows).toHaveLength(4);
      const worstBinary = Math.floor(Math.log2(n)) + 1;
      for (const [target, linear, binary] of rows) {
        // Linear search stops at the target's position, or checks all n.
        expect(linear).toBe(target % 2 === 0 ? target / 2 : n);
        expect(binary).toBeLessThanOrEqual(worstBinary);
      }
      expect(output.at(-1)).toBe(`Peor caso con ${n} elementos: lineal ${n}, binaria ${worstBinary}.`);
    }
  });
});
