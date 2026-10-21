/// <reference lib="webworker" />

import { Interpreter } from "./interpreter";
import { createOutputBuffer } from "./runtime";
import type { Runtime } from "./types";
import type {
  MainToWorkerMessage,
  WorkerToMainMessage,
} from "./worker-protocol";

const OUTPUT_FLUSH_INTERVAL_MS = 32;

const scope = self as unknown as DedicatedWorkerGlobalScope;

function post(message: WorkerToMainMessage): void {
  scope.postMessage(message);
}

let consoleBuffer = createOutputBuffer();
let outputDirty = false;
let awaitingAck = false;
let lastFlush = 0;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Sends the console snapshot. Periodic flushes skip while the host has not
 * acknowledged the previous one; `force` is for points where the host must
 * be up to date (before input, waits and the final result).
 */
function flushOutput(force = false): void {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!outputDirty || (awaitingAck && !force)) {
    return;
  }
  outputDirty = false;
  awaitingAck = true;
  lastFlush = Date.now();
  post({ type: "output", lines: consoleBuffer.snapshot() });
}

function outputChanged(): void {
  outputDirty = true;

  if (Date.now() - lastFlush >= OUTPUT_FLUSH_INTERVAL_MS) {
    flushOutput();
  } else if (flushTimer === null) {
    // Fires on the interpreter's next yield if the program keeps running.
    flushTimer = setTimeout(() => flushOutput(), OUTPUT_FLUSH_INTERVAL_MS);
  }
}

// A MessageChannel round trip lets queued messages and timers run without
// setTimeout's 4ms clamp (and background-tab throttling) on every yield.
const yieldChannel =
  typeof MessageChannel === "undefined" ? null : new MessageChannel();
const yieldResolvers: Array<() => void> = [];
if (yieldChannel) {
  yieldChannel.port1.onmessage = () => {
    yieldResolvers.shift()?.();
  };
}

function yieldToHost(): Promise<void> {
  return new Promise((resolve) => {
    if (!yieldChannel) {
      setTimeout(resolve, 0);
      return;
    }
    yieldResolvers.push(resolve);
    yieldChannel.port2.postMessage(null);
  });
}

let nextRequestId = 1;
const pendingInputs = new Map<number, (value: string) => void>();
const pendingKeys = new Map<number, () => void>();

const runtime: Runtime = {
  write(value, newline = true) {
    consoleBuffer.write(value, newline);
    outputChanged();
  },
  clear() {
    consoleBuffer.clear();
    outputChanged();
  },
  read() {
    flushOutput(true);
    const id = nextRequestId++;
    return new Promise<string>((resolve) => {
      pendingInputs.set(id, resolve);
      post({ type: "read", id });
    });
  },
  waitForKey() {
    flushOutput(true);
    const id = nextRequestId++;
    return new Promise<void>((resolve) => {
      pendingKeys.set(id, resolve);
      post({ type: "waitKey", id });
    });
  },
  sleep(ms) {
    // Sleeping here rather than on the main thread keeps Stop instant:
    // terminating the worker cancels the timer with it.
    flushOutput(true);
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  },
};

scope.onmessage = async (event: MessageEvent<MainToWorkerMessage>) => {
  const message = event.data;

  switch (message.type) {
    case "outputAck":
      awaitingAck = false;
      if (outputDirty && flushTimer === null) {
        flushTimer = setTimeout(() => flushOutput(), OUTPUT_FLUSH_INTERVAL_MS);
      }
      return;
    case "input": {
      const resolve = pendingInputs.get(message.id);
      pendingInputs.delete(message.id);
      resolve?.(message.value);
      return;
    }
    case "key": {
      const resolve = pendingKeys.get(message.id);
      pendingKeys.delete(message.id);
      resolve?.();
      return;
    }
    case "run": {
      consoleBuffer = createOutputBuffer(message.limits.maxOutputLines);
      const interpreter = new Interpreter({
        settings: message.settings,
        limits: message.limits,
        hooks: {
          yieldToHost,
          onStatement: message.trace
            ? (statementEvent) => {
                post({
                  type: "statement",
                  event: {
                    ...statementEvent,
                    variables: statementEvent.variables(),
                  },
                });
              }
            : undefined,
        },
      });

      try {
        const result = await interpreter.run(message.source, runtime);
        flushOutput(true);
        post({ type: "done", result });
      } catch (error) {
        flushOutput(true);
        post({
          type: "crash",
          message: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }
  }
};
