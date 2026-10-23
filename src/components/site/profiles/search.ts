/** Lower case without accents, so "Bogota" finds "Bogotá". Shared by the list and the filter. */
export function normalizeProfileSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
