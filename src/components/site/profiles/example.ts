// Builds, for each profile, a short program that follows its rules and shows
// off the ones that differ from Codoritmo's default. Every program is parsed
// and run with the profile's own settings at build time; a page only shows an
// example that parses and runs without errors.

import { Interpreter, Parser, type EngineSettings, type Runtime } from "@/src/engine";
import type { Locale } from "@/src/i18n/config";
import { formatMessage } from "@/src/i18n/format";
import type { ProfilesCopy, ProfileRuleKey } from "@/src/i18n/site/profiles-es";

import { profilesCopy } from "./copy";
import { defaultProfileSettings, type SiteProfile } from "./data";

export interface ProfileExample {
  name: string;
  source: string;
  output: string[];
}

/** A valid identifier from the profile's name, for the program header. */
function programName(label: string): string {
  const words = label
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  const name = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join("");
  return `Perfil${name}`;
}

export function buildExampleSource(profile: Pick<SiteProfile, "label" | "settings">, copy: ProfilesCopy): string {
  const s: EngineSettings = profile.settings;
  const base = defaultProfileSettings();
  const differs = (key: ProfileRuleKey) => s[key] !== base[key];
  const lines: string[] = [];
  const end = s.forceSemicolon ? ";" : "";
  const tab = (depth: number) => "\t".repeat(depth);
  const statement = (depth: number, text: string) => lines.push(`${tab(depth)}${text}${end}`);
  const structure = (depth: number, text: string) => lines.push(`${tab(depth)}${text}`);
  const comment = (depth: number, text: string | undefined) => {
    if (text) lines.push(`${tab(depth)}// ${text}`);
  };
  const ruleComment = (depth: number, key: ProfileRuleKey) => {
    if (!differs(key)) return;
    const rule = copy.rules[key];
    comment(depth, s[key] ? rule.commentOn : rule.commentOff);
  };
  const quote = (text: string) => `"${text}"`;

  const first = s.baseZeroArrays ? 0 : 1;
  const and = s.wordOperators ? "Y" : "&";
  const mod = s.wordOperators ? "MOD" : "%";
  const assign = (depth: number, target: string, value: string) => statement(depth, `${target} <- ${value}`);

  comment(0, formatMessage(copy.example.header, { name: profile.label }));
  ruleComment(0, "forceSemicolon");
  ruleComment(0, "lazySyntax");
  if (differs("enableUserFunctions") && !s.enableUserFunctions) comment(0, copy.example.noRoutines);
  structure(0, `Algoritmo ${programName(profile.label)}`);

  if (s.forceDefineVars) {
    ruleComment(1, "forceDefineVars");
    ruleComment(1, "allowAccents");
    statement(1, "Definir notas, suma, i Como Entero");
    statement(1, "Definir promedio Como Real");
    statement(1, "Definir nombre Como Caracter");
  } else {
    ruleComment(1, "allowAccents");
  }

  ruleComment(1, "allowDynamicDimensions");
  if (differs("allowResizeArrays") && !s.allowResizeArrays) comment(1, copy.example.noResize);
  statement(1, "Dimension notas[3]");
  ruleComment(1, "baseZeroArrays");
  assign(1, `notas[${first}]`, "8");
  assign(1, `notas[${first + 1}]`, "9");
  assign(1, `notas[${first + 2}]`, "7");

  ruleComment(1, "forceInitVars");
  if (s.overloadEqual && differs("overloadEqual")) {
    ruleComment(1, "overloadEqual");
    statement(1, "suma = 0");
  } else {
    assign(1, "suma", "0");
  }
  if (differs("allowForEach") && !s.allowForEach) comment(1, copy.example.noForEach);
  structure(1, `Para i <- ${first} Hasta ${first + 2} Hacer`);
  ruleComment(2, "protectForCounter");
  assign(2, "suma", "suma + notas[i]");
  structure(1, "FinPara");
  assign(1, "promedio", "suma / 3");

  assign(1, "nombre", quote("Ana"));
  ruleComment(1, "allowConcatenation");
  statement(1, `Escribir ${quote(copy.example.greeting)}, nombre`);
  statement(1, `Escribir ${quote(copy.example.average)}, promedio`);

  ruleComment(1, "wordOperators");
  structure(1, `Si promedio >= 7 ${and} promedio <= 10 Entonces`);
  statement(2, `Escribir ${quote(copy.example.passed)}`);
  structure(1, "SiNo");
  statement(2, `Escribir ${quote(copy.example.failed)}`);
  structure(1, "FinSi");

  ruleComment(1, "colloquialConditions");
  structure(1, s.colloquialConditions ? "Si suma Es Par Entonces" : `Si suma ${mod} 2 = 0 Entonces`);
  statement(2, `Escribir ${quote(copy.example.evenSum)}, suma`);
  structure(1, "SiNo");
  statement(2, `Escribir ${quote(copy.example.oddSum)}, suma`);
  structure(1, "FinSi");

  if (differs("integerOnlySwitch") && s.integerOnlySwitch) {
    ruleComment(1, "integerOnlySwitch");
    structure(1, `Segun notas[${first}] Hacer`);
    structure(2, "10:");
    statement(3, `Escribir ${quote(copy.example.excellent)}`);
    structure(2, "8, 9:");
    statement(3, `Escribir ${quote(copy.example.veryGood)}`);
    structure(2, "De Otro Modo:");
    statement(3, `Escribir ${quote(copy.example.keepGoing)}`);
    structure(1, "FinSegun");
  }

  if (differs("deduceNegativeForStep") && !s.deduceNegativeForStep) {
    statement(1, `Escribir ${quote(copy.example.countdown)}`);
    ruleComment(1, "deduceNegativeForStep");
    structure(1, "Para i <- 3 Hasta 1 Con Paso -1 Hacer");
    statement(2, "Escribir i");
    structure(1, "FinPara");
  }

  if (differs("enableStringFunctions") && !s.enableStringFunctions) comment(1, copy.example.noStringFunctions);
  if (differs("allowRepeatWhile") && !s.allowRepeatWhile) comment(1, copy.example.noRepeatWhile);
  structure(0, "FinAlgoritmo");
  return `${lines.join("\n")}\n`;
}

/** Parses and runs `source` with `settings`; returns the output, or null when anything fails. */
export async function verifyProgram(source: string, settings: EngineSettings): Promise<string[] | null> {
  const parsed = new Parser(source, { settings }).parse();
  if (!parsed.program || parsed.diagnostics.some((d) => d.severity === "error")) return null;

  const output: string[] = [];
  let pending = "";
  const runtime: Runtime = {
    write(value, newline = true) {
      pending += value;
      if (newline) {
        output.push(pending);
        pending = "";
      }
    },
    read: () => "",
    clear() {},
    async sleep() {},
    async waitForKey() {},
  };
  const interpreter = new Interpreter({ settings, limits: { maxSteps: 100_000, yieldEvery: 50_000, maxOutputLines: 100 } });
  const result = await interpreter.run(source, runtime);
  if (pending) output.push(pending);
  if (result.diagnostics.some((d) => d.severity === "error")) return null;
  return output;
}

const cache = new Map<string, Promise<ProfileExample | null>>();

/** The verified example for a profile in a locale, or null if none could be verified. */
export function profileExample(profile: SiteProfile, locale: Locale): Promise<ProfileExample | null> {
  const key = `${locale}:${profile.id}`;
  let example = cache.get(key);
  if (!example) {
    const source = buildExampleSource(profile, profilesCopy(locale));
    example = verifyProgram(source, profile.settings).then((output) =>
      output ? { name: `${programName(profile.label)}.psc`, source, output } : null,
    );
    cache.set(key, example);
  }
  return example;
}
