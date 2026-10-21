import {
  examplePrograms,
  getAllProfiles,
  Interpreter,
  Parser,
} from "../engine";
import type { EngineSettings, ExecutionResult, Runtime } from "../engine";

// Regression tests for the language-parity fixes listed in
// docs/pseint-parity-review.md (sections 1 and 3).

interface RunOptions {
  input?: string[];
  settings?: Partial<EngineSettings>;
  before?: string;
  random?: () => number;
}

function run(body: string, options: RunOptions = {}): Promise<ExecutionResult> {
  return runSource(`${options.before ?? ""}\nAlgoritmo prueba\n${body}\nFinAlgoritmo\n`, options);
}

async function runSource(source: string, options: RunOptions = {}): Promise<ExecutionResult> {
  const queue = [...(options.input ?? [])];
  const lines: string[] = [];
  let pending = "";
  const runtime: Runtime = {
    write(value, newline = true) {
      pending += value;
      if (newline) {
        lines.push(pending);
        pending = "";
      }
    },
    read() {
      if (queue.length === 0) throw new Error("no input");
      return queue.shift()!;
    },
    clear() {
      lines.length = 0;
    },
    async sleep() {},
    async waitForKey() {},
  };
  const result = await new Interpreter({ settings: options.settings, random: options.random }).run(source, runtime);
  return { ...result, output: pending ? [...lines, pending] : lines };
}

async function output(body: string, options: Parameters<typeof run>[1] = {}): Promise<string[]> {
  const result = await run(body, options);
  expect(result.diagnostics).toEqual([]);
  return result.output;
}

function parseError(body: string, settings: Partial<EngineSettings> = {}, before = "") {
  const result = new Parser(`${before}\nAlgoritmo prueba\n${body}\nFinAlgoritmo\n`, { settings }).parse();
  expect(result.program).toBeNull();
  return result.diagnostics[0]!;
}

describe("lexer", () => {
  it("only uses . as the decimal separator", async () => {
    expect(await output(`Escribir 1, 2`)).toEqual(["12"]);
    expect(await output(`Escribir Subcadena("hola",2,3)`)).toEqual(["ol"]);
    expect(await output(`Dimension m[3,4]\nm[3,4] <- 1.5\nEscribir m[3,4]`)).toEqual(["1.5"]);
    expect(await output(`Escribir .5 + 1`)).toEqual(["1.5"]);
  });

  it("supports the & | ~ % operators and does not treat braces as comments", async () => {
    expect(await output(`Escribir Verdadero & Falso, " ", Falso | Verdadero, " ", ~Falso, " ", 10 % 4`)).toEqual([
      "FALSO VERDADERO VERDADERO 2",
    ]);
    expect(await output(`Escribir Verdadero && Verdadero, Falso || Falso`)).toEqual(["VERDADEROFALSO"]);
    parseError(`{ comentario }\nEscribir 1`);
  });

  it("treats lowercase y/o as AND/OR", async () => {
    expect(await output(`x <- 3\nSi x > 1 y x < 5 Entonces\nEscribir "dentro"\nFinSi\nEscribir x < 1 o x = 3`)).toEqual([
      "dentro",
      "VERDADERO",
    ]);
  });

  it("does not process backslash escapes in strings", async () => {
    expect(await output(`Escribir "C:\\nuevo\\tdir"`)).toEqual(["C:\\nuevo\\tdir"]);
    expect(await output(`Escribir 'comillas "dobles"'`)).toEqual(['comillas "dobles"']);
  });
});

describe("keywords and aliases", () => {
  it("supports Imprimir, Informar and Mostrar as Escribir", async () => {
    expect(await output(`Imprimir "a"\nInformar "b"\nMostrar "c"`)).toEqual(["a", "b", "c"]);
  });

  it("supports every Sin Saltar spelling", async () => {
    expect(
      await output(`Escribir "a" Sin Saltar\nEscribir "b" SinSaltar\nEscribir "c" Sin Bajar\nEscribir "d" SinBajar\nEscribir "e"`)
    ).toEqual(["abcde"]);
  });

  it("supports every clear-screen spelling", async () => {
    for (const keyword of ["Borrar Pantalla", "BorrarPantalla", "Limpiar Pantalla", "LimpiarPantalla"]) {
      expect(await output(`Escribir "x"\n${keyword}\nEscribir "y"`)).toEqual(["y"]);
    }
  });

  it("supports Por Valor and Por Copia parameters", async () => {
    expect(
      await output(`a <- 1\nb <- 1\nCambia(a, b)\nEscribir a, b`, {
        before: `SubProceso Cambia(p Por Valor, q Por Copia)\n  p <- 9\n  q <- 9\nFinSubProceso`,
      })
    ).toEqual(["11"]);
  });

  it("supports plural and synonym type names", async () => {
    expect(
      await output(
        `Definir a, b Como Enteros\nDefinir c Como Numero\nDefinir d Como Textos\nDefinir e Como Lógicas\nDefinir f Como Caracteres\nz Es Real\nw, v Son Cadenas\nEscribir a, c, "[", d, "]", e, z`
      )
    ).toEqual(["00[]FALSO0"]);
  });

  it("supports Para Cada ... En and ParaCada", async () => {
    expect(
      await output(`Dimension a[3]\nPara Cada x En a Hacer\n x <- 1\nFinPara\nParaCada x De a Hacer\n Escribir x Sin Saltar\nFinPara`)
    ).toEqual(["111"]);
  });

  it("supports Si Es and Segun without Hacer under lazy syntax", async () => {
    expect(await output(`x <- 2\nSegun x\n Si Es 1: Escribir "uno"\n Si Es 2: Escribir "dos"\nFinSegun`)).toEqual(["dos"]);
    parseError(`x <- 2\nSegun x\n 1: Escribir "uno"\nFinSegun`, { lazySyntax: false });
  });

  it("supports Dimensionar and Redimensionar", async () => {
    expect(
      await output(`Dimensionar a[2]\na[1] <- 5\nRedimensionar a[4]\na[4] <- 7\nEscribir a[1], a[4]`)
    ).toEqual(["57"]);
    expect(parseError(`Dimension a[2]\nRedimensionar a[4]`, { allowResizeArrays: false }).code).toBe(
      "PARSE_RESIZE_DISABLED"
    );
  });

  it("supports FechaActual, HoraActual, Aleatorio and EULER", async () => {
    const [date, time, random, euler] = await output(
      `Escribir FechaActual()\nEscribir HoraActual()\nEscribir Aleatorio(5, 10)\nEscribir EULER`,
      { random: () => 0.999 }
    );
    expect(date).toMatch(/^20\d{6}$/);
    expect(Number(time)).toBeLessThan(240000);
    expect(random).toBe("10");
    expect(euler).toBe("2.7182818285");
  });
});

describe("semantics", () => {
  it("infers the type of values read into untyped variables", async () => {
    expect(await output(`Leer x\nEscribir x + 1`, { input: ["7"] })).toEqual(["8"]);
    expect(await output(`Leer x\nEscribir x + "!"`, { input: ["hola"] })).toEqual(["hola!"]);
  });

  it("validates values read into typed variables", async () => {
    expect((await run(`Definir x Como Entero\nLeer x`, { input: ["3.7"] })).state).toBe("runtime_error");
    expect((await run(`Definir x Como Numerica\nLeer x`, { input: ["hola"] })).state).toBe("runtime_error");
    expect(await output(`Definir b Como Logico\nLeer b\nEscribir b`, { input: ["v"] })).toEqual(["VERDADERO"]);
  });

  it("reports running out of input as a runtime error on the Leer line", async () => {
    const result = await run(`Leer x`);
    expect(result.state).toBe("runtime_error");
    expect(result.diagnostics[0]?.line).toBe(3);
  });

  it("passes arrays to subprocesses by reference", async () => {
    expect(
      await output(`Dimension v[2]\nv[1] <- 1\nCambia(v)\nEscribir v[1]`, {
        before: `SubProceso Cambia(a)\n  a[1] <- 42\nFinSubProceso`,
      })
    ).toEqual(["42"]);
  });

  it("does not let subprocesses see the caller's variables", async () => {
    const result = await run(`x <- 5\nMuestra()`, {
      before: `SubProceso Muestra\n  Escribir x\nFinSubProceso`,
      settings: { forceInitVars: true },
    });
    expect(result.state).toBe("runtime_error");
  });

  it("rounds output to 10 decimals and never uses exponent notation", async () => {
    expect(await output(`Escribir 0.1 + 0.2\nEscribir 1/3\nEscribir 10^20\nEscribir 2/10000000\nEscribir ConvertirATexto(1/3)`)).toEqual([
      "0.3",
      "0.3333333333",
      "100000000000000000000",
      "0.0000002",
      "0.3333333333",
    ]);
  });

  it("applies the trunc epsilon and rounds half away from zero", async () => {
    expect(await output(`Escribir trunc(100*0.57), " ", trunc(-0.57*100), " ", redon(-2.5), " ", redon(2.5)`)).toEqual([
      "57 -57 -3 3",
    ]);
  });

  it("raises runtime errors for division by zero and math domain errors", async () => {
    for (const expression of ["1/0", "5 % 0", "asen(2)", "acos(-2)", "rc(-1)", "ln(0)", "azar(0)"]) {
      const result = await run(`x <- 0\nEscribir ${expression}`);
      expect([expression, result.state]).toEqual([expression, "runtime_error"]);
    }
  });

  it("gives NO lower precedence than comparisons", async () => {
    expect(await output(`Escribir no 1 = 2\nEscribir Verdadero = no Falso`)).toEqual(["VERDADERO", "VERDADERO"]);
  });

  it("resolves identifiers and routines case-insensitively, with or without parentheses", async () => {
    expect(
      await output(`Saluda\nSALUDA()\nTotal <- 1\nEscribir TOTAL, doble(TOTAL), DOBLE(2)`, {
        before: `SubProceso saluda\n  Escribir "hola"\nFinSubProceso\nFuncion r <- Doble(n)\n  r <- n * 2\nFinFuncion`,
      })
    ).toEqual(["hola", "hola", "124"]);
  });

  it("indexes arrays with parentheses", async () => {
    expect(await output(`Dimension a(3)\na(2) <- 4\nEscribir a(2) * 2`)).toEqual(["8"]);
  });

  it("rejects non-logical conditions", () => {
    expect(parseError(`Mientras 3 Hacer\nFinMientras`).code).toBe("PARSE_CONDITION_NOT_LOGICAL");
    expect(parseError(`a <- 2\nSi a Entonces\nFinSi`).line).toBe(4);
    expect(parseError(`Repetir\nHasta Que 1`).code).toBe("PARSE_CONDITION_NOT_LOGICAL");
  });

  it("requires semicolons when force_semicolon is enabled", async () => {
    expect(parseError(`x <- 1\nEscribir x`, { forceSemicolon: true }).code).toBe("PARSE_MISSING_SEMICOLON");
    expect(await output(`x <- 1;\nSi x = 1 Entonces\n Escribir x;\nFinSi`, { settings: { forceSemicolon: true } })).toEqual(["1"]);
  });

  it("no longer silently ignores unknown instructions", () => {
    expect(parseError(`foo 1`).code).toBe("PARSE_INVALID_INSTRUCTION");
  });
});

describe("bundled programs and profiles", () => {
  it.each(examplePrograms.map((example) => [example.id, example] as const))(
    "runs the %s example",
    async (_id, example) => {
      const result = await runSource(example.source, {
        settings: example.settings,
        input: example.input?.split("\n"),
      });
      expect(result.diagnostics).toEqual([]);
      expect(result.state).toBe("ok");
    }
  );

  it("includes the upstream school profiles with their descriptions", () => {
    const profiles = getAllProfiles();
    expect(profiles.length).toBeGreaterThanOrEqual(463);
    const mil = profiles.find((profile) => profile.id === "111Mil");
    expect(mil?.description).toContain("111Mil");
    expect(mil?.settings.forceDefineVars).toBe(true);
  });
});
