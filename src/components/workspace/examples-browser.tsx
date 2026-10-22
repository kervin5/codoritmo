"use client";

// The example library browser: topics and concept filters on the left, the
// matching examples in the middle, and a live preview (code, flowchart, or a
// run with the sample input) on the right. Keyboard-first: type to search,
// ↑/↓ to move, Enter to open, Esc to close. On narrow screens it becomes a
// full-screen list with the preview sliding over it.

import { ArrowLeft, CornerDownLeft, RotateCcw, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  exampleConcepts,
  examplePrograms,
  exampleTopics,
  Interpreter,
  normalizeEngineSettings,
  type ExampleProgram,
  type Runtime,
} from "@/src/engine";
import { formatMessage, formatPlural } from "@/src/i18n/format";
import type { Dictionary } from "@/src/i18n/types";
import CodeEditor from "./code-editor";
import FlowDiagram from "./flow-diagram";

type Topic = (typeof exampleTopics)[number];
type PreviewTab = "code" | "diagram" | "output";

interface PreviewLine {
  kind: "out" | "in" | "err";
  text: string;
}

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const LEVEL_DOTS: Record<number, string> = { 1: "●○○", 2: "●●○", 3: "●●●" };

/** Runs an example with its sample input and returns the transcript. */
async function runPreview(example: ExampleProgram, signal: { cancelled: boolean }): Promise<PreviewLine[]> {
  const queue = example.input?.split("\n") ?? [];
  const lines: PreviewLine[] = [];
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
    clear() {
      pending = "";
      lines.length = 0;
    },
    // The preview shows the result, not the waiting.
    async sleep() {},
    async waitForKey() {},
  };
  const interpreter = new Interpreter({
    settings: normalizeEngineSettings(example.settings),
    limits: { maxSteps: 2_000_000, yieldEvery: 5_000, maxOutputLines: 400 },
    hooks: { shouldStop: () => signal.cancelled },
  });
  const result = await interpreter.run(example.source, runtime);
  flush();
  const error = result.diagnostics.find((d) => d.severity === "error");
  if (error) lines.push({ kind: "err", text: error.message });
  return lines;
}

export function ExamplesBrowser({
  dictionary,
  onOpen,
  onClose,
}: {
  dictionary: Dictionary;
  onOpen: (example: ExampleProgram) => void;
  onClose: () => void;
}) {
  const t = dictionary.studio.examples;
  const copyOf = (example: ExampleProgram) => dictionary.examples[example.id];
  const titleOf = (example: ExampleProgram) => copyOf(example)?.label ?? example.label;

  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<Topic | null>(null);
  const [level, setLevel] = useState<1 | 2 | 3 | null>(null);
  const [concepts, setConcepts] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState(examplePrograms[0]?.id ?? "");
  const [tab, setTab] = useState<PreviewTab>("code");
  const [mobilePreview, setMobilePreview] = useState(false);
  const [preview, setPreview] = useState<{ id: string; lines: PreviewLine[] } | null>(null);
  const [runCount, setRunCount] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = normalize(query.trim());
    return examplePrograms.filter((example) => {
      if (topic && example.topic !== topic) return false;
      if (level && example.level !== level) return false;
      if (concepts.size && ![...concepts].every((c) => example.concepts.includes(c as never))) return false;
      if (!q) return true;
      const copy = copyOf(example);
      const haystack = normalize(
        [titleOf(example), copy?.description, copy?.learn, example.concepts.map((c) => t.concepts[c]).join(" "), example.source].join(" ")
      );
      return q.split(/\s+/).every((word) => haystack.includes(word));
    });
    // copyOf/titleOf only read the dictionary, which is a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concepts, dictionary, level, query, topic]);

  const active = matches.find((e) => e.id === activeId) ?? matches[0] ?? null;
  const activeCopy = active ? copyOf(active) : undefined;

  const topicCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const example of examplePrograms) counts.set(example.topic, (counts.get(example.topic) ?? 0) + 1);
    return counts;
  }, []);

  // Run the preview when the Output tab is visible.
  useEffect(() => {
    if (tab !== "output" || !active) return;
    const signal = { cancelled: false };
    void runPreview(active, signal).then((lines) => {
      if (!signal.cancelled) setPreview({ id: active.id, lines });
    });
    return () => {
      signal.cancelled = true;
    };
  }, [active, runCount, tab]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-id="${active?.id}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active?.id]);

  const move = (delta: number) => {
    if (!matches.length) return;
    const index = Math.max(0, matches.findIndex((e) => e.id === active?.id));
    setActiveId(matches[(index + delta + matches.length) % matches.length].id);
  };

  const toggleConcept = (concept: string) =>
    setConcepts((current) => {
      const next = new Set(current);
      if (next.has(concept)) next.delete(concept);
      else next.add(concept);
      return next;
    });

  const filtersActive = topic !== null || level !== null || concepts.size > 0 || query !== "";
  const lineCount = active ? active.source.trimEnd().split("\n").length : 0;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 sm:p-6"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          if (mobilePreview) setMobilePreview(false);
          else onClose();
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          move(1);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          move(-1);
        } else if (event.key === "Enter" && active && !(event.target as HTMLElement).closest(".monaco-editor")) {
          event.preventDefault();
          onOpen(active);
        }
      }}
      onMouseDown={onClose}
    >
      <div
        aria-label={t.title}
        aria-modal
        className="relative flex h-full w-full max-w-[1180px] flex-col overflow-hidden border-white/10 bg-[#1B1F22] text-[#E6ECE9] shadow-[0_30px_90px_rgba(0,0,0,0.6)] sm:h-[min(760px,92vh)] sm:rounded-[14px] sm:border"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        {/* Search and level */}
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-white/[0.07] px-4 py-3">
          <div className="flex h-[34px] min-w-[200px] flex-1 items-center gap-2.5 rounded-[8px] border border-white/[0.08] bg-black/25 px-3 focus-within:border-[#4FB892]/70 focus-within:shadow-[0_0_0_3px_rgba(79,184,146,0.18)]">
            <Search className="text-white/40" size={15} />
            <input
              ref={searchRef}
              aria-label={t.search}
              autoFocus
              className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-white/30"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.search}
              value={query}
            />
          </div>
          <div className="flex items-center gap-1" role="radiogroup" aria-label={t.levels[1]}>
            {([1, 2, 3] as const).map((value) => (
              <button
                key={value}
                aria-checked={level === value}
                className={`h-[28px] rounded-full px-3 text-[12.5px] ${
                  level === value ? "bg-[#2F8F6E] text-white" : "border border-white/[0.08] text-white/60 hover:text-white"
                }`}
                onClick={() => setLevel(level === value ? null : value)}
                role="radio"
                type="button"
              >
                {t.levels[String(value) as "1" | "2" | "3"]}
              </button>
            ))}
          </div>
          <button aria-label={t.back} className="rounded-[6px] p-1.5 text-white/45 hover:bg-white/[0.06] hover:text-white" onClick={onClose} type="button">
            <X size={16} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Topics and concepts */}
          <aside className="workspace-scroll hidden w-[210px] shrink-0 overflow-y-auto border-r border-white/[0.07] p-2 md:block">
            {[null, ...exampleTopics].map((id) => (
              <button
                key={id ?? "all"}
                className={`flex h-[30px] w-full items-center justify-between rounded-[6px] px-2.5 text-left text-[13px] ${
                  topic === id ? "bg-white/[0.1] text-white" : "text-white/65 hover:bg-white/[0.04] hover:text-white"
                }`}
                onClick={() => setTopic(id)}
                type="button"
              >
                {id ? t.topics[id] : t.all}
                <span className="text-[11.5px] text-white/35 tabular-nums">{id ? topicCounts.get(id) : examplePrograms.length}</span>
              </button>
            ))}
            <div className="mt-4 mb-1.5 px-2.5 text-[11px] font-semibold tracking-[0.06em] text-white/35 uppercase">{t.conceptsLabel}</div>
            <div className="flex flex-wrap gap-1 px-1.5">
              {exampleConcepts.map((concept) => (
                <button
                  key={concept}
                  aria-pressed={concepts.has(concept)}
                  className={`rounded-full px-2 py-[3px] text-[11.5px] ${
                    concepts.has(concept) ? "bg-[#7FE0B8]/20 text-[#A9F0D2] ring-1 ring-[#7FE0B8]/40" : "bg-white/[0.04] text-white/55 hover:text-white/85"
                  }`}
                  onClick={() => toggleConcept(concept)}
                  type="button"
                >
                  {t.concepts[concept] ?? concept}
                </button>
              ))}
            </div>
            {filtersActive && (
              <button
                className="mt-3 ml-2.5 text-[12px] text-[#7FE0B8] hover:underline"
                onClick={() => {
                  setTopic(null);
                  setLevel(null);
                  setConcepts(new Set());
                  setQuery("");
                  searchRef.current?.focus();
                }}
                type="button"
              >
                {t.clearFilters}
              </button>
            )}
          </aside>

          {/* Results */}
          <div className="flex w-full min-w-0 flex-col border-r border-white/[0.07] md:w-[300px] md:shrink-0">
            {/* Topic chips replace the sidebar on small screens */}
            <div className="flex shrink-0 gap-1 overflow-x-auto px-3 pt-2 [scrollbar-width:none] md:hidden">
              {[null, ...exampleTopics].map((id) => (
                <button
                  key={id ?? "all"}
                  className={`h-[26px] shrink-0 rounded-full px-2.5 text-[12px] ${topic === id ? "bg-white/[0.12] text-white" : "text-white/55"}`}
                  onClick={() => setTopic(id)}
                  type="button"
                >
                  {id ? t.topics[id] : t.all}
                </button>
              ))}
            </div>
            <div className="shrink-0 px-4 pt-2.5 pb-1.5 text-[11.5px] text-white/40">{formatPlural(t.results, matches.length)}</div>
            <div ref={listRef} className="workspace-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3" role="listbox" aria-label={t.title}>
              {matches.length === 0 && <p className="px-3 py-6 text-center text-[13px] text-white/40">{t.noResults}</p>}
              {matches.map((example) => {
                const selected = example.id === active?.id;
                return (
                  <div
                    key={example.id}
                    aria-selected={selected}
                    className={`cursor-default rounded-[8px] px-3 py-2.5 ${selected ? "bg-[#2F8F6E]/90 text-white" : "hover:bg-white/[0.04]"}`}
                    data-id={example.id}
                    onClick={() => {
                      setActiveId(example.id);
                      setMobilePreview(true);
                    }}
                    onDoubleClick={() => onOpen(example)}
                    role="option"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13.5px] font-medium">{titleOf(example)}</span>
                      <span className={`shrink-0 text-[10px] tracking-[0.15em] ${selected ? "text-white/80" : "text-[#7FE0B8]/70"}`} title={t.levels[String(example.level) as "1"]}>
                        {LEVEL_DOTS[example.level]}
                      </span>
                    </div>
                    <div className={`mt-0.5 line-clamp-2 text-[12px] leading-[17px] ${selected ? "text-white/80" : "text-white/45"}`}>
                      {copyOf(example)?.description ?? example.description}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Preview */}
          {active && (
            <section
              className={`absolute inset-0 z-10 flex min-w-0 flex-col bg-[#1B1F22] md:static md:z-auto md:flex-1 ${mobilePreview ? "flex" : "hidden md:flex"}`}
            >
              <div className="shrink-0 px-5 pt-4">
                <button className="mb-2 flex items-center gap-1 text-[12.5px] text-white/50 md:hidden" onClick={() => setMobilePreview(false)} type="button">
                  <ArrowLeft size={13} /> {t.back}
                </button>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-[18px] leading-tight font-semibold">{titleOf(active)}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-white/45">
                      <span>{t.topics[active.topic]}</span>
                      <span>·</span>
                      <span>{t.levels[String(active.level) as "1"]}</span>
                      <span>·</span>
                      <span>{formatMessage(t.lines, { n: lineCount })}</span>
                    </div>
                  </div>
                  <button
                    className="flex h-[32px] shrink-0 items-center gap-2 rounded-[8px] bg-[#2F8F6E] px-3.5 text-[13px] font-medium text-white hover:bg-[#35A27C] active:bg-[#287A5E]"
                    onClick={() => onOpen(active)}
                    type="button"
                  >
                    {t.open} <CornerDownLeft size={13} />
                  </button>
                </div>
                {activeCopy?.learn && (
                  <p className="mt-3 text-[13px] leading-[20px] text-white/70">
                    <span className="font-medium text-white/90">{t.learn}: </span>
                    {activeCopy.learn}
                  </p>
                )}
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {active.concepts.map((concept) => (
                    <span key={concept} className="rounded-full bg-white/[0.05] px-2 py-[2px] text-[11px] text-white/50">
                      {t.concepts[concept] ?? concept}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-0.5 border-b border-white/[0.07]" role="tablist">
                  {(
                    [
                      ["code", t.tabCode],
                      ["diagram", t.tabDiagram],
                      ["output", t.tabOutput],
                    ] as [PreviewTab, string][]
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      aria-selected={tab === id}
                      className={`relative px-3 pt-1 pb-2 text-[12.5px] ${tab === id ? "text-white" : "text-white/45 hover:text-white/80"}`}
                      onClick={() => setTab(id)}
                      role="tab"
                      type="button"
                    >
                      {label}
                      {tab === id && <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-[#7FE0B8]" />}
                    </button>
                  ))}
                </div>
              </div>
              <div className="min-h-0 flex-1">
                {tab === "code" && (
                  <CodeEditor currentLine={null} diagnostics={[]} fontSize={13} onChange={() => {}} readOnly value={active.source} />
                )}
                {tab === "diagram" && (
                  <FlowDiagram
                    activeLine={null}
                    routineName={null}
                    settings={normalizeEngineSettings(active.settings)}
                    source={active.source}
                    visitedLines={new Set()}
                  />
                )}
                {tab === "output" && (
                  <div className="flex h-full flex-col">
                    <div className="flex shrink-0 items-center justify-between gap-3 px-5 pt-3 text-[12px] text-white/45">
                      <span className="truncate">
                        {active.input ? `${t.sampleInput} ${active.input.split("\n").join(" · ")}` : t.noInput}
                      </span>
                      <button
                        className="flex shrink-0 items-center gap-1.5 text-white/55 hover:text-white"
                        onClick={() => setRunCount((n) => n + 1)}
                        type="button"
                      >
                        <RotateCcw size={12} /> {t.rerun}
                      </button>
                    </div>
                    <div className="workspace-scroll min-h-0 flex-1 overflow-auto px-5 py-3 font-mono text-[13px] leading-6 text-[#DCE3E0] select-text">
                      {preview?.id === active.id &&
                        preview.lines.map((line, index) =>
                          line.kind === "in" ? (
                            <div key={index} className="flex justify-end">
                              <span className="my-0.5 rounded-full bg-[#86F0C4]/15 px-3 text-[#A9F5D5]">{line.text}</span>
                            </div>
                          ) : line.kind === "err" ? (
                            <div key={index} className="mt-1 rounded-md bg-[#F08A6C]/10 px-3 py-1.5 font-sans text-[12.5px] text-[#F5A68E]">
                              {line.text}
                            </div>
                          ) : (
                            <div key={index} className="whitespace-pre-wrap">
                              {line.text || " "}
                            </div>
                          )
                        )}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
