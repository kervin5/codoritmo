// Empirical complexity: run a program at growing input sizes, count the work
// the interpreter actually does, and fit it to the usual complexity classes.
//
// Convention: every Leer is answered with the size n (programs read n first
// and build their data from it). Random numbers come from a fixed seed so a
// measurement is repeatable.

import { Interpreter } from "./interpreter";
import type { EngineSettings, ExecutionMetrics, Runtime } from "./types";

export type ComplexityClass = "O(1)" | "O(log n)" | "O(n)" | "O(n log n)" | "O(n²)" | "O(n³)" | "O(2ⁿ)";

export interface ComplexitySample {
  n: number;
  metrics: ExecutionMetrics;
}

export interface ComplexityFit {
  /** Best-matching class, or null when the data can't tell. */
  best: ComplexityClass | null;
  /** How well the best class explains the data, 0..1. */
  confidence: number;
}

export interface ComplexityReport {
  samples: ComplexitySample[];
  time: ComplexityFit;
  space: ComplexityFit;
  /** Why measuring stopped early or could not start. */
  issue?: "no-input" | "error" | "too-slow";
  errorMessage?: string;
}

export const DEFAULT_SIZES = [4, 8, 16, 32, 64, 128, 256, 512];

const log2 = (n: number) => Math.log2(Math.max(n, 2));

export const GROWTH: Record<ComplexityClass, (n: number) => number> = {
  "O(1)": () => 1,
  "O(log n)": (n) => log2(n),
  "O(n)": (n) => n,
  "O(n log n)": (n) => n * log2(n),
  "O(n²)": (n) => n * n,
  "O(n³)": (n) => n * n * n,
  "O(2ⁿ)": (n) => Math.pow(2, Math.min(n, 60)),
};

const CLASSES = Object.keys(GROWTH) as ComplexityClass[];

/** Time is measured in executed statements; space in array cells plus call depth. */
export const timeOf = (m: ExecutionMetrics) => m.steps;
export const spaceOf = (m: ExecutionMetrics) => m.peakArrayCells + m.peakCallDepth;

/**
 * Least-squares fit of y ≈ a·f(n) + b (a ≥ 0) for each class; the score is
 * the relative error, which treats small and large n fairly. Simpler classes
 * win ties, since students should see the most honest, least dramatic answer.
 */
export function fitComplexity(points: { n: number; y: number }[]): ComplexityFit {
  const usable = points.filter((p) => p.n > 0 && Number.isFinite(p.y));
  if (usable.length < 3) return { best: null, confidence: 0 };

  const ys = usable.map((p) => p.y);
  const spread = Math.max(...ys) - Math.min(...ys);
  if (spread <= Math.max(2, 0.05 * Math.max(...ys))) return { best: "O(1)", confidence: 1 };

  const scores = CLASSES.filter((c) => c !== "O(1)").map((cls) => {
    const xs = usable.map((p) => GROWTH[cls](p.n));
    const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
    const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
    let num = 0;
    let den = 0;
    xs.forEach((x, i) => {
      num += (x - meanX) * (ys[i] - meanY);
      den += (x - meanX) ** 2;
    });
    const a = den > 0 ? Math.max(0, num / den) : 0;
    const b = meanY - a * meanX;
    const error =
      xs.reduce((sum, x, i) => {
        const predicted = a * x + b;
        return sum + ((predicted - ys[i]) / Math.max(1, ys[i])) ** 2;
      }, 0) / xs.length;
    return { cls, error: Math.sqrt(error) };
  });

  scores.sort((p, q) => p.error - q.error);
  // Prefer the simpler of two near-equal fits (CLASSES is ordered by growth).
  let best = scores[0];
  for (const candidate of scores) {
    if (candidate.error <= best.error * 1.15 + 0.01 && CLASSES.indexOf(candidate.cls) < CLASSES.indexOf(best.cls)) {
      best = candidate;
    }
  }
  return { best: best.cls, confidence: Math.max(0, Math.min(1, 1 - best.error * 4)) };
}

/** Deterministic random numbers (mulberry32) so measurements repeat exactly. */
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function measureComplexity(options: {
  source: string;
  settings?: Partial<EngineSettings>;
  sizes?: number[];
  /** Stop growing n once one run takes more statements than this. */
  maxStepsPerRun?: number;
  onSample?: (sample: ComplexitySample) => void;
  shouldStop?: () => boolean;
}): Promise<ComplexityReport> {
  const sizes = options.sizes ?? DEFAULT_SIZES;
  const maxSteps = options.maxStepsPerRun ?? 3_000_000;
  const samples: ComplexitySample[] = [];
  let issue: ComplexityReport["issue"];
  let errorMessage: string | undefined;

  for (const n of sizes) {
    if (options.shouldStop?.()) break;
    let reads = 0;
    const runtime: Runtime = {
      write() {},
      read() {
        reads += 1;
        return String(n);
      },
      clear() {},
      async sleep() {},
      async waitForKey() {},
    };
    const interpreter = new Interpreter({
      settings: options.settings,
      random: seeded(1234 + n),
      limits: { maxSteps, yieldEvery: 20_000, maxOutputLines: 50 },
      hooks: { shouldStop: options.shouldStop },
    });
    const result = await interpreter.run(options.source, runtime);
    if (result.state === "stopped") break;
    if (result.state !== "ok" || !result.metrics) {
      const diagnostic = result.diagnostics.find((d) => d.severity === "error");
      if (diagnostic?.code === "RUNTIME_STEP_LIMIT") issue = "too-slow";
      else {
        issue = "error";
        errorMessage = diagnostic?.message;
      }
      break;
    }
    if (reads === 0) {
      issue = "no-input";
      break;
    }
    const sample = { n, metrics: result.metrics };
    samples.push(sample);
    options.onSample?.(sample);
    if (result.metrics.steps > maxSteps / 4) {
      // The next size would likely blow the budget; enough data to fit.
      if (samples.length >= 4) break;
    }
  }

  return {
    samples,
    time: fitComplexity(samples.map((s) => ({ n: s.n, y: timeOf(s.metrics) }))),
    space: fitComplexity(samples.map((s) => ({ n: s.n, y: spaceOf(s.metrics) }))),
    issue: samples.length < 3 && !issue ? "too-slow" : issue,
    errorMessage,
  };
}
