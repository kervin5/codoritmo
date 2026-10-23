import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { examplePrograms, Interpreter, Parser } from "../../engine";
import { generateExport, type ExportLanguage } from "../../engine/generators";
import type { ProgramNode, Runtime } from "../../engine";

/**
 * Shared checks for the export languages added after C, C++, Java and
 * Python (C#, PHP, Pascal, Visual Basic, QBasic, MatLab, HTML):
 *
 * - every upstream export sample (fixtures/export/psc) and every app
 *   example translates without errors;
 * - key constructs match upstream PSeInt's own export of the same sample
 *   (fixtures/export/upstream/<lang>, copied from psexport's test suite),
 *   and the places where we deliberately differ are pinned down too;
 * - when the language's toolchain is installed, a few programs are run and
 *   must print what the interpreter prints.
 */

const samplesDirectory = path.join(process.cwd(), "fixtures/export/psc");
const upstreamDirectory = path.join(process.cwd(), "fixtures/export/upstream");

export interface NamedProgram {
  name: string;
  program: ProgramNode;
}

function parse(name: string, source: string): NamedProgram {
  const parsed = new Parser(source).parse();
  if (!parsed.program) throw new Error(`${name} does not parse: ${JSON.stringify(parsed.diagnostics)}`);
  return { name, program: parsed.program };
}

export function upstreamSamples(): NamedProgram[] {
  return fs
    .readdirSync(samplesDirectory)
    .filter((file) => file.endsWith(".psc"))
    .sort()
    .map((file) => parse(file.replace(/\.psc$/, ""), fs.readFileSync(path.join(samplesDirectory, file), "utf8")));
}

export function appExamples(): NamedProgram[] {
  return examplePrograms.map((example) => parse(example.id, example.source));
}

export function exportSample(language: ExportLanguage, name: string): string {
  const sample = upstreamSamples().find((candidate) => candidate.name === name)!;
  return generateExport(sample.program, language).code!;
}

/** Removes all whitespace, so constructs are compared regardless of layout. */
export function squash(code: string): string {
  return code.replace(/\s+/g, "");
}

export function upstreamReference(directory: string, sample: string): string {
  const folder = path.join(upstreamDirectory, directory);
  const file = fs.readdirSync(folder).find((name) => name.startsWith(`${sample}.`))!;
  return fs.readFileSync(path.join(folder, file), "utf8");
}

/** Programs (without input) run through each available toolchain. */
export const runtimePrograms: Record<string, string> = {
  arithmetic: `Algoritmo aritmetica
  Definir n Como Entero
  n <- 7
  x <- 2.5
  Escribir "n=", n, " x=", x, " suma=", n + x
  Escribir n / 2, " ", n % 3, " ", 2 ^ 10, " ", -7 % 3, " ", 7.5 % 2
  Escribir trunc(7.9), " ", redon(2.5), " ", redon(-2.5), " ", abs(-3), " ", raiz(16)
  Escribir 1 / 3, " ", 0.1 + 0.2, " ", 1 / 4
  b <- n > 5 Y x < 3
  Escribir b, " ", NO b
FinAlgoritmo`,
  routines: `Funcion r <- Doble(x)
  r <- x * 2
FinFuncion

SubProceso Intercambiar(a Por Referencia, b Por Referencia)
  aux <- a
  a <- b
  b <- aux
FinSubProceso

SubProceso Llenar(v, n)
  Para i <- 1 Hasta n Hacer
    v[i] <- i * i
  FinPara
FinSubProceso

SubProceso NoCambia(k)
  k <- 0
FinSubProceso

Algoritmo subprocesos
  p <- 1
  q <- 2
  Intercambiar(p, q)
  Escribir p, " ", q, " ", Doble(q)
  Dimension v[4]
  Llenar(v, 4)
  Escribir v[1], " ", v[2], " ", v[3], " ", v[4]
  Intercambiar(v[1], v[4])
  Escribir v[1], " ", v[4]
  k <- 5
  NoCambia(k)
  Escribir k
FinAlgoritmo`,
  control: `Algoritmo control
  Para i <- 10 Hasta 1 Con Paso -3 Hacer
    Escribir Sin Saltar i, " "
  FinPara
  Escribir "fin ", i
  c <- 0
  Repetir
    c <- c + 1
  Hasta Que c >= 3
  Mientras c < 6 Hacer
    c <- c + 2
  FinMientras
  Escribir c
  Segun c Hacer
    1, 2, 3: Escribir "chico"
    7: Escribir "siete"
    De Otro Modo: Escribir "otro"
  FinSegun
  Dimension m[2, 3]
  t <- 0
  Para Cada e De m Hacer
    t <- t + 1
    e <- t
  FinPara
  Escribir m[1, 1], m[1, 3], m[2, 1], m[2, 3]
  s <- "Hola"
  Escribir Mayusculas(s), " ", Minusculas(s), " ", Longitud(s), " ", Subcadena(s, 2, 3), " ", Concatenar(s, "!")
  Si s = "Hola" Y s < "Mundo" Entonces
    Escribir "comparan bien"
  SiNo
    Escribir "comparan mal"
  FinSi
FinAlgoritmo`,
};

export async function interpreterOutput(source: string): Promise<string> {
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
  await new Interpreter({ random: () => 0 }).run(source, runtime);
  return (pending ? [...lines, pending] : lines).join("\n");
}

export function hasCommand(command: string, args = ["--version"]): boolean {
  try {
    return spawnSync(command, args, { stdio: "ignore", timeout: 20000 }).status === 0;
  } catch {
    return false;
  }
}

/** A toolchain step: command and arguments, run inside the work directory. */
export type Step = [string, string[]];

/**
 * Writes `code` to `file` in a temporary directory, runs the steps there and
 * returns the last step's output (or the first failure).
 */
export async function runSteps(code: string, file: string, steps: Step[]): Promise<{ output?: string; error?: string }> {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "codoritmo-export-"));
  fs.writeFileSync(path.join(directory, file), code);
  try {
    let output = "";
    for (const [command, args] of steps) {
      const result = await run(command, args, directory);
      if (result.status !== 0) return { error: `${command} exited with ${result.status}:\n${result.stdout}${result.stderr}` };
      output = result.stdout;
    }
    return { output };
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function run(command: string, args: string[], cwd: string) {
  return new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), 60000);
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ status: -1, stdout, stderr: String(error) });
    });
    child.on("close", (status) => {
      clearTimeout(timer);
      resolve({ status, stdout, stderr });
    });
  });
}

export interface LanguageSpec {
  language: ExportLanguage;
  /** Folder of upstream's reference outputs (fixtures/export/upstream). */
  upstream: string;
  /** Per sample: constructs (whitespace ignored) found both in upstream's export and in ours. */
  shared: Record<string, string[]>;
  /** Per sample: constructs of ours where we deliberately differ from upstream (bug fixes, idioms). */
  own: Record<string, string[]>;
  /** The language ignores case (constructs are compared in lowercase). */
  ignoreCase?: boolean;
  /** Text no translation may contain (leftovers of a broken translation). */
  forbidden?: RegExp;
  /** How to run an export, when the toolchain is installed. */
  runtime?: {
    available: () => boolean;
    file: (code: string) => string;
    steps: (file: string, code: string) => Step[];
    /** Adjusts the code before running it (a console directive...). */
    prepare?: (code: string) => string;
  };
}

/** Registers the shared checks for one language. */
export function describeExportLanguage(spec: LanguageSpec): void {
  describe(`${spec.language} export`, () => {
    it.each([...upstreamSamples(), ...appExamples()].map((sample) => [sample.name, sample] as const))(
      "translates %s",
      (_name, sample) => {
        const result = generateExport(sample.program, spec.language);
        expect(result.code).toBeTruthy();
        expect(result.code).not.toMatch(spec.forbidden ?? /undefined|\[object Object\]|NaN/);
        expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
      }
    );

    it.each(Object.entries(spec.shared))("uses upstream's constructs for %s", (sample, constructs) => {
      const fold = (code: string) => (spec.ignoreCase ? squash(code).toLowerCase() : squash(code));
      const ours = fold(exportSample(spec.language, sample));
      const theirs = fold(upstreamReference(spec.upstream, sample));
      for (const construct of constructs) {
        expect({ construct, upstream: theirs.includes(fold(construct)) }).toEqual({ construct, upstream: true });
        expect({ construct, ours: ours.includes(fold(construct)) }).toEqual({ construct, ours: true });
      }
    });

    it.each(Object.entries(spec.own))("keeps its own constructs for %s", (sample, constructs) => {
      const ours = squash(exportSample(spec.language, sample));
      for (const construct of constructs) {
        expect({ construct, ours: ours.includes(squash(construct)) }).toEqual({ construct, ours: true });
      }
    });

    const runtime = spec.runtime;
    const available = runtime ? runtime.available() : false;
    (available ? it.each(Object.keys(runtimePrograms)) : it.skip.each(Object.keys(runtimePrograms)))(
      "runs %s like the interpreter",
      async (name) => {
        const parsed = new Parser(runtimePrograms[name]).parse();
        let code = generateExport(parsed.program!, spec.language).code!;
        if (runtime!.prepare) code = runtime!.prepare(code);
        const file = runtime!.file(code);
        const { output, error } = await runSteps(code, file, runtime!.steps(file, code));
        expect(error).toBeUndefined();
        expect(output!.replace(/\r/g, "").trimEnd()).toBe((await interpreterOutput(runtimePrograms[name])).trimEnd());
      },
      120000
    );
  });
}
