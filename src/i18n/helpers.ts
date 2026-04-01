import type {
  EngineProfile,
  EngineSettingDefinition,
  ExampleProgram,
} from '@/src/engine';

import { formatMessage } from './format';
import type { Dictionary } from './types';

export function formatCount(
  forms: { one: string; other: string },
  count: number,
): string {
  return formatMessage(count === 1 ? forms.one : forms.other, { count });
}

export function localizeExamples(
  examples: ExampleProgram[],
  dictionary: Dictionary,
): ExampleProgram[] {
  return examples.map((example) => {
    const copy = dictionary.examples[example.id];

    if (!copy) {
      return example;
    }

    return {
      ...example,
      description: copy.description,
      label: copy.label,
    };
  });
}

export function localizeProfiles(
  profiles: EngineProfile[],
  dictionary: Dictionary,
): EngineProfile[] {
  return profiles.map((profile) => {
    const copy = dictionary.profileDrawer.profiles[profile.id];

    if (!copy) {
      return profile;
    }

    return {
      ...profile,
      description: copy.description,
      label: copy.label,
    };
  });
}

export function localizeSettingDefinition(
  definition: EngineSettingDefinition,
  dictionary: Dictionary,
): EngineSettingDefinition {
  const copy = dictionary.profileDrawer.settings[definition.upstreamName];

  if (!copy) {
    return definition;
  }

  return {
    ...definition,
    description: copy.description,
    label: copy.label,
  };
}
