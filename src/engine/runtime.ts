import {
  BrowserRuntimeController,
  BrowserRuntimeOptions,
  Runtime,
} from "./types";

class OutputBuffer {
  private readonly lines: string[] = [];
  private pending = "";

  /** With maxLines set, the oldest lines are dropped once the cap is hit. */
  constructor(private readonly maxLines?: number) {}

  write(value: string, newline = true): void {
    this.pending += value;
    if (newline) {
      this.lines.push(this.pending);
      this.pending = "";
      if (this.maxLines !== undefined && this.lines.length > this.maxLines) {
        this.lines.splice(0, this.lines.length - this.maxLines);
      }
    }
  }

  clear(): void {
    this.lines.length = 0;
    this.pending = "";
  }

  snapshot(): string[] {
    return this.pending.length > 0
      ? [...this.lines, this.pending]
      : [...this.lines];
  }
}

export function createOutputBuffer(maxLines?: number): OutputBuffer {
  return new OutputBuffer(maxLines);
}

export function parseInputText(input: string): string[] {
  if (!input.trim()) {
    return [];
  }

  return input.replace(/\r\n/g, "\n").split("\n");
}

export function formatRuntimeValue(value: unknown): string {
  if (typeof value === "boolean") {
    return value ? "VERDADERO" : "FALSO";
  }

  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "number") {
    return formatNumber(value);
  }

  return String(value);
}

// PSeInt shows numbers rounded to 10 decimals (0.1+0.2 prints 0.3, 1/3
// prints 0.3333333333) and never in exponent notation.
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return String(value);
  }
  if (Number.isInteger(value) && Math.abs(value) < 1e21) {
    return BigInt(value).toString();
  }
  if (Math.abs(value) >= 1e21) {
    return BigInt(Math.round(value)).toString();
  }
  let text = value.toFixed(10);
  if (text.includes(".")) {
    text = text.replace(/0+$/, "").replace(/\.$/, "");
  }
  return text === "-0" ? "0" : text;
}

export function createBrowserRuntime(
  options: BrowserRuntimeOptions = {}
): BrowserRuntimeController {
  const buffer = createOutputBuffer(options.maxOutputLines);
  let queue = [...(options.input ?? [])];
  let awaitingInput = false;
  let resolveInput: ((value: string) => void) | null = null;
  let awaitingKey = false;
  let resolveKey: (() => void) | null = null;

  const emit = () => {
    options.onOutput?.(buffer.snapshot());
  };

  const emitAwaiting = () => {
    options.onAwaitingKeyChange?.(awaitingKey);
  };

  const emitAwaitingInput = () => {
    options.onAwaitingInputChange?.(awaitingInput);
  };

  const runtime: Runtime = {
    async write(value: string, newline = true) {
      buffer.write(value, newline);
      emit();
    },
    async read() {
      if (queue.length > 0) {
        return queue.shift() ?? "";
      }

      awaitingInput = true;
      emitAwaitingInput();

      return await new Promise<string>((resolve) => {
        resolveInput = (value) => {
          awaitingInput = false;
          resolveInput = null;
          emitAwaitingInput();
          resolve(value);
        };
      });
    },
    async clear() {
      buffer.clear();
      emit();
    },
    async sleep(ms: number) {
      await new Promise((resolve) => {
        setTimeout(resolve, ms);
      });
    },
    async waitForKey() {
      awaitingKey = true;
      emitAwaiting();
      await new Promise<void>((resolve) => {
        resolveKey = () => {
          awaitingKey = false;
          emitAwaiting();
          resolve();
        };
      });
    },
  };

  emit();

  return {
    runtime,
    continueKey() {
      resolveKey?.();
      resolveKey = null;
    },
    getOutput() {
      return buffer.snapshot();
    },
    isAwaitingInput() {
      return awaitingInput;
    },
    isAwaitingKey() {
      return awaitingKey;
    },
    reset(input = []) {
      queue = [...input];
      buffer.clear();
      awaitingInput = false;
      resolveInput = null;
      awaitingKey = false;
      resolveKey = null;
      emit();
      emitAwaitingInput();
      emitAwaiting();
    },
    submitInput(value: string) {
      if (resolveInput) {
        resolveInput(value);
        return;
      }

      queue.push(value);
    },
  };
}
