// A face for each topic of the example library: an icon and a muted hue from
// the same family as the flowchart and editor colours, so the library reads
// at a glance instead of as a list of words.

import {
  ArrowDownUp,
  Boxes,
  LayoutGrid,
  Puzzle,
  Repeat,
  Rows3,
  Sigma,
  Split,
  Sprout,
  Type,
  type LucideIcon,
} from "lucide-react";

import type { ExampleTopic } from "@/src/engine";

export const TOPIC_LOOK: Record<ExampleTopic | "all", { icon: LucideIcon; hue: string }> = {
  all: { icon: LayoutGrid, hue: "#AEB8B4" },
  basics: { icon: Sprout, hue: "#7FE0B8" },
  decisions: { icon: Split, hue: "#D9AE5F" },
  loops: { icon: Repeat, hue: "#6CCB9C" },
  arrays: { icon: Rows3, hue: "#7DA7D9" },
  sorting: { icon: ArrowDownUp, hue: "#5FB9BE" },
  text: { icon: Type, hue: "#E8BE8C" },
  routines: { icon: Boxes, hue: "#A894D6" },
  math: { icon: Sigma, hue: "#D2B3F2" },
  projects: { icon: Puzzle, hue: "#C995BF" },
};

/** The topic's icon on a soft tile of its hue. */
export function TopicIcon({ topic, size = 22 }: { topic: ExampleTopic | "all"; size?: number }) {
  const { icon: Icon, hue } = TOPIC_LOOK[topic];
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-[7px]"
      style={{ width: size, height: size, background: `${hue}24`, color: hue }}
    >
      <Icon size={Math.round(size * 0.58)} strokeWidth={2} />
    </span>
  );
}
