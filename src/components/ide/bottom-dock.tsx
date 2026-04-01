"use client";

import { useEffect, useRef } from "react";

import type { Diagnostic } from "@/src/engine";
import type { Dictionary } from "@/src/i18n/types";

import type { BottomTab } from "./types";
import {
  ActionButton,
  AppIcon,
  SegmentedControl,
  TabButton,
  classes,
} from "./ui";

function DiagnosticsList({
  dictionary,
  diagnostics,
  onSelect,
}: {
  dictionary: Dictionary;
  diagnostics: Diagnostic[];
  onSelect: (diagnostic: Diagnostic) => void;
}) {
  if (diagnostics.length === 0) {
    return (
      <div className="rounded-[16px] border border-dashed border-[var(--line)] px-4 py-5 text-sm text-[var(--muted)]">
        {dictionary.bottomDock.noProblems}
      </div>
    );
  }

  return (
    <ul className="grid gap-2" data-testid="problems-list">
      {diagnostics.map((diagnostic) => (
        <li
          key={`${diagnostic.line}-${diagnostic.column}-${diagnostic.message}`}
        >
          <button
            className={classes(
              "flex w-full items-start gap-3 rounded-[16px] border border-[var(--line)] bg-[rgba(255,252,247,0.88)] px-4 py-3 text-left transition",
              diagnostic.severity === "warning"
                ? "hover:border-[var(--amber-soft)] hover:bg-[var(--amber-surface)]"
                : "hover:border-[var(--accent-soft)] hover:bg-[var(--accent-surface)]"
            )}
            onClick={() => onSelect(diagnostic)}
            type="button"
          >
            <span
              className={classes(
                "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl",
                diagnostic.severity === "warning"
                  ? "bg-[var(--amber-surface)] text-[var(--warning-strong)]"
                  : "bg-[var(--accent-surface)] text-[var(--accent-strong)]"
              )}
            >
              <AppIcon className="h-4 w-4" name="alert" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-[var(--foreground)]">
                {diagnostic.line}:{diagnostic.column} {diagnostic.message}
              </span>
              <span className="mt-1 block text-xs text-[var(--muted)]">
                {dictionary.bottomDock.severities[diagnostic.severity] ??
                  diagnostic.severity}
                {diagnostic.code ? ` · ${diagnostic.code}` : ""}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

interface BottomDockProps {
  awaitingInput: boolean;
  awaitingKey: boolean;
  collapsed: boolean;
  dictionary: Dictionary;
  diagnostics: Diagnostic[];
  inputText: string;
  onBottomTabChange: (tab: BottomTab) => void;
  onContinueKey: () => void;
  onDiagnosticSelect: (diagnostic: Diagnostic) => void;
  onInputChange: (value: string) => void;
  onSubmitInput: () => void;
  onToggleCollapsed: () => void;
  outputText: string;
  tab: BottomTab;
}

export default function BottomDock({
  awaitingInput,
  awaitingKey,
  collapsed,
  dictionary,
  diagnostics,
  inputText,
  onBottomTabChange,
  onContinueKey,
  onDiagnosticSelect,
  onInputChange,
  onSubmitInput,
  onToggleCollapsed,
  outputText,
  tab,
}: BottomDockProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const outputRef = useRef<HTMLDivElement | null>(null);
  const collapseLabel = collapsed
    ? dictionary.bottomDock.expand
    : dictionary.bottomDock.collapse;

  useEffect(() => {
    if (!awaitingInput || tab !== "output") {
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.select();
  }, [awaitingInput, tab]);

  useEffect(() => {
    if (outputRef.current && tab === "output" && !collapsed) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [outputText, tab, collapsed]);

  return (
    <div
      className={classes(
        "flex h-full flex-col overflow-hidden [scrollbar-gutter:stable]",
        collapsed ? "min-h-0" : "min-h-[210px]"
      )}
      data-collapsed={collapsed ? "true" : "false"}
      data-testid="bottom-dock"
    >
      <div
        className={classes(
          "flex items-center justify-between gap-4 px-4 py-3",
          collapsed
            ? ""
            : tab === "output"
            ? "pb-2"
            : "border-b border-[var(--line)]"
        )}
      >
        <SegmentedControl className="rounded-[14px] shadow-none">
          <TabButton
            active={tab === "output"}
            icon="console"
            label={dictionary.bottomDock.output}
            onClick={() => onBottomTabChange("output")}
            tone="output"
          />
          <TabButton
            active={tab === "problems"}
            icon="alert"
            label={dictionary.bottomDock.problems}
            onClick={() => onBottomTabChange("problems")}
            tone="amber"
          />
        </SegmentedControl>

        <div className="flex items-center gap-3">
          {awaitingKey && tab === "output" ? (
            <ActionButton
              icon="play"
              label={dictionary.bottomDock.continueKeyWait}
              onClick={onContinueKey}
              tone="secondary"
            />
          ) : null}
          <button
            aria-label={collapseLabel}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] text-[var(--muted)] transition hover:bg-[rgba(43,36,28,0.05)] hover:text-[var(--foreground)]"
            onClick={onToggleCollapsed}
            title={collapseLabel}
            type="button"
          >
            <AppIcon
              className="h-4 w-4"
              name={collapsed ? "chevron-up" : "chevron-down"}
            />
          </button>
        </div>
      </div>

      <div
        className={classes(
          "min-h-0 flex-1 transition-[max-height,opacity,transform,padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          collapsed
            ? "max-h-0 translate-y-2 px-4 pb-0 pt-0 opacity-0 overflow-hidden"
            : "max-h-[520px] translate-y-0 px-4 pb-4 pt-1 opacity-100 overflow-visible"
        )}
      >
        {tab === "output" ? (
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex h-full min-h-0 flex-col rounded-[18px] border border-[rgba(255,255,255,0.06)] bg-[#111416] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div
                ref={outputRef}
                className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4"
              >
                <pre
                  className="m-0 whitespace-pre-wrap break-words font-[var(--font-geist-mono)] text-sm leading-6 text-[var(--ink-contrast)]"
                  data-testid="output-console"
                >
                  {outputText ? (
                    outputText
                  ) : (
                    <span className="text-[rgba(238,243,236,0.74)]">
                      {dictionary.bottomDock.noOutputYet}
                    </span>
                  )}
                </pre>
              </div>

              {awaitingInput ? (
                <form
                  className="flex items-center gap-3 border-t border-[rgba(255,255,255,0.06)] bg-[#0d1012] px-4 py-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    onSubmitInput();
                  }}
                >
                  <span className="font-[var(--font-geist-mono)] text-sm font-medium text-[var(--accent)]">
                    &gt;
                  </span>
                  <label className="sr-only" htmlFor="program-input">
                    {dictionary.bottomDock.programInput}
                  </label>
                  <input
                    aria-label={dictionary.bottomDock.programInput}
                    className="min-w-0 flex-1 bg-transparent font-[var(--font-geist-mono)] text-sm text-[var(--ink-contrast)] outline-none placeholder:text-[rgba(240,237,231,0.38)]"
                    id="program-input"
                    onChange={(event) => onInputChange(event.target.value)}
                    placeholder={dictionary.bottomDock.inputPlaceholder}
                    ref={inputRef}
                    type="text"
                    value={inputText}
                  />
                  <button
                    className="shrink-0 rounded-[10px] border border-[rgba(255,255,255,0.12)] px-2.5 py-1.5 text-xs font-medium text-[rgba(255,249,240,0.72)] transition hover:border-[rgba(255,255,255,0.22)] hover:text-[var(--ink-contrast)]"
                    type="submit"
                  >
                    {dictionary.bottomDock.submitInput}
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1" data-testid="problems-panel">
            <DiagnosticsList
              dictionary={dictionary}
              diagnostics={diagnostics}
              onSelect={onDiagnosticSelect}
            />
          </div>
        )}
      </div>
    </div>
  );
}
