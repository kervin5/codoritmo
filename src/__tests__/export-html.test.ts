import { Parser } from "../engine";
import { generateExport } from "../engine/generators";
import { appExamples, interpreterOutput, runtimePrograms, upstreamSamples } from "./helpers/export-languages";

// Upstream's HTML export is its JavaScript export inside a page; ours embeds
// the standalone browser export and shows its output on the page.
describe("html export", () => {
  it.each([...upstreamSamples(), ...appExamples()].map((sample) => [sample.name, sample] as const))(
    "translates %s",
    (_name, sample) => {
      const code = generateExport(sample.program, "html").code!;
      expect(code).toMatch(/^<!DOCTYPE html>/);
      expect(code).toContain('<pre id="salida"></pre>');
      expect(code.match(/<\/script>/g)).toHaveLength(2);
    }
  );

  it.each(Object.keys(runtimePrograms))("runs %s in a page like the interpreter", async (name) => {
    const code = generateExport(new Parser(runtimePrograms[name]).parse().program!, "html").code!;
    const page = new DOMParser().parseFromString(code, "text/html");
    const saved = { log: console.log, error: console.error, clear: console.clear };
    document.body.innerHTML = '<pre id="salida"></pre>';
    try {
      // Runs the page's scripts in order, as the browser would.
      for (const script of Array.from(page.querySelectorAll("script"))) {
        (0, eval)(script.textContent!);
      }
      const salida = document.getElementById("salida")!;
      for (let attempt = 0; attempt < 50 && !salida.textContent?.trim(); attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(salida.textContent!.trimEnd()).toBe((await interpreterOutput(runtimePrograms[name])).trimEnd());
    } finally {
      Object.assign(console, saved);
      document.body.innerHTML = "";
    }
  });
});
