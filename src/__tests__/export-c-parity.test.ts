/**
 * @jest-environment node
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Interpreter, parseFixtureArguments, Parser } from "../engine";
import { generateExport } from "../engine/generators";
import type { EngineSettings, ProgramNode, Runtime } from "../engine";
import { compareOutcome, loadUpstreamCases } from "./helpers/upstream-cases";

// The C and C++ exports must behave like the interpreter. Every upstream
// interp case that the interpreter passes and that needs no input (no Leer,
// no clearing or waiting, no random numbers or clock) is exported, compiled
// with -Wall -Werror and run; its output must match the interpreter's.
// Cases in knownMismatches cannot be expressed in typed C; any other mismatch
// is a regression. Skipped when no compiler is installed.

const knownMismatches: Record<"c" | "cpp", string[]> = {
  c: [
    // Prints a variable that is never assigned or typed: PSeInt prints nothing.
    "acentos-02",
    // Passes 1-D and 2-D arrays to the same subprocess parameter.
    "arreglos-07",
  ],
  cpp: ["arreglos-07"],
};

const compilers = {
  c: { command: "cc", flags: ["-std=c99", "-x", "c"] },
  cpp: { command: "c++", flags: ["-std=c++11", "-x", "c++"] },
} as const;

type Language = keyof typeof compilers;

function hasCompiler(command: string): boolean {
  return spawnSync(command, ["--version"], { stdio: "ignore" }).status === 0;
}

function run(command: string, args: string[], timeoutMs = 20000) {
  return new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (status) => {
      clearTimeout(timer);
      resolve({ status, stdout, stderr });
    });
  });
}

/** Compiles and runs exported code; returns its output or a failure reason. */
async function compileAndRun(code: string, language: Language): Promise<{ output?: string; error?: string }> {
  const { command, flags } = compilers[language];
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "codoritmo-parity-"));
  const file = path.join(directory, `programa.${language}`);
  const binary = path.join(directory, "programa");
  fs.writeFileSync(file, code);
  try {
    const compiled = await run(command, [...flags, "-Wall", "-Werror", file, "-o", binary, "-lm"]);
    if (compiled.status !== 0) return { error: `does not compile:\n${compiled.stderr}` };
    const executed = await run(binary, [], 4000);
    if (executed.status !== 0) return { error: `exit status ${executed.status}`, output: executed.stdout };
    return { output: executed.stdout };
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

async function runInterpreter(source: string, settings: Partial<EngineSettings>) {
  const lines: string[] = [];
  let pending = "";
  const runtime: Runtime = {
    write(value, newline = true) {
      if (newline) {
        lines.push(pending + value);
        pending = "";
      } else {
        pending += value;
      }
    },
    read() {
      throw new Error("no input");
    },
    clear() {},
    async sleep() {},
    async waitForKey() {},
  };
  const result = await new Interpreter({ settings, random: () => 0 }).run(source, runtime);
  return { result, output: pending ? [...lines, pending] : lines };
}

function usesInputOrEnvironment(program: ProgramNode): boolean {
  let found = false;
  const visit = (node: unknown): void => {
    if (found || !node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    const value = node as { kind?: string; callee?: string };
    if (value.kind === "read" || value.kind === "clear" || value.kind === "wait") found = true;
    if (value.kind === "call" && /^(azar|aleatorio|fechaactual|horaactual)$/i.test(value.callee ?? "")) {
      found = true;
    }
    Object.values(node).forEach(visit);
  };
  visit(program);
  return found;
}

/** Runs tasks with a bounded number in flight. */
async function inPool<T>(items: T[], size: number, task: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (queue.length > 0) await task(queue.shift()!);
    })
  );
}

const trimEnd = (text: string) => text.replace(/\s+$/, "");

interface EligibleCase {
  name: string;
  program: ProgramNode;
  settings: Partial<EngineSettings>;
  output: string;
}

describe("C and C++ exports of the upstream interp cases", () => {
  const eligible: EligibleCase[] = [];

  beforeAll(async () => {
    for (const testCase of loadUpstreamCases(path.join(process.cwd(), "fixtures/upstream/interp"))) {
      if (testCase.expected.state !== "ok" || testCase.fileInput.length > 0) continue;
      const args = parseFixtureArguments(testCase.args);
      if (args.input.length > 0) continue;
      const parsed = new Parser(testCase.source, { settings: args.settings }).parse();
      if (!parsed.program || parsed.diagnostics.some((d) => d.severity === "error")) continue;
      if (usesInputOrEnvironment(parsed.program)) continue;
      const { result, output } = await runInterpreter(testCase.source, args.settings);
      const failure = compareOutcome(testCase.expected, {
        state: result.state,
        output,
        diagnostics: result.diagnostics,
        unsupported: [],
      });
      if (failure) continue;
      eligible.push({ name: testCase.name, program: parsed.program, settings: args.settings, output: output.join("\n") });
    }
  }, 60000);

  describe.each(["c", "cpp"] as const)("%s", (language) => {
    const canCompile = hasCompiler(compilers[language].command);

    (canCompile ? it : it.skip)(
      "compiles with -Wall -Werror and prints what the interpreter prints",
      async () => {
        const mismatches = new Map<string, string>();
        await inPool(eligible, 8, async (testCase) => {
          const code = generateExport(testCase.program, language, { settings: testCase.settings }).code!;
          const { output, error } = await compileAndRun(code, language);
          if (error) {
            mismatches.set(testCase.name, error);
          } else if (trimEnd(output!) !== trimEnd(testCase.output)) {
            mismatches.set(
              testCase.name,
              `output differs:\n  expected: ${JSON.stringify(testCase.output)}\n  actual:   ${JSON.stringify(output)}`
            );
          }
        });

        const matched = eligible.length - mismatches.size;
        console.log(`${language} export matches the interpreter on ${matched}/${eligible.length} upstream cases`);
        const known = new Set(knownMismatches[language]);
        const regressions = [...mismatches].filter(([name]) => !known.has(name));
        const fixed = [...known].filter((name) => !mismatches.has(name));
        expect(regressions.map(([name, reason]) => `${name}: ${reason}`)).toEqual([]);
        expect(fixed).toEqual([]);
        expect(eligible.length).toBeGreaterThan(50);
      },
      300000
    );
  });
});

// Constructs added by the parity pass, each checked against the interpreter.
const programs: Record<string, string> = {
  typeSynonyms: `Algoritmo sinonimos
  Definir n Como Enteros
  Definir r Como Numero
  Definir t Como Texto
  Definir c Como Cadena
  Definir l Como Logicos
  n <- 10 % 3
  r <- 7.5 % 2
  t <- "hola"
  c <- t + "!"
  l <- n = 1
  Escribir n, " ", r, " ", c, " ", l
FinAlgoritmo`,
  rounding: `Algoritmo redondeo
  Escribir redon(-2.5), " ", redon(2.5), " ", redon(-0.4)
  Escribir trunc(100*0.57), " ", trunc(-0.57*100), " ", trunc(7.9)
  Escribir 0.1 + 0.2, " ", 1/3, " ", 2/3, " ", 10^20, " ", 2/10000000, " ", -0.5 * 0
  Escribir ConvertirATexto(1/3), " ", PI, " ", EULER, " ", euler()
FinAlgoritmo`,
  resize: `SubAlgoritmo listar(a)
  i <- 0
  Para Cada x En a Hacer
    i <- i + 1
    Escribir Sin Saltar x, " "
  FinPara
  Escribir "(", i, ")"
FinSubAlgoritmo

Algoritmo cambio_de_tamano
  Dimension a[3], m[2,3]
  a[1] <- 1
  a[2] <- 2
  a[3] <- 3
  listar(a)
  Redimensionar a[5]
  a[5] <- 5
  listar(a)
  Redimensionar a[2]
  listar(a)
  Redimensionar a[4]
  listar(a)
  m[2,3] <- 9
  m[1,1] <- 1
  Redimensionar m[2,2]
  Redimensionar m[3,3]
  Para Cada v De m Hacer
    Escribir Sin Saltar v, " "
  FinPara
  Escribir ""
FinAlgoritmo`,
  statements: `SubProceso r <- Doble(x Por Valor)
  x <- x * 2
  r <- x
FinSubProceso

SubProceso Avisar
  Imprimir "aviso"
FinSubProceso

SubProceso Sumar(v Por Copia, t Por Referencia)
  t <- t + v
FinSubProceso

Algoritmo construcciones
  k <- 3
  Escribir DOBLE(k), " ", k
  avisar
  AVISAR()
  total <- 1
  sumar(4, total)
  Informar "total: ", total
  Mostrar "sin" Sin Saltar
  Escribir " salto"
  Dimension v[3]
  Para i <- 1 Hasta 3 Hacer
    v[i] <- i * i
  FinPara
  Para Cada e En v Hacer
    e <- e + 1
  FinPara
  Escribir v[1], v[2], v[3]
  a <- Verdadero
  b <- Falso
  Escribir NO a O b, " ", NO (a Y b), " ", NO a = b, " ", a O b Y b
  Segun k Hacer
    1 + 2: Escribir "tres"
    De Otro Modo: Escribir "otro"
  FinSegun
FinAlgoritmo`,
};

describe.each(["c", "cpp"] as const)("%s export of the parity constructs", (language) => {
  const canCompile = hasCompiler(compilers[language].command);

  (canCompile ? it.each(Object.keys(programs)) : it.skip.each(Object.keys(programs)))(
    "%s",
    async (name) => {
      const source = programs[name];
      const parsed = new Parser(source).parse();
      expect(parsed.diagnostics).toEqual([]);
      const { result, output } = await runInterpreter(source, {});
      expect(result.state).toBe("ok");
      const code = generateExport(parsed.program!, language).code!;
      const executed = await compileAndRun(code, language);
      expect(executed.error).toBeUndefined();
      expect(trimEnd(executed.output!)).toBe(trimEnd(output.join("\n")));
    },
    30000
  );

  it("emits time.h helpers for FechaActual and HoraActual", async () => {
    const parsed = new Parser(`Algoritmo reloj
  f <- FechaActual()
  h <- HoraActual
  Escribir f > 20000101, " ", h >= 0
FinAlgoritmo`).parse();
    expect(parsed.diagnostics).toEqual([]);
    const code = generateExport(parsed.program!, language).code!;
    expect(code).toContain("fecha_actual()");
    expect(code).toContain("hora_actual()");
    expect(code).toContain("localtime(&ahora)");
    if (!canCompile) return;
    const executed = await compileAndRun(code, language);
    expect(executed.error).toBeUndefined();
    expect(executed.output).toBe("VERDADERO VERDADERO\n");
  }, 30000);
});
