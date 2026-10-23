"use client";

// The light that travels the live flowchart: a mint dot with a short comet
// trail that runs along the routed connectors from the block that just ran to
// the next one (back up the loop line on every iteration), and the ripple
// that marks the end of a run. Rendered inside React Flow's viewport, so it
// lives in diagram coordinates and pans/zooms with the chart.
//
// Driven imperatively (the parent calls travel/blink) and animated by writing
// attributes each frame: no React renders while the light moves.

import { ViewportPortal } from "@xyflow/react";
import { animate, motion, type AnimationPlaybackControls } from "motion/react";
import { useImperativeHandle, useRef, type Ref } from "react";

import { DARK_ACTIVE_COLOR, type Point } from "@/src/diagram";
import { easeOut } from "@/src/lib/motion";

import { pointAt, subPath, type TravelPath } from "./flow-path";

export interface FlowLightHandle {
  /** Run the light along `path`; `onPass(i)` fires as it reaches connector i, `onArrive` at the end. */
  travel(path: TravelPath, durationMs: number, callbacks: { onPass?: (index: number) => void; onArrive: (interrupted: boolean) => void }): void;
  /** No route to follow: a brief glint at the destination instead. */
  blink(at: Point): void;
  /** Stop mid-flight; the pending onArrive gets interrupted = true so nothing stays held. */
  cancel(): void;
}

export interface FlowRipple {
  key: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Trail pieces behind the light: [length, width, opacity]; longer is fainter. */
const TRAIL: [number, number, number][] = [
  [46, 7, 0.1],
  [30, 3.2, 0.28],
  [14, 2.2, 0.6],
];

export function FlowLight({ handleRef, ripple }: { handleRef: Ref<FlowLightHandle>; ripple: FlowRipple | null }) {
  const groupRef = useRef<SVGGElement>(null);
  const headRef = useRef<SVGGElement>(null);
  const trailRefs = useRef<(SVGPathElement | null)[]>([]);
  const runRef = useRef<{ controls: AnimationPlaybackControls; onArrive: (interrupted: boolean) => void } | null>(null);
  /** Fades and swells on the head; stopped before the light sets off again. */
  const effectsRef = useRef<Animation[]>([]);

  useImperativeHandle(handleRef, () => {
    const place = (point: Point) => groupRef.current?.setAttribute("transform", `translate(${point.x} ${point.y})`);
    const setTrail = (path: TravelPath | null, distance: number) => {
      TRAIL.forEach(([length], index) => {
        const el = trailRefs.current[index];
        if (!el) return;
        el.setAttribute("d", path ? subPath(path, Math.max(0, distance - length), distance) : "");
      });
    };
    // Native WAAPI (fill: forwards) so the end state sticks until the next trip cancels it.
    const effect = (el: Element | null, keyframes: Keyframe[], duration: number) => {
      const animation = el?.animate?.(keyframes, { duration, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" });
      if (animation) effectsRef.current.push(animation);
    };
    const show = (opacity: number) => {
      effectsRef.current.forEach((animation) => animation.cancel());
      effectsRef.current = [];
      const group = groupRef.current;
      if (group) group.style.opacity = String(opacity);
      const head = headRef.current;
      if (head) head.style.transform = "scale(1)";
    };
    const finish = () => {
      const run = runRef.current;
      runRef.current = null;
      run?.controls.stop();
      run?.onArrive(true);
    };

    return {
      travel(path, durationMs, { onPass, onArrive }) {
        finish();
        if (path.length <= 0) {
          onArrive(false);
          return;
        }
        let passed = -1;
        place(path.points[0]);
        setTrail(null, 0);
        show(1);
        const controls = animate(0, path.length, {
          duration: durationMs / 1000,
          // Leaves briskly, eases into the block it reaches.
          ease: [0.35, 0.05, 0.25, 1],
          onUpdate: (distance) => {
            place(pointAt(path, distance));
            setTrail(path, distance);
            while (passed + 1 < path.edgeStarts.length && path.edgeStarts[passed + 1].at <= distance + 0.5) {
              passed += 1;
              onPass?.(passed);
            }
          },
          onComplete: () => {
            if (runRef.current?.controls !== controls) return;
            const run = runRef.current;
            // Absorbed into the block: the head swells and fades as the block lights up.
            setTrail(null, 0);
            const group = groupRef.current;
            const head = headRef.current;
            if (group && head) {
              effect(head, [{ transform: "scale(1)" }, { transform: "scale(1.9)" }], 220);
              effect(group, [{ opacity: 1 }, { opacity: 0 }], 220);
            }
            runRef.current = null;
            run.onArrive(false);
          },
        });
        runRef.current = { controls, onArrive };
      },
      blink(at) {
        finish();
        show(0);
        place(at);
        setTrail(null, 0);
        const group = groupRef.current;
        const head = headRef.current;
        if (!group || !head) return;
        effect(group, [{ opacity: 0 }, { opacity: 0.9, offset: 0.3 }, { opacity: 0 }], 320);
        effect(head, [{ transform: "scale(0.6)" }, { transform: "scale(1.4)" }], 320);
      },
      cancel() {
        finish();
        setTrail(null, 0);
        show(0);
      },
    };
  }, []);

  return (
    <ViewportPortal>
      <svg
        aria-hidden
        height={1}
        style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}
        width={1}
      >
        <defs>
          <radialGradient cx="35%" cy="30%" id="flow-marble-body" r="75%">
            <stop offset="0" stopColor="#F2FFF9" />
            <stop offset="0.45" stopColor="#9AF5CF" />
            <stop offset="1" stopColor="#2F9472" />
          </radialGradient>
        </defs>
        {TRAIL.map(([, width, opacity], index) => (
          <path
            key={index}
            ref={(el) => {
              trailRefs.current[index] = el;
            }}
            fill="none"
            stroke={DARK_ACTIVE_COLOR}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity={opacity}
            strokeWidth={width}
          />
        ))}
        <g ref={groupRef} style={{ opacity: 0 }}>
          <g ref={headRef} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
            {/* A glass marble: glow, a soft contact shadow, a lit body and a specular highlight. */}
            <circle fill={DARK_ACTIVE_COLOR} opacity={0.3} r={13} style={{ filter: "blur(5px)" }} />
            <ellipse cx={1.2} cy={4.8} fill="#000" opacity={0.35} rx={5.6} ry={2.2} style={{ filter: "blur(1.5px)" }} />
            <circle fill="url(#flow-marble-body)" r={6.6} />
            <circle fill="none" r={6.6} stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={0.8} />
            <ellipse cx={-2.2} cy={-2.6} fill="#FFFFFF" opacity={0.85} rx={2.1} ry={1.4} transform="rotate(-30 -2.2 -2.6)" />
          </g>
        </g>
      </svg>
      {ripple && (
        <motion.div
          key={ripple.key}
          animate={{ opacity: [0.75, 0], scale: [1, 1.55] }}
          initial={{ opacity: 0.75, scale: 1 }}
          style={{
            position: "absolute",
            left: ripple.x,
            top: ripple.y,
            width: ripple.width,
            height: ripple.height,
            borderRadius: 999,
            border: `2px solid ${DARK_ACTIVE_COLOR}`,
            pointerEvents: "none",
          }}
          transition={{ duration: 0.9, ease: easeOut }}
        />
      )}
    </ViewportPortal>
  );
}
