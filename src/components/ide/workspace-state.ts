import {
  engineProfiles,
  getEngineProfile,
  normalizeEngineSettings,
} from '@/src/engine';
import type { ExampleProgram } from '@/src/engine';
import { formatMessage } from '@/src/i18n/format';
import type { Dictionary } from '@/src/i18n/types';

import type {
  ExportLanguage,
  HelpContent,
  ShellPanel,
  WorkspaceSession,
} from './types';

const STORAGE_KEY = 'algo-brain.workspace.v1';
const STORAGE_VERSION = 2;
const BLANK_SOURCE = `Proceso NuevoAlgoritmo
FinProceso`;

const defaultProfile = getEngineProfile('desktop-default') ?? engineProfiles[0];

export interface WorkspaceStateOptions {
  dictionary: Dictionary;
  examples: ExampleProgram[];
}

interface PersistedWorkspaceSession {
  bottomTab: WorkspaceSession['bottomTab'];
  bottomDockCollapsed?: boolean;
  diagramNodeOffsets?: WorkspaceSession['diagramNodeOffsets'];
  diagramExpanded?: boolean;
  diagramRoutineId?: WorkspaceSession['diagramRoutineId'];
  diagramSelectedNodeId?: WorkspaceSession['diagramSelectedNodeId'];
  diagramViewport?: WorkspaceSession['diagramViewport'];
  exampleId: string | null;
  exportLanguage?: ExportLanguage;
  generationTarget: WorkspaceSession['generationTarget'];
  id: string;
  inputText: string;
  isTitleCustom?: boolean;
  profileId: string;
  settings: WorkspaceSession['settings'];
  source: string;
  title?: string;
  untitledNumber: number | null;
  updatedAt: number;
  workspaceTab: WorkspaceSession['workspaceTab'];
}

interface PersistedWorkspaceState {
  activeSessionId: string;
  sessions: PersistedWorkspaceSession[];
  shellPanel: ShellPanel;
  untitledCounter: number;
  version: number;
}

function createSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function extractRoutineName(source: string): string | null {
  const functionMatch = source.match(/^\s*Funcion\s+(?:[A-Za-z_\p{L}][\w\p{L}\p{N}_]*\s*<-\s*)?([A-Za-z_\p{L}][\w\p{L}\p{N}_]*)/imu);
  if (functionMatch?.[1]) {
    return functionMatch[1];
  }

  const routineMatch = source.match(/^\s*(Proceso|Algoritmo|SubProceso|SubAlgoritmo)\s+([A-Za-z_\p{L}][\w\p{L}\p{N}_]*)/imu);
  return routineMatch?.[2] ?? null;
}

function isPlaceholderName(name: string | null): boolean {
  if (!name) {
    return true;
  }

  return /^NuevoAlgoritmo\d*$/i.test(name);
}

function getUntitledLabel(
  dictionary: Dictionary,
  untitledNumber: number | null,
): string {
  if (typeof untitledNumber === 'number') {
    return formatMessage(dictionary.workspace.untitledNumber, { n: untitledNumber });
  }

  return dictionary.workspace.untitled;
}

function resolveExampleLabel(
  exampleId: string,
  examples: ExampleProgram[],
): string | null {
  return examples.find((candidate) => candidate.id === exampleId)?.label ?? null;
}

export function createDefaultHelpContent(options: WorkspaceStateOptions): HelpContent {
  return {
    title: options.dictionary.workspace.defaultHelpTitle,
    body: options.dictionary.workspace.defaultHelpBody,
  };
}

export function deriveSessionTitle(
  session: Pick<WorkspaceSession, 'exampleId' | 'source' | 'title' | 'untitledNumber'>,
  options: WorkspaceStateOptions,
): string {
  if (session.exampleId) {
    const exampleLabel = resolveExampleLabel(session.exampleId, options.examples);
    if (exampleLabel) {
      return exampleLabel;
    }
  }

  const routineName = extractRoutineName(session.source);
  if (routineName && !isPlaceholderName(routineName)) {
    return routineName;
  }

  return session.title || getUntitledLabel(options.dictionary, session.untitledNumber);
}

export function deriveAutomaticSessionTitle(
  session: Pick<WorkspaceSession, 'exampleId' | 'source' | 'title' | 'untitledNumber'>,
  options: WorkspaceStateOptions,
): string {
  return deriveSessionTitle({
    ...session,
    title: '',
  }, options);
}

export function createBlankSource(): string {
  return BLANK_SOURCE;
}

export function createBlankSession(
  untitledNumber: number,
  options: WorkspaceStateOptions,
): WorkspaceSession {
  const settings = normalizeEngineSettings(defaultProfile.settings);

  return {
    id: createSessionId(),
    title: getUntitledLabel(options.dictionary, untitledNumber),
    source: createBlankSource(),
    inputText: '',
    isTitleCustom: false,
    profileId: defaultProfile.id,
    settings,
    exampleId: null,
    exportLanguage: 'javascript',
    workspaceTab: 'source',
    bottomTab: 'output',
    bottomDockCollapsed: false,
    snippetsPanelCollapsed: false,
    diagramNodeOffsets: {},
    diagramExpanded: false,
    diagramRoutineId: null,
    diagramSelectedNodeId: null,
    diagramViewport: null,
    output: [],
    generatedCode: '',
    parseDiagnostics: [],
    resultDiagnostics: [],
    generationTarget: 'browser',
    updatedAt: Date.now(),
    untitledNumber,
    helpContent: createDefaultHelpContent(options),
  };
}

export function createSessionFromExample(
  exampleId: string,
  options: WorkspaceStateOptions,
): WorkspaceSession | null {
  const example = options.examples.find((candidate) => candidate.id === exampleId);
  if (!example) {
    return null;
  }

  const profile = getEngineProfile(example.profileId ?? defaultProfile.id) ?? defaultProfile;
  const settings = normalizeEngineSettings({
    ...profile.settings,
    ...example.settings,
  });

  return {
    id: createSessionId(),
    title: example.label,
    source: example.source,
    inputText: '',
    isTitleCustom: false,
    profileId: example.profileId ?? profile.id,
    settings,
    exampleId: example.id,
    exportLanguage: 'javascript',
    workspaceTab: 'source',
    bottomTab: 'output',
    bottomDockCollapsed: false,
    snippetsPanelCollapsed: false,
    diagramNodeOffsets: {},
    diagramExpanded: false,
    diagramRoutineId: null,
    diagramSelectedNodeId: null,
    diagramViewport: null,
    output: [],
    generatedCode: '',
    parseDiagnostics: [],
    resultDiagnostics: [],
    generationTarget: 'browser',
    updatedAt: Date.now(),
    untitledNumber: null,
    helpContent: createDefaultHelpContent(options),
  };
}

function isPersistedState(value: unknown): value is PersistedWorkspaceState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<PersistedWorkspaceState>;
  return candidate.version === STORAGE_VERSION
    && Array.isArray(candidate.sessions)
    && typeof candidate.activeSessionId === 'string'
    && typeof candidate.untitledCounter === 'number';
}

function restoreSession(
  session: PersistedWorkspaceSession,
  options: WorkspaceStateOptions,
): WorkspaceSession | null {
  if (!session || typeof session !== 'object' || typeof session.id !== 'string' || typeof session.source !== 'string') {
    return null;
  }

  const profile = getEngineProfile(session.profileId ?? defaultProfile.id) ?? defaultProfile;
  const settings = normalizeEngineSettings({
    ...profile.settings,
    ...session.settings,
  });

  const restored: WorkspaceSession = {
    id: session.id,
    title: session.title ?? options.dictionary.workspace.untitled,
    source: session.source,
    inputText: session.inputText ?? '',
    isTitleCustom: session.isTitleCustom === true,
    profileId: session.profileId ?? profile.id,
    settings,
    exampleId: session.exampleId ?? null,
    exportLanguage: session.exportLanguage ?? 'javascript',
    workspaceTab: session.workspaceTab === 'diagram'
      ? 'diagram'
      : session.workspaceTab === 'export'
        ? 'export'
        : 'source',
    bottomTab: session.bottomTab === 'problems' ? 'problems' : 'output',
    bottomDockCollapsed: session.bottomDockCollapsed === true,
    snippetsPanelCollapsed: false,
    diagramNodeOffsets: session.diagramNodeOffsets ?? {},
    diagramExpanded: session.diagramExpanded === true,
    diagramRoutineId: session.diagramRoutineId ?? null,
    diagramSelectedNodeId: session.diagramSelectedNodeId ?? null,
    diagramViewport: session.diagramViewport ?? null,
    output: [],
    generatedCode: '',
    parseDiagnostics: [],
    resultDiagnostics: [],
    generationTarget: session.generationTarget === 'node' ? 'node' : 'browser',
    updatedAt: typeof session.updatedAt === 'number' ? session.updatedAt : Date.now(),
    untitledNumber: typeof session.untitledNumber === 'number' ? session.untitledNumber : null,
    helpContent: createDefaultHelpContent(options),
  };

  restored.title = restored.isTitleCustom
    ? restored.title
    : deriveSessionTitle(restored, options);
  return restored;
}

export function loadPersistedWorkspace(
  options: WorkspaceStateOptions,
): {
  activeSessionId: string;
  sessions: WorkspaceSession[];
  shellPanel: ShellPanel;
  untitledCounter: number;
} | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isPersistedState(parsed)) {
      return null;
    }

    const sessions = parsed.sessions
      .map((session) => restoreSession(session, options))
      .filter((session): session is WorkspaceSession => Boolean(session));

    if (sessions.length === 0) {
      return null;
    }

    const activeSession = sessions.find((session) => session.id === parsed.activeSessionId) ?? sessions[0];

    return {
      activeSessionId: activeSession.id,
      sessions,
      shellPanel: parsed.shellPanel === 'examples' ? 'examples' : 'none',
      untitledCounter: Math.max(parsed.untitledCounter, 1),
    };
  } catch {
    return null;
  }
}

export function persistWorkspaceState(input: {
  activeSessionId: string;
  sessions: WorkspaceSession[];
  shellPanel: ShellPanel;
  untitledCounter: number;
}, options: WorkspaceStateOptions): void {
  if (typeof window === 'undefined') {
    return;
  }

  const payload: PersistedWorkspaceState = {
    version: STORAGE_VERSION,
    activeSessionId: input.activeSessionId,
    shellPanel: input.shellPanel,
    untitledCounter: input.untitledCounter,
    sessions: input.sessions.map((session) => ({
      id: session.id,
      title: session.isTitleCustom ? session.title : deriveSessionTitle(session, options),
      source: session.source,
      inputText: session.inputText,
      isTitleCustom: session.isTitleCustom,
      profileId: session.profileId,
      settings: session.settings,
      exampleId: session.exampleId,
      workspaceTab: session.workspaceTab,
      bottomTab: session.bottomTab,
      bottomDockCollapsed: session.bottomDockCollapsed,
      diagramNodeOffsets: session.diagramNodeOffsets,
      diagramExpanded: session.diagramExpanded,
      diagramRoutineId: session.diagramRoutineId,
      diagramSelectedNodeId: session.diagramSelectedNodeId,
      diagramViewport: session.diagramViewport,
      exportLanguage: session.exportLanguage,
      generationTarget: session.generationTarget,
      untitledNumber: session.untitledNumber,
      updatedAt: session.updatedAt,
    })),
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota and privacy mode failures.
  }
}

export function clearPersistedWorkspace(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}

export { STORAGE_KEY };
