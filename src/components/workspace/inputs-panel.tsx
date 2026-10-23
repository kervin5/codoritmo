"use client";

// The console's answer list: answers for Leer written ahead of time (one
// per line), loaded from or saved to a .txt file, as PSeInt allows. A run
// uses them in order, then falls back to asking in the console.

import { Download, ListChecks, Upload, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { formatMessage, formatPlural } from "@/src/i18n/format";
import type { Dictionary } from "@/src/i18n/types";
import { duration, easeOut, spring } from "@/src/lib/motion";
import { decodeProgramFile, downloadText } from "./documents";
import { inputListFileName, parseInputList, serializeInputList } from "./inputs-list";

export function InputListControl({
  text,
  onChange,
  documentName,
  usage,
  dictionary,
}: {
  text: string;
  onChange: (text: string) => void;
  documentName: string;
  /** Answers taken from the list during the current run, if one is going. */
  usage: { used: number; total: number } | null;
  dictionary: Dictionary;
}) {
  const t = dictionary.studio.inputList;
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const count = parseInputList(text).length;

  // Close on Escape or a click outside, like a menu.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const label =
    usage && usage.total > 0
      ? formatMessage(t.used, { used: usage.used, total: usage.total })
      : count > 0
        ? formatPlural(t.count, count)
        : t.button;

  return (
    <div ref={rootRef} className="relative h-full font-sans [&>*]:pointer-events-auto">
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] whitespace-nowrap transition-colors ${
          count > 0 ? "bg-white/[0.08] text-[#DCE3E0] hover:bg-white/[0.12]" : "text-[#8E9A95] hover:bg-white/[0.06] hover:text-[#DCE3E0]"
        }`}
        onClick={() => setOpen((value) => !value)}
        title={t.title}
        type="button"
      >
        <ListChecks size={13} /> {label}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            animate={{ opacity: 1, y: 0, scale: 1 }}
            aria-label={t.title}
            className="absolute top-9 right-0 bottom-0 z-30 flex max-h-[300px] w-[min(320px,calc(100vw-32px))] origin-top-right flex-col gap-2.5 rounded-[16px] bg-[#1E2326] p-3 shadow-[0_12px_32px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.06]"
            exit={{ opacity: 0, scale: 0.97, transition: { duration: duration.fast, ease: easeOut } }}
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            role="dialog"
            transition={spring.smooth}
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-medium text-white/90">{t.title}</p>
                <p className="mt-0.5 text-[12px] leading-[17px] text-white/45">{t.body}</p>
              </div>
              <button
                aria-label={t.close}
                className="-mt-0.5 -mr-0.5 rounded-full p-1 text-white/35 hover:bg-white/[0.06] hover:text-white/80"
                onClick={() => setOpen(false)}
                type="button"
              >
                <X size={14} />
              </button>
            </div>
            <textarea
              aria-label={t.title}
              autoFocus
              className="workspace-scroll min-h-[48px] w-full flex-1 resize-none rounded-[10px] bg-black/25 px-3 py-2 font-mono text-[13px] leading-6 text-[#EEF3F0] caret-[#86F0C4] outline-none placeholder:text-white/20 focus:bg-black/35"
              onChange={(event) => onChange(event.target.value)}
              placeholder={t.placeholder}
              spellCheck={false}
              value={text}
            />
            <div className="flex flex-wrap items-center gap-1">
              <button
                className="flex h-7 items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 text-[12px] text-[#DCE3E0] hover:bg-white/[0.1]"
                onClick={() => fileRef.current?.click()}
                type="button"
              >
                <Upload size={12} /> {t.load}
              </button>
              <button
                className="flex h-7 items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 text-[12px] text-[#DCE3E0] hover:bg-white/[0.1] disabled:opacity-40"
                disabled={count === 0}
                onClick={() => downloadText(inputListFileName(documentName, t.fileSuffix), serializeInputList(text))}
                type="button"
              >
                <Download size={12} /> {t.save}
              </button>
              <span className="ml-auto text-[11.5px] text-white/35">{count > 0 && formatPlural(t.count, count)}</span>
              {count > 0 && (
                <button
                  className="flex h-7 items-center rounded-full px-2.5 text-[12px] text-[#8E9A95] hover:bg-white/[0.06] hover:text-[#DCE3E0]"
                  onClick={() => onChange("")}
                  type="button"
                >
                  {t.clear}
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              accept=".txt,text/plain"
              className="hidden"
              data-testid="input-list-file"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                onChange(decodeProgramFile(new Uint8Array(await file.arrayBuffer())));
              }}
              type="file"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
