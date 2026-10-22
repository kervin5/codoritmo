/**
 * @jest-environment node
 */
import { examplePrograms, exampleTopics } from "../engine";
import {
  exampleIdFromSlug,
  examplePath,
  exampleSlug,
  slugify,
  topicFromSlug,
  topicSlug,
  workspaceExampleFromSearch,
  workspaceExampleHref,
} from "../lib/example-urls";

describe("example URLs", () => {
  it("slugifies accents and punctuation", () => {
    expect(slugify("¿Puedo votar?")).toBe("puedo-votar");
    expect(slugify("Índice de masa corporal")).toBe("indice-de-masa-corporal");
  });

  it.each(["es", "en"] as const)("gives every example a unique, reversible %s slug", (locale) => {
    const slugs = examplePrograms.map((e) => exampleSlug(locale, e.id));
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const e of examplePrograms) {
      expect(exampleSlug(locale, e.id)).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(exampleIdFromSlug(locale, exampleSlug(locale, e.id))).toBe(e.id);
    }
    for (const topic of exampleTopics) expect(topicFromSlug(locale, topicSlug(locale, topic))).toBe(topic);
  });

  it("localizes paths", () => {
    expect(examplePath("es", "bubble-sort")).toMatch(/^\/es\/ejemplos\/ordenamiento-burbuja/);
    expect(examplePath("en", "bubble-sort")).toMatch(/^\/en\/examples\/bubble-sort/);
  });

  it("round-trips the workspace deep link and ignores unknown ids", () => {
    expect(workspaceExampleFromSearch(workspaceExampleHref("es", "quicksort").split("?")[1])).toBe("quicksort");
    expect(workspaceExampleFromSearch("?ejemplo=nope")).toBeNull();
  });
});
