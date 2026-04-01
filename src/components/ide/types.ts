import type {
  Diagnostic,
  EngineSettings,
  JavaScriptExportTarget,
} from '@/src/engine';

export type ShellPanel = 'examples' | 'none';

export type WorkspaceTab = 'diagram' | 'export' | 'source';

export type BottomTab = 'output' | 'problems';

export type ExportLanguage = 'javascript';

export interface DiagramNodeOffset {
  x: number;
  y: number;
}

export interface DiagramViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface HelpContent {
  body: string;
  title: string;
}

export interface WorkspaceSession {
  bottomTab: BottomTab;
  bottomDockCollapsed: boolean;
  snippetsPanelCollapsed: boolean;
  diagramNodeOffsets: Record<string, DiagramNodeOffset>;
  diagramExpanded: boolean;
  diagramRoutineId: string | null;
  diagramSelectedNodeId: string | null;
  diagramViewport: DiagramViewport | null;
  exampleId: string | null;
  exportLanguage: ExportLanguage;
  generatedCode: string;
  generationTarget: JavaScriptExportTarget;
  helpContent: HelpContent;
  id: string;
  inputText: string;
  isTitleCustom: boolean;
  output: string[];
  parseDiagnostics: Diagnostic[];
  profileId: string;
  resultDiagnostics: Diagnostic[];
  settings: EngineSettings;
  source: string;
  title: string;
  untitledNumber: number | null;
  updatedAt: number;
  workspaceTab: WorkspaceTab;
}
