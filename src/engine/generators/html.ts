import { JavaScriptGenerator } from "../generator";
import type { EngineSettings, GenerationResult, ProgramNode } from "../types";

export interface HtmlGeneratorOptions {
  settings?: Partial<EngineSettings>;
  /** Explanatory comments in the output (on by default). */
  comments?: boolean;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Exports pseudocode to a web page, like upstream PSeInt's HTML export: the
 * standalone browser JavaScript export inside a page that shows what the
 * program writes (Leer asks with the browser's prompt dialog).
 */
export class HtmlGenerator {
  constructor(private readonly options: HtmlGeneratorOptions = {}) {}

  generate(program: ProgramNode): GenerationResult {
    const script = new JavaScriptGenerator({ settings: this.options.settings }).generate(program, { target: "browser" });
    const title = escapeHtml(program.entry.name);
    // "</script" inside the code would end the script element.
    const code = (script.code ?? "").replace(/<\/(script)/gi, "<\\/$1");
    const comment =
      this.options.comments ?? true
        ? ["<!-- Este código fue generado por Codoritmo a partir del pseudocódigo. -->"]
        : [];
    const lines = [
      "<!DOCTYPE html>",
      ...comment,
      '<html lang="es">',
      "<head>",
      '  <meta charset="utf-8">',
      `  <title>${title}</title>`,
      "  <style>",
      "    body { font-family: system-ui, sans-serif; margin: 2rem; }",
      "    #salida { background: #111; color: #eee; padding: 1rem; min-height: 10rem; white-space: pre-wrap; }",
      "  </style>",
      "</head>",
      "<body>",
      `  <h1>${title}</h1>`,
      '  <pre id="salida"></pre>',
      "  <script>",
      "    // Lo que el programa escribe se muestra en la página (y en la consola).",
      "    (() => {",
      '      const salida = document.getElementById("salida");',
      "      const consola = { log: console.log.bind(console), error: console.error.bind(console) };",
      '      console.log = (...valores) => { salida.textContent += valores.join(" ") + "\\n"; consola.log(...valores); };',
      '      console.error = (...valores) => { salida.textContent += valores.join(" ") + "\\n"; consola.error(...valores); };',
      '      console.clear = () => { salida.textContent = ""; };',
      "    })();",
      "  </script>",
      "  <script>",
      code,
      "  </script>",
      "</body>",
      "</html>",
    ];
    return { code: `${lines.join("\n")}\n`, diagnostics: script.diagnostics };
  }
}
