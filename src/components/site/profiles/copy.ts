import type { Locale } from "@/src/i18n/config";
import { enProfiles } from "@/src/i18n/site/profiles-en";
import { esProfiles, type ProfilesCopy } from "@/src/i18n/site/profiles-es";

export function profilesCopy(locale: Locale): ProfilesCopy {
  return locale === "es" ? esProfiles : enProfiles;
}
