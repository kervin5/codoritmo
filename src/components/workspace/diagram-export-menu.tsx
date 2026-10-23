"use client";

// Quick export from the Diagrama panel: copy the diagram as an image (to paste
// into a document or a class assignment) or download it as PNG or SVG,
// without going through the File menu. Exports whatever the panel shows.

import { Copy, Download, FileImage, Image as ImageIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { spring } from "@/src/lib/motion";

export interface DiagramExportLabels {
  button: string;
  copy: string;
  copyHint: string;
  png: string;
  pngHint: string;
  svg: string;
  svgHint: string;
}

export function DiagramExportMenu({
  labels,
  onCopy,
  onDownload,
}: {
  labels: DiagramExportLabels;
  onCopy: () => void;
  onDownload: (format: "png" | "svg") => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  const items = [
    { id: "copy", icon: Copy, label: labels.copy, hint: labels.copyHint, run: onCopy },
    { id: "png", icon: ImageIcon, label: labels.png, hint: labels.pngHint, run: () => onDownload("png") },
    { id: "svg", icon: FileImage, label: labels.svg, hint: labels.svgHint, run: () => onDownload("svg") },
  ];

  return (
    <div ref={rootRef} className="relative">
      <motion.button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={labels.button}
        className={`flex h-[24px] items-center gap-1.5 rounded-[6px] px-2 text-[12px] transition-colors ${
          open ? "bg-white/[0.09] text-white" : "text-white/50 hover:bg-white/[0.05] hover:text-white/85"
        }`}
        onClick={() => setOpen((v) => !v)}
        title={labels.button}
        type="button"
        whileTap={{ scale: 0.95 }}
      >
        <Download size={13} />
        <span>{labels.button}</span>
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="absolute top-[calc(100%+6px)] right-0 z-40 w-[248px] origin-top-right rounded-[12px] bg-[#2B3134] p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.08]"
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            role="menu"
            transition={spring.snappy}
          >
            {items.map(({ id, icon: Icon, label, hint, run }) => (
              <button
                key={id}
                className="flex w-full items-start gap-2.5 rounded-[8px] px-2.5 py-2 text-left transition-colors hover:bg-white/[0.07] focus-visible:bg-white/[0.07] focus-visible:outline-none"
                onClick={() => {
                  setOpen(false);
                  run();
                }}
                role="menuitem"
                type="button"
              >
                <Icon className="mt-0.5 shrink-0 text-white/60" size={14} />
                <span>
                  <span className="block text-[12.5px] text-white/90">{label}</span>
                  <span className="block text-[11.5px] leading-[16px] text-white/45">{hint}</span>
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
