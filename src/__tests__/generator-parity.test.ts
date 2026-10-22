import {
  examplePrograms,
  Interpreter,
  JavaScriptGenerator,
  Parser,
  runGeneratedJavaScript,
} from "../engine";
import type { EngineSettings, ProgramNode, Runtime } from "../engine";

// Generated JavaScript must behave like the interpreter. Each program runs
// three ways: in the interpreter, as generateExecutable() code and as the
// standalone Node.js export, and the outcomes are compared.

interface RunOptions {
  input?: string[];
  settings?: Partial<EngineSettings>;
  random?: () => number;
  /** The standalone export does not support this case yet. */
  skipStandalone?: boolean;
}

interface Outcome {
  state: "ok" | "runtime_error";
  output: string[];
}

function createRuntime(input: string[]) {
  const queue = [...input];
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
      pending = "";
    },
    async sleep() {},
    async waitForKey() {},
  };
  return { runtime, output: () => (pending ? [...lines, pending] : [...lines]) };
}

function parse(source: string, settings?: Partial<EngineSettings>): ProgramNode {
  const parsed = new Parser(source, { settings }).parse();
  expect(parsed.diagnostics).toEqual([]);
  return parsed.program!;
}

async function runInterpreter(source: string, options: RunOptions): Promise<Outcome> {
  const { runtime } = createRuntime(options.input ?? []);
  const result = await new Interpreter({
    settings: options.settings,
    random: options.random,
  }).run(source, runtime);
  expect(result.state).not.toBe("parse_error");
  return { state: result.state === "ok" ? "ok" : "runtime_error", output: result.output };
}

async function runExecutable(source: string, options: RunOptions): Promise<Outcome> {
  const program = parse(source, options.settings);
  const { code } = new JavaScriptGenerator({ settings: options.settings }).generateExecutable(program);
  const { runtime, output } = createRuntime(options.input ?? []);
  try {
    await runGeneratedJavaScript(code!, runtime, options.random);
    return { state: "ok", output: output() };
  } catch (error) {
    expect((error as Error).name).toBe("PSeIntRuntimeError");
    return { state: "runtime_error", output: output() };
  }
}

// Runs the Node.js export with fake readline/stdout modules.
async function runStandalone(source: string, options: RunOptions): Promise<Outcome> {
  const program = parse(source, options.settings);
  const { code } = new JavaScriptGenerator({ settings: options.settings }).generate(program, {
    target: "node",
  });
  const queue = [...(options.input ?? [])];
  let stdout = "";
  const errors: string[] = [];
  let finish!: () => void;
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const modules: Record<string, unknown> = {
    "node:readline/promises": {
      createInterface: () => ({
        question: async (prompt: string) => {
          // Esperar Tecla asks with a prompt: it is a key press, not a Leer.
          if (prompt) return "";
          if (queue.length === 0) throw new Error("no input");
          return queue.shift()!;
        },
        close: async () => finish(),
      }),
    },
    "node:process": {
      stdin: {},
      stdout: {
        write: (text: string) => {
          stdout = text === "\x1Bc" ? "" : stdout + text;
        },
      },
    },
  };
  const fakeConsole = { error: (message: string) => errors.push(message) };
  const fakeProcess = { exitCode: 0 };
  const randomSpy = options.random ? jest.spyOn(Math, "random").mockImplementation(options.random) : null;
  try {
    new Function("require", "console", "process", "setTimeout", code!)(
      (name: string) => modules[name],
      fakeConsole,
      fakeProcess,
      (callback: () => void) => callback()
    );
    await finished;
  } finally {
    randomSpy?.mockRestore();
  }

  const output = stdout.split("\n");
  if (stdout.endsWith("\n")) output.pop();
  if (stdout === "") output.length = 0;
  expect(fakeProcess.exitCode).toBe(errors.length > 0 ? 1 : 0);
  return { state: errors.length > 0 ? "runtime_error" : "ok", output };
}

async function expectParity(source: string, options: RunOptions = {}): Promise<Outcome> {
  const expected = await runInterpreter(source, options);
  expect(await runExecutable(source, options)).toEqual(expected);
  if (!options.skipStandalone) {
    expect(await runStandalone(source, options)).toEqual(expected);
  }
  return expected;
}

function program(body: string, before = ""): string {
  return `${before}\nAlgoritmo prueba\n${body}\nFinAlgoritmo\n`;
}

describe("generated JavaScript matches the interpreter", () => {
  it("rounds output to 10 decimals and never uses exponent notation", async () => {
    const outcome = await expectParity(
      program(
        `Escribir 0.1 + 0.2\nEscribir 1/3\nEscribir 10^20\nEscribir 2/10000000\nEscribir ConvertirATexto(1/3)\nt <- "x = "\nEscribir t + ConvertirATexto(2/3)`
      )
    );
    expect(outcome.output).toEqual([
      "0.3",
      "0.3333333333",
      "100000000000000000000",
      "0.0000002",
      "0.3333333333",
      "x = 0.6666666667",
    ]);
  });

  it("applies the trunc epsilon and rounds half away from zero", async () => {
    const outcome = await expectParity(
      program(`Escribir trunc(100*0.57), " ", trunc(-0.57*100), " ", redon(-2.5), " ", redon(2.5)`)
    );
    expect(outcome.output).toEqual(["57 -57 -3 3"]);
  });

  it.each(["1/0", "5 % 0", "asen(2)", "acos(-2)", "rc(-1)", "raiz(-4)", "ln(0)", "azar(0)"])(
    "raises a runtime error for %s",
    async (expression) => {
      const outcome = await expectParity(program(`x <- 0\nEscribir "antes"\nEscribir ${expression}\nEscribir "después"`));
      expect(outcome).toEqual({ state: "runtime_error", output: ["antes"] });
    }
  );

  it("supports Aleatorio, PI, EULER, FechaActual and HoraActual", async () => {
    jest.useFakeTimers({
      now: new Date(2024, 4, 6, 13, 5, 9),
      doNotFake: [
        "hrtime",
        "nextTick",
        "performance",
        "queueMicrotask",
        "setImmediate",
        "clearImmediate",
        "setInterval",
        "clearInterval",
        "setTimeout",
        "clearTimeout",
      ],
    });
    try {
      const outcome = await expectParity(
        program(
          `Escribir Aleatorio(5, 10), " ", Aleatorio(3, 1), " ", Azar(6)\nEscribir PI\nEscribir EULER\nEscribir FechaActual()\nEscribir HoraActual()`
        ),
        { random: () => 0.999 }
      );
      expect(outcome.output.slice(0, 3)).toEqual(["10 3 5", "3.1415926536", "2.7182818285"]);
      expect(outcome.output[4]).toBe("130509");
    } finally {
      jest.useRealTimers();
    }
  });

  it("passes arrays to subprocesses by reference", async () => {
    const outcome = await expectParity(
      program(
        `Dimension v[2]\nv[1] <- 1\nCambia(v)\nEscribir v[1]\nCrece(v)\nEscribir v[1], " ", v[3]`,
        `SubProceso Cambia(a)\n  a[1] <- 42\nFinSubProceso\nSubProceso Crece(a)\n  Redimensionar a[3]\n  a[3] <- 9\nFinSubProceso`
      )
    );
    expect(outcome.output).toEqual(["42", "42 9"]);
  });

  it("rejects Por Valor on an array and still copies scalars", async () => {
    const scalars = await expectParity(
      program(
        `a <- 1\nb <- 1\nCambia(a, b)\nEscribir a, b`,
        `SubProceso Cambia(p Por Valor, q Por Copia)\n  p <- 9\n  q <- 9\nFinSubProceso`
      )
    );
    expect(scalars.output).toEqual(["11"]);

    const arrays = await expectParity(
      program(
        `Dimension v[2]\nv[1] <- 1\nCambia(v)\nEscribir v[1]`,
        `SubProceso Cambia(a Por Valor)\n  Escribir "dentro"\nFinSubProceso`
      )
    );
    expect(arrays.state).toBe("runtime_error");
  });

  it("passes scalars by reference", async () => {
    const outcome = await expectParity(
      program(
        `x <- 1\nDimension v[2]\nv[2] <- 5\nDuplica(x)\nDuplica(v[2])\nEscribir x, " ", v[2]`,
        `SubProceso Duplica(n Por Referencia)\n  n <- n * 2\nFinSubProceso`
      )
    );
    expect(outcome.output).toEqual(["2 10"]);
  });

  it("forwards a by-reference parameter to another subprocess", async () => {
    const outcome = await expectParity(
      program(
        `a <- 9\nb <- 2\nc <- 5\nOrdenarTres(a, b, c)\nEscribir a, " ", b, " ", c`,
        `SubProceso Intercambiar(a Por Referencia, b Por Referencia)\n  t <- a\n  a <- b\n  b <- t\nFinSubProceso\n` +
          `SubProceso OrdenarTres(n1 Por Referencia, n2 Por Referencia, n3 Por Referencia)\n` +
          `  Si n1 > n2 Entonces\n    Intercambiar(n1, n2)\n  FinSi\n` +
          `  Si n2 > n3 Entonces\n    Intercambiar(n2, n3)\n  FinSi\n` +
          `  Si n1 > n2 Entonces\n    Intercambiar(n1, n2)\n  FinSi\nFinSubProceso`
      )
    );
    expect(outcome.output).toEqual(["2 5 9"]);
  });

  it("passes array elements by reference", async () => {
    const outcome = await expectParity(
      program(
        `Dimension v[3], m[2,2]\nPara i <- 1 Hasta 3 Hacer\n  v[i] <- i * 10\nFinPara\n` +
          `i <- 1\nIntercambiar(v[i], v[3])\nm[2,1] <- 4\nIntercambiar(m[2,1], v[2])\n` +
          `Escribir v[1], " ", v[2], " ", v[3], " ", m[2,1]`,
        `SubProceso Intercambiar(a Por Referencia, b Por Referencia)\n  t <- a\n  a <- b\n  b <- t\nFinSubProceso`
      )
    );
    expect(outcome.output).toEqual(["30 4 10 20"]);
  });

  it("keeps by-reference changes made by a Funcion used in an expression", async () => {
    const outcome = await expectParity(
      program(
        `c <- 0\nx <- Siguiente(c) + Siguiente(c) * 10\nEscribir x, " ", c\n` +
          `Si Siguiente(c) = 3 Entonces\n  Escribir "tres"\nFinSi`,
        `Funcion r <- Siguiente(n Por Referencia)\n  n <- n + 1\n  r <- n\nFinFuncion`
      )
    );
    expect(outcome.output).toEqual(["21 2", "tres"]);
  });

  it("aliases array elements in Para Cada, across every dimension", async () => {
    const vector = await expectParity(
      program(`Dimension a[3]\nPara Cada x En a Hacer\n x <- 1\nFinPara\nParaCada x De a Hacer\n Escribir x Sin Saltar\nFinPara`)
    );
    expect(vector.output).toEqual(["111"]);

    const matrix = await expectParity(
      program(
        `Dimension m[2,3]\nk <- 0\nPara Cada e En m Hacer\n k <- k + 1\n e <- k * 10\nFinPara\nEscribir m[1,1], " ", m[1,3], " ", m[2,1], " ", m[2,3]\nPara Cada e En m Hacer\n Escribir e Sin Saltar\nFinPara`
      )
    );
    expect(matrix.output).toEqual(["10 30 40 60", "102030405060"]);
  });

  it("keeps overlapping values when an array is resized", async () => {
    const outcome = await expectParity(
      program(
        `Dimensionar a[2]\na[1] <- 5\nRedimensionar a[4]\na[4] <- 7\nEscribir a[1], " ", a[4]\nRedimensionar a[1]\nEscribir a[1]\nDimension m[2,2]\nm[1,2] <- 3\nm[2,1] <- 4\nRedimensionar m[3,3]\nEscribir m[1,2], " ", m[2,1], " ", m[3,3]`
      )
    );
    expect(outcome.output).toEqual(["5 7", "5", "3 4 0"]);

    const outOfBounds = await expectParity(
      program(`Dimension a[3]\na[3] <- 1\nRedimensionar a[2]\nEscribir a[3]`),
      // The standalone export does not check array bounds.
      { skipStandalone: true }
    );
    expect(outOfBounds.state).toBe("runtime_error");
  });

  it("only returns a value from Funcion r <- nombre(...)", async () => {
    const outcome = await expectParity(
      program(
        `Saluda(3)\nEscribir Doble(4)\nEscribir Cuenta`,
        `Funcion Saluda(n)\n  Escribir "hola ", n\nFinFuncion\nFuncion r <- Doble(n)\n  r <- n * 2\nFinFuncion\nFuncion total <- Cuenta\n  total <- 7\nFinFuncion`
      )
    );
    expect(outcome.output).toEqual(["hola 3", "8", "7"]);
  });

  it("resolves identifiers and routines case-insensitively", async () => {
    const outcome = await expectParity(
      program(
        `Saluda\nSALUDA()\nTotal <- 1\nEscribir TOTAL, doble(TOTAL), DOBLE(2)`,
        `SubProceso saluda\n  Escribir "hola"\nFinSubProceso\nFuncion r <- Doble(n)\n  r <- n * 2\nFinFuncion`
      )
    );
    expect(outcome.output).toEqual(["hola", "hola", "124"]);
  });

  it("converts values read with Leer and defaults uninitialized variables", async () => {
    const outcome = await expectParity(
      program(`Leer x\nEscribir x + 1\nLeer t\nEscribir t + "!"\nDefinir b Como Logico\nLeer b\nEscribir b\nDefinir n Como Entero\nEscribir n`),
      { input: ["7", "hola", "v"] }
    );
    expect(outcome.output).toEqual(["8", "hola!", "VERDADERO", "0"]);
  });

  it.each(examplePrograms.map((example) => [example.id, example] as const))(
    "runs the %s example",
    async (_id, example) => {
      const outcome = await expectParity(example.source, {
        settings: example.settings,
        input: example.input?.split("\n"),
        random: () => 0.25,
      });
      expect(outcome.state).toBe("ok");
    }
  );
});
