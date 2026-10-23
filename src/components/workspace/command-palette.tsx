"use client";

// ⌘K palette: one search box for every menu action and every reference
// entry. ↑/↓ to move, Enter to run, Esc to close.

import { BookOpen, Command, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { Menu, MenuItem } from "./menu-bar";
import type { ReferenceEntry } from "./reference-panel";

interface PaletteRow {
  key: string;
  kind: "action" | "reference";
  label: string;
  path: string;
  shortcut?: string;
  run: () => void;
}

const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function flatten(menus: Menu[]): PaletteRow[] {
  const rows: PaletteRow[] = [];
  const walk = (items: MenuItem[], path: string) => {
    for (const item of items) {
      if (item.separator || item.disabled || !item.label) continue;
      if (item.submenu) walk(item.submenu, `${path} › ${item.label}`);
      else if (item.onSelect)
        rows.push({ key: `${path}/${item.label}`, kind: "action", label: item.label, path, shortcut: item.shortcut, run: item.onSelect });
    }
  };
  for (const menu of menus) walk(menu.items, menu.label);
  return rows;
}

export function CommandPalette({
  menus,
  reference,
  onPickReference,
  onClose,
  text,
  initialQuery = "",
}: {
  initialQuery?: string;
  text: { placeholder: string; actions: string; noResults: string; referencePath: string };
  menus: Menu[];
  reference: ReferenceEntry[];
  onPickReference: (entry: ReferenceEntry) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
    const all: PaletteRow[] = [
      ...flatten(menus),
      ...reference.map((entry) => ({
        key: `ref-${entry.id}`,
        kind: "reference" as const,
        label: entry.label,
        path: `${text.referencePath} › ${entry.title}`,
        run: () => onPickReference(entry),
      })),
    ];
    const q = normalize(query.trim());
    if (!q) return all.filter((r) => r.kind === "action").slice(0, 12);
    return all
      .map((row) => {
        const label = normalize(row.label);
        const score = label.startsWith(q) ? 0 : label.includes(q) ? 1 : normalize(row.path).includes(q) ? 2 : -1;
        return { row, score };
      })
      .filter((x) => x.score >= 0)
      .sort((a, b) => a.score - b.score)
      .slice(0, 40)
      .map((x) => x.row);
  }, [menus, onPickReference, query, reference, text.referencePath]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (row: PaletteRow | undefined) => {
    if (!row) return;
    onClose();
    requestAnimationFrame(row.run);
  };

  return (
    <div className="codoritmo-fade-in fixed inset-0 z-[300] flex justify-center bg-black/30 pt-[14vh]" onMouseDown={onClose}>
      <div
        className="codoritmo-dialog-in h-fit w-[600px] overflow-hidden rounded-[12px] border border-white/[0.1] bg-[#23282B]/[0.94] shadow-[0_30px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex h-[48px] items-center gap-3 border-b border-white/[0.07] px-4">
          <Search className="text-white/40" size={17} />
          <input
            autoFocus
            className="flex-1 bg-transparent text-[16px] text-white outline-none placeholder:text-white/30"
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((a) => Math.min(rows.length - 1, a + 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (event.key === "Enter") {
                event.preventDefault();
                choose(rows[active]);
              } else if (event.key === "Escape") {
                event.preventDefault();
                onClose();
              }
            }}
            placeholder={text.placeholder}
            value={query}
          />
          <kbd className="rounded-[4px] border border-white/10 px-1.5 text-[11px] text-white/40">esc</kbd>
        </div>
        <div ref={listRef} className="proto-scroll max-h-[380px] overflow-auto p-1.5">
          {!query && <div className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-[0.08em] text-white/35 uppercase">{text.actions}</div>}
          {rows.length === 0 && <div className="px-3 py-6 text-center text-[13px] text-white/40">{text.noResults}</div>}
          {rows.map((row, index) => (
            <div
              key={row.key}
              className={`flex h-[34px] cursor-default items-center gap-3 rounded-[7px] px-2.5 text-[13.5px] ${
                index === active ? "bg-[#2F8F6E] text-white" : "text-white/85"
              }`}
              data-index={index}
              onClick={() => choose(row)}
              onMouseMove={() => setActive(index)}
            >
              {row.kind === "reference" ? (
                <BookOpen className={index === active ? "text-white" : "text-[#8FE3BE]"} size={15} />
              ) : (
                <Command className={index === active ? "text-white" : "text-white/40"} size={15} />
              )}
              <span className={row.kind === "reference" ? "font-mono" : ""}>{row.label}</span>
              <span className={`flex-1 truncate text-[12px] ${index === active ? "text-white/75" : "text-white/35"}`}>{row.path}</span>
              {row.shortcut && <span className={`text-[12px] ${index === active ? "text-white/85" : "text-white/40"}`}>{row.shortcut}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
