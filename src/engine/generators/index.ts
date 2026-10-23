import { JavaScriptGenerator } from "../generator";
import type {
  EngineSettings,
  GenerationResult,
  JavaScriptExportTarget,
  ProgramNode,
} from "../types";
import { CGenerator } from "./c";
import { CppGenerator } from "./cpp";
import { CSharpGenerator } from "./csharp";
import { HtmlGenerator } from "./html";
import { JavaGenerator } from "./java";
import { MatLabGenerator } from "./matlab";
import { PascalGenerator } from "./pascal";
import { PhpGenerator } from "./php";
import { PythonGenerator } from "./python";
import { QBasicGenerator } from "./qbasic";
import { VisualBasicGenerator } from "./vb";

export type ExportLanguage =
  | "javascript"
  | "c"
  | "cpp"
  | "python"
  | "java"
  | "csharp"
  | "php"
  | "pascal"
  | "vb"
  | "qbasic"
  | "matlab"
  | "html";

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
  /** Name shown to users. */
  name: string;
  fileExtension: string;
  mimeType: string;
  /** Whether the export target selector (browser / Node.js) applies. */
  supportsTargets: boolean;
  generate(program: ProgramNode, options: ExportOptions): GenerationResult;
}

export const exportLanguages: Record<ExportLanguage, ExportLanguageDefinition> = {
  javascript: {
    id: "javascript",
    name: "JavaScript",
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
    name: "C",
    fileExtension: "c",
    mimeType: "text/x-csrc;charset=utf-8",
    supportsTargets: false,
    generate: (program, options) => new CGenerator(options).generate(program),
  },
  cpp: {
    id: "cpp",
    name: "C++",
    fileExtension: "cpp",
    mimeType: "text/x-c++src;charset=utf-8",
    supportsTargets: false,
    generate: (program, options) => new CppGenerator(options).generate(program),
  },
  python: {
    id: "python",
    name: "Python",
    fileExtension: "py",
    mimeType: "text/x-python;charset=utf-8",
    supportsTargets: false,
    generate: (program, options) => new PythonGenerator(options).generate(program),
  },
  java: {
    id: "java",
    name: "Java",
    fileExtension: "java",
    mimeType: "text/x-java-source;charset=utf-8",
    supportsTargets: false,
    generate: (program, options) => new JavaGenerator(options).generate(program),
  },
  csharp: {
    id: "csharp",
    name: "C#",
    fileExtension: "cs",
    mimeType: "text/x-csharp;charset=utf-8",
    supportsTargets: false,
    generate: (program, options) => new CSharpGenerator(options).generate(program),
  },
  php: {
    id: "php",
    name: "PHP",
    fileExtension: "php",
    mimeType: "application/x-httpd-php;charset=utf-8",
    supportsTargets: false,
    generate: (program, options) => new PhpGenerator(options).generate(program),
  },
  pascal: {
    id: "pascal",
    name: "Pascal",
    fileExtension: "pas",
    mimeType: "text/x-pascal;charset=utf-8",
    supportsTargets: false,
    generate: (program, options) => new PascalGenerator(options).generate(program),
  },
  vb: {
    id: "vb",
    name: "Visual Basic",
    fileExtension: "vb",
    mimeType: "text/x-vb;charset=utf-8",
    supportsTargets: false,
    generate: (program, options) => new VisualBasicGenerator(options).generate(program),
  },
  qbasic: {
    id: "qbasic",
    name: "QBasic",
    fileExtension: "bas",
    mimeType: "text/x-basic;charset=utf-8",
    supportsTargets: false,
    generate: (program, options) => new QBasicGenerator(options).generate(program),
  },
  matlab: {
    id: "matlab",
    name: "MatLab",
    fileExtension: "m",
    mimeType: "text/x-matlab;charset=utf-8",
    supportsTargets: false,
    generate: (program, options) => new MatLabGenerator(options).generate(program),
  },
  html: {
    id: "html",
    name: "HTML",
    fileExtension: "html",
    mimeType: "text/html;charset=utf-8",
    supportsTargets: false,
    generate: (program, options) => new HtmlGenerator(options).generate(program),
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

export {
  CGenerator,
  CppGenerator,
  CSharpGenerator,
  HtmlGenerator,
  JavaGenerator,
  MatLabGenerator,
  PascalGenerator,
  PhpGenerator,
  PythonGenerator,
  QBasicGenerator,
  VisualBasicGenerator,
};
export { TypeInference } from "./type-inference";
export type { InferredType, ProgramTypes, ScopeTypes, VariableInfo } from "./type-inference";
