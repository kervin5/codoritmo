const EXAMPLES_PARAM = "examples";
const EXAMPLES_NEW_VALUE = "new";

/** `?examples=new` — open workspace with a new session tab and the examples panel. */
export function workspaceExamplesNewTabHref(locale: string): string {
  return `/${locale}?${EXAMPLES_PARAM}=${EXAMPLES_NEW_VALUE}`;
}

export function isExamplesNewWorkspaceTabIntent(search: string): boolean {
  const query = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(query).get(EXAMPLES_PARAM) === EXAMPLES_NEW_VALUE;
}
