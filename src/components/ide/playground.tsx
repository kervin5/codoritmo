"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";

import {
  createBrowserRuntime,
  engineProfiles,
  examplePrograms,
  getEngineProfile,
  Interpreter,
  JavaScriptGenerator,
  normalizeEngineSettings,
  Parser,
  resolveProfileId,
  type Diagnostic,
  type EngineSettings,
  type ExampleProgram,
  type SourceSpan,
} from "@/src/engine";
import { defaultLocale, type Locale } from "@/src/i18n/config";
import { localizeExamples, localizeProfiles } from "@/src/i18n/helpers";
import { esDictionary } from "@/src/i18n/es";
import type { Dictionary } from "@/src/i18n/types";
import { isExamplesNewWorkspaceTabIntent } from "@/src/lib/workspace-deeplink";

import AppShell from "./app-shell";
import LibrarySection from "./library-section";
import ProfileDrawer from "./profile-drawer";
import { createDiagnosticHelp } from "./snippets";
import type { EditorHandle } from "./pseudocode-editor";
import type {
  ExportLanguage,
  ShellPanel,
  WorkspaceSession,
} from "./types";
import WorkspaceSection from "./workspace-section";
import {
  deriveAutomaticSessionTitle,
  createBlankSession,
  createSessionFromExample,
  deriveSessionTitle,
  loadPersistedWorkspace,
  persistWorkspaceState,
} from "./workspace-state";

interface PlaygroundProps {
  dictionary?: Dictionary;
  locale?: Locale;
}

function filterExamples(
  examples: ExampleProgram[],
  query: string
): ExampleProgram[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return examples;
  }

  return examples.filter((example) =>
    [example.label, example.description, example.source].some((value) =>
      value.toLowerCase().includes(normalizedQuery)
    )
  );
}

function diagnosticsEqual(left: Diagnostic[], right: Diagnostic[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((diagnostic, index) => {
    const other = right[index];
    return (
      diagnostic.message === other.message &&
      diagnostic.line === other.line &&
      diagnostic.column === other.column &&
      diagnostic.severity === other.severity &&
      diagnostic.code === other.code
    );
  });
}

function updateSessionById(
  sessions: WorkspaceSession[],
  sessionId: string,
  updater: (session: WorkspaceSession) => WorkspaceSession
): WorkspaceSession[] {
  return sessions.map((session) =>
    session.id === sessionId ? updater(session) : session
  );
}

export default function Playground({
  dictionary = esDictionary,
  locale = defaultLocale,
}: PlaygroundProps) {
  const localizedExamples = useMemo(
    () => localizeExamples(examplePrograms, dictionary),
    [dictionary]
  );
  const localizedProfiles = useMemo(
    () => localizeProfiles(engineProfiles, dictionary),
    [dictionary]
  );
  const workspaceStateOptions = useMemo(
    () => ({
      dictionary,
      examples: localizedExamples,
    }),
    [dictionary, localizedExamples]
  );
  const initialExample = localizedExamples[0];
  const [sessions, setSessions] = useState<WorkspaceSession[]>(() => [
    createBlankSession(1, workspaceStateOptions),
  ]);
  const [activeSessionId, setActiveSessionId] = useState(() => sessions[0]!.id);
  const [untitledCounter, setUntitledCounter] = useState(2);
  const [shellPanel, setShellPanel] = useState<ShellPanel>("none");
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryPreviewId, setLibraryPreviewId] = useState<string | null>(
    initialExample.id
  );
  const [isProfileDrawerOpen, setProfileDrawerOpen] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [runningSessionId, setRunningSessionId] = useState<string | null>(null);
  const [awaitingInputSessionId, setAwaitingInputSessionId] = useState<
    string | null
  >(null);
  const [awaitingKeySessionId, setAwaitingKeySessionId] = useState<
    string | null
  >(null);
  const [pendingReveal, setPendingReveal] = useState<{
    sessionId: string;
    span: SourceSpan;
  } | null>(null);

  const controllerRef = useRef<ReturnType<typeof createBrowserRuntime> | null>(
    null
  );
  const editorRef = useRef<EditorHandle | null>(null);
  const pathname = usePathname();
  const untitledCounterRef = useRef(untitledCounter);
  const examplesNewTabIntentHandledRef = useRef(false);

  useEffect(() => {
    untitledCounterRef.current = untitledCounter;
  }, [untitledCounter]);

  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ?? sessions[0];
  const deferredSource = useDeferredValue(activeSession.source);
  const deferredSettings = useDeferredValue(activeSession.settings);
  const filteredExamples = filterExamples(localizedExamples, libraryQuery);
  const activeProfile =
    localizedProfiles.find(
      (profile) => profile.id === activeSession.profileId
    ) ?? null;
  const isRunning = runningSessionId !== null;
  const awaitingInput = awaitingInputSessionId === activeSession.id;
  const awaitingKey = awaitingKeySessionId === activeSession.id;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const restored = loadPersistedWorkspace(workspaceStateOptions);
      if (restored) {
        startTransition(() => {
          setSessions(restored.sessions);
          setActiveSessionId(restored.activeSessionId);
          setShellPanel(restored.shellPanel);
          setUntitledCounter(restored.untitledCounter);
          setLibraryPreviewId(
            restored.sessions[0]?.exampleId ?? initialExample.id
          );
          setStorageReady(true);
        });
        return;
      }

      setStorageReady(true);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [initialExample.id, workspaceStateOptions]);

  useEffect(() => {
    if (!storageReady || typeof window === "undefined") {
      return;
    }
    if (!isExamplesNewWorkspaceTabIntent(window.location.search)) {
      return;
    }
    if (examplesNewTabIntentHandledRef.current) {
      return;
    }
    examplesNewTabIntentHandledRef.current = true;

    const counter = untitledCounterRef.current;
    const nextSession = createBlankSession(counter, workspaceStateOptions);

    startTransition(() => {
      setSessions((current) => [...current, nextSession]);
      setActiveSessionId(nextSession.id);
      setUntitledCounter(counter + 1);
      setShellPanel("examples");
      setLibraryPreviewId(nextSession.exampleId ?? initialExample.id);
    });

    window.history.replaceState(null, "", pathname);
  }, [initialExample.id, pathname, storageReady, workspaceStateOptions]);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    const timer = window.setTimeout(() => {
      persistWorkspaceState(
        {
          activeSessionId,
          sessions,
          shellPanel,
          untitledCounter,
        },
        workspaceStateOptions
      );
    }, 240);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    activeSessionId,
    sessions,
    shellPanel,
    storageReady,
    untitledCounter,
    workspaceStateOptions,
  ]);

  useEffect(() => {
    const sessionId = activeSession.id;
    const result = new Parser(deferredSource, {
      settings: deferredSettings,
    }).parse();

    startTransition(() => {
      setSessions((current) =>
        updateSessionById(current, sessionId, (session) => {
          const title = session.isTitleCustom
            ? session.title
            : deriveSessionTitle(
                {
                  exampleId: session.exampleId,
                  source: deferredSource,
                  title: session.title,
                  untitledNumber: session.untitledNumber,
                },
                workspaceStateOptions
              );

          if (
            diagnosticsEqual(session.parseDiagnostics, result.diagnostics) &&
            session.title === title
          ) {
            return session;
          }

          return {
            ...session,
            parseDiagnostics: result.diagnostics,
            title,
          };
        })
      );
    });
  }, [
    activeSession.id,
    deferredSettings,
    deferredSource,
    workspaceStateOptions,
  ]);

  useEffect(() => {
    if (activeSession.workspaceTab !== "export") {
      return;
    }

    const sessionId = activeSession.id;
    const parsed = new Parser(activeSession.source, {
      settings: activeSession.settings,
    }).parse();
    if (!parsed.program) {
      startTransition(() => {
        setSessions((current) =>
          updateSessionById(current, sessionId, (session) => ({
            ...session,
            generatedCode: "",
            resultDiagnostics: parsed.diagnostics,
            bottomTab: "problems",
          }))
        );
      });
      return;
    }

    const generator = new JavaScriptGenerator({
      settings: activeSession.settings,
    });
    const result = generator.generate(parsed.program, {
      target: activeSession.generationTarget,
    });

    startTransition(() => {
      setSessions((current) =>
        updateSessionById(current, sessionId, (session) => ({
          ...session,
          generatedCode: result.code ?? "",
          resultDiagnostics: result.diagnostics,
          bottomTab:
            result.diagnostics.length > 0 ? "problems" : session.bottomTab,
        }))
      );
    });
  }, [
    activeSession.generationTarget,
    activeSession.id,
    activeSession.settings,
    activeSession.source,
    activeSession.workspaceTab,
  ]);

  useEffect(() => {
    if (
      !pendingReveal ||
      pendingReveal.sessionId !== activeSession.id ||
      activeSession.workspaceTab !== "source"
    ) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      editorRef.current?.revealSpan(pendingReveal.span);
      setPendingReveal((current) =>
        current?.sessionId === pendingReveal.sessionId &&
        current.span.start.offset === pendingReveal.span.start.offset
          ? null
          : current
      );
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [activeSession.id, activeSession.workspaceTab, pendingReveal]);

  const handleShellPanelChange = (panel: ShellPanel) => {
    setShellPanel(panel);

    if (panel === "examples") {
      setLibraryPreviewId(activeSession.exampleId ?? initialExample.id);
    }
  };

  const createNewSession = () => {
    const nextSession = createBlankSession(
      untitledCounter,
      workspaceStateOptions
    );

    startTransition(() => {
      setSessions((current) => [...current, nextSession]);
      setActiveSessionId(nextSession.id);
      setShellPanel("none");
      setUntitledCounter((current) => current + 1);
    });
  };

  const closeSession = (sessionId: string) => {
    if (sessions.length === 1) {
      const replacement = createBlankSession(
        untitledCounter,
        workspaceStateOptions
      );
      setSessions([replacement]);
      setActiveSessionId(replacement.id);
      setUntitledCounter((current) => current + 1);
      setShellPanel("none");
      return;
    }

    const currentIndex = sessions.findIndex(
      (session) => session.id === sessionId
    );
    const nextSessions = sessions.filter((session) => session.id !== sessionId);
    const fallbackSession =
      nextSessions[Math.max(0, currentIndex - 1)] ?? nextSessions[0];

    setSessions(nextSessions);
    if (activeSessionId === sessionId && fallbackSession) {
      setActiveSessionId(fallbackSession.id);
    }
  };

  const setActiveSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setShellPanel("none");
  };

  const openExampleInNewTab = (exampleId: string) => {
    const nextSession = createSessionFromExample(
      exampleId,
      workspaceStateOptions
    );
    if (!nextSession) {
      return;
    }

    startTransition(() => {
      setSessions((current) => [...current, nextSession]);
      setActiveSessionId(nextSession.id);
      setLibraryPreviewId(exampleId);
      setShellPanel("none");
    });
  };

  const applyProfileToActiveSession = (profileId: string) => {
    const profile = getEngineProfile(profileId);
    if (!profile) {
      return;
    }

    setSessions((current) =>
      updateSessionById(current, activeSession.id, (session) => ({
        ...session,
        profileId,
        settings: normalizeEngineSettings(profile.settings),
        resultDiagnostics: [],
        generatedCode: "",
        updatedAt: Date.now(),
      }))
    );
  };

  const toggleSetting = (key: keyof EngineSettings, value: boolean) => {
    setSessions((current) =>
      updateSessionById(current, activeSession.id, (session) => {
        const settings = normalizeEngineSettings({
          ...session.settings,
          [key]: value,
        });

        return {
          ...session,
          settings,
          profileId: resolveProfileId(settings) ?? "custom",
          resultDiagnostics: [],
          generatedCode: "",
          updatedAt: Date.now(),
        };
      })
    );
  };

  const updateActiveSession = (
    updater: (session: WorkspaceSession) => WorkspaceSession
  ) => {
    setSessions((current) =>
      updateSessionById(current, activeSession.id, updater)
    );
  };

  const renameSession = (sessionId: string, nextTitle: string) => {
    setSessions((current) =>
      updateSessionById(current, sessionId, (session) => {
        const trimmedTitle = nextTitle.trim();
        const isTitleCustom = trimmedTitle.length > 0;

        return {
          ...session,
          title: isTitleCustom
            ? trimmedTitle
            : deriveAutomaticSessionTitle(session, workspaceStateOptions),
          isTitleCustom,
          updatedAt: Date.now(),
        };
      })
    );
  };

  const handleEditorChange = (value: string) => {
    startTransition(() => {
      updateActiveSession((session) => ({
        ...session,
        source: value,
        diagramViewport: null,
        diagramSelectedNodeId: null,
        resultDiagnostics: [],
        generatedCode:
          session.workspaceTab === "export" ? session.generatedCode : "",
        updatedAt: Date.now(),
      }));
    });
  };

  const handleInputChange = (value: string) => {
    updateActiveSession((session) => ({
      ...session,
      inputText: value,
      updatedAt: Date.now(),
    }));
  };

  const handleWorkspaceTabChange = (tab: WorkspaceSession["workspaceTab"]) => {
    updateActiveSession((session) => ({
      ...session,
      workspaceTab: tab,
      updatedAt: Date.now(),
    }));
  };

  const handleBottomTabChange = (tab: WorkspaceSession["bottomTab"]) => {
    updateActiveSession((session) => ({
      ...session,
      bottomTab: tab,
    }));
  };

  const handleBottomDockCollapsedChange = (collapsed: boolean) => {
    updateActiveSession((session) => ({
      ...session,
      bottomDockCollapsed: collapsed,
    }));
  };

  const handleSnippetsPanelCollapsedChange = (collapsed: boolean) => {
    updateActiveSession((session) => ({
      ...session,
      snippetsPanelCollapsed: collapsed,
    }));
  };

  const handleGenerationTargetChange = (
    target: WorkspaceSession["generationTarget"]
  ) => {
    updateActiveSession((session) => ({
      ...session,
      generationTarget: target,
      updatedAt: Date.now(),
    }));
  };

  const handleExportLanguageChange = (language: ExportLanguage) => {
    updateActiveSession((session) => ({
      ...session,
      exportLanguage: language,
      updatedAt: Date.now(),
    }));
  };

  const handleDiagramRoutineChange = (routineId: string) => {
    updateActiveSession((session) => ({
      ...session,
      diagramRoutineId: routineId,
      diagramViewport: null,
      updatedAt: Date.now(),
    }));
  };

  const handleDiagramViewportChange = (
    viewport: WorkspaceSession["diagramViewport"]
  ) => {
    updateActiveSession((session) => ({
      ...session,
      diagramViewport: viewport,
    }));
  };

  const handleDiagramNodeOffsetChange = (
    nodeId: string,
    offset: WorkspaceSession["diagramNodeOffsets"][string]
  ) => {
    updateActiveSession((session) => ({
      ...session,
      diagramNodeOffsets: {
        ...session.diagramNodeOffsets,
        [nodeId]: offset,
      },
      updatedAt: Date.now(),
    }));
  };

  const handleDiagramExpandedChange = (expanded: boolean) => {
    updateActiveSession((session) => ({
      ...session,
      diagramExpanded: expanded,
      updatedAt: Date.now(),
    }));
  };

  const handleDiagramResetLayout = (nodeIds: string[]) => {
    updateActiveSession((session) => {
      const nextOffsets = { ...session.diagramNodeOffsets };
      nodeIds.forEach((nodeId) => {
        delete nextOffsets[nodeId];
      });

      return {
        ...session,
        diagramNodeOffsets: nextOffsets,
        diagramViewport: null,
        updatedAt: Date.now(),
      };
    });
  };

  const handleDiagramSelectedNodeChange = (nodeId: string | null) => {
    updateActiveSession((session) => ({
      ...session,
      diagramSelectedNodeId: nodeId,
    }));
  };

  const handleRevealSource = (span: SourceSpan) => {
    setPendingReveal({ sessionId: activeSession.id, span });
    updateActiveSession((session) => ({
      ...session,
      workspaceTab: "source",
      updatedAt: Date.now(),
    }));
  };

  const updateHelpContent = (helpContent: WorkspaceSession["helpContent"]) => {
    updateActiveSession((session) => ({
      ...session,
      helpContent,
    }));
  };

  const insertSnippet = (snippet: {
    help: WorkspaceSession["helpContent"];
    placeholder?: string;
    text: string;
  }) => {
    updateHelpContent(snippet.help);

    if (editorRef.current) {
      editorRef.current.insertSnippet({
        text: snippet.text,
        placeholder: snippet.placeholder,
      });
      return;
    }

    updateActiveSession((session) => ({
      ...session,
      source: `${session.source}\n${snippet.text}`,
      updatedAt: Date.now(),
    }));
  };

  const selectDiagnostic = (diagnostic: Diagnostic) => {
    updateActiveSession((session) => ({
      ...session,
      bottomTab: "problems",
      bottomDockCollapsed: false,
      helpContent: createDiagnosticHelp(diagnostic, dictionary),
    }));
  };

  const handleRun = async () => {
    const sessionId = activeSession.id;
    const session = activeSession;

    setShellPanel("none");
    setRunningSessionId(sessionId);
    setAwaitingInputSessionId(null);
    setAwaitingKeySessionId(null);

    setSessions((current) =>
      updateSessionById(current, sessionId, (draft) => ({
        ...draft,
        inputText: "",
        output: [],
        resultDiagnostics: [],
        bottomTab: "output",
        bottomDockCollapsed: false,
      }))
    );

    const controller = createBrowserRuntime({
      onAwaitingInputChange: (awaiting) => {
        setAwaitingInputSessionId(awaiting ? sessionId : null);
        if (awaiting) {
          setSessions((current) =>
            updateSessionById(current, sessionId, (draft) => ({
              ...draft,
              bottomDockCollapsed: false,
            }))
          );
        }
      },
      onAwaitingKeyChange: (awaiting) => {
        setAwaitingKeySessionId(awaiting ? sessionId : null);
        if (awaiting) {
          setSessions((current) =>
            updateSessionById(current, sessionId, (draft) => ({
              ...draft,
              bottomDockCollapsed: false,
            }))
          );
        }
      },
      onOutput: (output) => {
        setSessions((current) =>
          updateSessionById(current, sessionId, (draft) => ({
            ...draft,
            output,
          }))
        );
      },
    });

    controllerRef.current = controller;

    const interpreter = new Interpreter({ settings: session.settings });
    const result = await interpreter.run(session.source, controller.runtime);

    setSessions((current) =>
      updateSessionById(current, sessionId, (draft) => ({
        ...draft,
        output: result.output,
        resultDiagnostics: result.diagnostics,
        bottomDockCollapsed: false,
        bottomTab: result.diagnostics.length > 0 ? "problems" : "output",
        helpContent: result.diagnostics[0]
          ? createDiagnosticHelp(result.diagnostics[0], dictionary)
          : draft.helpContent,
      }))
    );

    if (result.diagnostics[0]) {
      updateActiveSession((sessionDraft) => ({
        ...sessionDraft,
        helpContent: createDiagnosticHelp(result.diagnostics[0]!, dictionary),
      }));
    }

    setRunningSessionId((current) => (current === sessionId ? null : current));
    if (!controller.isAwaitingInput()) {
      setAwaitingInputSessionId((current) =>
        current === sessionId ? null : current
      );
    }
    if (!controller.isAwaitingKey()) {
      setAwaitingKeySessionId((current) =>
        current === sessionId ? null : current
      );
    }
  };

  const handleSubmitInput = () => {
    if (!controllerRef.current || !awaitingInput) {
      return;
    }

    const value = activeSession.inputText;
    controllerRef.current.submitInput(value);
    updateActiveSession((session) => ({
      ...session,
      inputText: "",
      updatedAt: Date.now(),
    }));
  };

  return (
    <>
      <AppShell
        activeNav="workspace"
        activePanel={shellPanel}
        dictionary={dictionary}
        drawer={
          shellPanel === "examples" ? (
            <LibrarySection
              dictionary={dictionary}
              examples={filteredExamples}
              onClose={() => setShellPanel("none")}
              onOpenInWorkspace={openExampleInNewTab}
              onPreviewExample={setLibraryPreviewId}
              previewExampleId={libraryPreviewId}
              query={libraryQuery}
              setQuery={setLibraryQuery}
            />
          ) : null
        }
        locale={locale}
        onPanelChange={handleShellPanelChange}
        onSidebarToggle={() => setSidebarExpanded((current) => !current)}
        sidebarExpanded={sidebarExpanded}
      >
        <WorkspaceSection
          activeSession={activeSession}
          awaitingInput={awaitingInput}
          awaitingKey={awaitingKey}
          controllerRef={controllerRef}
          dictionary={dictionary}
          editorRef={editorRef}
          isRunning={isRunning}
          onBottomTabChange={handleBottomTabChange}
          onBottomDockCollapsedChange={handleBottomDockCollapsedChange}
          onSnippetsPanelCollapsedChange={handleSnippetsPanelCollapsedChange}
          onCloseSession={closeSession}
          onCreateSession={createNewSession}
          onDiagnosticSelect={selectDiagnostic}
          onDiagramNodeOffsetChange={handleDiagramNodeOffsetChange}
          onDiagramExpandedChange={handleDiagramExpandedChange}
          onDiagramResetLayout={handleDiagramResetLayout}
          onDiagramRoutineChange={handleDiagramRoutineChange}
          onDiagramSelectedNodeChange={handleDiagramSelectedNodeChange}
          onDiagramViewportChange={handleDiagramViewportChange}
          onEditorChange={handleEditorChange}
          onEditProfile={() => setProfileDrawerOpen(true)}
          onExportLanguageChange={handleExportLanguageChange}
          onGenerationTargetChange={handleGenerationTargetChange}
          onInputChange={handleInputChange}
          onSubmitInput={handleSubmitInput}
          onInsertSnippet={insertSnippet}
          onPreviewHelp={updateHelpContent}
          onProfileChange={applyProfileToActiveSession}
          onRevealSource={handleRevealSource}
          onRenameSession={renameSession}
          onRun={handleRun}
          onSessionChange={setActiveSession}
          onWorkspaceTabChange={handleWorkspaceTabChange}
          profiles={localizedProfiles}
          sessions={sessions}
        />
      </AppShell>

      <ProfileDrawer
        activeProfileLabel={
          activeProfile?.label ?? dictionary.workspace.customProfile
        }
        dictionary={dictionary}
        isCustomProfile={activeSession.profileId === "custom"}
        isOpen={isProfileDrawerOpen}
        onClose={() => setProfileDrawerOpen(false)}
        onToggle={toggleSetting}
        settings={activeSession.settings}
      />
    </>
  );
}
