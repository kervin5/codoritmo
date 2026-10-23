import {
  defaultEngineSettings,
  evaluateExpressionAt,
  getEngineProfile,
  Interpreter,
  normalizeEngineSettings,
  Parser,
  type EngineSettings,
  type VariableSnapshot,
} from "../engine";
import { enDictionary as en } from "../i18n/en";
import { esDictionary as es } from "../i18n/es";
import { formatDiagnostic } from "../i18n/diagnostics";

/** Runs `source` and returns the variables as they were when `line` was about to run. */
async function variablesAt(
  source: string,
  line: number,
  settings: Partial<EngineSettings> = {},
  input: string[] = []
): Promise<VariableSnapshot[]> {
  let captured: VariableSnapshot[] | null = null;
  const queue = [...input];
  const interpreter = new Interpreter({
    settings,
    hooks: {
      onStatement: (event) => {
        if (event.line === line && !captured) captured = event.variables();
      },
    },
  });
  await interpreter.run(source, {
    write() {},
    read: () => queue.shift() ?? "",
    clear() {},
    sleep: async () => {},
    waitForKey: async () => {},
  });
  if (!captured) throw new Error(`line ${line} never ran`);
  return captured;
}

const program = `Algoritmo Demo
  Definir nombre Como Cadena
  Definir x Como Entero
  Definir terminado Como Logico
  Dimension v[4]
  nombre <- "Ana"
  x <- 7
  terminado <- Falso
  v[1] <- 3
  v[2] <- 9
  v[3] <- 1
  v[4] <- 5
  Escribir x
FinAlgoritmo`;

describe("evaluateExpressionAt", () => {
  let variables: VariableSnapshot[];
  beforeAll(async () => {
    variables = await variablesAt(program, 13);
  });

  it("evaluates arithmetic with builtins against the step's variables", async () => {
    await expect(evaluateExpressionAt("x * 2 + Longitud(nombre)", variables, defaultEngineSettings)).resolves.toEqual({
      ok: true,
      value: 17,
    });
  });

  it("reads array elements with index arithmetic", async () => {
    const i = { name: "i", dataType: "Entero", initialized: true, scopeDepth: 0, value: 2 };
    await expect(evaluateExpressionAt("v[i] > v[i+1]", [...variables, i], defaultEngineSettings)).resolves.toEqual({
      ok: true,
      value: true,
    });
  });

  it("handles logical operators, text functions and whole arrays", async () => {
    await expect(evaluateExpressionAt("NO terminado", variables, defaultEngineSettings)).resolves.toEqual({ ok: true, value: true });
    await expect(evaluateExpressionAt("Mayusculas(nombre)", variables, defaultEngineSettings)).resolves.toEqual({
      ok: true,
      value: "ANA",
    });
    await expect(evaluateExpressionAt("v", variables, defaultEngineSettings)).resolves.toEqual({ ok: true, value: [3, 9, 1, 5] });
  });

  it("does not change the variables it was given", async () => {
    const before = JSON.stringify(variables);
    await evaluateExpressionAt("v[1] + x", variables, defaultEngineSettings);
    expect(JSON.stringify(variables)).toBe(before);
  });

  it("reports unknown variables with a localized message", async () => {
    const result = await evaluateExpressionAt("z + 1", variables, defaultEngineSettings);
    expect(result).toMatchObject({ ok: false, diagnostic: { code: "EVAL_UNKNOWN_VARIABLE", params: { name: "z" } } });
    if (result.ok) throw new Error("expected an error");
    expect(formatDiagnostic(result.diagnostic, es)).toBe('No hay ninguna variable "z" en este paso.');
    expect(formatDiagnostic(result.diagnostic, en)).toBe('There is no variable "z" at this step.');
  });

  it("reports type errors with the program's rules", async () => {
    await expect(evaluateExpressionAt("nombre * 2", variables, defaultEngineSettings)).resolves.toMatchObject({
      ok: false,
      diagnostic: { code: "PARSE_ARITHMETIC_OPERAND" },
    });
    await expect(evaluateExpressionAt("x Y terminado", variables, defaultEngineSettings)).resolves.toMatchObject({
      ok: false,
      diagnostic: { code: "PARSE_LOGICAL_OPERAND" },
    });
  });

  it("reports syntax errors and empty input", async () => {
    await expect(evaluateExpressionAt("x +", variables, defaultEngineSettings)).resolves.toMatchObject({ ok: false });
    await expect(evaluateExpressionAt("x 2", variables, defaultEngineSettings)).resolves.toMatchObject({
      ok: false,
      diagnostic: { code: "PARSE_UNEXPECTED_TOKEN" },
    });
    await expect(evaluateExpressionAt("   ", variables, defaultEngineSettings)).resolves.toMatchObject({
      ok: false,
      diagnostic: { code: "PARSE_EXPRESSION" },
    });
  });

  it("reports runtime errors such as division by zero and out-of-range indices", async () => {
    await expect(evaluateExpressionAt("x / (x - 7)", variables, defaultEngineSettings)).resolves.toMatchObject({
      ok: false,
      diagnostic: { code: "RUNTIME_DIVISION_BY_ZERO" },
    });
    await expect(evaluateExpressionAt("v[9]", variables, defaultEngineSettings)).resolves.toMatchObject({
      ok: false,
      diagnostic: { code: "RUNTIME_ARRAY_BOUNDS" },
    });
  });

  it("follows the profile: base-zero arrays", async () => {
    const settings = normalizeEngineSettings({ baseZeroArrays: true });
    const source = `Algoritmo A
  Dimension v[3]
  v[0] <- 10
  v[2] <- 30
  Escribir v[0]
FinAlgoritmo`;
    const vars = await variablesAt(source, 5, settings);
    await expect(evaluateExpressionAt("v[0] + v[2]", vars, settings)).resolves.toEqual({ ok: true, value: 40 });
  });

  it("follows the profile: uninitialized variables are an error when the profile requires it", async () => {
    const strict = getEngineProfile("desktop-default")!.settings;
    const source = `Algoritmo A
  Definir a Como Entero
  Escribir 1
FinAlgoritmo`;
    const settings = normalizeEngineSettings({ ...strict, forceInitVars: true });
    const vars = await variablesAt(source, 3, settings);
    await expect(evaluateExpressionAt("a + 1", vars, settings)).resolves.toMatchObject({
      ok: false,
      diagnostic: { code: "RUNTIME_UNINITIALIZED" },
    });
  });

  describe("the program's own functions", () => {
    const source = `Funcion r <- Doble(n)
  r <- n * 2
FinFuncion

Funcion r <- Pide()
  Leer r
FinFuncion

Funcion r <- Eterna(n)
  Mientras Verdadero Hacer
    n <- n + 1
  FinMientras
  r <- n
FinFuncion

SubProceso Duplicar(a Por Referencia)
  a <- a * 2
FinSubProceso

Algoritmo A
  Definir x Como Entero
  x <- 4
  Escribir Doble(x)
FinAlgoritmo`;
    const parsed = new Parser(source).parse();

    it("can be called, on copies of the variables", async () => {
      const vars = await variablesAt(source, 23);
      await expect(evaluateExpressionAt("Doble(x) + 1", vars, defaultEngineSettings, { program: parsed.program })).resolves.toEqual({
        ok: true,
        value: 9,
      });
    });

    it("refuses functions that read input", async () => {
      const vars = await variablesAt(source, 23);
      await expect(evaluateExpressionAt("Pide()", vars, defaultEngineSettings, { program: parsed.program })).resolves.toMatchObject({
        ok: false,
        diagnostic: { code: "EVAL_READS_INPUT", params: { name: "Pide" } },
      });
    });

    it("stops calls that never end", async () => {
      const vars = await variablesAt(source, 23);
      await expect(
        evaluateExpressionAt("Eterna(1)", vars, defaultEngineSettings, { program: parsed.program, maxSteps: 2000 })
      ).resolves.toMatchObject({ ok: false, diagnostic: { code: "EVAL_TOO_LONG", params: { steps: 2000 } } });
    });

    it("refuses subprocesses that return nothing", async () => {
      const vars = await variablesAt(source, 23);
      const result = await evaluateExpressionAt("Duplicar(x)", vars, defaultEngineSettings, { program: parsed.program });
      expect(result.ok).toBe(false);
      expect(vars.find((v) => v.name === "x")?.value).toBe(4);
    });
  });
});
