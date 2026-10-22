"use client";

// PROTOTYPE — a desktop-style menu bar. Behaves like native menus:
// opens on mousedown, hovering another title while open switches menus,
// ←/→ move between menus, ↑/↓ move items, Enter activates, Esc closes,
// submenus open on hover or →. Shortcuts are displayed, not bound here.

import { Check, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface MenuItem {
  label?: string;
  shortcut?: string;
  onSelect?: () => void;
  disabled?: boolean;
  checked?: boolean;
  separator?: boolean;
  submenu?: MenuItem[];
  hint?: string;
}

export interface Menu {
  label: string;
  items: MenuItem[];
}

const actionable = (item: MenuItem) => !item.separator && !item.disabled;

export function MenuBar({ menus, leading, trailing }: { menus: Menu[]; leading?: React.ReactNode; trailing?: React.ReactNode }) {
  const [open, setOpen] = useState<number | null>(null);
  const [active, setActive] = useState<number>(-1);
  const [sub, setSub] = useState<{ index: number; active: number } | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(null);
    setActive(-1);
    setSub(null);
  };

  const run = (item: MenuItem) => {
    if (!actionable(item) || item.submenu) return;
    close();
    // Let the menu close before the action (e.g. a file dialog) takes focus.
    requestAnimationFrame(() => item.onSelect?.());
  };

  useEffect(() => {
    if (open === null) return;
    const onDown = (event: MouseEvent) => {
      if (!barRef.current?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      const items = menus[open].items;
      const move = (list: MenuItem[], from: number, dir: number) => {
        for (let step = 1; step <= list.length; step += 1) {
          const index = (from + dir * step + list.length * 4) % list.length;
          if (actionable(list[index])) return index;
        }
        return from;
      };
      if (event.key === "Escape") {
        event.preventDefault();
        if (sub) setSub(null);
        else close();
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const dir = event.key === "ArrowDown" ? 1 : -1;
        if (sub) setSub({ ...sub, active: move(items[sub.index].submenu!, sub.active, dir) });
        else setActive((current) => move(items, current, dir));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        const item = items[active];
        if (!sub && item?.submenu) setSub({ index: active, active: move(item.submenu, -1, 1) });
        else {
          setSub(null);
          setActive(-1);
          setOpen((open + 1) % menus.length);
        }
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (sub) setSub(null);
        else {
          setActive(-1);
          setOpen((open - 1 + menus.length) % menus.length);
        }
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (sub) run(items[sub.index].submenu![sub.active]);
        else if (items[active]?.submenu) setSub({ index: active, active: move(items[active].submenu!, -1, 1) });
        else if (items[active]) run(items[active]);
      }
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  });

  return (
    <div ref={barRef} className="flex h-full items-center gap-0.5">
      {leading}
      {menus.map((menu, index) => (
        <div key={menu.label} className="relative">
          <button
            className={`h-[26px] rounded-[5px] px-2.5 text-[13px] ${open === index ? "bg-white/[0.12] text-white" : "text-[#C9D1CD] hover:bg-white/[0.06]"}`}
            onMouseDown={(event) => {
              event.preventDefault();
              if (open === index) close();
              else {
                setOpen(index);
                setActive(-1);
                setSub(null);
              }
            }}
            onMouseEnter={() => {
              if (open !== null && open !== index) {
                setOpen(index);
                setActive(-1);
                setSub(null);
              }
            }}
            type="button"
          >
            {menu.label}
          </button>
          {open === index && (
            <MenuPanel
              active={active}
              items={menu.items}
              onActivate={run}
              onHover={(i) => {
                setActive(i);
                const item = menu.items[i];
                setSub(item?.submenu ? { index: i, active: -1 } : null);
              }}
              sub={sub}
              onSubHover={(i) => sub && setSub({ ...sub, active: i })}
            />
          )}
        </div>
      ))}
      {trailing}
    </div>
  );
}

function MenuPanel({
  items,
  active,
  onHover,
  onActivate,
  sub,
  onSubHover,
  nested,
}: {
  items: MenuItem[];
  active: number;
  onHover: (index: number) => void;
  onActivate: (item: MenuItem) => void;
  sub?: { index: number; active: number } | null;
  onSubHover?: (index: number) => void;
  nested?: boolean;
}) {
  return (
    <div
      className={`absolute z-[200] min-w-[248px] rounded-[9px] border border-white/[0.09] bg-[#262B2E]/[0.92] p-[5px] text-[13px] text-[#E6ECE9] shadow-[0_18px_50px_rgba(0,0,0,0.55),0_0_0_0.5px_rgba(0,0,0,0.6)] backdrop-blur-xl ${
        nested ? "top-[-6px] left-full ml-[2px]" : "top-[30px] left-0"
      }`}
      onMouseDown={(event) => event.preventDefault()}
      role="menu"
    >
      {items.map((item, index) =>
        item.separator ? (
          <div key={`sep-${index}`} className="mx-2 my-[5px] h-px bg-white/[0.08]" />
        ) : (
          <div key={`${item.label}-${index}`} className="relative">
            <div
              aria-disabled={item.disabled}
              className={`flex h-[26px] cursor-default items-center gap-2 rounded-[5px] pr-2.5 pl-1.5 ${
                item.disabled ? "text-white/30" : index === active ? "bg-[#2F8F6E] text-white" : ""
              }`}
              onClick={() => onActivate(item)}
              onMouseEnter={() => !item.disabled && onHover(index)}
              role="menuitem"
            >
              <span className="grid w-4 place-items-center">{item.checked && <Check size={13} strokeWidth={2.5} />}</span>
              <span className="flex-1 whitespace-nowrap">{item.label}</span>
              {item.hint && <span className={`text-[11.5px] ${index === active ? "text-white/80" : "text-white/40"}`}>{item.hint}</span>}
              {item.shortcut && (
                <span className={`ml-6 font-sans text-[12.5px] tracking-wide ${index === active ? "text-white/85" : "text-white/40"}`}>
                  {item.shortcut}
                </span>
              )}
              {item.submenu && <ChevronRight className={index === active ? "text-white" : "text-white/45"} size={13} />}
            </div>
            {item.submenu && sub?.index === index && (
              <MenuPanel
                active={sub.active}
                items={item.submenu}
                nested
                onActivate={onActivate}
                onHover={(i) => onSubHover?.(i)}
              />
            )}
          </div>
        )
      )}
    </div>
  );
}
