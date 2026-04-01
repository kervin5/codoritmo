import { render, screen } from "@testing-library/react";

import AboutPage, {
  generateMetadata as generateAboutMetadata,
} from "../../app/[lang]/about/page";
import { generateMetadata as generateHomeMetadata } from "../../app/[lang]/page";
import robots from "../../app/robots";
import sitemap from "../../app/sitemap";
import { siteUrl } from "../seo/site";

describe("SEO surfaces", () => {
  it("generates localized home metadata with correct title, description, and keywords", async () => {
    const metadata = await generateHomeMetadata({
      params: Promise.resolve({ lang: "en" }),
    });

    expect(metadata.title).toBe("PSeInt Online Alternative");
    expect(metadata.description).toContain("inspired by PSeInt");
    expect(metadata.alternates?.canonical).toBe(`${siteUrl}/en`);
    expect(metadata.keywords).toEqual(
      expect.arrayContaining(["PSeInt online", "PSeInt alternative"])
    );
  });

  it("renders the About page with story content and official PSeInt link", async () => {
    const view = await AboutPage({
      params: Promise.resolve({ lang: "en" }),
    });

    render(view);

    expect(
      screen.getByRole("heading", { level: 1, name: /pseudocode, diagrams, and export/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Codoritmo is a direct descendant/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /visit the official pseint project/i })
    ).toHaveAttribute("href", "http://pseint.sourceforge.net");
    for (const link of screen.getAllByRole("link", { name: /examples/i })) {
      expect(link).toHaveAttribute("href", "/en?examples=new");
    }
    for (const link of screen.getAllByRole("link", { name: /^About$/i })) {
      expect(link).toHaveAttribute("href", "/en/about");
    }
  });

  it("generates localized about metadata and crawl files", async () => {
    const aboutMetadata = await generateAboutMetadata({
      params: Promise.resolve({ lang: "es" }),
    });

    expect(aboutMetadata.title).toBe("Acerca de");
    expect(aboutMetadata.alternates?.canonical).toBe(`${siteUrl}/es/about`);

    expect(robots()).toMatchObject({
      host: siteUrl,
      sitemap: `${siteUrl}/sitemap.xml`,
    });

    expect(sitemap()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: `${siteUrl}/es` }),
        expect.objectContaining({ url: `${siteUrl}/en/about` }),
      ])
    );
  });
});
