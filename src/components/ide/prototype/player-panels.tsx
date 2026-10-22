"use client";

// PROTOTYPE — panels for Variant D "Reproductor": reference library, a
// language picker that scales past three languages, and the console.

import { Check, ChevronDown, Copy, CornerDownLeft, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { exportLanguages, generateExport, Parser, type EngineSettings, type ExportLanguage } from "@/src/engine";
import type { Dictionary } from "@/src/i18n/types";
import { getOperatorGroups, getStructureSnippets, type SnippetItem } from "../snippets";
import type { Player } from "./use-player";

/* ---------------- Reference library ---------------- */

export function ReferenceLibrary({
  dictionary,
  settings,
  onInsert,
  onClose,
}: {
  dictionary: Dictionary;
  settings: EngineSettings;
  onInsert: (text: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>("escribir");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  const groups = useMemo(() => {
    const all = [getStructureSnippets(settings, dictionary), ...getOperatorGroups(settings, dictionary)];
    const q = query.trim().toLowerCase();
    return all
      .map((group) => {
        const items: SnippetItem[] = group.items.flatMap((item) =>
          item.variants?.length ? [item, ...item.variants.map((v) => ({ ...v } as SnippetItem))] : [item]
        );
        return {
          ...group,
          items: q
            ? items.filter((item) => `${item.label} ${item.help.title} ${item.help.body}`.toLowerCase().includes(q))
            : group.items,
        };
      })
      .filter((group) => group.items.length > 0);
  }, [dictionary, query, settings]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.14em] text-[#6E7B76] uppercase">Referencia</div>
          <div className="text-[17px] font-semibold text-[#EEF3F0]">Comandos y funciones</div>
        </div>
        <button className="rounded-lg p-1.5 text-[#7F8A85] hover:bg-white/5 hover:text-white" onClick={onClose} type="button">
          <X size={16} />
        </button>
      </div>
      <div className="mx-4 mb-3 flex items-center gap-2 rounded-xl bg-white/[0.05] px-3 py-2 ring-1 ring-white/5 focus-within:ring-[#86F0C4]/40">
        <Search className="text-[#6E7B76]" size={15} />
        <input
          ref={inputRef}
          className="flex-1 bg-transparent text-[14px] text-[#E4EAE7] outline-none placeholder:text-[#5E6A66]"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar: leer, repetir, raíz…"
          value={query}
        />
      </div>
      <div className="proto-scroll flex-1 overflow-auto px-3 pb-6">
        {groups.map((group) => (
          <section key={group.id} className="mb-4">
            <h3 className="px-2 pb-1.5 text-[11px] font-semibold tracking-[0.12em] text-[#5E6A66] uppercase">{group.title}</h3>
            {group.items.map((item) => {
              const open = openId === item.id;
              return (
                <div key={item.id} className={`mb-0.5 rounded-xl ${open ? "bg-white/[0.05]" : ""}`}>
                  <button
                    className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-white/[0.04]"
                    onClick={() => setOpenId(open ? null : item.id)}
                    type="button"
                  >
                    <code className="min-w-[72px] font-mono text-[13px] text-[#8FD9B6]">{item.label}</code>
                    <span className="flex-1 truncate text-[13px] text-[#9AA6A1]">{item.help.title}</span>
                    <ChevronDown className={`text-[#5E6A66] transition-transform ${open ? "rotate-180" : ""}`} size={14} />
                  </button>
                  {open && (
                    <div className="px-3 pb-3">
                      <p className="text-[13px] leading-5 text-[#B5C0BB]">{item.help.body}</p>
                      <pre className="mt-2 overflow-x-auto rounded-lg bg-black/30 px-3 py-2 font-mono text-[12.5px] leading-5 text-[#DCE3E0]">
                        {item.insertText}
                      </pre>
                      <button
                        className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#86F0C4]/15 px-3 py-1 text-[12px] font-medium text-[#A9F5D5] hover:bg-[#86F0C4]/25"
                        onClick={() => onInsert(item.insertText)}
                        type="button"
                      >
                        <CornerDownLeft size={12} /> Insertar en el código
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Language picker (scales to N languages) ---------------- */

interface LanguageEntry {
  id: string;
  name: string;
  family: string;
  hint: string;
}

const LANGUAGE_CATALOG: LanguageEntry[] = [
  { id: "c", name: "C", family: "Familia C", hint: "El clásico de la universidad" },
  { id: "cpp", name: "C++", family: "Familia C", hint: "C con clases y std::string" },
  { id: "java", name: "Java", family: "Familia C", hint: "Orientado a objetos" },
  { id: "csharp", name: "C#", family: "Familia C", hint: ".NET" },
  { id: "javascript", name: "JavaScript", family: "Web y scripting", hint: "Corre en el navegador" },
  { id: "python", name: "Python", family: "Web y scripting", hint: "Ideal para empezar" },
  { id: "php", name: "PHP", family: "Web y scripting", hint: "Servidores web" },
  { id: "pascal", name: "Pascal", family: "Clásicos", hint: "Muy cercano al pseudocódigo" },
  { id: "vb", name: "Visual Basic", family: "Clásicos", hint: "" },
  { id: "qbasic", name: "QBasic", family: "Clásicos", hint: "" },
  { id: "matlab", name: "MatLab", family: "Clásicos", hint: "Cálculo numérico" },
];

const available = (id: string) => id in exportLanguages;

export function LanguagePicker({ value, onChange }: { value: string; onChange: (id: ExportLanguage) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const current = LANGUAGE_CATALOG.find((l) => l.id === value);
  const filtered = LANGUAGE_CATALOG.filter((l) => `${l.name} ${l.family}`.toLowerCase().includes(query.toLowerCase()));
  const families = [...new Set(filtered.map((l) => l.family))];

  return (
    <div className="relative">
      <button
        className="flex items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1.5 text-[13px] text-[#DCE3E0] ring-1 ring-white/5 hover:bg-white/[0.09]"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        Traducir a <b className="font-semibold text-white">{current?.name ?? "…"}</b>
        <ChevronDown size={14} className="text-[#7F8A85]" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-10 right-0 z-50 w-[340px] overflow-hidden rounded-2xl bg-[#181E21] shadow-[0_24px_60px_rgba(0,0,0,0.55)] ring-1 ring-white/10">
            <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2.5">
              <Search className="text-[#6E7B76]" size={15} />
              <input
                autoFocus
                className="flex-1 bg-transparent text-[14px] text-[#E4EAE7] outline-none placeholder:text-[#5E6A66]"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar lenguaje…"
                value={query}
              />
            </div>
            <div className="proto-scroll max-h-[360px] overflow-auto p-1.5">
              {families.map((family) => (
                <div key={family} className="mb-1">
                  <div className="px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-[0.12em] text-[#5E6A66] uppercase">{family}</div>
                  {filtered
                    .filter((l) => l.family === family)
                    .map((l) => {
                      const ok = available(l.id);
                      return (
                        <button
                          key={l.id}
                          className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left ${ok ? "hover:bg-white/[0.05]" : "cursor-default opacity-45"}`}
                          disabled={!ok}
                          onClick={() => {
                            onChange(l.id as ExportLanguage);
                            setOpen(false);
                          }}
                          type="button"
                        >
                          <span className="w-24 text-[14px] font-medium text-[#EEF3F0]">{l.name}</span>
                          <span className="flex-1 truncate text-[12px] text-[#7F8A85]">{ok ? l.hint : "Próximamente"}</span>
                          {l.id === value && <Check className="text-[#86F0C4]" size={15} />}
                        </button>
                      );
                    })}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function TranslationPane({ source, settings, language }: { source: string; settings: EngineSettings; language: ExportLanguage }) {
  const [copied, setCopied] = useState(false);
  const code = useMemo(() => {
    const parsed = new Parser(source, { settings }).parse();
    return parsed.program ? generateExport(parsed.program, language, { settings }).code : null;
  }, [language, settings, source]);
  return (
    <div className="relative h-full">
      <button
        className="absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 text-[12px] text-[#B5C0BB] hover:bg-white/10"
        onClick={() => {
          if (code) void navigator.clipboard?.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        type="button"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copiado" : "Copiar"}
      </button>
      <pre className="proto-scroll h-full overflow-auto px-6 py-5 font-mono text-[13px] leading-6 text-[#CFD8D4]">
        {code ?? "Corrige los errores para ver la traducción."}
      </pre>
    </div>
  );
}

/* ---------------- Console ---------------- */

export function PlayerConsole({ player }: { player: Player }) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const asking = player.status === "input" && !player.scrubbing;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
    if (asking) inputRef.current?.focus();
  }, [player.consoleLines.length, asking]);

  return (
    <div className="proto-scroll h-full overflow-auto px-5 py-4 font-mono text-[14px] leading-7 text-[#DCE3E0]">
      {player.consoleLines.length === 0 && !asking && (
        <p className="font-sans text-[13px] text-[#5E6A66]">Aquí aparecerá lo que tu programa escriba.</p>
      )}
      {player.consoleLines.map((line, index) =>
        line.kind === "in" ? (
          <div key={index} className="flex justify-end">
            <span className="my-0.5 rounded-full bg-[#86F0C4]/15 px-3 text-[#A9F5D5]">{line.text}</span>
          </div>
        ) : line.kind === "sys" ? (
          <div key={index} className="mt-1 font-sans text-[12px] text-[#5E6A66]">
            {line.text}
          </div>
        ) : line.kind === "err" ? (
          <div key={index} className="mt-2 rounded-lg bg-[#F08A6C]/10 px-3 py-2 font-sans text-[13px] text-[#F5A68E]">
            {line.text}
          </div>
        ) : (
          <div key={index} className="whitespace-pre-wrap">
            {line.text || " "}
          </div>
        )
      )}
      {asking && (
        <form
          className="mt-1 flex justify-end"
          onSubmit={(event) => {
            event.preventDefault();
            player.submitInput(draft);
            setDraft("");
          }}
        >
          <div className="flex items-center gap-2 rounded-full bg-[#86F0C4]/10 px-3 py-0.5 ring-1 ring-[#86F0C4]/60 shadow-[0_0_24px_rgba(134,240,196,0.18)]">
            <input
              ref={inputRef}
              className="w-44 bg-transparent font-mono text-[#EEF3F0] outline-none placeholder:text-[#5E8A78]"
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Tu respuesta…"
              value={draft}
            />
            <CornerDownLeft className="text-[#86F0C4]" size={13} />
          </div>
        </form>
      )}
      <div ref={endRef} />
    </div>
  );
}
