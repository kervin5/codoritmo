import type { InterpreterLimits } from "./interpreter";
import type {
  EngineSettings,
  ExecutionResult,
  ExecutionStatementEvent,
  VariableSnapshot,
} from "./types";

/**
 * Message protocol between the main thread and interpreter.worker.ts.
 *
 * The worker owns the Interpreter and a capped copy of the console; it sends
 * the console as a snapshot. Periodic snapshots wait for the host's
 * "outputAck", so a tight `Escribir` loop cannot queue messages faster than
 * the main thread can render them. Snapshots before Leer, Esperar and the end
 * of the run are sent regardless, so the host always sees them in order.
 */

/** Statement event with its variable snapshot already materialized. */
export type SerializedStatementEvent = Omit<
  ExecutionStatementEvent,
  "variables"
> & { variables: VariableSnapshot[] };

export type MainToWorkerMessage =
  | {
      type: "run";
      source: string;
      settings: Partial<EngineSettings>;
      limits: InterpreterLimits;
      /** Forward statement events (with variable snapshots) to the host. */
      trace: boolean;
    }
  | { type: "outputAck" }
  | { type: "input"; id: number; value: string }
  | { type: "key"; id: number };

export type WorkerToMainMessage =
  | { type: "output"; lines: string[] }
  | { type: "read"; id: number }
  | { type: "waitKey"; id: number }
  | { type: "statement"; event: SerializedStatementEvent }
  | { type: "done"; result: ExecutionResult }
  | { type: "crash"; message: string };
