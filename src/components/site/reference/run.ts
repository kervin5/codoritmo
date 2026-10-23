// Runs a small program at build time and keeps the console transcript, so a
// page can show the real output next to the code. Deterministic: Azar uses a
// seeded generator, and pauses (Esperar, Esperar Tecla) return immediately.

import type { SampleRun, TranscriptLine } from "@/src/components/examples-site/content";
import { Interpreter, type EngineSettings, type Runtime } from "@/src/engine";

function seededRandom(seedText: string) {
  let state = 0;
  for (const ch of seedText) state = (Math.imul(state, 31) + ch.charCodeAt(0)) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MAX_LINES = 60;
const cache = new Map<string, Promise<SampleRun & { failed: boolean }>>();

export function runProgram(
  source: string,
  options: { input?: string; seed: string; settings: EngineSettings },
): Promise<SampleRun & { failed: boolean }> {
  const key = `${options.seed}\u0000${options.input ?? ""}\u0000${source}`;
  let run = cache.get(key);
  if (!run) {
    run = runUncached(source, options);
    cache.set(key, run);
  }
  return run;
}

async function runUncached(source: string, options: { input?: string; seed: string; settings: EngineSettings }) {
  const queue = options.input?.split("\n") ?? [];
  const lines: TranscriptLine[] = [];
  let pending = "";
  const flush = () => {
    if (pending) lines.push({ kind: "out", text: pending });
    pending = "";
  };
  const runtime: Runtime = {
    write(value, newline = true) {
      pending += value;
      if (newline) {
        lines.push({ kind: "out", text: pending });
        pending = "";
      }
    },
    read() {
      flush();
      const value = queue.shift() ?? "";
      lines.push({ kind: "in", text: value });
      return value;
    },
    clear() {},
    async sleep() {},
    async waitForKey() {},
  };
  const interpreter = new Interpreter({
    settings: options.settings,
    limits: { maxSteps: 200_000, yieldEvery: 50_000, maxOutputLines: 200 },
    random: seededRandom(options.seed),
  });
  const result = await interpreter.run(source, runtime);
  flush();
  const error = result.diagnostics.find((d) => d.severity === "error");
  if (error) lines.push({ kind: "err", text: error.message });
  return { lines: lines.slice(0, MAX_LINES), truncated: lines.length > MAX_LINES, failed: Boolean(error) };
}
