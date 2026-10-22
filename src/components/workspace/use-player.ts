"use client";

// Execution as playback. Runs the Interpreter in-thread (it yields every few
// thousand steps, so the page stays responsive and Stop always works) and
// records every statement — line, variables, console length — so the UI can
// play, pause, step, and scrub back through what already happened.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Interpreter, Parser, type Diagnostic, type EngineSettings, type Runtime } from "@/src/engine";
import type { ExecutionMetrics, VariableSnapshot } from "@/src/engine/types";

export type PlayerStatus = "idle" | "playing" | "paused" | "input" | "done" | "error" | "stopped";

export interface PlayerLine {
  kind: "out" | "in" | "sys" | "err";
  text: string;
  /** On "err" lines, so the console can show it in the current language. */
  diagnostic?: Diagnostic;
}

export interface Frame {
  line: number;
  variables: VariableSnapshot[];
  /** How many console lines existed when this statement was about to run. */
  consoleLength: number;
  routine: string | null;
  /** Work counters when this statement was about to run. */
  metrics: ExecutionMetrics;
}

/** ms between steps; 0 = instant (a normal run). */
export const SPEEDS = [
  { id: "slow", ms: 900 },
  { id: "normal", ms: 380 },
  { id: "fast", ms: 90 },
  { id: "instant", ms: 0 },
] as const;

export type SpeedId = (typeof SPEEDS)[number]["id"];

export interface PlayerText {
  endOfProgram: string;
  stopped: string;
  pressEnter: string;
  /** "Línea {n}" style prefix for runtime errors. */
  line: string;
}

const MAX_FRAMES = 20_000;

class Stopped extends Error {}

export function usePlayer(source: string, settings: EngineSettings, text: PlayerText) {
  const textRef = useRef(text);
  textRef.current = text;
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [lines, setLines] = useState<PlayerLine[]>([]);
  const [frameCount, setFrameCount] = useState(0);
  /** null = follow the live head; a number = scrubbed to that frame. */
  const [cursor, setCursorState] = useState<number | null>(null);
  const [speedIndex, setSpeedIndex] = useState(1);
  /** The user's intent (play vs pause), independent of input waits. */
  const [wantPlay, setWantPlayState] = useState(false);
  const [runtimeError, setRuntimeError] = useState<Diagnostic | null>(null);

  const framesRef = useRef<Frame[]>([]);
  const linesRef = useRef<PlayerLine[]>([]);
  const pendingRef = useRef("");
  const statusRef = useRef<PlayerStatus>("idle");
  const playingRef = useRef(false);
  const stepTokensRef = useRef(0);
  const stopRef = useRef(false);
  const wakeRef = useRef<(() => void) | null>(null);
  const inputRef = useRef<{ resolve: (v: string) => void; reject: (e: Error) => void } | null>(null);
  const cursorRef = useRef<number | null>(null);
  const speedRef = useRef<number>(SPEEDS[1].ms);
  const flushScheduled = useRef(false);

  speedRef.current = SPEEDS[speedIndex].ms;
  // Update the ref immediately so rapid clicks don't read a stale cursor.
  const setWantPlay = useCallback((value: boolean) => {
    playingRef.current = value;
    setWantPlayState(value);
  }, []);
  const setCursor = useCallback((value: number | null) => {
    cursorRef.current = value;
    setCursorState(value);
  }, []);

  const parseDiagnostics = useMemo(() => new Parser(source, { settings }).parse().diagnostics, [source, settings]);

  const setStatusBoth = (next: PlayerStatus) => {
    statusRef.current = next;
    setStatus(next);
  };

  const wake = () => {
    const resolve = wakeRef.current;
    wakeRef.current = null;
    resolve?.();
  };

  // Batch UI updates: the interpreter can produce thousands of frames a second.
  const scheduleFlush = useCallback(() => {
    if (flushScheduled.current) return;
    flushScheduled.current = true;
    requestAnimationFrame(() => {
      flushScheduled.current = false;
      setLines([...linesRef.current]);
      setFrameCount(framesRef.current.length);
    });
  }, []);

  const pushLine = useCallback(
    (line: PlayerLine) => {
      linesRef.current.push(line);
      scheduleFlush();
    },
    [scheduleFlush]
  );

  const flushPending = useCallback(() => {
    if (pendingRef.current) {
      pushLine({ kind: "out", text: pendingRef.current });
      pendingRef.current = "";
    }
  }, [pushLine]);

  const start = useCallback(
    async (mode: "play" | "step") => {
      stopRef.current = false;
      framesRef.current = [];
      linesRef.current = [];
      pendingRef.current = "";
      setLines([]);
      setFrameCount(0);
      setCursor(null);
      setRuntimeError(null);
      setWantPlay(mode === "play");
      stepTokensRef.current = 0;
      setStatusBoth(mode === "play" ? "playing" : "paused");

      const runtime: Runtime = {
        write(value, newline = true) {
          if (newline) {
            pushLine({ kind: "out", text: pendingRef.current + value });
            pendingRef.current = "";
          } else {
            pendingRef.current += value;
          }
        },
        read() {
          flushPending();
          const resumeStatus: PlayerStatus = playingRef.current ? "playing" : "paused";
          setStatusBoth("input");
          return new Promise<string>((resolve, reject) => {
            inputRef.current = {
              resolve: (value) => {
                pushLine({ kind: "in", text: value });
                setStatusBoth(resumeStatus);
                resolve(value);
              },
              reject,
            };
          });
        },
        clear() {
          pendingRef.current = "";
          linesRef.current = [];
          scheduleFlush();
        },
        sleep(ms) {
          return new Promise((resolve) => setTimeout(resolve, Math.min(ms, 1500)));
        },
        waitForKey() {
          flushPending();
          pushLine({ kind: "sys", text: textRef.current.pressEnter });
          const resumeStatus: PlayerStatus = playingRef.current ? "playing" : "paused";
          setStatusBoth("input");
          return new Promise<void>((resolve, reject) => {
            inputRef.current = {
              resolve: () => {
                setStatusBoth(resumeStatus);
                resolve();
              },
              reject,
            };
          });
        },
      };

      const gate = async () => {
        for (;;) {
          if (stopRef.current) throw new Stopped();
          if (stepTokensRef.current > 0) {
            stepTokensRef.current -= 1;
            return;
          }
          const following = cursorRef.current === null;
          if (playingRef.current && following) {
            const ms = speedRef.current;
            if (ms === 0) return;
            await new Promise((resolve) => setTimeout(resolve, ms));
            if (stopRef.current) throw new Stopped();
            if (playingRef.current && cursorRef.current === null) return;
            continue;
          }
          if (statusRef.current === "playing") setStatusBoth("paused");
          await new Promise<void>((resolve) => {
            wakeRef.current = resolve;
          });
        }
      };

      const interpreter = new Interpreter({
        settings,
        limits: { yieldEvery: 1500, maxOutputLines: 5000 },
        hooks: {
          shouldStop: () => stopRef.current,
          onStatement: async (event) => {
            flushPending();
            const instant = playingRef.current && speedRef.current === 0 && cursorRef.current === null;
            if (framesRef.current.length < MAX_FRAMES) {
              framesRef.current.push({
                line: event.line,
                variables: instant && framesRef.current.length % 25 !== 0 ? [] : event.variables(),
                consoleLength: linesRef.current.length,
                routine: event.routine,
                metrics: event.metrics,
              });
            }
            scheduleFlush();
            if (!instant && statusRef.current !== "playing" && statusRef.current !== "input") setStatusBoth("paused");
            await gate();
            if (statusRef.current === "paused" && playingRef.current) setStatusBoth("playing");
          },
        },
      });

      try {
        const result = await interpreter.run(source, runtime);
        flushPending();
        if (result.state === "ok") {
          pushLine({ kind: "sys", text: textRef.current.endOfProgram });
          setStatusBoth("done");
        } else if (result.state === "stopped") {
          pushLine({ kind: "sys", text: textRef.current.stopped });
          setStatusBoth("stopped");
        } else {
          const diagnostic = result.diagnostics.find((d) => d.severity === "error") ?? null;
          setRuntimeError(diagnostic);
          if (diagnostic) {
            const prefix = textRef.current.line.replace("{n}", String(diagnostic.line));
            pushLine({ kind: "err", text: `${prefix[0].toUpperCase()}${prefix.slice(1)}: ${diagnostic.message}`, diagnostic });
          }
          setStatusBoth("error");
        }
      } catch {
        flushPending();
        pushLine({ kind: "sys", text: textRef.current.stopped });
        setStatusBoth("stopped");
      }
      setWantPlay(false);
      // Instant runs only snapshot every 25th frame; fill variables for the last one.
      scheduleFlush();
    },
    [flushPending, pushLine, scheduleFlush, setCursor, setWantPlay, settings, source]
  );

  const live = status === "playing" || status === "paused" || status === "input";

  const play = useCallback(() => {
    if (!live) {
      void start("play");
      return;
    }
    setWantPlay(true);
    if (statusRef.current === "paused") setStatusBoth("playing");
    wake();
  }, [live, setWantPlay, start]);

  const pause = useCallback(() => {
    setWantPlay(false);
    if (statusRef.current === "playing") setStatusBoth("paused");
  }, [setWantPlay]);

  const stepForward = useCallback(() => {
    setWantPlay(false);
    const c = cursorRef.current;
    if (c !== null) {
      const next = c + 1;
      setCursor(next >= framesRef.current.length - 1 ? null : next);
      return;
    }
    if (!live) {
      void start("step");
      return;
    }
    stepTokensRef.current += 1;
    wake();
  }, [live, setCursor, setWantPlay, start]);

  const stepBack = useCallback(() => {
    setWantPlay(false);
    if (statusRef.current === "playing") setStatusBoth("paused");
    const total = framesRef.current.length;
    if (total === 0) return;
    const c = cursorRef.current ?? total - 1;
    setCursor(Math.max(0, c - 1));
  }, [setCursor, setWantPlay]);

  const seek = useCallback((index: number) => {
    setWantPlay(false);
    if (statusRef.current === "playing") setStatusBoth("paused");
    const total = framesRef.current.length;
    setCursor(index >= total - 1 ? null : Math.max(0, index));
  }, [setCursor, setWantPlay]);

  const stop = useCallback(() => {
    stopRef.current = true;
    setWantPlay(false);
    wake();
    const pending = inputRef.current;
    inputRef.current = null;
    pending?.reject(new Stopped());
  }, [setWantPlay]);

  const submitInput = useCallback((value: string) => {
    const pending = inputRef.current;
    inputRef.current = null;
    pending?.resolve(value);
  }, []);

  // While playing a scrubbed-back position, replay recorded frames, then rejoin live.
  useEffect(() => {
    if (cursor === null || !wantPlay) return;
    const ms = Math.max(SPEEDS[speedIndex].ms, 30);
    const timer = setTimeout(() => {
      const next = cursor + 1;
      if (next >= framesRef.current.length - 1) {
        setCursor(null);
        wake();
      } else setCursor(next);
    }, ms);
    return () => clearTimeout(timer);
  }, [cursor, setCursor, speedIndex, wantPlay]);

  useEffect(
    () => () => {
      stopRef.current = true;
      wake();
    },
    []
  );

  const frames = framesRef.current;
  const viewIndex = cursor ?? frames.length - 1;
  const frame: Frame | null = viewIndex >= 0 ? frames[viewIndex] ?? null : null;
  const previous = viewIndex > 0 ? frames[viewIndex - 1] : null;
  const consoleLines = cursor === null ? lines : lines.slice(0, frame?.consoleLength ?? lines.length);

  // The last frame of an instant run may have no snapshot; find the nearest one.
  let variables = frame?.variables ?? [];
  if (variables.length === 0 && frame) {
    for (let i = viewIndex; i >= 0; i -= 1) {
      if (frames[i].variables.length) {
        variables = frames[i].variables;
        break;
      }
    }
  }

  const changed = new Set<string>();
  if (previous && frame && previous.variables.length && frame.variables.length) {
    for (const v of frame.variables) {
      const before = previous.variables.find((p) => p.name === v.name);
      if (!before || JSON.stringify(before.value) !== JSON.stringify(v.value)) changed.add(v.name);
    }
  }

  return {
    status,
    wantPlay,
    live,
    scrubbing: cursor !== null,
    frameCount,
    viewIndex,
    frame,
    previous,
    frames,
    variables,
    changed,
    consoleLines,
    parseDiagnostics,
    runtimeError,
    speedIndex,
    setSpeedIndex,
    play,
    pause,
    stepForward,
    stepBack,
    seek,
    stop,
    submitInput,
  };
}

export type Player = ReturnType<typeof usePlayer>;
