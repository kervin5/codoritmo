// Shared motion vocabulary. Everything that moves uses one of these, so the app
// has one physical "feel": springs that settle quickly, never slow fades.
//
// Principles:
// - Motion explains cause and effect (where a thing came from / went), it never decorates.
// - Springs, so any animation can be interrupted mid-flight; nothing blocks input.
// - Transform and opacity only, so it stays at 60fps.
// - <MotionConfig reducedMotion="user"> wraps the app: with "reduce motion" on,
//   movement is dropped and only opacity changes remain.

import type { Transition } from "motion/react";

export const spring = {
  /** Selection indicators, toggles, small UI: fast and crisp. */
  snappy: { type: "spring", stiffness: 520, damping: 38, mass: 0.7 },
  /** Panels, sheets, cards moving into place. */
  smooth: { type: "spring", stiffness: 300, damping: 32, mass: 0.9 },
  /** Playful settle with a little overshoot (celebrations, pops). */
  bouncy: { type: "spring", stiffness: 420, damping: 18, mass: 0.8 },
  /** Things travelling a distance (the flowchart token, swapping bars). */
  travel: { type: "spring", stiffness: 210, damping: 26, mass: 1 },
} satisfies Record<string, Transition>;

export const duration = {
  /** Hover / press feedback. */
  instant: 0.12,
  fast: 0.18,
  base: 0.26,
  slow: 0.4,
} as const;

/** Apple-style ease-out for non-spring tweens (opacity, colour). */
export const easeOut = [0.22, 1, 0.36, 1] as const;

/** Stagger for lists cascading in, capped so long lists never feel slow. */
export function stagger(index: number, step = 0.025, max = 0.25): number {
  return Math.min(index * step, max);
}

/** Whether the user asked the OS to reduce motion (for non-motion/react code: SVG, Blockly, Monaco). */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}
