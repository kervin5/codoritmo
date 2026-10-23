import type { ConceptSiteCopy } from "./concepts-types";

// Concept pages of the example library (/en/examples/concept/<slug>). Keywords
// stay in PSeInt's Spanish; the text explains them in English. Every snippet
// runs in the tests (src/__tests__/site-concepts.test.tsx).
export const enConceptsSite: ConceptSiteCopy = {
  page: {
    explanation: "How it works",
    snippet: "Short example",
    snippetIntro: "The least you need to see it work. Copy it or open it in the editor.",
    output: "What it prints:",
    examples: "Solved exercises",
    examplesIntro: "Each exercise comes with the full code, its flowchart and a sample run.",
    reference: "In the language reference",
    referenceIntro: "The instructions involved, explained one by one.",
    otherConcepts: "Other concepts",
    open: "Open it in Codoritmo",
    openHint: "Opens in the browser editor, nothing to install.",
    openLabel: "Open the short {concept} example in Codoritmo",
    independent:
      "Codoritmo is an independent, open-source project inspired by PSeInt and compatible with its syntax. It is not affiliated with the PSeInt project.",
    officialSite: "Official PSeInt website",
  },
  concepts: {
    io: {
      slug: "input-and-output",
      h1: "Input and output in PSeInt: Leer and Escribir exercises",
      title: "PSeInt Leer and Escribir: solved exercises",
      description:
        "Solved input and output exercises in PSeInt: ask for data with Leer, show results with Escribir and build clear messages.",
      paragraphs: [
        "Almost every algorithm does three things: it takes data in, processes it and shows a result. In PSeInt, data comes in with Leer and results go out with Escribir.",
        "Leer pauses the program until the person types something and presses Enter; what they typed is stored in the variable. That's why you show a question with Escribir first: otherwise the console just waits without saying what it wants.",
        "Escribir takes several things separated by commas and shows them together: text in quotes, variables and even calculations. Add Sin Saltar and whatever comes next stays on the same line.",
      ],
      snippet: 'Algoritmo Greeting\n\tDefinir nombre Como Caracter\n\tEscribir "What is your name?"\n\tLeer nombre\n\tEscribir "Hi, ", nombre, ". Welcome!"\nFinAlgoritmo',
      input: "Sofia",
    },
    variables: {
      slug: "variables",
      h1: "Variables in PSeInt: examples to get started",
      title: "PSeInt variables: solved examples",
      description:
        "What a variable is in PSeInt, how to declare it with Definir, store values with <- and use it in calculations, with solved exercises.",
      paragraphs: [
        "A variable is a named place where the program keeps a value to use later: an age, a price, a name. You can change its value as often as you like; the variable always remembers the latest one.",
        "Definir says what kind of data it will hold: Entero for whole numbers, Real for numbers with decimals, Caracter for text and Logico for true or false. Depending on your school's profile, Definir may be required.",
        "To store a value you use the <- arrow, read as \"gets\". The right-hand side is worked out first, so total <- total + precio means \"add the price to total\".",
      ],
      snippet:
        'Algoritmo Variables\n\tDefinir precio, total Como Real\n\tDefinir cantidad Como Entero\n\tprecio <- 2.5\n\tcantidad <- 4\n\ttotal <- precio * cantidad\n\tEscribir "Total to pay: ", total\nFinAlgoritmo',
    },
    si: {
      slug: "if-statements-si",
      h1: "If statements in PSeInt: Si Entonces exercises",
      title: "PSeInt if statements (Si): solved exercises",
      description:
        "Solved exercises with Si Entonces and SiNo in PSeInt: compare values, combine conditions with Y / O and nest decisions.",
      paragraphs: [
        "A conditional lets the program do different things depending on the data. If the condition is true, one block runs; with SiNo (else) you say what to do when it's false. It all ends with FinSi.",
        "The condition is a comparison that answers true or false: nota >= 60, edad < 18, respuesta = \"yes\". To require two things at once use Y (and); to accept one or the other, O (or).",
        "When there are more than two cases (say, grades A, B, C or D) you put conditionals inside one another. If you always compare the same variable against fixed values, Segun is usually tidier.",
      ],
      snippet:
        'Algoritmo EvenOrOdd\n\tDefinir n Como Entero\n\tEscribir "Type a number:"\n\tLeer n\n\tSi n MOD 2 = 0 Entonces\n\t\tEscribir n, " is even"\n\tSiNo\n\t\tEscribir n, " is odd"\n\tFinSi\nFinAlgoritmo',
      input: "7",
    },
    segun: {
      slug: "switch-segun",
      h1: "Segun (switch) in PSeInt: menu and option exercises",
      title: "PSeInt Segun (switch): solved exercises",
      description:
        "Solved exercises with Segun in PSeInt: option menus, days of the week and cases with De Otro Modo, with code and flowchart.",
      paragraphs: [
        "Segun picks one path out of several based on a variable's value. It's the natural tool for a menu: the user types 1, 2 or 3 and the program does what each number stands for.",
        "Each case is written as value: with its instructions below. One case can take several values separated by commas, and De Otro Modo (otherwise) catches everything not on the list, like an invalid option.",
        "Segun always compares for equality. If you need ranges (0 to 10, 11 to 20…), use Si conditionals instead.",
      ],
      snippet:
        'Algoritmo DayOfWeek\n\tDefinir dia Como Entero\n\tEscribir "Day number (1 to 7):"\n\tLeer dia\n\tSegun dia Hacer\n\t\t1, 2, 3, 4, 5:\n\t\t\tEscribir "Weekday"\n\t\t6, 7:\n\t\t\tEscribir "Weekend"\n\t\tDe Otro Modo:\n\t\t\tEscribir "No such day"\n\tFinSegun\nFinAlgoritmo',
      input: "6",
    },
    mientras: {
      slug: "while-loops-mientras",
      h1: "PSeInt while loop (Mientras) exercises",
      title: "PSeInt Mientras (while loop): solved exercises",
      description:
        "Solved exercises with the Mientras (while) loop in PSeInt: counters, running totals, input validation and guessing games.",
      paragraphs: [
        "Mientras repeats a block of instructions while a condition is true. The condition is checked before every pass: if it's already false when the loop is reached, the block doesn't run at all.",
        "Use it when you don't know in advance how many passes there will be: keep reading numbers until someone types 0, play until the guess is right, divide a number while it's above zero.",
        "The key is that something inside the loop changes the condition. Forget to increase the counter or to read the value again and the loop never ends. A trace table shows it right away.",
      ],
      snippet:
        'Algoritmo SumUntilZero\n\tDefinir n, suma Como Entero\n\tsuma <- 0\n\tEscribir "Type numbers (0 to stop):"\n\tLeer n\n\tMientras n <> 0 Hacer\n\t\tsuma <- suma + n\n\t\tLeer n\n\tFinMientras\n\tEscribir "The sum is ", suma\nFinAlgoritmo',
      input: "4\n10\n-2\n0",
    },
    repetir: {
      slug: "repeat-loops-repetir",
      h1: "PSeInt Repetir Hasta Que (repeat-until) exercises",
      title: "PSeInt Repetir Hasta Que: solved exercises",
      description:
        "Solved exercises with Repetir Hasta Que in PSeInt: validating passwords and input, repeating menus, and how it differs from Mientras.",
      paragraphs: [
        "Repetir runs a block and only checks the condition at the end. So it always makes at least one pass, even if the condition already holds from the start.",
        "With Hasta Que (until), the loop ends when the condition becomes true. It's the natural way to validate: \"ask for the grade until it's between 0 and 100\". Mientras Que (while) is the other way round: it keeps going while the condition is true.",
        "The difference from Mientras is when the condition is checked. If the block has to run once before there's anything to ask about (like reading a value), Repetir is usually shorter.",
      ],
      snippet:
        'Algoritmo ValidateGrade\n\tDefinir nota Como Real\n\tRepetir\n\t\tEscribir "Grade (0 to 100):"\n\t\tLeer nota\n\tHasta Que nota >= 0 Y nota <= 100\n\tEscribir "Grade saved: ", nota\nFinAlgoritmo',
      input: "120\n-1\n85",
    },
    para: {
      slug: "for-loops-para",
      h1: "PSeInt for loop (Para) exercises",
      title: "PSeInt Para (for loop): solved exercises",
      description:
        "Solved exercises with the Para (for) loop in PSeInt: times tables, sums, countdowns with Con Paso and walking through arrays.",
      paragraphs: [
        "Para repeats a block a known number of times. A counter variable starts at one value, moves on every pass, and the loop ends once it goes past the final value: Para i <- 1 Hasta 10 Hacer makes ten passes.",
        "Con Paso (step) changes how much the counter moves. Con Paso 2 counts in twos, and Con Paso -1 counts backwards, which is handy for countdowns or walking an array from the end.",
        "Pick Para when you know the number of passes before you start (the 10 rows of a table, the n items of an array). If it depends on something that happens inside, use Mientras or Repetir.",
      ],
      snippet:
        'Algoritmo TimesTable\n\tDefinir n, i Como Entero\n\tEscribir "Which times table?"\n\tLeer n\n\tPara i <- 1 Hasta 5 Hacer\n\t\tEscribir n, " x ", i, " = ", n * i\n\tFinPara\nFinAlgoritmo',
      input: "7",
    },
    paraCada: {
      slug: "for-each-para-cada",
      h1: "PSeInt Para Cada (for each): walk an array without indexes",
      title: "PSeInt Para Cada (for each): examples",
      description:
        "How to walk through an array with Para Cada in PSeInt without handling positions, with solved examples and when a plain Para fits better.",
      paragraphs: [
        "Para Cada walks an array from start to end. On every pass, the variable you choose takes the value of the next slot, so you need no counter and don't have to know how many slots there are.",
        "It's ideal for adding up, printing or searching every element. If you need to know your position (to print \"Student 3\", say) or to walk only part of the array, use an indexed Para.",
        "Some profiles don't allow Para Cada; there, the same walk is written as Para i <- 1 Hasta n Hacer.",
      ],
      snippet:
        'Algoritmo AddPrices\n\tDefinir total Como Real\n\tDimension precios[4]\n\tprecios[1] <- 3.5\n\tprecios[2] <- 12\n\tprecios[3] <- 7.25\n\tprecios[4] <- 1\n\ttotal <- 0\n\tPara Cada precio De precios Hacer\n\t\ttotal <- total + precio\n\tFinPara\n\tEscribir "Total: ", total\nFinAlgoritmo',
    },
    arreglos: {
      slug: "arrays",
      h1: "Arrays in PSeInt: solved examples",
      title: "PSeInt arrays: solved examples",
      description:
        "Solved array examples in PSeInt: create one with Dimension, fill it, walk it with Para, find the largest value and work out an average.",
      paragraphs: [
        "An array keeps many values of the same kind under one name, in numbered slots. Instead of nota1, nota2, nota3… you have notas[1], notas[2], notas[3], and you can walk through them with a loop.",
        "You create it with Dimension, saying how many slots it has: Dimension notas[30]. In the default profile the first slot is 1; some profiles start at 0, so check the one your course uses.",
        "The most common pattern is to fill the array with a Para and Leer, then walk it again to compute something: the sum, the average, the largest value, how many passed. Going past its size (notas[31] in an array of 30) is an error.",
      ],
      snippet:
        'Algoritmo HighestGrade\n\tDefinir i, alta Como Entero\n\tDimension notas[5]\n\tPara i <- 1 Hasta 5 Hacer\n\t\tEscribir "Grade ", i, ":"\n\t\tLeer notas[i]\n\tFinPara\n\talta <- notas[1]\n\tPara i <- 2 Hasta 5 Hacer\n\t\tSi notas[i] > alta Entonces\n\t\t\talta <- notas[i]\n\t\tFinSi\n\tFinPara\n\tEscribir "The highest grade is ", alta\nFinAlgoritmo',
      input: "74\n59\n98\n61\n86",
    },
    matrices: {
      slug: "matrices-2d-arrays",
      h1: "Matrices in PSeInt: two-dimensional arrays",
      title: "PSeInt matrices (2D arrays): solved examples",
      description:
        "Solved matrix examples in PSeInt: create a table with Dimension m[rows, columns], walk it with two Para loops and add up rows.",
      paragraphs: [
        "A matrix is a two-dimensional array: a table with rows and columns. You create it with Dimension ventas[3, 5] (3 rows, 5 columns) and name each cell with two indexes, ventas[row, column].",
        "To walk it you use two Para loops, one inside the other: the outer one moves through the rows and the inner one through that row's columns. That's how you fill it, print it as a table or add it up by row and by column.",
        "Matrices are used for game boards, several students' grades in several subjects, or sales per day and per branch.",
      ],
      snippet:
        'Algoritmo SumTable\n\tDefinir f, c Como Entero\n\tDimension tabla[3, 4]\n\tPara f <- 1 Hasta 3 Hacer\n\t\tPara c <- 1 Hasta 4 Hacer\n\t\t\ttabla[f, c] <- f + c\n\t\t\tEscribir Sin Saltar tabla[f, c], " "\n\t\tFinPara\n\t\tEscribir ""\n\tFinPara\nFinAlgoritmo',
    },
    redimensionar: {
      slug: "resizing-arrays-redimensionar",
      h1: "PSeInt Redimensionar: arrays that grow",
      title: "Resizing arrays in PSeInt with Redimensionar",
      description:
        "How to grow an array with Redimensionar in PSeInt without losing the values it already held, with solved list examples.",
      paragraphs: [
        "An array created with Dimension has a fixed size. Redimensionar changes that size while the program runs and keeps whatever was already stored in its slots.",
        "It helps when you don't know how many values will come: a shopping list that grows with every item, or the numbers someone types until they enter 0. Each time a new value arrives, you grow the array by one slot and store it at the end.",
        "Not every profile allows resizing. If yours doesn't, the classic alternative is to create a large array up front and keep the number of used slots in a variable.",
      ],
      snippet:
        'Algoritmo GrowingList\n\tDefinir n, i Como Entero\n\tDefinir dato Como Caracter\n\tn <- 0\n\tDimension lista[1]\n\tLeer dato\n\tMientras dato <> "end" Hacer\n\t\tn <- n + 1\n\t\tRedimensionar lista[n]\n\t\tlista[n] <- dato\n\t\tLeer dato\n\tFinMientras\n\tPara i <- 1 Hasta n Hacer\n\t\tEscribir i, ". ", lista[i]\n\tFinPara\nFinAlgoritmo',
      input: "bread\nmilk\nend",
    },
    texto: {
      slug: "strings",
      h1: "Strings in PSeInt: solved text exercises",
      title: "PSeInt strings: solved text exercises",
      description:
        "Solved text exercises in PSeInt: Longitud, SubCadena, Concatenar, Mayusculas, reversing words and counting vowels.",
      paragraphs: [
        "A string is a sequence of characters: letters, digits, spaces and symbols. In PSeInt it's stored in a Caracter variable and written in quotes.",
        "The string functions do the heavy lifting: Longitud counts characters, SubCadena takes a piece, Concatenar joins two texts, Mayusculas and Minusculas change the case, and ConvertirANumero and ConvertirATexto go from text to number and back.",
        "To look at a text letter by letter, combine a Para with SubCadena(texto, i, i). That's how you count vowels, reverse a word or check for a palindrome.",
      ],
      snippet:
        'Algoritmo ReverseWord\n\tDefinir palabra, invertida Como Caracter\n\tDefinir i Como Entero\n\tEscribir "Type a word:"\n\tLeer palabra\n\tinvertida <- ""\n\tPara i <- Longitud(palabra) Hasta 1 Con Paso -1 Hacer\n\t\tinvertida <- invertida + SubCadena(palabra, i, i)\n\tFinPara\n\tEscribir "Reversed: ", invertida\nFinAlgoritmo',
      input: "code",
    },
    logicos: {
      slug: "logical-operators",
      h1: "Logical operators Y, O, NO in PSeInt: examples",
      title: "PSeInt logical operators: Y, O, NO",
      description:
        "Solved examples with PSeInt's logical operators Y (and), O (or) and NO (not): combining conditions, value ranges and logical variables.",
      paragraphs: [
        "Logical operators combine conditions. Y (and) is true only if both conditions are; O (or) if at least one is; NO (not) flips the result. They can also be written as &&, || and ~.",
        "Y checks ranges: edad >= 13 Y edad <= 19. O accepts several answers: letra = \"y\" O letra = \"Y\". Use parentheses to make clear what is evaluated first.",
        "A Logico variable holds true or false directly, like encontrado (found) or terminado (done). Mientras NO encontrado Hacer then reads almost like a sentence.",
      ],
      snippet:
        'Algoritmo CanEnter\n\tDefinir edad Como Entero\n\tDefinir conAdulto Como Logico\n\tedad <- 15\n\tconAdulto <- Verdadero\n\tSi edad >= 18 O conAdulto Entonces\n\t\tEscribir "Can come in"\n\tSiNo\n\t\tEscribir "Cannot come in"\n\tFinSi\nFinAlgoritmo',
    },
    subprocesos: {
      slug: "subprocesses-subproceso",
      h1: "PSeInt SubProceso: examples of splitting a program",
      title: "PSeInt SubProcesos: solved examples",
      description:
        "Solved examples with SubProcesos in PSeInt: split a program into parts, pass parameters and reuse code instead of repeating it.",
      paragraphs: [
        "A SubProceso groups instructions under a name so you can use them whenever you need. Instead of one long algorithm you get short pieces whose names say what they do: MostrarMenu, DibujarTablero, Intercambiar.",
        "It's written outside the main Algoritmo, between SubProceso and FinSubProceso, and called by writing its name with parentheses. Parameters are the values it receives to work with.",
        "By default parameters are passed by value (the SubProceso gets a copy). If you want it to change the original variable, as when swapping two numbers, declare the parameter Por Referencia.",
      ],
      snippet:
        'SubProceso Linea(n)\n\tDefinir i Como Entero\n\tPara i <- 1 Hasta n Hacer\n\t\tEscribir Sin Saltar "-"\n\tFinPara\n\tEscribir ""\nFinSubProceso\n\nAlgoritmo Title\n\tLinea(20)\n\tEscribir "  My first program"\n\tLinea(20)\nFinAlgoritmo',
    },
    funciones: {
      slug: "functions",
      h1: "Functions in PSeInt: examples that return a value",
      title: "PSeInt functions: solved examples",
      description:
        "Solved function examples in PSeInt: compute and return a value, use it in expressions, and write functions like Factorial or EsPrimo.",
      paragraphs: [
        "A function is a SubProceso that computes something and returns the result, so you can use it inside an expression just like Raiz or Abs: Escribir Promedio(a, b) or Si EsPrimo(n) Entonces.",
        "In PSeInt a function is declared with the variable it will return: Funcion r <- Doble(n). Whatever r holds when FinFuncion is reached is the result. Codoritmo also accepts Retornar to return a value at any point.",
        "Functions make a program easier to read and to test in parts: you can check that EsPrimo works on a few numbers before using it in a bigger problem.",
      ],
      snippet:
        'Funcion r <- Promedio(a, b)\n\tr <- (a + b) / 2\nFinFuncion\n\nAlgoritmo UseFunction\n\tEscribir "Average of 14 and 17: ", Promedio(14, 17)\nFinAlgoritmo',
    },
    referencia: {
      slug: "pass-by-reference",
      h1: "PSeInt Por Referencia vs Por Valor (pass by reference)",
      title: "PSeInt pass by reference vs by value",
      description:
        "The difference between passing parameters Por Valor and Por Referencia in PSeInt, with a variable swap example you can run.",
      paragraphs: [
        "When you call a SubProceso, each parameter arrives Por Valor (by value) or Por Referencia (by reference). By value gets a copy: whatever the SubProceso does to it doesn't change the original variable. That's what happens if you don't say anything.",
        "By reference gets the variable itself: if the SubProceso changes it, the change shows outside. That's what you need to swap two values, sort, or give back more than one result.",
        "Arrays are passed by reference even if you don't write it, which is why a SubProceso can sort an array in place.",
      ],
      snippet:
        'SubProceso Intercambiar(a Por Referencia, b Por Referencia)\n\tDefinir aux Como Entero\n\taux <- a\n\ta <- b\n\tb <- aux\nFinSubProceso\n\nAlgoritmo ReferenceTest\n\tDefinir p, q Como Entero\n\tp <- 1\n\tq <- 2\n\tIntercambiar(p, q)\n\tEscribir "p = ", p, ", q = ", q\nFinAlgoritmo',
    },
    recursion: {
      slug: "recursion",
      h1: "Recursion in PSeInt: solved examples",
      title: "Recursion in PSeInt: solved examples",
      description:
        "Recursion examples in PSeInt: functions that call themselves, like factorial, with their base case and how to follow them step by step.",
      paragraphs: [
        "A recursive function calls itself with a smaller problem. Factorial is the classic example: 5! is 5 times 4!, and 4! is 4 times 3!, all the way down to 1.",
        "Every recursion needs a base case: the point where the function answers without calling itself again (if n is 1, the factorial is 1). Without it, the calls never end.",
        "Recursion also solves problems like the Towers of Hanoi or merge sort. Following it step by step, watching every call, is the best way to understand it.",
      ],
      snippet:
        'Funcion r <- Factorial(n)\n\tSi n <= 1 Entonces\n\t\tr <- 1\n\tSiNo\n\t\tr <- n * Factorial(n - 1)\n\tFinSi\nFinFuncion\n\nAlgoritmo FactorialTest\n\tEscribir "5! = ", Factorial(5)\nFinAlgoritmo',
    },
    azar: {
      slug: "random-numbers",
      h1: "Random numbers in PSeInt: examples with Azar",
      title: "PSeInt random numbers: Azar and Aleatorio",
      description:
        "Solved examples with random numbers in PSeInt: Azar and Aleatorio, dice, guessing games and arrays filled with test data.",
      paragraphs: [
        "Azar(n) returns a random whole number from 0 to n - 1. For a die you write Azar(6) + 1, which gives 1 to 6. Aleatorio(a, b) gives a whole number between a and b directly, both included.",
        "Random numbers make games (guess the number, rock paper scissors, rolling dice) and also test data: filling an array with random values to try out a sorting algorithm.",
        "Every run gives different results, so when checking a program it helps to print the number that came up.",
      ],
      snippet:
        'Algoritmo RollDice\n\tDefinir d1, d2 Como Entero\n\td1 <- Azar(6) + 1\n\td2 <- Aleatorio(1, 6)\n\tEscribir "Rolled ", d1, " and ", d2, ": total ", d1 + d2\nFinAlgoritmo',
    },
    matematicas: {
      slug: "math",
      h1: "Solved math exercises in PSeInt",
      title: "PSeInt math exercises: solved examples",
      description:
        "Solved math exercises in PSeInt: primes, divisors, GCD, powers, averages and rounding, using operators and built-in functions.",
      paragraphs: [
        "Many pseudocode exercises are maths problems: averages, areas, prime numbers, divisors. The operators are the usual ones (+, -, *, /, ^) plus MOD, which gives the remainder of a division.",
        "MOD solves a surprising number of problems: n MOD 2 = 0 tells whether a number is even, and n MOD d = 0 whether d divides n. Trunc(n / 10) drops the last digit of a number.",
        "For the rest there are ready-made functions: Raiz, Abs, Redon, Trunc, and constants like PI. Combined with a loop, they're enough to find primes, compute the greatest common divisor or add up a number's digits.",
      ],
      snippet:
        'Algoritmo Divisors\n\tDefinir n, d Como Entero\n\tEscribir "Type a number:"\n\tLeer n\n\tEscribir Sin Saltar "Divisors of ", n, ": "\n\tPara d <- 1 Hasta n Hacer\n\t\tSi n MOD d = 0 Entonces\n\t\t\tEscribir Sin Saltar d, " "\n\t\tFinSi\n\tFinPara\n\tEscribir ""\nFinAlgoritmo',
      input: "12",
    },
    pantalla: {
      slug: "clear-screen-and-wait",
      h1: "PSeInt Limpiar Pantalla and Esperar: examples",
      title: "PSeInt Limpiar Pantalla and Esperar",
      description:
        "How to use Limpiar Pantalla, Esperar and Esperar Tecla in PSeInt for menus, simple animations and countdowns, with examples.",
      paragraphs: [
        "Limpiar Pantalla (or Borrar Pantalla) empties the console, like starting on a fresh page. Menus and games use it so each screen doesn't mix with the previous one.",
        "Esperar pauses before continuing: Esperar 1 Segundo or Esperar 500 Milisegundos. Esperar Tecla stops the program until the person presses a key, so they can read at their own pace.",
        "Together they make simple animations: show something, wait, clear, show the next thing. A countdown is the simplest example.",
      ],
      snippet:
        'Algoritmo Countdown\n\tDefinir i Como Entero\n\tPara i <- 3 Hasta 1 Con Paso -1 Hacer\n\t\tLimpiar Pantalla\n\t\tEscribir i, "..."\n\t\tEsperar 1 Segundo\n\tFinPara\n\tEscribir "Liftoff!"\nFinAlgoritmo',
    },
    coloquial: {
      slug: "colloquial-conditions",
      h1: "Colloquial conditions in PSeInt: Es Par, Es Multiplo De…",
      title: "PSeInt colloquial conditions: Es Par and more",
      description:
        "How to write conditions in plain Spanish words in PSeInt: Es Par, Es Impar, Es Multiplo De, Es Mayor Que, Es Positivo, with examples.",
      paragraphs: [
        "PSeInt lets you write some conditions almost the way you'd say them in Spanish: n Es Par (is even), n Es Impar (is odd), n Es Positivo, anio Es Multiplo De 4, a Es Mayor Que b, x Es Igual A 0. They can be negated too: n No Es Par.",
        "Each one is the same as an ordinary comparison: n Es Par is n MOD 2 = 0, and a Es Mayor Que b is a > b. They let you read the code out loud and get it the first time.",
        "These phrases depend on the profile: some courses turn them off so you practise with the operators. If your profile doesn't accept them, write the equivalent comparison.",
      ],
      snippet:
        'Algoritmo Colloquial\n\tDefinir n Como Entero\n\tEscribir "Type a number:"\n\tLeer n\n\tSi n Es Par Entonces\n\t\tEscribir n, " is even"\n\tFinSi\n\tSi n Es Multiplo De 5 Entonces\n\t\tEscribir n, " is a multiple of 5"\n\tFinSi\n\tSi n Es Mayor Que 100 Entonces\n\t\tEscribir n, " is greater than 100"\n\tFinSi\nFinAlgoritmo',
      input: "40",
    },
  },
};
