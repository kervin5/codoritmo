export function formatMessage(
  template: string,
  values: Record<string, number | string>,
): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

/** Picks the `one`/`other` form for `count` and fills `{count}`. */
export function formatPlural(
  forms: { one: string; other: string },
  count: number,
): string {
  return formatMessage(count === 1 ? forms.one : forms.other, { count });
}
