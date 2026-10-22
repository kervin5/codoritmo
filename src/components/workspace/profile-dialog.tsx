"use client";

// Language profile picker: every built-in and school profile, searchable,
// beside the rules it sets — each rule can be tweaked for this document.

import { Check, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { editableEngineSettingDefinitions, engineProfiles, type EngineSettings } from "@/src/engine";
import { generatedProfiles } from "@/src/engine/school-profiles";
import { localizeSettingDefinition } from "@/src/i18n/helpers";
import type { Dictionary } from "@/src/i18n/types";

const GROUPS: { id: string; keys: (keyof EngineSettings)[] }[] = [
  { id: "typing", keys: ["forceDefineVars", "forceInitVars", "protectForCounter"] },
  { id: "arrays", keys: ["baseZeroArrays", "allowDynamicDimensions", "allowResizeArrays", "allowForEach", "deduceNegativeForStep"] },
  {
    id: "syntax",
    keys: ["overloadEqual", "colloquialConditions", "lazySyntax", "wordOperators", "forceSemicolon", "allowRepeatWhile", "allowAccents", "integerOnlySwitch"],
  },
  { id: "functions", keys: ["allowConcatenation", "enableUserFunctions", "enableStringFunctions"] },
];

/** engineProfiles lists the general profiles first, then the school ones. */
const BUILT_IN_COUNT = engineProfiles.length - generatedProfiles.length;

export function profileLabel(profileId: string, dictionary: Dictionary): string {
  const profile = engineProfiles.find((p) => p.id === profileId);
  return dictionary.profileDrawer.profiles[profileId]?.label ?? profile?.label ?? profileId;
}

export function ProfileDialog({
  dictionary,
  profileId,
  settings,
  customized,
  onPickProfile,
  onToggle,
  onClose,
}: {
  dictionary: Dictionary;
  profileId: string;
  settings: EngineSettings;
  customized: boolean;
  onPickProfile: (id: string) => void;
  onToggle: (key: keyof EngineSettings, value: boolean) => void;
  onClose: () => void;
}) {
  const t = dictionary.studio.profiles;
  const [query, setQuery] = useState("");
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "center" });
  }, []);

  const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return engineProfiles
      .map((profile, index) => ({ profile, index }))
      .filter(({ profile }) => !q || normalize(`${profile.label} ${profile.description}`).includes(q));
  }, [query]);

  const definitions = new Map(editableEngineSettingDefinitions.map((d) => [d.key, d]));

  return (
    <div className="fixed inset-0 z-[300] grid place-items-center bg-black/45 p-4" onMouseDown={onClose}>
      <div
        className="flex h-[min(640px,90vh)] w-[min(920px,96vw)] flex-col overflow-hidden rounded-[12px] border border-white/10 bg-[#1F2427] text-[#E6ECE9] shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-label={t.title}
      >
        <div className="flex h-[44px] shrink-0 items-center justify-between border-b border-white/[0.07] px-4">
          <span className="text-[14px] font-semibold">{t.title}</span>
          <button aria-label={t.done} className="rounded p-1 text-white/45 hover:text-white" onClick={onClose} type="button">
            <X size={15} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          {/* Profiles */}
          <div className="flex min-h-0 flex-1 flex-col border-white/[0.07] sm:max-w-[360px] sm:border-r">
            <div className="p-3">
              <div className="flex h-[30px] items-center gap-2 rounded-[7px] border border-white/[0.08] bg-black/20 px-2.5 focus-within:border-[#4FB892]/70">
                <Search className="text-white/35" size={13} />
                <input
                  autoFocus
                  className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-white/30"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t.search}
                  value={query}
                />
              </div>
            </div>
            <div className="workspace-scroll min-h-0 flex-1 overflow-auto px-2 pb-3">
              {[
                [t.builtIn, filtered.filter((x) => x.index < BUILT_IN_COUNT)],
                [t.schools, filtered.filter((x) => x.index >= BUILT_IN_COUNT)],
              ].map(([title, items]) =>
                (items as typeof filtered).length ? (
                  <div key={title as string} className="mb-2">
                    <div className="px-2 pt-2 pb-1 text-[11px] font-semibold tracking-[0.06em] text-white/35 uppercase">
                      {title as string} · {(items as typeof filtered).length}
                    </div>
                    {(items as typeof filtered).map(({ profile }) => {
                      const active = profile.id === profileId;
                      return (
                        <button
                          key={profile.id}
                          ref={active ? activeRef : undefined}
                          className={`flex w-full cursor-default items-start gap-2 rounded-[6px] px-2 py-1.5 text-left ${active ? "bg-[#2F8F6E] text-white" : "hover:bg-white/[0.05]"}`}
                          onClick={() => onPickProfile(profile.id)}
                          type="button"
                        >
                          <span className="mt-0.5 w-3.5 shrink-0">{active && <Check size={13} strokeWidth={2.5} />}</span>
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-medium">{profileLabel(profile.id, dictionary)}</span>
                            <span className={`line-clamp-2 text-[11.5px] ${active ? "text-white/75" : "text-white/40"}`}>
                              {dictionary.profileDrawer.profiles[profile.id]?.description ?? profile.description}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null
              )}
            </div>
          </div>

          {/* Rules */}
          <div className="workspace-scroll min-h-0 flex-1 overflow-auto border-t border-white/[0.07] p-4 sm:border-t-0">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <div className="text-[12px] font-semibold tracking-[0.06em] text-white/45 uppercase">{t.settings}</div>
              <div className="truncate text-[12px] text-white/45">
                {profileLabel(profileId, dictionary)}
                {customized && ` · ${dictionary.workspace.customProfile}`}
              </div>
            </div>
            {GROUPS.map((group) => (
              <section key={group.id} className="mb-4">
                <h3 className="mb-1.5 text-[12.5px] font-semibold text-white/80">{dictionary.profileDrawer.groups[group.id] ?? group.id}</h3>
                {group.keys.map((key) => {
                  const definition = definitions.get(key);
                  if (!definition) return null;
                  const copy = localizeSettingDefinition(definition, dictionary);
                  const forced = key === "wordOperators" && settings.colloquialConditions;
                  return (
                    <label
                      key={key}
                      className={`flex cursor-default items-start justify-between gap-4 rounded-[7px] px-2 py-2 ${forced ? "opacity-50" : "hover:bg-white/[0.03]"}`}
                    >
                      <span className="min-w-0">
                        <span className="block text-[13px] text-white/90">{copy.label}</span>
                        <span className="block text-[11.5px] leading-[17px] text-white/45">{copy.description}</span>
                      </span>
                      <input
                        checked={settings[key]}
                        className="peer sr-only"
                        disabled={forced}
                        onChange={(event) => onToggle(key, event.target.checked)}
                        type="checkbox"
                      />
                      <span
                        aria-hidden
                        className={`relative mt-0.5 h-[18px] w-[30px] shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[#4FB892] ${settings[key] ? "bg-[#2F8F6E]" : "bg-white/15"}`}
                      >
                        <span
                          className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-transform ${settings[key] ? "translate-x-[14px]" : "translate-x-[2px]"}`}
                        />
                      </span>
                    </label>
                  );
                })}
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
