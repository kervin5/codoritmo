// Build-time data for the public profile pages: which profiles get a page,
// their URL slugs, how their rules compare, and how to show the description
// each school sent to PSeInt. Pure and deterministic, so pages prerender.

import { engineProfiles, getEngineProfile, normalizeEngineSettings, type EngineSettings } from "@/src/engine";
import { generatedProfiles } from "@/src/engine/school-profiles";
import type { Locale } from "@/src/i18n/config";
import type { ProfileRuleGroupId, ProfileRuleKey } from "@/src/i18n/site/profiles-es";
import { sectionPath } from "@/src/seo/sections";

/** Codoritmo's default profile: what every page compares against. */
export const DEFAULT_PROFILE_ID = "desktop-default";

/** The rules in the order the pages explain them. */
export const RULE_GROUPS: { id: ProfileRuleGroupId; keys: ProfileRuleKey[] }[] = [
  { id: "variables", keys: ["forceDefineVars", "forceInitVars", "protectForCounter", "allowAccents"] },
  { id: "writing", keys: ["forceSemicolon", "lazySyntax", "overloadEqual"] },
  { id: "operators", keys: ["wordOperators", "colloquialConditions", "allowConcatenation"] },
  { id: "arrays", keys: ["baseZeroArrays", "allowDynamicDimensions", "allowResizeArrays"] },
  { id: "loops", keys: ["allowForEach", "allowRepeatWhile", "deduceNegativeForStep", "integerOnlySwitch"] },
  { id: "routines", keys: ["enableUserFunctions", "enableStringFunctions"] },
];
export const RULE_KEYS: ProfileRuleKey[] = RULE_GROUPS.flatMap((group) => group.keys);

/** PSeInt's two general profiles: listed apart from the schools on the index. */
export const GENERAL_PROFILE_IDS = ["Flexible", "Estricto"] as const;

export interface SiteProfile {
  id: string;
  slug: string;
  label: string;
  /** Verbatim, as sent to PSeInt (Spanish). */
  description: string;
  /** Normalized the way the workspace applies them. */
  settings: EngineSettings;
  /** Rules whose value differs from Codoritmo's default profile, in page order. */
  differences: ProfileRuleKey[];
  /** Same rules as these other profiles (by id), in list order. */
  twins: string[];
  general: boolean;
  /**
   * Pages whose only own content would be a name-length description while
   * another profile has exactly the same rules: kept reachable for students of
   * that school, but out of the index (noindex, follow) and the sitemap.
   */
  indexable: boolean;
}

export function profileSlug(id: string): string {
  return id
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const defaultSettings = getEngineProfile(DEFAULT_PROFILE_ID)!.settings;

export function settingsSignature(settings: EngineSettings): string {
  return RULE_KEYS.map((key) => (settings[key] ? "1" : "0")).join("");
}

/** Below this many letters a description says nothing beyond the school's name. */
const THIN_DESCRIPTION = 40;

function buildProfiles(): SiteProfile[] {
  const bySignature = new Map<string, string[]>();
  const base = generatedProfiles.map((profile) => {
    // engineProfiles is what the workspace uses; read the settings from there
    // so the page always shows what the app will apply.
    const engine = engineProfiles.find((candidate) => candidate.id === profile.id);
    const settings = engine?.settings ?? normalizeEngineSettings(profile.settings);
    const signature = settingsSignature(settings);
    bySignature.set(signature, [...(bySignature.get(signature) ?? []), profile.id]);
    return { profile, settings, signature };
  });

  return base.map(({ profile, settings, signature }) => {
    const twins = (bySignature.get(signature) ?? []).filter((id) => id !== profile.id);
    const thin = profile.description.replace(/\s+/g, " ").trim().length < THIN_DESCRIPTION;
    return {
      id: profile.id,
      slug: profileSlug(profile.id),
      label: profile.label,
      description: profile.description,
      settings,
      differences: RULE_KEYS.filter((key) => settings[key] !== defaultSettings[key]),
      twins,
      general: (GENERAL_PROFILE_IDS as readonly string[]).includes(profile.id),
      indexable: !(thin && twins.length > 0),
    };
  });
}

export const siteProfiles: SiteProfile[] = buildProfiles();
const bySlug = new Map(siteProfiles.map((profile) => [profile.slug, profile]));
const byId = new Map(siteProfiles.map((profile) => [profile.id, profile]));

export function findProfile(slug: string): SiteProfile | null {
  return bySlug.get(slug) ?? null;
}

export function profileById(id: string): SiteProfile | null {
  return byId.get(id) ?? null;
}

export function defaultProfileSettings(): EngineSettings {
  return defaultSettings;
}

/* ---------------- URLs ---------------- */

export const profilesIndexPath = (locale: Locale) => sectionPath(locale, "profiles");
export const profilePath = (locale: Locale, slug: string) => `${profilesIndexPath(locale)}/${slug}`;

/* ---------------- comparisons ---------------- */

/** Profiles whose rules differ from this one's in exactly one rule. */
export function similarProfiles(profile: SiteProfile, limit = 8): { profile: SiteProfile; key: ProfileRuleKey }[] {
  const result: { profile: SiteProfile; key: ProfileRuleKey }[] = [];
  for (const other of siteProfiles) {
    if (other.id === profile.id) continue;
    const differing = RULE_KEYS.filter((key) => other.settings[key] !== profile.settings[key]);
    if (differing.length === 1) result.push({ profile: other, key: differing[0] });
  }
  // One per differing rule first, so the list shows a variety of changes.
  const seen = new Set<ProfileRuleKey>();
  const spread = [...result.filter(({ key }) => !seen.has(key) && seen.add(key)), ...result];
  return [...new Map(spread.map((item) => [item.profile.id, item])).values()].slice(0, limit);
}

/* ---------------- index grouping ---------------- */

const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });

export function letterOf(label: string): string {
  const first = label.normalize("NFD").replace(/\p{Diacritic}/gu, "").charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
}

/** School profiles (not the general ones), alphabetical, grouped by first letter. */
export function profilesByLetter(): { letter: string; profiles: SiteProfile[] }[] {
  const schools = siteProfiles.filter((profile) => !profile.general).sort((a, b) => collator.compare(a.label, b.label));
  const groups = new Map<string, SiteProfile[]>();
  for (const profile of schools) {
    const letter = letterOf(profile.label);
    groups.set(letter, [...(groups.get(letter) ?? []), profile]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === "#" ? -1 : b === "#" ? 1 : a.localeCompare(b)))
    .map(([letter, profiles]) => ({ letter, profiles }));
}

export function generalProfiles(): SiteProfile[] {
  return GENERAL_PROFILE_IDS.map((id) => profileById(id)).filter((profile): profile is SiteProfile => profile !== null);
}

/* ---------------- descriptions ---------------- */

export type DescriptionLine = { kind: "field"; label: string; value: string } | { kind: "text"; text: string };

/**
 * Many descriptions are a list of "Carrera: …" / "Docente: …" lines; those are
 * shown as a definition list, the rest as plain paragraphs. The text itself is
 * never changed.
 */
export function descriptionLines(description: string): DescriptionLine[] {
  const lines = description
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return lines.map((text) => ({ kind: "text", text }));
  return lines.map((line) => {
    const match = /^([^:]{2,40}?)\s*[:;]\s*(.+)$/.exec(line);
    return match && !/https?$/i.test(match[1]) ? { kind: "field", label: match[1], value: match[2] } : { kind: "text", text: line };
  });
}

const INSTITUTION_FIELD = /instituci|institu|universidad|colegio|escuela|unidad|facultad|sede|ubicaci|ciudad|pa[ií]s/i;
const COURSE_FIELD = /materia|asignatura|curso|c[aá]tedra|carrera|programa|m[oó]dulo|taller/i;

/** One line about who the profile is for, for meta descriptions and the index list. */
export function descriptionSummary(description: string): string {
  const lines = descriptionLines(description);
  const fields = lines.filter((line): line is Extract<DescriptionLine, { kind: "field" }> => line.kind === "field");
  let summary: string;
  if (fields.length >= 2) {
    const institution = fields.filter((field) => INSTITUTION_FIELD.test(field.label)).map((field) => field.value);
    const course = fields.filter((field) => COURSE_FIELD.test(field.label)).map((field) => field.value);
    const picked = [...institution, ...course];
    summary = (picked.length ? picked : fields.map((field) => field.value)).join(", ");
  } else {
    summary = description.replace(/\s+/g, " ").trim();
    // "(enviado por …)" credits a person: it stays on the page, not in snippets.
    summary = summary.replace(/\s*\((?:perfil )?(?:enviado|creado|elaborado)[^)]*\)\s*/gi, " ").trim();
  }
  return summary.replace(/\s+/g, " ").replace(/[\s.,;:]+$/, "");
}

/** Cuts `text` at a word boundary so it fits in `max` characters, adding an ellipsis. */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, Math.max(0, max - 1));
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.5 ? cut.slice(0, space) : cut).replace(/[\s.,;:(]+$/, "")}…`;
}
