"use client";

import { useState, useRef, useEffect } from "react";
import { AppIcon, classes } from "./ui";

export function SearchableSelect({
  ariaLabel,
  className,
  disabled = false,
  id,
  label,
  onChange,
  options,
  value,
  visibleLabel = true,
  placeholder = "Search...",
}: {
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
  visibleLabel?: boolean;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div
      className={classes("flex flex-col gap-2", className)}
      ref={containerRef}
    >
      {visibleLabel ? (
        <label
          className="text-[11px] font-medium text-[var(--muted)]"
          htmlFor={id}
        >
          {label}
        </label>
      ) : (
        <label className="sr-only" htmlFor={id}>
          {label}
        </label>
      )}

      <div className={classes("relative", disabled && "opacity-70")}>
        <button
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-label={ariaLabel ?? label}
          className={classes(
            "h-11 w-full appearance-none rounded-[14px] border border-[var(--line)] bg-[rgba(250,246,239,0.96)] pl-4 pr-11 text-left text-sm text-[var(--foreground)] shadow-[0_1px_0_rgba(255,255,255,0.8)_inset] outline-none transition",
            "focus:border-[var(--accent-soft)] focus:bg-white focus:ring-4 focus:ring-[var(--accent-surface)]",
            "disabled:cursor-default disabled:bg-[rgba(241,236,228,0.94)] disabled:text-[var(--muted)]",
            "overflow-hidden text-ellipsis whitespace-nowrap"
          )}
          disabled={disabled}
          id={id}
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) {
              setTimeout(() => inputRef.current?.focus(), 0);
            }
          }}
          type="button"
        >
          {selectedOption?.label || "Select..."}
        </button>

        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[var(--muted)]">
          <AppIcon className="h-4 w-4" name="chevron-down" />
        </span>

        {isOpen && (
          <div className="absolute z-50 mt-2 w-full rounded-[16px] border border-[var(--line)] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
            <div className="p-2">
              <input
                className="h-9 w-full rounded-[10px] border border-[var(--line)] bg-[rgba(250,246,239,0.5)] px-3 text-sm outline-none transition focus:border-[var(--accent-soft)] focus:bg-white focus:ring-2 focus:ring-[var(--accent-surface)]"
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={placeholder}
                ref={inputRef}
                type="text"
                value={searchQuery}
              />
            </div>

            <div className="max-h-[300px] overflow-y-auto overscroll-contain">
              {filteredOptions.length === 0 ? (
                <div className="px-4 py-3 text-sm text-[var(--muted)]">
                  No results found
                </div>
              ) : (
                <ul className="py-1" role="listbox">
                  {filteredOptions.map((option) => (
                    <li key={option.value}>
                      <button
                        className={classes(
                          "w-full px-4 py-2.5 text-left text-sm transition hover:bg-[var(--accent-surface)]",
                          option.value === value &&
                            "bg-[var(--accent-surface)] font-medium"
                        )}
                        onClick={() => handleSelect(option.value)}
                        role="option"
                        type="button"
                      >
                        {option.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
