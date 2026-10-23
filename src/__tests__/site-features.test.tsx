import { existsSync, statSync } from "fs";
import path from "path";

import { cleanup, render, screen, within } from "@testing-library/react";

import SectionPage, { generateMetadata as sectionMetadata } from "../../app/[lang]/[section]/page";
import {
  featureMetadata,
  FeaturePage,
  featureSitemapEntries,
  featureWorkspaceHref,
  screenshotPath,
} from "../components/site/features";
import {
  exampleById,
  FEATURE_EXAMPLE,
  FEATURE_RELATED_EXAMPLES,
  MAPPING_ROWS,
  mappingTable,
  schoolProfileCount,
  traceExample,
  translateExample,
  TRANSLATION_LANGUAGE,
} from "../components/site/features/data";
import { highlightGenerated } from "../components/site/features/highlight";
import { examplePrograms } from "../engine";
import { generatedProfiles } from "../engine/school-profiles";
import { locales, type Locale } from "../i18n/config";
import { featuresEn } from "../i18n/site/features-en";
import { featuresEs } from "../i18n/site/features-es";
import { featureIds, FEATURE_SLUGS, featurePath, sectionPath, type FeatureId } from "../seo/sections";
import { officialPseintUrl, siteUrl } from "../seo/site";

const copies = { es: featuresEs, en: featuresEn };
const abs = (p: string) => `${siteUrl}${p}`;
const cases = locales.flatMap((locale) => featureIds.map((id) => [locale, id] as [Locale, FeatureId]));

afterEach(cleanup);

function graphOf(container: HTMLElement) {
  const script = container.querySelector('script[type="application/ld+json"]');
  expect(script).not.toBeNull();
  return JSON.parse(script!.innerHTML)["@graph"] as Record<string, unknown>[];
}

function decodeProgram(href: string): { n: string; s: string; p: string } {
  const payload = href.split("#u=")[1];
  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
}

describe("feature copy", () => {
  it("has the same features and the same shape in both locales", () => {
    for (const locale of locales) expect(Object.keys(copies[locale].features).sort()).toEqual([...featureIds].sort());
    for (const id of featureIds) {
      expect(featuresEs.features[id].faq.length).toBe(featuresEn.features[id].faq.length);
      expect(featuresEs.features[id].steps.length).toBe(featuresEn.features[id].steps.length);
    }
  });

  it.each(cases)("%s %s: title, description and FAQ fit search limits", (locale, id) => {
    const copy = copies[locale].features[id];
    expect(copy.title.length).toBeLessThanOrEqual(60);
    expect(copy.description.length).toBeLessThanOrEqual(155);
    expect(copy.faq.length).toBeGreaterThanOrEqual(3);
    expect(copy.faq.length).toBeLessThanOrEqual(5);
    expect(copy.differences || copy.comparison).toBeTruthy();
  });

  it("gives every page a unique title and description", () => {
    const titles = cases.map(([locale, id]) => copies[locale].features[id].title);
    const descriptions = cases.map(([locale, id]) => copies[locale].features[id].description);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it("states the license as GPL v2 or later, never GPL 3", () => {
    const all = JSON.stringify(copies);
    expect(all).not.toMatch(/GPL[ -]?v?3/i);
    expect(all).toMatch(/GPL v2 o posterior/);
    expect(all).toMatch(/GPL v2 or later/);
  });
});

describe("feature metadata", () => {
  it.each(cases)("%s %s: canonical, hreflang, Open Graph and Twitter", async (locale, id) => {
    const metadata = await featureMetadata(locale, id);
    expect(metadata.title).toBe(copies[locale].features[id].title);
    expect(metadata.alternates?.canonical).toBe(abs(featurePath(locale, id)));
    expect(metadata.alternates?.languages).toEqual({
      es: abs(`/es/${FEATURE_SLUGS[id].es}`),
      en: abs(`/en/${FEATURE_SLUGS[id].en}`),
      "x-default": abs(`/es/${FEATURE_SLUGS[id].es}`),
    });
    expect(metadata.openGraph).toMatchObject({ url: abs(featurePath(locale, id)), type: "website" });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("is what the section route returns for a feature slug", async () => {
    const metadata = await sectionMetadata({ params: Promise.resolve({ lang: "es", section: "pseudocodigo-a-python" }) });
    expect(metadata.title).toBe(featuresEs.features["to-python"].title);
  });
});

describe("feature sitemap", () => {
  it("lists every feature page in both locales with its translations", () => {
    const entries = featureSitemapEntries();
    expect(entries).toHaveLength(featureIds.length * locales.length);
    for (const [locale, id] of cases) {
      const entry = entries.find((e) => e.url === abs(featurePath(locale, id)));
      expect(entry?.alternates?.languages).toEqual({
        es: abs(featurePath("es", id)),
        en: abs(featurePath("en", id)),
        "x-default": abs(featurePath("es", id)),
      });
    }
  });
});

describe("feature pages", () => {
  it.each(cases)("%s %s renders a complete page", async (locale, id) => {
    const { container } = render(await FeaturePage({ locale, id }));
    const copy = copies[locale].features[id];

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(copy.h1);
    expect(within(screen.getByRole("navigation", { name: /ruta|breadcrumb/i })).getByText(copy.name)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\{(profiles|examples)\}/);

    // The call to action opens the showcased program in the workspace.
    const ctas = screen.getAllByRole("link", { name: copy.cta });
    const example = exampleById(FEATURE_EXAMPLE[id]);
    for (const cta of ctas) {
      const href = cta.getAttribute("href")!;
      expect(href.startsWith(`/${locale}#u=`)).toBe(true);
      expect(decodeProgram(href).s).toBe(example.source);
    }

    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual(
      expect.arrayContaining([sectionPath(locale, "reference"), sectionPath(locale, "profiles"), sectionPath(locale, "examples"), officialPseintUrl])
    );
    for (const other of featureIds) if (other !== id) expect(hrefs).toContain(featurePath(locale, other));

    const graph = graphOf(container);
    const types = graph.map((node) => node["@type"]);
    expect(types).toEqual(expect.arrayContaining(["WebPage", "BreadcrumbList", "FAQPage", "WebApplication"]));
    const faq = graph.find((node) => node["@type"] === "FAQPage") as { mainEntity: { name: string }[] };
    expect(faq.mainEntity.map((q) => q.name)).toEqual(copy.faq.map((q) => q.q));
    const app = graph.find((node) => node["@type"] === "WebApplication")!;
    expect(app).toMatchObject({ isAccessibleForFree: true, license: "https://www.gnu.org/licenses/old-licenses/gpl-2.0.html" });
  });

  it("is what the section route renders for a feature slug", async () => {
    const element = await SectionPage({ params: Promise.resolve({ lang: "en", section: "online-trace-table" }) });
    expect(element.type).toBe(FeaturePage);
    expect(element.props).toEqual({ locale: "en", id: "desk-check" });
  });

  it.each(locales)("%s translation pages show the engine's real output", async (locale) => {
    for (const id of ["to-python", "to-c", "to-java"] as const) {
      const language = TRANSLATION_LANGUAGE[id]!;
      const { container } = render(await FeaturePage({ locale, id }));
      const generated = translateExample(exampleById(FEATURE_EXAMPLE[id]), language);
      // Each code line is [line number, text]; keep the text.
      const blocks = [...container.querySelectorAll("pre code")].map((code) =>
        [...code.children].map((line) => line.lastElementChild?.textContent ?? "").join("\n")
      );
      expect(blocks).toContain(generated.trimEnd().replace(/\t/g, "    "));
      cleanup();
    }
  });

  it("desk check page shows a trace with the sum of the sample answers", async () => {
    render(await FeaturePage({ locale: "es", id: "desk-check" }));
    const table = screen.getByRole("table", { name: /prueba de escritorio/i });
    expect(within(table).getAllByText("49.5").length).toBeGreaterThan(0);
    expect(within(table).getByRole("columnheader", { name: "suma" })).toBeInTheDocument();
  });

  it("flowchart page shows the generated SVG and the symbol legend", async () => {
    const { container } = render(await FeaturePage({ locale: "en", id: "flowchart" }));
    expect(container.querySelectorAll("svg[role=img]").length).toBeGreaterThanOrEqual(1 + FEATURE_RELATED_EXAMPLES.flowchart.length);
    expect(screen.getByRole("heading", { name: "What each symbol means" })).toBeInTheDocument();
  });

  it("uses screenshots that exist, are small and have alt text", async () => {
    for (const [locale, id] of cases) {
      const shot = screenshotPath(locale, id);
      if (!shot) continue;
      const file = path.join(process.cwd(), "public", shot);
      expect(existsSync(file)).toBe(true);
      expect(statSync(file).size).toBeLessThanOrEqual(200 * 1024);
      expect(copies[locale].features[id].showcase.alt?.length).toBeGreaterThan(40);
    }
  });
});

describe("build-time data", () => {
  it("counts PSeInt's school profiles", () => {
    expect(schoolProfileCount).toBe(generatedProfiles.length);
    expect(schoolProfileCount).toBe(463);
  });

  it("references only examples that exist", () => {
    const ids = new Set(examplePrograms.map((e) => e.id));
    for (const id of [...Object.values(FEATURE_EXAMPLE), ...Object.values(FEATURE_RELATED_EXAMPLES).flat()]) expect(ids).toContain(id);
  });

  it.each(["python", "c", "java"] as const)("translates every mapping row to %s", (language) => {
    const rows = mappingTable(language);
    expect(rows).toHaveLength(MAPPING_ROWS.length);
    for (const row of rows) expect(row.target.trim()).not.toBe("");
    const byId = Object.fromEntries(rows.map((row) => [row.id, row.target]));
    const write = { python: "print(", c: "printf(", java: "System.out.println(" }[language];
    expect(byId.write).toContain(write);
    expect(byId.arrayItem).toMatch(/datos\[0\] = n/);
    expect(byId.for).toMatch(/for/);
  });

  it("traces the desk check example like the workspace does", async () => {
    const trace = await traceExample(exampleById("sum-until-zero"));
    expect(trace.variables).toEqual(["numero", "suma", "cantidad"]);
    expect(trace.inputs).toEqual(["12", "7.5", "30", "0"]);
    expect(trace.output).toContain("Total: 49.5");
    const last = trace.rows[trace.rows.length - 1];
    expect(last.values.map((v) => v.text)).toEqual(["0", "49.5", "3"]);
  });

  it("highlights generated code without losing any text", () => {
    const code = translateExample(exampleById("gcd-lcm"), "c");
    const lines = highlightGenerated(code, "c");
    expect(lines.map((tokens) => tokens.map((t) => t.text).join("")).join("\n")).toBe(code.trimEnd().replace(/\t/g, "    "));
    expect(lines[0][0].type).toBe("comment");
  });

  it("deep-links each page to its program", () => {
    for (const [locale, id] of cases) {
      const program = decodeProgram(featureWorkspaceHref(locale, id));
      expect(program.s).toBe(exampleById(FEATURE_EXAMPLE[id]).source);
      expect(program.n).toMatch(/\.psc$/);
    }
  });
});
