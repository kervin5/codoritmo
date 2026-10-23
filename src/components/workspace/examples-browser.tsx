"use client";

// The example library browser: topics and concept filters on the left, the
// matching examples in the middle, and a live preview (code, flowchart, or a
// run with the sample input) on the right. Keyboard-first: type to search,
// ↑/↓ to move, Enter to open, Esc to close. On narrow screens it becomes a
// full-screen list with the preview sliding over it.

import { ArrowLeft, Check, ChevronDown, CornerDownLeft, ExternalLink, RotateCcw, Search, Share2, X } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  exampleConcepts,
  examplePrograms,
  exampleTopics,
  Interpreter,
  normalizeEngineSettings,
  type ExampleProgram,
  type Runtime,
} from "@/src/engine";
import type { Locale } from "@/src/i18n/config";
import { formatMessage, formatPlural } from "@/src/i18n/format";
import type { Dictionary } from "@/src/i18n/types";
import { examplePath } from "@/src/lib/example-urls";
import { duration, easeOut, spring, stagger } from "@/src/lib/motion";
import CodeEditor from "./code-editor";
import { TopicIcon } from "./example-topics";
import FlowDiagram from "./flow-diagram";
import { playOpenMorph, playSheetEnter, playSheetExit } from "./motion/examples-transitions";

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

/** "Mejor O(n) · Promedio O(n²) · … · Estable" as a compact row of chips. */
function ComplexityChips({
  complexity,
  labels,
}: {
  complexity: NonNullable<ExampleProgram["complexity"]>;
  labels: Dictionary["studio"]["examples"]["complexity"];
}) {
  const costs: [string, string][] = [
    [labels.best, complexity.best],
    [labels.average, complexity.average],
    [labels.worst, complexity.worst],
    [labels.space, complexity.space],
  ];
  const traits = [
    complexity.stable === undefined ? null : complexity.stable ? labels.stable : labels.unstable,
    complexity.inPlace ? labels.inPlace : null,
  ].filter((trait): trait is string => trait !== null);
  return (
    <ul aria-label={labels.label} className="mt-2 flex flex-wrap items-center gap-1 text-[11px]">
      {costs.map(([label, value]) => (
        <li key={label} className="rounded-full bg-[#7FE0B8]/[0.08] px-2 py-[2px] text-white/50">
          {label} <span className="font-mono text-[#A9F0D2]/85">{value}</span>
        </li>
      ))}
      {traits.map((trait) => (
        <li key={trait} className="rounded-full bg-white/[0.05] px-2 py-[2px] text-white/50">
          {trait}
        </li>
      ))}
    </ul>
  );
}

type ShareState = "idle" | "copied" | "manual";

/** Press feedback shared by every button in the library. */
const press = { scale: 0.97 };

/**
 * Shares the example's public page: the native share sheet where there is one
 * (phones), otherwise the clipboard. If the clipboard is blocked, the URL is
 * shown selected in a read-only field so it can be copied by hand.
 */
function ShareActions({ locale, example, title, text, labels }: {
  locale: Locale;
  example: ExampleProgram;
  title: string;
  text: string;
  labels: Dictionary["studio"]["examples"];
}) {
  const [state, setState] = useState<ShareState>("idle");
  const fieldRef = useRef<HTMLInputElement>(null);
  const path = examplePath(locale, example.id);

  useEffect(() => {
    if (state !== "copied") return;
    const timer = window.setTimeout(() => setState("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    if (state === "manual") fieldRef.current?.select();
  }, [state]);

  const share = async () => {
    const url = window.location.origin + path;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        // The person closed the share sheet: nothing to do.
        if (error instanceof DOMException && error.name === "AbortError") return;
        // Otherwise (not allowed, unsupported data…) fall back to copying.
      }
    }
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch {
      setState("manual");
    }
  };

  return (
    <div className="flex flex-col items-end gap-1.5" data-preview-actions="">
      <div className="flex items-center gap-1.5">
        <motion.a
          aria-label={labels.viewPageHint}
          className="flex h-[32px] shrink-0 items-center gap-1.5 rounded-[8px] px-2.5 text-[12.5px] text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white"
          href={path}
          rel="noopener"
          target="_blank"
          title={labels.viewPageHint}
          whileHover="hover"
          whileTap={press}
        >
          {/* The arrow nudges out: this leaves for another page. */}
          <motion.span className="flex" transition={spring.snappy} variants={{ hover: { x: 1.5, y: -1.5 } }}>
            <ExternalLink size={13} />
          </motion.span>{" "}
          <span className="hidden sm:inline">{labels.viewPage}</span>
        </motion.a>
        <motion.button
          className="flex h-[32px] shrink-0 items-center gap-1.5 rounded-[8px] border border-white/[0.1] px-3 text-[13px] text-white/80 transition-colors hover:bg-white/[0.06] hover:text-white"
          onClick={() => void share()}
          type="button"
          whileHover="hover"
          whileTap={press}
        >
          <motion.span className="flex" transition={spring.snappy} variants={{ hover: { y: -1.5 } }}>
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={state === "copied" ? "copied" : "share"}
                animate={{ scale: 1, opacity: 1 }}
                className="flex"
                exit={{ scale: 0.5, opacity: 0 }}
                initial={{ scale: 0.5, opacity: 0 }}
                transition={spring.bouncy}
              >
                {state === "copied" ? <Check className="text-[#86F0C4]" size={13} /> : <Share2 size={13} />}
              </motion.span>
            </AnimatePresence>
          </motion.span>{" "}
          {labels.share}
        </motion.button>
      </div>
      <div aria-live="polite" className="text-[11.5px] text-[#A9F0D2]">
        {state === "copied" && labels.linkCopied}
      </div>
      {state === "manual" && (
        <motion.label
          animate={{ opacity: 1, y: 0 }}
          className="flex w-[260px] max-w-full flex-col gap-1 text-[11.5px] text-white/55"
          initial={{ opacity: 0, y: -4 }}
          transition={spring.smooth}
        >
          {labels.copyFailed}
          <input
            ref={fieldRef}
            className="rounded-[6px] border border-white/[0.1] bg-black/25 px-2 py-1 font-mono text-[11.5px] text-white/85 outline-none focus:border-[#4FB892]/70"
            onFocus={(event) => event.currentTarget.select()}
            readOnly
            value={typeof window === "undefined" ? path : window.location.origin + path}
          />
        </motion.label>
      )}
    </div>
  );
}

const roll = {
  enter: (direction: number) => ({ y: direction > 0 ? 8 : -8, opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: (direction: number) => ({ y: direction > 0 ? -8 : 8, opacity: 0 }),
};

/**
 * A count that rolls to its new value (up when it grows, down when it
 * shrinks), so a filter's effect on each topic is visible at a glance.
 */
function RollingCount({ value }: { value: number }) {
  const [last, setLast] = useState({ value, direction: 1 });
  if (last.value !== value) setLast({ value, direction: value > last.value ? 1 : -1 });
  const direction = last.direction;
  return (
    <span className="relative inline-flex overflow-hidden text-[11.5px] text-white/35 tabular-nums">
      <span className="sr-only">{value}</span>
      <AnimatePresence custom={direction} initial={false} mode="popLayout">
        <motion.span
          key={value}
          animate="center"
          aria-hidden
          custom={direction}
          exit="exit"
          initial="enter"
          transition={spring.snappy}
          variants={roll}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function ExamplesBrowser({
  dictionary,
  locale,
  onOpen,
  onClose,
  originRect,
  getTabTargetRect,
}: {
  dictionary: Dictionary;
  locale: Locale;
  onOpen: (example: ExampleProgram) => void;
  onClose: () => void;
  /** Where the library was opened from (the Ejemplos button): the sheet grows out of it and shrinks back into it. */
  originRect?: DOMRect | null;
  /** The new document tab's rect, read just after `onOpen`: the preview card flies into it. */
  getTabTargetRect?: () => DOMRect | null;
}) {
  const t = dictionary.studio.examples;
  const copyOf = (example: ExampleProgram) => dictionary.examples[example.id];
  const titleOf = (example: ExampleProgram) => copyOf(example)?.label ?? example.label;

  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<Topic | null>(null);
  const [level, setLevel] = useState<1 | 2 | 3 | null>(null);
  const [concepts, setConcepts] = useState<Set<string>>(new Set());
  const [conceptsOpen, setConceptsOpen] = useState(false);
  const [activeId, setActiveId] = useState(examplePrograms[0]?.id ?? "");
  const [tab, setTab] = useState<PreviewTab>("code");
  const [mobilePreview, setMobilePreview] = useState(false);
  const [preview, setPreview] = useState<{ id: string; lines: PreviewLine[] } | null>(null);
  const [runCount, setRunCount] = useState(0);
  // Without an explicit origin, a click on a trigger button leaves it focused: grow from there.
  const [origin] = useState<DOMRect | null>(() => {
    if (originRect) return originRect;
    if (typeof document === "undefined") return null;
    const trigger = document.activeElement;
    return trigger instanceof HTMLButtonElement ? trigger.getBoundingClientRect() : null;
  });
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (dialogRef.current && backdropRef.current) playSheetEnter(dialogRef.current, backdropRef.current, origin);
  }, [origin]);

  const close = () => {
    playSheetExit(dialogRef.current, backdropRef.current, origin);
    onClose();
  };
  const open = (example: ExampleProgram) => {
    playOpenMorph({
      dialog: dialogRef.current,
      backdrop: backdropRef.current,
      // On phones the list is showing, not the preview: no card to fly.
      card: previewRef.current?.offsetParent ? previewRef.current : null,
      getTarget: getTabTargetRect,
    });
    onOpen(example);
  };

  const matchesQuery = useMemo(() => {
    const q = normalize(query.trim());
    return (example: ExampleProgram) => {
      if (level && example.level !== level) return false;
      if (concepts.size && ![...concepts].every((c) => example.concepts.includes(c as never))) return false;
      if (!q) return true;
      const copy = copyOf(example);
      const haystack = normalize(
        [titleOf(example), copy?.description, copy?.learn, example.concepts.map((c) => t.concepts[c]).join(" "), example.source].join(" ")
      );
      return q.split(/\s+/).every((word) => haystack.includes(word));
    };
    // copyOf/titleOf only read the dictionary, which is a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concepts, dictionary, level, query]);

  // Everything but the topic: the topic list counts within these.
  const filtered = useMemo(() => examplePrograms.filter(matchesQuery), [matchesQuery]);
  const matches = useMemo(() => (topic ? filtered.filter((e) => e.topic === topic) : filtered), [filtered, topic]);

  const active = matches.find((e) => e.id === activeId) ?? matches[0] ?? null;
  const activeCopy = active ? copyOf(active) : undefined;

  const topicCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const example of filtered) counts.set(example.topic, (counts.get(example.topic) ?? 0) + 1);
    return counts;
  }, [filtered]);

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
    <LayoutGroup id="examples-browser">
      <div
        ref={backdropRef}
        className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 sm:p-6"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            if (mobilePreview) setMobilePreview(false);
            else close();
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            move(1);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            move(-1);
          } else if (
            event.key === "Enter" &&
            active &&
            // Enter belongs to the editor and to the share/view-page controls.
            !(event.target as HTMLElement).closest(".monaco-editor, [data-preview-actions]")
          ) {
            event.preventDefault();
            open(active);
          }
        }}
        onMouseDown={close}
      >
        <div
          ref={dialogRef}
          aria-label={t.title}
          aria-modal
          className="relative flex h-full w-full max-w-[1180px] flex-col overflow-hidden border-white/10 bg-[#1B1F22] text-[#E6ECE9] shadow-[0_30px_90px_rgba(0,0,0,0.6)] sm:h-[min(760px,92vh)] sm:rounded-[14px] sm:border"
          onMouseDown={(event) => event.stopPropagation()}
          role="dialog"
        >
          {/* Search and level */}
          <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-white/[0.07] px-4 py-3">
            <div className="flex h-[34px] min-w-[200px] flex-1 items-center gap-2.5 rounded-[8px] border border-white/[0.08] bg-black/25 px-3 transition-[border-color,box-shadow] duration-200 focus-within:border-[#4FB892]/70 focus-within:shadow-[0_0_0_3px_rgba(79,184,146,0.18)]">
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
            <div className="flex items-center rounded-full bg-black/25 p-[3px] ring-1 ring-white/[0.06]" role="radiogroup" aria-label={t.levels[1]}>
              {([1, 2, 3] as const).map((value) => (
                <motion.button
                  key={value}
                  aria-checked={level === value}
                  className={`relative h-[26px] rounded-full px-3 text-[12.5px] transition-colors ${
                    level === value ? "text-white" : "text-white/55 hover:text-white"
                  }`}
                  onClick={() => setLevel(level === value ? null : value)}
                  role="radio"
                  type="button"
                  whileTap={press}
                >
                  {level === value && (
                    <motion.span className="absolute inset-0 rounded-full bg-white/[0.12]" layoutId="examples-level" transition={spring.snappy} />
                  )}
                  <span className="relative">{t.levels[String(value) as "1" | "2" | "3"]}</span>
                </motion.button>
              ))}
            </div>
            <motion.button
              aria-label={t.back}
              className="rounded-[6px] p-1.5 text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white"
              onClick={close}
              type="button"
              whileHover={{ rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              transition={spring.snappy}
            >
              <X size={16} />
            </motion.button>
          </div>

          <div className="flex min-h-0 flex-1">
            {/* Topics and concepts */}
            <aside className="workspace-scroll hidden w-[210px] shrink-0 overflow-y-auto border-r border-white/[0.07] p-2 md:block">
              {[null, ...exampleTopics].map((id) => (
                <motion.button
                  key={id ?? "all"}
                  className={`relative flex min-h-[34px] w-full items-center justify-between gap-2 rounded-[8px] px-2 py-[5px] text-left text-[13px] leading-[18px] transition-colors ${
                    topic === id ? "text-white" : "text-white/65 hover:bg-white/[0.04] hover:text-white"
                  }`}
                  onClick={() => setTopic(id)}
                  type="button"
                  whileTap={{ scale: 0.98 }}
                >
                  {topic === id && (
                    <motion.span className="absolute inset-0 rounded-[8px] bg-white/[0.09]" layoutId="examples-topic" transition={spring.snappy} />
                  )}
                  <span className="relative flex min-w-0 items-center gap-2.5">
                    <TopicIcon topic={id ?? "all"} />
                    <span>{id ? t.topics[id] : t.all}</span>
                  </span>
                  <span className="relative text-white/40">
                    <RollingCount value={id ? topicCounts.get(id) ?? 0 : filtered.length} />
                  </span>
                </motion.button>
              ))}
              <button
                aria-expanded={conceptsOpen}
                className="mt-3 flex w-full items-center justify-between rounded-[8px] px-2.5 py-1.5 text-left text-[12.5px] text-white/55 transition-colors hover:bg-white/[0.04] hover:text-white/85"
                onClick={() => setConceptsOpen((v) => !v)}
                type="button"
              >
                <span>
                  {t.filterByConcept}
                  {concepts.size > 0 && <span className="ml-1.5 text-[#A9F0D2]">{concepts.size}</span>}
                </span>
                <ChevronDown className={`transition-transform ${conceptsOpen ? "rotate-180" : ""}`} size={14} />
              </button>
              <AnimatePresence initial={false}>
              {conceptsOpen && (
              <motion.div
                animate={{ height: "auto", opacity: 1 }}
                className="overflow-hidden"
                exit={{ height: 0, opacity: 0 }}
                initial={{ height: 0, opacity: 0 }}
                transition={spring.smooth}
              >
              <div className="flex flex-wrap gap-1 px-1.5 pt-1">
                {exampleConcepts.map((concept) => (
                  <motion.button
                    key={concept}
                    aria-pressed={concepts.has(concept)}
                    className={`rounded-full px-2 py-[3px] text-[11.5px] transition-[background-color,color,box-shadow] duration-150 ${
                      concepts.has(concept) ? "bg-[#7FE0B8]/20 text-[#A9F0D2] ring-1 ring-[#7FE0B8]/40" : "bg-white/[0.04] text-white/55 hover:text-white/85"
                    }`}
                    onClick={() => toggleConcept(concept)}
                    type="button"
                    whileTap={{ scale: 0.94 }}
                  >
                    {t.concepts[concept] ?? concept}
                  </motion.button>
                ))}
              </div>
              </motion.div>
              )}
              </AnimatePresence>
              <AnimatePresence initial={false}>
                {filtersActive && (
                  <motion.button
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 ml-2.5 text-[12px] text-[#7FE0B8] hover:underline"
                    exit={{ opacity: 0, y: -4, transition: { duration: duration.instant } }}
                    initial={{ opacity: 0, y: -4 }}
                    onClick={() => {
                      setTopic(null);
                      setLevel(null);
                      setConcepts(new Set());
                      setQuery("");
                      searchRef.current?.focus();
                    }}
                    transition={spring.smooth}
                    type="button"
                    whileTap={press}
                  >
                    {t.clearFilters}
                  </motion.button>
                )}
              </AnimatePresence>
            </aside>

            {/* Results */}
            <div className="flex w-full min-w-0 flex-col border-r border-white/[0.07] md:w-[300px] md:shrink-0">
              {/* Topic chips replace the sidebar on small screens */}
              <div className="flex shrink-0 gap-1 overflow-x-auto px-3 pt-2 [scrollbar-width:none] md:hidden">
                {[null, ...exampleTopics].map((id) => (
                  <motion.button
                    key={id ?? "all"}
                    className={`relative h-[28px] shrink-0 rounded-full pr-2.5 pl-1 text-[12px] ${topic === id ? "text-white" : "text-white/55"}`}
                    onClick={() => setTopic(id)}
                    type="button"
                    whileTap={press}
                  >
                    {topic === id && (
                      <motion.span className="absolute inset-0 rounded-full bg-white/[0.12]" layoutId="examples-topic-chip" transition={spring.snappy} />
                    )}
                    <span className="relative flex items-center gap-1.5">
                      <TopicIcon size={18} topic={id ?? "all"} />
                      {id ? t.topics[id] : t.all}
                    </span>
                  </motion.button>
                ))}
              </div>
              <div className="shrink-0 px-4 pt-2.5 pb-1.5 text-[11.5px] text-white/40">{formatPlural(t.results, matches.length)}</div>
              <motion.div
                ref={listRef}
                aria-label={t.title}
                className="workspace-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3"
                layoutScroll
                role="listbox"
              >
                {matches.length === 0 && (
                  <motion.p
                    animate={{ opacity: 1 }}
                    className="px-3 py-6 text-center text-[13px] text-white/40"
                    initial={{ opacity: 0 }}
                    transition={{ duration: duration.base, ease: easeOut }}
                  >
                    {t.noResults}
                  </motion.p>
                )}
                {/*
                  Rows that stay slide to their new place (layout); new rows cascade in.
                  Rows that leave go at once instead of fading out, so a filtered list
                  never holds stale options (for keyboard, screen readers and tests).
                */}
                {matches.map((example, index) => {
                  const selected = example.id === active?.id;
                  return (
                    <motion.div
                      key={example.id}
                      animate={{ opacity: 1, y: 0 }}
                      aria-selected={selected}
                      className="relative cursor-default rounded-[10px] px-2.5 py-2.5 transition-colors hover:bg-white/[0.04]"
                      data-id={example.id}
                      initial={{ opacity: 0, y: 8 }}
                      layout="position"
                      onClick={() => {
                        setActiveId(example.id);
                        setMobilePreview(true);
                      }}
                      onDoubleClick={() => open(example)}
                      role="option"
                      transition={{
                        ...spring.smooth,
                        delay: stagger(index),
                        opacity: { duration: duration.base, ease: easeOut, delay: stagger(index) },
                        layout: spring.smooth,
                      }}
                    >
                      {selected && (
                        <motion.div
                          className="absolute inset-0 rounded-[10px] bg-white/[0.08] ring-1 ring-white/[0.06]"
                          layoutId="examples-row"
                          transition={spring.snappy}
                        />
                      )}
                      <div className="relative flex gap-3">
                      <span className="mt-0.5"><TopicIcon size={28} topic={example.topic} /></span>
                      <div className="min-w-0 flex-1">
                      <div className="relative flex items-baseline justify-between gap-2">
                        <span className={`truncate text-[13.5px] font-medium transition-colors ${selected ? "text-white" : ""}`}>{titleOf(example)}</span>
                        <span
                          className="shrink-0 text-[10px] tracking-[0.15em] text-white/40"
                          title={t.levels[String(example.level) as "1"]}
                        >
                          {LEVEL_DOTS[example.level]}
                        </span>
                      </div>
                      <div
                        className={`relative mt-0.5 line-clamp-2 text-[12px] leading-[17px] transition-colors ${selected ? "text-white/70" : "text-white/45"}`}
                      >
                        {copyOf(example)?.description ?? example.description}
                      </div>
                      </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>

            {/* Preview */}
            {active && (
              <section
                ref={previewRef}
                className={`absolute inset-0 z-10 flex min-w-0 flex-col bg-[#1B1F22] md:static md:z-auto md:flex-1 ${mobilePreview ? "flex" : "hidden md:flex"}`}
                data-examples-preview=""
              >
                <div className="shrink-0 px-5 pt-4">
                  <button className="mb-2 flex items-center gap-1 text-[12.5px] text-white/50 md:hidden" onClick={() => setMobilePreview(false)} type="button">
                    <ArrowLeft size={13} /> {t.back}
                  </button>
                  {/* A new selection fades its details in; the area below slides to its new height. */}
                  <motion.div
                    key={active.id}
                    animate={{ opacity: 1, y: 0 }}
                    initial={{ opacity: 0, y: 4 }}
                    transition={{ ...spring.smooth, opacity: { duration: duration.fast, ease: easeOut } }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h2 className="text-[18px] leading-tight font-semibold">{titleOf(active)}</h2>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-white/55">
                          <span className="flex items-center gap-1.5">
                            <TopicIcon size={20} topic={active.topic} />
                            {t.topics[active.topic]}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span aria-hidden className="text-[9px] tracking-[0.15em] text-white/45">{LEVEL_DOTS[active.level]}</span>
                            {t.levels[String(active.level) as "1"]}
                          </span>
                          <span className="text-white/40">{formatMessage(t.lines, { n: lineCount })}</span>
                        </div>
                        {active.complexity && <ComplexityChips complexity={active.complexity} labels={t.complexity} />}
                      </div>
                      <div className="flex shrink-0 items-start gap-1.5">
                        <ShareActions
                          example={active}
                          labels={t}
                          locale={locale}
                          text={activeCopy?.description ?? active.description}
                          title={titleOf(active)}
                        />
                        <motion.button
                          className="flex h-[32px] shrink-0 items-center gap-2 rounded-full bg-[#86F0C4]/[0.16] px-4 text-[13px] font-medium text-[#B4F7DA] transition-colors hover:bg-[#86F0C4]/[0.24]"
                          onClick={() => open(active)}
                          type="button"
                          whileHover="hover"
                          whileTap={press}
                        >
                          {t.open}{" "}
                          <motion.span className="flex" transition={spring.snappy} variants={{ hover: { x: -2 } }}>
                            <CornerDownLeft size={13} />
                          </motion.span>
                        </motion.button>
                      </div>
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
                  </motion.div>
                  <motion.div className="mt-3 flex items-center gap-0.5 border-b border-white/[0.07]" layout="position" role="tablist" transition={spring.smooth}>
                    {(
                      [
                        ["code", t.tabCode],
                        ["diagram", t.tabDiagram],
                        ["output", t.tabOutput],
                      ] as [PreviewTab, string][]
                    ).map(([id, label]) => (
                      <motion.button
                        key={id}
                        aria-selected={tab === id}
                        className={`relative px-3 pt-1 pb-2 text-[12.5px] transition-colors ${tab === id ? "text-white" : "text-white/45 hover:text-white/80"}`}
                        onClick={() => setTab(id)}
                        role="tab"
                        type="button"
                        whileTap={press}
                      >
                        {label}
                        {tab === id && (
                          <motion.span
                            className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-[#7FE0B8]"
                            layoutId="examples-tab"
                            transition={spring.snappy}
                          />
                        )}
                      </motion.button>
                    ))}
                  </motion.div>
                </div>
                <motion.div className="min-h-0 flex-1" layout="position" transition={spring.smooth}>
                  <motion.div
                    key={tab}
                    animate={{ opacity: 1 }}
                    className="h-full"
                    initial={{ opacity: 0 }}
                    transition={{ duration: duration.fast, ease: easeOut }}
                  >
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
                          <motion.button
                            className="flex shrink-0 items-center gap-1.5 text-white/55 transition-colors hover:text-white"
                            onClick={() => setRunCount((n) => n + 1)}
                            type="button"
                            whileHover="hover"
                            whileTap={press}
                          >
                            <motion.span className="flex" transition={spring.snappy} variants={{ hover: { rotate: -60 } }}>
                              <RotateCcw size={12} />
                            </motion.span>{" "}
                            {t.rerun}
                          </motion.button>
                        </div>
                        <div className="workspace-scroll min-h-0 flex-1 overflow-auto px-5 py-3 font-mono text-[13px] leading-6 text-[#DCE3E0] select-text">
                          {preview?.id === active.id && (
                            // Keyed by run, so a re-run visibly replays.
                            <motion.div
                              key={runCount}
                              animate={{ opacity: 1, y: 0 }}
                              initial={{ opacity: 0, y: 4 }}
                              transition={{ ...spring.smooth, opacity: { duration: duration.fast, ease: easeOut } }}
                            >
                              {preview.lines.map((line, index) =>
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
                                    {line.text || " "}
                                  </div>
                                )
                              )}
                            </motion.div>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                </motion.div>
              </section>
            )}
          </div>
        </div>
      </div>
    </LayoutGroup>
  );
}
