import { JavaScriptGenerator } from "../generator";
import type {
  EngineSettings,
  GenerationResult,
  JavaScriptExportTarget,
  ProgramNode,
} from "../types";
import { CGenerator } from "./c";
import { CppGenerator } from "./cpp";
import { JavaGenerator } from "./java";
import { PythonGenerator } from "./python";

export type ExportLanguage = "javascript" | "c" | "cpp" | "python" | "java";

export interface ExportOptions {
  settings?: Partial<EngineSettings>;
  /** Only used by languages with several runtimes (JavaScript). */
  target?: JavaScriptExportTarget;
  /** Explanatory comments in the generated code, where supported. */
  comments?: boolean;
}

/**
 * One export language. New languages only need an entry in
 * `exportLanguages`; typed ones can reuse `TypeInference` from
 * `./type-inference`.
 */
export interface ExportLanguageDefinition {
  id: ExportLanguage;
  fileExtension: string;
  mimeType: string;
  /** Whether the export target selector (browser / Node.js) applies. */
  supportsTargets: boolean;
  generate(program: ProgramNode, options: ExportOptions): GenerationResult;
}

export const exportLanguages: Record<ExportLanguage, ExportLanguageDefinition> = {
  javascript: {
    id: "javascript",
    fileExtension: "js",
    mimeType: "text/javascript;charset=utf-8",
    supportsTargets: true,
    generate: (program, options) =>
      new JavaScriptGenerator({ settings: options.settings }).generate(program, {
        target: options.target,
      }),
  },
  c: {
    id: "c",
    fileExtension: "c",
    mimeType: "text/x-csrc;charset=utf-8",
    supportsTargets: false,
    generate: (program, options) => new CGenerator(options).generate(program),
  },
  cpp: {
    id: "cpp",
    fileExtension: "cpp",
    mimeType: "text/x-c++src;charset=utf-8",
    supportsTargets: false,
    generate: (program, options) => new CppGenerator(options).generate(program),
  },
  python: {
    id: "python",
    fileExtension: "py",
    mimeType: "text/x-python;charset=utf-8",
    supportsTargets: false,
    generate: (program, options) => new PythonGenerator(options).generate(program),
  },
  java: {
    id: "java",
    fileExtension: "java",
    mimeType: "text/x-java-source;charset=utf-8",
    supportsTargets: false,
    generate: (program, options) => new JavaGenerator(options).generate(program),
  },
};

export function isExportLanguage(value: unknown): value is ExportLanguage {
  return typeof value === "string" && value in exportLanguages;
}

export function generateExport(
  program: ProgramNode,
  language: ExportLanguage,
  options: ExportOptions = {}
): GenerationResult {
  return exportLanguages[language].generate(program, options);
}

export { CGenerator, CppGenerator, JavaGenerator, PythonGenerator };
export { TypeInference } from "./type-inference";
export type { InferredType, ProgramTypes, ScopeTypes, VariableInfo } from "./type-inference";
