import type { Dictionary } from "./types";

export const enDictionary: Dictionary = {
  metadata: {
    title: "Codoritmo",
    siteName: "Codoritmo",
    description:
      "Codoritmo is an independent browser pseudocode workspace inspired by PSeInt, with runtime diagnostics, flow diagrams, and JavaScript export.",
    keywords: [
      "Codoritmo",
      "pseudocode editor",
      "flowchart pseudocode",
      "browser pseudocode workspace",
      "PSeInt alternative",
      "PSeInt online",
    ],
    home: {
      title: "PSeInt Online Alternative",
      description:
        "Codoritmo is an independent browser pseudocode workspace inspired by PSeInt, with Monaco editing, runtime diagnostics, flow diagrams, and browser or Node.js JavaScript export.",
      keywords: [
        "PSeInt online",
        "PSeInt in browser",
        "PSeInt alternative",
        "PSeInt-compatible pseudocode",
        "pseudocode flowchart online",
        "JavaScript export from pseudocode",
      ],
    },
    about: {
      title: "About",
      description:
        "Codoritmo is a browser pseudocode workspace that takes direct inspiration from PSeInt. Same dialect, same spirit, built for the web with its own roadmap.",
      keywords: [
        "about Codoritmo",
        "PSeInt inspired",
        "browser pseudocode IDE",
        "PSeInt compatibility",
        "teach pseudocode online",
      ],
    },
  },
  appShell: {
    about: "About",
    collapseNavigation: "Collapse navigation",
    examples: "Examples",
    expandNavigation: "Expand navigation",
    tagline: "Pseudocode workspace",
    workspace: "Workspace",
  },
  aboutPage: {
    eyebrow: "Codoritmo",
    title: "Pseudocode, diagrams, and export in the browser",
    storyTitle: "Our story",
    storyBody:
      "PSeInt is where pseudocode became a classroom standard across Latin America. Codoritmo is a direct descendant: same syntax, same teaching spirit, browser-native. We built it as a thank-you to PSeInt and to the teachers who depend on it. The familiar things are familiar on purpose. What is new is the environment: live diagnostics, flow diagrams, and JavaScript export without leaving the browser.",
    compatibilityTitle: "PSeInt dialect, web-native build",
    compatibilityBody:
      "Syntax, profiles, and core semantics stay close to PSeInt so existing exercises and habits carry over. Codoritmo is its own project: some things are shaped for the browser and for exporting JavaScript, and we may diverge where the web needs it. The official desktop app and full docs are on the PSeInt site.",
    officialLinkLabel: "Visit the official PSeInt project",
  },
  bottomDock: {
    collapse: "Collapse output",
    continueKeyWait: "Continue key wait",
    expand: "Expand output",
    inputPlaceholder: "Type a value and press Enter",
    issueCount: {
      one: "{count} issue",
      other: "{count} issues",
    },
    noOutputYet: "No output yet.",
    noProblems: "No problems.",
    output: "Output",
    outputReady: "Output ready",
    problems: "Problems",
    programInput: "Program input",
    ready: "Ready",
    running: "Running",
    severities: {
      error: "error",
      warning: "warning",
    },
    submitInput: "Enter",
    waitingForInput: "Waiting for input",
    waitingForKey: "Waiting for key",
  },
  diagram: {
    buildInProgress: "Building diagram…",
    classicFlow: "Classic Flow",
    download: "Download PNG",
    fitView: "Fit View",
    fixErrorsHint: "Fix parse errors to render the flowchart.",
    invalidProgramBody:
      "The diagram tab needs a valid Proceso or Algoritmo before it can build the flow.",
    invalidProgramTitle: "Diagram unavailable",
    maximize: "Maximize Diagram",
    resetLayout: "Reset Layout",
    restore: "Restore Diagram",
    routine: "Routine",
    routineSelect: "Diagram Routine",
    tab: "Diagram",
    visualOnlyHint: "Visual-only layout. Dragging blocks does not change code.",
  },
  editor: {
    loading: "Loading Monaco editor…",
  },
  examples: {
    "hello-world": {
      label: "Hola Mundo",
      description: "A minimal pseudocode program that writes one line.",
    },
    "loops-and-output": {
      label: "Bucles",
      description:
        "While, repeat, and for loops using the canonical browser dialect.",
    },
    references: {
      label: "Por Referencia",
      description: "SubProceso with by-reference parameters and arrays.",
    },
    "runtime-controls": {
      label: "Esperar y Limpiar",
      description:
        "Runtime controls that map cleanly to the browser playground.",
    },
  },
  library: {
    chooseExample: "Choose example",
    close: "Close",
    lineCount: {
      one: "{count} line",
      other: "{count} lines",
    },
    noExampleSelected: "No example selected",
    noExampleSelectedBody:
      "Clear the current search or pick an item from the list to open it in a new tab.",
    noExamplesMatch: "No examples match this search.",
    openInNewTab: "Open in New Tab",
    searchExamples: "Search examples",
    sectionLabel: "Examples",
    selected: "Selected",
  },
  profileDrawer: {
    activePreset: "Active Preset",
    changesDescription:
      "Changes apply immediately to parsing, execution, and JavaScript preview.",
    close: "Close",
    closeProfileDrawer: "Close profile drawer",
    closeSettingsOverlay: "Close settings overlay",
    groups: {
      arrays: "Arrays & Loops",
      functions: "Routines & Text",
      syntax: "Syntax & Operators",
      typing: "Typing & Safety",
    },
    preset: "Preset",
    profiles: {
      "desktop-default": {
        label: "Desktop Default",
        description:
          "Executable settings aligned with upstream PSeInt defaults.",
      },
      estricto: {
        label: "Estricto",
        description:
          "The strict upstream profile subset that materially affects browser parsing and execution.",
      },
      uan: {
        label: "UAN",
        description:
          "Representative school profile with explicit typing and = assignment enabled.",
      },
    },
    sectionLabel: "Profile Settings",
    settings: {
      force_define_vars: {
        label: "Require Definir",
        description:
          "Rejects reads, writes, and loop counters that have not been typed with Definir.",
      },
      force_init_vars: {
        label: "Require Initialization",
        description:
          "Raises runtime errors when uninitialized variables or array elements are used.",
      },
      base_zero_arrays: {
        label: "Base-0 Arrays",
        description:
          "Switches array indexing between base 1 and base 0 in both the interpreter and generated JavaScript.",
      },
      allow_concatenation: {
        label: "Allow Text +",
        description: "Controls string concatenation through the + operator.",
      },
      allow_dinamyc_dimensions: {
        label: "Dynamic Dimensions",
        description:
          "Restricts Dimension to constant numeric expressions when disabled.",
      },
      overload_equal: {
        label: "Allow = Assignment",
        description:
          "Enables assignment with = in statements and Para headers.",
      },
      coloquial_conditions: {
        label: "Colloquial Conditions",
        description:
          "Enables forms like ES PAR, ES MAYOR QUE, and NO ES DIVISIBLE POR.",
      },
      lazy_syntax: {
        label: "Flexible Syntax",
        description:
          "Implemented for split Fin ... forms, optional Hacer/Entonces, Mientras Que, and Desde/Con Paso variations. Other desktop shortcuts remain missing.",
      },
      word_operators: {
        label: "Word Operators",
        description: "Controls Y, O, NO, and MOD as operator keywords.",
      },
      enable_user_functions: {
        label: "User Routines",
        description:
          "Allows or blocks SubProceso, SubAlgoritmo, and Funcion declarations.",
      },
      enable_string_functions: {
        label: "String Built-ins",
        description:
          "Controls Longitud, SubCadena, Mayusculas, Minusculas, and Concatenar.",
      },
      integer_only_switch: {
        label: "Integer-Only Segun",
        description:
          "Rejects obvious non-numeric Segun cases and validates control values at runtime.",
      },
      deduce_negative_for_step: {
        label: "Infer Negative Paso",
        description:
          "Defaults Para step to -1 when the start is greater than the end.",
      },
      allow_accents: {
        label: "Accented Identifiers",
        description:
          "Controls accented letters in identifiers while still allowing accented keywords.",
      },
      allow_repeat_while: {
        label: "Allow Repetir ... Mientras",
        description: "Controls the alternative repeat-while closing form.",
      },
      allow_for_each: {
        label: "Allow Para Cada",
        description: "Controls the foreach-style Para Cada loop.",
      },
      protect_for_counter: {
        label: "Protect Para Counter",
        description:
          "Blocks writes to the active Para counter and leaves it uninitialized after the loop.",
      },
    },
    status: {
      implemented: "implemented",
      missing: "missing",
      not_applicable: "not applicable",
      partial: "partial",
    },
  },
  sidebar: {
    collapsePanel: "Hide commands panel",
    collapsedRailLead: "Commands",
    collapsedRailTrail: "Panel",
    description: "Hover to inspect, click to insert.",
    details: "Details",
    expandPanel: "Show commands panel",
    moreVariations: "More variations for {label}",
    sectionLabel: "Commands",
    title: "Insert code",
  },
  snippets: {
    defaultHelpBody:
      "Select a structure or operator from the right sidebar to insert it at the cursor. Output and problems stay below the editor.",
    defaultHelpTitle: "Insert code faster",
    diagnosticTitle: "Problem at {line}:{column}",
    groups: {
      algebraic: "Algebraic",
      constants: "Constants",
      logical: "Logical",
      math: "Math Functions",
      relational: "Relational",
      strings: "String Functions",
      structures: "Structures",
    },
    items: {
      abs: {
        title: "Abs",
        body: "Returns the absolute value of a number.",
      },
      and: {
        title: "Logical AND",
        body: "Requires both conditions to be true.",
      },
      asignar: {
        label: "Asignar",
        title: "Asignar",
        body: "Writes a value into a variable or array element.",
      },
      azar: {
        title: "Azar",
        body: "Returns a random integer between 0 and the provided limit minus one.",
      },
      concatenar: {
        title: "Concatenar",
        body: "Combines two string expressions into one value.",
      },
      "convertir-numero": {
        title: "ConvertirANumero",
        body: "Converts text to a numeric value.",
      },
      "convertir-texto": {
        title: "ConvertirATexto",
        body: "Converts a value into its text representation.",
      },
      divide: {
        title: "Division",
        body: "Divides the left expression by the right one.",
      },
      definir: {
        label: "Definir",
        title: "Definir",
        body: "Declares one or more variables and assigns their data type with Como.",
      },
      dimension: {
        label: "Dimension",
        title: "Dimension",
        body: "Sets the size of one or more arrays after they have been declared.",
      },
      euler: {
        title: "Euler",
        body: "The Euler constant.",
      },
      eq: {
        title: "Equals",
        body: "Checks whether both values are equal.",
      },
      escribir: {
        label: "Escribir",
        title: "Escribir",
        body: "Writes one or more values to the output console and advances to the next line.",
        variants: {
          "escribir-linea": {
            label: "Con salto",
            title: "Escribir",
            body: "Writes one or more values and ends the line.",
          },
          "escribir-sin-bajar": {
            label: "Sin Bajar",
            title: "Escribir Sin Bajar",
            body: "Writes without adding a newline, useful for prompts and progressive output.",
          },
        },
      },
      funcion: {
        label: "Funcion",
        title: "Funcion",
        body: "Creates a function routine that can return a named result.",
      },
      geq: {
        title: "Greater or equal",
        body: "Checks whether the left value is greater than or equal to the right one.",
      },
      gt: {
        title: "Greater than",
        body: "Checks whether the left value is greater than the right one.",
      },
      leq: {
        title: "Less or equal",
        body: "Checks whether the left value is smaller than or equal to the right one.",
      },
      leer: {
        label: "Leer",
        title: "Leer",
        body: "Pauses execution until the next entered value is submitted, then stores it in the target variable.",
      },
      longitud: {
        title: "Longitud",
        body: "Returns the character count of a string.",
      },
      lt: {
        title: "Less than",
        body: "Checks whether the left value is smaller than the right one.",
      },
      math: {
        title: "Math Functions",
        body: "",
      },
      minus: {
        title: "Subtraction",
        body: "Subtracts the right expression from the left one.",
      },
      mod: {
        title: "Modulo",
        body: "Returns the remainder of an integer division.",
      },
      multiply: {
        title: "Multiplication",
        body: "Multiplies two numeric expressions.",
      },
      mientras: {
        label: "Mientras",
        title: "Mientras",
        body: "Repeats the body while the condition remains true.",
      },
      limpiar: {
        label: "Limpiar Pantalla",
        title: "Limpiar Pantalla",
        body: "Clears the output console before the next writes appear.",
      },
      neq: {
        title: "Not equal",
        body: "Checks whether the two values differ.",
      },
      not: {
        title: "Logical NOT",
        body: "Negates the following condition.",
      },
      or: {
        title: "Logical OR",
        body: "Requires at least one condition to be true.",
      },
      para: {
        label: "Para",
        title: "Para",
        body: "Adds a counted loop with start and end values.",
        variants: {
          "para-cada": {
            label: "Para Cada",
            title: "Para Cada",
            body: "Iterates over each element of a collection when that profile setting is enabled.",
          },
        },
      },
      pi: {
        title: "PI",
        body: "The Archimedes constant.",
      },
      plus: {
        title: "Addition",
        body: "Adds two numeric expressions or concatenates text when that setting is enabled.",
      },
      power: {
        title: "Power",
        body: "Raises the left expression to the exponent on the right.",
      },
      raiz: {
        title: "Raiz",
        body: "Computes the square root of a non-negative value.",
      },
      redon: {
        title: "Redon",
        body: "Rounds a number to the nearest integer.",
      },
      esperar: {
        label: "Esperar",
        title: "Esperar",
        body: "Pauses execution for a duration expressed in seconds or milliseconds.",
      },
      "esperar-tecla": {
        label: "Esperar Tecla",
        title: "Esperar Tecla",
        body: "Pauses execution until the user continues with a key action.",
      },
      repetir: {
        label: "Repetir",
        title: "Repetir Hasta Que",
        body: "Repeats until the condition becomes true.",
        variants: {
          "repetir-hasta": {
            label: "Hasta Que",
            title: "Repetir Hasta Que",
            body: "Repeats until the condition becomes true.",
          },
          "repetir-mientras": {
            label: "Mientras Que",
            title: "Repetir Mientras Que",
            body: "Repeats while the closing condition remains true.",
          },
        },
      },
      rutina: {
        label: "SubProceso",
        title: "SubProceso",
        body: "Creates a reusable routine with optional by-reference parameters.",
        disabledLabel: "Rutinas desactivadas",
        disabledTitle: "Rutinas desactivadas",
        disabledBody:
          "Enable user routines in the profile settings to insert SubProceso, SubAlgoritmo, or Funcion blocks.",
      },
      segun: {
        label: "Segun",
        title: "Segun",
        body: "Adds a multi-branch selection block with one case and a default path.",
      },
      si: {
        label: "Si",
        title: "Si",
        body: "Adds a conditional block with an explicit true branch.",
        variants: {
          "si-sino": {
            label: "Con Sino",
            title: "Si / Sino",
            body: "Adds true and false branches in the same conditional block.",
          },
        },
      },
      subalgoritmo: {
        label: "SubAlgoritmo",
        title: "SubAlgoritmo",
        body: "Creates an alternate routine header using the same browser engine support as SubProceso.",
      },
      subcadena: {
        title: "SubCadena",
        body: "Extracts a substring using the current array/string indexing base.",
      },
      subproceso: {
        label: "SubProceso",
        title: "SubProceso",
        body: "Creates a reusable routine with optional by-reference parameters.",
      },
      retornar: {
        label: "Retornar",
        title: "Retornar",
        body: "Returns a value from the current function or routine flow.",
      },
      trunc: {
        title: "Trunc",
        body: "Returns the integer part of a number.",
      },
    },
  },
  workspace: {
    closeTab: "Close tab",
    customProfile: "Custom",
    defaultHelpBody:
      "Use the right sidebar to insert commands, operators, and built-in functions into the active editor tab.",
    defaultHelpTitle: "Insert structures",
    downloadExport: "Download JavaScript",
    downloadSource: "Download Source",
    editProfile: "Edit Profile",
    browser: "Browser",
    executionPaused: "Execution Paused",
    export: "Export",
    exportEmpty: "Open Export to generate JavaScript for this session.",
    exportLanguage: "Export Language",
    exportTarget: "Export Target",
    language: "Language",
    languageJavaScript: "JavaScript",
    newTab: "New",
    node: "Node.js",
    profile: "Profile",
    renameTab: "Rename tab",
    renameTabTitle: "Rename {title}",
    run: "Run",
    running: "Running…",
    searchProfiles: "Search profiles...",
    diagram: "Diagram",
    source: "Source",
    target: "Target",
    untitled: "Untitled",
    untitledNumber: "Untitled {n}",
  },
};
