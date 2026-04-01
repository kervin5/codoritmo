import type { ReactNode } from "react";

import { classes } from "./ui";

export type WorkspaceToolbarTab = "source" | "export" | "diagram";

/** Tab-tinted toolbar row (source / export / diagram) — mobile + desktop. */
const PRIMARY_STRIP_BY_TAB: Record<WorkspaceToolbarTab, string> = {
  source:
    "border-b border-[rgba(203,151,72,0.22)] bg-[rgba(255,238,210,0.72)] lg:border-[var(--line)] lg:bg-[rgba(255,241,220,0.94)]",
  export:
    "border-b border-[rgba(220,142,111,0.26)] bg-[rgba(255,228,212,0.65)] lg:border-[var(--line)] lg:bg-[rgba(255,234,224,0.94)]",
  diagram:
    "border-b border-[rgba(47,129,107,0.22)] bg-[rgba(220,236,228,0.72)] lg:border-[var(--line)] lg:bg-[rgba(228,241,234,0.94)]",
};

/** Shared cream bar under `border-[var(--line)]` — export controls, diagram toolbars, diagram error header. */
const SECONDARY_STRIP_BASE =
  "min-w-0 border-b border-[var(--line)] bg-workspace-toolbar-chrome px-4 py-3";

export function WorkspacePrimaryToolbarStrip({
  tab,
  children,
  className,
}: {
  tab: WorkspaceToolbarTab;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={classes(
        "min-w-0 px-3 py-3 sm:px-4",
        PRIMARY_STRIP_BY_TAB[tab],
        className,
      )}
    >
      {children}
    </div>
  );
}

export function WorkspaceSecondaryToolbarStrip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={classes(SECONDARY_STRIP_BASE, className)}>{children}</div>
  );
}
