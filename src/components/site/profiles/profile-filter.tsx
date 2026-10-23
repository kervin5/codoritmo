"use client";

// Narrows the server-rendered profile list as you type. The list itself stays
// in the HTML (crawlers and no-JS readers see every link); this only hides
// items, and empty letter groups, that don't match.

import { Search } from "lucide-react";
import { useState } from "react";

import { formatPlural } from "@/src/i18n/format";

import { normalizeProfileSearch as normalize } from "./search";

export default function ProfileFilter({
  listId,
  label,
  placeholder,
  empty,
  count,
}: {
  listId: string;
  label: string;
  placeholder: string;
  empty: string;
  count: { one: string; other: string };
}) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<number | null>(null);

  function filter(value: string) {
    setQuery(value);
    const root = document.getElementById(listId);
    if (!root) return;
    const terms = normalize(value).split(/\s+/).filter(Boolean);
    let shown = 0;
    root.querySelectorAll<HTMLElement>("[data-profile-group]").forEach((group) => {
      let visible = 0;
      group.querySelectorAll<HTMLElement>("[data-profile-search]").forEach((item) => {
        const text = item.dataset.profileSearch ?? "";
        const match = terms.every((term) => text.includes(term));
        item.hidden = !match;
        if (match) visible += 1;
      });
      group.hidden = visible === 0;
      shown += visible;
    });
    setMatches(terms.length ? shown : null);
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-white/85" htmlFor={`${listId}-filter`}>
        {label}
      </label>
      <div className="flex h-10 max-w-[480px] items-center gap-2 rounded-lg border border-white/[0.1] bg-black/20 px-3 focus-within:border-[var(--accent-soft)]">
        <Search aria-hidden="true" className="shrink-0 text-white/40" size={15} />
        <input
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/35"
          id={`${listId}-filter`}
          onChange={(event) => filter(event.target.value)}
          placeholder={placeholder}
          type="search"
          value={query}
        />
      </div>
      <p aria-live="polite" className="min-h-5 text-xs text-[var(--muted)]">
        {matches === null ? "" : matches === 0 ? empty : formatPlural(count, matches)}
      </p>
    </div>
  );
}
