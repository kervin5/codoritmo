import { TextEncoder as NodeTextEncoder } from "util";

import { cleanup, render, within } from "@testing-library/react";

import GroupPage, {
  generateMetadata as groupMetadata,
  generateStaticParams as groupStaticParams,
} from "../../app/[lang]/[section]/[slug]/[topic]/page";
import { ConceptPage, conceptSegment, conceptSitemapEntries, conceptSlugs } from "../components/site/concepts";
import { CONCEPT_REFERENCES, conceptPath, concepts, conceptsCopy, examplesWithConcept } from "../components/site/concepts/data";
import { referenceCopy, referencePath, referenceSettings } from "../components/site/reference/catalog";
import { runProgram } from "../components/site/reference/run";
import { exampleConcepts, examplePrograms, Parser } from "../engine";
import { locales, type Locale } from "../i18n/config";
import { examplePath, examplesSection } from "../lib/example-urls";
import { siteUrl } from "../seo/site";

// jsdom has no TextEncoder; workspaceProgramHref (the "open in Codoritmo" link) needs it.
if (typeof globalThis.TextEncoder === "undefined") Object.assign(globalThis, { TextEncoder: NodeTextEncoder });

const other = (locale: Locale): Locale => (locale === "es" ? "en" : "es");
const abs = (path: string) => `${siteUrl}${path}`;
const SITE_SUFFIX = " | Codoritmo".length;

afterEach(cleanup);

describe.each(locales)("concept copy (%s)", (locale) => {
  const copy = conceptsCopy[locale];

  it("covers every concept of the example library", () => {
    expect(Object.keys(copy.concepts).sort()).toEqual([...exampleConcepts].sort());
    expect(concepts).toHaveLength(21);
  });

  it("uses unique, URL-safe slugs and unique titles and headings", () => {
    const slugs = conceptSlugs(locale);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    const all = Object.values(copy.concepts);
    for (const key of ["title", "description", "h1"] as const) expect(new Set(all.map((c) => c[key])).size).toBe(all.length);
  });

  it.each(concepts)("%s: title, description and explanation fit", (concept) => {
    const entry = copy.concepts[concept];
    expect(entry.title.length + SITE_SUFFIX).toBeLessThanOrEqual(60);
    expect(entry.description.length).toBeLessThanOrEqual(155);
    expect(entry.paragraphs.length).toBeGreaterThanOrEqual(2);
    expect(entry.paragraphs.length).toBeLessThanOrEqual(4);
  });

  it.each(concepts)("%s: the short example runs without errors", async (concept) => {
    const { snippet, input } = copy.concepts[concept];
    const parsed = new Parser(snippet, { settings: referenceSettings }).parse();
    expect(parsed.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    const run = await runProgram(snippet, { input, seed: concept, settings: referenceSettings });
    expect(run.failed).toBe(false);
    expect(run.lines.some((line) => line.kind === "out" && line.text.trim())).toBe(true);
    // Every sample answer is used.
    expect(run.lines.filter((line) => line.kind === "in")).toHaveLength(input ? input.split("\n").length : 0);
  });

  it.each(concepts)("%s: links to reference pages that exist", (concept) => {
    for (const id of CONCEPT_REFERENCES[concept]) expect(referenceCopy[locale].entries[id]).toBeDefined();
  });
});

describe("concept snippets say what they claim", () => {
  const output = async (locale: Locale, concept: (typeof concepts)[number]) => {
    const { snippet, input } = conceptsCopy[locale].concepts[concept];
    const run = await runProgram(snippet, { input, seed: concept, settings: referenceSettings });
    return run.lines.filter((l) => l.kind === "out").map((l) => l.text);
  };

  it("swaps through Por Referencia", async () => {
    expect(await output("es", "referencia")).toEqual(["p = 2, q = 1"]);
  });

  it("passes numbers by value and arrays by reference unless told otherwise, as the copy says", async () => {
    const source =
      "SubProceso Cambiar(n, arr)\n\tn <- 0\n\tarr[1] <- 0\nFinSubProceso\n\nAlgoritmo P\n\tDimension datos[1]\n\tdatos[1] <- 5\n\tx <- 5\n\tCambiar(x, datos)\n\tEscribir x, \" \", datos[1]\nFinAlgoritmo";
    const run = await runProgram(source, { seed: "ref", settings: referenceSettings });
    expect(run.lines.map((l) => l.text)).toEqual(["5 0"]);
  });

  it("computes the factorial recursively", async () => {
    expect(await output("en", "recursion")).toEqual(["5! = 120"]);
  });

  it("grows a list with Redimensionar", async () => {
    expect(await output("es", "redimensionar")).toEqual(["1. pan", "2. leche"]);
  });

  it("evaluates colloquial conditions", async () => {
    expect((await output("es", "coloquial")).slice(1)).toEqual(["40 es par", "40 es múltiplo de 5"]);
  });
});

describe.each(locales)("concept pages render (%s)", (locale) => {
  const section = examplesSection[locale];

  it.each(concepts)("renders the %s page with every example that uses it", async (concept) => {
    const copy = conceptsCopy[locale].concepts[concept];
    const params = Promise.resolve({ lang: locale, section, slug: conceptSegment[locale], topic: copy.slug });
    const element = await GroupPage({ params });
    expect(element.type).toBe(ConceptPage);
    const { container } = render((await ConceptPage({ locale, slug: copy.slug }))!);
    const view = within(container);

    expect(view.getByRole("heading", { level: 1 }).textContent).toBe(copy.h1);
    const examples = examplesWithConcept(concept);
    expect(examples.length).toBe(examplePrograms.filter((e) => e.concepts.includes(concept)).length);
    for (const example of examples) expect(container.querySelector(`a[href="${examplePath(locale, example.id)}"]`)).not.toBeNull();
    for (const id of CONCEPT_REFERENCES[concept]) expect(container.querySelector(`a[href="${referencePath(locale, id)}"]`)).not.toBeNull();
    expect(container.querySelector(`a[href^="/${locale}#u="]`)).not.toBeNull();

    const graph = JSON.parse(container.querySelector('script[type="application/ld+json"]')!.innerHTML)["@graph"];
    expect(graph[0]["@type"]).toBe("CollectionPage");
    expect(graph[0].mainEntity.numberOfItems).toBe(examples.length);
    expect(graph[1]["@type"]).toBe("BreadcrumbList");

    const metadata = await groupMetadata({ params });
    expect(metadata.title).toBe(copy.title);
    expect(metadata.alternates?.canonical).toBe(abs(conceptPath(locale, concept)));
    expect(metadata.alternates?.languages).toMatchObject({
      [other(locale)]: abs(conceptPath(other(locale), concept)),
      "x-default": abs(conceptPath("es", concept)),
    });
  });

  it("404s an unknown concept and the other locale's slug", async () => {
    const slug = conceptsCopy[other(locale)].concepts.arreglos.slug === conceptsCopy[locale].concepts.arreglos.slug
      ? "no-existe"
      : conceptsCopy[other(locale)].concepts.arreglos.slug;
    await expect(
      GroupPage({ params: Promise.resolve({ lang: locale, section, slug: conceptSegment[locale], topic: slug }) }),
    ).rejects.toMatchObject({ digest: expect.stringContaining("404") });
  });
});

describe("concept static params and sitemap", () => {
  it("prerenders every concept page", () => {
    const params = groupStaticParams({ params: {} });
    for (const locale of locales) {
      for (const topic of conceptSlugs(locale)) {
        expect(params).toContainEqual({ lang: locale, section: examplesSection[locale], slug: conceptSegment[locale], topic });
      }
    }
  });

  it("lists every concept page in both locales, with alternates", () => {
    const entries = conceptSitemapEntries();
    expect(entries).toHaveLength(concepts.length * locales.length);
    for (const entry of entries) {
      expect(Object.keys(entry.alternates?.languages ?? {}).sort()).toEqual(["en", "es", "x-default"]);
    }
  });
});
