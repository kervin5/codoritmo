import type { ExampleCopy } from "./types";

// Copy for the example library, keyed by id (see src/engine/examples.ts).
export const enExamples: Record<string, ExampleCopy> = {
  /* ---------------- First steps ---------------- */
  "hello-world": {
    label: "Hello World",
    description: "Your first algorithm: print a couple of messages on screen.",
    learn:
      "Every program lives between Algoritmo and FinAlgoritmo. Escribir prints text, and each Escribir ends with a new line.",
    challenge: "Add a third line with your name and your favorite food.",
    hint: "Copy one of the Escribir lines and change the text inside the quotes.",
  },
  greeting: {
    label: "Personal Greeting",
    description: "Asks for your name and age, and answers with both.",
    learn:
      "Definir creates Caracter and Entero variables, and Leer stores what the user types. Escribir can mix text, variables and arithmetic separated by commas.",
    challenge: "Also ask for the current year and work out the year you were born.",
    hint: "Define an Entero variable for the year, read it, and subtract the age.",
  },
  temperature: {
    label: "Temperature Converter",
    description: "Converts degrees Celsius to Fahrenheit and Kelvin.",
    learn:
      "You work with Real variables and the <- assignment operator. The formulas use *, / and + just like in math class.",
    challenge: "Go the other way: ask for Fahrenheit and convert it to Celsius.",
    hint: "Reverse the formula: subtract 32, then multiply by 5 / 9.",
  },
  "tip-calculator": {
    label: "Tip Calculator",
    description: "Splits a restaurant bill, tip included.",
    learn:
      "Several Leer inputs feed a chain of calculations. Redon rounds a number, and the * 100 then / 100 trick keeps exactly two decimals.",
    challenge: "If someone types 0 people, show a warning instead of dividing.",
    hint: "Wrap the porPersona calculation in Si personas > 0 Entonces ... SiNo ... FinSi.",
  },

  /* ---------------- Decisions ---------------- */
  "can-vote": {
    label: "Can I Vote?",
    description: "Tells you whether you can vote or how many years you have left.",
    learn:
      "Your first decision with Si ... Entonces ... SiNo ... FinSi. The condition edad >= 18 picks which of the two paths runs.",
    challenge: "If the age is negative, print \"That age is not valid\".",
    hint: "Add a check for edad < 0 before the other conditions.",
  },
  bmi: {
    label: "Body Mass Index",
    description: "Computes your BMI and classifies it as underweight, normal and so on.",
    learn:
      "The ^ operator squares the height and Redon rounds the result. Nested Si blocks inside each SiNo test the ranges one after another.",
    challenge: "Besides the category, show how many kilos are missing or extra to reach the normal range.",
    hint: "The lowest healthy weight is 18.5 * altura ^ 2 and the highest is 25 * altura ^ 2.",
  },
  parking: {
    label: "Parking Fee",
    description: "Charges every started hour, with a daily maximum.",
    learn:
      "Trunc and MOD split full hours from the leftover minutes. A few Si blocks in a row apply the rate and the daily cap.",
    challenge: "Add a grace period: cars that stay 15 minutes or less park for free.",
    hint: "Check minutos <= 15 first and set the cost to 0 in that case.",
  },
  "leap-year": {
    label: "Leap Year",
    description: "Applies the calendar rules to tell whether a year is a leap year.",
    learn:
      "Es Multiplo De is a colloquial condition, a more readable way to write MOD = 0. The order of the nested Si blocks matters: 400 first, then 100, then 4.",
    challenge: "Ask for a start and an end year, and list every leap year in between.",
    hint: "Wrap the decision in a Para loop that walks through the years in the range.",
  },
  "coffee-menu": {
    label: "Coffee Shop Menu",
    description: "Pick a drink from the menu and get the total to pay.",
    learn:
      "Segun ... Hacer picks a case based on the option, and De Otro Modo catches anything that isn't on the menu. Then a Si decides whether to continue the order.",
    challenge: "Add a fourth drink to the menu, for example a $32 juice.",
    hint: "Print the new menu line and add a 4: case inside the Segun.",
  },

  /* ---------------- Loops ---------------- */
  "times-table": {
    label: "Times Table",
    description: "Prints the multiplication table for the number you choose.",
    learn:
      "The Para ... Hasta ... Hacer loop repeats a block a fixed number of times. The variable i moves from 1 to 10 on its own, one step per pass.",
    challenge: "Also ask how far the table should go instead of always stopping at 10.",
    hint: "Read another variable and use it in place of the 10 in the Para.",
  },
  "guess-number": {
    label: "Guess the Number",
    description: "Guess a secret number from 1 to 100 in seven tries.",
    learn:
      "Aleatorio picks the secret number and Mientras keeps going while two conditions joined with Y and NO hold. Abs measures how close you are, and Escribir Sin Saltar stays on the same line.",
    challenge: "At the end, show a special message if you won in three tries or fewer.",
    hint: "Inside the Si acerto branch, add another Si that checks intentos <= 3.",
  },
  password: {
    label: "Password Check",
    description: "Keeps asking for a password until it has at least 8 characters.",
    learn:
      "Repetir ... Hasta Que runs the block at least once and asks again until the condition is met. Longitud counts the characters in a text.",
    challenge: "Also reject the password \"12345678\".",
    hint: "Join both conditions in the Hasta Que with Y.",
  },
  countdown: {
    label: "Countdown",
    description: "A rocket launch countdown that ticks second by second.",
    learn:
      "A Para loop with Con Paso -1 counts backwards. Esperar Tecla, Esperar 1 Segundo and Limpiar Pantalla control the pace and what stays on screen.",
    challenge: "Ask which number the countdown should start from.",
    hint: "Read a number and use it as the starting value of the Para instead of 5.",
  },
  "sum-until-zero": {
    label: "Sum Until Zero",
    description: "Adds up the numbers you type until you enter a 0.",
    learn:
      "A Mientras loop stops on a sentinel value, here the 0. An accumulator (suma) and a counter (cantidad) give you the average.",
    challenge: "Also show the largest number that was typed.",
    hint: "Store the first number in a mayor variable and update it with a Si inside the loop.",
  },
  shapes: {
    label: "Drawing Shapes",
    description: "Draws a square and a triangle with asterisks.",
    learn:
      "Two nested Para loops walk through rows and columns. Escribir Sin Saltar keeps the asterisks on one line, and Escribir \"\" moves to the next one.",
    challenge: "Draw an upside-down triangle: n asterisks on the first row and one on the last.",
    hint: "Make the outer Para count backwards with Con Paso -1.",
  },

  /* ---------------- Arrays ---------------- */
  "array-average": {
    label: "Grade Average",
    description: "Stores five grades in an array and finds the average and the highest.",
    learn:
      "Dimension creates an array with 5 slots, and the Para loop fills it with Leer notas[i]. The same loop adds up the total and tracks the maximum with a Si.",
    challenge: "Also show the lowest grade.",
    hint: "Create a minimo variable that starts high, for example 10, and compare it with every grade.",
  },
  "linear-search": {
    label: "Linear Search",
    description: "Finds a name in a list, ignoring upper and lower case.",
    learn:
      "A Mientras loop walks the array and stops as soon as it finds the name. Mayusculas converts both texts so they compare equal however they were typed.",
    challenge: "If the name isn't there, offer to add it to the end of the list.",
    hint: "You'll need a bigger array from Dimension and a variable counting how many names are stored.",
  },
  inventory: {
    label: "Store Inventory",
    description: "Records the stock of each product and flags what to restock.",
    learn:
      "Two parallel arrays work together: productos[i] and stock[i] describe the same product. A counter (aReponer) tells you whether anything ran low.",
    challenge: "At the end, show the total number of units in the store.",
    hint: "Add stock[i] to an accumulator inside one of the Para loops.",
  },
  "sales-matrix": {
    label: "Weekly Sales",
    description: "A table of sales by branch and day, with totals.",
    learn:
      "Dimension ventas[3, 5] creates a matrix of rows and columns. Walking it with Para loops in one order gives totals per branch; in the other order, totals per day.",
    challenge: "Show which branch sold the most during the week.",
    hint: "When you compute totalSucursal, compare it with the best so far and remember its number.",
  },
  "shopping-list": {
    label: "Shopping List",
    description: "Adds items to a list that grows until you type FIN.",
    learn:
      "Redimensionar makes the array bigger without losing what it already holds. Para Cada visits every element without managing indexes yourself.",
    challenge: "Don't let the same item be added twice.",
    hint: "Before saving, loop through the list with Para and compare using Mayusculas.",
  },

  /* ---------------- Sorting & searching ---------------- */
  "bubble-sort": {
    label: "Bubble Sort",
    description: "Sorts random numbers by swapping neighbors, and stops as soon as they're in order.",
    learn:
      "Each pass compares neighbors and swaps them when they're out of order, so the largest one \"bubbles up\" to the end. If a pass makes no swaps, everything is already sorted and the Mientras loop ends early. That's why it costs O(n) when the data comes sorted and O(n²) on average and in the worst case.",
    challenge: "Sort the numbers from largest to smallest.",
    hint: "Changing the comparison operator inside the Si is enough.",
  },
  "selection-sort": {
    label: "Selection Sort",
    description: "Finds the smallest of the remaining numbers and puts it in its place.",
    learn:
      "On round i it looks for the smallest value between positions i and n and moves it to position i with a single swap. It always scans everything that's left, so it makes about n²/2 comparisons even if the data is already sorted: O(n²) in every case, but at most n - 1 swaps.",
    challenge: "Also count the comparisons and check them against n * (n - 1) / 2.",
    hint: "Add 1 to a counter right before the Si that compares datos[j] with datos[minimo].",
  },
  "insertion-sort": {
    label: "Insertion Sort",
    description: "Inserts each number among the sorted ones, like arranging cards in your hand.",
    learn:
      "The left part of the array is always sorted. Each new number is kept in actual, the larger ones shift one place to the right, and actual drops into the gap. With nearly sorted data it barely shifts anything (O(n)); on average and in the worst case it's O(n²).",
    challenge: "Generate data that's already sorted (for example datos[i] <- i) and see how many shifts it makes.",
    hint: "Replace Aleatorio(1, 99) with i in the first Para; the shift counter should end at 0.",
  },
  "shell-sort": {
    label: "Shell Sort",
    description: "Insertion sort between far-apart elements, with a gap that shrinks every pass.",
    learn:
      "It first insertion-sorts the elements that are a big gap apart, so numbers that are way out of place travel far in one move. Then it halves the gap until it reaches 1, which is an ordinary insertion sort on nearly sorted data. With these gaps it usually runs close to O(n√n), and the worst case is O(n²).",
    challenge: "Try dividing the gap by 3 instead of 2 and compare how many passes it makes.",
    hint: "Change the two Trunc(... / 2) lines, and make sure the last pass still uses a gap of 1.",
  },
  "merge-sort": {
    label: "Merge Sort",
    description: "Splits the array in halves, sorts each one recursively and merges them.",
    learn:
      "OrdenarPorMezcla calls itself on each half until the pieces have one element, and Mezclar joins two sorted pieces by always taking the smaller of the two fronts. The array is halved about log n times and each level merges n elements: always O(n log n), at the price of a temporary array of size n. Arrays are passed by reference, so every subprocess works on the same array.",
    challenge: "Print every range that gets merged, with its left and right ends.",
    hint: "Add an Escribir at the start of Mezclar; try a small n so there aren't too many lines.",
  },
  quicksort: {
    label: "Quicksort",
    description: "Picks a pivot, splits smaller from larger values and sorts each side recursively.",
    learn:
      "Particionar uses Hoare's method: two indexes walk in from both ends and swap whenever each one finds a value on the wrong side of the pivot. Then each part is sorted with the same idea. If the pivot splits the array roughly in half it costs O(n log n); if it always lands at one end, O(n²). It needs no extra array, only the call stack (O(log n)).",
    challenge: "Use a random element of the range as the pivot instead of the middle one.",
    hint: "Aleatorio(izquierda, derecha) gives a position in the range; store datos[that position] in pivote.",
  },
  "heap-sort": {
    label: "Heap Sort",
    description: "Arranges the array as a heap, then takes the largest out again and again.",
    learn:
      "A heap is a tree stored in the array: the children of position k are at 2k and 2k + 1, and every parent is larger than its children, so the largest value sits at position 1. It's swapped with the last one, the heap shrinks, and Hundir repairs it in log n steps. It always costs O(n log n) and uses no extra memory.",
    challenge: "Print the array right after the heap is built and check that datos[1] is the largest.",
    hint: "Call MostrarDatos between the two Para loops of the main algorithm.",
  },
  "counting-sort": {
    label: "Counting Sort",
    description: "Counts how many times each value appears, without comparing numbers.",
    learn:
      "Since the values go from 1 to 99, a conteo array stores how many times each one appears; then the array is rewritten by walking conteo in order. It never compares two numbers: it costs O(n + k), where k is the number of possible values. It's very fast when k is small, but it doesn't work when the values could be anything.",
    challenge: "Show which value was repeated the most.",
    hint: "Walk conteo looking for its maximum, the same way you'd find the largest value in an array.",
  },
  "binary-search": {
    label: "Binary Search",
    description: "Finds a value in a sorted array by halving the range every step.",
    learn:
      "Because the list is sorted, looking at the middle element tells you which half the target can be in, and you discard the other. Every step halves the range, so 10 comparisons are enough for 512 elements: O(log n), versus O(n) for checking one by one.",
    challenge: "Also search for a number that surely isn't there, like 2 * n + 1, and count its steps.",
    hint: "You can copy the search block or, better, turn it into a Funcion that returns the position.",
  },
  "search-comparison": {
    label: "Linear vs. Binary Search",
    description: "Counts the comparisons each search needs on the same sorted list.",
    learn:
      "Two functions search for the same value and return how many comparisons they made. Linear search checks one by one: O(1) if the value comes first, O(n) if it's last or missing. Binary search never needs more than log n comparisons. Try n = 10 and n = 500 to see them drift apart.",
    challenge: "Compute the average number of comparisons of each search by looking up every value in the list.",
    hint: "Loop i from 1 to n, search for datos[i] with both functions and add up the results; divide by n at the end.",
  },

  /* ---------------- Text ---------------- */
  palindrome: {
    label: "Palindromes",
    description: "Checks whether a phrase reads the same forwards and backwards.",
    learn:
      "Subcadena pulls out one letter at a time and Minusculas normalizes it. A Para loop with Con Paso -1 walks the text backwards to build the reversed version.",
    challenge: "Also ignore commas and periods, so \"Yo hago yoga, hoy.\" counts as a palindrome.",
    hint: "Extend the Si condition that skips the spaces.",
  },
  "count-vowels": {
    label: "Count Vowels",
    description: "Counts the vowels, spaces and other characters in a text.",
    learn:
      "A Para loop reads the text letter by letter with Subcadena. Segun accepts several values in one case, like \"a\", \"e\", \"i\", \"o\", \"u\".",
    challenge: "Also count accented vowels (á, é, í, ó, ú) as vowels.",
    hint: "Add those letters to the list in the vowel case.",
  },
  initials: {
    label: "Name Initials",
    description: "Gets the initials of a full name.",
    learn:
      "Remembering the previous letter tells you where each word starts. The condition joins two comparisons with Y, and Mayusculas capitalizes each initial.",
    challenge: "Count how many words the name has and show it at the end.",
    hint: "Add 1 to a counter every time you add an initial.",
  },
  "caesar-cipher": {
    label: "Caesar Cipher",
    description: "Encrypts a message by shifting each letter of the alphabet.",
    learn:
      "A nested Para loop finds each letter in the alphabet with Subcadena. MOD wraps around so that after z you start again at a.",
    challenge: "Add an option to decrypt a message that is already encrypted.",
    hint: "Decrypting is the same as encrypting with a shift of 26 minus the original one.",
  },
  "text-format": {
    label: "Data Formatting",
    description: "Fixes upper and lower case, and converts between text and numbers.",
    learn:
      "Subcadena, Mayusculas, Minusculas and Concatenar work together to format a name. ConvertirANumero and ConvertirATexto turn data from one type into the other.",
    challenge: "Format the last name the same way: first letter uppercase, the rest lowercase.",
    hint: "Repeat the nombreBonito line using apellido instead of nombre.",
  },

  /* ---------------- Subprocesses and functions ---------------- */
  "factorial-power": {
    label: "Factorial and Power",
    description: "Functions that compute a factorial and a power.",
    learn:
      "A Funcion takes parameters and returns the value of the variable written before <-. You can call it inside Escribir just like a built-in PSeInt function.",
    challenge: "Write a Sumatoria(n) function that adds the numbers from 1 to n.",
    hint: "Copy the shape of Factorial, but start at 0 and add instead of multiplying.",
  },
  references: {
    label: "By Reference and by Value",
    description: "Sorts three numbers by swapping them in subprocesses.",
    learn:
      "With Por Referencia a SubProceso changes the original variables; with Por Valor it only changes a copy. One SubProceso can call another, as OrdenarTres calls Intercambiar.",
    challenge: "Add a SubProceso Duplicar(n Por Referencia) and use it to double the largest of the three.",
    hint: "After OrdenarTres, the largest number is always in c.",
  },
  validation: {
    label: "Reusable Validation",
    description: "Validates the email and age on a sign-up form.",
    learn:
      "Each Funcion returns a Logico value, so you can use it directly in a Si or a Hasta Que. Conditions are combined with Y and negated with NO.",
    challenge: "Add an EsNombreValido function that requires at least 3 letters, and ask for the name first.",
    hint: "Use Longitud inside the function and repeat the same Repetir ... Hasta Que pattern.",
  },
  "modular-menu": {
    label: "Modular Menu",
    description: "A unit converter with a menu that keeps coming back.",
    learn:
      "The program is split into SubProceso blocks without parameters, each with one job. Repetir ... Mientras Que shows the menu again until you choose to quit.",
    challenge: "Add an option to convert kilograms to pounds.",
    hint: "Create a new SubProceso (1 kg = 2.20462 lb), add it to the menu, and move Salir to option 4.",
  },
  hanoi: {
    label: "Towers of Hanoi",
    description: "Solves the classic tower puzzle step by step.",
    learn:
      "Hanoi is a recursive SubProceso: it calls itself with one disk fewer. The base case (a single disk) is what stops the recursion.",
    challenge: "Check that the number of disks is between 1 and 6 before starting.",
    hint: "Put a Repetir ... Hasta Que around the Leer n.",
  },

  /* ---------------- Math ---------------- */
  primes: {
    label: "Prime Numbers",
    description: "Finds every prime number up to a limit.",
    learn:
      "The EsPrimo Funcion returns a Logico and uses MOD to look for divisors. Its Mientras loop stops early, past the square root or as soon as a divisor turns up.",
    challenge: "Also show the sum of all the primes found.",
    hint: "Add an accumulator to the Para loop in the main algorithm.",
  },
  "gcd-lcm": {
    label: "GCD and LCM",
    description: "Computes the greatest common divisor and the least common multiple.",
    learn:
      "The MCD Funcion runs Euclid's algorithm with Mientras and MOD. The LCM comes from the GCD, using Trunc to keep a whole number.",
    challenge: "Ask for three numbers and compute the GCD of all three.",
    hint: "The GCD of three numbers is MCD(MCD(a, b), c).",
  },
  fibonacci: {
    label: "Fibonacci Sequence",
    description: "Prints the first terms of the Fibonacci sequence.",
    learn:
      "Inside a Para loop, two variables move forward together: each term is the sum of the previous two. At the end, the ratio between terms approaches the golden ratio.",
    challenge: "Print only the even terms.",
    hint: "Before writing a, check with a Si whether a MOD 2 = 0.",
  },
  quadratic: {
    label: "Quadratic Equation",
    description: "Solves ax² + bx + c = 0, with real or complex roots.",
    learn:
      "The discriminant picks one of three cases with nested Si blocks. Raiz takes the square root, and an early check avoids dividing when a = 0.",
    challenge: "When a = 0, solve the linear equation bx + c = 0 instead of just warning.",
    hint: "The solution is x = -c / b, but first make sure b is not 0.",
  },
  "roman-numerals": {
    label: "Roman Numerals",
    description: "Converts a number from 1 to 3999 into Roman numerals.",
    learn:
      "Two parallel arrays hold the values and their symbols. A Mientras loop inside a Para subtracts the largest possible value as many times as it fits.",
    challenge: "Also show how many symbols the Roman numeral has.",
    hint: "Use Longitud on the romano variable.",
  },
  "base-conversion": {
    label: "Base Conversion",
    description: "Writes a number in binary and hexadecimal.",
    learn:
      "With repeated division, MOD gives each digit and Trunc the quotient. ConvertirATexto and Subcadena turn each remainder into its character.",
    challenge: "Add a conversion to base 8 (octal).",
    hint: "Copy the binary block and change the 2 into an 8.",
  },
  geometry: {
    label: "Geometry",
    description: "Finds a circle's area and solves a right triangle.",
    learn:
      "You use the PI constant, RC for square roots, and ATan, Sen and Cos for trigonometry. Trig functions work in radians, so you convert to degrees.",
    challenge: "Also compute the triangle's area and perimeter.",
    hint: "The area is cateto1 * cateto2 / 2 and the perimeter is the sum of the three sides.",
  },
  "compound-interest": {
    label: "Compound Interest",
    description: "Watch your savings grow year by year.",
    learn:
      "A Para loop applies the interest to the running amount on each pass. Ln works out how long it takes to double your money, and Exp gives the result with continuous interest.",
    challenge: "Add a fixed deposit that is added at the end of every year.",
    hint: "Read the deposit before the loop and add it to monto after applying the interest.",
  },

  /* ---------------- Projects ---------------- */
  "tic-tac-toe": {
    label: "Tic-Tac-Toe",
    description: "The classic three-in-a-row game for two players.",
    learn:
      "The board is a 3 x 3 matrix. A SubProceso draws it, a Logico Funcion checks for three in a row, and Repetir ... Hasta Que validates each move.",
    challenge: "When the game ends, ask whether they want to play again.",
    hint: "Wrap the whole game, starting from clearing the board, in a Repetir ... Hasta Que.",
  },
  atm: {
    label: "ATM",
    description: "Checks your PIN and lets you check, deposit and withdraw money.",
    learn:
      "A Repetir loop with three tries guards access using a Logico variable. Then a Segun menu updates the balance and uses MOD to accept only multiples of 100.",
    challenge: "Limit withdrawals to at most $3000 per transaction.",
    hint: "Add another condition in case 3, before checking whether there are enough funds.",
  },
  "grade-book": {
    label: "Class Grade Book",
    description: "Records three grades per student and builds a class report.",
    learn:
      "A matrix stores the grades and an array stores the names. The PromedioAlumno Funcion receives the whole matrix, and the report counts passing students and finds the best average.",
    challenge: "Also show the overall class average.",
    hint: "Add each p to an accumulator and divide by 4 at the end.",
  },
  hangman: {
    label: "Hangman",
    description: "Guess a secret word letter by letter, with six mistakes allowed.",
    learn:
      "Azar picks a word from an array. A Mientras loop runs until you win or lose, and each guess rebuilds the progress string with Subcadena.",
    challenge: "Warn the player when they repeat a letter they already tried, without counting it as a mistake.",
    hint: "Keep the used letters in a text and check whether the new one is there by walking it with Subcadena.",
  },
  contacts: {
    label: "Contact Book",
    description: "Add, list and search contacts in a book that grows.",
    learn:
      "Redimensionar grows two parallel arrays every time you add a contact. A Segun menu inside Repetir ... Hasta Que organizes the options.",
    challenge: "Add an option that counts how many contacts start with a given letter.",
    hint: "Compare Mayusculas(Subcadena(nombres[i], 1, 1)) with the letter you read.",
  },
};
