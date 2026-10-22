"use client";

// PROTOTYPE — throwaway. Runs the real Interpreter in-thread so the UI
// variants can pause between statements (the worker path can't pause yet).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  defaultEngineSettings,
  Interpreter,
  Parser,
  type Diagnostic,
  type EngineSettings,
  type Runtime,
} from "@/src/engine";
import type { VariableSnapshot } from "@/src/engine/types";

export type RunMode =
  | "idle"
  | "running"
  | "paused"
  | "input"
  | "done"
  | "error"
  | "stopped";

export interface ConsoleLine {
  kind: "out" | "in" | "sys" | "err";
  text: string;
}

export interface TraceRow {
  step: number;
  line: number;
  variables: VariableSnapshot[];
}

class StopSignal extends Error {}

export function usePrototypeRun(source: string, settings: EngineSettings = defaultEngineSettings) {
  const [mode, setMode] = useState<RunMode>("idle");
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const [currentLine, setCurrentLine] = useState<number | null>(null);
  const [variables, setVariables] = useState<VariableSnapshot[]>([]);
  const [trace, setTrace] = useState<TraceRow[]>([]);
  const [runtimeError, setRuntimeError] = useState<Diagnostic | null>(null);

  const stopRef = useRef(false);
  const steppingRef = useRef(false);
  const resumeRef = useRef<(() => void) | null>(null);
  const inputRef = useRef<{ resolve: (v: string) => void; reject: (e: Error) => void } | null>(null);
  const pendingRef = useRef("");
  const modeRef = useRef<RunMode>("idle");

  const updateMode = (next: RunMode) => {
    modeRef.current = next;
    setMode(next);
  };

  const parseDiagnostics = useMemo(() => {
    const result = new Parser(source, { settings }).parse();
    return result.diagnostics;
  }, [source, settings]);

  const flushPending = () => {
    if (pendingRef.current) {
      const text = pendingRef.current;
      pendingRef.current = "";
      setLines((current) => [...current, { kind: "out", text }]);
    }
  };

  const start = useCallback(
    async (stepping: boolean) => {
      if (["running", "paused", "input"].includes(modeRef.current)) return;
      stopRef.current = false;
      steppingRef.current = stepping;
      pendingRef.current = "";
      setLines([]);
      setTrace([]);
      setVariables([]);
      setRuntimeError(null);
      setCurrentLine(null);
      updateMode("running");

      let stepCount = 0;
      const runtime: Runtime = {
        write(value, newline = true) {
          if (newline) {
            const text = pendingRef.current + value;
            pendingRef.current = "";
            setLines((current) => [...current, { kind: "out", text }]);
          } else {
            pendingRef.current += value;
          }
        },
        read() {
          // Keep a "Sin Saltar" prompt on the same visual line as the answer.
          const prompt = pendingRef.current;
          pendingRef.current = "";
          if (prompt) setLines((current) => [...current, { kind: "out", text: prompt }]);
          updateMode("input");
          return new Promise<string>((resolve, reject) => {
            inputRef.current = {
              resolve: (value) => {
                setLines((current) => [...current, { kind: "in", text: value }]);
                updateMode(steppingRef.current ? "paused" : "running");
                resolve(value);
              },
              reject,
            };
          });
        },
        clear() {
          pendingRef.current = "";
          setLines([]);
        },
        sleep(ms) {
          return new Promise((resolve) => setTimeout(resolve, Math.min(ms, 2000)));
        },
        waitForKey() {
          setLines((current) => [...current, { kind: "sys", text: "Presiona Enter para continuar" }]);
          updateMode("input");
          return new Promise<void>((resolve, reject) => {
            inputRef.current = {
              resolve: () => {
                updateMode("running");
                resolve();
              },
              reject,
            };
          });
        },
      };

      const interpreter = new Interpreter({
        settings,
        limits: { yieldEvery: 2000, maxOutputLines: 2000 },
        hooks: {
          shouldStop: () => stopRef.current,
          onStatement: async (event) => {
            stepCount += 1;
            const snapshot = event.variables();
            if (steppingRef.current) {
              flushPending();
              setCurrentLine(event.line);
              setVariables(snapshot);
              setTrace((current) =>
                current.length > 400 ? current : [...current, { step: stepCount, line: event.line, variables: snapshot }]
              );
              updateMode("paused");
              await new Promise<void>((resolve) => {
                resumeRef.current = resolve;
              });
              if (stopRef.current) throw new StopSignal();
              updateMode("running");
            } else if (stepCount % 50 === 0) {
              setVariables(snapshot);
            } else {
              lastSnapshot = snapshot;
            }
          },
        },
      });
      let lastSnapshot: VariableSnapshot[] | null = null;

      try {
        const result = await interpreter.run(source, runtime);
        flushPending();
        if (lastSnapshot) setVariables(lastSnapshot);
        setCurrentLine(null);
        if (result.state === "stopped") {
          setLines((current) => [...current, { kind: "sys", text: "Ejecución detenida" }]);
          updateMode("stopped");
        } else if (result.state === "ok") {
          setLines((current) => [...current, { kind: "sys", text: "Programa finalizado" }]);
          updateMode("done");
        } else {
          const diagnostic = result.diagnostics.find((d) => d.severity === "error") ?? null;
          setRuntimeError(diagnostic);
          if (diagnostic) {
            setLines((current) => [
              ...current,
              { kind: "err", text: `Línea ${diagnostic.line}: ${diagnostic.message}` },
            ]);
          }
          updateMode("error");
        }
      } catch {
        flushPending();
        setCurrentLine(null);
        setLines((current) => [...current, { kind: "sys", text: "Ejecución detenida" }]);
        updateMode("stopped");
      }
    },
    [settings, source]
  );

  const run = useCallback(() => start(false), [start]);
  const debug = useCallback(() => start(true), [start]);

  const step = useCallback(() => {
    if (modeRef.current === "paused") resumeRef.current?.();
  }, []);

  const resume = useCallback(() => {
    steppingRef.current = false;
    setCurrentLine(null);
    resumeRef.current?.();
  }, []);

  const stop = useCallback(() => {
    stopRef.current = true;
    resumeRef.current?.();
    inputRef.current?.reject(new StopSignal());
  }, []);

  const submitInput = useCallback((value: string) => {
    const pending = inputRef.current;
    inputRef.current = null;
    pending?.resolve(value);
  }, []);

  useEffect(() => () => {
    stopRef.current = true;
    resumeRef.current?.();
  }, []);

  const active = mode === "running" || mode === "paused" || mode === "input";

  return {
    mode,
    active,
    lines,
    currentLine,
    variables,
    trace,
    parseDiagnostics,
    runtimeError,
    run,
    debug,
    step,
    resume,
    stop,
    submitInput,
  };
}

export type PrototypeRun = ReturnType<typeof usePrototypeRun>;

export function formatValue(value: VariableSnapshot["value"]): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "VERDADERO" : "FALSO";
  if (typeof value === "string") return `"${value}"`;
  if (Array.isArray(value)) return `[${value.map(formatValue).join(", ")}]`;
  return String(value);
}

export const SAMPLE_PROGRAM = `Algoritmo Promedio
	Definir n, i Como Entero
	Definir nota, suma Como Real
	Escribir "¿Cuántas notas vas a ingresar?"
	Leer n
	suma <- 0
	Para i <- 1 Hasta n Hacer
		Escribir "Nota ", i, ":"
		Leer nota
		suma <- suma + nota
	FinPara
	Si n > 0 Entonces
		Escribir "Promedio: ", suma / n
		Si suma / n >= 6 Entonces
			Escribir "¡Aprobado!"
		SiNo
			Escribir "A estudiar un poco más"
		FinSi
	FinSi
FinAlgoritmo
`;
