export interface Dictionary {
  metadata: {
    description: string;
    keywords: string[];
    siteName: string;
    title: string;
    about: {
      description: string;
      keywords: string[];
      title: string;
    };
    home: {
      description: string;
      keywords: string[];
      title: string;
    };
  };
  appShell: {
    about: string;
    collapseNavigation: string;
    examples: string;
    expandNavigation: string;
    tagline: string;
    workspace: string;
  };
  aboutPage: {
    compatibilityBody: string;
    compatibilityTitle: string;
    eyebrow: string;
    officialLinkLabel: string;
    storyBody: string;
    storyTitle: string;
    title: string;
  };
  bottomDock: {
    collapse: string;
    continueKeyWait: string;
    expand: string;
    inputPlaceholder: string;
    issueCount: {
      one: string;
      other: string;
    };
    noOutputYet: string;
    noProblems: string;
    output: string;
    outputReady: string;
    problems: string;
    programInput: string;
    ready: string;
    running: string;
    severities: Record<string, string>;
    submitInput: string;
    waitingForInput: string;
    waitingForKey: string;
  };
  diagram: {
    buildInProgress: string;
    classicFlow: string;
    download: string;
    fitView: string;
    fixErrorsHint: string;
    invalidProgramBody: string;
    invalidProgramTitle: string;
    maximize: string;
    resetLayout: string;
    restore: string;
    routine: string;
    routineSelect: string;
    tab: string;
    visualOnlyHint: string;
  };
  editor: {
    loading: string;
  };
  examples: Record<
    string,
    {
      description: string;
      label: string;
    }
  >;
  library: {
    chooseExample: string;
    close: string;
    lineCount: {
      one: string;
      other: string;
    };
    noExampleSelected: string;
    noExampleSelectedBody: string;
    noExamplesMatch: string;
    openInNewTab: string;
    searchExamples: string;
    sectionLabel: string;
    selected: string;
  };
  profileDrawer: {
    activePreset: string;
    changesDescription: string;
    close: string;
    closeProfileDrawer: string;
    closeSettingsOverlay: string;
    groups: Record<string, string>;
    preset: string;
    profiles: Record<
      string,
      {
        description: string;
        label: string;
      }
    >;
    sectionLabel: string;
    settings: Record<
      string,
      {
        description: string;
        label: string;
      }
    >;
    status: Record<string, string>;
  };
  sidebar: {
    collapsePanel: string;
    /** Visually emphasized line on the collapsed desktop rail (meaningful word first, e.g. Comandos). */
    collapsedRailLead: string;
    /** Secondary line under the lead (short, muted). */
    collapsedRailTrail: string;
    description: string;
    details: string;
    expandPanel: string;
    moreVariations: string;
    sectionLabel: string;
    title: string;
  };
  snippets: {
    defaultHelpBody: string;
    defaultHelpTitle: string;
    diagnosticTitle: string;
    groups: Record<string, string>;
    items: Record<
      string,
      {
        body?: string;
        disabledBody?: string;
        disabledLabel?: string;
        disabledTitle?: string;
        label?: string;
        title?: string;
        variants?: Record<
          string,
          {
            body: string;
            label: string;
            title: string;
          }
        >;
      }
    >;
  };
  workspace: {
    closeTab: string;
    customProfile: string;
    defaultHelpBody: string;
    defaultHelpTitle: string;
    downloadExport: string;
    downloadSource: string;
    editProfile: string;
    browser: string;
    executionPaused: string;
    export: string;
    exportEmpty: string;
    exportLanguage: string;
    exportTarget: string;
    language: string;
    languageJavaScript: string;
    newTab: string;
    node: string;
    profile: string;
    renameTab: string;
    renameTabTitle: string;
    run: string;
    running: string;
    searchProfiles: string;
    diagram: string;
    source: string;
    target: string;
    untitled: string;
    untitledNumber: string;
  };
}
