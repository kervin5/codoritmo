/**
 * Kept in its own module so tests can swap the worker for a fake. Returns
 * null where Worker is missing (SSR, jsdom); callers then run in-thread.
 */
export function createInterpreterWorker(): Worker | null {
  if (typeof Worker === "undefined") {
    return null;
  }

  return new Worker(new URL("./interpreter.worker.ts", import.meta.url), {
    type: "module",
  });
}
