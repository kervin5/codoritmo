import type { ReferenceSiteCopy } from "./reference-types";

// Public language reference pages (/en/reference/<slug>). Keywords stay in
// PSeInt's Spanish (that's what students type), with the English concept next
// to them so the pages match searches like "PSeInt while loop".
export const enReferenceSite: ReferenceSiteCopy = {
  section: "Reference",
  index: {
    title: "PSeInt reference: keywords and operators",
    description:
      "Every PSeInt-style pseudocode keyword, operator and function explained from scratch, with a working example and its flowchart.",
    h1: "PSeInt pseudocode reference",
    intro: [
      "Each word of the language has its own page: what it does, a complete example with the output it prints, the most common mistake and how it looks in a flowchart.",
      "The examples use PSeInt's syntax, which is in Spanish, and were checked by running them in Codoritmo, a free editor that works in the browser. Open any of them with one click and change it.",
    ],
    groupIntros: {
      structures: "The instructions an algorithm is built from: reading and showing data, deciding, repeating and splitting a program into parts.",
      algebraic: "Arithmetic: addition, subtraction, multiplication, division, powers and the remainder of a division.",
      logical: "To combine conditions or flip them.",
      relational: "To compare two values. They always answer true or false.",
      math: "Ready-made functions for absolute values, rounding, square roots and random numbers.",
      strings: "Functions to measure, cut, join and convert text.",
      constants: "Values the language already knows.",
    },
    contents: "Contents",
  },
  page: {
    whatItDoes: "What it does",
    example: "Worked example",
    exampleIntro: "A complete algorithm, ready to copy and run.",
    result: "Output",
    resultIntro: "This is what the console shows when the example runs.",
    resultWithInput: "This is what the console shows when the example runs. What the user types is highlighted.",
    noOutput: "This example doesn't print anything to the console.",
    anotherExample: "Another example",
    mistake: "Common mistake",
    note: "Good to know",
    flowchart: "In a flowchart",
    flowchartIntro: "This is how it appears in a flowchart, with the same shapes Codoritmo draws.",
    flowchartLink: "Draw the flowchart of your own algorithm",
    template: "Template",
    templateIntro: "The general form. Replace what's inside < > with your own data.",
    usedIn: "Examples that use it",
    usedInIntro: "Programs from the example library where it appears, from the simplest to the most complete.",
    seeAllConcept: "See every {concept} example",
    siblings: "More {group}",
    open: "Open it in Codoritmo",
    openHint: "Opens the editor with this example loaded. Run it step by step and watch the flowchart.",
    openLabel: "Open the {name} example in Codoritmo",
    independent:
      "Codoritmo is an independent, open-source project inspired by PSeInt and compatible with its syntax. It is not affiliated with the PSeInt project.",
    officialSite: "Official PSeInt website",
    profilesLink: "language profiles",
    profilesHint: "Some details depend on your school's profile. See the {link}.",
    backToIndex: "Full reference",
    previous: "Previous",
    next: "Next",
    group: "Group",
  },
  shapes: {
    process: "process rectangle",
    input: "input parallelogram",
    output: "output parallelogram",
    decision: "decision diamond",
    switch: "multiple-choice diamond",
    loop: "Para loop hexagon",
    call: "subprocess call rectangle",
  },
  scenes: {
    single: "Flowchart: a {shape} reading \"{label}\", with one arrow in and one arrow out.",
    branches: "Flowchart: a {shape} with the condition \"{label}\"; the Sí (yes) exit continues down and the No exit turns right.",
    while:
      "Flowchart: a {shape} with the condition \"{label}\"; on Sí (yes) it runs the body and loops back to the condition, on No it leaves the loop.",
    "repeat-until":
      "Flowchart: the body first, then a {shape} with the condition \"{label}\" below it; on No it repeats, on Sí (yes) it leaves.",
    "repeat-while":
      "Flowchart: the body first, then a {shape} with the condition \"{label}\" below it; on Sí (yes) it repeats, on No it leaves.",
    for: "Flowchart: a {shape} reading \"{label}\", the body below it and an arrow back to the hexagon on every pass.",
    cases: "Flowchart: a {shape} on \"{label}\" with three exits: 1, 2 and De Otro Modo (otherwise).",
  },
  sceneContext: {
    condition: "It has no shape of its own; it's used inside a condition.",
    process: "It has no shape of its own; it's used inside a calculation.",
  },
  entries: {
    definir: {
      slug: "definir-declare-variables",
      name: "Definir",
      h1: "PSeInt Definir: how to declare variables",
      title: "PSeInt Definir: declaring variables and types",
      description:
        "How to use Definir in PSeInt to declare Entero, Real, Caracter or Logico variables, with an example and the most common beginner mistake.",
    },
    dimension: {
      slug: "dimension-arrays",
      name: "Dimension",
      h1: "PSeInt Dimension: how to create an array",
      title: "PSeInt Dimension: creating arrays, with example",
      description:
        "What Dimension does in PSeInt: create an array, store values in its slots, and which number the slots start at depending on the profile.",
    },
    escribir: {
      slug: "escribir-print-output",
      name: "Escribir",
      h1: "PSeInt Escribir: print messages and values",
      title: "PSeInt Escribir: printing output, with example",
      description:
        "How to use Escribir in PSeInt to print text and variables to the console, how to mix them with commas, and the quotes mistake.",
    },
    "escribir-sin-bajar": {
      slug: "escribir-sin-saltar-same-line",
      name: "Escribir Sin Saltar",
      h1: "PSeInt Escribir Sin Saltar: print without a new line",
      title: "PSeInt Escribir Sin Saltar: stay on one line",
      description:
        "What Escribir Sin Saltar (or Sin Bajar) does in PSeInt: print something without moving to the next line, with an example and its output.",
      note: "Sin Saltar and Sin Bajar mean the same thing; use either.",
    },
    leer: {
      slug: "leer-read-input",
      name: "Leer",
      h1: "PSeInt Leer: read input from the user",
      title: "PSeInt Leer: reading user input, with example",
      description:
        "How Leer works in PSeInt to store what the user types in a variable, with a complete example and a tip about asking the question first.",
    },
    asignar: {
      slug: "assignment-operator",
      name: "Assignment (<-)",
      h1: "Assignment in PSeInt: what the <- arrow means",
      title: "PSeInt assignment operator <- explained",
      description:
        "What the <- arrow means in PSeInt, how to store and update a variable's value, and why it isn't a mathematical equality.",
      note: "Besides <-, := is accepted too. Some profiles also let you assign with =, but <- avoids mixing it up with a comparison.",
    },
    si: {
      slug: "si-entonces-if",
      name: "Si Entonces (if)",
      h1: "PSeInt Si Entonces (if statement): how to make a decision",
      title: "PSeInt Si Entonces: if statement with example",
      description:
        "How to write a Si…Entonces…FinSi condition in PSeInt, what happens when it's false, and how the diamond is drawn in the flowchart.",
    },
    "si-sino": {
      slug: "si-sino-if-else",
      name: "Si / SiNo (if-else)",
      h1: "PSeInt Si SiNo (if-else): a decision with two paths",
      title: "PSeInt SiNo: if-else statement with example",
      description:
        "How to use Si…SiNo…FinSi in PSeInt to choose between two paths, with a pass-or-fail example and its flowchart.",
    },
    segun: {
      slug: "segun-switch",
      name: "Segun (switch)",
      h1: "PSeInt Segun (switch): choose between several options",
      title: "PSeInt Segun: switch statement for menus",
      description:
        "How Segun…Hacer works in PSeInt to build a menu, what De Otro Modo does, and when it beats a chain of Si statements.",
    },
    mientras: {
      slug: "mientras-while-loop",
      name: "Mientras (while)",
      h1: "PSeInt Mientras (while loop): how it works, with an example",
      title: "PSeInt Mientras: while loop with example",
      description:
        "How the Mientras…Hacer loop works in PSeInt, when it stops, an example with its output and how to avoid an infinite loop.",
    },
    repetir: {
      slug: "repetir-hasta-que-do-while",
      name: "Repetir Hasta Que (do-until)",
      h1: "PSeInt Repetir Hasta Que (repeat-until loop), with an example",
      title: "PSeInt Repetir Hasta Que: repeat-until loop",
      description:
        "How Repetir…Hasta Que works in PSeInt, why it always runs at least once, and how to use it to ask for input until it's valid.",
    },
    "repetir-mientras": {
      slug: "repetir-mientras-que-do-while",
      name: "Repetir Mientras Que (do-while)",
      h1: "PSeInt Repetir Mientras Que (do-while loop)",
      title: "PSeInt Repetir Mientras Que: do-while loop",
      description:
        "The difference between Repetir…Mientras Que and Repetir…Hasta Que in PSeInt, with an example that asks until the number isn't negative.",
    },
    para: {
      slug: "para-for-loop",
      name: "Para (for)",
      h1: "PSeInt Para (for loop): counting loop with an example",
      title: "PSeInt Para: for loop with example and step",
      description:
        "How to use the Para…Hasta…Hacer loop in PSeInt, what Con Paso does, an example with its output and when to pick Para over Mientras.",
    },
    "para-cada": {
      slug: "para-cada-for-each",
      name: "Para Cada (for each)",
      h1: "PSeInt Para Cada (for-each loop): walk through an array",
      title: "PSeInt Para Cada: for-each over an array",
      description:
        "How to use Para Cada…De…Hacer in PSeInt to visit every slot of an array without handling positions, with an example and its output.",
    },
    limpiar: {
      slug: "limpiar-pantalla-clear-screen",
      name: "Limpiar Pantalla",
      h1: "PSeInt Limpiar Pantalla: clear the console",
      title: "PSeInt Limpiar Pantalla: clear the screen",
      description: "What Limpiar Pantalla does in PSeInt, when to use it in menus and games, and an example that starts from an empty console.",
    },
    esperar: {
      slug: "esperar-wait",
      name: "Esperar",
      h1: "PSeInt Esperar: pause for some seconds",
      title: "PSeInt Esperar: pausing for seconds",
      description:
        "How to use Esperar 1 Segundo (or milliseconds) in PSeInt to pause before continuing, with a countdown example.",
      note: "You can also give the pause in milliseconds: Esperar 500 Milisegundos.",
    },
    "esperar-tecla": {
      slug: "esperar-tecla-wait-for-key",
      name: "Esperar Tecla",
      h1: "PSeInt Esperar Tecla: wait for a key press",
      title: "PSeInt Esperar Tecla: wait for a key press",
      description:
        "What Esperar Tecla does in PSeInt: stop the program until the person presses a key, with an example for moving between screens.",
    },
    subproceso: {
      slug: "subproceso-procedure",
      name: "SubProceso",
      h1: "PSeInt SubProceso: how to write and call a procedure",
      title: "PSeInt SubProceso: write and call a procedure",
      description:
        "How to create a SubProceso in PSeInt, pass it parameters and call it from the main algorithm, with an example and Por Referencia.",
    },
    subalgoritmo: {
      slug: "subalgoritmo",
      name: "SubAlgoritmo",
      h1: "PSeInt SubAlgoritmo: another name for SubProceso",
      title: "PSeInt SubAlgoritmo: what it is, with example",
      description: "SubAlgoritmo in PSeInt works exactly like SubProceso: it groups instructions under a name. A complete example with the call.",
    },
    funcion: {
      slug: "funcion-function",
      name: "Funcion (function)",
      h1: "PSeInt Funcion: how to return a result",
      title: "PSeInt functions: returning a value",
      description:
        "How to write a Funcion in PSeInt that computes and returns a result, how to call it inside an expression, and a complete example.",
    },
    retornar: {
      slug: "retornar-return",
      name: "Retornar (return)",
      h1: "PSeInt Retornar: end a function with a value",
      title: "PSeInt Retornar: return a value",
      description: "What Retornar does inside a PSeInt Funcion: it ends the function and gives back the value. Example with the larger of two numbers.",
    },
    plus: {
      slug: "addition-operator",
      name: "Addition (+)",
      h1: "Addition in PSeInt: the + operator",
      title: "PSeInt + operator: adding numbers and text",
      description: "How to add with the + operator in PSeInt, how to use it to keep a running total, and when it also joins text.",
    },
    minus: {
      slug: "subtraction-operator",
      name: "Subtraction (-)",
      h1: "Subtraction in PSeInt: the - operator",
      title: "PSeInt - operator: subtraction and negatives",
      description: "How to subtract with the - operator in PSeInt, in which order a chain of subtractions is worked out, and how to write a negative number.",
    },
    multiply: {
      slug: "multiplication-operator",
      name: "Multiplication (*)",
      h1: "Multiplication in PSeInt: the * operator",
      title: "PSeInt * operator: multiplication and precedence",
      description: "How to multiply with * in PSeInt, why it's worked out before addition, and how to use parentheses to change the order.",
    },
    divide: {
      slug: "division-operator",
      name: "Division (/)",
      h1: "Division in PSeInt: the / operator",
      title: "PSeInt / operator: division with decimals",
      description:
        "How to divide with / in PSeInt, why the result can have decimals, how to keep only the whole part and what happens when dividing by 0.",
    },
    power: {
      slug: "power-operator",
      name: "Power (^)",
      h1: "Powers in PSeInt: the ^ operator",
      title: "PSeInt ^ operator: raising to a power",
      description: "How to raise a number to a power with ^ in PSeInt, with an example and its use for squares and areas.",
    },
    mod: {
      slug: "mod-operator",
      name: "MOD (%)",
      h1: "PSeInt MOD operator: the remainder of a division",
      title: "PSeInt MOD: remainder, even numbers, multiples",
      description:
        "What MOD (or %) does in PSeInt: it gives the remainder of a division. Use it to check if a number is even or a multiple of another.",
      note: "Instead of MOD you can write %. The symbol works in every profile; the word MOD works in profiles that allow word operators, like the default one.",
    },
    and: {
      slug: "and-operator",
      name: "Y (&&, and)",
      h1: "PSeInt Y operator (and): when both conditions must hold",
      title: "PSeInt Y (&&) operator: combining conditions",
      description:
        "How to use the logical Y operator (or &&) in PSeInt to require two conditions at once, with an example and its output.",
      note: "Instead of Y you can write &&. The symbol works in every profile; the word Y works in profiles that allow word operators, like the default one.",
    },
    or: {
      slug: "or-operator",
      name: "O (||, or)",
      h1: "PSeInt O operator (or): when one condition is enough",
      title: "PSeInt O (||) operator, with example",
      description:
        "How to use the logical O operator (or ||) in PSeInt so that one true condition is enough, with an example and its output.",
      note: "Instead of O you can write ||. The symbol works in every profile; the word O works in profiles that allow word operators, like the default one.",
    },
    not: {
      slug: "not-operator",
      name: "NO (~, not)",
      h1: "PSeInt NO operator (not): flip a condition",
      title: "PSeInt NO (~) operator: negating conditions",
      description: "How to use the logical NO operator (or ~) in PSeInt to flip a condition, with an example and what it prints.",
      note: "Instead of NO you can write ~ or !. The symbols work in every profile; the word NO works in profiles that allow word operators.",
    },
    eq: {
      slug: "equal-operator",
      name: "Equal (=)",
      h1: "Checking if two values are equal in PSeInt (=)",
      title: "PSeInt = operator: comparing values",
      description:
        "How to compare with = in PSeInt, why it isn't the same as the <- assignment and why \"Ana\" and \"ana\" aren't equal. Example with output.",
      note: "You can also write == to compare.",
    },
    neq: {
      slug: "not-equal-operator",
      name: "Not equal (<>)",
      h1: "Not equal in PSeInt: the <> and != operators",
      title: "PSeInt not equal: the <> and != operators",
      description: "How to check whether two values are different in PSeInt with <> or !=, with an example and how to use it in a condition.",
      note: "<> and != mean the same thing; use the one your class uses.",
    },
    lt: {
      slug: "less-than-operator",
      name: "Less than (<)",
      h1: "Less than in PSeInt: the < operator",
      title: "PSeInt < operator: less than, with example",
      description: "How to use the < (less than) operator in PSeInt to compare two values inside a condition, with an example and its output.",
    },
    leq: {
      slug: "less-than-or-equal-operator",
      name: "Less or equal (<=)",
      h1: "Less than or equal in PSeInt: the <= operator",
      title: "PSeInt <= operator: less than or equal",
      description: "How to use <= (less than or equal) in PSeInt, how it differs from <, and an example that counts up to a limit included.",
    },
    gt: {
      slug: "greater-than-operator",
      name: "Greater than (>)",
      h1: "Greater than in PSeInt: the > operator",
      title: "PSeInt > operator: greater than, with example",
      description: "How to use the > (greater than) operator in PSeInt to compare two values inside a condition, with an example and its output.",
    },
    geq: {
      slug: "greater-than-or-equal-operator",
      name: "Greater or equal (>=)",
      h1: "Greater than or equal in PSeInt: the >= operator",
      title: "PSeInt >= operator: greater than or equal",
      description: "How to use >= (greater than or equal) in PSeInt, how it differs from >, and an example that checks if someone is an adult.",
    },
    abs: {
      slug: "abs-absolute-value",
      name: "Abs",
      h1: "PSeInt Abs: absolute value",
      title: "PSeInt Abs: absolute value with example",
      description: "What the Abs function does in PSeInt: it gives the number without its sign. Example and how to measure the gap between two values.",
    },
    trunc: {
      slug: "trunc-truncate",
      name: "Trunc",
      h1: "PSeInt Trunc: keep the whole part of a number",
      title: "PSeInt Trunc: whole part without rounding",
      description: "What Trunc does in PSeInt: it cuts off the decimals without rounding. Example and how it differs from Redon.",
    },
    redon: {
      slug: "redon-round",
      name: "Redon",
      h1: "PSeInt Redon: round to the nearest whole number",
      title: "PSeInt Redon: rounding numbers",
      description: "How to round with Redon in PSeInt, what happens with numbers ending in .5, and how it differs from Trunc.",
    },
    raiz: {
      slug: "raiz-square-root",
      name: "Raiz",
      h1: "PSeInt Raiz: square root",
      title: "Square root in PSeInt: the Raiz function",
      description: "How to compute a square root in PSeInt with Raiz (or RC), with an example, its output and what happens with negative numbers.",
      note: "RC is another name for the same function: RC(81) also gives 9.",
    },
    azar: {
      slug: "azar-random",
      name: "Azar",
      h1: "PSeInt Azar: random numbers",
      title: "PSeInt Azar: random numbers and dice",
      description:
        "How to get random numbers in PSeInt with Azar, which range it returns and how to simulate a die from 1 to 6, with a working example.",
    },
    longitud: {
      slug: "longitud-string-length",
      name: "Longitud",
      h1: "PSeInt Longitud: how many characters a text has",
      title: "PSeInt Longitud: length of a string",
      description: "What Longitud does in PSeInt: it counts the characters in a text, spaces included. Example and how to use it to check passwords.",
    },
    subcadena: {
      slug: "subcadena-substring",
      name: "SubCadena",
      h1: "PSeInt SubCadena: take part of a text",
      title: "PSeInt SubCadena: substring with example",
      description: "How to use SubCadena in PSeInt to take part of a text between two positions, with an example and where counting starts.",
    },
    concatenar: {
      slug: "concatenar-concatenate",
      name: "Concatenar",
      h1: "PSeInt Concatenar: join two texts",
      title: "PSeInt Concatenar: joining strings",
      description: "How to join two texts with Concatenar in PSeInt, with an example and the catch about spaces not being added for you.",
    },
    "convertir-numero": {
      slug: "convertiranumero-to-number",
      name: "ConvertirANumero",
      h1: "PSeInt ConvertirANumero: text to number",
      title: "PSeInt ConvertirANumero: text to number",
      description: "How to turn text into a number with ConvertirANumero in PSeInt so you can do maths with it, with an example and its output.",
    },
    "convertir-texto": {
      slug: "convertiratexto-to-text",
      name: "ConvertirATexto",
      h1: "PSeInt ConvertirATexto: number to text",
      title: "PSeInt ConvertirATexto: number to text",
      description: "How to turn a number into text with ConvertirATexto in PSeInt so you can join it with other text, with an example and its output.",
    },
    pi: {
      slug: "pi-constant",
      name: "PI",
      h1: "PSeInt PI: the number π",
      title: "PSeInt PI: circle areas with example",
      description: "How to use the PI constant in PSeInt to compute the area or circumference of a circle, with a complete example and its output.",
    },
    euler: {
      slug: "euler-constant",
      name: "Euler",
      h1: "PSeInt Euler: the number e",
      title: "PSeInt Euler: the constant e",
      description: "What the Euler constant (the number e ≈ 2.718) is in PSeInt, what it's used for and an example that prints its value.",
    },
  },
};
