import { createBrowserRuntime, defaultEngineSettings, Interpreter, Parser } from "../engine";
import { getOperatorGroups, getStructureSnippets } from "../components/ide/snippets";
import { guideOperators } from "../components/workspace/reference-panel";
import { enDictionary } from "../i18n/en";
import { esDictionary } from "../i18n/es";

const ROUTINE = /^(SubProceso|SubAlgoritmo|Funcion)\b/;

function program(example: string): string {
  return ROUTINE.test(example) ? `${example}\n\nAlgoritmo P\nFinAlgoritmo\n` : `Algoritmo P\n${example}\nFinAlgoritmo\n`;
}

describe.each([
  ["es", esDictionary, "Muestra: "],
  ["en", enDictionary, "Shows: "],
] as const)("reference guide (%s)", (_locale, dictionary, shows) => {
  const settings = defaultEngineSettings;
  const ids = [getStructureSnippets(settings, dictionary), ...getOperatorGroups({ ...settings, enableStringFunctions: true }, dictionary)]
    .flatMap((group) => group.items.flatMap((item) => [item.id, ...(item.variants ?? []).map((v) => v.id)]));
  const fill = (text: string) => guideOperators(text, settings);

  it("explains every reference entry", () => {
    const missing = ids.filter((id) => !dictionary.referenceGuide[id]);
    expect(missing).toEqual([]);
  });

  it.each(Object.entries(dictionary.referenceGuide))("%s: the example is valid pseudocode", (_id, entry) => {
    const parsed = new Parser(program(fill(entry.example)), { settings }).parse();
    expect(parsed.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });

  it.each(Object.entries(dictionary.referenceGuide).filter(([, e]) => e.outcome.startsWith(shows)))(
    "%s: the stated result is what the engine prints",
    async (_id, entry) => {
      const controller = createBrowserRuntime();
      const result = await new Interpreter({ settings }).run(program(fill(entry.example)), controller.runtime);
      expect(result.diagnostics).toEqual([]);
      const expected = fill(entry.outcome).slice(shows.length).replace(/ \(.*\)$/, "");
      expect(controller.getOutput().join("\n")).toBe(expected);
    }
  );
});
