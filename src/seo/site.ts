import { defaultLocale, type Locale } from "@/src/i18n/config";

export const officialPseintUrl = "http://pseint.sourceforge.net";

export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");

export function localizedSiteUrl(locale: Locale, path = ""): string {
  const normalizedPath = path ? (path.startsWith("/") ? path : `/${path}`) : "";

  return `${siteUrl}/${locale}${normalizedPath}`;
}

export function localeAlternates(path = ""): Record<string, string> {
  return {
    en: localizedSiteUrl("en", path),
    es: localizedSiteUrl("es", path),
    "x-default": localizedSiteUrl(defaultLocale, path),
  };
}

export function openGraphLocale(locale: Locale): string {
  return locale === "es" ? "es_ES" : "en_US";
}
