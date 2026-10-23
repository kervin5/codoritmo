import type { ConceptSiteCopy } from "./concepts-types";

// Páginas por concepto de la biblioteca de ejemplos (/es/ejemplos/concepto/<slug>).
// Cada fragmento de código se ejecuta en los tests (src/__tests__/site-concepts.test.tsx).
export const esConceptsSite: ConceptSiteCopy = {
  page: {
    explanation: "Cómo funciona",
    snippet: "Ejemplo corto",
    snippetIntro: "Lo mínimo para verlo funcionar. Cópialo o ábrelo en el editor.",
    output: "Lo que muestra:",
    examples: "Ejercicios resueltos",
    examplesIntro: "Cada ejercicio trae el código completo, su diagrama de flujo y una ejecución de muestra.",
    reference: "En la referencia del lenguaje",
    referenceIntro: "Las instrucciones que intervienen, explicadas una por una.",
    otherConcepts: "Otros conceptos",
    open: "Ábrelo en Codoritmo",
    openHint: "Se abre en el editor del navegador, sin instalar nada.",
    openLabel: "Abrir el ejemplo corto de {concept} en Codoritmo",
    independent:
      "Codoritmo es un proyecto independiente y de código abierto, inspirado en PSeInt y compatible con su sintaxis. No está afiliado al proyecto PSeInt.",
    officialSite: "Sitio oficial de PSeInt",
  },
  concepts: {
    io: {
      slug: "entrada-y-salida",
      h1: "Leer y Escribir en PSeInt: ejercicios de entrada y salida",
      title: "Leer y Escribir en PSeInt: ejercicios resueltos",
      description:
        "Ejercicios resueltos de entrada y salida en PSeInt: pedir datos con Leer, mostrar resultados con Escribir y armar mensajes claros.",
      paragraphs: [
        "Casi todo algoritmo hace tres cosas: recibe datos, los procesa y muestra un resultado. En PSeInt, los datos entran con Leer y los resultados salen con Escribir.",
        "Leer detiene el programa hasta que la persona escribe algo y presiona Enter; lo que escribió queda guardado en la variable. Por eso conviene mostrar antes una pregunta con Escribir: si no, la consola se queda esperando sin decir qué quiere.",
        "Escribir acepta varias cosas separadas por comas, y las muestra juntas: texto entre comillas, variables y hasta cuentas. Si agregas Sin Saltar, lo siguiente aparece en la misma línea.",
      ],
      snippet: 'Algoritmo Saludo\n\tDefinir nombre Como Caracter\n\tEscribir "¿Cómo te llamas?"\n\tLeer nombre\n\tEscribir "Hola, ", nombre, ". ¡Bienvenido!"\nFinAlgoritmo',
      input: "Sofía",
    },
    variables: {
      slug: "variables",
      h1: "Variables en PSeInt: ejemplos para empezar",
      title: "Variables en PSeInt: ejemplos resueltos",
      description:
        "Qué es una variable en PSeInt, cómo declararla con Definir, guardar valores con <- y usarla en cálculos, con ejercicios resueltos.",
      paragraphs: [
        "Una variable es un espacio con nombre donde el programa guarda un dato para usarlo después: una edad, un precio, un nombre. Puedes cambiar su valor tantas veces como quieras; la variable siempre recuerda el último.",
        "Con Definir avisas qué tipo de dato va a guardar: Entero para números sin decimales, Real para números con decimales, Caracter para texto y Logico para Verdadero o Falso. Según el perfil de tu escuela, Definir puede ser obligatorio.",
        "Para guardar un valor se usa la flecha <-, que se lee «recibe». Lo de la derecha se calcula primero, así que total <- total + precio significa «a total súmale el precio».",
      ],
      snippet:
        'Algoritmo Variables\n\tDefinir precio, total Como Real\n\tDefinir cantidad Como Entero\n\tprecio <- 2.5\n\tcantidad <- 4\n\ttotal <- precio * cantidad\n\tEscribir "Total a pagar: ", total\nFinAlgoritmo',
    },
    si: {
      slug: "condicionales-si",
      h1: "Condicionales en PSeInt: ejercicios con Si Entonces",
      title: "Condicionales Si en PSeInt: ejercicios resueltos",
      description:
        "Ejercicios resueltos con Si Entonces y SiNo en PSeInt: comparar valores, combinar condiciones con Y / O y anidar decisiones.",
      paragraphs: [
        "Una condicional permite que el programa haga cosas distintas según los datos. Si la condición es verdadera se ejecuta un bloque; con SiNo, puedes indicar qué hacer cuando es falsa. Todo termina con FinSi.",
        "La condición es una comparación que responde Verdadero o Falso: nota >= 11, edad < 18, respuesta = \"si\". Para pedir dos cosas a la vez se usa Y, y para aceptar una u otra, O.",
        "Cuando hay más de dos casos (por ejemplo, notas para A, B, C o D) se ponen condicionales una dentro de otra. Si siempre comparas la misma variable con valores fijos, Segun suele quedar más ordenado.",
      ],
      snippet:
        'Algoritmo ParOImpar\n\tDefinir n Como Entero\n\tEscribir "Escribe un número:"\n\tLeer n\n\tSi n MOD 2 = 0 Entonces\n\t\tEscribir n, " es par"\n\tSiNo\n\t\tEscribir n, " es impar"\n\tFinSi\nFinAlgoritmo',
      input: "7",
    },
    segun: {
      slug: "segun",
      h1: "Segun en PSeInt: ejercicios de menús y opciones",
      title: "Segun en PSeInt: ejercicios resueltos",
      description:
        "Ejercicios resueltos con Segun en PSeInt: menús de opciones, días de la semana y casos con De Otro Modo, con código y diagrama de flujo.",
      paragraphs: [
        "Segun elige un camino entre varios según el valor de una variable. Es la herramienta natural para un menú: el usuario escribe 1, 2 o 3 y el programa hace lo que corresponde a cada número.",
        "Cada caso se escribe como valor: y debajo sus instrucciones. Un mismo caso puede aceptar varios valores separados por comas, y De Otro Modo atrapa todo lo que no esté en la lista, como una opción inválida.",
        "Segun compara siempre por igualdad. Si necesitas rangos (de 0 a 10, de 11 a 20…), usa condicionales Si en su lugar.",
      ],
      snippet:
        'Algoritmo DiaDeLaSemana\n\tDefinir dia Como Entero\n\tEscribir "Número de día (1 a 7):"\n\tLeer dia\n\tSegun dia Hacer\n\t\t1, 2, 3, 4, 5:\n\t\t\tEscribir "Día de semana"\n\t\t6, 7:\n\t\t\tEscribir "Fin de semana"\n\t\tDe Otro Modo:\n\t\t\tEscribir "Ese día no existe"\n\tFinSegun\nFinAlgoritmo',
      input: "6",
    },
    mientras: {
      slug: "ciclo-mientras",
      h1: "Ejercicios con ciclos Mientras en PSeInt",
      title: "Ciclo Mientras en PSeInt: ejercicios resueltos",
      description:
        "Ejercicios resueltos con el ciclo Mientras en PSeInt: contadores, acumuladores, validar datos y juegos que se repiten hasta acertar.",
      paragraphs: [
        "Mientras repite un bloque de instrucciones mientras una condición sea verdadera. La condición se revisa antes de cada vuelta: si ya es falsa al llegar, el bloque no se ejecuta ni una vez.",
        "Se usa cuando no sabes de antemano cuántas vueltas habrá: seguir pidiendo números hasta que escriban 0, jugar hasta adivinar, dividir un número mientras sea mayor que cero.",
        "Lo más importante es que algo dentro del ciclo cambie la condición. Si te olvidas de aumentar el contador o de volver a leer el dato, el ciclo nunca termina. En la prueba de escritorio se ve enseguida.",
      ],
      snippet:
        'Algoritmo SumarHastaCero\n\tDefinir n, suma Como Entero\n\tsuma <- 0\n\tEscribir "Escribe números (0 para terminar):"\n\tLeer n\n\tMientras n <> 0 Hacer\n\t\tsuma <- suma + n\n\t\tLeer n\n\tFinMientras\n\tEscribir "La suma es ", suma\nFinAlgoritmo',
      input: "4\n10\n-2\n0",
    },
    repetir: {
      slug: "ciclo-repetir",
      h1: "Ejercicios con Repetir Hasta Que en PSeInt",
      title: "Repetir Hasta Que en PSeInt: ejercicios",
      description:
        "Ejercicios resueltos con Repetir Hasta Que en PSeInt: validar contraseñas y datos, menús que se repiten y la diferencia con Mientras.",
      paragraphs: [
        "Repetir ejecuta un bloque y recién al final revisa la condición. Por eso siempre da al menos una vuelta, aunque la condición ya se cumpla desde el principio.",
        "Con Hasta Que, el ciclo termina cuando la condición se vuelve verdadera. Es la forma natural de validar: «pide la nota hasta que esté entre 0 y 20». Con Mientras Que es al revés: sigue mientras la condición sea verdadera.",
        "La diferencia con Mientras está en el momento en que se revisa la condición. Si el bloque tiene que ejecutarse una vez antes de poder preguntar algo (como leer un dato), Repetir suele quedar más corto.",
      ],
      snippet:
        'Algoritmo ValidarNota\n\tDefinir nota Como Real\n\tRepetir\n\t\tEscribir "Nota (0 a 20):"\n\t\tLeer nota\n\tHasta Que nota >= 0 Y nota <= 20\n\tEscribir "Nota registrada: ", nota\nFinAlgoritmo',
      input: "25\n-1\n17",
    },
    para: {
      slug: "ciclo-para",
      h1: "Ejercicios con el ciclo Para en PSeInt",
      title: "Ciclo Para en PSeInt: ejercicios resueltos",
      description:
        "Ejercicios resueltos con el ciclo Para en PSeInt: tablas de multiplicar, sumas, cuentas regresivas con Con Paso y recorrer arreglos.",
      paragraphs: [
        "Para repite un bloque un número conocido de veces. Una variable contadora empieza en un valor, avanza en cada vuelta y el ciclo termina al pasar el valor final: Para i <- 1 Hasta 10 Hacer da diez vueltas.",
        "Con Paso cambia cuánto avanza el contador. Con Paso 2 cuenta de dos en dos, y con Paso -1 cuenta hacia atrás, lo que sirve para cuentas regresivas o para recorrer un arreglo desde el final.",
        "Elige Para cuando sabes cuántas vueltas darás antes de empezar (las 10 filas de una tabla, los n elementos de un arreglo). Si depende de algo que pasa adentro, usa Mientras o Repetir.",
      ],
      snippet:
        'Algoritmo TablaDeMultiplicar\n\tDefinir n, i Como Entero\n\tEscribir "¿Qué tabla quieres?"\n\tLeer n\n\tPara i <- 1 Hasta 5 Hacer\n\t\tEscribir n, " x ", i, " = ", n * i\n\tFinPara\nFinAlgoritmo',
      input: "7",
    },
    paraCada: {
      slug: "para-cada",
      h1: "Para Cada en PSeInt: recorrer un arreglo sin índices",
      title: "Para Cada en PSeInt: ejemplos resueltos",
      description:
        "Cómo recorrer un arreglo con Para Cada en PSeInt sin manejar posiciones, con ejemplos resueltos y cuándo conviene el Para de siempre.",
      paragraphs: [
        "Para Cada recorre un arreglo de principio a fin. En cada vuelta, la variable que eliges toma el valor de la casilla siguiente, así que no necesitas un contador ni saber cuántas casillas tiene.",
        "Es ideal para sumar, mostrar o buscar algo en todos los elementos. Si necesitas saber en qué posición estás (por ejemplo, para mostrar «Alumno 3») o recorrer solo una parte del arreglo, usa un Para con índice.",
        "Algunos perfiles no permiten Para Cada; en ese caso, el mismo recorrido se escribe con Para i <- 1 Hasta n Hacer.",
      ],
      snippet:
        'Algoritmo SumarPrecios\n\tDefinir total Como Real\n\tDimension precios[4]\n\tprecios[1] <- 3.5\n\tprecios[2] <- 12\n\tprecios[3] <- 7.25\n\tprecios[4] <- 1\n\ttotal <- 0\n\tPara Cada precio De precios Hacer\n\t\ttotal <- total + precio\n\tFinPara\n\tEscribir "Total: ", total\nFinAlgoritmo',
    },
    arreglos: {
      slug: "arreglos",
      h1: "Arreglos en PSeInt: ejemplos resueltos",
      title: "Arreglos en PSeInt: ejemplos resueltos",
      description:
        "Ejemplos resueltos de arreglos (vectores) en PSeInt: crear con Dimension, cargar datos, recorrer con Para, buscar el mayor y promediar.",
      paragraphs: [
        "Un arreglo (o vector) guarda muchos datos del mismo tipo bajo un solo nombre, en casillas numeradas. En vez de nota1, nota2, nota3… tienes notas[1], notas[2], notas[3], y puedes recorrerlas con un ciclo.",
        "Se crea con Dimension, indicando cuántas casillas tendrá: Dimension notas[30]. En el perfil por defecto la primera casilla es la 1; algunos perfiles empiezan en 0, así que revisa el de tu curso.",
        "El patrón más común es cargar el arreglo con un Para y Leer, y después recorrerlo otra vez para calcular algo: la suma, el promedio, el mayor, cuántos aprobaron. Salirse del tamaño (notas[31] en un arreglo de 30) es un error.",
      ],
      snippet:
        'Algoritmo MayorNota\n\tDefinir i, alta Como Entero\n\tDimension notas[5]\n\tPara i <- 1 Hasta 5 Hacer\n\t\tEscribir "Nota ", i, ":"\n\t\tLeer notas[i]\n\tFinPara\n\talta <- notas[1]\n\tPara i <- 2 Hasta 5 Hacer\n\t\tSi notas[i] > alta Entonces\n\t\t\talta <- notas[i]\n\t\tFinSi\n\tFinPara\n\tEscribir "La nota más alta es ", alta\nFinAlgoritmo',
      input: "14\n9\n18\n11\n16",
    },
    matrices: {
      slug: "matrices",
      h1: "Matrices en PSeInt: arreglos de dos dimensiones",
      title: "Matrices en PSeInt: ejemplos resueltos",
      description:
        "Ejemplos resueltos de matrices en PSeInt: crear una tabla con Dimension m[filas, columnas], recorrerla con dos Para y sumar filas.",
      paragraphs: [
        "Una matriz es un arreglo de dos dimensiones: una tabla con filas y columnas. Se crea con Dimension ventas[3, 5] (3 filas y 5 columnas) y cada casilla se nombra con dos índices, ventas[fila, columna].",
        "Para recorrerla se usan dos Para, uno dentro del otro: el de afuera avanza por las filas y el de adentro por las columnas de esa fila. Así se cargan los datos, se muestran como tabla o se suman por fila y por columna.",
        "Las matrices sirven para tableros de juegos, notas de varios alumnos en varias materias o ventas por día y por sucursal.",
      ],
      snippet:
        'Algoritmo TablaDeSumas\n\tDefinir f, c Como Entero\n\tDimension tabla[3, 4]\n\tPara f <- 1 Hasta 3 Hacer\n\t\tPara c <- 1 Hasta 4 Hacer\n\t\t\ttabla[f, c] <- f + c\n\t\t\tEscribir Sin Saltar tabla[f, c], " "\n\t\tFinPara\n\t\tEscribir ""\n\tFinPara\nFinAlgoritmo',
    },
    redimensionar: {
      slug: "redimensionar",
      h1: "Redimensionar en PSeInt: arreglos que crecen",
      title: "Redimensionar arreglos en PSeInt, con ejemplos",
      description:
        "Cómo hacer crecer un arreglo con Redimensionar en PSeInt sin perder los datos que ya tenía, con ejemplos resueltos de listas.",
      paragraphs: [
        "Un arreglo creado con Dimension tiene un tamaño fijo. Redimensionar cambia ese tamaño durante la ejecución y conserva lo que ya estaba guardado en las casillas.",
        "Es útil cuando no sabes cuántos datos llegarán: una lista de compras que crece con cada producto, o los números que escribe el usuario hasta que pone 0. Cada vez que llega un dato nuevo, agrandas el arreglo en una casilla y lo guardas al final.",
        "No todos los perfiles permiten redimensionar. Si el tuyo no lo permite, la alternativa clásica es crear un arreglo grande desde el principio y llevar en una variable cuántas casillas usas.",
      ],
      snippet:
        'Algoritmo ListaQueCrece\n\tDefinir n, i Como Entero\n\tDefinir dato Como Caracter\n\tn <- 0\n\tDimension lista[1]\n\tLeer dato\n\tMientras dato <> "fin" Hacer\n\t\tn <- n + 1\n\t\tRedimensionar lista[n]\n\t\tlista[n] <- dato\n\t\tLeer dato\n\tFinMientras\n\tPara i <- 1 Hasta n Hacer\n\t\tEscribir i, ". ", lista[i]\n\tFinPara\nFinAlgoritmo',
      input: "pan\nleche\nfin",
    },
    texto: {
      slug: "cadenas-de-texto",
      h1: "Cadenas de texto en PSeInt: ejercicios resueltos",
      title: "Cadenas de texto en PSeInt: ejercicios resueltos",
      description:
        "Ejercicios resueltos con texto en PSeInt: Longitud, SubCadena, Concatenar, Mayusculas, invertir palabras y contar vocales.",
      paragraphs: [
        "Un texto (cadena) es una secuencia de caracteres: letras, números, espacios y signos. En PSeInt se guarda en una variable de tipo Caracter y se escribe entre comillas.",
        "Las funciones de texto hacen el trabajo pesado: Longitud cuenta los caracteres, SubCadena saca un pedazo, Concatenar une dos textos, Mayusculas y Minusculas cambian las letras, y ConvertirANumero y ConvertirATexto pasan de texto a número y al revés.",
        "Para revisar un texto letra por letra se combina un Para con SubCadena(texto, i, i). Así se cuentan vocales, se invierte una palabra o se comprueba si es un palíndromo.",
      ],
      snippet:
        'Algoritmo InvertirPalabra\n\tDefinir palabra, invertida Como Caracter\n\tDefinir i Como Entero\n\tEscribir "Escribe una palabra:"\n\tLeer palabra\n\tinvertida <- ""\n\tPara i <- Longitud(palabra) Hasta 1 Con Paso -1 Hacer\n\t\tinvertida <- invertida + SubCadena(palabra, i, i)\n\tFinPara\n\tEscribir "Al revés: ", invertida\nFinAlgoritmo',
      input: "codigo",
    },
    logicos: {
      slug: "operadores-logicos",
      h1: "Operadores lógicos Y, O, NO en PSeInt: ejemplos",
      title: "Operadores lógicos en PSeInt: Y, O, NO",
      description:
        "Ejemplos resueltos con los operadores lógicos Y, O y NO en PSeInt: combinar condiciones, rangos de valores y variables lógicas.",
      paragraphs: [
        "Los operadores lógicos combinan condiciones. Y es verdadero solo si las dos condiciones lo son; O, si al menos una lo es; NO invierte el resultado. También se pueden escribir como &&, || y ~.",
        "Con Y se comprueban rangos: edad >= 13 Y edad <= 19. Con O se aceptan varias respuestas: letra = \"s\" O letra = \"S\". Usa paréntesis para dejar claro qué se evalúa primero.",
        "Una variable Logico guarda directamente Verdadero o Falso, como encontrado o terminado. Escribir Mientras NO encontrado Hacer se lee casi como en castellano.",
      ],
      snippet:
        'Algoritmo PuedeEntrar\n\tDefinir edad Como Entero\n\tDefinir conAdulto Como Logico\n\tedad <- 15\n\tconAdulto <- Verdadero\n\tSi edad >= 18 O conAdulto Entonces\n\t\tEscribir "Puede entrar"\n\tSiNo\n\t\tEscribir "No puede entrar"\n\tFinSi\nFinAlgoritmo',
    },
    subprocesos: {
      slug: "subprocesos",
      h1: "SubProcesos en PSeInt: ejemplos para dividir un programa",
      title: "SubProcesos en PSeInt: ejemplos resueltos",
      description:
        "Ejemplos resueltos con SubProcesos en PSeInt: dividir un programa en partes, pasar parámetros y reutilizar código sin repetirlo.",
      paragraphs: [
        "Un SubProceso agrupa instrucciones bajo un nombre para usarlas cuando las necesites. En lugar de un algoritmo largo, tienes piezas cortas con nombres que explican qué hacen: MostrarMenu, DibujarTablero, Intercambiar.",
        "Se escribe fuera del Algoritmo principal, entre SubProceso y FinSubProceso, y se llama escribiendo su nombre con paréntesis. Los parámetros son los datos que recibe para trabajar.",
        "Por defecto los parámetros se pasan por valor (el SubProceso recibe una copia). Si quieres que cambie la variable original, como al intercambiar dos números, declara el parámetro Por Referencia.",
      ],
      snippet:
        'SubProceso Linea(n)\n\tDefinir i Como Entero\n\tPara i <- 1 Hasta n Hacer\n\t\tEscribir Sin Saltar "-"\n\tFinPara\n\tEscribir ""\nFinSubProceso\n\nAlgoritmo Titulo\n\tLinea(20)\n\tEscribir "  Mi primer programa"\n\tLinea(20)\nFinAlgoritmo',
    },
    funciones: {
      slug: "funciones",
      h1: "Funciones en PSeInt: ejemplos que devuelven un valor",
      title: "Funciones en PSeInt: ejemplos resueltos",
      description:
        "Ejemplos resueltos de funciones en PSeInt: calcular y devolver un valor, usarlo en expresiones y escribir funciones como Factorial o EsPrimo.",
      paragraphs: [
        "Una función es un SubProceso que calcula algo y devuelve el resultado, para usarlo dentro de una expresión igual que Raiz o Abs: Escribir Promedio(a, b) o Si EsPrimo(n) Entonces.",
        "En PSeInt la función se declara con la variable que devolverá: Funcion r <- Doble(n). Lo que valga r al llegar a FinFuncion es el resultado. Codoritmo también acepta Retornar para devolver un valor en cualquier punto.",
        "Las funciones hacen que el programa se lea mejor y se pruebe por partes: puedes comprobar que EsPrimo funciona con unos pocos números antes de usarla en un problema más grande.",
      ],
      snippet:
        'Funcion r <- Promedio(a, b)\n\tr <- (a + b) / 2\nFinFuncion\n\nAlgoritmo UsarFuncion\n\tEscribir "Promedio de 14 y 17: ", Promedio(14, 17)\nFinAlgoritmo',
    },
    referencia: {
      slug: "por-referencia",
      h1: "Por Referencia y Por Valor en PSeInt",
      title: "Por Referencia y Por Valor en PSeInt",
      description:
        "Diferencia entre pasar parámetros Por Valor y Por Referencia en PSeInt, con un ejemplo de intercambio de variables que puedes ejecutar.",
      paragraphs: [
        "Cuando llamas a un SubProceso, cada parámetro puede llegar Por Valor o Por Referencia. Por Valor recibe una copia: lo que el SubProceso haga con ella no cambia la variable original. Es lo que pasa si no indicas nada.",
        "Por Referencia recibe la variable misma: si el SubProceso la cambia, el cambio se ve afuera. Es lo que necesitas para intercambiar dos valores, ordenar o devolver más de un resultado.",
        "Los arreglos se pasan por referencia aunque no lo escribas, por eso un SubProceso puede ordenar un arreglo «en su lugar».",
      ],
      snippet:
        'SubProceso Intercambiar(a Por Referencia, b Por Referencia)\n\tDefinir aux Como Entero\n\taux <- a\n\ta <- b\n\tb <- aux\nFinSubProceso\n\nAlgoritmo PruebaReferencia\n\tDefinir p, q Como Entero\n\tp <- 1\n\tq <- 2\n\tIntercambiar(p, q)\n\tEscribir "p = ", p, ", q = ", q\nFinAlgoritmo',
    },
    recursion: {
      slug: "recursividad",
      h1: "Recursividad en PSeInt: ejemplos resueltos",
      title: "Recursividad en PSeInt: ejemplos resueltos",
      description:
        "Ejemplos de recursividad en PSeInt: funciones que se llaman a sí mismas, como el factorial, con su caso base y cómo seguirlas paso a paso.",
      paragraphs: [
        "Una función recursiva se llama a sí misma con un problema más chico. El factorial es el ejemplo clásico: 5! es 5 por 4!, y 4! es 4 por 3!, hasta llegar a 1.",
        "Toda recursión necesita un caso base: el punto en que la función responde sin volver a llamarse (si n es 1, el factorial es 1). Sin él, las llamadas no terminan nunca.",
        "La recursión también resuelve problemas como las Torres de Hanói o el ordenamiento por mezcla. Seguirla paso a paso, mirando cada llamada, es la mejor forma de entenderla.",
      ],
      snippet:
        'Funcion r <- Factorial(n)\n\tSi n <= 1 Entonces\n\t\tr <- 1\n\tSiNo\n\t\tr <- n * Factorial(n - 1)\n\tFinSi\nFinFuncion\n\nAlgoritmo PruebaFactorial\n\tEscribir "5! = ", Factorial(5)\nFinAlgoritmo',
    },
    azar: {
      slug: "numeros-aleatorios",
      h1: "Números aleatorios en PSeInt: ejemplos con Azar",
      title: "Números aleatorios en PSeInt: Azar y Aleatorio",
      description:
        "Ejemplos resueltos con números al azar en PSeInt: Azar y Aleatorio, dados, juegos de adivinar y arreglos con datos de prueba.",
      paragraphs: [
        "Azar(n) devuelve un número entero al azar entre 0 y n - 1. Para un dado se escribe Azar(6) + 1, que da de 1 a 6. Aleatorio(a, b) da directamente un entero entre a y b, ambos incluidos.",
        "Con números al azar se hacen juegos (adivinar un número, piedra papel o tijera, tirar dados) y también datos de prueba: llenar un arreglo con valores al azar para probar un algoritmo de ordenamiento.",
        "Cada ejecución da resultados distintos, así que para revisar un programa conviene mostrar en pantalla el número que salió.",
      ],
      snippet:
        'Algoritmo TirarDados\n\tDefinir d1, d2 Como Entero\n\td1 <- Azar(6) + 1\n\td2 <- Aleatorio(1, 6)\n\tEscribir "Salieron ", d1, " y ", d2, ": suman ", d1 + d2\nFinAlgoritmo',
    },
    matematicas: {
      slug: "matematicas",
      h1: "Ejercicios de matemáticas en PSeInt resueltos",
      title: "Ejercicios de matemáticas en PSeInt resueltos",
      description:
        "Ejercicios de matemáticas resueltos en PSeInt: primos, divisores, MCD, potencias, promedios y redondeos, con operadores y funciones.",
      paragraphs: [
        "Muchos ejercicios de pseudocódigo son problemas de matemáticas: promedios, áreas, números primos, divisores. Los operadores son los de siempre (+, -, *, /, ^) más MOD, que da el resto de una división.",
        "MOD resuelve una sorprendente cantidad de problemas: n MOD 2 = 0 dice si un número es par, y n MOD d = 0 si d es divisor de n. Trunc(n / 10) quita la última cifra de un número.",
        "Para el resto hay funciones listas: Raiz, Abs, Redon, Trunc, y constantes como PI. Combinadas con un ciclo, alcanzan para buscar primos, calcular el máximo común divisor o sumar las cifras de un número.",
      ],
      snippet:
        'Algoritmo Divisores\n\tDefinir n, d Como Entero\n\tEscribir "Escribe un número:"\n\tLeer n\n\tEscribir Sin Saltar "Divisores de ", n, ": "\n\tPara d <- 1 Hasta n Hacer\n\t\tSi n MOD d = 0 Entonces\n\t\t\tEscribir Sin Saltar d, " "\n\t\tFinSi\n\tFinPara\n\tEscribir ""\nFinAlgoritmo',
      input: "12",
    },
    pantalla: {
      slug: "limpiar-pantalla-y-esperar",
      h1: "Limpiar Pantalla y Esperar en PSeInt: ejemplos",
      title: "Limpiar Pantalla y Esperar en PSeInt",
      description:
        "Cómo usar Limpiar Pantalla, Esperar y Esperar Tecla en PSeInt para menús, animaciones simples y cuentas regresivas, con ejemplos.",
      paragraphs: [
        "Limpiar Pantalla (o Borrar Pantalla) deja la consola vacía, como empezar en una hoja nueva. Se usa en menús y juegos para que cada pantalla no se mezcle con la anterior.",
        "Esperar hace una pausa antes de seguir: Esperar 1 Segundo o Esperar 500 Milisegundos. Esperar Tecla detiene el programa hasta que la persona presiona una tecla, para que pueda leer con calma.",
        "Juntas permiten animaciones sencillas: mostrar algo, esperar, limpiar y mostrar lo siguiente. Una cuenta regresiva es el ejemplo más simple.",
      ],
      snippet:
        'Algoritmo CuentaRegresiva\n\tDefinir i Como Entero\n\tPara i <- 3 Hasta 1 Con Paso -1 Hacer\n\t\tLimpiar Pantalla\n\t\tEscribir i, "..."\n\t\tEsperar 1 Segundo\n\tFinPara\n\tEscribir "¡Despegue!"\nFinAlgoritmo',
    },
    coloquial: {
      slug: "condiciones-coloquiales",
      h1: "Condiciones coloquiales en PSeInt: Es Par, Es Multiplo De…",
      title: "Condiciones coloquiales en PSeInt: Es Par y más",
      description:
        "Cómo escribir condiciones en lenguaje natural en PSeInt: Es Par, Es Impar, Es Multiplo De, Es Mayor Que, Es Positivo, con ejemplos.",
      paragraphs: [
        "PSeInt permite escribir algunas condiciones casi como se dicen: n Es Par, n Es Impar, n Es Positivo, anio Es Multiplo De 4, a Es Mayor Que b, x Es Igual A 0. También se pueden negar: n No Es Par.",
        "Cada una equivale a una comparación normal: n Es Par es lo mismo que n MOD 2 = 0, y a Es Mayor Que b es a > b. Sirven para leer el código en voz alta y entenderlo a la primera.",
        "Estas expresiones dependen del perfil: algunos cursos las desactivan para que practiques con los operadores. Si tu perfil no las acepta, escribe la comparación equivalente.",
      ],
      snippet:
        'Algoritmo Coloquial\n\tDefinir n Como Entero\n\tEscribir "Escribe un número:"\n\tLeer n\n\tSi n Es Par Entonces\n\t\tEscribir n, " es par"\n\tFinSi\n\tSi n Es Multiplo De 5 Entonces\n\t\tEscribir n, " es múltiplo de 5"\n\tFinSi\n\tSi n Es Mayor Que 100 Entonces\n\t\tEscribir n, " es mayor que 100"\n\tFinSi\nFinAlgoritmo',
      input: "40",
    },
  },
};
