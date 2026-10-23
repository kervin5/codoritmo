"use client";

// The logo, alive: on first mount the "C" flow path draws itself from its node,
// then the play triangle pops in. With `playing`, the triangle morphs into a
// pause glyph (and back), so the mark doubles as the program's run state.
// Same geometry as LogoArt (which stays static for next/og).

import { motion, useReducedMotion } from "motion/react";
import { useId } from "react";

import { easeOut, spring } from "@/src/lib/motion";

// Play and pause as two quads each, with matching commands, so `d` interpolates.
// Play: the triangle split down the middle. Pause: two rounded bars.
const PLAY = ["M10.6 9.6 L12.5 10.8 L12.5 13.2 L10.6 14.4 Z", "M12.5 10.8 L14.4 12 L14.4 12 L12.5 13.2 Z"] as const;
const PAUSE = ["M10.3 9.7 L11.8 9.7 L11.8 14.3 L10.3 14.3 Z", "M13.2 9.7 L14.7 9.7 L14.7 14.3 L13.2 14.3 Z"] as const;

export function LogoMarkAnimated({
  size = 18,
  className,
  playing = false,
}: {
  size?: number;
  className?: string;
  /** Morphs the play triangle into a pause glyph while a program runs. */
  playing?: boolean;
}) {
  const id = `logo${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const reduced = useReducedMotion();
  const shapes = playing ? PAUSE : PLAY;

  return (
    <svg aria-hidden className={className} height={size} viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#9AF5CF" />
          <stop offset="1" stopColor="#2F9472" />
        </linearGradient>
      </defs>
      <rect fill={`url(#${id}-fill)`} height="24" rx={6.5} width="24" />
      <rect fill="none" height="23" rx="6" stroke="#FFFFFF" strokeOpacity="0.22" width="23" x="0.5" y="0.5" />
      {/* The node the flow starts from appears first… */}
      <motion.circle
        animate={{ scale: 1 }}
        cx="16.5"
        cy="7.3"
        fill="#0E1214"
        initial={reduced ? false : { scale: 0 }}
        r="2.1"
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
        transition={spring.bouncy}
      />
      {/* …then the C draws round from it… */}
      <motion.path
        animate={{ pathLength: 1 }}
        d="M16.5 7.3 A6.3 6.3 0 1 0 16.5 16.7"
        fill="none"
        initial={reduced ? false : { pathLength: 0 }}
        stroke="#0E1214"
        strokeLinecap="round"
        strokeWidth="2.4"
        transition={{ duration: 0.55, delay: 0.08, ease: easeOut }}
      />
      {/* …and the play glyph pops in once it closes. */}
      <motion.g
        animate={{ scale: 1, opacity: 1 }}
        initial={reduced ? false : { scale: 0.2, opacity: 0 }}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
        transition={{ ...spring.bouncy, delay: 0.45, opacity: { duration: 0.12, delay: 0.45 } }}
      >
        {shapes.map((d, index) => (
          <motion.path
            key={index}
            animate={{ d }}
            d={PLAY[index]}
            fill="#0E1214"
            initial={false}
            stroke="#0E1214"
            strokeLinejoin="round"
            strokeWidth="1"
            transition={reduced ? { duration: 0 } : spring.snappy}
          />
        ))}
      </motion.g>
    </svg>
  );
}
