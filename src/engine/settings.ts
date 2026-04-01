import {
  EngineProfile,
  EngineSettingDefinition,
  EngineSettings,
  FixtureArgumentParseResult,
} from "./types";
import { generatedProfiles } from "./school-profiles";

export const defaultEngineSettings: EngineSettings = {
  forceDefineVars: false,
  forceInitVars: false,
  baseZeroArrays: false,
  allowConcatenation: true,
  allowDynamicDimensions: true,
  overloadEqual: false,
  colloquialConditions: true,
  lazySyntax: true,
  wordOperators: true,
  enableUserFunctions: true,
  enableStringFunctions: true,
  integerOnlySwitch: false,
  deduceNegativeForStep: true,
  allowAccents: true,
  allowRepeatWhile: true,
  allowForEach: true,
  protectForCounter: false,
};

export const engineSettingDefinitions: EngineSettingDefinition[] = [
  {
    key: "forceDefineVars",
    upstreamName: "force_define_vars",
    label: "Require Definir",
    description:
      "Rejects reads, writes, and loop counters that have not been typed with Definir.",
    scope: "runtime",
    status: "implemented",
  },
  {
    key: "forceInitVars",
    upstreamName: "force_init_vars",
    label: "Require Initialization",
    description:
      "Raises runtime errors when uninitialized variables or array elements are used.",
    scope: "runtime",
    status: "implemented",
  },
  {
    upstreamName: "force_semicolon",
    label: "Require Semicolons",
    description:
      "Still missing. The parser does not track line terminators tightly enough yet.",
    scope: "parser",
    status: "missing",
  },
  {
    key: "baseZeroArrays",
    upstreamName: "base_zero_arrays",
    label: "Base-0 Arrays",
    description:
      "Switches array indexing between base 1 and base 0 in both the interpreter and generated JavaScript.",
    scope: "runtime",
    status: "implemented",
  },
  {
    key: "allowConcatenation",
    upstreamName: "allow_concatenation",
    label: "Allow Text +",
    description: "Controls string concatenation through the + operator.",
    scope: "runtime",
    status: "implemented",
  },
  {
    upstreamName: "use_nassi_shneiderman",
    label: "Nassi-Shneiderman Diagrams",
    description:
      "Desktop diagram editor preference. Not applicable to the browser code editor.",
    scope: "editor",
    status: "not_applicable",
  },
  {
    upstreamName: "use_alternative_io_shapes",
    label: "Alternative I/O Shapes",
    description:
      "Desktop flowchart rendering preference. Not applicable to the browser code editor.",
    scope: "editor",
    status: "not_applicable",
  },
  {
    key: "allowDynamicDimensions",
    upstreamName: "allow_dinamyc_dimensions",
    label: "Dynamic Dimensions",
    description:
      "Restricts Dimension to constant numeric expressions when disabled.",
    scope: "parser",
    status: "implemented",
  },
  {
    key: "overloadEqual",
    upstreamName: "overload_equal",
    label: "Allow = Assignment",
    description: "Enables assignment with = in statements and Para headers.",
    scope: "parser",
    status: "implemented",
  },
  {
    key: "colloquialConditions",
    upstreamName: "coloquial_conditions",
    label: "Colloquial Conditions",
    description:
      "Enables forms like ES PAR, ES MAYOR QUE, and NO ES DIVISIBLE POR.",
    scope: "parser",
    status: "implemented",
  },
  {
    key: "lazySyntax",
    upstreamName: "lazy_syntax",
    label: "Flexible Syntax",
    description:
      "Implemented for split Fin ... forms, optional Hacer/Entonces, Mientras Que, and Desde/Con Paso variations. Other desktop shortcuts remain missing.",
    scope: "parser",
    status: "partial",
  },
  {
    key: "wordOperators",
    upstreamName: "word_operators",
    label: "Word Operators",
    description: "Controls Y, O, NO, and MOD as operator keywords.",
    scope: "parser",
    status: "implemented",
  },
  {
    key: "enableUserFunctions",
    upstreamName: "enable_user_functions",
    label: "User Routines",
    description:
      "Allows or blocks SubProceso, SubAlgoritmo, and Funcion declarations.",
    scope: "parser",
    status: "implemented",
  },
  {
    key: "enableStringFunctions",
    upstreamName: "enable_string_functions",
    label: "String Built-ins",
    description:
      "Controls Longitud, SubCadena, Mayusculas, Minusculas, and Concatenar.",
    scope: "runtime",
    status: "implemented",
  },
  {
    key: "integerOnlySwitch",
    upstreamName: "integer_only_switch",
    label: "Integer-Only Segun",
    description:
      "Rejects obvious non-numeric Segun cases and validates control values at runtime.",
    scope: "parser",
    status: "partial",
  },
  {
    key: "deduceNegativeForStep",
    upstreamName: "deduce_negative_for_step",
    label: "Infer Negative Paso",
    description:
      "Defaults Para step to -1 when the start is greater than the end.",
    scope: "runtime",
    status: "implemented",
  },
  {
    key: "allowAccents",
    upstreamName: "allow_accents",
    label: "Accented Identifiers",
    description:
      "Controls accented letters in identifiers while still allowing accented keywords.",
    scope: "parser",
    status: "implemented",
  },
  {
    upstreamName: "prefer_algoritmo",
    label: "Prefer Algoritmo",
    description:
      "Desktop insertion/autocomplete preference. Not applicable to parsing or execution.",
    scope: "editor",
    status: "not_applicable",
  },
  {
    upstreamName: "prefer_funcion",
    label: "Prefer Funcion",
    description:
      "Desktop insertion/autocomplete preference. Not applicable to parsing or execution.",
    scope: "editor",
    status: "not_applicable",
  },
  {
    key: "allowRepeatWhile",
    upstreamName: "allow_repeat_while",
    label: "Allow Repetir ... Mientras",
    description: "Controls the alternative repeat-while closing form.",
    scope: "parser",
    status: "implemented",
  },
  {
    upstreamName: "prefer_repeat_while",
    label: "Prefer Repetir ... Mientras",
    description:
      "Desktop template preference. Not applicable to parsing or execution.",
    scope: "editor",
    status: "not_applicable",
  },
  {
    key: "allowForEach",
    upstreamName: "allow_for_each",
    label: "Allow Para Cada",
    description: "Controls the foreach-style Para Cada loop.",
    scope: "parser",
    status: "implemented",
  },
  {
    key: "protectForCounter",
    upstreamName: "protect_for_counter",
    label: "Protect Para Counter",
    description:
      "Blocks writes to the active Para counter and leaves it uninitialized after the loop.",
    scope: "runtime",
    status: "implemented",
  },
];

export const editableEngineSettingDefinitions = engineSettingDefinitions.filter(
  (definition) =>
    definition.key &&
    definition.status !== "not_applicable" &&
    definition.status !== "missing"
);

export function normalizeEngineSettings(
  overrides: Partial<EngineSettings> = {}
): EngineSettings {
  const normalized: EngineSettings = {
    ...defaultEngineSettings,
    ...overrides,
  };

  if (normalized.colloquialConditions) {
    normalized.wordOperators = true;
  }

  return normalized;
}

function createProfile(
  id: string,
  label: string,
  description: string,
  overrides: Partial<EngineSettings>
): EngineProfile {
  return {
    id,
    label,
    description,
    settings: normalizeEngineSettings(overrides),
  };
}

export const engineProfiles: EngineProfile[] = [
  createProfile(
    "desktop-default",
    "Desktop Default",
    "Executable settings aligned with upstream PSeInt defaults.",
    {}
  ),
  createProfile(
    "estricto",
    "Estricto",
    "The strict upstream profile subset that materially affects browser parsing and execution.",
    {
      forceDefineVars: true,
      forceInitVars: true,
      baseZeroArrays: true,
      allowConcatenation: false,
      allowDynamicDimensions: false,
      overloadEqual: false,
      colloquialConditions: false,
      lazySyntax: false,
      wordOperators: false,
    }
  ),
  createProfile(
    "flexible",
    "Flexible",
    "The most flexible and permissive profile, recommended for beginners.",
    {
      overloadEqual: true,
    }
  ),
  createProfile(
    "uan",
    "UAN",
    "Representative school profile with explicit typing and = assignment enabled.",
    {
      forceDefineVars: true,
      overloadEqual: true,
    }
  ),
  // Merge in all 385 school profiles from PSeInt
  ...generatedProfiles.map((p) =>
    createProfile(p.id, p.label, p.description, p.settings)
  ),
];

// Custom profiles that can be added at runtime
const customProfiles: EngineProfile[] = [];

// Get all profiles including custom ones
export function getAllProfiles(): EngineProfile[] {
  return [...engineProfiles, ...customProfiles];
}

// Add a custom profile at runtime
export function addCustomProfile(profile: EngineProfile): void {
  // Check if profile with this ID already exists
  const existingIndex = customProfiles.findIndex((p) => p.id === profile.id);
  if (existingIndex >= 0) {
    customProfiles[existingIndex] = profile;
  } else {
    customProfiles.push(profile);
  }
}

// Remove a custom profile
export function removeCustomProfile(profileId: string): boolean {
  const index = customProfiles.findIndex((p) => p.id === profileId);
  if (index >= 0) {
    customProfiles.splice(index, 1);
    return true;
  }
  return false;
}

const fixtureFlagMap: Record<string, keyof EngineSettings> = {
  allow_accents: "allowAccents",
  allow_concatenation: "allowConcatenation",
  allow_dinamyc_dimensions: "allowDynamicDimensions",
  allow_for_each: "allowForEach",
  allow_repeat_while: "allowRepeatWhile",
  allow_word_operators: "wordOperators",
  base_zero_arrays: "baseZeroArrays",
  coloquial_conditions: "colloquialConditions",
  deduce_negative_for_step: "deduceNegativeForStep",
  enable_string_functions: "enableStringFunctions",
  enable_user_functions: "enableUserFunctions",
  force_define_vars: "forceDefineVars",
  force_init_vars: "forceInitVars",
  integer_only_switch: "integerOnlySwitch",
  lazy_syntax: "lazySyntax",
  overload_equal: "overloadEqual",
  protect_for_counter: "protectForCounter",
  word_operators: "wordOperators",
};

function parseBooleanFlag(value: string): boolean | null {
  if (value === "1" || value.toLowerCase() === "true") {
    return true;
  }

  if (value === "0" || value.toLowerCase() === "false") {
    return false;
  }

  return null;
}

export function parseFixtureArguments(
  rawArgs: string
): FixtureArgumentParseResult {
  const settings: Partial<EngineSettings> = {};
  const input: string[] = [];
  const unsupported = new Set<string>();
  const matches = rawArgs.matchAll(/--([a-z_]+)=("[^"]*"|'[^']*'|[^\s]+)/gi);

  for (const match of matches) {
    const name = match[1]?.toLowerCase();
    const value = match[2] ?? "";
    const normalizedValue = value.replace(/^['"]|['"]$/g, "");

    if (name === "input") {
      input.push(normalizedValue);
      continue;
    }

    const key = fixtureFlagMap[name];
    if (!key) {
      unsupported.add(name);
      continue;
    }

    const booleanValue = parseBooleanFlag(normalizedValue);
    if (booleanValue === null) {
      unsupported.add(name);
      continue;
    }

    settings[key] = booleanValue;
  }

  return {
    input,
    settings,
    unsupported: [...unsupported].sort(),
  };
}

export function getEngineProfile(profileId: string): EngineProfile | null {
  // Check built-in profiles first
  const builtIn = engineProfiles.find((profile) => profile.id === profileId);
  if (builtIn) return builtIn;

  // Check custom profiles
  const custom = customProfiles.find((profile) => profile.id === profileId);
  return custom ?? null;
}

export function settingsEqual(a: EngineSettings, b: EngineSettings): boolean {
  return Object.keys(defaultEngineSettings).every((key) => {
    const settingKey = key as keyof EngineSettings;
    return a[settingKey] === b[settingKey];
  });
}

export function resolveProfileId(settings: EngineSettings): string | null {
  const profile = engineProfiles.find((candidate) =>
    settingsEqual(candidate.settings, settings)
  );
  return profile?.id ?? null;
}
