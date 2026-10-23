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

/**
 * A link that opens the workspace with this program (and profile) loaded, in
 * the same `#u=` share format the app reads (see readSharedDocument). Built
 * without browser APIs, so static pages can render it at build time.
 */
export function workspaceProgramHref(
  locale: string,
  program: { name: string; source: string; profileId?: string },
): string {
  const payload = JSON.stringify({ n: program.name, s: program.source, p: program.profileId ?? "desktop-default" });
  const bytes = new TextEncoder().encode(payload);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64url = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `/${locale}#u=${base64url}`;
}
