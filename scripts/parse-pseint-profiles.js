#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const profilesDir = path.join(__dirname, "../tmp/pseint/bin/perfiles");
const outputFile = path.join(__dirname, "../src/engine/school-profiles.ts");

// Mapping from PSeInt setting names to our setting names
const settingMap = {
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
};

function parseProfileFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  const profile = {
    description: [],
    settings: {},
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith("#")) {
      // Extract description
      if (trimmed.startsWith("desc=")) {
        profile.description.push(trimmed.substring(5));
      }
      continue;
    }

    // Parse setting=value
    const match = trimmed.match(/^([a-z_]+)=([01])$/);
    if (match) {
      const [, key, value] = match;
      const ourKey = settingMap[key];
      if (ourKey) {
        profile.settings[ourKey] = value === "1";
      }
    }
  }

  return profile;
}

function generateTypeScript(profiles) {
  let output = `// Auto-generated from PSeInt school profiles - DO NOT EDIT MANUALLY
// Generated on ${new Date().toISOString()}
// Run 'node scripts/parse-pseint-profiles.js' to regenerate
// Source: tmp/pseint/bin/perfiles/

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
    const desc =
      profile.description.join(" ").replace(/'/g, "\\'") ||
      `Profile for ${label}`;
    const settings = JSON.stringify(profile.settings, null, 4).replace(
      /"([^"]+)":/g,
      "$1:"
    );

    output += `  {\n`;
    output += `    id: '${id}',\n`;
    output += `    label: '${label}',\n`;
    output += `    description: '${desc}',\n`;
    output += `    settings: ${settings},\n`;
    output += `  },\n`;
  }

  output += `];\n`;

  return output;
}

// Main execution
try {
  const files = fs.readdirSync(profilesDir);
  const profiles = {};

  for (const file of files) {
    if (file === "icons") continue;

    const filePath = path.join(profilesDir, file);
    const stats = fs.statSync(filePath);

    if (stats.isFile()) {
      try {
        const profile = parseProfileFile(filePath);
        profiles[file] = profile;
      } catch (err) {
        console.error(`Error parsing ${file}:`, err.message);
      }
    }
  }

  console.log(`Parsed ${Object.keys(profiles).length} profiles`);

  const typescript = generateTypeScript(profiles);
  fs.writeFileSync(outputFile, typescript);

  console.log(`Generated ${outputFile}`);
  console.log(`Total profiles: ${Object.keys(profiles).length}`);
} catch (err) {
  console.error("Error:", err);
  process.exit(1);
}
