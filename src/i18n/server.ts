import 'server-only';

import { defaultLocale, type Locale } from './config';
import { getDictionarySync } from './dictionaries';
import type { Dictionary } from './types';

export async function getDictionary(locale: Locale = defaultLocale): Promise<Dictionary> {
  return getDictionarySync(locale);
}
