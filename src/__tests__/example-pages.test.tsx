import { cleanup, render, screen, within } from "@testing-library/react";

import SectionLayout, { generateStaticParams as sectionStaticParams } from "../../app/[lang]/[section]/layout";
import IndexPage, { generateMetadata as indexMetadata } from "../../app/[lang]/[section]/page";
import ExamplePage, {
  generateMetadata as exampleMetadata,
  generateStaticParams as exampleStaticParams,
} from "../../app/[lang]/[section]/[slug]/page";
import TopicPage, {
  generateMetadata as topicMetadata,
  generateStaticParams as topicStaticParams,
} from "../../app/[lang]/[section]/[slug]/[topic]/page";
import { renderUrlset, sitemapEntries } from "../seo/sitemaps";
import { runExample, runExampleUncached } from "../components/examples-site/content";
import { examplePrograms, exampleTopics } from "../engine";
import { locales, type Locale } from "../i18n/config";
import { enDictionary } from "../i18n/en";
import { esDictionary } from "../i18n/es";
import {
  examplePath,
  examplesIndexPath,
  examplesSection,
  exampleSlug,
  topicPath,
  topicSection,
  topicSlug,
  workspaceExampleHref,
} from "../lib/example-urls";
import { siteUrl } from "../seo/site";

const dictionaries = { es: esDictionary, en: enDictionary };
const other = (locale: Locale): Locale => (locale === "es" ? "en" : "es");
const abs = (path: string) => `${siteUrl}${path}`;

function sectionParams(locale: Locale) {
  return { lang: locale, section: examplesSection[locale] };
}

async function expectNotFound(promise: Promise<unknown>) {
  await expect(promise).rejects.toMatchObject({ digest: expect.stringContaining("404") });
}

function jsonLd(container: HTMLElement) {
  const script = container.querySelector('script[type="application/ld+json"]');
  expect(script).not.toBeNull();
  return JSON.parse(script!.innerHTML);
}

afterEach(cleanup);

describe("static params", () => {
  it("generates only each locale's own section, so the wrong-locale section has no page", () => {
    expect(sectionStaticParams({ params: { lang: "es" } })).toContainEqual({ section: "ejemplos" });
    expect(sectionStaticParams({ params: { lang: "es" } })).not.toContainEqual({ section: "examples" });
    expect(sectionStaticParams({ params: { lang: "en" } })).toContainEqual({ section: "examples" });
    expect(sectionStaticParams({ params: { lang: "en" } })).not.toContainEqual({ section: "ejemplos" });
  });

  it.each(locales)("generates every example and topic page for %s", (locale) => {
    const section = sectionParams(locale).section;
    const examples = exampleStaticParams({ params: { lang: locale } }).filter((p) => p.section === section);
    expect(examples).toHaveLength(examplePrograms.length);
    expect(examples).toContainEqual({ lang: locale, section, slug: exampleSlug(locale, "bubble-sort") });

    const topics = topicStaticParams({ params: { lang: locale } }).filter((p) => p.slug === topicSection[locale]);
    expect(topics).toHaveLength(exampleTopics.length);
    expect(topics).toContainEqual({ lang: locale, section, slug: topicSection[locale], topic: topicSlug(locale, "sorting") });
  });

  it("generates nothing under a wrong-locale section", () => {
    expect(exampleStaticParams({ params: { lang: "en" } }).some((p) => p.section === "ejemplos")).toBe(false);
    expect(topicStaticParams({ params: { lang: "es" } }).some((p) => p.section === "examples")).toBe(false);
  });
});

describe("wrong-locale sections 404", () => {
  it.each([
    ["en", "ejemplos"],
    ["es", "examples"],
    ["es", "otra-cosa"],
  ])("/%s/%s", async (lang, section) => {
    await expectNotFound(SectionLayout({ children: null, params: Promise.resolve({ lang, section }) }));
    await expectNotFound(IndexPage({ params: Promise.resolve({ lang, section }) }));
    await expectNotFound(
      ExamplePage({ params: Promise.resolve({ lang, section, slug: exampleSlug("es", "bubble-sort") }) }),
    );
  });

  it("404s a Spanish slug under the English section and vice versa", async () => {
    await expectNotFound(
      ExamplePage({ params: Promise.resolve({ ...sectionParams("en"), slug: exampleSlug("es", "bubble-sort") }) }),
    );
    await expectNotFound(
      TopicPage({
        params: Promise.resolve({ ...sectionParams("es"), slug: "topic", topic: topicSlug("es", "sorting") }),
      }),
    );
  });
});

describe.each(locales)("pages render (%s)", (locale) => {
  const dictionary = dictionaries[locale];

  it("renders the index with every topic and example", async () => {
    const { container } = render(await IndexPage({ params: Promise.resolve(sectionParams(locale)) }));
    expect(screen.getByRole("heading", { level: 1, name: dictionary.examplePages.heading })).toBeInTheDocument();
    for (const topic of exampleTopics) {
      expect(
        screen.getByRole("heading", { level: 2, name: dictionary.studio.examples.topics[topic] }),
      ).toBeInTheDocument();
    }
    for (const example of examplePrograms) {
      expect(container.querySelector(`a[href="${examplePath(locale, example.id)}"]`)).not.toBeNull();
    }
    const data = jsonLd(container);
    const page = data["@graph"].find((node: { "@type": string }) => node["@type"] === "CollectionPage");
    expect(page.mainEntity.itemListElement).toHaveLength(exampleTopics.length);
  });

  it.each(exampleTopics)("renders the %s topic page", async (topic) => {
    const { container } = render(
      await TopicPage({
        params: Promise.resolve({ ...sectionParams(locale), slug: topicSection[locale], topic: topicSlug(locale, topic) }),
      }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: dictionary.studio.examples.topics[topic] }),
    ).toBeInTheDocument();
    const cards = examplePrograms.filter((e) => e.topic === topic);
    for (const example of cards) {
      expect(screen.getByRole("link", { name: dictionary.examples[example.id].label })).toHaveAttribute(
        "href",
        examplePath(locale, example.id),
      );
    }
    const graph = jsonLd(container)["@graph"];
    expect(graph.map((node: { "@type": string }) => node["@type"])).toEqual(["CollectionPage", "BreadcrumbList"]);
  });

  it.each(examplePrograms.map((e) => e.id))("renders the %s example page", async (id) => {
    const example = examplePrograms.find((e) => e.id === id)!;
    const copy = dictionary.examples[id];
    const { container } = render(
      await ExamplePage({ params: Promise.resolve({ ...sectionParams(locale), slug: exampleSlug(locale, id) }) }),
    );

    expect(screen.getByRole("heading", { level: 1, name: copy.label })).toBeInTheDocument();
    expect(screen.getByText(copy.learn)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: dictionary.examplePages.openInCodoritmo })[0]).toHaveAttribute(
      "href",
      workspaceExampleHref(locale, id),
    );
    // Breadcrumbs: Examples › Topic › Example.
    const crumbs = within(screen.getByRole("navigation", { name: dictionary.examplePages.breadcrumbLabel }));
    expect(crumbs.getByRole("link", { name: dictionary.appShell.examples })).toHaveAttribute("href", examplesIndexPath(locale));
    expect(crumbs.getByRole("link", { name: dictionary.studio.examples.topics[example.topic] })).toHaveAttribute(
      "href",
      topicPath(locale, example.topic),
    );
    // Highlighted code, flowchart SVG, sample run and the hint inside <details>.
    expect(container.querySelector("pre code")?.textContent).toContain(example.source.split("\n")[0].trim());
    expect(container.querySelectorAll('svg[role="img"]').length).toBeGreaterThan(0);
    expect(screen.getByTestId("sample-run").textContent?.length).toBeGreaterThan(0);
    expect(container.querySelector("details summary")?.textContent).toBe(dictionary.examplePages.showHint);
    if (example.complexity) expect(screen.getByRole("table")).toHaveTextContent(example.complexity.worst);

    const graph = jsonLd(container)["@graph"];
    const resource = graph.find((node: { "@type": string }) => node["@type"] === "LearningResource");
    expect(resource.hasPart["@type"]).toBe("SoftwareSourceCode");
    expect(resource.hasPart.text).toBe(example.source);
    expect(resource.url).toBe(abs(examplePath(locale, id)));
    const breadcrumbs = graph.find((node: { "@type": string }) => node["@type"] === "BreadcrumbList");
    expect(breadcrumbs.itemListElement).toHaveLength(3);
    // The serialized JSON-LD must not contain raw "<" (the code has "<-").
    expect(container.querySelector('script[type="application/ld+json"]')!.innerHTML).not.toContain("<");
  });
});

describe("metadata", () => {
  it.each(locales)("index canonical and hreflang (%s)", async (locale) => {
    const metadata = await indexMetadata({ params: Promise.resolve(sectionParams(locale)) });
    expect(metadata.alternates?.canonical).toBe(abs(examplesIndexPath(locale)));
    expect(metadata.alternates?.languages).toMatchObject({
      es: abs("/es/ejemplos"),
      en: abs("/en/examples"),
      "x-default": abs("/es/ejemplos"),
    });
  });

  it.each(locales)("topic canonical and hreflang point to the translated slug (%s)", async (locale) => {
    const metadata = await topicMetadata({
      params: Promise.resolve({ ...sectionParams(locale), slug: topicSection[locale], topic: topicSlug(locale, "sorting") }),
    });
    expect(metadata.alternates?.canonical).toBe(abs(topicPath(locale, "sorting")));
    expect(metadata.alternates?.languages).toMatchObject({
      [other(locale)]: abs(topicPath(other(locale), "sorting")),
    });
    expect(metadata.title).toContain(dictionaries[locale].studio.examples.topics.sorting);
  });

  it.each(examplePrograms.flatMap((e) => locales.map((locale) => [locale, e.id] as const)))(
    "example canonical, hreflang and images (%s %s)",
    async (locale, id) => {
      const metadata = await exampleMetadata({
        params: Promise.resolve({ ...sectionParams(locale), slug: exampleSlug(locale, id) }),
      });
      expect(metadata.alternates?.canonical).toBe(abs(examplePath(locale, id)));
      expect(metadata.alternates?.languages).toEqual({
        es: abs(examplePath("es", id)),
        en: abs(examplePath("en", id)),
        "x-default": abs(examplePath("es", id)),
      });
      expect(metadata.title).toContain(dictionaries[locale].examples[id].label);
      expect(String(metadata.description).length).toBeLessThanOrEqual(160);
      expect(metadata.openGraph).toMatchObject({
        url: abs(examplePath(locale, id)),
        images: [expect.objectContaining({ url: abs(`${examplePath(locale, id)}/og.png`) })],
      });
      expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
    },
  );

  it("uses different slugs per locale for the same example", () => {
    expect(examplePath("es", "bubble-sort")).toBe("/es/ejemplos/ordenamiento-burbuja");
    expect(examplePath("en", "bubble-sort")).toBe("/en/examples/bubble-sort");
  });
});

describe("sitemap", () => {
  it("lists every index, topic and example page in both locales, with translations", () => {
    const entries = sitemapEntries("examples");
    const urls = new Set(entries.map((entry) => entry.url));
    for (const locale of locales) {
      expect(urls).toContain(abs(examplesIndexPath(locale)));
      for (const topic of exampleTopics) expect(urls).toContain(abs(topicPath(locale, topic)));
      for (const example of examplePrograms) expect(urls).toContain(abs(examplePath(locale, example.id)));
    }
    expect(entries.length).toBe(2 * (1 + exampleTopics.length + examplePrograms.length));
    const bubble = entries.find((entry) => entry.url === abs(examplePath("es", "bubble-sort")));
    expect(bubble?.alternates?.languages).toMatchObject({ en: abs(examplePath("en", "bubble-sort")) });
  });

  it("writes hreflang alternates into the XML", () => {
    const xml = renderUrlset(sitemapEntries("examples"));
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(xml).toContain(`<xhtml:link rel="alternate" hreflang="en" href="${abs(examplePath("en", "bubble-sort"))}" />`);
  });
});

describe("build-time sample run", () => {
  it("shows the program's output with the sample answers", async () => {
    const greeting = examplePrograms.find((e) => e.id === "greeting")!;
    const answers = greeting.input!.split("\n").filter(Boolean);
    const { container } = render(
      await ExamplePage({ params: Promise.resolve({ ...sectionParams("es"), slug: exampleSlug("es", "greeting") }) }),
    );
    const transcript = screen.getByTestId("sample-run");
    const typed = Array.from(transcript.querySelectorAll("kbd")).map((kbd) => kbd.textContent);
    expect(typed).toEqual(answers.map((answer) => expect.stringContaining(answer)));
    // Output lines come from Escribir, e.g. the greeting mentions the name typed.
    expect(transcript.textContent).toContain(answers[0]);
    expect(container.querySelectorAll("kbd").length).toBe(answers.length);
  });

  it("is deterministic for examples that use random numbers", async () => {
    const random = examplePrograms.filter((e) => e.concepts.includes("azar"));
    expect(random.length).toBeGreaterThan(0);
    for (const example of random) {
      const first = await runExampleUncached(example);
      const second = await runExampleUncached(example);
      expect(second).toEqual(first);
    }
  });

  it("runs every example to completion without errors", async () => {
    for (const example of examplePrograms) {
      const run = await runExample(example);
      expect(run.lines.filter((line) => line.kind === "err")).toEqual([]);
      expect(run.lines.some((line) => line.kind === "out" && line.text.trim() !== "")).toBe(true);
    }
  });
});
