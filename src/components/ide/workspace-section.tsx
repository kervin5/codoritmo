import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";

import {
  type BrowserRuntimeController,
  type Diagnostic,
  type EngineProfile,
  type SourceSpan,
} from "@/src/engine";
import { formatMessage } from "@/src/i18n/format";
import type { Dictionary } from "@/src/i18n/types";

import BottomDock from "./bottom-dock";
import BottomSheet from "./bottom-sheet";
import DiagramView from "./diagram-view";
import {
  WorkspacePrimaryToolbarStrip,
  WorkspaceSecondaryToolbarStrip,
} from "./workspace-toolbar-strip";
import PseudocodeEditor, { type EditorHandle } from "./pseudocode-editor";
import SidebarPanel from "./sidebar-panel";
import type {
  DiagramNodeOffset,
  ExportLanguage,
  WorkspaceSession,
} from "./types";
import {
  ActionButton,
  AppIcon,
  SelectField,
  SegmentedControl,
  TabButton,
  classes,
  type IconName,
} from "./ui";
import { SearchableSelect } from "./searchable-select";

interface WorkspaceSectionProps {
  activeSession: WorkspaceSession;
  awaitingInput: boolean;
  awaitingKey: boolean;
  controllerRef: RefObject<BrowserRuntimeController | null>;
  dictionary: Dictionary;
  editorRef: RefObject<EditorHandle | null>;
  isRunning: boolean;
  onBottomTabChange: (tab: WorkspaceSession["bottomTab"]) => void;
  onBottomDockCollapsedChange: (collapsed: boolean) => void;
  onSnippetsPanelCollapsedChange: (collapsed: boolean) => void;
  onCloseSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onDiagnosticSelect: (diagnostic: Diagnostic) => void;
  onDiagramNodeOffsetChange: (
    nodeId: string,
    offset: DiagramNodeOffset
  ) => void;
  onDiagramExpandedChange: (expanded: boolean) => void;
  onDiagramResetLayout: (nodeIds: string[]) => void;
  onDiagramRoutineChange: (routineId: string) => void;
  onDiagramSelectedNodeChange: (nodeId: string | null) => void;
  onDiagramViewportChange: (
    viewport: WorkspaceSession["diagramViewport"]
  ) => void;
  onEditorChange: (value: string) => void;
  onExportLanguageChange: (language: ExportLanguage) => void;
  onGenerationTargetChange: (
    target: WorkspaceSession["generationTarget"]
  ) => void;
  onInputChange: (value: string) => void;
  onSubmitInput: () => void;
  onInsertSnippet: (snippet: {
    help: WorkspaceSession["helpContent"];
    placeholder?: string;
    text: string;
  }) => void;
  onPreviewHelp: (help: WorkspaceSession["helpContent"]) => void;
  onProfileChange: (profileId: string) => void;
  onRevealSource: (span: SourceSpan) => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onRun: () => void;
  onSessionChange: (sessionId: string) => void;
  onWorkspaceTabChange: (tab: WorkspaceSession["workspaceTab"]) => void;
  onEditProfile: () => void;
  profiles: EngineProfile[];
  sessions: WorkspaceSession[];
}

function createDownloadFilename(
  title: string,
  extension: string,
  suffix?: string
) {
  const baseName = title
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  const stem = baseName || "codoritmo";
  return `${stem}${suffix ? `-${suffix}` : ""}.${extension}`;
}

function downloadTextFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function SessionTabs({
  activeSessionId,
  dictionary,
  onClose,
  onCreate,
  onRename,
  onSelect,
  sessions,
}: {
  activeSessionId: string;
  dictionary: Dictionary;
  onClose: (sessionId: string) => void;
  onCreate: () => void;
  onRename: (sessionId: string, title: string) => void;
  onSelect: (sessionId: string) => void;
  sessions: WorkspaceSession[];
}) {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editingSessionId) {
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editingSessionId]);

  const beginRename = (session: WorkspaceSession) => {
    onSelect(session.id);
    setEditingSessionId(session.id);
    setDraftTitle(session.title);
  };

  const cancelRename = () => {
    setEditingSessionId(null);
    setDraftTitle("");
  };

  const commitRename = (sessionId: string) => {
    onRename(sessionId, draftTitle);
    cancelRename();
  };

  const handleRenameKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    sessionId: string
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitRename(sessionId);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelRename();
    }
  };

  const iconHit =
    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[var(--muted)] transition hover:bg-[rgba(43,36,28,0.06)] hover:text-[var(--foreground)] active:scale-[0.97]";

  return (
    <div className="surface-enter -mb-px flex items-end gap-1.5 overflow-x-auto px-2 pb-0 pt-2 sm:gap-2 sm:px-3 sm:pt-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {sessions.map((session) => {
        const isActive = session.id === activeSessionId;
        return (
          <div
            className={classes(
              "group relative grid h-11 min-w-[7.5rem] max-w-[13.5rem] grid-cols-[minmax(0,1fr)_2rem_2rem] items-center rounded-t-[12px] border border-b-0 transition-[background-color,border-color,box-shadow,color] duration-200",
              isActive
                ? classes(
                    "z-10 border-[rgba(76,65,49,0.14)] bg-[rgba(255,252,247,0.995)] text-[var(--foreground)]",
                    "shadow-[inset_0_2px_0_0_var(--accent),inset_0_1px_0_rgba(255,255,255,0.9)]",
                    "after:pointer-events-none after:absolute after:bottom-[-1px] after:left-2 after:right-2 after:h-px after:bg-[rgba(255,252,247,0.995)]"
                  )
                : classes(
                    "border-[rgba(76,65,49,0.08)] bg-[rgba(244,236,222,0.6)] text-[var(--muted)]",
                    "hover:border-[rgba(76,65,49,0.12)] hover:bg-[rgba(252,246,234,0.92)] hover:text-[var(--foreground)]"
                  )
            )}
            key={session.id}
          >
            {editingSessionId === session.id ? (
              <input
                aria-label={dictionary.workspace.renameTab}
                className="col-span-3 min-w-0 bg-transparent px-3 text-[13px] font-semibold tracking-[-0.02em] text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
                onBlur={() => commitRename(session.id)}
                onChange={(event) => setDraftTitle(event.target.value)}
                onKeyDown={(event) => handleRenameKeyDown(event, session.id)}
                ref={inputRef}
                value={draftTitle}
              />
            ) : (
              <>
                <button
                  className="flex min-h-11 min-w-0 items-center px-3 text-left text-[13px] font-semibold leading-none tracking-[-0.02em]"
                  onClick={() => onSelect(session.id)}
                  onDoubleClick={() => beginRename(session)}
                  onKeyDown={(event) => {
                    if (event.key === "F2") {
                      event.preventDefault();
                      beginRename(session);
                    }
                  }}
                  type="button"
                >
                  <span className="block w-full truncate">{session.title}</span>
                </button>
                <div className="flex h-full items-center justify-center">
                  {isActive ? (
                    <button
                      aria-label={dictionary.workspace.renameTab}
                      className={iconHit}
                      onClick={() => beginRename(session)}
                      title={formatMessage(dictionary.workspace.renameTabTitle, {
                        title: session.title,
                      })}
                      type="button"
                    >
                      <AppIcon className="h-[15px] w-[15px]" name="edit" />
                    </button>
                  ) : (
                    <span aria-hidden className="h-8 w-8" />
                  )}
                </div>
                <div className="flex h-full items-center justify-center pr-1">
                  <button
                    aria-label={dictionary.workspace.closeTab}
                    className={classes(
                      iconHit,
                      !isActive && "opacity-55 hover:opacity-100"
                    )}
                    onClick={() => onClose(session.id)}
                    type="button"
                  >
                    <AppIcon className="h-[15px] w-[15px]" name="close" />
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}

      <button
        aria-label={dictionary.workspace.newTab}
        className="inline-flex h-11 w-10 shrink-0 items-center justify-center rounded-t-[12px] border border-b-0 border-[rgba(76,65,49,0.1)] bg-[rgba(244,236,222,0.55)] text-[var(--muted)] transition hover:border-[rgba(76,65,49,0.14)] hover:bg-[rgba(252,246,234,0.95)] hover:text-[var(--accent-strong)] active:scale-[0.98]"
        onClick={onCreate}
        type="button"
      >
        <AppIcon className="h-[15px] w-[15px]" name="plus" />
      </button>
    </div>
  );
}

const TAB_CONFIG = {
  source: {
    triggerClass:
      'border border-[rgba(160,118,52,0.5)] bg-[var(--amber)] text-[rgba(255,251,244,0.98)] shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]',
    itemActiveClass:
      'border border-[rgba(160,118,52,0.45)] bg-[var(--amber)] text-[rgba(255,251,244,0.98)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]',
    chevronClass: 'text-[rgba(255,251,244,0.78)]',
  },
  export: {
    triggerClass:
      'border border-[rgba(176,98,72,0.48)] bg-[var(--coral)] text-[rgba(255,248,244,0.98)] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]',
    itemActiveClass:
      'border border-[rgba(176,98,72,0.42)] bg-[var(--coral)] text-[rgba(255,248,244,0.98)] shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]',
    chevronClass: 'text-[rgba(255,248,244,0.78)]',
  },
  diagram: {
    triggerClass:
      'border border-[rgba(36,96,80,0.5)] bg-[var(--accent)] text-[rgba(244,250,247,0.98)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]',
    itemActiveClass:
      'border border-[rgba(36,96,80,0.45)] bg-[var(--accent)] text-[rgba(244,250,247,0.98)] shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]',
    chevronClass: 'text-[rgba(244,250,247,0.78)]',
  },
} as const;

function WorkspaceTabDropdown({
  activeTab,
  dictionary,
  onTabChange,
}: {
  activeTab: WorkspaceSession["workspaceTab"];
  dictionary: Dictionary;
  onTabChange: (tab: WorkspaceSession["workspaceTab"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const tabLabels: Record<WorkspaceSession["workspaceTab"], string> = {
    source:  dictionary.workspace.source,
    export:  dictionary.workspace.export,
    diagram: dictionary.workspace.diagram,
  };

  const tabIcons: Record<WorkspaceSession["workspaceTab"], IconName> = {
    source:  "workspace",
    export:  "code",
    diagram: "diagram",
  };

  const active = TAB_CONFIG[activeTab];

  return (
    <div className="relative" ref={ref}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className={classes(
          "inline-flex min-h-11 min-w-0 max-w-[min(100%,14rem)] items-center gap-2.5 rounded-[13px] pl-4 pr-3 py-2.5 text-left text-[13px] font-semibold tracking-[-0.02em] transition-[border-color,background-color,box-shadow] duration-200 active:scale-[0.99]",
          active.triggerClass,
        )}
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        <AppIcon className="h-[17px] w-[17px] shrink-0" name={tabIcons[activeTab]} />
        <span className="min-w-0 flex-1 truncate">{tabLabels[activeTab]}</span>
        <AppIcon
          className={classes(
            "h-[15px] w-[15px] shrink-0 transition-transform duration-200",
            active.chevronClass,
            open && "rotate-180",
          )}
          name="chevron-down"
        />
      </button>

      {open ? (
        <div
          className="absolute left-0 top-[calc(100%+8px)] z-20 w-[min(calc(100vw-2.5rem),15rem)] overflow-hidden rounded-[14px] border border-[rgba(76,65,49,0.12)] bg-[rgba(252,249,242,0.99)] p-2 shadow-[0_12px_40px_rgba(43,36,28,0.08),inset_0_1px_0_rgba(255,255,255,0.85)]"
          role="listbox"
        >
          {(["source", "export", "diagram"] as const).map((tab) => {
            const cfg = TAB_CONFIG[tab];
            return (
              <button
                aria-selected={tab === activeTab}
                className={classes(
                  "flex w-full items-center gap-3 rounded-[11px] px-3.5 py-3 text-left text-[13px] font-semibold tracking-[-0.02em] transition-colors duration-150",
                  tab === activeTab
                    ? cfg.itemActiveClass
                    : "text-[var(--muted)] hover:bg-[rgba(43,36,28,0.04)] hover:text-[var(--foreground)]"
                )}
                key={tab}
                onClick={() => { onTabChange(tab); setOpen(false); }}
                role="option"
                type="button"
              >
                <AppIcon className="h-[17px] w-[17px] shrink-0 opacity-90" name={tabIcons[tab]} />
                {tabLabels[tab]}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function WorkspaceSection({
  activeSession,
  awaitingInput,
  awaitingKey,
  controllerRef,
  dictionary,
  editorRef,
  isRunning,
  onBottomTabChange,
  onBottomDockCollapsedChange,
  onSnippetsPanelCollapsedChange,
  onCloseSession,
  onCreateSession,
  onDiagnosticSelect,
  onDiagramNodeOffsetChange,
  onDiagramExpandedChange,
  onDiagramResetLayout,
  onDiagramRoutineChange,
  onDiagramSelectedNodeChange,
  onDiagramViewportChange,
  onEditorChange,
  onEditProfile,
  onExportLanguageChange,
  onGenerationTargetChange,
  onInputChange,
  onSubmitInput,
  onInsertSnippet,
  onPreviewHelp,
  onProfileChange,
  onRevealSource,
  onRenameSession,
  onRun,
  onSessionChange,
  onWorkspaceTabChange,
  profiles,
  sessions,
}: WorkspaceSectionProps) {
  const [mobileSnippetsOpen, setMobileSnippetsOpen] = useState(false);

  const isDiagramExpanded =
    activeSession.workspaceTab === "diagram" && activeSession.diagramExpanded;
  const snippetsRailCollapsed =
    !isDiagramExpanded && activeSession.snippetsPanelCollapsed;
  const workspaceRows = isDiagramExpanded
    ? "auto minmax(0,1fr)"
    : `auto minmax(0,1fr) ${
        activeSession.bottomDockCollapsed ? "64px" : "min(280px, 40svh)"
      }`;
  const sourceDownloadLabel = dictionary.workspace.downloadSource;
  const exportDownloadLabel = dictionary.workspace.downloadExport;
  const canDownloadExport = activeSession.generatedCode.trim().length > 0;

  const handleSourceDownload = () => {
    downloadTextFile(
      activeSession.source,
      createDownloadFilename(activeSession.title, "psc"),
      "text/plain;charset=utf-8"
    );
  };

  const handleExportDownload = () => {
    if (!canDownloadExport) {
      return;
    }

    downloadTextFile(
      activeSession.generatedCode,
      createDownloadFilename(
        activeSession.title,
        "js",
        activeSession.generationTarget
      ),
      "text/javascript;charset=utf-8"
    );
  };

  return (
    <section className="surface-enter flex h-full min-h-0 flex-col gap-2 lg:gap-4">
      {/* Profile selector — desktop: full selector + gear, mobile: gear only */}
      <div className="hidden items-end gap-3 lg:flex lg:justify-end lg:px-1">
        <SearchableSelect
          ariaLabel={dictionary.workspace.profile}
          className="min-w-[220px]"
          id="workspace-profile"
          label={dictionary.workspace.profile}
          onChange={onProfileChange}
          options={[
            ...profiles.map((profile) => ({
              label: profile.label,
              value: profile.id,
            })),
            ...(activeSession.profileId === "custom"
              ? [
                  {
                    label: dictionary.workspace.customProfile,
                    value: "custom",
                  },
                ]
              : []),
          ]}
          placeholder={
            dictionary.workspace.searchProfiles || "Search profiles..."
          }
          value={activeSession.profileId}
        />
        <ActionButton
          icon="settings"
          label={dictionary.workspace.editProfile}
          onClick={onEditProfile}
          tone="secondary"
        />
      </div>
      <div
        className={classes(
          "grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)] gap-3",
          isDiagramExpanded
            ? "lg:grid-cols-[minmax(0,1fr)]"
            : snippetsRailCollapsed
              ? "lg:grid-cols-[minmax(0,1fr)_4.5rem]"
              : "lg:grid-cols-[minmax(0,1fr)_288px]"
        )}
      >
        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[12px] border-b border-[var(--line)] bg-[rgba(255,252,247,0.96)] lg:border lg:border-[var(--line)] lg:shadow-[0_1px_0_rgba(255,255,255,0.75)_inset]">
          <div className="border-b border-[var(--line)] bg-[rgba(234,226,212,0.92)] px-3 pt-2.5 shadow-[inset_0_-1px_0_rgba(255,255,255,0.4)] sm:px-4 sm:pt-3">
            <SessionTabs
              activeSessionId={activeSession.id}
              dictionary={dictionary}
              onClose={onCloseSession}
              onCreate={onCreateSession}
              onRename={onRenameSession}
              onSelect={onSessionChange}
              sessions={sessions}
            />
          </div>

          <div
            className="grid min-h-0 min-w-0 flex-1 transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ gridTemplateRows: workspaceRows }}
          >
            <WorkspacePrimaryToolbarStrip tab={activeSession.workspaceTab}>
              <div className="flex items-center gap-2.5 lg:gap-3.5">
                {/* Mobile: compact dropdown */}
                <div className="lg:hidden">
                  <WorkspaceTabDropdown
                    activeTab={activeSession.workspaceTab}
                    dictionary={dictionary}
                    onTabChange={onWorkspaceTabChange}
                  />
                </div>
                {/* Desktop: full segmented control */}
                <div className="hidden lg:flex">
                  <SegmentedControl>
                    <TabButton
                      active={activeSession.workspaceTab === "source"}
                      icon="workspace"
                      label={dictionary.workspace.source}
                      onClick={() => onWorkspaceTabChange("source")}
                      tone="source"
                    />
                    <TabButton
                      active={activeSession.workspaceTab === "export"}
                      icon="code"
                      label={dictionary.workspace.export}
                      onClick={() => onWorkspaceTabChange("export")}
                      tone="export"
                    />
                    <TabButton
                      active={activeSession.workspaceTab === "diagram"}
                      icon="diagram"
                      label={dictionary.workspace.diagram}
                      onClick={() => onWorkspaceTabChange("diagram")}
                      tone="diagram"
                    />
                  </SegmentedControl>
                </div>

                {/* Actions — pushed to right */}
                <div className="ml-auto flex items-center gap-1.5">
                  {activeSession.workspaceTab === "source" ? (
                    <ActionButton
                      icon="download"
                      iconOnly
                      label={sourceDownloadLabel}
                      onClick={handleSourceDownload}
                      tone="secondary"
                    />
                  ) : null}

                  {/* Settings gear — mobile only */}
                  <span className="lg:hidden">
                    <ActionButton
                      icon="settings"
                      iconOnly
                      label={dictionary.workspace.editProfile}
                      onClick={onEditProfile}
                      tone="secondary"
                    />
                  </span>

                  <ActionButton
                    disabled={isRunning}
                    icon="play"
                    iconOnly
                    label={
                      awaitingKey
                        ? dictionary.workspace.executionPaused
                        : isRunning
                        ? dictionary.workspace.running
                        : dictionary.workspace.run
                    }
                    onClick={onRun}
                    tone="primary"
                  />
                </div>
              </div>
            </WorkspacePrimaryToolbarStrip>

            <div
              className={classes(
                "flex min-h-0 min-w-0 flex-1 flex-col",
                activeSession.workspaceTab === "source" ||
                  activeSession.workspaceTab === "export"
                  ? "bg-[var(--ink)]"
                  : "bg-[rgba(247,242,233,0.72)]"
              )}
            >
              {activeSession.workspaceTab === "source" ? (
                <div className="relative min-h-0 min-w-0 flex-1">
                  <PseudocodeEditor
                    dictionary={dictionary}
                    diagnostics={activeSession.parseDiagnostics}
                    onChange={onEditorChange}
                    ref={editorRef}
                    value={activeSession.source}
                  />
                  {/* Snippets trigger — bottom-right of editor, mobile only */}
                  <button
                    aria-label={dictionary.sidebar.title}
                    className="absolute bottom-5 right-5 z-10 flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-3 text-[13px] font-semibold tracking-[-0.02em] text-[rgba(244,250,247,0.98)] shadow-[0_6px_24px_rgba(36,96,80,0.38),inset_0_1px_0_rgba(255,255,255,0.18)] ring-1 ring-[rgba(36,96,80,0.22)] transition-[transform,filter] hover:brightness-[1.04] active:scale-[0.97] lg:hidden"
                    onClick={() => setMobileSnippetsOpen(true)}
                    type="button"
                  >
                    <AppIcon className="h-[18px] w-[18px] shrink-0 opacity-95" name="insert" />
                    <span>{dictionary.sidebar.title}</span>
                  </button>
                </div>
              ) : activeSession.workspaceTab === "diagram" ? (
                <DiagramView
                  dictionary={dictionary}
                  isExpanded={activeSession.diagramExpanded}
                  nodeOffsets={activeSession.diagramNodeOffsets}
                  onExpandedChange={onDiagramExpandedChange}
                  onNodeOffsetChange={onDiagramNodeOffsetChange}
                  onResetLayout={onDiagramResetLayout}
                  onRevealSource={onRevealSource}
                  onRoutineChange={onDiagramRoutineChange}
                  onSelectedNodeChange={onDiagramSelectedNodeChange}
                  onViewportChange={onDiagramViewportChange}
                  selectedNodeId={activeSession.diagramSelectedNodeId}
                  settings={activeSession.settings}
                  source={activeSession.source}
                  viewport={activeSession.diagramViewport}
                  visibleDiagnostics={activeSession.parseDiagnostics}
                  visibleRoutineId={activeSession.diagramRoutineId}
                />
              ) : (
                <div className="flex h-full min-h-0 min-w-0 flex-col">
                  <WorkspaceSecondaryToolbarStrip>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <div className="min-w-0 flex-1 lg:max-w-[200px] lg:flex-none">
                          <SelectField
                            ariaLabel={dictionary.workspace.exportLanguage}
                            className="w-full"
                            id="export-language"
                            label={dictionary.workspace.language}
                            onChange={(value) =>
                              onExportLanguageChange(value as ExportLanguage)
                            }
                            options={[
                              {
                                label: dictionary.workspace.languageJavaScript,
                                value: "javascript",
                              },
                            ]}
                            value={activeSession.exportLanguage}
                            visibleLabel={false}
                          />
                        </div>
                        <div className="min-w-0 flex-1 lg:max-w-[320px]">
                          <SelectField
                            ariaLabel={dictionary.workspace.exportTarget}
                            className="w-full"
                            id="export-target"
                            label={dictionary.workspace.target}
                            onChange={(value) =>
                              onGenerationTargetChange(
                                value as WorkspaceSession["generationTarget"]
                              )
                            }
                            options={[
                              { label: dictionary.workspace.browser, value: "browser" },
                              { label: dictionary.workspace.node, value: "node" },
                            ]}
                            value={activeSession.generationTarget}
                            visibleLabel={false}
                          />
                        </div>
                      </div>

                      <div className="ml-auto flex shrink-0 items-center">
                        <ActionButton
                          disabled={!canDownloadExport}
                          icon="download"
                          iconOnly
                          label={exportDownloadLabel}
                          onClick={handleExportDownload}
                          tone="secondary"
                        />
                      </div>
                    </div>
                  </WorkspaceSecondaryToolbarStrip>
                  <pre
                    className="min-h-0 min-w-0 max-w-full flex-1 overflow-auto px-4 py-4 font-[var(--font-geist-mono)] text-sm leading-6 text-[var(--ink-contrast)] [scrollbar-gutter:stable]"
                    data-testid="generated-code"
                  >
                    {activeSession.generatedCode ||
                      dictionary.workspace.exportEmpty}
                  </pre>
                </div>
              )}
            </div>

            {!isDiagramExpanded ? (
              <div className="min-h-0 overflow-hidden border-t border-[var(--line)] bg-[rgba(247,242,233,0.96)]">
                <BottomDock
                  awaitingInput={awaitingInput}
                  awaitingKey={awaitingKey}
                  collapsed={activeSession.bottomDockCollapsed}
                  dictionary={dictionary}
                  diagnostics={
                    activeSession.resultDiagnostics.length > 0
                      ? activeSession.resultDiagnostics
                      : activeSession.parseDiagnostics
                  }
                  inputText={activeSession.inputText}
                  onBottomTabChange={onBottomTabChange}
                  onContinueKey={() => controllerRef.current?.continueKey()}
                  onDiagnosticSelect={onDiagnosticSelect}
                  onInputChange={onInputChange}
                  onSubmitInput={onSubmitInput}
                  onToggleCollapsed={() =>
                    onBottomDockCollapsedChange(
                      !activeSession.bottomDockCollapsed
                    )
                  }
                  outputText={activeSession.output.join("\n")}
                  tab={activeSession.bottomTab}
                />
              </div>
            ) : null}
          </div>
        </div>

        {!isDiagramExpanded && snippetsRailCollapsed ? (
          <div
            className="hidden h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[12px] border border-[var(--line)] bg-[linear-gradient(168deg,rgba(47,129,107,0.09)_0%,rgba(250,246,238,0.99)_38%,rgba(250,246,238,0.96)_100%)] shadow-[0_1px_0_rgba(255,255,255,0.78)_inset,0_0_0_1px_rgba(47,129,107,0.08)_inset] lg:flex"
            data-testid="snippets-collapsed-rail"
          >
            <button
              aria-label={dictionary.sidebar.expandPanel}
              className="group flex h-full min-h-0 w-full flex-col items-center justify-center gap-1.5 px-1.5 py-4 text-center transition-colors duration-150 hover:bg-[rgba(47,129,107,0.05)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] active:bg-[rgba(47,129,107,0.07)]"
              onClick={() => onSnippetsPanelCollapsedChange(false)}
              title={dictionary.sidebar.expandPanel}
              type="button"
            >
              <span className="block max-w-[4rem] text-[12px] font-semibold leading-tight tracking-[-0.03em] text-[var(--accent-strong)]">
                {dictionary.sidebar.collapsedRailLead}
              </span>
              <span className="block max-w-[4rem] text-[10px] font-medium leading-tight tracking-[-0.01em] text-[var(--muted)]">
                {dictionary.sidebar.collapsedRailTrail}
              </span>
              <span
                aria-hidden
                className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] border border-[rgba(47,129,107,0.22)] bg-[rgba(255,252,247,0.88)] text-[var(--accent-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition-colors duration-150 group-hover:border-[rgba(47,129,107,0.32)] group-hover:bg-[rgba(255,252,247,0.98)]"
              >
                <AppIcon className="h-3.5 w-3.5" name="chevron-left" />
              </span>
            </button>
          </div>
        ) : !isDiagramExpanded ? (
          <div className="hidden h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[12px] border border-[var(--line)] bg-[rgba(250,246,238,0.96)] shadow-[0_1px_0_rgba(255,255,255,0.75)_inset] lg:flex">
            <SidebarPanel
              collapsibleDesktop
              dictionary={dictionary}
              onInsertSnippet={onInsertSnippet}
              onPreviewHelp={onPreviewHelp}
              onRequestCollapse={() => onSnippetsPanelCollapsedChange(true)}
              settings={activeSession.settings}
            />
          </div>
        ) : null}
      </div>

      {/* Mobile snippets bottom sheet */}
      <div className="lg:hidden">
        <BottomSheet
          isOpen={mobileSnippetsOpen}
          onClose={() => setMobileSnippetsOpen(false)}
          title={dictionary.sidebar.title}
        >
          <SidebarPanel
            compact
            dictionary={dictionary}
            onInsertSnippet={(snippet) => {
              onInsertSnippet(snippet);
              setMobileSnippetsOpen(false);
            }}
            onPreviewHelp={onPreviewHelp}
            settings={activeSession.settings}
          />
        </BottomSheet>
      </div>
    </section>
  );
}
