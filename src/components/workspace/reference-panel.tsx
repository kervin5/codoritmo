"use client";

// The language reference as a docked panel. The top card follows the editor
// cursor ("what is this word?"); below is the full searchable catalog built
// from the snippet catalog, so it always matches the active profile.

import { CornerDownLeft, Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { EngineSettings } from "@/src/engine";
import type { Dictionary } from "@/src/i18n/types";
import { spring } from "@/src/lib/motion";
import { getOperatorGroups, getStructureSnippets } from "../ide/snippets";
import { shapeSceneSvg, shapeSpecFor, svgDataUri, type ShapeSpec } from "./reference-shape";

export interface ReferenceEntry {
  id: string;
  label: string;
  title: string;
  /** What it does, written for someone who has never programmed. */
  body: string;
  /** The insertable template (with <placeholders>). */
  example: string;
  group: string;
  /** A real, runnable example and what it produces. */
  sample?: string;
  outcome?: string;
  tip?: string;
  /** Where it shows up in a flowchart. */
  shape: ShapeSpec | null;
  /** The shape scene as an SVG data URI (built lazily). */
  shapeUri: () => string | null;
}

/** Fills the profile's own operators into guide text: {and} → Y or &&, etc. */
export function guideOperators(text: string, settings: EngineSettings): string {
  const words = settings.wordOperators;
  return text
    .replace(/\{and\}/g, words ? "Y" : "&&")
    .replace(/\{or\}/g, words ? "O" : "||")
    .replace(/\{not\}/g, words ? "NO" : "~")
    .replace(/\{mod\}/g, words ? "MOD" : "%");
}

const normalize = (word: string) =>
  word.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

// Words that belong to a structure without being its first keyword.
const ALIASES: Record<string, string> = {
  FINPARA: "PARA", HASTA: "PARA", HACER: "MIENTRAS", CON: "PARA", PASO: "PARA", DESDE: "PARA", CADA: "PARA CADA",
  ENTONCES: "SI", SINO: "SI", FINSI: "SI",
  FINMIENTRAS: "MIENTRAS", QUE: "REPETIR", HASTAQUE: "REPETIR",
  FINSEGUN: "SEGUN", OTRO: "SEGUN", MODO: "SEGUN", CASO: "SEGUN",
  COMO: "DEFINIR", ENTERO: "DEFINIR", REAL: "DEFINIR", LOGICO: "DEFINIR", CARACTER: "DEFINIR", CADENA: "DEFINIR", TEXTO: "DEFINIR",
  DIMENSIONAR: "DIMENSION", MOSTRAR: "ESCRIBIR", IMPRIMIR: "ESCRIBIR", INFORMAR: "ESCRIBIR",
  "<>": "!=", "==": "=", "<-": "ASIGNAR", "←": "ASIGNAR",
  Y: "&&", "&&": "Y", O: "||", "||": "O", NO: "~", "~": "NO", MOD: "%", "%": "MOD",
  RC: "RAIZ", ALGORITMO: "ALGORITMO", PROCESO: "ALGORITMO", FINALGORITMO: "ALGORITMO", FINPROCESO: "ALGORITMO",
  FUNCION: "FUNCION", FINFUNCION: "FUNCION", SUBPROCESO: "FUNCION", FINSUBPROCESO: "FUNCION",
};

export function useReferenceCatalog(dictionary: Dictionary, settings: EngineSettings) {
  return useMemo(() => {
    const groups = [getStructureSnippets(settings, dictionary), ...getOperatorGroups(settings, dictionary)];
    const entries: ReferenceEntry[] = [];
    for (const group of groups) {
      for (const item of group.items) {
        for (const each of [item, ...(item.variants ?? [])]) {
          const guide = dictionary.referenceGuide[each.id];
          const fill = (text: string | undefined) => (text === undefined ? undefined : guideOperators(text, settings));
          const shape = shapeSpecFor(each.id);
          const filledShape = shape ? { ...shape, label: guideOperators(shape.label, settings) } : null;
          let uri: string | null | undefined;
          entries.push({
            id: `${group.id}-${each.id}`,
            label: each.label,
            title: each.help.title,
            body: fill(guide?.body) ?? each.help.body,
            example: each.insertText,
            group: group.title,
            sample: fill(guide?.example),
            outcome: fill(guide?.outcome),
            tip: fill(guide?.tip),
            shape: filledShape,
            shapeUri: () => (uri === undefined ? (uri = filledShape ? svgDataUri(shapeSceneSvg(filledShape)) : null) : uri),
          });
        }
      }
    }
    const byWord = new Map<string, ReferenceEntry>();
    for (const entry of entries) {
      const key = normalize(entry.label);
      if (key && !byWord.has(key)) byWord.set(key, entry);
      const first = normalize(entry.example.split(/[\s(]/)[0] ?? "");
      if (first && !byWord.has(first)) byWord.set(first, entry);
    }
    const lookup = (word: string | null) => {
      if (!word) return null;
      const key = normalize(word);
      if (!key) return null;
      const alias = ALIASES[key];
      return byWord.get(key) ?? (alias ? byWord.get(alias) : undefined) ?? null;
    };
    const text = { ...dictionary.studio.hover, line: dictionary.studio.line };
    return { entries, groups: [...new Set(entries.map((e) => e.group))], lookup, text };
  }, [dictionary, settings]);
}

type ReferenceText = Dictionary["studio"]["reference"];

/** A row's second column: the title when it adds something, otherwise the start of the explanation. */
function summary(entry: ReferenceEntry): string {
  const same = normalize(entry.title).replace(/\s+/g, "") === normalize(entry.label).replace(/\s+/g, "");
  return same || entry.title.startsWith(entry.label) ? entry.body : entry.title;
}

/** The flowchart scene for an entry, with a caption saying how it's used. */
function ShapeFigure({ entry, t, compact }: { entry: ReferenceEntry; t: ReferenceText; compact?: boolean }) {
  const uri = entry.shapeUri();
  if (!uri || !entry.shape) return null;
  const caption =
    entry.shape.context === "condition" ? t.insideCondition : entry.shape.context === "process" ? t.insideProcess : t.inFlowchart;
  return (
    <figure className={compact ? "mt-2" : "mt-3"}>
      <div className="relative overflow-hidden rounded-[9px] border border-white/[0.06] bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_0)] bg-[length:16px_16px] px-2 py-3">
        <motion.img
          key={uri}
          alt=""
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="mx-auto block max-w-full"
          draggable={false}
          initial={{ opacity: 0, y: 6, scale: 0.97 }}
          src={uri}
          transition={spring.smooth}
        />
      </div>
      <figcaption className="mt-1.5 text-[11.5px] text-white/40">{caption}</figcaption>
    </figure>
  );
}

/** Everything we know about an entry: explanation, shape, a worked example, the common mistake. */
function EntryDetails({ entry, t }: { entry: ReferenceEntry; t: ReferenceText }) {
  return (
    <motion.div
      key={entry.id}
      animate={{ opacity: 1, y: 0 }}
      className="mt-2"
      initial={{ opacity: 0, y: 4 }}
      transition={spring.snappy}
    >
      <div className="flex items-baseline gap-2">
        <code className="font-mono text-[17px] font-semibold text-[#8FE3BE]">{entry.label}</code>
        <span className="text-[12px] text-white/40">{entry.group}</span>
      </div>
      {summary(entry) === entry.title && <div className="mt-1 text-[14px] font-medium text-white/90">{entry.title}</div>}
      <p className="mt-1.5 text-[13px] leading-[20px] text-white/70 select-text">{entry.body}</p>
      <ShapeFigure entry={entry} t={t} />
      {entry.sample && (
        <div className="mt-3">
          <div className="text-[12px] font-medium text-white/50">{t.example}</div>
          <pre className="mt-1 overflow-x-auto rounded-[7px] border border-white/[0.06] bg-black/25 px-3 py-2 font-mono text-[12px] leading-5 text-[#DCE3E0] select-text">
            {entry.sample}
          </pre>
          {entry.outcome && (
            <p className="mt-1.5 flex gap-1.5 text-[12.5px] leading-[19px] text-white/65 select-text">
              <span aria-hidden className="text-[#7FE0B8]">→</span>
              <span>{entry.outcome}</span>
            </p>
          )}
        </div>
      )}
      {entry.tip && (
        <p className="mt-3 border-l-2 border-[#E8BE8C]/50 pl-2.5 text-[12.5px] leading-[19px] text-white/65 select-text">
          <span className="font-medium text-[#E8BE8C]">{t.tip}: </span>
          {entry.tip}
        </p>
      )}
    </motion.div>
  );
}

/** Floating preview beside a hovered catalog row (the panel sits on the right, so it opens to the left). */
function HoverCard({ entry, anchor, t }: { entry: ReferenceEntry; anchor: DOMRect; t: ReferenceText }) {
  const width = 300;
  const left = Math.max(8, anchor.left - width - 10);
  const top = Math.min(Math.max(8, anchor.top - 40), window.innerHeight - 380);
  return createPortal(
    <motion.div
      animate={{ opacity: 1, x: 0, scale: 1 }}
      className="pointer-events-none fixed z-[260] rounded-[11px] border border-white/[0.09] bg-[#23282B]/[0.96] p-3.5 text-[#E6ECE9] shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-xl"
      exit={{ opacity: 0, x: 6, scale: 0.98 }}
      initial={{ opacity: 0, x: 8, scale: 0.98 }}
      role="tooltip"
      style={{ left, top, width, transformOrigin: "right center" }}
      transition={spring.snappy}
    >
      <div className="flex items-baseline gap-2">
        <code className="font-mono text-[14px] font-semibold text-[#8FE3BE]">{entry.label}</code>
        <span className="truncate text-[12.5px] font-medium text-white/85">{entry.title}</span>
      </div>
      <p className="mt-1 text-[12.5px] leading-[18px] text-white/65">{entry.body}</p>
      <ShapeFigure compact entry={entry} t={t} />
      <div className="mt-2 text-[11px] text-white/35">{t.insertHint}</div>
    </motion.div>,
    document.body
  );
}

export function ReferencePanel({
  catalog,
  cursorWord,
  onInsert,
  dictionary,
}: {
  catalog: ReturnType<typeof useReferenceCatalog>;
  cursorWord: string | null;
  onInsert: (text: string) => void;
  dictionary: Dictionary;
}) {
  const t = dictionary.studio.reference;
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<ReferenceEntry | null>(null);
  const [hovered, setHovered] = useState<{ entry: ReferenceEntry; anchor: DOMRect } | null>(null);
  const hoverTimer = useRef<number | undefined>(undefined);
  const contextual = catalog.lookup(cursorWord);
  const focus = picked ?? contextual;

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return q
      ? catalog.entries.filter((e) => normalize(`${e.label} ${e.title} ${e.body}`).includes(q))
      : catalog.entries;
  }, [catalog.entries, query]);

  const hoverEnter = (entry: ReferenceEntry, element: HTMLElement) => {
    window.clearTimeout(hoverTimer.current);
    const show = () => setHovered({ entry, anchor: element.getBoundingClientRect() });
    // Once a card is showing, moving down the list swaps it immediately.
    if (hovered) show();
    else hoverTimer.current = window.setTimeout(show, 280);
  };
  const hoverLeave = () => {
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setHovered(null), 120);
  };

  return (
    <div className="flex h-full flex-col select-none">
      {/* Focus card: follows the cursor unless the user picked something */}
      <div className="proto-scroll max-h-[62%] shrink-0 overflow-y-auto border-b border-white/[0.06] px-4 pt-3.5 pb-4">
        <div className="flex items-center justify-between text-[12px] font-medium text-white/45">
          {picked ? t.selected : t.atCursor}
          {picked && (
            <button className="text-[#7FE0B8] hover:underline" onClick={() => setPicked(null)} type="button">
              {t.followCursor}
            </button>
          )}
        </div>
        {focus ? (
          <>
            <EntryDetails entry={focus} t={t} />
            <motion.button
              className="mt-3 inline-flex h-[26px] items-center gap-1.5 rounded-[6px] bg-white/[0.08] px-2.5 text-[12.5px] text-white/85 hover:bg-white/[0.12]"
              onClick={() => onInsert(focus.example)}
              title={`${t.template}: ${focus.example}`}
              type="button"
              whileTap={{ scale: 0.96 }}
            >
              <CornerDownLeft size={12} /> {t.insert}
            </motion.button>
          </>
        ) : (
          <p className="mt-2 text-[12.5px] leading-[19px] text-white/45">{t.cursorHint}</p>
        )}
      </div>

      {/* Catalog */}
      <div className="shrink-0 px-3 pt-3 pb-2">
        <div className="flex h-[28px] items-center gap-2 rounded-[7px] border border-white/[0.07] bg-black/20 px-2.5 focus-within:border-[#4FB892]/70 focus-within:shadow-[0_0_0_3px_rgba(79,184,146,0.18)]">
          <Search className="text-white/35" size={13} />
          <input
            className="flex-1 bg-transparent text-[12.5px] text-white/90 outline-none placeholder:text-white/30"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.search}
            value={query}
          />
        </div>
      </div>
      <div className="proto-scroll min-h-0 flex-1 overflow-auto px-2 pb-4" onScroll={() => setHovered(null)}>
        {catalog.groups.map((group) => {
          const items = filtered.filter((e) => e.group === group);
          if (!items.length) return null;
          return (
            <div key={group} className="mb-2">
              <div className="px-2 pt-2 pb-1 text-[12px] font-medium text-white/40">{group}</div>
              {items.map((entry) => (
                <button
                  key={entry.id}
                  className={`relative flex h-[26px] w-full cursor-default items-center gap-2.5 rounded-[5px] px-2 text-left transition-colors ${
                    focus?.id === entry.id ? "" : "hover:bg-white/[0.04]"
                  }`}
                  onClick={() => {
                    setPicked(entry);
                    setHovered(null);
                  }}
                  onDoubleClick={() => onInsert(entry.example)}
                  onMouseEnter={(event) => hoverEnter(entry, event.currentTarget)}
                  onMouseLeave={hoverLeave}
                  type="button"
                >
                  {focus?.id === entry.id && (
                    <motion.span className="absolute inset-0 rounded-[5px] bg-white/[0.09]" layoutId="reference-selection" transition={spring.snappy} />
                  )}
                  <code className="relative w-[92px] shrink-0 truncate font-mono text-[12.5px] text-[#8FE3BE]">{entry.label}</code>
                  <span className="relative truncate text-[12.5px] text-white/55">{summary(entry)}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
      <AnimatePresence>
        {hovered && hovered.entry.id !== focus?.id && (
          <HoverCard key="hover-card" anchor={hovered.anchor} entry={hovered.entry} t={t} />
        )}
      </AnimatePresence>
    </div>
  );
}
