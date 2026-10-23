import { TextEncoder as NodeTextEncoder } from "util";
import { cleanup, render, screen } from "@testing-library/react";

import { generateMetadata as childMetadata, generateStaticParams as childStaticParams } from "../../app/[lang]/[section]/[slug]/page";
import { generateMetadata as sectionMetadata } from "../../app/[lang]/[section]/page";
import {
  descriptionLines,
  descriptionSummary,
  findProfile,
  profilePath,
  profileSlug,
  profilesByLetter,
  RULE_KEYS,
  siteProfiles,
} from "../components/site/profiles/data";
import { profileExample, verifyProgram } from "../components/site/profiles/example";
import { hasProfile, ProfilePage, ProfilesIndexPage, profileMetadata, profileSitemapEntries, profileSlugs } from "../components/site/profiles";
import { getEngineProfile, normalizeEngineSettings } from "../engine";
import { generatedProfiles } from "../engine/school-profiles";
import { locales, type Locale } from "../i18n/config";
import { enProfiles } from "../i18n/site/profiles-en";
import { esProfiles } from "../i18n/site/profiles-es";
import { siteUrl } from "../seo/site";

const segment: Record<Locale, string> = { es: "perfiles", en: "profiles" };
const abs = (path: string) => `${siteUrl}${path}`;

// jsdom has no TextEncoder; workspaceProgramHref needs it (Node and browsers do).
if (typeof globalThis.TextEncoder === "undefined") {
  (globalThis as { TextEncoder: unknown }).TextEncoder = NodeTextEncoder;
}

afterEach(cleanup);

async function expectNotFound(promise: Promise<unknown>) {
  await expect(promise).rejects.toMatchObject({ digest: expect.stringContaining("404") });
}

function childProps(lang: string, slug: string) {
  return { params: Promise.resolve({ lang, section: segment[lang as Locale] ?? lang, slug }) };
}

describe("profile data", () => {
  it("gives every PSeInt school profile one stable, URL-safe, unique slug", () => {
    expect(siteProfiles).toHaveLength(generatedProfiles.length);
    const slugs = siteProfiles.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(profileSlug("UTN-FRM")).toBe("utn-frm");
    expect(profileSlug("ITSR_advan")).toBe("itsr-advan");
    for (const profile of siteProfiles) expect(findProfile(profile.slug)?.id).toBe(profile.id);
  });

  it("uses profile ids the workspace can load", () => {
    for (const profile of siteProfiles) expect(getEngineProfile(profile.id)?.settings).toEqual(profile.settings);
  });

  it("lists every school once on the index, grouped by letter", () => {
    const listed = profilesByLetter().flatMap((g) => g.profiles.map((p) => p.id));
    expect(listed).toHaveLength(siteProfiles.filter((p) => !p.general).length);
    expect(new Set(listed).size).toBe(listed.length);
  });

  it("only drops pages that have a name-only description and a twin with the same rules", () => {
    const hidden = siteProfiles.filter((p) => !p.indexable);
    expect(hidden.map((p) => p.id)).toEqual(["CSM"]);
    for (const p of hidden) expect(p.twins.length).toBeGreaterThan(0);
  });

  it("reads 'Campo: valor' descriptions as fields and keeps credits out of summaries", () => {
    const utn = findProfile("utn-frm")!;
    expect(descriptionLines(utn.description).filter((l) => l.kind === "field").length).toBeGreaterThanOrEqual(4);
    expect(descriptionSummary(utn.description)).toContain("Universidad Tecnológica Nacional");
    expect(descriptionSummary(findProfile("uan")!.description)).not.toMatch(/enviado/i);
  });

  it("has copy for every rule in both locales", () => {
    for (const key of RULE_KEYS) {
      for (const copy of [esProfiles, enProfiles]) {
        expect(copy.rules[key].on).toBeTruthy();
        expect(copy.rules[key].off).toBeTruthy();
      }
    }
  });
});

describe("profile examples", () => {
  it.each(locales)("builds a program that parses and runs under every profile (%s)", async (locale) => {
    const failures: string[] = [];
    for (const profile of siteProfiles) {
      if (!(await profileExample(profile, locale))) failures.push(profile.id);
    }
    expect(failures).toEqual([]);
  });

  it("shows the profile's own forms: semicolons, base-0 indexes, symbol operators", async () => {
    const strict = (await profileExample(findProfile("estricto")!, "es"))!;
    expect(strict.source).toContain("Escribir \"Hola, \", nombre;");
    expect(strict.source).toContain("notas[0] <- 8;");
    expect(strict.output).toContain("Promedio: 8");
  });

  it("rejects a program that breaks the profile's rules", async () => {
    const strict = findProfile("estricto")!.settings;
    expect(await verifyProgram("Algoritmo A\n\tx <- 1\nFinAlgoritmo\n", strict)).toBeNull();
  });

  // The rule texts promise these behaviours; keep them honest.
  it("matches what the rule texts say", async () => {
    const run = (source: string, overrides: Parameters<typeof normalizeEngineSettings>[0]) =>
      verifyProgram(source, normalizeEngineSettings(overrides));
    expect(await run("Algoritmo A\nPara i <- 3 Hasta 1 Hacer\nEscribir i\nFinPara\nFinAlgoritmo", { deduceNegativeForStep: false })).toEqual([]);
    expect(await run("Algoritmo A\nPara i <- 3 Hasta 1 Hacer\nEscribir i\nFinPara\nFinAlgoritmo", { deduceNegativeForStep: true })).toEqual(["3", "2", "1"]);
    expect(
      await run('Algoritmo A\nx <- "a"\nSegun x Hacer\n"a": Escribir "uno"\nFinSegun\nFinAlgoritmo', { integerOnlySwitch: false }),
    ).toEqual(["uno"]);
    expect(await run('Algoritmo A\nx <- "Hola, " + "Ana"\nEscribir x\nFinAlgoritmo', { allowConcatenation: false })).toBeNull();
    expect(await run("Algoritmo A\nx = 5\nEscribir x\nFinAlgoritmo", { overloadEqual: true })).toEqual(["5"]);
    expect(await run("Algoritmo A\nx = 5\nFinAlgoritmo", { overloadEqual: false })).toBeNull();
  });
});

describe("profile routes and metadata", () => {
  it.each(locales)("generates every profile page for %s", (locale) => {
    expect(profileSlugs(locale)).toHaveLength(siteProfiles.length);
    const params = childStaticParams({ params: { lang: locale } }).filter((p) => p.section === segment[locale]);
    expect(params).toHaveLength(siteProfiles.length);
    expect(params).toContainEqual({ lang: locale, section: segment[locale], slug: "uan" });
  });

  it("404s unknown slugs and wrong-locale sections", async () => {
    expect(hasProfile("es", "no-existe")).toBe(false);
    await expectNotFound(childMetadata(childProps("es", "no-existe")));
    await expectNotFound(
      childMetadata({ params: Promise.resolve({ lang: "en", section: "perfiles", slug: "uan" }) }),
    );
  });

  it.each(locales)("sets a specific title, description, canonical and alternates (%s)", async (locale) => {
    const meta = await profileMetadata(locale, "uan");
    expect(String(meta.title)).toContain("UAN");
    expect(String(meta.title).length).toBeLessThanOrEqual(60);
    expect(meta.description!.length).toBeLessThanOrEqual(155);
    expect(meta.alternates?.canonical).toBe(abs(profilePath(locale, "uan")));
    expect(meta.alternates?.languages).toEqual({
      es: abs("/es/perfiles/uan"),
      en: abs("/en/profiles/uan"),
      "x-default": abs("/es/perfiles/uan"),
    });
    expect(meta.openGraph?.url).toBe(abs(profilePath(locale, "uan")));
    expect(meta.robots).toBeUndefined();
  });

  it("keeps every title and description within limits, and descriptions unique", async () => {
    for (const locale of locales) {
      const seen = new Set<string>();
      for (const profile of siteProfiles) {
        const meta = await profileMetadata(locale, profile.slug);
        expect(String(meta.title).length).toBeLessThanOrEqual(60);
        expect(meta.description!.length).toBeLessThanOrEqual(155);
        seen.add(meta.description!);
      }
      expect(seen.size).toBe(siteProfiles.length);
    }
  });

  it("marks thin duplicate pages noindex, follow", async () => {
    expect((await profileMetadata("es", "csm")).robots).toEqual({ index: false, follow: true });
  });

  it("gives the index canonical and alternates", async () => {
    const meta = await sectionMetadata({ params: Promise.resolve({ lang: "en", section: "profiles" }) });
    expect(meta.alternates?.canonical).toBe(abs("/en/profiles"));
    expect(meta.alternates?.languages).toMatchObject({ es: abs("/es/perfiles"), "x-default": abs("/es/perfiles") });
  });
});

describe("profile sitemap", () => {
  it("lists the index and every indexable page in both locales with hreflang", () => {
    const entries = profileSitemapEntries();
    const indexable = siteProfiles.filter((p) => p.indexable).length;
    expect(entries).toHaveLength((indexable + 1) * locales.length);
    expect(entries.map((e) => e.url)).toContain(abs("/en/profiles/utn-frm"));
    expect(entries.map((e) => e.url)).not.toContain(abs("/es/perfiles/csm"));
    const uan = entries.find((e) => e.url === abs("/en/profiles/uan"))!;
    expect(uan.alternates?.languages).toEqual({
      es: abs("/es/perfiles/uan"),
      en: abs("/en/profiles/uan"),
      "x-default": abs("/es/perfiles/uan"),
    });
  });
});

describe("profile pages render", () => {
  // The routes wrap these async components; render them directly (RTL can't await).
  it("renders the index with every profile link and an ItemList", async () => {
    const { container } = render((await ProfilesIndexPage({ locale: "es" }))!);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const links = [...container.querySelectorAll('a[href^="/es/perfiles/"]')].map((a) => a.getAttribute("href"));
    for (const profile of siteProfiles) expect(links).toContain(`/es/perfiles/${profile.slug}`);
    const data = JSON.parse(container.querySelector('script[type="application/ld+json"]')!.innerHTML);
    expect(data["@graph"][0].mainEntity.numberOfItems).toBe(siteProfiles.length);
  });

  it.each(locales)("renders a profile page with its description, rules, example and workspace link (%s)", async (locale) => {
    const { container } = render((await ProfilePage({ locale, slug: "estricto" }))!);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(container.textContent).toContain("Este perfil configura el pseudolenguaje");
    expect(container.textContent).toContain(locale === "es" ? esProfiles.rules.forceSemicolon.name : enProfiles.rules.forceSemicolon.name);
    const open = [...container.querySelectorAll("a")].find((a) => a.getAttribute("href")?.startsWith(`/${locale}#u=`));
    expect(open).toBeDefined();
    const payload = JSON.parse(
      Buffer.from(open!.getAttribute("href")!.split("#u=")[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    );
    expect(payload.p).toBe("Estricto");
    expect(payload.s).toContain("Algoritmo PerfilEstricto");
    const graph = JSON.parse(container.querySelector('script[type="application/ld+json"]')!.innerHTML)["@graph"];
    expect(graph[1].itemListElement).toHaveLength(3);
    expect(graph[0].hasPart.text).toBe(payload.s);
  });
});
