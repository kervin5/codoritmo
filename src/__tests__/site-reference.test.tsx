import { TextEncoder as NodeTextEncoder } from "util";
import { cleanup, render, within } from "@testing-library/react";

import SectionPage, { generateMetadata as sectionMetadata } from "../../app/[lang]/[section]/page";
import ChildPage, {
  generateMetadata as childMetadata,
  generateStaticParams as childStaticParams,
} from "../../app/[lang]/[section]/[slug]/page";
import { getOperatorGroups, getStructureSnippets } from "../components/ide/snippets";
import { ReferenceIndexPage, ReferencePage, referenceSitemapEntries, referenceSlugs } from "../components/site/reference";
import { referenceCatalog, referenceCopy, referenceIds, referencePath, referenceSettings } from "../components/site/reference/catalog";
import { runProgram } from "../components/site/reference/run";
import { Parser } from "../engine";
import { locales, type Locale } from "../i18n/config";
import { enDictionary } from "../i18n/en";
import { esDictionary } from "../i18n/es";
import { siteUrl } from "../seo/site";

const dictionaries = { es: esDictionary, en: enDictionary };
const segment = { es: "referencia", en: "reference" } as const;
const other = (locale: Locale): Locale => (locale === "es" ? "en" : "es");
const abs = (path: string) => `${siteUrl}${path}`;
const SITE_SUFFIX = " | Codoritmo".length;

// jsdom has no TextEncoder; workspaceProgramHref (the "open in Codoritmo" link) needs it.
if (typeof globalThis.TextEncoder === "undefined") Object.assign(globalThis, { TextEncoder: NodeTextEncoder });

afterEach(cleanup);

function jsonLd(container: HTMLElement) {
  const script = container.querySelector('script[type="application/ld+json"]');
  expect(script).not.toBeNull();
  return JSON.parse(script!.innerHTML);
}

describe.each(locales)("reference catalog (%s)", (locale) => {
  const dictionary = dictionaries[locale];
  const copy = referenceCopy[locale];
  const entries = referenceCatalog(locale, dictionary).flatMap((group) => group.entries);

  it("has a page for every entry of the workspace reference, except the merged near-duplicates", () => {
    const ids = [getStructureSnippets(referenceSettings, dictionary), ...getOperatorGroups(referenceSettings, dictionary)].flatMap((group) =>
      group.items.flatMap((item) => [item.id, ...(item.variants ?? []).map((v) => v.id)]),
    );
    const expected = ids.filter((id) => !["rutina", "escribir-linea", "repetir-hasta"].includes(id));
    expect(entries.map((e) => e.id).sort()).toEqual([...expected].sort());
    expect([...referenceIds].sort()).toEqual([...expected].sort());
  });

  it("uses unique, URL-safe slugs", () => {
    const slugs = referenceSlugs(locale);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("gives every page a unique title (fits 60 with the site name), description (≤ 155) and h1", () => {
    const all = Object.values(copy.entries);
    for (const entry of all) {
      expect(entry.title.length + SITE_SUFFIX).toBeLessThanOrEqual(60);
      expect(entry.description.length).toBeLessThanOrEqual(155);
    }
    expect(copy.index.title.length + SITE_SUFFIX).toBeLessThanOrEqual(60);
    expect(copy.index.description.length).toBeLessThanOrEqual(155);
    for (const key of ["title", "description", "h1", "name"] as const) {
      expect(new Set(all.map((e) => e[key])).size).toBe(all.length);
    }
  });

  it.each(entries.map((e) => [e.id, e] as const))("%s: the worked example is a complete program that runs", async (_id, entry) => {
    for (const worked of [entry.example, ...entry.more]) {
      const parsed = new Parser(worked.program, { settings: referenceSettings }).parse();
      expect(parsed.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
      const run = await runProgram(worked.program, { input: worked.input, seed: entry.id, settings: referenceSettings });
      expect(run.lines.filter((line) => line.kind === "err")).toEqual([]);
      const shows = locale === "es" ? "Muestra: " : "Shows: ";
      if (worked.outcome.startsWith(shows)) {
        const expected = worked.outcome.slice(shows.length).replace(/ \(.*\)$/, "");
        expect(run.lines.map((l) => l.text).join("\n")).toBe(expected);
      }
    }
  });
});

describe.each(locales)("reference pages render (%s)", (locale) => {
  const dictionary = dictionaries[locale];
  const section = segment[locale];

  it("renders the index with every entry, grouped", async () => {
    // The route renders <ReferenceIndexPage>; it must resolve to it (and render on its own).
    const element = await SectionPage({ params: Promise.resolve({ lang: locale, section }) });
    expect(element.type).toBe(ReferenceIndexPage);
    const { container } = render(await ReferenceIndexPage({ locale }));
    const main = within(container);
    expect(main.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    for (const id of referenceIds) {
      expect(container.querySelector(`a[href="${referencePath(locale, id)}"]`)).not.toBeNull();
    }
    const data = jsonLd(container);
    expect(data["@graph"][0]["@type"]).toBe("DefinedTermSet");
    expect(data["@graph"][0].hasDefinedTerm).toHaveLength(referenceIds.length);
    const metadata = await sectionMetadata({ params: Promise.resolve({ lang: locale, section }) });
    expect(metadata.alternates?.canonical).toBe(abs(`/${locale}/${section}`));
  });

  it.each(referenceIds)("renders the %s page", async (id) => {
    const slug = referenceCopy[locale].entries[id].slug;
    const params = Promise.resolve({ lang: locale, section, slug });
    const element = await ChildPage({ params });
    expect(element.type).toBe(ReferencePage);
    expect(element.props).toEqual({ locale, slug });
    const { container } = render((await ReferencePage({ locale, slug }))!);
    const view = within(container);
    const copy = referenceCopy[locale].entries[id];

    expect(view.getByRole("heading", { level: 1 }).textContent).toBe(copy.h1);
    // Breadcrumbs: visible and as JSON-LD.
    expect(view.getByRole("navigation", { name: dictionary.examplePages.breadcrumbLabel })).toBeInTheDocument();
    const graph = jsonLd(container)["@graph"];
    expect(graph[0]["@type"]).toBe("TechArticle");
    expect(graph[0].about["@type"]).toBe("DefinedTerm");
    expect(graph[1]["@type"]).toBe("BreadcrumbList");
    // The call to action opens the workspace with the program loaded.
    const open = container.querySelector(`a[href^="/${locale}#u="]`);
    expect(open).not.toBeNull();
    // The worked example is a complete algorithm.
    expect(container.querySelector("pre code")?.textContent).toMatch(/Algoritmo/);
    // Flowchart scenes are described for screen readers.
    const svg = container.querySelector('svg[role="img"]');
    if (svg) expect(svg.getAttribute("aria-label")?.length).toBeGreaterThan(20);
    // Hreflang points at the translated slug.
    const metadata = await childMetadata({ params });
    expect(metadata.title).toBe(copy.title);
    expect(metadata.alternates?.canonical).toBe(abs(referencePath(locale, id)));
    expect(metadata.alternates?.languages).toMatchObject({
      [other(locale)]: abs(referencePath(other(locale), id)),
      "x-default": abs(referencePath("es", id)),
    });
  });

  it("404s the other locale's slug", async () => {
    const slug = referenceCopy[other(locale)].entries["si-sino"].slug;
    await expect(ChildPage({ params: Promise.resolve({ lang: locale, section, slug }) })).rejects.toMatchObject({
      digest: expect.stringContaining("404"),
    });
  });
});

describe("reference static params and sitemap", () => {
  it("prerenders every reference page", () => {
    const params = childStaticParams({ params: {} });
    for (const locale of locales) {
      for (const slug of referenceSlugs(locale)) {
        expect(params).toContainEqual({ lang: locale, section: segment[locale], slug });
      }
    }
  });

  it("lists the index and every page in both locales, with alternates", () => {
    const entries = referenceSitemapEntries();
    expect(entries).toHaveLength((referenceIds.length + 1) * locales.length);
    expect(new Set(entries.map((e) => e.url)).size).toBe(entries.length);
    for (const entry of entries) {
      expect(entry.url.startsWith(siteUrl)).toBe(true);
      expect(Object.keys(entry.alternates?.languages ?? {}).sort()).toEqual(["en", "es", "x-default"]);
    }
  });
});
