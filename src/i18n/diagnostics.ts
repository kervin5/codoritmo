import { fillEngineMessage, type EngineMessageCode } from "../engine/messages";
import type { Diagnostic } from "../engine/types";
import type { Dictionary } from "./types";

/** The diagnostic in the dictionary's language, or its raw message for an unknown code. */
export function formatDiagnostic(diagnostic: Diagnostic, dictionary: Dictionary): string {
  const { code } = diagnostic;
  if (!code || !Object.hasOwn(dictionary.engineMessages, code)) {
    return diagnostic.message;
  }
  return fillEngineMessage(
    dictionary.engineMessages[code as EngineMessageCode],
    diagnostic.params,
    dictionary.engineTypeNames,
  );
}
