import fs from "node:fs";
import path from "node:path";
import { Worker } from "node:worker_threads";

export interface UpstreamCase {
  name: string;
  source: string;
  args: string;
  fileInput: string[];
  expected: ExpectedOutcome;
}

export interface ExpectedOutcome {
  state: "ok" | "parse_error" | "runtime_error";
  line?: number;
  output: string[];
}

export interface CaseResult {
  state: string;
  output: string[];
  diagnostics: Array<{ message: string; line: number }>;
  unsupported: string[];
}

const markerPattern = /^=== Line (\d+): (SynError|ExeError|Warning) (\d+)/;

// Turns an upstream .out file into the outcome we compare against:
// "> " lines echo input and warnings don't stop execution, so both are dropped;
// the first SynError/ExeError decides the expected state and line.
export function parseExpectedOutput(text: string): ExpectedOutcome {
  const output: string[] = [];
  for (const rawLine of text.replace(/\r\n/g, "\n").split("\n")) {
    // An error raised while waiting for input is printed after the prompt.
    const line = rawLine.startsWith("> ===") ? rawLine.slice(2) : rawLine;
    if (line.startsWith("> ") || line === ">") {
      continue;
    }
    const marker = markerPattern.exec(line);
    if (marker) {
      if (marker[2] === "Warning") {
        continue;
      }
      return {
        state: marker[2] === "SynError" ? "parse_error" : "runtime_error",
        line: Number(marker[1]),
        output: marker[2] === "SynError" ? [] : trimTrailingEmpty(output),
      };
    }
    output.push(line);
  }
  return { state: "ok", output: trimTrailingEmpty(output) };
}

function trimTrailingEmpty(lines: string[]): string[] {
  const copy = [...lines];
  while (copy.length > 0 && copy[copy.length - 1]!.trim() === "") {
    copy.pop();
  }
  return copy;
}

export function loadUpstreamCases(directory: string): UpstreamCase[] {
  const read = (file: string) => {
    const absolute = path.join(directory, file);
    return fs.existsSync(absolute) ? fs.readFileSync(absolute, "utf8") : null;
  };

  return fs
    .readdirSync(directory)
    .filter((file) => file.endsWith(".psc"))
    .sort()
    .map((file) => {
      const name = file.slice(0, -4);
      const fileInput = read(`${name}.in`);
      return {
        name,
        source: read(file)!,
        args: (read(`${name}.arg`) ?? "").trim(),
        fileInput: fileInput ? fileInput.replace(/\n$/, "").split("\n") : [],
        expected: parseExpectedOutput(read(`${name}.out`) ?? ""),
      };
    });
}

// Returns null when the result matches, otherwise a short reason.
export function compareOutcome(expected: ExpectedOutcome, result: CaseResult): string | null {
  if (result.state !== expected.state) {
    const detail = result.diagnostics[0]
      ? ` (line ${result.diagnostics[0].line}: ${result.diagnostics[0].message.split("\n")[0]})`
      : "";
    return `expected ${expected.state}${expected.line ? `@${expected.line}` : ""}, got ${result.state}${detail}`;
  }
  if (expected.line !== undefined && result.diagnostics[0]?.line !== expected.line) {
    return `expected ${expected.state} on line ${expected.line}, got line ${result.diagnostics[0]?.line}: ${result.diagnostics[0]?.message}`;
  }
  const actual = trimTrailingEmpty(result.output.join("\n").split("\n"));
  const wanted = expected.output;
  if (actual.join("\n") !== wanted.join("\n")) {
    return `output differs:\n  expected: ${JSON.stringify(wanted)}\n  actual:   ${JSON.stringify(actual)}`;
  }
  return null;
}

// Runs every case in a worker thread, one at a time. A case that exceeds the
// timeout kills the worker and is reported as "timeout"; a fresh worker picks
// up the remaining cases.
export async function runCasesInWorker(
  cases: UpstreamCase[],
  engineDirectory: string,
  timeoutMs: number
): Promise<Map<string, CaseResult>> {
  const results = new Map<string, CaseResult>();
  const workerPath = path.join(__dirname, "upstream-worker.js");
  let worker: Worker | null = null;

  const startWorker = () => new Worker(workerPath, { workerData: { engineDirectory } });

  try {
    for (const testCase of cases) {
      worker ??= startWorker();
      const current: Worker = worker;
      const result = await new Promise<CaseResult>((resolve) => {
        const timer = setTimeout(() => {
          cleanup();
          void current.terminate();
          worker = null;
          resolve({ state: "timeout", output: [], diagnostics: [], unsupported: [] });
        }, timeoutMs);
        const onMessage = (message: { name: string; result: CaseResult }) => {
          cleanup();
          resolve(message.result);
        };
        const onError = (error: Error) => {
          cleanup();
          worker = null;
          resolve({ state: "crash", output: [], diagnostics: [{ message: String(error), line: 0 }], unsupported: [] });
        };
        const cleanup = () => {
          clearTimeout(timer);
          current.off("message", onMessage);
          current.off("error", onError);
        };
        current.on("message", onMessage);
        current.on("error", onError);
        current.postMessage(testCase);
      });
      results.set(testCase.name, result);
    }
  } finally {
    await (worker as Worker | null)?.terminate();
  }

  return results;
}
