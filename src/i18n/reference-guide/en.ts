import type { ReferenceGuide } from "./types";

// Explanations for someone who has never programmed: what it does, what it's
// for, a real example with its result, and the most common mistake.
// {and} {or} {not} {mod} are replaced by the active profile's operators.
// Results are checked against the engine (src/__tests__/reference-guide.test.ts).
export const enReferenceGuide: ReferenceGuide = {
  definir: {
    body: "Tells the program which variables you'll use and what kind of data each one holds. A variable is like a labelled box: Entero holds whole numbers, Real numbers with decimals, Caracter text, and Logico true or false.",
    example: "Definir edad Como Entero\nDefinir nombre Como Caracter",
    outcome: "Creates the boxes edad and nombre, empty until you store something in them.",
    tip: "Definir doesn't give the variable a value; use <- or Leer for that.",
  },
  dimension: {
    body: "Creates an array: a row of numbered boxes sharing one name. Use it when you need to keep many values of the same kind, like a class's grades, without inventing a variable for each.",
    example: "Dimension notas[5]\nnotas[1] <- 18",
    outcome: "Creates 5 slots (notas[1] to notas[5]) and stores 18 in the first.",
    tip: "Depending on the profile, slots start at 1 or at 0.",
  },
  escribir: {
    body: "Shows a message or a value in the console; it's how your program talks to whoever uses it. Mix text in quotes and variables by separating them with commas.",
    example: 'nombre <- "Ana"\nEscribir "Hola, ", nombre',
    outcome: "Shows: Hola, Ana",
    tip: "Text goes inside quotes; variables go without them.",
  },
  "escribir-linea": {
    body: "Shows one or more values in the console and moves to the next line, like pressing Enter while typing.",
    example: 'Escribir "Total: ", 3 + 4',
    outcome: "Shows: Total: 7",
  },
  "escribir-sin-bajar": {
    body: "Like Escribir, but stays on the same line. Handy so the user's answer appears right next to the question.",
    example: 'Escribir "Hola " Sin Saltar\nEscribir "mundo"',
    outcome: "Shows on a single line: Hola mundo",
  },
  leer: {
    body: "Pauses the program and waits for the person to type something; whatever they type is stored in the variable. This lets your program work with different data each time.",
    example: 'Escribir "How old are you?"\nLeer edad',
    outcome: "If you type 15, the variable edad becomes 15.",
    tip: "Use Escribir first to say what you expect; otherwise the person won't know what to type.",
  },
  asignar: {
    body: "Stores a value in a variable. Read the arrow <- as \"gets\": the right side is worked out first and the result goes into the box on the left, replacing whatever was there.",
    example: "puntos <- 10\npuntos <- puntos + 5",
    outcome: "puntos ends up as 15.",
    tip: "It isn't a maths equation: puntos <- puntos + 5 means \"add 5 to puntos\".",
  },
  si: {
    body: "Makes the program take a decision: if the condition is true, it runs the instructions inside; if it's false, it skips them. In the flowchart it's a diamond with two exits.",
    example: 'Si edad >= 18 Entonces\n\tEscribir "You can vote"\nFinSi',
    outcome: "With edad 20 it shows \"You can vote\"; with 15 it shows nothing.",
  },
  "si-sino": {
    body: "A decision with two paths: one for when the condition is true and another (SiNo) for when it's false. Exactly one of the two always runs.",
    example: 'Si nota >= 60 Entonces\n\tEscribir "Pass"\nSiNo\n\tEscribir "Fail"\nFinSi',
    outcome: "With nota 75 it shows \"Pass\"; with 40, \"Fail\".",
  },
  segun: {
    body: "Picks one path out of many depending on a variable's value, like a menu. Tidier than chaining many Si blocks when you compare the same variable with several values.",
    example: 'Segun opcion Hacer\n\t1: Escribir "Play"\n\t2: Escribir "Quit"\n\tDe Otro Modo: Escribir "Not an option"\nFinSegun',
    outcome: "With opcion 2 it shows \"Quit\".",
    tip: "De Otro Modo catches any value that isn't listed.",
  },
  mientras: {
    body: "Repeats a group of instructions while the condition stays true. It checks the condition before every round, so if it's already false at the start, nothing repeats.",
    example: "contador <- 1\nMientras contador <= 3 Hacer\n\tEscribir contador\n\tcontador <- contador + 1\nFinMientras",
    outcome: "Shows 1, 2 and 3, one per line.",
    tip: "Something inside must change the condition, or the loop never ends.",
  },
  repetir: {
    body: "Repeats a group of instructions and checks the condition at the end of each round, so it always runs at least once. Ideal for asking until the answer is valid.",
    example: 'Repetir\n\tEscribir "Type a positive number"\n\tLeer n\nHasta Que n > 0',
    outcome: "Keeps asking while you type 0 or negatives.",
  },
  "repetir-hasta": {
    body: "Repeats and stops when the condition becomes true. It runs at least once because the condition is checked at the end.",
    example: 'Repetir\n\tLeer clave\nHasta Que clave = "1234"',
    outcome: "Keeps asking for the code until you type 1234.",
  },
  "repetir-mientras": {
    body: "Repeats and keeps going while the condition is true; it stops when it turns false. The opposite of Hasta Que.",
    example: "Repetir\n\tLeer n\nMientras Que n < 0",
    outcome: "Keeps asking while the number is negative.",
  },
  para: {
    body: "Repeats a known number of times. A counter starts at one value, goes up by one (or by whatever you set with Con Paso), and the loop ends once it passes the final value.",
    example: "Para i <- 1 Hasta 5 Hacer\n\tEscribir i * 2\nFinPara",
    outcome: "Shows 2, 4, 6, 8 and 10.",
    tip: "Use Para when you know how many rounds; Mientras when it depends on something that happens inside.",
  },
  "para-cada": {
    body: "Walks through an array from start to end; on each round the variable takes the next slot's value, so you don't have to handle positions.",
    example: "Para Cada nota De notas Hacer\n\tEscribir nota\nFinPara",
    outcome: "Shows every grade in the array, in order.",
  },
  limpiar: {
    body: "Clears everything in the console so you can start from a clean screen. Useful in menus and games.",
    example: 'Limpiar Pantalla\nEscribir "Level 2"',
    outcome: "The console empties, then shows \"Level 2\".",
  },
  esperar: {
    body: "Pauses before moving on to the next instruction. Gives time to read a message, or makes simple animations.",
    example: 'Escribir "3..."\nEsperar 1 Segundo\nEscribir "2..."',
    outcome: "Shows \"3...\", waits a second, then \"2...\".",
  },
  "esperar-tecla": {
    body: "Stops the program until the person presses a key. Useful for moving between screens at their own pace.",
    example: 'Escribir "Press a key to continue"\nEsperar Tecla',
    outcome: "The program waits until you press a key.",
  },
  rutina: {
    body: "Groups instructions under a name so you can use them whenever you want, like a recipe. It splits a long program into parts that make sense on their own and avoids repeating code.",
    example: 'SubProceso Saludar(nombre)\n\tEscribir "Hola, ", nombre\nFinSubProceso',
    outcome: "Then Saludar(\"Ana\") shows \"Hola, Ana\".",
  },
  subproceso: {
    body: "Groups instructions under a name so you can use them whenever you want, like a recipe. It can receive data (parameters) to work with.",
    example: 'SubProceso Saludar(nombre)\n\tEscribir "Hola, ", nombre\nFinSubProceso',
    outcome: "Then Saludar(\"Ana\") shows \"Hola, Ana\".",
    tip: "A Por Referencia parameter lets the subprocess change the original variable.",
  },
  subalgoritmo: {
    body: "Another name for SubProceso: groups instructions under a name to reuse them. It works exactly the same.",
    example: "SubAlgoritmo Linea()\n\tEscribir \"----------\"\nFinSubAlgoritmo",
    outcome: "Every call to Linea() draws a line.",
  },
  funcion: {
    body: "A routine that works something out and gives back the result, so you can use it inside an expression just like Raiz or Abs. The variable before <- is the one returned.",
    example: "Funcion r <- Doble(n)\n\tr <- n * 2\nFinFuncion",
    outcome: "Then Escribir Doble(21) shows 42.",
  },
  retornar: {
    body: "Ends the function right there and hands the given value back to whoever called it.",
    example: "Funcion r <- Maximo(a, b)\n\tSi a > b Entonces\n\t\tRetornar a\n\tFinSi\n\tRetornar b\nFinFuncion",
    outcome: "Maximo(3, 9) gives back 9.",
  },
  plus: {
    body: "Adds two numbers. With text, depending on the profile, it also joins them one after the other.",
    example: "Escribir 7 + 5",
    outcome: "Shows: 12",
  },
  minus: {
    body: "Subtracts the right number from the left. Written before a number, it makes it negative.",
    example: "Escribir 10 - 3 - 2",
    outcome: "Shows: 5 (worked left to right: 10 - 3 = 7, 7 - 2 = 5)",
  },
  multiply: {
    body: "Multiplies two numbers. It's worked out before addition and subtraction, just like in maths.",
    example: "Escribir 2 + 3 * 4",
    outcome: "Shows: 14 (first 3 * 4 = 12, then 2 + 12)",
    tip: "Use parentheses to change the order: (2 + 3) * 4 gives 20.",
  },
  divide: {
    body: "Divides the left number by the right one. The result can have decimals.",
    example: "Escribir 7 / 2",
    outcome: "Shows: 3.5",
    tip: "To keep only the whole part use Trunc(7 / 2), which gives 3. Dividing by 0 is an error.",
  },
  power: {
    body: "Raises a number to a power: multiplies it by itself as many times as the exponent says.",
    example: "Escribir 2 ^ 10",
    outcome: "Shows: 1024 (2 multiplied by itself 10 times)",
  },
  mod: {
    body: "Gives the remainder (what's left over) of a whole-number division. Very handy to check whether a number is even (n {mod} 2 = 0) or a multiple of another.",
    example: "Escribir 17 {mod} 5",
    outcome: "Shows: 2 (5 goes into 17 three times with 2 left over)",
  },
  and: {
    body: "Joins two conditions and is true only when both are. Think \"I need this and also that\".",
    example: "Escribir (5 > 3) {and} (2 > 8)",
    outcome: "Shows: FALSO (the first is true, but the second isn't)",
    tip: "Real use: edad >= 13 {and} edad <= 19 is true only for teenagers.",
  },
  or: {
    body: "Joins two conditions and is true when at least one is. Think \"this or that will do\".",
    example: "Escribir (5 > 3) {or} (2 > 8)",
    outcome: "Shows: VERDADERO (the first one being true is enough)",
  },
  not: {
    body: "Flips a condition: true becomes false and false becomes true.",
    example: "Escribir {not} (5 > 3)",
    outcome: "Shows: FALSO (5 > 3 is true and {not} flips it)",
  },
  eq: {
    body: "Asks whether two values are equal and answers true or false. Used in conditions, as in Si or Mientras.",
    example: 'Escribir "Ana" = "ana"',
    outcome: "Shows: FALSO (upper and lower case count as different)",
    tip: "= compares; to store a value in a variable use <-.",
  },
  neq: {
    body: "Asks whether two values are different. True when they aren't equal. Can also be written <>.",
    example: "Escribir 3 <> 4",
    outcome: "Shows: VERDADERO",
  },
  lt: {
    body: "Asks whether the left value is less than the right one. The open side of the sign faces the bigger number.",
    example: "Escribir 3 < 8",
    outcome: "Shows: VERDADERO",
  },
  leq: {
    body: "Asks whether the left value is less than or equal to the right one. Being equal counts.",
    example: "Escribir 5 <= 5",
    outcome: "Shows: VERDADERO (they're equal, and that counts)",
  },
  gt: {
    body: "Asks whether the left value is greater than the right one.",
    example: "Escribir 8 > 3",
    outcome: "Shows: VERDADERO",
  },
  geq: {
    body: "Asks whether the left value is greater than or equal to the right one. Being equal counts.",
    example: "Escribir 18 >= 18",
    outcome: "Shows: VERDADERO (18 meets \"18 or more\")",
  },
  abs: {
    body: "Gives the absolute value: the number without its sign, that is, how far it is from zero. Handy for differences regardless of which is bigger.",
    example: "Escribir Abs(-8)",
    outcome: "Shows: 8",
  },
  trunc: {
    body: "Cuts off the decimal part and keeps the whole part, without rounding.",
    example: "Escribir Trunc(7.9)",
    outcome: "Shows: 7 (it doesn't round up to 8)",
  },
  redon: {
    body: "Rounds to the nearest whole number. Exactly halfway (.5) rounds up.",
    example: "Escribir Redon(2.5), \" \", Redon(2.4)",
    outcome: "Shows: 3 2",
  },
  raiz: {
    body: "Works out the square root: the number that, multiplied by itself, gives the value.",
    example: "Escribir Raiz(81)",
    outcome: "Shows: 9 (because 9 * 9 = 81)",
    tip: "The value can't be negative.",
  },
  azar: {
    body: "Gives a random whole number from 0 up to the given number minus one. It can change every run, like rolling a die.",
    example: "dado <- Azar(6) + 1",
    outcome: "dado is a number from 1 to 6.",
    tip: "Azar(6) gives 0 to 5; that's why you add 1 to simulate a die.",
  },
  pi: {
    body: "The number π (pi), about 3.1416: how many times a circle's diameter fits around its edge.",
    example: "area <- PI * radio ^ 2",
    outcome: "With radio 2, area is 12.5663706144.",
  },
  euler: {
    body: "The number e, about 2.7183, the base of continuous growth (compound interest, populations).",
    example: "Escribir Euler",
    outcome: "Shows: 2.7182818285",
  },
  longitud: {
    body: "Counts how many characters a piece of text has, spaces included.",
    example: 'Escribir Longitud("hola")',
    outcome: "Shows: 4",
  },
  subcadena: {
    body: "Takes a piece out of a text, from one position to another (both included).",
    example: 'Escribir SubCadena("pseudocodigo", 1, 6)',
    outcome: "Shows: pseudo",
    tip: "Depending on the profile, the first letter is at position 1 or 0.",
  },
  concatenar: {
    body: "Joins two pieces of text into one, one after the other.",
    example: 'Escribir Concatenar("Hola, ", "Ana")',
    outcome: "Shows: Hola, Ana",
    tip: "Spaces aren't added for you: put them inside the quotes.",
  },
  "convertir-numero": {
    body: "Turns text that contains a number into a real number so you can do maths with it.",
    example: 'Escribir ConvertirANumero("42") + 1',
    outcome: "Shows: 43",
  },
  "convertir-texto": {
    body: "Turns a number into text so you can join it with other text.",
    example: 'Escribir ConvertirATexto(42) + "!"',
    outcome: "Shows: 42!",
  },
};
