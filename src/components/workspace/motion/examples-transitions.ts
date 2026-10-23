// Imperative transitions for the example library. The workspace mounts the
// browser with `{examplesOpen && …}`, so the dialog vanishes the instant it
// closes. To still show where it goes, these helpers snapshot the DOM into
// inert, fixed-position clones on <body> and animate those, while the real
// dialog unmounts and the workspace stays fully interactive underneath.
//
// Nothing runs without the Web Animations API (jsdom) or with reduced motion
// beyond a plain fade, so tests never see duplicated text.

import { animate, spring as springGenerator } from "motion/react";

import { duration, easeOut, prefersReducedMotion, spring } from "@/src/lib/motion";

/** jsdom has no Element.animate: skip every clone there. */
function canAnimate(): boolean {
  return typeof document !== "undefined" && typeof document.body?.animate === "function";
}

/** A fixed, inert overlay that removes itself once its animations settle. */
function createLayer(): HTMLDivElement {
  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.setAttribute("inert", "");
  layer.dataset.examplesGhost = "";
  Object.assign(layer.style, { position: "fixed", inset: "0", zIndex: "300", pointerEvents: "none" });
  document.body.appendChild(layer);
  return layer;
}

/** Copies scroll offsets and input values, which cloneNode leaves behind. */
function copyLiveState(source: HTMLElement, clone: HTMLElement) {
  const from = source.querySelectorAll<HTMLElement>("*");
  const to = clone.querySelectorAll<HTMLElement>("*");
  from.forEach((element, index) => {
    const target = to[index];
    if (!target) return;
    if (element.scrollTop || element.scrollLeft) {
      target.scrollTop = element.scrollTop;
      target.scrollLeft = element.scrollLeft;
    }
    if (element instanceof HTMLInputElement && target instanceof HTMLInputElement) target.value = element.value;
    // Animated values live in the animation, not the inline style: bake them in.
    if (element.getAnimations?.().length) {
      const computed = getComputedStyle(element);
      target.style.opacity = computed.opacity;
      target.style.transform = computed.transform;
    }
  });
}

function cloneAt(source: HTMLElement, rect: DOMRect, layer: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement;
  for (const attribute of ["id", "role", "aria-modal", "aria-label"]) clone.removeAttribute(attribute);
  Object.assign(clone.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    right: "auto",
    bottom: "auto",
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    maxWidth: "none",
    maxHeight: "none",
    margin: "0",
    transformOrigin: "50% 50%",
  });
  layer.appendChild(clone);
  copyLiveState(source, clone);
  return clone;
}

function backdropClone(backdrop: HTMLElement, layer: HTMLElement): HTMLElement {
  const shade = document.createElement("div");
  Object.assign(shade.style, { position: "fixed", inset: "0", background: getComputedStyle(backdrop).backgroundColor });
  layer.appendChild(shade);
  return shade;
}

/**
 * A full transform string, so motion hands the spring to the compositor (WAAPI)
 * and it keeps moving while React mounts the opened example on the main thread.
 */
const tf = (x: number, y: number, sx: number, sy = sx) => `translate(${x}px, ${y}px) scale(${sx}, ${sy})`;
const IDENTITY = tf(0, 0, 1);

/** Transform that shrinks `rect` onto `origin`'s centre (uniform, so the content never squashes). */
function towards(rect: DOMRect, origin: DOMRect | null) {
  if (!origin || origin.width === 0) return { x: 0, y: 0, scale: 0.96 };
  return {
    x: origin.left + origin.width / 2 - (rect.left + rect.width / 2),
    y: origin.top + origin.height / 2 - (rect.top + rect.height / 2),
    scale: Math.min(0.5, Math.max(0.12, origin.width / rect.width)),
  };
}

/** A motion spring preset as native WAAPI timing (motion renders it as a `linear()` easing). */
function springTiming(preset: { stiffness: number; damping: number; mass: number }): { duration: number; easing: string } {
  const [ms, easing] = String(springGenerator({ keyframes: [0, 1], ...preset })).split(/ (.+)/);
  return { duration: Number.parseFloat(ms) || 400, easing: easing || "ease-out" };
}

const EASE_OUT = `cubic-bezier(${easeOut.join(", ")})`;

/**
 * The sheet grows out of the Ejemplos button (or scales up from the centre)
 * while the backdrop fades in. Native WAAPI without fill: these are the live
 * elements, so the animation never writes their styles. Whatever happens to it
 * (a hidden tab, a Strict Mode re-mount, an interruption), they rest visible.
 */
export function playSheetEnter(dialog: HTMLElement, backdrop: HTMLElement, origin: DOMRect | null) {
  if (!canAnimate()) return;
  const fade = { duration: duration.fast * 1000, easing: EASE_OUT };
  backdrop.animate({ opacity: [0, 1] }, fade);
  if (prefersReducedMotion()) {
    dialog.animate({ opacity: [0, 1] }, fade);
    return;
  }
  const from = towards(dialog.getBoundingClientRect(), origin);
  dialog.animate({ opacity: [0, 1] }, { duration: 160, easing: EASE_OUT });
  dialog.animate({ transform: [tf(from.x, from.y, from.scale), IDENTITY] }, springTiming(spring.smooth));
}

/** The reverse: a snapshot of the sheet shrinks back into its origin and the backdrop fades. */
export function playSheetExit(dialog: HTMLElement | null, backdrop: HTMLElement | null, origin: DOMRect | null) {
  if (!dialog || !backdrop || !canAnimate()) return;
  const layer = createLayer();
  const rect = dialog.getBoundingClientRect();
  const shade = backdropClone(backdrop, layer);
  const sheet = cloneAt(dialog, rect, layer);
  const to = towards(rect, prefersReducedMotion() ? null : origin);
  const animations = [
    animate(shade, { opacity: [1, 0] }, { duration: duration.fast, ease: easeOut }).finished,
    animate(sheet, { opacity: [1, 0] }, { duration: duration.fast, ease: "easeIn", delay: origin ? 0.06 : 0 }).finished,
  ];
  if (!prefersReducedMotion()) animations.push(animate(sheet, { transform: [IDENTITY, tf(to.x, to.y, to.scale)] }, spring.snappy).finished);
  void Promise.all(animations).finally(() => layer.remove());
  // Never leave a ghost behind, even if a spring takes long to settle.
  window.setTimeout(() => layer.remove(), 900);
}

/** Without a target from the workspace, the selected document tab (named "*.psc"). */
function activeDocumentTab(): DOMRect | null {
  return document.querySelector('[role="tab"][aria-selected="true"][aria-label$=".psc" i]')?.getBoundingClientRect() ?? null;
}

/**
 * "Abrir": the preview card lifts out of the library and travels into the new
 * document tab, shrinking into it, while the rest of the sheet fades. Call it
 * synchronously before the dialog unmounts; `getTarget` is read two frames
 * later, once the workspace has rendered the new tab.
 */
export function playOpenMorph({
  dialog,
  backdrop,
  card,
  getTarget,
}: {
  dialog: HTMLElement | null;
  backdrop: HTMLElement | null;
  card: HTMLElement | null;
  getTarget?: () => DOMRect | null;
}) {
  if (!dialog || !backdrop || !canAnimate()) return;
  const reduced = prefersReducedMotion();
  const layer = createLayer();
  const shade = backdropClone(backdrop, layer);
  const sheet = cloneAt(dialog, dialog.getBoundingClientRect(), layer);
  const cardRect = card?.getBoundingClientRect() ?? null;

  // The card leaves its slot in the sheet and flies on its own.
  let ghost: HTMLElement | null = null;
  let skin: HTMLElement | null = null;
  if (card && cardRect && !reduced) {
    const slot = sheet.querySelector<HTMLElement>("[data-examples-preview]");
    if (slot) slot.style.visibility = "hidden";
    ghost = document.createElement("div");
    Object.assign(ghost.style, {
      position: "fixed",
      left: `${cardRect.left}px`,
      top: `${cardRect.top}px`,
      width: `${cardRect.width}px`,
      height: `${cardRect.height}px`,
      overflow: "hidden",
      borderRadius: "12px",
      background: "#1B1F22",
      boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
      transformOrigin: "0 0",
      zIndex: "1",
    });
    const content = cloneAt(card, cardRect, ghost);
    Object.assign(content.style, { position: "absolute", left: "0", top: "0" });
    // Fades in over the content so the card arrives looking like the tab it becomes.
    skin = document.createElement("div");
    Object.assign(skin.style, { position: "absolute", inset: "0", background: "#141719", opacity: "0" });
    ghost.appendChild(skin);
    layer.appendChild(ghost);
  }

  const fade = { duration: duration.base, ease: easeOut };
  const done: Promise<unknown>[] = [
    animate(shade, { opacity: [1, 0] }, fade).finished,
    animate(sheet, { opacity: [1, 0], transform: [IDENTITY, tf(0, 0, reduced ? 1 : 0.985)] }, { duration: duration.fast, ease: easeOut }).finished,
  ];

  const fly = () => {
    if (!ghost || !skin || !cardRect) return;
    const fallback = new DOMRect(12, 38, 150, 28);
    const target = getTarget?.() ?? activeDocumentTab() ?? fallback;
    const to = target.width > 0 ? target : fallback;
    const travel = tf(to.left - cardRect.left, to.top - cardRect.top, to.width / cardRect.width, to.height / cardRect.height);
    done.push(animate(ghost, { transform: [IDENTITY, travel] }, spring.travel).finished);
    done.push(animate(skin, { opacity: 1 }, { duration: 0.22, delay: 0.08, ease: easeOut }).finished);
    // Hand over to the real tab as the card lands, not after the spring's last sub-pixel settle.
    done.push(animate(ghost, { opacity: [1, 0] }, { duration: 0.14, delay: 0.36, ease: easeOut }).finished);
  };
  // Two frames: React commits the new tab, then the browser lays it out.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      fly();
      void Promise.all(done).finally(() => layer.remove());
    })
  );
  // Never leave a ghost behind, even if a spring takes long to settle.
  window.setTimeout(() => layer.remove(), 1400);
}
