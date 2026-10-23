"use client";

// The inline editor that opens on a flowchart block: one field per editable
// piece (a condition, the values of an Escribir, a Para's header...). Enter
// commits, Escape cancels; a refused edit says why right under its field.
// Also the small confirm card for deleting a structure that has a body.

import { motion } from "motion/react";
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

import type { FlowEditField, FlowFieldKey } from "@/src/diagram";
import type { Dictionary } from "@/src/i18n/types";
import { formatPlural } from "@/src/i18n/format";
import { spring } from "@/src/lib/motion";

export type FlowEditCopy = Dictionary["flowEdit"];

const CARD =
  "nodrag nopan nowheel cursor-default rounded-[14px] bg-[#1B2124] p-2.5 text-left text-[12px] text-[#DCE4E0] shadow-[0_12px_32px_rgba(0,0,0,0.45),inset_0_0_0_1px_rgba(255,255,255,0.08)]";
const TONAL = "h-7 rounded-full bg-white/[0.07] px-3 text-[12px] text-[#C9D3CF] hover:bg-white/[0.12] focus-visible:outline-2 focus-visible:outline-[#86F0C4]/60";
const PRIMARY = "h-7 rounded-full bg-[#86F0C4] px-3 text-[12px] font-semibold text-[#0D1A14] hover:bg-[#9DF5D1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#86F0C4]";

/**
 * Focuses an element as soon as it can take focus, and keeps it there for a
 * few frames: React Flow keeps a block it has not measured yet hidden (it
 * ignores focus()), and swaps a block whose label changed a frame after the
 * edit, so the first focus can land on the outgoing copy. Returns a cleanup.
 */
export function focusSoon(get: () => HTMLElement | null | undefined, then?: (el: HTMLElement) => void): () => void {
  let frame = 0;
  let tries = 0;
  let stable = 0;
  let focused: HTMLElement | null = null;
  const attempt = () => {
    const el = get();
    if (el && document.activeElement !== el) {
      // Something else took focus on purpose (a click, a key): leave it.
      const active = document.activeElement;
      if (focused && active && active !== document.body && active !== focused) return;
      el.focus({ preventScroll: true });
      if (document.activeElement === el) {
        focused = el;
        stable = 0;
        then?.(el);
      }
    } else if (el) {
      stable += 1;
    }
    if (stable < 8 && (tries += 1) < 60) frame = requestAnimationFrame(attempt);
  };
  attempt();
  return () => cancelAnimationFrame(frame);
}

/** Stops keys from reaching the diagram (arrows, Delete) and React Flow. */
const stop = (event: KeyboardEvent) => event.stopPropagation();

export function FlowEditEditor({
  fields,
  copy,
  error,
  errorField,
  onCommit,
  onCancel,
}: {
  fields: FlowEditField[];
  copy: FlowEditCopy;
  error: string | null;
  errorField?: FlowFieldKey;
  onCommit: (values: Partial<Record<FlowFieldKey, string>>) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f.key, f.value])) as Record<FlowFieldKey, string>);
  const firstRef = useRef<HTMLInputElement>(null);
  const grid = fields.length >= 3;

  useLayoutEffect(
    () =>
      focusSoon(() => firstRef.current, (input) => {
        if (input instanceof HTMLInputElement) input.select();
      }),
    []
  );

  const onKeyDown = (event: KeyboardEvent) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      onCommit(values);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <motion.div
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className={`${CARD} w-[272px]`}
      data-flow-editor=""
      initial={{ opacity: 0, scale: 0.96, y: -4 }}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => event.stopPropagation()}
      role="dialog"
      transition={spring.snappy}
    >
      <div className={grid ? "grid grid-cols-2 gap-2" : "flex flex-col gap-2"}>
        {fields.map((field, index) => {
          const id = `flow-edit-${field.key}`;
          const invalid = !!error && (errorField === field.key || (!errorField && index === 0));
          return (
            <label key={field.key} className="flex min-w-0 flex-col gap-1" htmlFor={id}>
              <span className="text-[11px] font-medium text-[#8E9A95]">
                {copy.fields[field.key]}
                {field.optional && <span className="font-normal text-[#5F6B67]"> · {copy.optional}</span>}
              </span>
              <input
                ref={index === 0 ? firstRef : undefined}
                aria-invalid={invalid || undefined}
                autoCapitalize="off"
                autoComplete="off"
                className={`h-8 min-w-0 rounded-[8px] bg-black/35 px-2 font-mono text-[12.5px] text-[#F0F4F2] outline-none shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] focus:shadow-[inset_0_0_0_1.5px_#86F0C4] ${invalid ? "shadow-[inset_0_0_0_1.5px_#F08A8A]" : ""}`}
                id={id}
                onChange={(event) => setValues((v) => ({ ...v, [field.key]: event.target.value }))}
                spellCheck={false}
                value={values[field.key] ?? ""}
              />
            </label>
          );
        })}
      </div>
      {error && (
        <motion.p
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 rounded-[8px] bg-[#F08A8A]/10 px-2 py-1.5 text-[11.5px] leading-snug text-[#F4B1B1]"
          initial={{ opacity: 0, y: -2 }}
          role="alert"
        >
          {error}
        </motion.p>
      )}
      <div className="mt-2.5 flex justify-end gap-1.5">
        <button className={TONAL} onClick={onCancel} type="button">
          {copy.cancel}
        </button>
        <button className={PRIMARY} onClick={() => onCommit(values)} type="button">
          {copy.done}
        </button>
      </div>
    </motion.div>
  );
}

/** Deleting a structure that has statements inside: all of it, or keep what is inside. */
export function FlowEditConfirmDelete({
  nested,
  copy,
  onDelete,
  onCancel,
}: {
  nested: number;
  copy: FlowEditCopy;
  onDelete: (keepBody: boolean) => void;
  onCancel: () => void;
}) {
  const firstRef = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => focusSoon(() => firstRef.current), []);
  return (
    <motion.div
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className={`${CARD} w-[318px]`}
      initial={{ opacity: 0, scale: 0.96, y: -4 }}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        stop(event);
        if (event.key === "Escape") onCancel();
      }}
      onPointerDown={(event) => event.stopPropagation()}
      role="alertdialog"
      transition={spring.snappy}
    >
      <p className="px-0.5 pb-2 leading-snug text-[#C9D3CF]">{formatPlural(copy.nested, nested)}</p>
      <div className="flex flex-wrap justify-end gap-1.5">
        <button className={TONAL} onClick={onCancel} type="button">
          {copy.cancel}
        </button>
        <button ref={firstRef} className={TONAL} onClick={() => onDelete(true)} type="button">
          {copy.keepBody}
        </button>
        <button className={`${TONAL} text-[#F4B1B1]`} onClick={() => onDelete(false)} type="button">
          {copy.deleteAll}
        </button>
      </div>
    </motion.div>
  );
}
