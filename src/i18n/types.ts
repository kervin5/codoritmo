import type { EngineMessageCode } from "../engine/messages";
import type { StaticType } from "../engine/types";
import type { FeatureId } from "../seo/sections";
import type { ReferenceGuide } from "./reference-guide/types";

/** Localized text for one example program (keyed by example id). */
export interface ExampleCopy {
  label: string;
  /** One line shown in lists. */
  description: string;
  /** "Lo que aprenderás": 1-3 sentences on the concepts it shows. */
  learn: string;
  /** A small change for the student to try. */
  challenge: string;
  /** A nudge for the challenge, revealed on demand. */
  hint: string;
}

/** Where an About-page feature section links: a feature page or a site section. */
export type AboutLinkTarget = FeatureId | "examples" | "reference" | "profiles";

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
      /** What the app does, one item each, for the WebApplication structured data. */
      featureList: string[];
    };
  };
  appShell: {
    about: string;
    /** Label for the link to the source repository. */
    repository: string;
    collapseNavigation: string;
    examples: string;
    expandNavigation: string;
    tagline: string;
    workspace: string;
  };
  aboutPage: {
    /** The site name as the page's short label (used in structured data). */
    eyebrow: string;
    breadcrumb: string;
    title: string;
    lead: string;
    whatTitle: string;
    whatBody: string[];
    featuresTitle: string;
    featuresIntro: string;
    /** One short section per major feature; `links` point at feature pages or site sections. */
    features: { title: string; body: string; links: AboutLinkTarget[] }[];
    compatibilityTitle: string;
    compatibilityBody: string[];
    openSourceTitle: string;
    openSourceBody: string[];
    repositoryLinkLabel: string;
    licenseLinkLabel: string;
    creditsTitle: string;
    creditsBody: string[];
    officialLinkLabel: string;
    ctaTitle: string;
    ctaBody: string;
    ctaButton: string;
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
  examples: Record<string, ExampleCopy>;
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
  /** Beginner explanations for the language reference, keyed by snippet id. */
  referenceGuide: ReferenceGuide;
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
    languageC: string;
    languageCpp: string;
    languageJavaScript: string;
    newTab: string;
    node: string;
    profile: string;
    renameTab: string;
    renameTabTitle: string;
    run: string;
    running: string;
    stepLimitExceeded: string;
    stop: string;
    stopped: string;
    searchProfiles: string;
    diagram: string;
    source: string;
    target: string;
    untitled: string;
    untitledNumber: string;
  };
  studio: {
    menus: { file: string; edit: string; run: string; view: string; help: string };
    file: {
      new: string; open: string; openExample: string; save: string; rename: string; closeTab: string;
      exportAs: string; diagramPng: string; diagramSvg: string; shareLink: string;
    };
    edit: { undo: string; redo: string; find: string; replace: string; suggestions: string; commentLine: string; insert: string };
    run: {
      run: string; continue: string; pause: string; stepNext: string; stepBack: string; stop: string; speed: string;
      speeds: { slow: string; normal: string; fast: string; instant: string };
      profile: string; moreProfiles: string; customize: string;
    };
    view: {
      diagram: string; code: string; reference: string; bottomPanel: string; console: string; deskCheck: string; problems: string;
      translateTo: string; comingSoon: string; zoomIn: string; zoomOut: string; fullscreen: string;
    };
    help: { palette: string; reference: string; shortcuts: string; about: string; officialSite: string; repository: string };
    status: { idle: string; playing: string; paused: string; input: string; done: string; error: string; stopped: string; rewound: string };
    search: string;
    noErrors: string;
    errorCount: { one: string; other: string };
    edited: string;
    unsaved: string;
    closePanel: string;
    togglePanel: string;
    askingInput: string;
    consoleEmpty: string;
    consoleInvite: string;
    runHint: string;
    stepAtLine: string;
    pauseHint: string;
    blankTitle: string;
    blankBody: string;
    blankExamples: string;
    blankReference: string;
    finishedTitle: string;
    runAgain: string;
    inputPlaceholder: string;
    programFinished: string;
    pressPlay: string;
    line: string;
    mainRoutine: string;
    stepsRun: { one: string; other: string };
    endOfProgram: string;
    stoppedLine: string;
    pressEnter: string;
    deskCheckEmpty: string;
    stepColumn: string;
    lineColumn: string;
    problemsEmpty: string;
    translationNeedsFix: string;
    copy: string;
    copied: string;
    saved: string;
    opened: string;
    exported: string;
    exportNeedsFix: string;
    linkCopied: string;
    linkOpened: string;
    renamePrompt: string;
    speedLabel: string;
    reference: {
      atCursor: string; selected: string; followCursor: string; cursorHint: string; search: string; insert: string; insertHint: string;
      example: string; result: string; tip: string; inFlowchart: string; insideCondition: string; insideProcess: string; template: string;
    };
    palette: { placeholder: string; actions: string; noResults: string; referencePath: string };
    shortcuts: {
      title: string; runPause: string; step: string; pauseOutside: string; stop: string; suggestions: string;
      palette: string; panels: string; bottomPanel: string; files: string;
    };
    profiles: { title: string; search: string; builtIn: string; schools: string; settings: string; done: string; flexible: string };
    hover: { variable: string; firstSeen: string; counter: string };
    activity: { diagram: string; code: string; reference: string };
    visualizer: {
      arraysTab: string;
      complexityTab: string;
      steps: string;
      comparisons: string;
      reads: string;
      writes: string;
      memory: string;
      legendActive: string;
      legendChanged: string;
      empty: string;
      noArrays: string;
      truncated: string;
      measure: string;
      measureAgain: string;
      stop: string;
      time: string;
      space: string;
      compareWith: string;
      progress: string;
      intro: string;
      needsInput: string;
      failed: string;
      tooSlow: string;
      stale: string;
      yTime: string;
      ySpace: string;
      thisProgram: string;
      confidence: string;
      notEnough: string;
      explain: Record<string, string>;
      theory: string;
      best: string;
      average: string;
      worst: string;
      theoryNote: string;
    };
    blocks: {
      modeCode: string;
      modeBlocks: string;
      modeHint: string;
      /** First time a whole stack is dragged: how to move just one block. */
      stackHint: string;
      gotIt: string;
      cannotConvert: string;
      fixFirst: string;
      zoomIn: string;
      zoomOut: string;
      resetZoom: string;
      categories: Record<"io" | "variables" | "control" | "operators" | "text" | "arrays" | "screen", string>;
    };
    examples: {
      title: string;
      /** The menu-bar invitation, with the number of examples. */
      explore: string;
      menu: string;
      search: string;
      all: string;
      levels: Record<"1" | "2" | "3", string>;
      topics: Record<"basics" | "decisions" | "loops" | "arrays" | "sorting" | "text" | "routines" | "math" | "projects", string>;
      concepts: Record<string, string>;
      conceptsLabel: string;
      filterByConcept: string;
      clearFilters: string;
      results: { one: string; other: string };
      noResults: string;
      lines: string;
      tabCode: string;
      tabDiagram: string;
      tabOutput: string;
      sampleInput: string;
      noInput: string;
      rerun: string;
      open: string;
      learn: string;
      challenge: string;
      guide: string;
      showHint: string;
      dismiss: string;
      back: string;
      /** Share the example's public page (native share sheet or clipboard). */
      share: string;
      /** Shown inline after the link is copied. */
      linkCopied: string;
      /** Label of the read-only URL field shown when copying is blocked. */
      copyFailed: string;
      /** Opens the example's public page in a new tab. */
      viewPage: string;
      /** Tooltip/aria for the "view page" link. */
      viewPageHint: string;
      /** Chips for an example's big-O metadata. */
      complexity: {
        label: string;
        best: string;
        average: string;
        worst: string;
        space: string;
        stable: string;
        unstable: string;
        inPlace: string;
      };
    };
  };
  /** Public, statically generated example pages (/es/ejemplos, /en/examples). */
  examplePages: {
    /** Index <title> and description. */
    indexTitle: string;
    indexDescription: string;
    indexKeywords: string[];
    eyebrow: string;
    /** Index H1. */
    heading: string;
    intro: string;
    forStudentsTitle: string;
    forStudentsBody: string;
    forTeachersTitle: string;
    forTeachersBody: string;
    /** Topic <title>; {topic} is filled in. */
    topicTitle: string;
    /** Topic meta description; {topic} and {count} are filled in. */
    topicDescription: string;
    /** One-paragraph intro for each topic page, keyed by topic id. */
    topicIntros: Record<"basics" | "decisions" | "loops" | "arrays" | "sorting" | "text" | "routines" | "math" | "projects", string>;
    /** Example <title>; {title} is filled in. */
    exampleTitle: string;
    exampleCount: { one: string; other: string };
    viewTopic: string;
    breadcrumbLabel: string;
    level: string;
    topic: string;
    concepts: string;
    code: string;
    lineCount: { one: string; other: string };
    copyCode: string;
    codeCopied: string;
    copyFailed: string;
    flowchart: string;
    flowchartIntro: string;
    /** aria-label of each flowchart; {name} is the routine. */
    flowchartLabel: string;
    sampleRun: string;
    sampleRunIntro: string;
    sampleRunNoInput: string;
    /** Screen-reader prefix before each typed answer. */
    answer: string;
    outputTruncated: string;
    complexityIntro: string;
    complexityCase: string;
    complexityCost: string;
    traits: string;
    challenge: string;
    showHint: string;
    openInCodoritmo: string;
    openInCodoritmoHint: string;
    share: string;
    linkCopied: string;
    previous: string;
    next: string;
    exampleNavigation: string;
    related: string;
    switchLanguage: string;
    /** Name of the other locale, shown in the language switch. */
    otherLanguage: string;
    footerCta: string;
    footerCtaBody: string;
    ogTagline: string;
    skipToContent: string;
  };
  /** Text for every engine diagnostic, keyed by Diagnostic.code. */
  engineMessages: Record<EngineMessageCode, string>;
  /** Type names filled into `*Type` params of engine messages. */
  engineTypeNames: Record<StaticType, string>;
}
