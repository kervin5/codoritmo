"use client";

// PROTOTYPE — the reference as a docked, always-visible inspector. The top
// card follows the editor cursor ("what is this word?"); below is the full
// searchable catalog. Data comes from the real snippet catalog.

import { CornerDownLeft, Search } from "lucide-react";
import { useMemo, useState } from "react";

import type { EngineSettings } from "@/src/engine";
import type { Dictionary } from "@/src/i18n/types";
import { getOperatorGroups, getStructureSnippets } from "../snippets";

export interface ReferenceEntry {
  id: string;
  label: string;
  title: string;
  body: string;
  example: string;
  group: string;
}

const normalize = (word: string) =>
  word.normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase();

// Words that belong to a structure without being its first keyword.
const ALIASES: Record<string, string> = {
  FINPARA: "PARA", HASTA: "PARA", HACER: "MIENTRAS", CON: "PARA", PASO: "PARA", DESDE: "PARA", CADA: "PARA CADA",
  ENTONCES: "SI", SINO: "SI", FINSI: "SI",
  FINMIENTRAS: "MIENTRAS", QUE: "REPETIR", HASTAQUE: "REPETIR",
  FINSEGUN: "SEGUN", OTRO: "SEGUN", MODO: "SEGUN", CASO: "SEGUN",
  COMO: "DEFINIR", ENTERO: "DEFINIR", REAL: "DEFINIR", LOGICO: "DEFINIR", CARACTER: "DEFINIR", CADENA: "DEFINIR", TEXTO: "DEFINIR",
  DIMENSIONAR: "DIMENSION", MOSTRAR: "ESCRIBIR", IMPRIMIR: "ESCRIBIR", INFORMAR: "ESCRIBIR",
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
          entries.push({
            id: `${group.id}-${each.id}`,
            label: each.label,
            title: each.help.title,
            body: each.help.body,
            example: each.insertText,
            group: group.title,
          });
        }
      }
    }
    const byWord = new Map<string, ReferenceEntry>();
    for (const entry of entries) {
      const key = normalize(entry.label);
      if (!byWord.has(key)) byWord.set(key, entry);
      const first = normalize(entry.example.split(/[\s(]/)[0] ?? "");
      if (first && !byWord.has(first)) byWord.set(first, entry);
    }
    const lookup = (word: string | null) => {
      if (!word) return null;
      const key = normalize(word);
      return byWord.get(key) ?? byWord.get(ALIASES[key] ?? "") ?? null;
    };
    return { entries, groups: [...new Set(entries.map((e) => e.group))], lookup };
  }, [dictionary, settings]);
}

export function ReferenceInspector({
  catalog,
  cursorWord,
  onInsert,
}: {
  catalog: ReturnType<typeof useReferenceCatalog>;
  cursorWord: string | null;
  onInsert: (text: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<ReferenceEntry | null>(null);
  const contextual = catalog.lookup(cursorWord);
  const focus = picked ?? contextual;

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return q
      ? catalog.entries.filter((e) => normalize(`${e.label} ${e.title} ${e.body}`).includes(q))
      : catalog.entries;
  }, [catalog.entries, query]);

  return (
    <div className="flex h-full flex-col select-none">
      {/* Focus card: follows the cursor unless the user picked something */}
      <div className="shrink-0 border-b border-white/[0.06] px-4 pt-3.5 pb-4">
        <div className="flex items-center justify-between text-[11px] font-semibold tracking-[0.08em] text-white/40 uppercase">
          {picked ? "Seleccionado" : "En el cursor"}
          {picked && (
            <button className="tracking-normal text-[#7FE0B8] normal-case hover:underline" onClick={() => setPicked(null)} type="button">
              Seguir el cursor
            </button>
          )}
        </div>
        {focus ? (
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <code className="font-mono text-[17px] font-semibold text-[#8FE3BE]">{focus.label}</code>
              <span className="text-[12px] text-white/40">{focus.group}</span>
            </div>
            <div className="mt-1 text-[13.5px] font-medium text-white/90">{focus.title}</div>
            <p className="mt-1 text-[12.5px] leading-[19px] text-white/60 select-text">{focus.body}</p>
            <pre className="mt-2.5 overflow-x-auto rounded-[7px] border border-white/[0.06] bg-black/25 px-3 py-2 font-mono text-[12px] leading-5 text-[#DCE3E0] select-text">
              {focus.example}
            </pre>
            <button
              className="mt-2.5 inline-flex h-[26px] items-center gap-1.5 rounded-[6px] bg-white/[0.08] px-2.5 text-[12.5px] text-white/85 hover:bg-white/[0.12] active:bg-white/[0.16]"
              onClick={() => onInsert(focus.example)}
              type="button"
            >
              <CornerDownLeft size={12} /> Insertar
            </button>
          </div>
        ) : (
          <p className="mt-2 text-[12.5px] leading-[19px] text-white/45">
            Coloca el cursor sobre una palabra clave (por ejemplo <code className="text-white/70">Para</code> o{" "}
            <code className="text-white/70">Leer</code>) y aquí verás qué hace y cómo se usa.
          </p>
        )}
      </div>

      {/* Catalog */}
      <div className="shrink-0 px-3 pt-3 pb-2">
        <div className="flex h-[28px] items-center gap-2 rounded-[7px] border border-white/[0.07] bg-black/20 px-2.5 focus-within:border-[#4FB892]/70 focus-within:shadow-[0_0_0_3px_rgba(79,184,146,0.18)]">
          <Search className="text-white/35" size={13} />
          <input
            className="flex-1 bg-transparent text-[12.5px] text-white/90 outline-none placeholder:text-white/30"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar en la referencia"
            value={query}
          />
        </div>
      </div>
      <div className="proto-scroll min-h-0 flex-1 overflow-auto px-2 pb-4">
        {catalog.groups.map((group) => {
          const items = filtered.filter((e) => e.group === group);
          if (!items.length) return null;
          return (
            <div key={group} className="mb-2">
              <div className="px-2 pt-2 pb-1 text-[11px] font-semibold tracking-[0.08em] text-white/35 uppercase">{group}</div>
              {items.map((entry) => (
                <button
                  key={entry.id}
                  className={`flex h-[26px] w-full cursor-default items-center gap-2.5 rounded-[5px] px-2 text-left ${
                    focus?.id === entry.id ? "bg-white/[0.09]" : "hover:bg-white/[0.04]"
                  }`}
                  onClick={() => setPicked(entry)}
                  onDoubleClick={() => onInsert(entry.example)}
                  title="Doble clic para insertar"
                  type="button"
                >
                  <code className="w-[92px] shrink-0 truncate font-mono text-[12.5px] text-[#8FE3BE]">{entry.label}</code>
                  <span className="truncate text-[12.5px] text-white/55">{entry.title}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
