import type { ExampleCopy } from "./types";

// Textos de la biblioteca de ejemplos, por id (ver src/engine/examples.ts).
export const esExamples: Record<string, ExampleCopy> = {
  /* ---------------- Primeros pasos ---------------- */
  "hello-world": {
    label: "Hola Mundo",
    description: "Tu primer algoritmo: muestra un par de mensajes en pantalla.",
    learn:
      "Todo programa vive entre Algoritmo y FinAlgoritmo. Con Escribir muestras texto en pantalla, y cada Escribir termina en una línea nueva.",
    challenge: "Agrega una tercera línea que diga tu nombre y tu comida favorita.",
    hint: "Copia una de las líneas con Escribir y cambia el texto que va entre comillas.",
  },
  greeting: {
    label: "Saludo personalizado",
    description: "Pregunta tu nombre y tu edad, y te responde con ambos.",
    learn:
      "Usas Definir para crear variables de tipo Caracter y Entero, y Leer para guardar lo que escribe el usuario. Escribir puede mezclar textos, variables y cuentas separándolos con comas.",
    challenge: "Pregunta también en qué año estamos y calcula en qué año naciste.",
    hint: "Define una variable Entero para el año, léela y réstale la edad.",
  },
  temperature: {
    label: "Conversor de temperatura",
    description: "Convierte grados Celsius a Fahrenheit y a Kelvin.",
    learn:
      "Trabajas con variables Real y con el operador de asignación <-. Las fórmulas usan *, / y + igual que en matemáticas.",
    challenge: "Haz el camino inverso: pide grados Fahrenheit y conviértelos a Celsius.",
    hint: "Despeja la fórmula: resta 32 y luego multiplica por 5 / 9.",
  },
  "tip-calculator": {
    label: "Calculadora de propina",
    description: "Divide la cuenta del restaurante incluyendo la propina.",
    learn:
      "Combinas varias lecturas con Leer para hacer cálculos en cadena. Usas Redon para redondear y un truco con * 100 y / 100 para dejar solo dos decimales.",
    challenge: "Si alguien escribe 0 personas, muestra un aviso en lugar de dividir.",
    hint: "Rodea el cálculo de porPersona con un Si personas > 0 Entonces ... SiNo ... FinSi.",
  },

  /* ---------------- Decisiones ---------------- */
  "can-vote": {
    label: "¿Puedo votar?",
    description: "Te dice si ya puedes votar o cuántos años te faltan.",
    learn:
      "Tu primera decisión con Si ... Entonces ... SiNo ... FinSi. La condición edad >= 18 decide cuál de los dos caminos se ejecuta.",
    challenge: "Si la edad es negativa, muestra \"Esa edad no es válida\".",
    hint: "Agrega otra condición antes de las demás que revise si edad < 0.",
  },
  bmi: {
    label: "Índice de masa corporal",
    description: "Calcula el IMC y lo clasifica en bajo peso, normal u otros.",
    learn:
      "Usas el operador ^ para elevar al cuadrado y Redon para redondear. Los Si anidados dentro de cada SiNo prueban los rangos uno tras otro.",
    challenge: "Además de la clasificación, muestra cuántos kilos faltan o sobran para llegar al rango normal.",
    hint: "El peso ideal mínimo es 18.5 * altura ^ 2 y el máximo es 25 * altura ^ 2.",
  },
  parking: {
    label: "Tarifa del estacionamiento",
    description: "Cobra cada hora empezada, con un tope máximo por día.",
    learn:
      "Con Trunc y MOD separas las horas completas de los minutos sobrantes. Varios Si seguidos aplican la tarifa y el tope diario.",
    challenge: "Agrega una tolerancia: si el auto estuvo 15 minutos o menos, no paga nada.",
    hint: "Revisa minutos <= 15 al principio y deja el costo en 0 en ese caso.",
  },
  "leap-year": {
    label: "Año bisiesto",
    description: "Aplica las reglas del calendario para saber si un año es bisiesto.",
    learn:
      "Usas la condición coloquial Es Multiplo De, una forma más legible de escribir MOD = 0. El orden de los Si anidados importa: primero 400, luego 100 y al final 4.",
    challenge: "Pide un año de inicio y uno de fin, y muestra todos los años bisiestos entre ellos.",
    hint: "Envuelve la decisión en un ciclo Para que recorra los años del rango.",
  },
  "coffee-menu": {
    label: "Menú de cafetería",
    description: "Elige una bebida del menú y calcula el total a pagar.",
    learn:
      "Segun ... Hacer elige un caso según el valor de la opción, y De Otro Modo atrapa cualquier opción que no esté en el menú. Después un Si decide si seguir con el pedido.",
    challenge: "Agrega una cuarta bebida al menú, por ejemplo un jugo de $32.",
    hint: "Escribe la nueva línea del menú y agrega un caso 4: dentro del Segun.",
  },

  /* ---------------- Repeticiones ---------------- */
  "times-table": {
    label: "Tabla de multiplicar",
    description: "Muestra la tabla de multiplicar del número que elijas.",
    learn:
      "El ciclo Para ... Hasta ... Hacer repite un bloque un número fijo de veces. La variable i cambia sola de 1 a 10 en cada vuelta.",
    challenge: "Pregunta también hasta qué número quiere ver la tabla, en lugar de llegar siempre a 10.",
    hint: "Lee otra variable y úsala en lugar del 10 en el Para.",
  },
  "guess-number": {
    label: "Adivina el número",
    description: "Adivina un número secreto del 1 al 100 en siete intentos.",
    learn:
      "Aleatorio elige el número secreto y Mientras repite mientras se cumplan dos condiciones unidas con Y y NO. Abs mide qué tan cerca estás y Escribir Sin Saltar deja el cursor en la misma línea.",
    challenge: "Al final, muestra un mensaje distinto si ganaste en tres intentos o menos.",
    hint: "Dentro del Si acerto, agrega otro Si que compare intentos <= 3.",
  },
  password: {
    label: "Validar contraseña",
    description: "Pide una contraseña hasta que tenga al menos 8 caracteres.",
    learn:
      "Repetir ... Hasta Que ejecuta el bloque al menos una vez y vuelve a pedir mientras la condición no se cumpla. Longitud cuenta los caracteres de un texto.",
    challenge: "Pide también que la contraseña no sea igual a \"12345678\".",
    hint: "Une las dos condiciones del Hasta Que con Y.",
  },
  countdown: {
    label: "Cuenta regresiva",
    description: "Una cuenta regresiva de despegue que avanza segundo a segundo.",
    learn:
      "Un Para con Con Paso -1 cuenta hacia atrás. Esperar Tecla, Esperar 1 Segundo y Limpiar Pantalla controlan el ritmo y lo que se ve.",
    challenge: "Pregunta desde qué número quiere empezar la cuenta.",
    hint: "Lee un número y úsalo como valor inicial del Para en lugar del 5.",
  },
  "sum-until-zero": {
    label: "Sumar hasta cero",
    description: "Suma los números que escribas hasta que ingreses un 0.",
    learn:
      "Un ciclo Mientras se detiene con un valor centinela, en este caso el 0. Usas un acumulador (suma) y un contador (cantidad) para sacar el promedio.",
    challenge: "Muestra también cuál fue el número más grande que se escribió.",
    hint: "Guarda el primer número en una variable mayor y actualízala con un Si dentro del ciclo.",
  },
  shapes: {
    label: "Dibujar figuras",
    description: "Dibuja un cuadrado y un triángulo con asteriscos.",
    learn:
      "Dos Para anidados recorren filas y columnas. Escribir Sin Saltar mantiene los asteriscos en la misma línea y Escribir \"\" pasa a la siguiente.",
    challenge: "Dibuja un triángulo invertido: la primera fila con n asteriscos y la última con uno.",
    hint: "Haz que el Para de afuera cuente hacia atrás con Con Paso -1.",
  },

  /* ---------------- Arreglos ---------------- */
  "array-average": {
    label: "Promedio de Notas",
    description: "Guarda cinco notas en un arreglo y calcula su promedio y la más alta.",
    learn:
      "Dimension crea un arreglo de 5 posiciones y el Para lo llena con Leer notas[i]. En el mismo ciclo acumulas la suma y buscas el máximo con un Si.",
    challenge: "Muestra también la nota más baja.",
    hint: "Crea una variable minimo que empiece con un valor alto, por ejemplo 10, y compárala con cada nota.",
  },
  "linear-search": {
    label: "Búsqueda lineal",
    description: "Busca un nombre en una lista sin importar mayúsculas o minúsculas.",
    learn:
      "Un Mientras recorre el arreglo y se detiene apenas encuentra el nombre. Mayusculas convierte ambos textos para compararlos sin importar cómo se escribieron.",
    challenge: "Si el nombre no está, ofrece agregarlo al final de la lista.",
    hint: "Necesitarás un arreglo más grande con Dimension y una variable que cuente cuántos nombres hay.",
  },
  inventory: {
    label: "Inventario de tienda",
    description: "Registra el stock de cada producto y avisa cuáles reponer.",
    learn:
      "Usas dos arreglos paralelos: productos[i] y stock[i] hablan del mismo producto. Un contador (aReponer) te dice si hubo algún producto con poco stock.",
    challenge: "Al final, muestra el total de unidades que hay en la tienda.",
    hint: "Suma stock[i] en un acumulador dentro de uno de los Para.",
  },
  "sales-matrix": {
    label: "Ventas de la semana",
    description: "Una tabla de ventas por sucursal y día, con sus totales.",
    learn:
      "Dimension ventas[3, 5] crea una matriz de filas y columnas. Recorrerla con los Para en un orden da los totales por sucursal y, en el otro, los totales por día.",
    challenge: "Muestra qué sucursal vendió más en la semana.",
    hint: "Al calcular totalSucursal, compáralo con el mayor visto hasta ahora y guarda su número.",
  },
  "shopping-list": {
    label: "Lista de compras",
    description: "Agrega productos a una lista que crece hasta que escribas FIN.",
    learn:
      "Redimensionar agranda el arreglo sin perder lo que ya tenía. Para Cada recorre todos los elementos sin que tengas que manejar índices.",
    challenge: "Evita que se agregue el mismo producto dos veces.",
    hint: "Antes de guardar, recorre la lista con un Para y compara usando Mayusculas.",
  },

  /* ---------------- Ordenamiento y búsqueda ---------------- */
  "bubble-sort": {
    label: "Ordenamiento burbuja",
    description: "Ordena números al azar intercambiando vecinos, y se detiene apenas quedan ordenados.",
    learn:
      "En cada pasada se comparan los vecinos y se intercambian si están al revés, así el mayor \"sube\" hasta el final. Si una pasada no hace ningún cambio, ya está todo ordenado y el Mientras termina antes. Por eso cuesta O(n) si los datos ya venían ordenados y O(n²) en el caso promedio y en el peor.",
    challenge: "Ordena los números de mayor a menor.",
    hint: "Basta con cambiar el operador de comparación dentro del Si.",
  },
  "selection-sort": {
    label: "Ordenamiento por selección",
    description: "Busca el menor de los que faltan y lo pone en su lugar.",
    learn:
      "En la vuelta i se busca el menor entre las posiciones i y n, y se lo lleva a la posición i con un solo intercambio. Siempre recorre todo lo que falta, así que hace unas n²/2 comparaciones aunque los datos ya estén ordenados: O(n²) en todos los casos, pero como mucho n - 1 intercambios.",
    challenge: "Cuenta también cuántas comparaciones hace y compáralas con n * (n - 1) / 2.",
    hint: "Suma 1 a un contador justo antes del Si que compara datos[j] con datos[minimo].",
  },
  "insertion-sort": {
    label: "Ordenamiento por inserción",
    description: "Inserta cada número entre los ya ordenados, como al acomodar cartas en la mano.",
    learn:
      "La parte izquierda del arreglo siempre está ordenada. Cada número nuevo se guarda en actual, los mayores se corren un lugar a la derecha y actual entra en el hueco. Con datos casi ordenados casi no corre nada (O(n)); en el promedio y en el peor caso es O(n²).",
    challenge: "Genera los datos ya ordenados (por ejemplo datos[i] <- i) y mira cuántos desplazamientos hace.",
    hint: "Cambia Aleatorio(1, 99) por i en el primer Para; el contador de desplazamientos debería dar 0.",
  },
  "shell-sort": {
    label: "Ordenamiento Shell",
    description: "Una inserción entre elementos lejanos, con un salto que se achica en cada pasada.",
    learn:
      "Primero ordena por inserción los elementos separados por un salto grande, para que los números muy fuera de lugar viajen lejos de una vez. Después divide el salto a la mitad hasta llegar a 1, que es una inserción común sobre datos casi ordenados. Con estos saltos suele andar cerca de O(n√n), y el peor caso es O(n²).",
    challenge: "Prueba dividir el salto por 3 en lugar de 2 y compara cuántas pasadas hace.",
    hint: "Cambia las dos líneas con Trunc(... / 2); cuida que la última pasada siga siendo con salto 1.",
  },
  "merge-sort": {
    label: "Ordenamiento por mezcla",
    description: "Parte el arreglo en mitades, ordena cada una con recursión y las mezcla.",
    learn:
      "OrdenarPorMezcla se llama a sí mismo con cada mitad hasta llegar a tramos de un elemento, y Mezclar une dos tramos ordenados tomando siempre el menor de los dos frentes. Se parte en mitades unas log n veces y cada nivel mezcla n elementos: O(n log n) siempre, a cambio de un arreglo temporal de tamaño n. Los arreglos se pasan por referencia, así que todos los subprocesos trabajan sobre el mismo arreglo.",
    challenge: "Muestra en pantalla cada tramo que se mezcla, con su izquierda y su derecha.",
    hint: "Agrega un Escribir al principio de Mezclar; prueba con n chico para que no sean demasiadas líneas.",
  },
  quicksort: {
    label: "Ordenamiento rápido (Quicksort)",
    description: "Elige un pivote, separa los menores de los mayores y ordena cada lado con recursión.",
    learn:
      "Particionar usa el método de Hoare: dos índices avanzan desde los extremos hacia el centro y se intercambian cuando cada uno encuentra un valor del lado equivocado del pivote. Después cada parte se ordena con la misma idea. Si el pivote parte el arreglo más o menos por la mitad cuesta O(n log n); si siempre cae en un extremo, O(n²). No necesita arreglo extra, solo la pila de llamadas (O(log n)).",
    challenge: "Usa como pivote un elemento al azar del tramo en lugar del del medio.",
    hint: "Aleatorio(izquierda, derecha) da una posición del tramo; guarda datos[esa posición] en pivote.",
  },
  "heap-sort": {
    label: "Ordenamiento por montículo",
    description: "Organiza el arreglo como un montículo y saca el mayor una y otra vez.",
    learn:
      "Un montículo es un árbol guardado en el arreglo: los hijos de la posición k están en 2k y 2k + 1, y cada padre es mayor que sus hijos, así que el mayor queda en la posición 1. Se lo cambia con el último, se achica el montículo y Hundir lo repara en log n pasos. Cuesta O(n log n) siempre y no usa memoria extra.",
    challenge: "Muestra el arreglo justo después de armar el montículo y comprueba que datos[1] es el mayor.",
    hint: "Llama a MostrarDatos entre los dos Para del algoritmo principal.",
  },
  "counting-sort": {
    label: "Ordenamiento por conteo",
    description: "Cuenta cuántas veces aparece cada valor, sin comparar números entre sí.",
    learn:
      "Como los valores van de 1 a 99, un arreglo conteo guarda cuántas veces aparece cada uno; después se reescribe el arreglo recorriendo conteo en orden. No compara nunca dos números: cuesta O(n + k), donde k es la cantidad de valores posibles. Es muy rápido cuando k es chico, pero no sirve si los valores pueden ser cualquiera.",
    challenge: "Muestra qué valor se repitió más veces.",
    hint: "Recorre conteo buscando su máximo, igual que buscarías el mayor de un arreglo.",
  },
  "binary-search": {
    label: "Búsqueda binaria",
    description: "Encuentra un valor en un arreglo ordenado partiendo el rango a la mitad.",
    learn:
      "Como la lista está ordenada, al mirar el elemento del medio sabes en qué mitad puede estar el buscado y descartas la otra. Cada paso divide el rango a la mitad, así que con 512 elementos alcanzan 10 comparaciones: O(log n), contra O(n) de revisar uno por uno.",
    challenge: "Busca también un número que seguro no está, como 2 * n + 1, y cuenta sus pasos.",
    hint: "Puedes copiar el bloque de búsqueda o, mejor, convertirlo en una Funcion que devuelva la posición.",
  },
  "search-comparison": {
    label: "Búsqueda lineal contra binaria",
    description: "Cuenta las comparaciones que necesita cada búsqueda en la misma lista ordenada.",
    learn:
      "Dos funciones buscan el mismo valor y devuelven cuántas comparaciones hicieron. La lineal revisa uno por uno: O(1) si está primero, O(n) si está al final o no está. La binaria nunca pasa de log n comparaciones. Prueba con n = 10 y con n = 500 para ver cómo se separan.",
    challenge: "Calcula el promedio de comparaciones de cada búsqueda buscando todos los valores de la lista.",
    hint: "Recorre i de 1 a n, busca datos[i] con las dos funciones y acumula los resultados; al final divide por n.",
  },

  /* ---------------- Texto ---------------- */
  palindrome: {
    label: "Palíndromos",
    description: "Revisa si una frase se lee igual al derecho y al revés.",
    learn:
      "Subcadena saca una letra a la vez y Minusculas las normaliza. Un Para con Con Paso -1 recorre el texto al revés para construir la versión invertida.",
    challenge: "Ignora también las comas y los puntos, para que \"Yo hago yoga, hoy.\" cuente como palíndromo.",
    hint: "Amplía la condición del Si que descarta los espacios.",
  },
  "count-vowels": {
    label: "Contar vocales",
    description: "Cuenta las vocales, los espacios y los demás caracteres de un texto.",
    learn:
      "Un Para recorre el texto letra por letra con Subcadena. Segun acepta varios valores en un mismo caso, como \"a\", \"e\", \"i\", \"o\", \"u\".",
    challenge: "Cuenta también las vocales con tilde (á, é, í, ó, ú) como vocales.",
    hint: "Agrega esas letras a la lista del caso de las vocales.",
  },
  initials: {
    label: "Iniciales de un nombre",
    description: "Obtiene las iniciales de un nombre completo.",
    learn:
      "Guardas la letra anterior para detectar dónde empieza cada palabra. La condición une dos comparaciones con Y, y Mayusculas pone cada inicial en mayúscula.",
    challenge: "Cuenta cuántas palabras tiene el nombre y muéstralo al final.",
    hint: "Suma 1 a un contador cada vez que agregas una inicial.",
  },
  "caesar-cipher": {
    label: "Cifrado César",
    description: "Cifra un mensaje corriendo cada letra del abecedario.",
    learn:
      "Buscas cada letra en el abecedario con Subcadena dentro de un Para anidado. MOD hace que después de la z se vuelva a empezar en la a.",
    challenge: "Agrega la opción de descifrar un mensaje ya cifrado.",
    hint: "Descifrar es lo mismo que cifrar con un desplazamiento de 26 menos el original.",
  },
  "text-format": {
    label: "Formato de datos",
    description: "Ordena mayúsculas y minúsculas, y convierte entre texto y número.",
    learn:
      "Combinas Subcadena, Mayusculas, Minusculas y Concatenar para dar formato a un nombre. ConvertirANumero y ConvertirATexto pasan datos de un tipo a otro.",
    challenge: "Aplica el mismo formato al apellido: primera letra en mayúscula y el resto en minúscula.",
    hint: "Repite la línea de nombreBonito usando apellido en lugar de nombre.",
  },

  /* ---------------- Subprocesos y funciones ---------------- */
  "factorial-power": {
    label: "Factorial y potencia",
    description: "Funciones que calculan el factorial y una potencia.",
    learn:
      "Una Funcion recibe parámetros y devuelve un valor en la variable que va antes de <-. Puedes llamarla dentro de un Escribir como si fuera una función de PSeInt.",
    challenge: "Crea una función Sumatoria(n) que sume los números de 1 a n.",
    hint: "Copia la estructura de Factorial, pero empieza en 0 y suma en lugar de multiplicar.",
  },
  references: {
    label: "Por Referencia y por valor",
    description: "Ordena tres números intercambiándolos con subprocesos.",
    learn:
      "Con Por Referencia el SubProceso modifica las variables originales; con Por Valor solo cambia una copia. Un SubProceso puede llamar a otro, como OrdenarTres a Intercambiar.",
    challenge: "Agrega un SubProceso Duplicar(n Por Referencia) y úsalo para duplicar el mayor de los tres.",
    hint: "Después de OrdenarTres, el mayor siempre queda en c.",
  },
  validation: {
    label: "Validaciones reutilizables",
    description: "Valida el correo y la edad de un formulario de registro.",
    learn:
      "Cada Funcion devuelve un valor Logico, así que puedes usarla directo en un Si o en Hasta Que. Las condiciones se combinan con Y y se niegan con NO.",
    challenge: "Agrega una función EsNombreValido que exija al menos 3 letras, y pide el nombre primero.",
    hint: "Usa Longitud dentro de la función y repite el mismo patrón de Repetir ... Hasta Que.",
  },
  "modular-menu": {
    label: "Menú modular",
    description: "Un conversor de unidades con un menú que se repite.",
    learn:
      "Separas el programa en SubProceso sin parámetros, cada uno con una tarea. Repetir ... Mientras Que vuelve a mostrar el menú hasta que elijas salir.",
    challenge: "Agrega una opción para convertir kilogramos a libras.",
    hint: "Crea un SubProceso nuevo (1 kg = 2.20462 lb), agrégalo al menú y mueve Salir al número 4.",
  },
  hanoi: {
    label: "Torres de Hanói",
    description: "Resuelve el clásico rompecabezas de las torres paso a paso.",
    learn:
      "Hanoi es un SubProceso recursivo: se llama a sí mismo con un disco menos. El caso base (un solo disco) es el que detiene la recursión.",
    challenge: "Valida que la cantidad de discos esté entre 1 y 6 antes de empezar.",
    hint: "Usa Repetir ... Hasta Que alrededor del Leer n.",
  },

  /* ---------------- Matemáticas ---------------- */
  primes: {
    label: "Números primos",
    description: "Encuentra todos los números primos hasta un límite.",
    learn:
      "La Funcion EsPrimo devuelve un Logico y usa MOD para buscar divisores. El Mientras se detiene antes, al pasar la raíz cuadrada o al encontrar un divisor.",
    challenge: "Muestra también la suma de todos los primos encontrados.",
    hint: "Agrega un acumulador en el Para del algoritmo principal.",
  },
  "gcd-lcm": {
    label: "MCD y MCM",
    description: "Calcula el máximo común divisor y el mínimo común múltiplo.",
    learn:
      "La Funcion MCD aplica el algoritmo de Euclides con un Mientras y MOD. El MCM sale del MCD usando Trunc para quedarte con un entero.",
    challenge: "Pide tres números y calcula el MCD de los tres.",
    hint: "El MCD de tres números es MCD(MCD(a, b), c).",
  },
  fibonacci: {
    label: "Sucesión de Fibonacci",
    description: "Muestra los primeros términos de la sucesión de Fibonacci.",
    learn:
      "Dentro de un Para, dos variables avanzan juntas: cada término es la suma de los dos anteriores. Al final, la división entre términos se acerca al número de oro.",
    challenge: "Muestra solo los términos que sean pares.",
    hint: "Antes de escribir a, revisa con un Si si a MOD 2 = 0.",
  },
  quadratic: {
    label: "Ecuación cuadrática",
    description: "Resuelve ax² + bx + c = 0, con raíces reales o complejas.",
    learn:
      "El discriminante decide entre tres casos con Si anidados. Raiz calcula la raíz cuadrada, y una primera validación evita dividir cuando a = 0.",
    challenge: "Cuando a = 0, resuelve la ecuación lineal bx + c = 0 en lugar de solo avisar.",
    hint: "La solución es x = -c / b, pero revisa antes que b no sea 0.",
  },
  "roman-numerals": {
    label: "Números romanos",
    description: "Convierte un número entre 1 y 3999 a números romanos.",
    learn:
      "Dos arreglos paralelos guardan los valores y sus símbolos. Un Mientras dentro de un Para resta el mayor valor posible las veces que haga falta.",
    challenge: "Muestra también cuántos símbolos tiene el número romano obtenido.",
    hint: "Usa Longitud sobre la variable romano.",
  },
  "base-conversion": {
    label: "Conversión de bases",
    description: "Escribe un número en binario y en hexadecimal.",
    learn:
      "Con divisiones sucesivas, MOD da cada dígito y Trunc el cociente. ConvertirATexto y Subcadena convierten cada resto en su carácter.",
    challenge: "Agrega la conversión a base 8 (octal).",
    hint: "Copia el bloque del binario y cambia el 2 por un 8.",
  },
  geometry: {
    label: "Geometría",
    description: "Calcula el área de un círculo y resuelve un triángulo rectángulo.",
    learn:
      "Usas la constante PI, RC para la raíz cuadrada y ATan, Sen y Cos para trigonometría. Las funciones trigonométricas trabajan en radianes, por eso hay que convertir a grados.",
    challenge: "Calcula también el área y el perímetro del triángulo.",
    hint: "El área es cateto1 * cateto2 / 2 y el perímetro es la suma de los tres lados.",
  },
  "compound-interest": {
    label: "Interés compuesto",
    description: "Mira cómo crecen tus ahorros año a año.",
    learn:
      "Un Para aplica el interés en cada vuelta sobre el monto acumulado. Ln calcula en cuánto tiempo se duplica el capital y Exp el resultado con interés continuo.",
    challenge: "Agrega un depósito fijo que se suma al final de cada año.",
    hint: "Lee el depósito antes del ciclo y súmalo a monto después de aplicar el interés.",
  },

  /* ---------------- Proyectos ---------------- */
  "tic-tac-toe": {
    label: "Ta-Te-Ti",
    description: "El clásico juego de tres en línea para dos jugadores.",
    learn:
      "El tablero es una matriz de 3 x 3. Un SubProceso lo dibuja, una Funcion Logico revisa si hay tres en línea y Repetir ... Hasta Que valida cada jugada.",
    challenge: "Al terminar, pregunta si quieren jugar otra vez.",
    hint: "Envuelve todo el juego, desde que se limpia el tablero, en un Repetir ... Hasta Que.",
  },
  atm: {
    label: "Cajero automático",
    description: "Verifica el PIN y permite consultar, depositar y retirar dinero.",
    learn:
      "Un Repetir con tres intentos protege el acceso con una variable Logico. Después, un menú con Segun actualiza el saldo y usa MOD para aceptar solo múltiplos de 100.",
    challenge: "Limita los retiros a un máximo de $3000 por operación.",
    hint: "Agrega otra condición en el caso 3, antes de revisar si hay fondos.",
  },
  "grade-book": {
    label: "Gestor de notas del curso",
    description: "Registra tres notas por alumno y arma el reporte del curso.",
    learn:
      "Una matriz guarda las notas y un arreglo los nombres de los alumnos. La Funcion PromedioAlumno recibe la matriz completa, y el reporte cuenta aprobados y busca el mejor promedio.",
    challenge: "Muestra también el promedio general de todo el curso.",
    hint: "Suma cada p en un acumulador y divide entre 4 al final.",
  },
  hangman: {
    label: "Juego del ahorcado",
    description: "Adivina una palabra secreta letra por letra con seis errores permitidos.",
    learn:
      "Azar elige una palabra de un arreglo. Un Mientras se repite hasta ganar o perder, y en cada letra se arma de nuevo el progreso con Subcadena.",
    challenge: "Avisa cuando el jugador repite una letra que ya había probado, sin contarla como error.",
    hint: "Guarda las letras usadas en un texto y revisa si la nueva ya está ahí recorriéndolo con Subcadena.",
  },
  contacts: {
    label: "Agenda de contactos",
    description: "Agrega, lista y busca contactos en una agenda que crece.",
    learn:
      "Redimensionar hace crecer dos arreglos paralelos cada vez que agregas un contacto. Un menú con Segun dentro de Repetir ... Hasta Que organiza las opciones.",
    challenge: "Agrega una opción para contar cuántos contactos empiezan con una letra dada.",
    hint: "Compara Mayusculas(Subcadena(nombres[i], 1, 1)) con la letra que leíste.",
  },
};
