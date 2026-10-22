import {
  createBrowserRuntime,
  Interpreter,
  startExecution,
  type ExecutionStatementEvent,
} from "../engine";
import { createInterpreterWorker } from "../engine/create-interpreter-worker";

jest.mock("../engine/create-interpreter-worker", () => ({
  createInterpreterWorker: jest.fn(() => null),
}));

const infiniteLoop = `Proceso Infinito
  Mientras Verdadero Hacer
  FinMientras
FinProceso`;

function tick(ms = 20) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Loads interpreter.worker.ts against a fake global scope so the real
 * message protocol runs in-process. terminate() only drops messages, so
 * tests keep a small step budget to let looping programs end on their own.
 */
function createFakeWorker() {
  const workerScope: {
    onmessage: ((event: { data: unknown }) => void) | null;
    postMessage: (message: unknown) => void;
  } = {
    onmessage: null,
    postMessage: (message) => {
      setTimeout(() => {
        if (!host.terminated) {
          host.onmessage?.({ data: message } as MessageEvent);
        }
      }, 0);
    },
  };
  const host = {
    onmessage: null as ((event: MessageEvent) => void) | null,
    onerror: null as ((event: ErrorEvent) => void) | null,
    terminated: false,
    postMessage(message: unknown) {
      setTimeout(() => {
        if (!host.terminated) {
          workerScope.onmessage?.({ data: message });
        }
      }, 0);
    },
    terminate() {
      host.terminated = true;
    },
  };

  const globalWithSelf = globalThis as { self: unknown };
  const originalSelf = globalWithSelf.self;
  globalWithSelf.self = workerScope;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("../engine/interpreter.worker");
  });
  globalWithSelf.self = originalSelf;

  return host;
}

describe("interpreter step budget and hooks", () => {
  it("stops an infinite loop with a clear diagnostic after maxSteps", async () => {
    const result = await new Interpreter({
      limits: { maxSteps: 10_000 },
    }).run(infiniteLoop, createBrowserRuntime().runtime);

    expect(result.state).toBe("runtime_error");
    expect(result.diagnostics[0]?.code).toBe("RUNTIME_STEP_LIMIT");
    expect(result.diagnostics[0]?.params).toEqual({ steps: 10_000 });
    // Points at the loop, since its empty body has no statement of its own.
    expect(result.diagnostics[0]?.line).toBe(2);
  });

  it("yields to the event loop so other tasks run during long loops", async () => {
    let timerFired = false;
    setTimeout(() => {
      timerFired = true;
    }, 0);
    let firedDuringRun = false;

    const result = await new Interpreter({
      limits: { yieldEvery: 100, maxSteps: 5_000 },
      hooks: {
        onStatement: () => {
          firedDuringRun ||= timerFired;
        },
      },
    }).run(
      `Proceso P
  Para i <- 1 Hasta 1000 Hacer
    x <- i
  FinPara
FinProceso`,
      createBrowserRuntime().runtime
    );

    expect(result.state).toBe("ok");
    expect(firedDuringRun).toBe(true);
  });

  it("ends with state stopped when shouldStop returns true", async () => {
    let stop = false;
    const pending = new Interpreter({
      limits: { yieldEvery: 500 },
      hooks: { shouldStop: () => stop },
    }).run(infiniteLoop, createBrowserRuntime().runtime);

    await tick();
    stop = true;

    await expect(pending).resolves.toMatchObject({ state: "stopped" });
  });

  it("reports statement lines and variable snapshots for debuggers", async () => {
    const events: Array<
      Pick<ExecutionStatementEvent, "line" | "kind" | "callDepth" | "routine">
    > = [];
    let snapshotAtWrite: ReturnType<ExecutionStatementEvent["variables"]> = [];

    await new Interpreter({
      hooks: {
        onStatement: (event) => {
          events.push({
            line: event.line,
            kind: event.kind,
            callDepth: event.callDepth,
            routine: event.routine,
          });
          if (event.kind === "write" && event.routine === null) {
            snapshotAtWrite = event.variables();
          }
        },
      },
    }).run(
      `Proceso Depurar
  Dimension lista[2]
  Contador <- 3
  lista[1] <- 7
  Doble(Contador)
  Escribir Contador
FinProceso

SubProceso Doble(n)
  n <- n * 2
FinSubProceso`,
      createBrowserRuntime().runtime
    );

    expect(events.map((event) => event.line)).toEqual([2, 3, 4, 5, 10, 6]);
    expect(events[4]).toMatchObject({ callDepth: 1, routine: "Doble" });
    expect(snapshotAtWrite).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Contador", value: 3, scopeDepth: 0 }),
        expect.objectContaining({ name: "lista", value: [7, null] }),
      ])
    );
  });
});

describe("startExecution (in-thread fallback)", () => {
  it("uses the in-thread runner when no Worker is available", () => {
    const execution = startExecution({ source: "Proceso P\nFinProceso", settings: {} });
    expect(execution.mode).toBe("in-thread");
  });

  it("can stop an infinite loop", async () => {
    const execution = startExecution({ source: infiniteLoop, settings: {} });

    await tick();
    execution.stop();

    await expect(execution.result).resolves.toMatchObject({ state: "stopped" });
  });

  it("can stop a program blocked on Leer", async () => {
    const execution = startExecution({
      source: `Proceso P
  Escribir "Nombre?"
  Leer nombre
FinProceso`,
      settings: {},
    });

    await tick();
    expect(execution.isAwaitingInput()).toBe(true);
    execution.stop();

    await expect(execution.result).resolves.toEqual({
      output: ["Nombre?"],
      diagnostics: [],
      state: "stopped",
    });
  });
});

describe("startExecution (worker)", () => {
  const mockedCreateWorker = createInterpreterWorker as jest.MockedFunction<
    typeof createInterpreterWorker
  >;

  afterEach(() => {
    mockedCreateWorker.mockImplementation(() => null);
  });

  function useFakeWorker() {
    const worker = createFakeWorker();
    mockedCreateWorker.mockImplementation(() => worker as unknown as Worker);
    return worker;
  }

  it("bridges output, Leer and Esperar Tecla over messages", async () => {
    useFakeWorker();
    const outputs: string[][] = [];
    const execution = startExecution({
      source: `Proceso Puente
  Escribir "Nombre?"
  Leer nombre
  Escribir "Hola ", nombre
  Esperar Tecla
  Limpiar Pantalla
  Escribir "Fin"
FinProceso`,
      settings: {},
      onOutput: (output) => outputs.push(output),
    });

    expect(execution.mode).toBe("worker");

    await tick();
    expect(execution.isAwaitingInput()).toBe(true);
    expect(execution.getOutput()).toEqual(["Nombre?"]);

    execution.submitInput("Ada");
    await tick();
    expect(execution.isAwaitingKey()).toBe(true);
    expect(execution.getOutput()).toEqual(["Nombre?", "Hola Ada"]);

    execution.continueKey();
    const result = await execution.result;

    expect(result).toEqual({ output: ["Fin"], diagnostics: [], state: "ok" });
    expect(execution.getOutput()).toEqual(["Fin"]);
    expect(outputs.at(-1)).toEqual(["Fin"]);
  });

  it("stops a looping program and terminates the worker", async () => {
    const worker = useFakeWorker();
    const execution = startExecution({
      source: `Proceso Eco
  Mientras Verdadero Hacer
    Escribir "x"
  FinMientras
FinProceso`,
      settings: {},
      limits: { yieldEvery: 200, maxSteps: 50_000 },
    });

    await tick(60);
    execution.stop();
    const result = await execution.result;

    expect(worker.terminated).toBe(true);
    expect(result.state).toBe("stopped");
    expect(result.output.length).toBeGreaterThan(0);
    expect(result.output.every((line) => line === "x")).toBe(true);
  });

  it("keeps only the most recent console lines during output floods", async () => {
    useFakeWorker();
    const execution = startExecution({
      source: `Proceso Inunda
  Para i <- 1 Hasta 500 Hacer
    Escribir i
  FinPara
FinProceso`,
      settings: {},
      limits: { maxOutputLines: 3 },
    });

    const result = await execution.result;
    expect(result.output).toEqual(["498", "499", "500"]);
    expect(execution.getOutput()).toEqual(["498", "499", "500"]);
  });

  it("forwards statement events when a debugger asks for them", async () => {
    useFakeWorker();
    const lines: number[] = [];
    const execution = startExecution({
      source: `Proceso Traza
  a <- 1
  Escribir a
FinProceso`,
      settings: {},
      onStatement: (event) => lines.push(event.line),
    });

    await execution.result;
    expect(lines).toEqual([2, 3]);
  });
});
