"use client";

import { useEffect, type ReactNode } from "react";

import { AppIcon } from "./ui";

interface BottomSheetProps {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export default function BottomSheet({
  children,
  isOpen,
  onClose,
  title,
}: BottomSheetProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-[rgba(43,36,28,0.32)] backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />

      <div
        className="relative flex w-full max-h-[85svh] flex-col overflow-hidden rounded-t-[28px] border-t border-[var(--line)] bg-[rgba(251,248,241,0.99)] shadow-[0_-20px_48px_rgba(43,36,28,0.14)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex shrink-0 justify-center pb-1 pt-3">
          <div className="h-1 w-12 rounded-full bg-[rgba(43,36,28,0.18)]" />
        </div>

        {title ? (
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--line)] px-5 py-3">
            <h2 className="text-base font-semibold text-[var(--foreground)]">
              {title}
            </h2>
            <button
              aria-label="Close"
              className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] text-[var(--muted)] transition hover:bg-[rgba(43,36,28,0.06)] hover:text-[var(--foreground)]"
              onClick={onClose}
              type="button"
            >
              <AppIcon className="h-4 w-4" name="close" />
            </button>
          </div>
        ) : null}

        <div
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain"
          style={{ touchAction: "pan-y" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
