import {
  editableEngineSettingDefinitions,
  type EngineSettings,
} from '@/src/engine';
import { localizeSettingDefinition } from '@/src/i18n/helpers';
import type { Dictionary } from '@/src/i18n/types';

import { ActionButton, AppIcon, SectionLabel, StatusChip, classes } from './ui';

const settingGroups: Array<{
  id: string;
  keys: Array<keyof EngineSettings>;
  title: string;
}> = [
  {
    id: 'typing',
    title: 'Typing & Safety',
    keys: ['forceDefineVars', 'forceInitVars', 'protectForCounter'],
  },
  {
    id: 'arrays',
    title: 'Arrays & Loops',
    keys: ['baseZeroArrays', 'allowDynamicDimensions', 'allowForEach', 'deduceNegativeForStep'],
  },
  {
    id: 'syntax',
    title: 'Syntax & Operators',
    keys: ['overloadEqual', 'colloquialConditions', 'lazySyntax', 'wordOperators', 'allowRepeatWhile', 'allowAccents', 'integerOnlySwitch'],
  },
  {
    id: 'functions',
    title: 'Routines & Text',
    keys: ['allowConcatenation', 'enableUserFunctions', 'enableStringFunctions'],
  },
];

function SettingToggle({
  checked,
  description,
  disabled = false,
  label,
  onChange,
  status,
}: {
  checked: boolean;
  description: string;
  disabled?: boolean;
  label: string;
  onChange: (nextValue: boolean) => void;
  status: string;
}) {
  return (
    <label className={classes(
      'flex items-start justify-between gap-4 rounded-[18px] border border-[var(--line)] bg-[rgba(255,252,247,0.96)] px-4 py-4 transition',
      disabled ? 'opacity-65' : 'hover:border-[var(--accent-soft)]',
    )}>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
          {label}
          {status !== 'implemented' ? (
            <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
              {status}
            </span>
          ) : null}
        </span>
        <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
          {description}
        </span>
      </span>

      <span className="relative mt-1 flex shrink-0 items-center">
        <input
          aria-label={label}
          checked={checked}
          className="peer sr-only"
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
        <span className={classes(
          'relative block h-7 w-12 rounded-full transition',
          checked ? 'bg-[var(--accent)]' : 'bg-[rgba(43,36,28,0.12)]',
        )}>
          <span className={classes(
            'absolute top-1 h-5 w-5 rounded-full bg-white shadow-[0_4px_10px_rgba(43,36,28,0.14)] transition',
            checked ? 'left-6' : 'left-1',
          )} />
        </span>
      </span>
    </label>
  );
}

interface ProfileDrawerProps {
  activeProfileLabel: string;
  dictionary: Dictionary;
  isCustomProfile: boolean;
  isOpen: boolean;
  onClose: () => void;
  onToggle: (key: keyof EngineSettings, value: boolean) => void;
  settings: EngineSettings;
}

export default function ProfileDrawer({
  activeProfileLabel,
  dictionary,
  isCustomProfile,
  isOpen,
  onClose,
  onToggle,
  settings,
}: ProfileDrawerProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[rgba(43,36,28,0.24)] backdrop-blur-sm">
      <button
        aria-label={dictionary.profileDrawer.closeSettingsOverlay}
        className="flex-1"
        onClick={onClose}
        type="button"
      />

      <aside className="relative flex h-full w-full max-w-[480px] flex-col border-l border-[var(--line)] bg-[rgba(251,248,241,0.98)] shadow-[-18px_0_38px_rgba(43,36,28,0.12)]">
        <div className="flex items-start justify-between border-b border-[var(--line)] px-6 py-5">
          <div>
            <SectionLabel>{dictionary.profileDrawer.sectionLabel}</SectionLabel>
            <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
              {activeProfileLabel}
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {dictionary.profileDrawer.changesDescription}
            </p>
          </div>

          <button
            aria-label={dictionary.profileDrawer.closeProfileDrawer}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--line)] bg-white text-[var(--foreground)] transition hover:bg-[rgba(43,36,28,0.03)]"
            onClick={onClose}
            type="button"
          >
            <AppIcon className="h-4 w-4" name="close" />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-5 [scrollbar-gutter:stable]">
          <div className="mb-5 flex items-center justify-between gap-3 rounded-[20px] border border-[var(--line)] bg-[rgba(255,252,247,0.96)] px-4 py-4">
            <div>
              <SectionLabel>{dictionary.profileDrawer.activePreset}</SectionLabel>
              <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                {activeProfileLabel}
              </p>
            </div>
            <StatusChip
              label={isCustomProfile ? dictionary.workspace.customProfile : dictionary.profileDrawer.preset}
              tone={isCustomProfile ? 'warning' : 'accent'}
            />
          </div>

          <div className="grid gap-5">
            {settingGroups.map((group) => {
              const items = editableEngineSettingDefinitions.filter((definition) =>
                definition.key && group.keys.includes(definition.key),
              );

              return (
                <section key={group.id}>
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">
                    {dictionary.profileDrawer.groups[group.id] ?? group.title}
                  </h3>
                  <div className="mt-3 grid gap-3">
                    {items.map((definition) => {
                      const key = definition.key as keyof EngineSettings;
                      const isWordOperatorsForced = key === 'wordOperators' && settings.colloquialConditions;
                      const localizedDefinition = localizeSettingDefinition(definition, dictionary);

                      return (
                        <SettingToggle
                          checked={settings[key]}
                          description={localizedDefinition.description}
                          disabled={isWordOperatorsForced}
                          key={definition.upstreamName}
                          label={localizedDefinition.label}
                          onChange={(nextValue) => onToggle(key, nextValue)}
                          status={dictionary.profileDrawer.status[definition.status] ?? definition.status}
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        <div className="border-t border-[var(--line)] px-6 py-4">
          <ActionButton icon="close" label={dictionary.profileDrawer.close} onClick={onClose} />
        </div>
      </aside>
    </div>
  );
}
