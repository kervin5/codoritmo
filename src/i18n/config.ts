export const locales = ['es', 'en'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'es';

export function hasLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}
