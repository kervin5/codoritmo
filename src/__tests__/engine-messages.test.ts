import { createBrowserRuntime, engineMessageTemplates, Interpreter, Parser, type EngineSettings } from "../engine";
import type { Diagnostic } from "../engine/types";
import { formatDiagnostic } from "../i18n/diagnostics";
import { enDictionary } from "../i18n/en";
import { esDictionary } from "../i18n/es";

const placeholders = (template: string) => [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

function parseError(source: string, settings: Partial<EngineSettings> = {}): Diagnostic {
  const diagnostic = new Parser(source, { settings }).parse().diagnostics[0];
  if (!diagnostic) throw new Error("expected a parse error");
  return diagnostic;
}

async function runtimeError(source: string, settings: Partial<EngineSettings> = {}): Promise<Diagnostic> {
  const result = await new Interpreter({ settings }).run(source, createBrowserRuntime().runtime);
  const diagnostic = result.diagnostics[0];
  if (!diagnostic) throw new Error("expected a runtime error");
  return diagnostic;
}

describe("engine messages", () => {
  it("gives every code a Spanish text with the same placeholders", () => {
    for (const [code, template] of Object.entries(engineMessageTemplates)) {
      const spanish = esDictionary.engineMessages[code as keyof typeof engineMessageTemplates];
      expect([code, placeholders(spanish)]).toEqual([code, placeholders(template)]);
    }
  });

  it("formats an undefined variable in each locale", async () => {
    const diagnostic = await runtimeError(`Proceso P\n  Escribir x\nFinProceso`, { forceDefineVars: true });
    expect(diagnostic.code).toBe("RUNTIME_DEFINE_REQUIRED_READ");
    expect(formatDiagnostic(diagnostic, esDictionary)).toBe(
      'La variable "x" no está definida. Defínela con Definir antes de usarla.'
    );
    expect(formatDiagnostic(diagnostic, enDictionary)).toBe(
      'The variable "x" must be declared with Definir before you use it.'
    );
  });

  it("formats a missing FinSi in each locale", () => {
    const diagnostic = parseError(`Proceso P\n  Si 1 > 0 Entonces\n    Escribir 1\nFinProceso`);
    expect(diagnostic).toMatchObject({ code: "PARSE_MISSING_CLOSER", line: 2 });
    expect(formatDiagnostic(diagnostic, esDictionary)).toBe("Falta FinSi para cerrar el bloque Si.");
    expect(formatDiagnostic(diagnostic, enDictionary)).toBe("Missing FinSi to close Si.");
  });

  it("formats a division by zero in each locale", async () => {
    const diagnostic = await runtimeError(`Proceso P\n  Escribir 1 / 0\nFinProceso`);
    expect(diagnostic.code).toBe("RUNTIME_DIVISION_BY_ZERO");
    expect(formatDiagnostic(diagnostic, esDictionary)).toBe("División por cero.");
    expect(formatDiagnostic(diagnostic, enDictionary)).toBe("Division by zero.");
  });

  it("translates type names in params", () => {
    const diagnostic = parseError(`Proceso P\n  Definir n Como Entero\n  n <- "hola"\nFinProceso`);
    expect(diagnostic.params).toEqual({ valueType: "str", name: "n", targetType: "num" });
    expect(formatDiagnostic(diagnostic, esDictionary)).toBe(
      'No coinciden los tipos: no se puede asignar un valor de texto a "n" (numérico).'
    );
  });

  it("keeps the English text as the engine's raw message", () => {
    const diagnostic = parseError(`Proceso P\n  Escribir\nFinProceso`);
    expect(diagnostic.message).toBe(formatDiagnostic(diagnostic, enDictionary));
  });

  it("falls back to the raw message for unknown codes", () => {
    const diagnostic: Diagnostic = { message: "raw", line: 1, column: 1, severity: "error", code: "SOMETHING_NEW" };
    expect(formatDiagnostic(diagnostic, esDictionary)).toBe("raw");
    expect(formatDiagnostic({ ...diagnostic, code: undefined }, esDictionary)).toBe("raw");
  });
});
