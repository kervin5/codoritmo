import {
  createBrowserRuntime,
  Interpreter,
  JavaScriptGenerator,
  Parser,
  runGeneratedJavaScript,
} from "../engine";

describe("Codoritmo engine", () => {
  it("parses Algoritmo entries and routines declared after the main block", () => {
    const source = `Algoritmo T
  Escribir Booga2
FinAlgoritmo

SubProceso x <- Booga2
  x <- 2
FinSubProceso`;

    const result = new Parser(source).parse();

    expect(result.diagnostics).toHaveLength(0);
    expect(result.program?.entry.headerKind).toBe("Algoritmo");
    expect(result.program?.routines[0]?.name).toBe("Booga2");
  });

  it("parses Definir data types before Dimension declarations", () => {
    const source = `Proceso EjemploArreglo
  Definir notas Como Entero
  Dimension notas[10]
FinProceso`;

    const result = new Parser(source).parse();

    expect(result.diagnostics).toHaveLength(0);
    expect(result.program?.entry.body).toMatchObject([
      { kind: "define", names: ["notas"], dataType: "Entero" },
      { kind: "dimension", items: [{ name: "notas" }] },
    ]);
  });

  it("executes logical operators while still allowing lowercase y and o as variable names", async () => {
    const source = `Proceso Test
  x <- 5
  y <- 10
  o <- 0
  Si x > 3 Y y < 20 Entonces
    o <- 1
  FinSi
  Escribir o
FinProceso`;

    const controller = createBrowserRuntime();
    const result = await new Interpreter().run(source, controller.runtime);

    expect(result.state).toBe("ok");
    expect(result.output).toEqual(["1"]);
  });

  it("supports by-reference mutation and no-newline output", async () => {
    const source = `SubProceso Asigna(v Por Referencia)
  v[1] <- 5
FinSubProceso

Proceso ReferenciasDemo
  Dimension v[3]
  Asigna(v)
  Escribir "Valor: " Sin Bajar
  Escribir v[1]
FinProceso`;

    const controller = createBrowserRuntime();
    const result = await new Interpreter().run(source, controller.runtime);

    expect(result.state).toBe("ok");
    expect(result.output).toEqual(["Valor: 5"]);
  });

  it("honors profile-controlled = assignment and base-zero arrays", async () => {
    const source = `Proceso Perfil
  Dimension a[3]
  a[0] = 7
  Escribir a[0]
FinProceso`;

    const controller = createBrowserRuntime();
    const result = await new Interpreter({
      settings: {
        baseZeroArrays: true,
        overloadEqual: true,
      },
    }).run(source, controller.runtime);

    expect(result.state).toBe("ok");
    expect(result.output).toEqual(["7"]);
  });

  it("rejects = assignment when the profile disables overload_equal", () => {
    const source = `Proceso Perfil
  a = 7
FinProceso`;

    const result = new Parser(source, {
      settings: {
        overloadEqual: false,
      },
    }).parse();

    expect(result.program).toBeNull();
    expect(result.diagnostics[0]?.code).toBe("PARSE_EQUAL_ASSIGNMENT_DISABLED");
  });

  it("requires Definir before assignment when force_define_vars is enabled", async () => {
    const source = `Proceso Tipado
  a <- 1
FinProceso`;

    const controller = createBrowserRuntime();
    const result = await new Interpreter({
      settings: {
        forceDefineVars: true,
      },
    }).run(source, controller.runtime);

    expect(result.state).toBe("runtime_error");
    expect(result.diagnostics[0]?.code).toBe("RUNTIME_DEFINE_REQUIRED");
  });

  it("supports split Fin ... forms and omitted Entonces/Hacer when lazy syntax is enabled", () => {
    const source = `Proceso Flexible
  x <- 1
  Si x = 1
    Escribir x
  Fin Si
Fin Proceso`;

    const result = new Parser(source, {
      settings: {
        lazySyntax: true,
      },
    }).parse();

    expect(result.diagnostics).toHaveLength(0);
    expect(result.program?.entry.body).toHaveLength(2);
  });

  it("rejects accented identifiers when allow_accents is disabled", () => {
    const source = `Proceso Tildes
  Leer varíable
FinProceso`;

    const result = new Parser(source, {
      settings: {
        allowAccents: false,
      },
    }).parse();

    expect(result.program).toBeNull();
    expect(result.diagnostics[0]?.code).toBe(
      "PARSE_IDENTIFIER_ACCENTS_DISABLED"
    );
  });

  it("blocks string cases in Segun when integer_only_switch is enabled", () => {
    const source = `Proceso SegunTexto
  Segun a Hacer
    "hola": Escribir "hola"
  FinSegun
FinProceso`;

    const result = new Parser(source, {
      settings: {
        integerOnlySwitch: true,
      },
    }).parse();

    expect(result.program).toBeNull();
    expect(result.diagnostics[0]?.code).toBe("PARSE_SWITCH_INTEGER_ONLY");
  });

  it("supports Caso, Opcion, and Si Es prefixes in Segun when lazy syntax is enabled", () => {
    const source = `Proceso SegunFlexible
  Segun x Hacer
    Caso 1:
      Escribir "uno"
    Opcion 2:
      Escribir "dos"
    Si Es 3:
      Escribir "tres"
  FinSegun
FinProceso`;

    const result = new Parser(source, {
      settings: {
        lazySyntax: true,
      },
    }).parse();

    expect(result.diagnostics).toHaveLength(0);
    expect(result.program?.entry.body[0]).toMatchObject({
      kind: "switch",
      cases: [
        { values: [{ kind: "literal", value: 1 }] },
        { values: [{ kind: "literal", value: 2 }] },
        { values: [{ kind: "literal", value: 3 }] },
      ],
    });
  });

  it("protects the active Para counter and deduces a negative default step", async () => {
    const source = `Proceso ParaProtegido
  Para i <- 3 Hasta 1 Hacer
    Escribir i
    i <- i - 1
  FinPara
FinProceso`;

    const controller = createBrowserRuntime();
    const result = await new Interpreter({
      settings: {
        protectForCounter: true,
      },
    }).run(source, controller.runtime);

    expect(result.state).toBe("runtime_error");
    expect(result.output).toEqual(["3"]);
    expect(result.diagnostics[0]?.code).toBe("RUNTIME_PROTECTED_COUNTER");
  });

  it("clears output and waits for a key before continuing", async () => {
    const source = `Proceso Runtime
  Escribir "Antes"
  Limpiar Pantalla
  Esperar Tecla
  Escribir "Despues"
FinProceso`;

    const controller = createBrowserRuntime();
    const pending = new Interpreter().run(source, controller.runtime);

    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });

    expect(controller.isAwaitingKey()).toBe(true);
    expect(controller.getOutput()).toEqual([]);

    controller.continueKey();
    const result = await pending;

    expect(result.state).toBe("ok");
    expect(result.output).toEqual(["Despues"]);
  });

  it("waits for interactive input when Leer runs without a preloaded queue", async () => {
    const source = `Proceso Lectura
  Leer valor
  Escribir valor
FinProceso`;

    const controller = createBrowserRuntime();
    const pending = new Interpreter().run(source, controller.runtime);

    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });

    expect(controller.isAwaitingInput()).toBe(true);

    controller.submitInput("42");
    const result = await pending;

    expect(result.state).toBe("ok");
    expect(result.output).toEqual(["42"]);
  });

  it("generates runnable JavaScript that matches interpreter output", async () => {
    const source = `SubProceso x <- Doble(a)
  x <- a * 2
FinSubProceso

Proceso Generator
  Escribir Doble(5)
FinProceso`;

    const parsed = new Parser(source).parse();
    expect(parsed.program).not.toBeNull();

    const generator = new JavaScriptGenerator();
    const browser = generator.generate(parsed.program!);
    expect(browser.diagnostics).toHaveLength(0);
    expect(browser.code).toContain("function createBrowserRuntime()");
    expect(browser.code).toContain("async function generator()");
    expect(browser.code).not.toContain("__runtime_entry");

    const node = generator.generate(parsed.program!, { target: "node" });
    expect(node.diagnostics).toHaveLength(0);
    expect(node.code).toContain(
      "const readline = require('node:readline/promises');"
    );

    const generation = generator.generateExecutable(parsed.program!);
    expect(generation.diagnostics).toHaveLength(0);
    expect(generation.code).toContain("async function __runtime_entry");

    const controller = createBrowserRuntime();
    await runGeneratedJavaScript(
      generation.code!,
      controller.runtime,
      () => 0.25
    );

    expect(controller.getOutput()).toEqual(["10"]);
  });
});
