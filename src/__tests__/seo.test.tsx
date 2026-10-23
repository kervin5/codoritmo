import { render, screen } from "@testing-library/react";

import AboutPage, {
  generateMetadata as generateAboutMetadata,
} from "../../app/[lang]/about/page";
import { generateMetadata as generateHomeMetadata } from "../../app/[lang]/page";
import robots from "../../app/robots";
import { renderSitemapIndex, SITEMAP_IDS, sitemapEntries, sitemapUrl } from "../seo/sitemaps";
import { siteUrl } from "../seo/site";
import { featureIds, featurePath } from "../seo/sections";
import { createHomeStructuredData } from "../seo/structured-data";
import { generatedProfiles } from "../engine/school-profiles";
import { enDictionary } from "../i18n/en";
import { esDictionary } from "../i18n/es";
import { REPOSITORY_URL } from "../components/brand/logo-mark";

describe("SEO surfaces", () => {
  it("generates localized home metadata with correct title, description, and keywords", async () => {
    const metadata = await generateHomeMetadata({
      params: Promise.resolve({ lang: "en" }),
    });

    expect(metadata.title).toEqual({ absolute: "Online pseudocode IDE compatible with PSeInt | Codoritmo" });
    expect(metadata.description).toContain("PSeInt pseudocode");
    expect(metadata.description).toMatch(/Python, C and Java/);
    expect(String(metadata.description).length).toBeLessThanOrEqual(155);
    expect(metadata.alternates?.canonical).toBe(`${siteUrl}/en`);
    expect(metadata.keywords).toEqual(
      expect.arrayContaining(["PSeInt online", "PSeInt alternative", "pseudocode to Python"])
    );
  });

  it("describes the app as a free, GPL v2+ WebApplication based on PSeInt", () => {
    for (const [locale, dictionary] of [["es", esDictionary], ["en", enDictionary]] as const) {
      const data = createHomeStructuredData(locale, dictionary);
      expect(data).toMatchObject({
        "@type": "WebApplication",
        inLanguage: locale,
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0" },
        license: "https://www.gnu.org/licenses/old-licenses/gpl-2.0.html",
        isBasedOn: { name: "PSeInt", url: "http://pseint.sourceforge.net" },
      });
      expect(data.featureList.length).toBeGreaterThanOrEqual(8);
      expect(data.featureList.join(" ")).toContain(String(generatedProfiles.length));
      expect(dictionary.metadata.home.title.length).toBeLessThanOrEqual(60);
      expect(dictionary.metadata.home.description.length).toBeLessThanOrEqual(155);
    }
  });

  it("renders the About page as a full overview with credits, license and repository", async () => {
    const view = await AboutPage({
      params: Promise.resolve({ lang: "en" }),
    });

    const { container } = render(view);

    expect(screen.getByRole("heading", { level: 1, name: "About Codoritmo" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText(/independent project, inspired by PSeInt/i)).toBeInTheDocument();
    expect(screen.getByText(/created by Pablo Novara/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`ships the ${generatedProfiles.length} school profiles`))).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /visit the official pseint project/i })
    ).toHaveAttribute("href", "http://pseint.sourceforge.net");
    expect(screen.getByRole("link", { name: /see the source code on github/i })).toHaveAttribute("href", REPOSITORY_URL);
    expect(screen.getByRole("link", { name: /read the gpl v2/i })).toHaveAttribute(
      "href",
      "https://www.gnu.org/licenses/old-licenses/gpl-2.0.html"
    );
    // Every feature page is linked from the overview.
    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    for (const id of featureIds) expect(hrefs).toContain(featurePath("en", id));
    expect(hrefs).toEqual(expect.arrayContaining(["/en/examples", "/en/reference", "/en/profiles", "/es/about"]));

    const script = container.querySelector('script[type="application/ld+json"]');
    const graph = JSON.parse(script!.innerHTML)["@graph"];
    expect(graph.map((node: { "@type"?: string }) => node["@type"])).toEqual(
      expect.arrayContaining(["AboutPage", "BreadcrumbList", "WebApplication"])
    );
  });

  it("generates localized about metadata and crawl files", async () => {
    const aboutMetadata = await generateAboutMetadata({
      params: Promise.resolve({ lang: "es" }),
    });

    expect(aboutMetadata.title).toBe("Acerca de Codoritmo: qué es y qué hace");
    expect(String(aboutMetadata.description)).toContain("GPL v2 o posterior");
    expect(aboutMetadata.alternates?.canonical).toBe(`${siteUrl}/es/about`);

    expect(robots()).toMatchObject({
      host: siteUrl,
      sitemap: [`${siteUrl}/sitemap.xml`, ...SITEMAP_IDS.map(sitemapUrl)],
    });

    for (const id of SITEMAP_IDS) expect(renderSitemapIndex()).toContain(`<loc>${sitemapUrl(id)}</loc>`);

    expect(sitemapEntries("core")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: `${siteUrl}/es` }),
        expect.objectContaining({ url: `${siteUrl}/en/about` }),
      ])
    );
  });
});
