import type { ExampleConcept, ExampleProgram, ExampleTopic } from "./types";

// The example library. Programs are written for the default profile and run
// to completion with their sample `input` (tests enforce this). Titles and
// explanations live in the dictionaries (src/i18n/examples-*.ts) by id.

export const exampleTopics = [
  "basics",
  "decisions",
  "loops",
  "arrays",
  "sorting",
  "text",
  "routines",
  "math",
  "projects",
] as const satisfies readonly ExampleTopic[];

export const exampleConcepts = [
  "io",
  "variables",
  "si",
  "segun",
  "mientras",
  "repetir",
  "para",
  "paraCada",
  "arreglos",
  "matrices",
  "redimensionar",
  "texto",
  "logicos",
  "subprocesos",
  "funciones",
  "referencia",
  "recursion",
  "azar",
  "matematicas",
  "pantalla",
  "coloquial",
] as const satisfies readonly ExampleConcept[];

// Shared by the sorting and searching examples: prints the whole array only
// when it is short, so big inputs keep the output small.
const SHOW_ARRAY = `// Muestra el arreglo completo solo si es corto (30 o menos)
SubProceso MostrarDatos(titulo, datos, n)
	Definir i Como Entero
	Si n <= 30 Entonces
		Escribir Sin Saltar titulo
		Para i <- 1 Hasta n Hacer
			Escribir Sin Saltar datos[i], " "
		FinPara
		Escribir ""
	SiNo
		Escribir titulo, n, " números (el primero es ", datos[1], " y el último ", datos[n], ")"
	FinSi
FinSubProceso
`;

export const examplePrograms: ExampleProgram[] = [
  /* ---------------- Primeros pasos ---------------- */
  {
    id: "hello-world",
    label: "Hola Mundo",
    description: "Your first algorithm: write a couple of lines.",
    topic: "basics",
    level: 1,
    concepts: ["io"],
    source: `Algoritmo HolaMundo
	Escribir "¡Hola, mundo!"
	Escribir "Este es tu primer algoritmo."
FinAlgoritmo
`,
  },
  {
    id: "greeting",
    label: "Saludo personalizado",
    description: "Ask for a name and an age and answer with both.",
    topic: "basics",
    level: 1,
    concepts: ["io", "variables"],
    input: "Ana\n16",
    source: `Algoritmo Saludo
	Definir nombre Como Caracter
	Definir edad Como Entero
	Escribir "¿Cómo te llamas?"
	Leer nombre
	Escribir "¿Cuántos años tienes?"
	Leer edad
	Escribir "Hola, ", nombre, ". El próximo año tendrás ", edad + 1, " años."
FinAlgoritmo
`,
  },
  {
    id: "temperature",
    label: "Conversor de temperatura",
    description: "Convert Celsius to Fahrenheit and Kelvin.",
    topic: "basics",
    level: 1,
    concepts: ["io", "variables", "matematicas"],
    input: "25",
    source: `Algoritmo ConversorTemperatura
	Definir celsius, fahrenheit, kelvin Como Real
	Escribir "Temperatura en grados Celsius:"
	Leer celsius
	fahrenheit <- celsius * 9 / 5 + 32
	kelvin <- celsius + 273.15
	Escribir celsius, " °C equivalen a ", fahrenheit, " °F"
	Escribir celsius, " °C equivalen a ", kelvin, " K"
FinAlgoritmo
`,
  },
  {
    id: "tip-calculator",
    label: "Calculadora de propina",
    description: "Split a restaurant bill including the tip.",
    topic: "basics",
    level: 1,
    concepts: ["io", "variables", "matematicas"],
    input: "1250\n10\n4",
    source: `Algoritmo CalculadoraPropina
	Definir cuenta, porcentaje, propina, total, porPersona Como Real
	Definir personas Como Entero
	Escribir "Total de la cuenta:"
	Leer cuenta
	Escribir "Porcentaje de propina (por ejemplo 10):"
	Leer porcentaje
	Escribir "¿Entre cuántas personas se divide?"
	Leer personas
	propina <- cuenta * porcentaje / 100
	total <- cuenta + propina
	porPersona <- total / personas
	Escribir "Propina: $", propina
	Escribir "Total: $", total
	// Redon redondea al entero más cercano; así dejamos dos decimales
	Escribir "Cada persona paga: $", Redon(porPersona * 100) / 100
FinAlgoritmo
`,
  },

  /* ---------------- Decisiones ---------------- */
  {
    id: "can-vote",
    label: "¿Puedo votar?",
    description: "A first decision with Si / SiNo.",
    topic: "decisions",
    level: 1,
    concepts: ["io", "si"],
    input: "16",
    source: `Algoritmo PuedeVotar
	Definir edad Como Entero
	Escribir "¿Qué edad tienes?"
	Leer edad
	Si edad >= 18 Entonces
		Escribir "Ya puedes votar."
	SiNo
		Escribir "Todavía no puedes votar. Te faltan ", 18 - edad, " años."
	FinSi
FinAlgoritmo
`,
  },
  {
    id: "bmi",
    label: "Índice de masa corporal",
    description: "Compute the BMI and classify it with nested decisions.",
    topic: "decisions",
    level: 2,
    concepts: ["io", "si", "matematicas"],
    input: "68\n1.72",
    source: `Algoritmo CalculadoraIMC
	Definir peso, altura, imc Como Real
	Escribir "Peso en kilogramos:"
	Leer peso
	Escribir "Altura en metros (por ejemplo 1.70):"
	Leer altura
	imc <- peso / altura ^ 2
	Escribir "Tu IMC es ", Redon(imc * 10) / 10
	Si imc < 18.5 Entonces
		Escribir "Clasificación: bajo peso"
	SiNo
		Si imc < 25 Entonces
			Escribir "Clasificación: peso normal"
		SiNo
			Si imc < 30 Entonces
				Escribir "Clasificación: sobrepeso"
			SiNo
				Escribir "Clasificación: obesidad"
			FinSi
		FinSi
	FinSi
FinAlgoritmo
`,
  },
  {
    id: "parking",
    label: "Tarifa del estacionamiento",
    description: "Charge by started hour, with a daily maximum.",
    topic: "decisions",
    level: 2,
    concepts: ["io", "si", "matematicas"],
    input: "135",
    source: `Algoritmo TarifaEstacionamiento
	Definir minutos, horas Como Entero
	Definir costo Como Real
	Escribir "¿Cuántos minutos estuvo el auto?"
	Leer minutos
	// Cada hora empezada se cobra completa
	horas <- Trunc(minutos / 60)
	Si minutos MOD 60 > 0 Entonces
		horas <- horas + 1
	FinSi
	Si horas = 0 Entonces
		costo <- 0
	SiNo
		Si horas = 1 Entonces
			costo <- 20
		SiNo
			costo <- 20 + (horas - 1) * 15
		FinSi
	FinSi
	Si costo > 120 Entonces
		costo <- 120
		Escribir "Se aplicó la tarifa máxima diaria."
	FinSi
	Escribir "Horas cobradas: ", horas
	Escribir "Total a pagar: $", costo
FinAlgoritmo
`,
  },
  {
    id: "leap-year",
    label: "Año bisiesto",
    description: "Leap-year rules written with colloquial conditions.",
    topic: "decisions",
    level: 2,
    concepts: ["io", "si", "coloquial"],
    input: "2024",
    source: `Algoritmo AnioBisiesto
	Definir anio Como Entero
	Escribir "Escribe un año:"
	Leer anio
	// "Es Multiplo De" es una condición coloquial de PSeInt
	Si anio Es Multiplo De 400 Entonces
		Escribir anio, " es bisiesto."
	SiNo
		Si anio Es Multiplo De 100 Entonces
			Escribir anio, " no es bisiesto (es múltiplo de 100 pero no de 400)."
		SiNo
			Si anio Es Multiplo De 4 Entonces
				Escribir anio, " es bisiesto: febrero tiene 29 días."
			SiNo
				Escribir anio, " no es bisiesto."
			FinSi
		FinSi
	FinSi
FinAlgoritmo
`,
  },
  {
    id: "coffee-menu",
    label: "Menú de cafetería",
    description: "Pick an option with Segun and compute the total.",
    topic: "decisions",
    level: 1,
    concepts: ["io", "segun", "si"],
    input: "3\n2",
    source: `Algoritmo MenuCafeteria
	Definir opcion, cantidad Como Entero
	Definir precio Como Real
	Escribir "1. Café        $35"
	Escribir "2. Té          $28"
	Escribir "3. Chocolate   $40"
	Escribir "Elige una bebida:"
	Leer opcion
	Segun opcion Hacer
		1:
			precio <- 35
		2:
			precio <- 28
		3:
			precio <- 40
		De Otro Modo:
			precio <- 0
	FinSegun
	Si precio = 0 Entonces
		Escribir "Esa opción no está en el menú."
	SiNo
		Escribir "¿Cuántas quieres?"
		Leer cantidad
		Escribir "Total: $", precio * cantidad
	FinSi
FinAlgoritmo
`,
  },

  /* ---------------- Repeticiones ---------------- */
  {
    id: "times-table",
    label: "Tabla de multiplicar",
    description: "The classic Para loop.",
    topic: "loops",
    level: 1,
    concepts: ["io", "para"],
    input: "7",
    source: `Algoritmo TablaMultiplicar
	Definir n, i Como Entero
	Escribir "¿Qué tabla quieres ver?"
	Leer n
	Para i <- 1 Hasta 10 Hacer
		Escribir n, " x ", i, " = ", n * i
	FinPara
FinAlgoritmo
`,
  },
  {
    id: "guess-number",
    label: "Adivina el número",
    description: "A game with a random number and limited attempts.",
    topic: "loops",
    level: 2,
    concepts: ["io", "mientras", "si", "azar", "logicos"],
    input: "50\n25\n75\n12\n37\n62\n88",
    source: `Algoritmo AdivinaNumero
	Definir secreto, intento, intentos Como Entero
	Definir acerto Como Logico
	secreto <- Aleatorio(1, 100)
	intentos <- 0
	acerto <- Falso
	Escribir "Pensé un número del 1 al 100. Tienes 7 intentos."
	Mientras (NO acerto) Y intentos < 7 Hacer
		intentos <- intentos + 1
		Escribir "Intento ", intentos, ":"
		Leer intento
		Si intento = secreto Entonces
			acerto <- Verdadero
		SiNo
			Si intento < secreto Entonces
				Escribir Sin Saltar "Más alto"
			SiNo
				Escribir Sin Saltar "Más bajo"
			FinSi
			// Abs da la distancia sin importar el signo
			Si Abs(intento - secreto) <= 5 Entonces
				Escribir ", ¡estás muy cerca!"
			SiNo
				Escribir "..."
			FinSi
		FinSi
	FinMientras
	Si acerto Entonces
		Escribir "¡Correcto! Lo lograste en ", intentos, " intentos."
	SiNo
		Escribir "Se acabaron los intentos. Era el ", secreto, "."
	FinSi
FinAlgoritmo
`,
  },
  {
    id: "password",
    label: "Validar contraseña",
    description: "Repeat until the input is valid with Repetir ... Hasta Que.",
    topic: "loops",
    level: 1,
    concepts: ["io", "repetir", "texto"],
    input: "gato\nsol123\nmiPerro2024",
    source: `Algoritmo ValidarClave
	Definir clave Como Caracter
	Definir intentos Como Entero
	intentos <- 0
	Repetir
		Escribir "Crea una contraseña (mínimo 8 caracteres):"
		Leer clave
		intentos <- intentos + 1
		Si Longitud(clave) < 8 Entonces
			Escribir "Muy corta: tiene ", Longitud(clave), " caracteres."
		FinSi
	Hasta Que Longitud(clave) >= 8
	Escribir "Contraseña aceptada en el intento ", intentos, "."
FinAlgoritmo
`,
  },
  {
    id: "countdown",
    label: "Cuenta regresiva",
    description: "Count down with Con Paso -1, clearing the screen and waiting.",
    topic: "loops",
    level: 1,
    concepts: ["para", "pantalla"],
    source: `Algoritmo CuentaRegresiva
	Definir i Como Entero
	Escribir "Pulsa una tecla para iniciar la cuenta regresiva."
	Esperar Tecla
	Para i <- 5 Hasta 1 Con Paso -1 Hacer
		Limpiar Pantalla
		Escribir "Despegue en ", i, "..."
		Esperar 1 Segundo
	FinPara
	Limpiar Pantalla
	Escribir "¡Despegue!"
FinAlgoritmo
`,
  },
  {
    id: "sum-until-zero",
    label: "Sumar hasta cero",
    description: "A Mientras loop that stops on a sentinel value.",
    topic: "loops",
    level: 1,
    concepts: ["io", "mientras", "si"],
    input: "12\n7.5\n30\n0",
    source: `Algoritmo SumaHastaCero
	Definir numero, suma Como Real
	Definir cantidad Como Entero
	suma <- 0
	cantidad <- 0
	Escribir "Escribe números para sumar. Escribe 0 para terminar."
	Leer numero
	Mientras numero <> 0 Hacer
		suma <- suma + numero
		cantidad <- cantidad + 1
		Escribir "Siguiente número (0 para terminar):"
		Leer numero
	FinMientras
	Si cantidad > 0 Entonces
		Escribir "Sumaste ", cantidad, " números."
		Escribir "Total: ", suma
		Escribir "Promedio: ", suma / cantidad
	SiNo
		Escribir "No escribiste ningún número."
	FinSi
FinAlgoritmo
`,
  },
  {
    id: "shapes",
    label: "Dibujar figuras",
    description: "Nested loops and Sin Saltar to draw with characters.",
    topic: "loops",
    level: 2,
    concepts: ["io", "para"],
    input: "4",
    source: `Algoritmo DibujarFiguras
	Definir n, fila, columna Como Entero
	Escribir "Tamaño de las figuras:"
	Leer n
	Escribir "Cuadrado:"
	Para fila <- 1 Hasta n Hacer
		Para columna <- 1 Hasta n Hacer
			Escribir Sin Saltar "* "
		FinPara
		Escribir ""
	FinPara
	Escribir "Triángulo:"
	Para fila <- 1 Hasta n Hacer
		Para columna <- 1 Hasta fila Hacer
			Escribir Sin Saltar "* "
		FinPara
		Escribir ""
	FinPara
FinAlgoritmo
`,
  },

  /* ---------------- Arreglos ---------------- */
  {
    id: "array-average",
    label: "Promedio de Notas",
    description: "Fill an array and compute its average and maximum.",
    topic: "arrays",
    level: 1,
    concepts: ["io", "arreglos", "para"],
    input: "8.5\n9.0\n7.5\n8.0\n9.5",
    source: `Proceso PromedioNotas
	Definir notas Como Real
	Dimension notas[5]
	Definir suma, promedio, maximo Como Real
	Definir i Como Entero
	suma <- 0.0
	maximo <- 0.0
	// Llenar el arreglo
	Para i <- 1 Hasta 5 Hacer
		Escribir "Ingrese nota ", i, ": "
		Leer notas[i]
		suma <- suma + notas[i]
		// Encontrar la nota máxima
		Si notas[i] > maximo Entonces
			maximo <- notas[i]
		FinSi
	FinPara
	promedio <- suma / 5
	Escribir "Promedio: ", promedio
	Escribir "Nota más alta: ", maximo
FinProceso
`,
  },
  {
    id: "linear-search",
    label: "Búsqueda lineal",
    description: "Search a list of names, ignoring upper and lower case.",
    topic: "arrays",
    level: 2,
    concepts: ["io", "arreglos", "mientras", "texto"],
    input: "luis",
    complexity: { best: "O(1)", average: "O(n)", worst: "O(n)", space: "O(1)" },
    source: `Algoritmo BusquedaLineal
	Definir nombres, buscado Como Caracter
	Definir i, posicion Como Entero
	Dimension nombres[6]
	nombres[1] <- "Ana"
	nombres[2] <- "Bruno"
	nombres[3] <- "Carla"
	nombres[4] <- "Diego"
	nombres[5] <- "Luis"
	nombres[6] <- "Sofía"
	Escribir "¿A quién buscas?"
	Leer buscado
	posicion <- 0
	i <- 1
	// Se detiene en cuanto lo encuentra
	Mientras i <= 6 Y posicion = 0 Hacer
		Si Mayusculas(nombres[i]) = Mayusculas(buscado) Entonces
			posicion <- i
		FinSi
		i <- i + 1
	FinMientras
	Si posicion > 0 Entonces
		Escribir nombres[posicion], " está en la posición ", posicion, "."
	SiNo
		Escribir buscado, " no está en la lista."
	FinSi
FinAlgoritmo
`,
  },
  {
    id: "inventory",
    label: "Inventario de tienda",
    description: "Two parallel arrays: products and their stock.",
    topic: "arrays",
    level: 2,
    concepts: ["io", "arreglos", "para", "si"],
    input: "24\n6\n15\n3\n40",
    source: `Algoritmo InventarioTienda
	Definir productos Como Caracter
	Definir stock, i, aReponer Como Entero
	Dimension productos[5], stock[5]
	productos[1] <- "Arroz"
	productos[2] <- "Leche"
	productos[3] <- "Pan"
	productos[4] <- "Huevos"
	productos[5] <- "Café"
	Para i <- 1 Hasta 5 Hacer
		Escribir "Unidades de ", productos[i], ":"
		Leer stock[i]
	FinPara
	aReponer <- 0
	Escribir "Productos para reponer (menos de 10 unidades):"
	Para i <- 1 Hasta 5 Hacer
		Si stock[i] < 10 Entonces
			Escribir "- ", productos[i], " (quedan ", stock[i], ")"
			aReponer <- aReponer + 1
		FinSi
	FinPara
	Si aReponer = 0 Entonces
		Escribir "Ninguno. ¡Todo en orden!"
	FinSi
FinAlgoritmo
`,
  },
  {
    id: "sales-matrix",
    label: "Ventas de la semana",
    description: "A matrix of sales: totals by branch and by day.",
    topic: "arrays",
    level: 3,
    concepts: ["matrices", "arreglos", "para", "azar"],
    source: `Algoritmo VentasSemana
	Definir ventas, totalSucursal, totalDia Como Real
	Definir s, d Como Entero
	// 3 sucursales (filas) x 5 días (columnas)
	Dimension ventas[3, 5]
	Para s <- 1 Hasta 3 Hacer
		Para d <- 1 Hasta 5 Hacer
			ventas[s, d] <- Aleatorio(100, 500)
		FinPara
	FinPara
	Escribir "Ventas por sucursal, de lunes a viernes:"
	Para s <- 1 Hasta 3 Hacer
		totalSucursal <- 0
		Escribir Sin Saltar "Sucursal ", s, ": "
		Para d <- 1 Hasta 5 Hacer
			Escribir Sin Saltar ventas[s, d], "  "
			totalSucursal <- totalSucursal + ventas[s, d]
		FinPara
		Escribir "| total ", totalSucursal
	FinPara
	Escribir "Total por día:"
	Para d <- 1 Hasta 5 Hacer
		totalDia <- 0
		Para s <- 1 Hasta 3 Hacer
			totalDia <- totalDia + ventas[s, d]
		FinPara
		Escribir "Día ", d, ": ", totalDia
	FinPara
FinAlgoritmo
`,
  },
  {
    id: "shopping-list",
    label: "Lista de compras",
    description: "Grow an array with Redimensionar and walk it with Para Cada.",
    topic: "arrays",
    level: 3,
    concepts: ["io", "arreglos", "redimensionar", "paraCada", "mientras"],
    input: "pan\nmanzanas\nqueso\nfin",
    source: `Algoritmo ListaCompras
	Definir lista, producto Como Caracter
	Definir cantidad Como Entero
	cantidad <- 0
	Dimension lista[1]
	Escribir "Agrega productos a tu lista. Escribe FIN para terminar."
	Leer producto
	Mientras Mayusculas(producto) <> "FIN" Hacer
		cantidad <- cantidad + 1
		// El arreglo crece de a un elemento, conservando lo que ya tenía
		Redimensionar lista[cantidad]
		lista[cantidad] <- producto
		Escribir "Siguiente producto (FIN para terminar):"
		Leer producto
	FinMientras
	Si cantidad = 0 Entonces
		Escribir "La lista quedó vacía."
	SiNo
		Escribir "Tu lista tiene ", cantidad, " productos:"
		Para Cada item de lista Hacer
			Escribir "- ", item
		FinPara
	FinSi
FinAlgoritmo
`,
  },

  /* ---------------- Ordenamiento y búsqueda ---------------- */
  // Convención para el analizador de complejidad: cada programa lee primero
  // el tamaño con `Leer n` y genera sus datos a partir de n (1 a 512), sin
  // pedir nada más. Muestra el arreglo solo si n <= 30.
  {
    id: "bubble-sort",
    label: "Ordenamiento burbuja",
    description: "Sort random numbers by swapping neighbours, stopping early when sorted.",
    topic: "sorting",
    level: 2,
    concepts: ["io", "arreglos", "para", "mientras", "si", "logicos", "azar", "subprocesos"],
    input: "12",
    complexity: { best: "O(n)", average: "O(n²)", worst: "O(n²)", space: "O(1)", stable: true, inPlace: true },
    source: `${SHOW_ARRAY}
Algoritmo OrdenamientoBurbuja
	Definir datos, n, i, j, aux, pasadas Como Entero
	Definir huboCambios Como Logico
	Escribir "¿Cuántos números quieres ordenar? (1 a 512)"
	Leer n
	Dimension datos[n]
	Para i <- 1 Hasta n Hacer
		datos[i] <- Aleatorio(1, 99)
	FinPara
	MostrarDatos("Antes:   ", datos, n)
	// En cada pasada, el mayor "sube" hasta su lugar al final
	pasadas <- 0
	huboCambios <- Verdadero
	Mientras huboCambios Y pasadas < n - 1 Hacer
		pasadas <- pasadas + 1
		huboCambios <- Falso
		Para j <- 1 Hasta n - pasadas Hacer
			Si datos[j] > datos[j + 1] Entonces
				aux <- datos[j]
				datos[j] <- datos[j + 1]
				datos[j + 1] <- aux
				huboCambios <- Verdadero
			FinSi
		FinPara
		// Si una pasada no cambió nada, el arreglo ya está ordenado
	FinMientras
	MostrarDatos("Después: ", datos, n)
	Escribir "Pasadas necesarias: ", pasadas
FinAlgoritmo
`,
  },
  {
    id: "selection-sort",
    label: "Ordenamiento por selección",
    description: "Find the smallest remaining number and put it in its place.",
    topic: "sorting",
    level: 2,
    concepts: ["io", "arreglos", "para", "si", "azar", "subprocesos"],
    input: "12",
    complexity: { best: "O(n²)", average: "O(n²)", worst: "O(n²)", space: "O(1)", stable: false, inPlace: true },
    source: `${SHOW_ARRAY}
Algoritmo OrdenamientoSeleccion
	Definir datos, n, i, j, minimo, aux, intercambios Como Entero
	Escribir "¿Cuántos números quieres ordenar? (1 a 512)"
	Leer n
	Dimension datos[n]
	Para i <- 1 Hasta n Hacer
		datos[i] <- Aleatorio(1, 99)
	FinPara
	MostrarDatos("Antes:   ", datos, n)
	intercambios <- 0
	// "Con Paso 1" evita que el Para cuente hacia atrás cuando n = 1
	Para i <- 1 Hasta n - 1 Con Paso 1 Hacer
		// Buscamos el menor entre las posiciones i y n
		minimo <- i
		Para j <- i + 1 Hasta n Hacer
			Si datos[j] < datos[minimo] Entonces
				minimo <- j
			FinSi
		FinPara
		// Y lo llevamos a la posición i con un solo intercambio
		Si minimo <> i Entonces
			aux <- datos[i]
			datos[i] <- datos[minimo]
			datos[minimo] <- aux
			intercambios <- intercambios + 1
		FinSi
	FinPara
	MostrarDatos("Después: ", datos, n)
	Escribir "Intercambios realizados: ", intercambios
FinAlgoritmo
`,
  },
  {
    id: "insertion-sort",
    label: "Ordenamiento por inserción",
    description: "Insert each number among the already sorted ones, like a hand of cards.",
    topic: "sorting",
    level: 2,
    concepts: ["io", "arreglos", "para", "mientras", "si", "logicos", "azar", "subprocesos"],
    input: "12",
    complexity: { best: "O(n)", average: "O(n²)", worst: "O(n²)", space: "O(1)", stable: true, inPlace: true },
    source: `${SHOW_ARRAY}
Algoritmo OrdenamientoInsercion
	Definir datos, n, i, j, actual, desplazamientos Como Entero
	Definir ubicado Como Logico
	Escribir "¿Cuántos números quieres ordenar? (1 a 512)"
	Leer n
	Dimension datos[n]
	Para i <- 1 Hasta n Hacer
		datos[i] <- Aleatorio(1, 99)
	FinPara
	MostrarDatos("Antes:   ", datos, n)
	desplazamientos <- 0
	// Las posiciones 1 a i-1 ya están ordenadas; insertamos datos[i] entre ellas
	Para i <- 2 Hasta n Con Paso 1 Hacer
		actual <- datos[i]
		j <- i - 1
		ubicado <- Falso
		// Corremos un lugar a la derecha los que son mayores que actual
		Mientras j >= 1 Y (NO ubicado) Hacer
			Si datos[j] > actual Entonces
				datos[j + 1] <- datos[j]
				j <- j - 1
				desplazamientos <- desplazamientos + 1
			SiNo
				ubicado <- Verdadero
			FinSi
		FinMientras
		// El hueco que quedó es su lugar
		datos[j + 1] <- actual
	FinPara
	MostrarDatos("Después: ", datos, n)
	Escribir "Desplazamientos: ", desplazamientos
FinAlgoritmo
`,
  },
  {
    id: "shell-sort",
    label: "Ordenamiento Shell",
    description: "Insertion sort over far-apart elements, with a gap that keeps shrinking.",
    topic: "sorting",
    level: 3,
    concepts: ["io", "arreglos", "para", "mientras", "si", "logicos", "azar", "subprocesos"],
    input: "16",
    complexity: { best: "O(n log n)", average: "O(n√n)", worst: "O(n²)", space: "O(1)", stable: false, inPlace: true },
    source: `${SHOW_ARRAY}
Algoritmo OrdenamientoShell
	Definir datos, n, i, j, actual, salto Como Entero
	Definir ubicado Como Logico
	Escribir "¿Cuántos números quieres ordenar? (1 a 512)"
	Leer n
	Dimension datos[n]
	Para i <- 1 Hasta n Hacer
		datos[i] <- Aleatorio(1, 99)
	FinPara
	MostrarDatos("Antes:   ", datos, n)
	// Empezamos comparando elementos lejanos: los muy desordenados viajan rápido
	salto <- Trunc(n / 2)
	Mientras salto > 0 Hacer
		Escribir "Pasada con salto ", salto
		// Inserción, pero entre elementos separados por "salto" posiciones
		Para i <- salto + 1 Hasta n Hacer
			actual <- datos[i]
			j <- i
			ubicado <- Falso
			Mientras j > salto Y (NO ubicado) Hacer
				Si datos[j - salto] > actual Entonces
					datos[j] <- datos[j - salto]
					j <- j - salto
				SiNo
					ubicado <- Verdadero
				FinSi
			FinMientras
			datos[j] <- actual
		FinPara
		// La última pasada (salto 1) es una inserción común sobre datos casi ordenados
		salto <- Trunc(salto / 2)
	FinMientras
	MostrarDatos("Después: ", datos, n)
FinAlgoritmo
`,
  },
  {
    id: "merge-sort",
    label: "Ordenamiento por mezcla",
    description: "Split in halves, sort each half recursively and merge them.",
    topic: "sorting",
    level: 3,
    concepts: ["io", "arreglos", "subprocesos", "recursion", "mientras", "para", "si", "azar"],
    input: "12",
    complexity: { best: "O(n log n)", average: "O(n log n)", worst: "O(n log n)", space: "O(n)", stable: true, inPlace: false },
    source: `${SHOW_ARRAY}
// Une dos tramos ya ordenados: datos[izquierda..medio] y datos[medio+1..derecha]
SubProceso Mezclar(datos, temporal, izquierda, medio, derecha)
	Definir i, j, k Como Entero
	i <- izquierda
	j <- medio + 1
	k <- izquierda
	// Tomamos siempre el menor de los dos frentes
	Mientras i <= medio Y j <= derecha Hacer
		// Con <= los iguales conservan su orden: por eso es estable
		Si datos[i] <= datos[j] Entonces
			temporal[k] <- datos[i]
			i <- i + 1
		SiNo
			temporal[k] <- datos[j]
			j <- j + 1
		FinSi
		k <- k + 1
	FinMientras
	// Copiamos lo que haya sobrado de cualquiera de las dos mitades
	Mientras i <= medio Hacer
		temporal[k] <- datos[i]
		i <- i + 1
		k <- k + 1
	FinMientras
	Mientras j <= derecha Hacer
		temporal[k] <- datos[j]
		j <- j + 1
		k <- k + 1
	FinMientras
	// Devolvemos el tramo mezclado al arreglo original
	Para k <- izquierda Hasta derecha Hacer
		datos[k] <- temporal[k]
	FinPara
FinSubProceso

// Los arreglos se pasan por referencia: el subproceso ordena el arreglo del algoritmo
SubProceso OrdenarPorMezcla(datos, temporal, izquierda, derecha)
	Definir medio Como Entero
	// Un tramo de un solo elemento ya está ordenado: ahí termina la recursión
	Si izquierda < derecha Entonces
		medio <- Trunc((izquierda + derecha) / 2)
		OrdenarPorMezcla(datos, temporal, izquierda, medio)
		OrdenarPorMezcla(datos, temporal, medio + 1, derecha)
		Mezclar(datos, temporal, izquierda, medio, derecha)
	FinSi
FinSubProceso

Algoritmo OrdenamientoMezcla
	Definir datos, temporal, n, i Como Entero
	Escribir "¿Cuántos números quieres ordenar? (1 a 512)"
	Leer n
	// temporal es la memoria extra que necesita la mezcla
	Dimension datos[n], temporal[n]
	Para i <- 1 Hasta n Hacer
		datos[i] <- Aleatorio(1, 99)
	FinPara
	MostrarDatos("Antes:   ", datos, n)
	OrdenarPorMezcla(datos, temporal, 1, n)
	MostrarDatos("Después: ", datos, n)
FinAlgoritmo
`,
  },
  {
    id: "quicksort",
    label: "Ordenamiento rápido (Quicksort)",
    description: "Pick a pivot, split into smaller and larger, and sort each side recursively.",
    topic: "sorting",
    level: 3,
    concepts: ["io", "arreglos", "subprocesos", "funciones", "recursion", "repetir", "si", "azar"],
    input: "12",
    complexity: { best: "O(n log n)", average: "O(n log n)", worst: "O(n²)", space: "O(log n)", stable: false, inPlace: true },
    source: `${SHOW_ARRAY}
// Partición de Hoare: deja a la izquierda los valores <= pivote y a la derecha
// los >= pivote, y devuelve dónde termina la parte izquierda.
Funcion corte <- Particionar(datos, izquierda, derecha)
	Definir corte, pivote, i, j, aux Como Entero
	// Usamos el elemento del medio como pivote
	pivote <- datos[Trunc((izquierda + derecha) / 2)]
	i <- izquierda - 1
	j <- derecha + 1
	Repetir
		// i avanza hasta encontrar uno que no debería estar a la izquierda
		Repetir
			i <- i + 1
		Hasta Que datos[i] >= pivote
		// j retrocede hasta encontrar uno que no debería estar a la derecha
		Repetir
			j <- j - 1
		Hasta Que datos[j] <= pivote
		// Si no se cruzaron, los intercambiamos y seguimos
		Si i < j Entonces
			aux <- datos[i]
			datos[i] <- datos[j]
			datos[j] <- aux
		FinSi
	Hasta Que i >= j
	corte <- j
FinFuncion

SubProceso OrdenarRapido(datos, izquierda, derecha)
	Definir corte Como Entero
	Si izquierda < derecha Entonces
		corte <- Particionar(datos, izquierda, derecha)
		// Cada lado se ordena por separado, con la misma idea
		OrdenarRapido(datos, izquierda, corte)
		OrdenarRapido(datos, corte + 1, derecha)
	FinSi
FinSubProceso

Algoritmo Quicksort
	Definir datos, n, i Como Entero
	Escribir "¿Cuántos números quieres ordenar? (1 a 512)"
	Leer n
	Dimension datos[n]
	Para i <- 1 Hasta n Hacer
		datos[i] <- Aleatorio(1, 99)
	FinPara
	MostrarDatos("Antes:   ", datos, n)
	OrdenarRapido(datos, 1, n)
	MostrarDatos("Después: ", datos, n)
FinAlgoritmo
`,
  },
  {
    id: "heap-sort",
    label: "Ordenamiento por montículo",
    description: "Arrange the array as a heap, then take the largest out again and again.",
    topic: "sorting",
    level: 3,
    concepts: ["io", "arreglos", "subprocesos", "mientras", "para", "si", "logicos", "azar"],
    input: "12",
    complexity: { best: "O(n log n)", average: "O(n log n)", worst: "O(n log n)", space: "O(1)", stable: false, inPlace: true },
    source: `${SHOW_ARRAY}
// En un montículo, el padre de la posición k está en Trunc(k / 2)
// y sus hijos en 2k y 2k + 1. Cada padre es mayor o igual que sus hijos.
// Hundir baja el valor de la posición raiz hasta que vuelve a cumplirse.
SubProceso Hundir(datos, raiz, tamanio)
	Definir actual, hijo, aux Como Entero
	Definir listo Como Logico
	actual <- raiz
	listo <- Falso
	Mientras (NO listo) Y 2 * actual <= tamanio Hacer
		// Elegimos el mayor de los dos hijos
		hijo <- 2 * actual
		Si hijo + 1 <= tamanio Entonces
			Si datos[hijo + 1] > datos[hijo] Entonces
				hijo <- hijo + 1
			FinSi
		FinSi
		Si datos[hijo] > datos[actual] Entonces
			aux <- datos[actual]
			datos[actual] <- datos[hijo]
			datos[hijo] <- aux
			actual <- hijo
		SiNo
			listo <- Verdadero
		FinSi
	FinMientras
FinSubProceso

Algoritmo OrdenamientoMonticulo
	Definir datos, n, i, ultimo, aux Como Entero
	Escribir "¿Cuántos números quieres ordenar? (1 a 512)"
	Leer n
	Dimension datos[n]
	Para i <- 1 Hasta n Hacer
		datos[i] <- Aleatorio(1, 99)
	FinPara
	MostrarDatos("Antes:   ", datos, n)
	// 1) Armamos el montículo, desde el último padre hasta la raíz
	Para i <- Trunc(n / 2) Hasta 1 Con Paso -1 Hacer
		Hundir(datos, i, n)
	FinPara
	// 2) El mayor está en la raíz: lo llevamos al final y reparamos el resto
	Para ultimo <- n Hasta 2 Con Paso -1 Hacer
		aux <- datos[1]
		datos[1] <- datos[ultimo]
		datos[ultimo] <- aux
		Hundir(datos, 1, ultimo - 1)
	FinPara
	MostrarDatos("Después: ", datos, n)
FinAlgoritmo
`,
  },
  {
    id: "counting-sort",
    label: "Ordenamiento por conteo",
    description: "Count how many times each value appears, without comparing numbers.",
    topic: "sorting",
    level: 2,
    concepts: ["io", "arreglos", "para", "azar", "subprocesos"],
    input: "20",
    complexity: { best: "O(n + k)", average: "O(n + k)", worst: "O(n + k)", space: "O(k)", inPlace: false },
    source: `${SHOW_ARRAY}
Algoritmo OrdenamientoConteo
	Definir datos, conteo, n, i, valor, veces, k Como Entero
	Escribir "¿Cuántos números quieres ordenar? (1 a 512)"
	Leer n
	Dimension datos[n]
	Para i <- 1 Hasta n Hacer
		datos[i] <- Aleatorio(1, 99)
	FinPara
	MostrarDatos("Antes:   ", datos, n)
	// Una casilla por cada valor posible (1 a 99): eso es la k de O(n + k)
	Dimension conteo[99]
	Para valor <- 1 Hasta 99 Hacer
		conteo[valor] <- 0
	FinPara
	// Contamos cuántas veces aparece cada valor
	Para i <- 1 Hasta n Hacer
		conteo[datos[i]] <- conteo[datos[i]] + 1
	FinPara
	// Reescribimos el arreglo: cada valor tantas veces como apareció
	k <- 0
	Para valor <- 1 Hasta 99 Hacer
		// "Con Paso 1": si un valor no apareció, este Para no se ejecuta
		Para veces <- 1 Hasta conteo[valor] Con Paso 1 Hacer
			k <- k + 1
			datos[k] <- valor
		FinPara
	FinPara
	MostrarDatos("Después: ", datos, n)
FinAlgoritmo
`,
  },
  {
    id: "binary-search",
    label: "Búsqueda binaria",
    description: "Find a value in a sorted array by halving the range each step.",
    topic: "sorting",
    level: 2,
    concepts: ["io", "arreglos", "mientras", "si", "azar", "subprocesos"],
    input: "20",
    complexity: { best: "O(1)", average: "O(log n)", worst: "O(log n)", space: "O(1)" },
    source: `${SHOW_ARRAY}
Algoritmo BusquedaBinaria
	Definir datos, n, i, buscado, izquierda, derecha, medio, posicion, pasos Como Entero
	Escribir "¿Cuántos números tiene la lista? (1 a 512)"
	Leer n
	// La búsqueda binaria necesita datos ordenados: usamos los pares 2, 4, 6...
	Dimension datos[n]
	Para i <- 1 Hasta n Hacer
		datos[i] <- 2 * i
	FinPara
	MostrarDatos("Lista: ", datos, n)
	// Un número al azar entre 1 y 2n: si es impar, no estará en la lista
	buscado <- Aleatorio(1, 2 * n)
	Escribir "Buscando el ", buscado
	izquierda <- 1
	derecha <- n
	posicion <- 0
	pasos <- 0
	Mientras izquierda <= derecha Y posicion = 0 Hacer
		medio <- Trunc((izquierda + derecha) / 2)
		pasos <- pasos + 1
		Escribir "  Paso ", pasos, ": miro la posición ", medio, " (", datos[medio], ")"
		Si datos[medio] = buscado Entonces
			posicion <- medio
		SiNo
			// Descartamos la mitad donde seguro no está
			Si datos[medio] < buscado Entonces
				izquierda <- medio + 1
			SiNo
				derecha <- medio - 1
			FinSi
		FinSi
	FinMientras
	Si posicion > 0 Entonces
		Escribir "Encontrado: el ", buscado, " está en la posición ", posicion, "."
	SiNo
		Escribir "El ", buscado, " no está en la lista."
	FinSi
	Escribir "Comparaciones: ", pasos, " de ", n, " elementos."
FinAlgoritmo
`,
  },
  {
    id: "search-comparison",
    label: "Búsqueda lineal contra binaria",
    description: "Count the comparisons each search needs on the same sorted list.",
    topic: "sorting",
    level: 2,
    concepts: ["io", "arreglos", "funciones", "mientras", "para", "si", "azar", "subprocesos"],
    input: "100",
    complexity: { best: "O(1)", average: "O(n)", worst: "O(n)", space: "O(1)" },
    source: `${SHOW_ARRAY}
// Revisa los elementos uno por uno; devuelve cuántas comparaciones hizo
Funcion comparaciones <- BuscarLineal(datos, n, buscado)
	Definir comparaciones, i Como Entero
	Definir encontrado Como Logico
	comparaciones <- 0
	encontrado <- Falso
	i <- 1
	Mientras i <= n Y (NO encontrado) Hacer
		comparaciones <- comparaciones + 1
		Si datos[i] = buscado Entonces
			encontrado <- Verdadero
		FinSi
		i <- i + 1
	FinMientras
FinFuncion

// Parte el rango a la mitad en cada paso; devuelve cuántas comparaciones hizo
Funcion comparaciones <- BuscarBinaria(datos, n, buscado)
	Definir comparaciones, izquierda, derecha, medio Como Entero
	Definir encontrado Como Logico
	comparaciones <- 0
	encontrado <- Falso
	izquierda <- 1
	derecha <- n
	Mientras izquierda <= derecha Y (NO encontrado) Hacer
		medio <- Trunc((izquierda + derecha) / 2)
		comparaciones <- comparaciones + 1
		Si datos[medio] = buscado Entonces
			encontrado <- Verdadero
		SiNo
			Si datos[medio] < buscado Entonces
				izquierda <- medio + 1
			SiNo
				derecha <- medio - 1
			FinSi
		FinSi
	FinMientras
FinFuncion

Algoritmo CompararBusquedas
	Definir datos, objetivos, n, i, mitades, resto Como Entero
	Escribir "¿Cuántos números tiene la lista? (1 a 512)"
	Leer n
	Dimension datos[n], objetivos[4]
	Para i <- 1 Hasta n Hacer
		datos[i] <- 2 * i
	FinPara
	MostrarDatos("Lista: ", datos, n)
	// Cuatro casos: el primero, uno al azar, el último y uno que no está (impar)
	objetivos[1] <- datos[1]
	objetivos[2] <- datos[Aleatorio(1, n)]
	objetivos[3] <- datos[n]
	objetivos[4] <- 2 * Aleatorio(1, n) - 1
	Para i <- 1 Hasta 4 Hacer
		Escribir "Buscar el ", objetivos[i], " -> comparaciones: lineal ", BuscarLineal(datos, n, objetivos[i]), ", binaria ", BuscarBinaria(datos, n, objetivos[i])
	FinPara
	// Cuántas veces se puede partir n a la mitad: el peor caso de la binaria
	mitades <- 0
	resto <- n
	Mientras resto > 0 Hacer
		mitades <- mitades + 1
		resto <- Trunc(resto / 2)
	FinMientras
	Escribir "Peor caso con ", n, " elementos: lineal ", n, ", binaria ", mitades, "."
FinAlgoritmo
`,
  },

  /* ---------------- Texto ---------------- */
  {
    id: "palindrome",
    label: "Palíndromos",
    description: "Reverse a phrase and compare, ignoring spaces.",
    topic: "text",
    level: 2,
    concepts: ["io", "texto", "para", "si"],
    input: "Anita lava la tina",
    source: `Algoritmo Palindromo
	Definir frase, limpia, invertida, letra Como Caracter
	Definir i Como Entero
	Escribir "Escribe una palabra o frase:"
	Leer frase
	// Quitamos los espacios y pasamos todo a minúsculas
	limpia <- ""
	Para i <- 1 Hasta Longitud(frase) Hacer
		letra <- Minusculas(Subcadena(frase, i, i))
		Si letra <> " " Entonces
			limpia <- limpia + letra
		FinSi
	FinPara
	invertida <- ""
	Para i <- Longitud(limpia) Hasta 1 Con Paso -1 Hacer
		invertida <- invertida + Subcadena(limpia, i, i)
	FinPara
	Si limpia = invertida Entonces
		Escribir 'Sí, "', frase, '" es un palíndromo.'
	SiNo
		Escribir 'No es un palíndromo: al revés se lee "', invertida, '".'
	FinSi
FinAlgoritmo
`,
  },
  {
    id: "count-vowels",
    label: "Contar vocales",
    description: "Classify every character of a text with Segun.",
    topic: "text",
    level: 2,
    concepts: ["io", "texto", "segun", "para"],
    input: "Programar es pensar",
    source: `Algoritmo ContarVocales
	Definir texto, letra Como Caracter
	Definir i, vocales, espacios, otros Como Entero
	Escribir "Escribe un texto:"
	Leer texto
	vocales <- 0
	espacios <- 0
	otros <- 0
	Para i <- 1 Hasta Longitud(texto) Hacer
		letra <- Minusculas(Subcadena(texto, i, i))
		Segun letra Hacer
			"a", "e", "i", "o", "u":
				vocales <- vocales + 1
			" ":
				espacios <- espacios + 1
			De Otro Modo:
				otros <- otros + 1
		FinSegun
	FinPara
	Escribir "Vocales: ", vocales
	Escribir "Espacios: ", espacios
	Escribir "Otros caracteres: ", otros
FinAlgoritmo
`,
  },
  {
    id: "initials",
    label: "Iniciales de un nombre",
    description: "Find where each word starts.",
    topic: "text",
    level: 1,
    concepts: ["io", "texto", "para", "logicos"],
    input: "maría josé pérez",
    source: `Algoritmo Iniciales
	Definir nombre, iniciales, letra, anterior Como Caracter
	Definir i Como Entero
	Escribir "Tu nombre completo:"
	Leer nombre
	iniciales <- ""
	anterior <- " "
	Para i <- 1 Hasta Longitud(nombre) Hacer
		letra <- Subcadena(nombre, i, i)
		// Una palabra empieza donde antes había un espacio
		Si anterior = " " Y letra <> " " Entonces
			iniciales <- iniciales + Mayusculas(letra) + "."
		FinSi
		anterior <- letra
	FinPara
	Escribir "Tus iniciales son: ", iniciales
FinAlgoritmo
`,
  },
  {
    id: "caesar-cipher",
    label: "Cifrado César",
    description: "Encrypt a message by shifting the alphabet.",
    topic: "text",
    level: 3,
    concepts: ["io", "texto", "para", "matematicas"],
    input: "nos vemos a las ocho\n3",
    source: `Algoritmo CifradoCesar
	Definir abecedario, mensaje, cifrado, letra Como Caracter
	Definir desplazamiento, i, j, posicion, nueva Como Entero
	abecedario <- "abcdefghijklmnopqrstuvwxyz"
	Escribir "Mensaje a cifrar:"
	Leer mensaje
	Escribir "Desplazamiento (1 a 25):"
	Leer desplazamiento
	cifrado <- ""
	Para i <- 1 Hasta Longitud(mensaje) Hacer
		letra <- Minusculas(Subcadena(mensaje, i, i))
		// Buscamos la letra en el abecedario
		posicion <- 0
		Para j <- 1 Hasta 26 Hacer
			Si Subcadena(abecedario, j, j) = letra Entonces
				posicion <- j
			FinSi
		FinPara
		Si posicion = 0 Entonces
			cifrado <- cifrado + letra
		SiNo
			// MOD hace que después de la z vuelva a empezar en la a
			nueva <- (posicion - 1 + desplazamiento) MOD 26 + 1
			cifrado <- cifrado + Subcadena(abecedario, nueva, nueva)
		FinSi
	FinPara
	Escribir "Mensaje cifrado: ", cifrado
FinAlgoritmo
`,
  },
  {
    id: "text-format",
    label: "Formato de datos",
    description: "Capitalize, convert between text and numbers, and join strings.",
    topic: "text",
    level: 2,
    concepts: ["io", "texto"],
    input: "lUCÍA\ngómez\n15",
    source: `Algoritmo FormatoDeDatos
	Definir nombre, apellido, nombreBonito, edadTexto Como Caracter
	Definir edad Como Entero
	Escribir "Nombre:"
	Leer nombre
	Escribir "Apellido:"
	Leer apellido
	Escribir "Edad:"
	Leer edadTexto
	// Primera letra en mayúscula y el resto en minúscula
	nombreBonito <- Concatenar(Mayusculas(Subcadena(nombre, 1, 1)), Minusculas(Subcadena(nombre, 2, Longitud(nombre))))
	edad <- ConvertirANumero(edadTexto)
	Escribir "Ficha: ", nombreBonito, " ", Mayusculas(apellido)
	Escribir "Dentro de 10 años tendrá " + ConvertirATexto(edad + 10) + " años."
	Escribir "Letras en el nombre completo: ", Longitud(nombreBonito) + Longitud(apellido)
FinAlgoritmo
`,
  },

  /* ---------------- Subprocesos y funciones ---------------- */
  {
    id: "factorial-power",
    label: "Factorial y potencia",
    description: "Functions that return a value.",
    topic: "routines",
    level: 2,
    concepts: ["io", "funciones", "para"],
    input: "6",
    source: `Funcion resultado <- Factorial(n)
	Definir resultado, i Como Entero
	resultado <- 1
	Para i <- 2 Hasta n Hacer
		resultado <- resultado * i
	FinPara
FinFuncion

Funcion resultado <- Potencia(base, exponente)
	Definir resultado Como Real
	Definir i Como Entero
	resultado <- 1
	Para i <- 1 Hasta exponente Hacer
		resultado <- resultado * base
	FinPara
FinFuncion

Algoritmo FactorialYPotencia
	Definir n Como Entero
	Escribir "Escribe un número:"
	Leer n
	Escribir n, "! = ", Factorial(n)
	Escribir "2 elevado a ", n, " = ", Potencia(2, n)
	Escribir "Comprobación con el operador ^: ", 2 ^ n
FinAlgoritmo
`,
  },
  {
    id: "references",
    label: "Por Referencia y por valor",
    description: "Sort three numbers by swapping them through references.",
    topic: "routines",
    level: 2,
    concepts: ["io", "subprocesos", "referencia", "si"],
    input: "9\n2\n5",
    source: `SubProceso Intercambiar(a Por Referencia, b Por Referencia)
	Definir temporal Como Real
	temporal <- a
	a <- b
	b <- temporal
FinSubProceso

SubProceso OrdenarTres(n1 Por Referencia, n2 Por Referencia, n3 Por Referencia)
	Si n1 > n2 Entonces
		Intercambiar(n1, n2)
	FinSi
	Si n2 > n3 Entonces
		Intercambiar(n2, n3)
	FinSi
	Si n1 > n2 Entonces
		Intercambiar(n1, n2)
	FinSi
FinSubProceso

SubProceso IntentarCambiar(n Por Valor)
	// Solo cambia la copia local
	n <- 0
FinSubProceso

Algoritmo PorReferencia
	Definir a, b, c Como Real
	Escribir "Escribe tres números:"
	Leer a, b, c
	OrdenarTres(a, b, c)
	Escribir "Ordenados: ", a, " ", b, " ", c
	IntentarCambiar(a)
	Escribir "Por valor, a sigue valiendo ", a
FinAlgoritmo
`,
  },
  {
    id: "validation",
    label: "Validaciones reutilizables",
    description: "Functions that return Logico to validate a sign-up form.",
    topic: "routines",
    level: 2,
    concepts: ["io", "funciones", "logicos", "repetir", "texto"],
    input: "ana.gmail.com\nana@gmail.com\n150\n17",
    source: `Funcion valido <- EsCorreoValido(correo)
	Definir valido Como Logico
	Definir i, arrobas, posicionArroba Como Entero
	arrobas <- 0
	posicionArroba <- 0
	Para i <- 1 Hasta Longitud(correo) Hacer
		Si Subcadena(correo, i, i) = "@" Entonces
			arrobas <- arrobas + 1
			posicionArroba <- i
		FinSi
	FinPara
	valido <- arrobas = 1 Y posicionArroba > 1 Y posicionArroba < Longitud(correo)
FinFuncion

Funcion valido <- EsEdadValida(edad)
	Definir valido Como Logico
	valido <- edad >= 0 Y edad <= 120
FinFuncion

Algoritmo Registro
	Definir correo Como Caracter
	Definir edad Como Entero
	Repetir
		Escribir "Correo electrónico:"
		Leer correo
		Si NO EsCorreoValido(correo) Entonces
			Escribir "Ese correo no parece válido."
		FinSi
	Hasta Que EsCorreoValido(correo)
	Repetir
		Escribir "Edad:"
		Leer edad
		Si NO EsEdadValida(edad) Entonces
			Escribir "Escribe una edad entre 0 y 120."
		FinSi
	Hasta Que EsEdadValida(edad)
	Escribir "Registro completo: ", correo, ", ", edad, " años."
FinAlgoritmo
`,
  },
  {
    id: "modular-menu",
    label: "Menú modular",
    description: "Split a program into subprocesses and repeat a menu.",
    topic: "routines",
    level: 2,
    concepts: ["io", "subprocesos", "segun", "repetir"],
    input: "1\n10\n2\n5\n7\n3",
    source: `SubProceso MostrarMenu
	Escribir ""
	Escribir "1. Kilómetros a millas"
	Escribir "2. Litros a galones"
	Escribir "3. Salir"
	Escribir "Elige una opción:"
FinSubProceso

SubProceso KilometrosAMillas
	Definir km Como Real
	Escribir "Kilómetros:"
	Leer km
	Escribir km, " km = ", Redon(km * 0.621371 * 100) / 100, " millas"
FinSubProceso

SubProceso LitrosAGalones
	Definir litros Como Real
	Escribir "Litros:"
	Leer litros
	Escribir litros, " L = ", Redon(litros * 0.264172 * 100) / 100, " galones"
FinSubProceso

Algoritmo MenuModular
	Definir opcion Como Entero
	Repetir
		MostrarMenu
		Leer opcion
		Segun opcion Hacer
			1:
				KilometrosAMillas
			2:
				LitrosAGalones
			3:
				Escribir "¡Hasta luego!"
			De Otro Modo:
				Escribir "Esa opción no existe."
		FinSegun
	Mientras Que opcion <> 3
FinAlgoritmo
`,
  },
  {
    id: "hanoi",
    label: "Torres de Hanói",
    description: "A subprocess that calls itself: recursion.",
    topic: "routines",
    level: 3,
    concepts: ["io", "subprocesos", "recursion", "si"],
    input: "3",
    complexity: { best: "O(2ⁿ)", average: "O(2ⁿ)", worst: "O(2ⁿ)", space: "O(n)" },
    source: `SubProceso Hanoi(discos, origen, destino, auxiliar)
	Si discos = 1 Entonces
		Escribir "Mover disco 1 de ", origen, " a ", destino
	SiNo
		// Primero apartamos los discos de arriba, luego volvemos a apilarlos
		Hanoi(discos - 1, origen, auxiliar, destino)
		Escribir "Mover disco ", discos, " de ", origen, " a ", destino
		Hanoi(discos - 1, auxiliar, destino, origen)
	FinSi
FinSubProceso

Algoritmo TorresDeHanoi
	Definir n Como Entero
	Escribir "¿Cuántos discos? (1 a 6)"
	Leer n
	Hanoi(n, "A", "C", "B")
	Escribir "Total de movimientos: ", 2 ^ n - 1
FinAlgoritmo
`,
  },

  /* ---------------- Matemáticas ---------------- */
  {
    id: "primes",
    label: "Números primos",
    description: "A function that decides whether a number is prime.",
    topic: "math",
    level: 2,
    concepts: ["io", "funciones", "mientras", "para", "matematicas"],
    input: "50",
    complexity: { best: "O(n√n)", average: "O(n√n)", worst: "O(n√n)", space: "O(1)" },
    source: `Funcion primo <- EsPrimo(n)
	Definir primo Como Logico
	Definir divisor Como Entero
	primo <- n > 1
	divisor <- 2
	// Basta con probar divisores hasta la raíz cuadrada de n
	Mientras primo Y divisor * divisor <= n Hacer
		Si n MOD divisor = 0 Entonces
			primo <- Falso
		FinSi
		divisor <- divisor + 1
	FinMientras
FinFuncion

Algoritmo NumerosPrimos
	Definir limite, n, contador Como Entero
	Escribir "¿Hasta qué número busco primos?"
	Leer limite
	contador <- 0
	Escribir "Primos hasta ", limite, ":"
	Para n <- 2 Hasta limite Hacer
		Si EsPrimo(n) Entonces
			Escribir Sin Saltar n, " "
			contador <- contador + 1
		FinSi
	FinPara
	Escribir ""
	Escribir "Encontré ", contador, " números primos."
FinAlgoritmo
`,
  },
  {
    id: "gcd-lcm",
    label: "MCD y MCM",
    description: "Euclid's algorithm for the greatest common divisor.",
    topic: "math",
    level: 2,
    concepts: ["io", "funciones", "mientras", "matematicas"],
    input: "12\n18",
    complexity: { best: "O(1)", average: "O(log n)", worst: "O(log n)", space: "O(1)" },
    source: `Funcion resultado <- MCD(a, b)
	Definir resultado, resto Como Entero
	// Algoritmo de Euclides
	Mientras b <> 0 Hacer
		resto <- a MOD b
		a <- b
		b <- resto
	FinMientras
	resultado <- a
FinFuncion

Algoritmo MCDyMCM
	Definir a, b, divisor Como Entero
	Escribir "Primer número:"
	Leer a
	Escribir "Segundo número:"
	Leer b
	Si a <= 0 O b <= 0 Entonces
		Escribir "Usa números enteros positivos."
	SiNo
		divisor <- MCD(a, b)
		Escribir "MCD(", a, ", ", b, ") = ", divisor
		Escribir "MCM(", a, ", ", b, ") = ", Trunc(a * b / divisor)
	FinSi
FinAlgoritmo
`,
  },
  {
    id: "fibonacci",
    label: "Sucesión de Fibonacci",
    description: "Each term is the sum of the previous two.",
    topic: "math",
    level: 1,
    concepts: ["io", "para", "matematicas"],
    input: "15",
    complexity: { best: "O(n)", average: "O(n)", worst: "O(n)", space: "O(1)" },
    source: `Algoritmo Fibonacci
	Definir n, i, a, b, siguiente Como Entero
	Escribir "¿Cuántos términos?"
	Leer n
	a <- 0
	b <- 1
	Escribir Sin Saltar "Primeros ", n, " términos: "
	Para i <- 1 Hasta n Hacer
		Escribir Sin Saltar a, " "
		siguiente <- a + b
		a <- b
		b <- siguiente
	FinPara
	Escribir ""
	// a y b son ahora los dos términos que siguen al último mostrado;
	// su razón se acerca al número de oro (1.618...)
	Si a > 0 Entonces
		Escribir "Razón entre los dos términos siguientes: ", b / a
	FinSi
FinAlgoritmo
`,
  },
  {
    id: "quadratic",
    label: "Ecuación cuadrática",
    description: "Solve ax² + bx + c = 0 for real or complex roots.",
    topic: "math",
    level: 2,
    concepts: ["io", "si", "matematicas"],
    input: "1\n-3\n2",
    source: `Algoritmo EcuacionCuadratica
	Definir a, b, c, discriminante, x1, x2 Como Real
	Escribir "Coeficientes de ax² + bx + c = 0"
	Escribir "a:"
	Leer a
	Escribir "b:"
	Leer b
	Escribir "c:"
	Leer c
	Si a = 0 Entonces
		Escribir "Con a = 0 no es una ecuación cuadrática."
	SiNo
		discriminante <- b ^ 2 - 4 * a * c
		Si discriminante > 0 Entonces
			x1 <- (-b + Raiz(discriminante)) / (2 * a)
			x2 <- (-b - Raiz(discriminante)) / (2 * a)
			Escribir "Dos raíces reales: x1 = ", x1, ", x2 = ", x2
		SiNo
			Si discriminante = 0 Entonces
				Escribir "Una raíz doble: x = ", -b / (2 * a)
			SiNo
				Escribir "Raíces complejas: ", -b / (2 * a), " ± ", Raiz(-discriminante) / (2 * a), "i"
			FinSi
		FinSi
	FinSi
FinAlgoritmo
`,
  },
  {
    id: "roman-numerals",
    label: "Números romanos",
    description: "Convert using a table of values and symbols.",
    topic: "math",
    level: 3,
    concepts: ["io", "arreglos", "para", "mientras", "texto"],
    input: "2024",
    source: `Algoritmo NumerosRomanos
	Definir valores, numero, resto, i Como Entero
	Definir simbolos, romano Como Caracter
	Dimension valores[13], simbolos[13]
	valores[1] <- 1000
	simbolos[1] <- "M"
	valores[2] <- 900
	simbolos[2] <- "CM"
	valores[3] <- 500
	simbolos[3] <- "D"
	valores[4] <- 400
	simbolos[4] <- "CD"
	valores[5] <- 100
	simbolos[5] <- "C"
	valores[6] <- 90
	simbolos[6] <- "XC"
	valores[7] <- 50
	simbolos[7] <- "L"
	valores[8] <- 40
	simbolos[8] <- "XL"
	valores[9] <- 10
	simbolos[9] <- "X"
	valores[10] <- 9
	simbolos[10] <- "IX"
	valores[11] <- 5
	simbolos[11] <- "V"
	valores[12] <- 4
	simbolos[12] <- "IV"
	valores[13] <- 1
	simbolos[13] <- "I"
	Escribir "Número entre 1 y 3999:"
	Leer numero
	Si numero < 1 O numero > 3999 Entonces
		Escribir "Los romanos no escribían ese número."
	SiNo
		romano <- ""
		resto <- numero
		// Restamos el mayor valor posible tantas veces como entre
		Para i <- 1 Hasta 13 Hacer
			Mientras resto >= valores[i] Hacer
				romano <- romano + simbolos[i]
				resto <- resto - valores[i]
			FinMientras
		FinPara
		Escribir numero, " en números romanos es ", romano
	FinSi
FinAlgoritmo
`,
  },
  {
    id: "base-conversion",
    label: "Conversión de bases",
    description: "Write a number in binary and hexadecimal.",
    topic: "math",
    level: 3,
    concepts: ["io", "mientras", "texto", "matematicas"],
    input: "2024",
    source: `Algoritmo ConversionBases
	Definir numero, cociente, resto Como Entero
	Definir binario, hexadecimal, digitos Como Caracter
	digitos <- "0123456789ABCDEF"
	Escribir "Número entero positivo:"
	Leer numero
	// Divisiones sucesivas: los restos, leídos al revés, forman el número
	binario <- ""
	cociente <- numero
	Mientras cociente > 0 Hacer
		binario <- ConvertirATexto(cociente MOD 2) + binario
		cociente <- Trunc(cociente / 2)
	FinMientras
	hexadecimal <- ""
	cociente <- numero
	Mientras cociente > 0 Hacer
		resto <- cociente MOD 16
		hexadecimal <- Subcadena(digitos, resto + 1, resto + 1) + hexadecimal
		cociente <- Trunc(cociente / 16)
	FinMientras
	Si numero = 0 Entonces
		binario <- "0"
		hexadecimal <- "0"
	FinSi
	Escribir numero, " en binario: ", binario
	Escribir numero, " en hexadecimal: ", hexadecimal
FinAlgoritmo
`,
  },
  {
    id: "geometry",
    label: "Geometría",
    description: "Circles and right triangles with PI, RC and trigonometry.",
    topic: "math",
    level: 2,
    concepts: ["io", "matematicas"],
    input: "3\n3\n4",
    source: `Algoritmo Geometria
	Definir radio, cateto1, cateto2, hipotenusa, angulo Como Real
	Escribir "Radio del círculo:"
	Leer radio
	Escribir "Área: ", Redon(PI * radio ^ 2 * 100) / 100
	Escribir "Perímetro: ", Redon(2 * PI * radio * 100) / 100
	Escribir "Catetos de un triángulo rectángulo:"
	Leer cateto1, cateto2
	hipotenusa <- RC(cateto1 ^ 2 + cateto2 ^ 2)
	// ATan devuelve radianes; los pasamos a grados
	angulo <- ATan(cateto1 / cateto2) * 180 / PI
	Escribir "Hipotenusa: ", hipotenusa
	Escribir "Ángulo opuesto al primer cateto: ", Redon(angulo), " grados"
	Escribir "Comprobación sen² + cos² = ", Sen(angulo * PI / 180) ^ 2 + Cos(angulo * PI / 180) ^ 2
FinAlgoritmo
`,
  },
  {
    id: "compound-interest",
    label: "Interés compuesto",
    description: "Watch savings grow year by year, with Ln and Exp.",
    topic: "math",
    level: 2,
    concepts: ["io", "para", "matematicas"],
    input: "10000\n8\n5",
    source: `Algoritmo InteresCompuesto
	Definir capital, tasa, monto Como Real
	Definir anios, i Como Entero
	Escribir "Capital inicial:"
	Leer capital
	Escribir "Interés anual (%):"
	Leer tasa
	Escribir "Años:"
	Leer anios
	monto <- capital
	Para i <- 1 Hasta anios Hacer
		monto <- monto * (1 + tasa / 100)
		Escribir "Año ", i, ": $", Redon(monto * 100) / 100
	FinPara
	Escribir "Ganancia total: $", Redon((monto - capital) * 100) / 100
	Si tasa > 0 Entonces
		Escribir "Años para duplicar el capital: ", Redon(Ln(2) / Ln(1 + tasa / 100) * 10) / 10
	FinSi
	Escribir "Con interés continuo serían: $", Redon(capital * Exp(tasa / 100 * anios) * 100) / 100
FinAlgoritmo
`,
  },

  /* ---------------- Proyectos ---------------- */
  {
    id: "tic-tac-toe",
    label: "Ta-Te-Ti",
    description: "A two-player game on a 3x3 board.",
    topic: "projects",
    level: 3,
    concepts: ["io", "matrices", "subprocesos", "funciones", "repetir", "mientras", "logicos"],
    input: "1\n1\n2\n1\n1\n2\n2\n2\n1\n3",
    source: `SubProceso DibujarTablero(tablero)
	Definir fila Como Entero
	Escribir ""
	Para fila <- 1 Hasta 3 Hacer
		Escribir " ", tablero[fila, 1], " | ", tablero[fila, 2], " | ", tablero[fila, 3]
		Si fila < 3 Entonces
			Escribir "---+---+---"
		FinSi
	FinPara
FinSubProceso

Funcion gano <- HayTresEnLinea(tablero, jugador)
	Definir gano Como Logico
	Definir i Como Entero
	gano <- Falso
	Para i <- 1 Hasta 3 Hacer
		Si tablero[i, 1] = jugador Y tablero[i, 2] = jugador Y tablero[i, 3] = jugador Entonces
			gano <- Verdadero
		FinSi
		Si tablero[1, i] = jugador Y tablero[2, i] = jugador Y tablero[3, i] = jugador Entonces
			gano <- Verdadero
		FinSi
	FinPara
	Si tablero[1, 1] = jugador Y tablero[2, 2] = jugador Y tablero[3, 3] = jugador Entonces
		gano <- Verdadero
	FinSi
	Si tablero[1, 3] = jugador Y tablero[2, 2] = jugador Y tablero[3, 1] = jugador Entonces
		gano <- Verdadero
	FinSi
FinFuncion

Algoritmo TaTeTi
	Definir tablero, jugador, ganador Como Caracter
	Definir fila, columna, jugadas, i, j Como Entero
	Definir valida Como Logico
	Dimension tablero[3, 3]
	Para i <- 1 Hasta 3 Hacer
		Para j <- 1 Hasta 3 Hacer
			tablero[i, j] <- " "
		FinPara
	FinPara
	jugador <- "X"
	ganador <- ""
	jugadas <- 0
	Mientras ganador = "" Y jugadas < 9 Hacer
		DibujarTablero(tablero)
		Repetir
			Escribir "Turno de ", jugador, ". Fila (1 a 3):"
			Leer fila
			Escribir "Columna (1 a 3):"
			Leer columna
			valida <- fila >= 1 Y fila <= 3 Y columna >= 1 Y columna <= 3
			Si valida Entonces
				Si tablero[fila, columna] <> " " Entonces
					valida <- Falso
				FinSi
			FinSi
			Si NO valida Entonces
				Escribir "Esa casilla no está disponible."
			FinSi
		Hasta Que valida
		tablero[fila, columna] <- jugador
		jugadas <- jugadas + 1
		Si HayTresEnLinea(tablero, jugador) Entonces
			ganador <- jugador
		FinSi
		Si jugador = "X" Entonces
			jugador <- "O"
		SiNo
			jugador <- "X"
		FinSi
	FinMientras
	DibujarTablero(tablero)
	Si ganador = "" Entonces
		Escribir "¡Empate!"
	SiNo
		Escribir "¡Ganó ", ganador, "!"
	FinSi
FinAlgoritmo
`,
  },
  {
    id: "atm",
    label: "Cajero automático",
    description: "A PIN check plus a menu that updates a balance.",
    topic: "projects",
    level: 3,
    concepts: ["io", "repetir", "segun", "si", "logicos"],
    input: "1111\n1234\n1\n2\n1500\n3\n2250\n3\n2000\n1\n4",
    source: `Algoritmo CajeroAutomatico
	Definir saldo Como Real
	Definir opcion, intentos, monto Como Entero
	Definir pin Como Caracter
	Definir acceso Como Logico
	saldo <- 5000
	intentos <- 0
	acceso <- Falso
	Repetir
		Escribir "Ingrese su PIN:"
		Leer pin
		intentos <- intentos + 1
		Si pin = "1234" Entonces
			acceso <- Verdadero
		SiNo
			Si intentos < 3 Entonces
				Escribir "PIN incorrecto. Le quedan ", 3 - intentos, " intentos."
			FinSi
		FinSi
	Hasta Que acceso O intentos = 3
	Si NO acceso Entonces
		Escribir "Tarjeta bloqueada. Comuníquese con su banco."
	SiNo
		Repetir
			Escribir ""
			Escribir "1. Consultar saldo   2. Depositar   3. Retirar   4. Salir"
			Leer opcion
			Segun opcion Hacer
				1:
					Escribir "Saldo disponible: $", saldo
				2:
					Escribir "Monto a depositar:"
					Leer monto
					Si monto > 0 Entonces
						saldo <- saldo + monto
						Escribir "Depósito realizado. Nuevo saldo: $", saldo
					SiNo
						Escribir "El monto debe ser positivo."
					FinSi
				3:
					Escribir "Monto a retirar (múltiplos de 100):"
					Leer monto
					Si monto MOD 100 <> 0 Entonces
						Escribir "El cajero solo entrega billetes de 100."
					SiNo
						Si monto > saldo Entonces
							Escribir "Fondos insuficientes."
						SiNo
							saldo <- saldo - monto
							Escribir "Retire su dinero. Nuevo saldo: $", saldo
						FinSi
					FinSi
				4:
					Escribir "Gracias por usar el cajero."
				De Otro Modo:
					Escribir "Opción no válida."
			FinSegun
		Hasta Que opcion = 4
	FinSi
FinAlgoritmo
`,
  },
  {
    id: "grade-book",
    label: "Gestor de notas del curso",
    description: "A matrix of grades, a function per student, and a report.",
    topic: "projects",
    level: 3,
    concepts: ["io", "matrices", "arreglos", "funciones", "para", "si"],
    input: "Ana\n9\n8\n10\nBruno\n5\n6\n4\nCarla\n7\n7\n8\nDiego\n6\n5\n7",
    source: `Funcion promedio <- PromedioAlumno(notas, alumno)
	Definir promedio Como Real
	Definir k Como Entero
	promedio <- 0
	Para k <- 1 Hasta 3 Hacer
		promedio <- promedio + notas[alumno, k]
	FinPara
	promedio <- promedio / 3
FinFuncion

Algoritmo GestorNotas
	Definir nombres Como Caracter
	Definir notas, mejorPromedio, p Como Real
	Definir a, k, mejor, aprobados Como Entero
	Dimension nombres[4], notas[4, 3]
	Para a <- 1 Hasta 4 Hacer
		Escribir "Nombre del alumno ", a, ":"
		Leer nombres[a]
		Para k <- 1 Hasta 3 Hacer
			Escribir "  Nota ", k, " de ", nombres[a], ":"
			Leer notas[a, k]
		FinPara
	FinPara
	Escribir ""
	Escribir "Alumno      Promedio   Estado"
	mejor <- 1
	mejorPromedio <- -1
	aprobados <- 0
	Para a <- 1 Hasta 4 Hacer
		p <- PromedioAlumno(notas, a)
		Escribir Sin Saltar nombres[a], "      ", Redon(p * 10) / 10, "      "
		Si p >= 6 Entonces
			Escribir "Aprobado"
			aprobados <- aprobados + 1
		SiNo
			Escribir "Recursa"
		FinSi
		Si p > mejorPromedio Entonces
			mejorPromedio <- p
			mejor <- a
		FinSi
	FinPara
	Escribir ""
	Escribir "Aprobaron ", aprobados, " de 4 alumnos."
	Escribir "Mejor promedio: ", nombres[mejor], " (", Redon(mejorPromedio * 10) / 10, ")"
FinAlgoritmo
`,
  },
  {
    id: "hangman",
    label: "Juego del ahorcado",
    description: "Guess a random word letter by letter, with six mistakes allowed.",
    topic: "projects",
    level: 3,
    concepts: ["io", "texto", "arreglos", "mientras", "azar", "logicos"],
    input: "a\ne\no\nr\ni\nn\nt\nl\ns\nc\nm\nd\np\nu\ng\nv\nb\nf\nh\nj\nk\nq\nw\nx\ny\nz",
    source: `Algoritmo Ahorcado
	Definir palabras, secreta, progreso, nuevo, letra Como Caracter
	Definir errores, i Como Entero
	Definir acerto Como Logico
	Dimension palabras[5]
	palabras[1] <- "algoritmo"
	palabras[2] <- "variable"
	palabras[3] <- "pantalla"
	palabras[4] <- "teclado"
	palabras[5] <- "programa"
	// Azar(5) devuelve un número de 0 a 4
	secreta <- palabras[Azar(5) + 1]
	progreso <- ""
	Para i <- 1 Hasta Longitud(secreta) Hacer
		progreso <- progreso + "_"
	FinPara
	errores <- 0
	Mientras progreso <> secreta Y errores < 6 Hacer
		Escribir "Palabra: ", progreso, "   Errores: ", errores, " de 6"
		Escribir "Letra:"
		Leer letra
		letra <- Minusculas(letra)
		acerto <- Falso
		nuevo <- ""
		Para i <- 1 Hasta Longitud(secreta) Hacer
			Si Subcadena(secreta, i, i) = letra Entonces
				nuevo <- nuevo + letra
				acerto <- Verdadero
			SiNo
				nuevo <- nuevo + Subcadena(progreso, i, i)
			FinSi
		FinPara
		progreso <- nuevo
		Si NO acerto Entonces
			errores <- errores + 1
			Escribir "La letra ", letra, " no está."
		FinSi
	FinMientras
	Si progreso = secreta Entonces
		Escribir "¡Ganaste! La palabra era ", secreta, "."
	SiNo
		Escribir "Perdiste. La palabra era ", secreta, "."
	FinSi
FinAlgoritmo
`,
  },
  {
    id: "contacts",
    label: "Agenda de contactos",
    description: "Add, list and search contacts in arrays that grow.",
    topic: "projects",
    level: 3,
    concepts: ["io", "arreglos", "redimensionar", "repetir", "segun", "texto"],
    input: "1\nAna\n555-1234\n1\nLuis\n555-9876\n2\n3\nluis\n4",
    source: `Algoritmo Agenda
	Definir nombres, telefonos, buscado Como Caracter
	Definir total, opcion, i Como Entero
	Definir encontrado Como Logico
	total <- 0
	Dimension nombres[1], telefonos[1]
	Repetir
		Escribir ""
		Escribir "1. Agregar   2. Ver todos   3. Buscar   4. Salir"
		Leer opcion
		Segun opcion Hacer
			1:
				total <- total + 1
				Redimensionar nombres[total]
				Redimensionar telefonos[total]
				Escribir "Nombre:"
				Leer nombres[total]
				Escribir "Teléfono:"
				Leer telefonos[total]
				Escribir "Contacto guardado."
			2:
				Si total = 0 Entonces
					Escribir "La agenda está vacía."
				SiNo
					Para i <- 1 Hasta total Hacer
						Escribir i, ". ", nombres[i], " - ", telefonos[i]
					FinPara
				FinSi
			3:
				Escribir "¿A quién buscas?"
				Leer buscado
				encontrado <- Falso
				Para i <- 1 Hasta total Hacer
					Si Mayusculas(nombres[i]) = Mayusculas(buscado) Entonces
						Escribir nombres[i], ": ", telefonos[i]
						encontrado <- Verdadero
					FinSi
				FinPara
				Si NO encontrado Entonces
					Escribir "No encontré a ", buscado, "."
				FinSi
			4:
				Escribir "¡Hasta pronto!"
			De Otro Modo:
				Escribir "Opción no válida."
		FinSegun
	Hasta Que opcion = 4
FinAlgoritmo
`,
  },
];
