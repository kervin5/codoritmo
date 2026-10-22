"use client";

// PROTOTYPE — three radically different layouts for the Codoritmo workspace,
// switchable via ?variant=A|B|C on the existing home route. Throwaway: the
// winner gets rebuilt properly inside playground.tsx.

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { engineProfiles, type EngineSettings } from "@/src/engine";
import type { Dictionary } from "@/src/i18n/types";
import { ProtoStyles } from "./prototype-parts";
import { SAMPLE_PROGRAM, usePrototypeRun, type PrototypeRun } from "./use-prototype-run";
import VariantA from "./variant-a-studio";
import VariantB from "./variant-b-notebook";
import VariantC from "./variant-c-dual";
import VariantD from "./variant-d-player";
import VariantE from "./variant-e-native";

export interface VariantProps {
  dictionary: Dictionary;
  source: string;
  setSource: (value: string) => void;
  settings: EngineSettings;
  profileId: string;
  setProfileId: (id: string) => void;
  run: PrototypeRun;
}

const variants = [
  { key: "E", name: "Nativo", Component: VariantE },
  { key: "D", name: "Reproductor", Component: VariantD },
  { key: "A", name: "Estudio", Component: VariantA },
  { key: "B", name: "Cuaderno", Component: VariantB },
  { key: "C", name: "Doble vista", Component: VariantC },
] as const;

export const prototypeProfiles = engineProfiles.slice(0, 4);

export default function PrototypeRoot({ dictionary, variant }: { dictionary: Dictionary; variant: string }) {
  const [source, setSource] = useState(SAMPLE_PROGRAM);
  const [profileId, setProfileId] = useState(prototypeProfiles[0].id);
  const settings = (prototypeProfiles.find((p) => p.id === profileId) ?? prototypeProfiles[0]).settings;
  const run = usePrototypeRun(source, settings);
  const index = Math.max(0, variants.findIndex((v) => v.key === variant.toUpperCase()));
  const current = variants[index];

  return (
    <>
      <ProtoStyles />
      <current.Component
        dictionary={dictionary}
        profileId={profileId}
        run={run}
        setProfileId={setProfileId}
        setSource={setSource}
        settings={settings}
        source={source}
      />
      {process.env.NODE_ENV !== "production" && <PrototypeSwitcher index={index} />}
    </>
  );
}

function PrototypeSwitcher({ index }: { index: number }) {
  const router = useRouter();
  const go = (delta: number) => {
    const next = variants[(index + delta + variants.length) % variants.length];
    router.replace(`?variant=${next.key}`, { scroll: false });
  };
  const goRef = useRef(go);
  goRef.current = go;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = (event.target instanceof Element ? event.target : document.body) as HTMLElement;
      if (target.closest("input, textarea, [contenteditable], .monaco-editor")) return;
      if (!event.altKey) return; // Alt+←/→ so plain arrows stay free for the app
      if (event.key === "ArrowLeft") goRef.current(-1);
      if (event.key === "ArrowRight") goRef.current(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="fixed right-4 bottom-[118px] z-[100] scale-90 opacity-80 hover:opacity-100 flex items-center gap-1 rounded-full bg-[#FF3D7F] p-1 text-white shadow-[0_8px_30px_rgba(255,61,127,0.45)]">
      <button className="rounded-full px-2.5 py-1 hover:bg-white/20" onClick={() => go(-1)} type="button">
        ←
      </button>
      <span className="px-1 text-[12px] font-semibold tracking-wide">
        PROTOTIPO {variants[index].key} · {variants[index].name}
      </span>
      <button className="rounded-full px-2.5 py-1 hover:bg-white/20" onClick={() => go(1)} type="button">
        →
      </button>
    </div>
  );
}

/* Shared profile picker: a chip that says what rules apply, not a form. */
export function ProfileChip({
  profileId,
  setProfileId,
  dark,
}: {
  profileId: string;
  setProfileId: (id: string) => void;
  dark?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const active = prototypeProfiles.find((p) => p.id === profileId) ?? prototypeProfiles[0];
  const short = (id: string) =>
    ({ "desktop-default": "Flexible", estricto: "Estricto" } as Record<string, string>)[id] ?? id;

  return (
    <div className="relative">
      <button
        className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] ${
          dark ? "bg-white/8 text-[#C9D2CD] hover:bg-white/12" : "border border-[#E1E1DA] bg-white text-[#3C4641] hover:bg-[#F7F7F3]"
        }`}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[#1F7A5C]" />
        Perfil: <b className="font-medium">{short(active.id)}</b>
        <span className="opacity-60">▾</span>
      </button>
      {open && (
        <div
          className={`absolute right-0 z-50 mt-2 w-72 rounded-xl p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.14)] ${
            dark ? "border border-white/10 bg-[#1B2124] text-[#E8EDEA]" : "border border-[#E5E5DF] bg-white"
          }`}
        >
          {prototypeProfiles.map((profile) => (
            <button
              key={profile.id}
              className={`block w-full rounded-lg px-3 py-2 text-left ${
                profile.id === profileId ? (dark ? "bg-white/8" : "bg-[#F1F6F3]") : dark ? "hover:bg-white/5" : "hover:bg-[#F7F7F3]"
              }`}
              onClick={() => {
                setProfileId(profile.id);
                setOpen(false);
              }}
              type="button"
            >
              <div className="text-[13px] font-medium">{short(profile.id)}</div>
              <div className="text-[12px] opacity-60">{profile.description}</div>
            </button>
          ))}
          <div className={`mt-1 border-t px-3 py-2 text-[12px] opacity-60 ${dark ? "border-white/10" : "border-[#EEEEE8]"}`}>
            + 463 perfiles de instituciones · Personalizar…
          </div>
        </div>
      )}
    </div>
  );
}

export function useRunShortcuts(run: PrototypeRun) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        if (run.active) run.stop();
        else run.run();
      }
      if (event.key === "F10") {
        event.preventDefault();
        if (run.mode === "paused") run.step();
        else if (!run.active) run.debug();
      }
      if (event.key === "Escape" && run.active) run.stop();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [run]);
}
