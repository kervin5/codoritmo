import { createInterpreterWorker } from "./create-interpreter-worker";
import { Interpreter, type InterpreterLimits } from "./interpreter";
import { engineMessage } from "./messages";
import { createBrowserRuntime } from "./runtime";
import type { EngineSettings, ExecutionResult } from "./types";
import type {
  MainToWorkerMessage,
  SerializedStatementEvent,
  WorkerToMainMessage,
} from "./worker-protocol";

/** Yield often enough that an in-thread run never blocks a frame for long. */
export const DEFAULT_YIELD_EVERY = 5_000;
/**
 * Safety net (roughly 15s of work) for hosts where Stop is unavailable or
 * ignored; Stop is the primary way out of a runaway program.
 */
export const DEFAULT_MAX_STEPS = 200_000_000;
/** The console keeps the most recent lines so output floods stay bounded. */
export const DEFAULT_MAX_OUTPUT_LINES = 10_000;

export interface ExecutionOptions {
  source: string;
  settings: Partial<EngineSettings>;
  limits?: InterpreterLimits;
  onAwaitingInputChange?: (awaiting: boolean) => void;
  onAwaitingKeyChange?: (awaiting: boolean) => void;
  onOutput?: (output: string[]) => void;
  /**
   * Debugger hook: receives every statement with a variable snapshot.
   * Enabling it is expensive, so leave it unset for normal runs.
   */
  onStatement?: (event: SerializedStatementEvent) => void;
  /** Force in-thread execution (tests, or hosts without Worker support). */
  inThread?: boolean;
}

export interface ExecutionHandle {
  /** Resolves once the program ends, fails or is stopped. */
  readonly result: Promise<ExecutionResult>;
  readonly mode: "worker" | "in-thread";
  continueKey(): void;
  getOutput(): string[];
  isAwaitingInput(): boolean;
  isAwaitingKey(): boolean;
  submitInput(value: string): void;
  /** Ends the run immediately; `result` resolves with state "stopped". */
  stop(): void;
}

const defaultLimits: InterpreterLimits = {
  yieldEvery: DEFAULT_YIELD_EVERY,
  maxSteps: DEFAULT_MAX_STEPS,
  maxOutputLines: DEFAULT_MAX_OUTPUT_LINES,
};

function resolveLimits(limits: InterpreterLimits = {}): InterpreterLimits {
  return { ...defaultLimits, ...limits };
}

export function startExecution(options: ExecutionOptions): ExecutionHandle {
  const worker = options.inThread ? null : createInterpreterWorker();
  return worker
    ? startWorkerExecution(worker, options)
    : startInThreadExecution(options);
}

function startWorkerExecution(
  worker: Worker,
  options: ExecutionOptions
): ExecutionHandle {
  let output: string[] = [];
  const queuedInput: string[] = [];
  let inputRequestId: number | null = null;
  let keyRequestId: number | null = null;
  let finished = false;
  let settle!: (result: ExecutionResult) => void;

  const result = new Promise<ExecutionResult>((resolve) => {
    settle = resolve;
  });

  const send = (message: MainToWorkerMessage) => {
    worker.postMessage(message);
  };

  const setAwaitingInput = (id: number | null) => {
    const changed = (inputRequestId !== null) !== (id !== null);
    inputRequestId = id;
    if (changed) {
      options.onAwaitingInputChange?.(id !== null);
    }
  };

  const setAwaitingKey = (id: number | null) => {
    const changed = (keyRequestId !== null) !== (id !== null);
    keyRequestId = id;
    if (changed) {
      options.onAwaitingKeyChange?.(id !== null);
    }
  };

  const finish = (outcome: ExecutionResult) => {
    if (finished) {
      return;
    }
    finished = true;
    worker.terminate();
    setAwaitingInput(null);
    setAwaitingKey(null);
    settle(outcome);
  };

  worker.onmessage = (event: MessageEvent<WorkerToMainMessage>) => {
    if (finished) {
      return;
    }
    const message = event.data;

    switch (message.type) {
      case "output":
        output = message.lines;
        options.onOutput?.(output);
        // Acknowledge after the render React scheduled for this update.
        setTimeout(() => {
          if (!finished) {
            send({ type: "outputAck" });
          }
        }, 0);
        return;
      case "read":
        if (queuedInput.length > 0) {
          send({ type: "input", id: message.id, value: queuedInput.shift()! });
          return;
        }
        setAwaitingInput(message.id);
        return;
      case "waitKey":
        setAwaitingKey(message.id);
        return;
      case "statement":
        options.onStatement?.(message.event);
        return;
      case "done":
        finish(message.result);
        return;
      case "crash":
        finish({
          output: [...output],
          diagnostics: [
            {
              message: engineMessage("RUNTIME_INTERNAL", { detail: message.message }),
              line: 1,
              column: 1,
              severity: "error",
              code: "RUNTIME_INTERNAL",
              params: { detail: message.message },
            },
          ],
          state: "runtime_error",
        });
        return;
    }
  };

  worker.onerror = (event) => {
    event.preventDefault();
    finish({
      output: [...output],
      diagnostics: [
        event.message
          ? {
              message: engineMessage("RUNTIME_INTERNAL", { detail: event.message }),
              line: 1,
              column: 1,
              severity: "error",
              code: "RUNTIME_INTERNAL",
              params: { detail: event.message },
            }
          : {
              message: engineMessage("RUNTIME_WORKER_FAILED"),
              line: 1,
              column: 1,
              severity: "error",
              code: "RUNTIME_WORKER_FAILED",
            },
      ],
      state: "runtime_error",
    });
  };

  options.onOutput?.(output);
  send({
    type: "run",
    source: options.source,
    settings: options.settings,
    limits: resolveLimits(options.limits),
    trace: Boolean(options.onStatement),
  });

  return {
    result,
    mode: "worker",
    continueKey() {
      if (keyRequestId === null) {
        return;
      }
      const id = keyRequestId;
      setAwaitingKey(null);
      send({ type: "key", id });
    },
    getOutput() {
      return [...output];
    },
    isAwaitingInput() {
      return inputRequestId !== null;
    },
    isAwaitingKey() {
      return keyRequestId !== null;
    },
    submitInput(value) {
      if (finished) {
        return;
      }
      if (inputRequestId === null) {
        queuedInput.push(value);
        return;
      }
      const id = inputRequestId;
      setAwaitingInput(null);
      send({ type: "input", id, value });
    },
    stop() {
      finish({ output: [...output], diagnostics: [], state: "stopped" });
    },
  };
}

function startInThreadExecution(options: ExecutionOptions): ExecutionHandle {
  let stopRequested = false;
  let stopped!: (result: ExecutionResult) => void;
  const stoppedResult = new Promise<ExecutionResult>((resolve) => {
    stopped = resolve;
  });

  const limits = resolveLimits(options.limits);
  const controller = createBrowserRuntime({
    maxOutputLines: limits.maxOutputLines,
    onAwaitingInputChange: options.onAwaitingInputChange,
    onAwaitingKeyChange: options.onAwaitingKeyChange,
    onOutput: options.onOutput,
  });

  const interpreter = new Interpreter({
    settings: options.settings,
    limits,
    hooks: {
      shouldStop: () => stopRequested,
      onStatement: options.onStatement
        ? (event) => {
            options.onStatement?.({ ...event, variables: event.variables() });
          }
        : undefined,
    },
  });

  // A run blocked on Leer or Esperar Tecla never reaches another step, so
  // stop() also settles the result directly instead of waiting for it.
  const result = Promise.race([
    interpreter.run(options.source, controller.runtime),
    stoppedResult,
  ]);

  return {
    result,
    mode: "in-thread",
    continueKey: () => controller.continueKey(),
    getOutput: () => controller.getOutput(),
    isAwaitingInput: () => controller.isAwaitingInput(),
    isAwaitingKey: () => controller.isAwaitingKey(),
    submitInput: (value) => controller.submitInput(value),
    stop() {
      stopRequested = true;
      stopped({
        output: controller.getOutput(),
        diagnostics: [],
        state: "stopped",
      });
    },
  };
}
