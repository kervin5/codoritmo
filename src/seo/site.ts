import { defaultLocale, type Locale } from "@/src/i18n/config";

export const officialPseintUrl = "http://pseint.sourceforge.net";

/**
 * The public address of this deployment, used for canonical links, hreflang,
 * the sitemap and structured data. Nothing here names a domain: set
 * NEXT_PUBLIC_SITE_URL for your deployment (see .env.example). On Vercel the
 * production domain is picked up automatically when it isn't set.
 */
function resolveSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

export const siteUrl = resolveSiteUrl().replace(/\/+$/, "");

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
