// Predefined answers for Leer: one per line, used in order before the
// console asks. The text is kept as typed (per document); these helpers turn
// it into the queue of answers a run consumes.

import { parseInputText } from "@/src/engine";

/** "5\nAna\n" → ["5", "Ana"]: one answer per line, ignoring the file's final newline. */
export function parseInputList(text: string | undefined): string[] {
  const answers = parseInputText(text ?? "");
  if (answers.length > 0 && answers[answers.length - 1] === "") answers.pop();
  return answers;
}

/** The text to save as a .txt file: one answer per line, ending in a newline. */
export function serializeInputList(text: string): string {
  const answers = parseInputList(text);
  return answers.length ? `${answers.join("\n")}\n` : "";
}

/** "Promedio.psc" → "Promedio-respuestas.txt". */
export function inputListFileName(documentName: string, suffix: string): string {
  return `${documentName.replace(/\.[^.]+$/, "") || "programa"}-${suffix}.txt`;
}
