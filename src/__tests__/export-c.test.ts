import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Parser } from "../engine";
import {
  CGenerator,
  CppGenerator,
  generateExport,
  TypeInference,
} from "../engine/generators";
import type { ProgramNode } from "../engine";

/**
 * The upstream PSeInt export samples (test/export/psc in the pseint2 branch)
 * run through the C and C++ generators. Expected outputs live next to the
 * samples; regenerate them with UPDATE_EXPORT_FIXTURES=1 npm test.
 */
const samplesDirectory = path.join(process.cwd(), "fixtures/export/psc");
const expectedDirectory = path.join(process.cwd(), "fixtures/export/expected");
const samples = fs
  .readdirSync(samplesDirectory)
  .filter((file) => file.endsWith(".psc"))
  .sort();
const updateFixtures = process.env.UPDATE_EXPORT_FIXTURES === "1";

/**
 * Works around lexer/parser gaps that are out of scope for the exporters
 * (each rewrite keeps the program's meaning):
 * - `3,9` is lexed as the decimal 3.9, so a space goes before such commas;
 * - `Borrar Pantalla`, `Escribir Sin Saltar` and `%` are not recognised;
 * - lowercase `y` / `o` operators are not always recognised;
 * - a case with several values is only recognised as the first case.
 */
/** Applies `rewrite` to the source outside string literals. */
function outsideStrings(source: string, rewrite: (code: string) => string): string {
  return source
    .split(/("[^"\n]*")/)
    .map((part, index) => (index % 2 === 1 ? part : rewrite(part)))
    .join("");
}

function separateDigitCommas(source: string): string {
  return outsideStrings(source, (code) => code.replace(/(\d),/g, "$1 ,"));
}

function normalizeUpstreamSample(source: string): string {
  return outsideStrings(separateDigitCommas(source), (code) =>
    code
      .replace(/ y /g, " Y ")
      .replace(/ o /g, " O ")
      .replace(/Borrar Pantalla/gi, "Limpiar Pantalla")
      .replace(/Escribir sin saltar/gi, "Escribir Sin Bajar")
      .replace(/(\w)%(\w)/g, "$1 MOD $2")
  ).replace(
    /^([ \t]*1:[^\n]*\n[^\n]*\n)([ \t]*3 ,5 ,9:[^\n]*\n[^\n]*\n)/m,
    "$2$1"
  );
}

function parseSample(file: string): ProgramNode {
  const source = fs
    .readFileSync(path.join(samplesDirectory, file), "utf8")
    .replace(/\r\n/g, "\n");
  const result = new Parser(normalizeUpstreamSample(source)).parse();
  expect(result.diagnostics).toEqual([]);
  return result.program!;
}

function parseSource(source: string): ProgramNode {
  const result = new Parser(separateDigitCommas(source)).parse();
  expect(result.diagnostics).toEqual([]);
  return result.program!;
}

function hasCompiler(command: string): boolean {
  return spawnSync(command, ["--version"], { stdio: "ignore" }).status === 0;
}

const compilers = {
  c: { command: "cc", flags: ["-std=c99", "-x", "c"] },
  cpp: { command: "c++", flags: ["-std=c++11", "-x", "c++"] },
} as const;

function compile(code: string, language: "c" | "cpp", outputFile?: string) {
  const { command, flags } = compilers[language];
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "codoritmo-export-"));
  const file = path.join(directory, `programa.${language}`);
  fs.writeFileSync(file, code);
  const args = [...flags, "-Wall", "-Wno-unused", "-Wno-unused-but-set-variable"];
  const result = spawnSync(
    command,
    outputFile ? [...args, file, "-o", outputFile, "-lm"] : [...args, "-fsyntax-only", file],
    { encoding: "utf8" }
  );
  return { status: result.status, diagnostics: `${result.stdout}${result.stderr}` };
}

describe.each([
  ["c", "c"],
  ["cpp", "cpp"],
] as const)("%s export of the upstream samples", (language, extension) => {
  const canCompile = hasCompiler(compilers[language].command);

  test.each(samples)("%s matches the expected output", (file) => {
    const code = generateExport(parseSample(file), language).code!;
    const expectedFile = path.join(
      expectedDirectory,
      language,
      file.replace(/\.psc$/, `.${extension}`)
    );
    if (updateFixtures) {
      fs.mkdirSync(path.dirname(expectedFile), { recursive: true });
      fs.writeFileSync(expectedFile, code);
    }
    expect(code).toBe(fs.readFileSync(expectedFile, "utf8"));
  });

  (canCompile ? test.each(samples) : test.skip.each(samples))(
    "%s compiles without warnings",
    (file) => {
      const code = generateExport(parseSample(file), language).code!;
      const result = compile(code, language);
      expect(result.diagnostics).toBe("");
      expect(result.status).toBe(0);
    }
  );
});

describe("C/C++ generated programs behave like the interpreter", () => {
  const programs: Record<string, { source: string; input?: string; output: string }> = {
    loops: {
      source: `Proceso Bucles
  Dimension a[5];
  Para i <- 1 Hasta 5 Hacer
    a[i] <- i * i;
  FinPara
  suma <- 0;
  Para Cada x De a Hacer
    suma <- suma + x;
  FinPara
  Escribir "Suma: ", suma;
  Escribir 7 / 2, " ", 7 MOD 2, " ", 2 ^ 10;
  c <- 0;
  Repetir
    c <- c + 1;
  Hasta Que c = 3
  Escribir c, " ", c > 2;
FinProceso`,
      output: "Suma: 55\n3.5 1 1024\n3 VERDADERO\n",
    },
    subprocesses: {
      source: `Funcion r <- Doble(x)
  r <- 2 * x;
FinFuncion

SubProceso Incrementar(n Por Referencia)
  n <- n + 1;
FinSubProceso

SubProceso Llenar(m)
  Para i <- 1 Hasta 2 Hacer
    Para j <- 1 Hasta 3 Hacer
      m[i, j] <- i * 10 + j;
    FinPara
  FinPara
FinSubProceso

Proceso Principal
  Definir k Como Entero;
  Dimension t[2, 3];
  k <- 4;
  Incrementar(k);
  Llenar(t);
  Escribir Doble(k), " ", t[2, 3];
FinProceso`,
      output: "10 23\n",
    },
    strings: {
      source: `Proceso Cadenas
  Leer nombre;
  saludo <- "Hola " + nombre;
  Escribir saludo, " (", Longitud(saludo), ")";
  Escribir Mayusculas(nombre), " ", Minusculas("ABC"), " ", SubCadena(nombre, 2, 3);
  Escribir Concatenar(nombre, "!"), " ", ConvertirATexto(2.5), " ", ConvertirANumero("1.5") + 1;
  Segun nombre Hacer
    "Ana": Escribir "es Ana";
    De Otro Modo: Escribir "no es Ana";
  FinSegun
  Si nombre < "Zoe" Y Trunc(3.7) = 3 Entonces
    Escribir "orden";
  FinSi
FinProceso`,
      input: "Ana\n",
      output: "Hola Ana (8)\nANA abc na\nAna! 2.5 2.5\nes Ana\norden\n",
    },
    edgeCases: {
      source: `Funcion r <- Saludo(nombre)
  r <- "Hola " + nombre;
FinFuncion

SubProceso Agregar(t Por Referencia, extra)
  t <- t + extra;
FinSubProceso

SubProceso Avisar()
  Escribir "sin parametros";
FinSubProceso

SubProceso Pasar(k Por Referencia)
  Incr(k);
FinSubProceso

SubProceso Incr(z Por Referencia)
  z <- z + 1;
FinSubProceso

Proceso Estres
  Definir nombres Como Cadena;
  Dimension nombres[3];
  nombres[1] <- "ana";
  nombres[2] <- "beto";
  nombres[3] <- "carla";
  Para Cada n De nombres Hacer
    Escribir Saludo(n);
  FinPara
  texto <- "x";
  Agregar(texto, "yz");
  Escribir texto, " ", Longitud(texto);
  Avisar;
  q <- 5;
  Pasar(q);
  Escribir q;
  salto <- 3;
  Para i <- 10 Hasta 1 Con Paso -salto Hacer
    Escribir Sin Bajar i, " ";
  FinPara
  Escribir "";
  Para i <- 3 Hasta 1 Hacer
    Escribir Sin Bajar i;
  FinPara
  Escribir "";
  Segun nombres[2] Hacer
    "ana", "beto": Escribir "a o b";
    De Otro Modo: Escribir "otro";
  FinSegun
  m <- 10;
  Mientras m > 1 Hacer
    m <- m / 2;
  FinMientras
  Escribir m, " ", 10 MOD 4, " ", -m;
  ok <- m < 1 O m > 100;
  Si No ok Entonces
    Escribir "ok falso ", ok;
  FinSi
  Escribir Mayusculas(SubCadena(Concatenar("abc", "def"), 2, 4));
  Escribir "100%";
FinProceso`,
      output:
        "Hola ana\nHola beto\nHola carla\nxyz 3\nsin parametros\n6\n10 7 4 1 \n321\na o b\n0.625 2 -0.625\nBCD\n100%\n",
    },
  };

  describe.each(["c", "cpp"] as const)("%s", (language) => {
    const canCompile = hasCompiler(compilers[language].command);

    (canCompile ? test.each(Object.keys(programs)) : test.skip.each(Object.keys(programs)))(
      "%s",
      (name) => {
        const { source, input, output } = programs[name];
        const code = generateExport(parseSource(source), language).code!;
        const binary = path.join(
          fs.mkdtempSync(path.join(os.tmpdir(), "codoritmo-run-")),
          "programa"
        );
        const result = compile(code, language, binary);
        expect(result.diagnostics).toBe("");
        expect(execFileSync(binary, { input: input ?? "", encoding: "utf8" })).toBe(output);
      }
    );
  });
});

describe("type inference", () => {
  test("infers int, double, string and bool like upstream", () => {
    const program = parseSource(`Proceso Tipos
  Definir a Como Entero;
  b <- 2.5;
  c <- 0;
  c <- c + 1;
  e <- "Hola";
  d <- Falso;
  Leer n;
  Dimension v[n];
  Para i <- 1 Hasta 3 Hacer
    v[i] <- e;
  FinPara
  Leer p;
FinProceso`);
    const types = TypeInference.infer(program).main.vars;
    const typeOf = (name: string) => types.get(name)?.type;
    expect(typeOf("a")).toBe("int");
    expect(typeOf("b")).toBe("double");
    expect(typeOf("c")).toBe("number");
    expect(typeOf("e")).toBe("string");
    expect(typeOf("d")).toBe("bool");
    expect(typeOf("n")).toBe("int");
    expect(typeOf("i")).toBe("int");
    expect(typeOf("v")).toBe("string");
    expect(types.get("v")?.array).toEqual({ dims: [null] });
    expect(typeOf("p")).toBe("unknown");
  });

  test("propagates types through subprocess calls and references", () => {
    const program = parseSource(`SubProceso Poner(x Por Referencia)
  Leer x;
FinSubProceso

Proceso Principal
  Definir texto Como Cadena;
  Poner(texto);
FinProceso`);
    const types = TypeInference.infer(program);
    expect(types.routines.get("poner")?.vars.get("x")?.type).toBe("string");
  });
});

describe("C/C++ generator details", () => {
  test("respects base-0 arrays", () => {
    const program = parseSource(`Proceso Base
  Dimension a[3];
  a[0] <- 1;
  Escribir a[2];
FinProceso`);
    const settings = { baseZeroArrays: true };
    const c = new CGenerator({ settings, comments: false }).generate(program).code!;
    expect(c).toContain("a[0] = 1;");
    expect(c).toContain('printf("%g\\n", a[2]);');
    const cpp = new CppGenerator({ settings, comments: false }).generate(program).code!;
    expect(cpp).toContain("cout << a[2] << endl;");
  });

  test("translates by-reference parameters", () => {
    const program = parseSource(`SubProceso Cambiar(v Por Referencia)
  v <- 7;
FinSubProceso

Proceso Principal
  c <- 0;
  Cambiar(c);
FinProceso`);
    const c = new CGenerator({ comments: false }).generate(program).code!;
    expect(c).toContain("void cambiar(double *v);");
    expect(c).toContain("cambiar(&c);");
    expect(c).toContain("(*v) = 7;");
    const cpp = new CppGenerator({ comments: false }).generate(program).code!;
    expect(cpp).toContain("void cambiar(double &v);");
    expect(cpp).toContain("cambiar(c);");
  });

  test("writes without a newline for Escribir Sin Saltar", () => {
    const program = parseSource(`Proceso P
  Escribir Sin Bajar "a";
FinProceso`);
    expect(new CGenerator().generate(program).code).toContain('printf("a");');
    expect(new CppGenerator().generate(program).code).toContain('cout << "a";');
  });
});
