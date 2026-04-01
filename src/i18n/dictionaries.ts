import { defaultLocale } from './config';
import { enDictionary } from './en';
import { esDictionary } from './es';
import type { Locale } from './config';
import type { Dictionary } from './types';

export const dictionaries: Record<Locale, Dictionary> = {
  en: enDictionary,
  es: esDictionary,
};

export function getDictionarySync(locale: Locale = defaultLocale): Dictionary {
  return dictionaries[locale];
}
