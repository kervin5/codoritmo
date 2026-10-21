#!/usr/bin/env node

// Generates src/engine/school-profiles.ts from upstream PSeInt's bin/perfiles.
//
//   node scripts/parse-pseint-profiles.js [path/to/pseint/bin/perfiles]
//
// Use the profiles from the official repository (https://git.code.sf.net/p/pseint/code,
// branch pseint2), not the stale tmp/pseint mirror.
//
// Each profile is resolved the way PSeInt loads one: start from the default
// value of every setting, apply the key=value lines, then apply the
// compatibility fixes for profiles saved by older versions.

const fs = require("fs");
const path = require("path");

const profilesDir = path.resolve(
  process.argv[2] ?? path.join(__dirname, "../tmp/pseint/bin/perfiles")
);
const outputFile = path.join(__dirname, "../src/engine/school-profiles.ts");

// Upstream setting name -> [our setting name (or null if not applicable), upstream default]
const settingTable = {
  force_init_vars: ["forceInitVars", false],
  force_define_vars: ["forceDefineVars", false],
  force_semicolon: ["forceSemicolon", false],
  allow_concatenation: ["allowConcatenation", true],
  enable_string_functions: ["enableStringFunctions", true],
  word_operators: ["wordOperators", true],
  base_zero_arrays: ["baseZeroArrays", false],
  allow_dinamyc_dimensions: ["allowDynamicDimensions", true],
  allow_resize_arrays: ["allowResizeArrays", true],
  overload_equal: ["overloadEqual", false],
  enable_user_functions: ["enableUserFunctions", true],
  lazy_syntax: ["lazySyntax", true],
  coloquial_conditions: ["colloquialConditions", true],
  integer_only_switch: ["integerOnlySwitch", false],
  deduce_negative_for_step: ["deduceNegativeForStep", true],
  use_nassi_shneiderman: [null, false],
  use_alternative_io_shapes: [null, false],
  allow_accents: ["allowAccents", true],
  prefer_algoritmo: [null, true],
  prefer_funcion: [null, true],
  allow_repeat_while: ["allowRepeatWhile", true],
  allow_for_each: ["allowForEach", true],
  prefer_repeat_while: [null, false],
  protect_for_counter: ["protectForCounter", true],
};

// Keys PSeInt also accepts under another spelling.
const keyAliases = {
  use_nassi_schneiderman: "use_nassi_shneiderman",
};

function isTrue(value) {
  return value.length > 0 && "1VvsSTt".includes(value[0]);
}

function decode(buffer) {
  const text = (() => {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      return buffer.toString("latin1");
    }
  })();
  return text.replace(/\0/g, "").replace(/^﻿/, "").replace(/\r/g, "");
}

function parseProfileFile(filePath) {
  const values = {};
  for (const [key, [, defaultValue]] of Object.entries(settingTable)) {
    values[key] = defaultValue;
  }
  const description = [];
  let version = 0;

  for (const line of decode(fs.readFileSync(filePath)).split("\n")) {
    const separator = line.indexOf("=");
    if (separator === -1) continue;
    const rawKey = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (rawKey === "desc") {
      description.push(value);
      continue;
    }
    if (rawKey === "version") {
      version = Number.parseInt(value, 10) || 0;
      continue;
    }
    const key = keyAliases[rawKey] ?? rawKey;
    if (key in settingTable) {
      values[key] = isTrue(value);
    }
  }

  // Settings that used to be part of lazy_syntax in older profiles.
  if (version < 20210609) values.allow_for_each = values.lazy_syntax;
  if (version < 20210407) values.allow_repeat_while = values.lazy_syntax;
  if (version < 20160321) values.allow_accents = values.lazy_syntax;
  if (version < 20150304) {
    values.integer_only_switch = !values.lazy_syntax;
    values.deduce_negative_for_step = values.lazy_syntax;
  }
  if (values.coloquial_conditions) values.word_operators = true;

  const settings = {};
  for (const [key, [ourKey]] of Object.entries(settingTable)) {
    if (ourKey) settings[ourKey] = values[key];
  }

  return {
    description: description.join("\n").trim(),
    settings,
  };
}

function generateTypeScript(profiles) {
  let output = `// Auto-generated from PSeInt school profiles - DO NOT EDIT MANUALLY
// Run 'node scripts/parse-pseint-profiles.js <pseint>/bin/perfiles' to regenerate
// Source: upstream PSeInt bin/perfiles (branch pseint2)

import { EngineSettings } from './types';

export const generatedProfiles: Array<{
  id: string;
  label: string;
  description: string;
  settings: Partial<EngineSettings>;
}> = [
`;

  for (const [id, profile] of Object.entries(profiles)) {
    const label = id.replace(/-/g, " ");
    const description = profile.description || `Profile for ${label}`;
    const settings = Object.entries(profile.settings)
      .map(([key, value]) => `      ${key}: ${value},`)
      .join("\n");

    output += `  {\n`;
    output += `    id: ${JSON.stringify(id)},\n`;
    output += `    label: ${JSON.stringify(label)},\n`;
    output += `    description: ${JSON.stringify(description)},\n`;
    output += `    settings: {\n${settings}\n    },\n`;
    output += `  },\n`;
  }

  output += `];\n`;
  return output;
}

try {
  const files = fs
    .readdirSync(profilesDir)
    .filter((file) => fs.statSync(path.join(profilesDir, file)).isFile())
    .sort((a, b) => a.localeCompare(b, "en"));
  const profiles = {};

  for (const file of files) {
    profiles[file] = parseProfileFile(path.join(profilesDir, file));
  }

  fs.writeFileSync(outputFile, generateTypeScript(profiles));
  console.log(`Generated ${outputFile} with ${files.length} profiles from ${profilesDir}`);
} catch (err) {
  console.error("Error:", err);
  process.exit(1);
}
