import type { ReferenceGuide } from "./types";

// Explicaciones para quien nunca ha programado: qué hace, para qué sirve, un
// ejemplo real con su resultado y el error más común. {and} {or} {not} {mod}
// se reemplazan por los operadores del perfil activo (Y / &&, MOD / %…).
// Los resultados están comprobados contra el motor (src/__tests__/reference-guide.test.ts).
export const esReferenceGuide: ReferenceGuide = {
  definir: {
    body: "Le avisa al programa qué variables vas a usar y qué tipo de dato guardará cada una. Una variable es como una caja con nombre: Entero guarda números sin decimales, Real números con decimales, Caracter texto y Logico Verdadero o Falso.",
    example: "Definir edad Como Entero\nDefinir nombre Como Caracter",
    outcome: "Crea las cajas edad y nombre, vacías hasta que les guardes algo.",
    tip: "Definir no le da valor a la variable; para eso usa <- o Leer.",
  },
  dimension: {
    body: "Crea un arreglo: una fila de cajas con un mismo nombre, numeradas. Sirve cuando necesitas guardar muchos datos del mismo tipo, como las notas de un curso, sin inventar una variable para cada uno.",
    example: "Dimension notas[5]\nnotas[1] <- 18",
    outcome: "Crea 5 casillas (notas[1] a notas[5]) y guarda 18 en la primera.",
    tip: "Según el perfil, las casillas empiezan en 1 o en 0.",
  },
  escribir: {
    body: "Muestra un mensaje o un valor en la consola, que es la forma en que tu programa le habla a quien lo usa. Puedes mezclar texto entre comillas y variables separándolos con comas.",
    example: 'nombre <- "Ana"\nEscribir "Hola, ", nombre',
    outcome: "Muestra: Hola, Ana",
    tip: "El texto va entre comillas; las variables, sin comillas.",
  },
  "escribir-linea": {
    body: "Muestra uno o más valores en la consola y pasa a la línea siguiente, como cuando presionas Enter al escribir.",
    example: 'Escribir "Total: ", 3 + 4',
    outcome: "Muestra: Total: 7",
  },
  "escribir-sin-bajar": {
    body: "Igual que Escribir, pero se queda en la misma línea. Útil para que la respuesta del usuario aparezca junto a la pregunta.",
    example: 'Escribir "Hola " Sin Saltar\nEscribir "mundo"',
    outcome: "Muestra en una sola línea: Hola mundo",
  },
  leer: {
    body: "Detiene el programa y espera a que la persona escriba algo; lo que escriba se guarda en la variable. Así tu programa puede trabajar con datos distintos cada vez.",
    example: 'Escribir "¿Cuántos años tienes?"\nLeer edad',
    outcome: "Si escribes 15, la variable edad pasa a valer 15.",
    tip: "Avisa primero con Escribir qué dato esperas; si no, la persona no sabrá qué escribir.",
  },
  asignar: {
    body: "Guarda un valor en una variable. La flecha <- se lee «recibe»: lo de la derecha se calcula primero y el resultado entra en la caja de la izquierda, reemplazando lo que hubiera.",
    example: "puntos <- 10\npuntos <- puntos + 5",
    outcome: "puntos termina valiendo 15.",
    tip: "No es una igualdad matemática: puntos <- puntos + 5 significa «súmale 5 a puntos».",
  },
  si: {
    body: "Hace que el programa tome una decisión: si la condición es verdadera, ejecuta las instrucciones de adentro; si es falsa, se las salta. En el diagrama es un rombo con dos salidas.",
    example: 'Si edad >= 18 Entonces\n\tEscribir "Puedes votar"\nFinSi',
    outcome: "Con edad 20 muestra «Puedes votar»; con 15 no muestra nada.",
  },
  "si-sino": {
    body: "Una decisión con dos caminos: uno para cuando la condición es verdadera y otro (SiNo) para cuando es falsa. Siempre se ejecuta exactamente uno de los dos.",
    example: 'Si nota >= 11 Entonces\n\tEscribir "Aprobado"\nSiNo\n\tEscribir "Desaprobado"\nFinSi',
    outcome: "Con nota 14 muestra «Aprobado»; con 8, «Desaprobado».",
  },
  segun: {
    body: "Elige un camino entre muchos según el valor de una variable, como un menú. Es más ordenado que encadenar muchos Si cuando comparas la misma variable con varios valores.",
    example: 'Segun opcion Hacer\n\t1: Escribir "Jugar"\n\t2: Escribir "Salir"\n\tDe Otro Modo: Escribir "Opción no válida"\nFinSegun',
    outcome: "Con opcion 2 muestra «Salir».",
    tip: "De Otro Modo atrapa cualquier valor que no esté en la lista.",
  },
  mientras: {
    body: "Repite un grupo de instrucciones mientras la condición siga siendo verdadera. Revisa la condición antes de cada vuelta, así que si ya es falsa al principio, no se repite ninguna vez.",
    example: "contador <- 1\nMientras contador <= 3 Hacer\n\tEscribir contador\n\tcontador <- contador + 1\nFinMientras",
    outcome: "Muestra 1, 2 y 3, uno por línea.",
    tip: "Algo de adentro debe cambiar la condición; si no, el ciclo nunca termina.",
  },
  repetir: {
    body: "Repite un grupo de instrucciones y revisa la condición al final de cada vuelta, así que siempre se ejecuta al menos una vez. Ideal para pedir un dato hasta que sea válido.",
    example: 'Repetir\n\tEscribir "Escribe un número positivo"\n\tLeer n\nHasta Que n > 0',
    outcome: "Vuelve a preguntar mientras escribas 0 o negativos.",
  },
  "repetir-hasta": {
    body: "Repite y se detiene cuando la condición se vuelve verdadera. Se ejecuta al menos una vez porque la condición se revisa al final.",
    example: 'Repetir\n\tLeer clave\nHasta Que clave = "1234"',
    outcome: "Sigue pidiendo la clave hasta que escribas 1234.",
  },
  "repetir-mientras": {
    body: "Repite y sigue mientras la condición sea verdadera; se detiene cuando se vuelve falsa. Es lo opuesto de Hasta Que.",
    example: "Repetir\n\tLeer n\nMientras Que n < 0",
    outcome: "Sigue pidiendo mientras el número sea negativo.",
  },
  para: {
    body: "Repite un número conocido de veces. Una variable contadora empieza en un valor, avanza de a uno (o de a lo que indiques con Con Paso) y el ciclo termina al pasar el valor final.",
    example: "Para i <- 1 Hasta 5 Hacer\n\tEscribir i * 2\nFinPara",
    outcome: "Muestra 2, 4, 6, 8 y 10.",
    tip: "Usa Para cuando sabes cuántas vueltas darás; Mientras cuando depende de algo que pasa adentro.",
  },
  "para-cada": {
    body: "Recorre un arreglo de principio a fin; en cada vuelta, la variable toma el valor de la casilla siguiente. Así no tienes que manejar posiciones.",
    example: "Para Cada nota De notas Hacer\n\tEscribir nota\nFinPara",
    outcome: "Muestra cada nota del arreglo, en orden.",
  },
  limpiar: {
    body: "Borra todo lo que hay en la consola, para empezar a mostrar desde una pantalla limpia. Útil en menús y juegos.",
    example: 'Limpiar Pantalla\nEscribir "Nivel 2"',
    outcome: "La consola queda vacía y luego muestra «Nivel 2».",
  },
  esperar: {
    body: "Hace una pausa antes de seguir con la próxima instrucción. Sirve para dar tiempo a leer un mensaje o para animaciones simples.",
    example: 'Escribir "3..."\nEsperar 1 Segundo\nEscribir "2..."',
    outcome: "Muestra «3...», espera un segundo y luego «2...».",
  },
  "esperar-tecla": {
    body: "Detiene el programa hasta que la persona presione una tecla. Útil para avanzar de una pantalla a otra a su propio ritmo.",
    example: 'Escribir "Presiona una tecla para continuar"\nEsperar Tecla',
    outcome: "El programa se queda quieto hasta que presionas una tecla.",
  },
  rutina: {
    body: "Agrupa instrucciones bajo un nombre para usarlas cuando quieras, como una receta. Divide un programa largo en partes que se entienden solas y evita repetir código.",
    example: 'SubProceso Saludar(nombre)\n\tEscribir "Hola, ", nombre\nFinSubProceso',
    outcome: "Luego, Saludar(\"Ana\") muestra «Hola, Ana».",
  },
  subproceso: {
    body: "Agrupa instrucciones bajo un nombre para usarlas cuando quieras, como una receta. Puede recibir datos (parámetros) con los que trabajar.",
    example: 'SubProceso Saludar(nombre)\n\tEscribir "Hola, ", nombre\nFinSubProceso',
    outcome: "Luego, Saludar(\"Ana\") muestra «Hola, Ana».",
    tip: "Un parámetro Por Referencia permite que el subproceso cambie la variable original.",
  },
  subalgoritmo: {
    body: "Otro nombre para SubProceso: agrupa instrucciones bajo un nombre para reutilizarlas. Funciona exactamente igual.",
    example: "SubAlgoritmo Linea()\n\tEscribir \"----------\"\nFinSubAlgoritmo",
    outcome: "Cada vez que llames a Linea() se dibuja una línea.",
  },
  funcion: {
    body: "Una rutina que calcula algo y devuelve el resultado, para usarlo dentro de una expresión, igual que Raiz o Abs. La variable antes de <- es la que se devuelve.",
    example: "Funcion r <- Doble(n)\n\tr <- n * 2\nFinFuncion",
    outcome: "Luego, Escribir Doble(21) muestra 42.",
  },
  retornar: {
    body: "Termina la función en ese punto y devuelve el valor indicado a quien la llamó.",
    example: "Funcion r <- Maximo(a, b)\n\tSi a > b Entonces\n\t\tRetornar a\n\tFinSi\n\tRetornar b\nFinFuncion",
    outcome: "Maximo(3, 9) devuelve 9.",
  },
  plus: {
    body: "Suma dos números. Con texto, según el perfil, también los une uno tras otro.",
    example: "Escribir 7 + 5",
    outcome: "Muestra: 12",
  },
  minus: {
    body: "Resta el número de la derecha al de la izquierda. Escrito delante de un número, lo vuelve negativo.",
    example: "Escribir 10 - 3 - 2",
    outcome: "Muestra: 5 (se resuelve de izquierda a derecha: 10 - 3 = 7, 7 - 2 = 5)",
  },
  multiply: {
    body: "Multiplica dos números. Se resuelve antes que la suma y la resta, igual que en matemáticas.",
    example: "Escribir 2 + 3 * 4",
    outcome: "Muestra: 14 (primero 3 * 4 = 12, después 2 + 12)",
    tip: "Usa paréntesis para cambiar el orden: (2 + 3) * 4 da 20.",
  },
  divide: {
    body: "Divide el número de la izquierda entre el de la derecha. El resultado puede tener decimales.",
    example: "Escribir 7 / 2",
    outcome: "Muestra: 3.5",
    tip: "Para quedarte solo con la parte entera usa Trunc(7 / 2), que da 3. Dividir entre 0 es un error.",
  },
  power: {
    body: "Eleva un número a una potencia: lo multiplica por sí mismo tantas veces como indique el exponente.",
    example: "Escribir 2 ^ 10",
    outcome: "Muestra: 1024 (2 multiplicado por sí mismo 10 veces)",
  },
  mod: {
    body: "Da el resto (lo que sobra) de una división entera. Muy útil para saber si un número es par (n {mod} 2 = 0) o si uno es múltiplo de otro.",
    example: "Escribir 17 {mod} 5",
    outcome: "Muestra: 2 (17 entre 5 cabe 3 veces y sobran 2)",
  },
  and: {
    body: "Une dos condiciones y es verdadero solo si ambas lo son. Piensa en «necesito esto y también aquello».",
    example: "Escribir (5 > 3) {and} (2 > 8)",
    outcome: "Muestra: FALSO (la primera es verdadera, pero la segunda no)",
    tip: "Ejemplo real: edad >= 13 {and} edad <= 19 es verdadero solo para adolescentes.",
  },
  or: {
    body: "Une dos condiciones y es verdadero si al menos una lo es. Piensa en «me sirve esto o aquello».",
    example: "Escribir (5 > 3) {or} (2 > 8)",
    outcome: "Muestra: VERDADERO (basta con que la primera lo sea)",
  },
  not: {
    body: "Invierte una condición: lo verdadero pasa a ser falso y lo falso, verdadero.",
    example: "Escribir {not} (5 > 3)",
    outcome: "Muestra: FALSO (5 > 3 es verdadero y {not} lo invierte)",
  },
  eq: {
    body: "Pregunta si dos valores son iguales y responde Verdadero o Falso. Se usa en condiciones, como en Si o Mientras.",
    example: 'Escribir "Ana" = "ana"',
    outcome: "Muestra: FALSO (mayúsculas y minúsculas cuentan como distintas)",
    tip: "= compara; para guardar un valor en una variable se usa <-.",
  },
  neq: {
    body: "Pregunta si dos valores son distintos. Es verdadero cuando no son iguales. También se puede escribir <>.",
    example: "Escribir 3 <> 4",
    outcome: "Muestra: VERDADERO",
  },
  lt: {
    body: "Pregunta si el valor de la izquierda es menor que el de la derecha. El lado abierto del signo mira hacia el número mayor.",
    example: "Escribir 3 < 8",
    outcome: "Muestra: VERDADERO",
  },
  leq: {
    body: "Pregunta si el valor de la izquierda es menor o igual que el de la derecha. Incluye el caso en que son iguales.",
    example: "Escribir 5 <= 5",
    outcome: "Muestra: VERDADERO (son iguales, y eso cuenta)",
  },
  gt: {
    body: "Pregunta si el valor de la izquierda es mayor que el de la derecha.",
    example: "Escribir 8 > 3",
    outcome: "Muestra: VERDADERO",
  },
  geq: {
    body: "Pregunta si el valor de la izquierda es mayor o igual que el de la derecha. Incluye el caso en que son iguales.",
    example: "Escribir 18 >= 18",
    outcome: "Muestra: VERDADERO (18 cumple «18 o más»)",
  },
  abs: {
    body: "Da el valor absoluto: el número sin su signo, o sea, qué tan lejos está del cero. Útil para medir diferencias sin importar cuál es mayor.",
    example: "Escribir Abs(-8)",
    outcome: "Muestra: 8",
  },
  trunc: {
    body: "Corta la parte decimal y se queda con la parte entera, sin redondear.",
    example: "Escribir Trunc(7.9)",
    outcome: "Muestra: 7 (no redondea a 8)",
  },
  redon: {
    body: "Redondea al entero más cercano. Si está justo en la mitad (.5), sube.",
    example: "Escribir Redon(2.5), \" \", Redon(2.4)",
    outcome: "Muestra: 3 2",
  },
  raiz: {
    body: "Calcula la raíz cuadrada: el número que, multiplicado por sí mismo, da el valor indicado.",
    example: "Escribir Raiz(81)",
    outcome: "Muestra: 9 (porque 9 * 9 = 81)",
    tip: "El valor no puede ser negativo.",
  },
  azar: {
    body: "Da un número entero al azar entre 0 y el número indicado menos uno. Cada vez que se ejecuta puede salir otro, como tirar un dado.",
    example: "dado <- Azar(6) + 1",
    outcome: "dado vale un número entre 1 y 6.",
    tip: "Azar(6) da de 0 a 5; por eso se le suma 1 para simular un dado.",
  },
  pi: {
    body: "El número π (pi), aproximadamente 3.1416: cuántas veces cabe el diámetro de un círculo en su contorno.",
    example: "area <- PI * radio ^ 2",
    outcome: "Con radio 2, area vale 12.5663706144.",
  },
  euler: {
    body: "El número e, aproximadamente 2.7183, base del crecimiento continuo (interés compuesto, poblaciones).",
    example: "Escribir Euler",
    outcome: "Muestra: 2.7182818285",
  },
  longitud: {
    body: "Cuenta cuántos caracteres tiene un texto, incluyendo espacios.",
    example: 'Escribir Longitud("hola")',
    outcome: "Muestra: 4",
  },
  subcadena: {
    body: "Saca un pedazo de un texto, desde una posición hasta otra (ambas incluidas).",
    example: 'Escribir SubCadena("pseudocodigo", 1, 6)',
    outcome: "Muestra: pseudo",
    tip: "Según el perfil, la primera letra está en la posición 1 o en la 0.",
  },
  concatenar: {
    body: "Une dos textos en uno, uno detrás del otro.",
    example: 'Escribir Concatenar("Hola, ", "Ana")',
    outcome: "Muestra: Hola, Ana",
    tip: "Los espacios no se agregan solos: ponlos dentro de las comillas.",
  },
  "convertir-numero": {
    body: "Convierte un texto que contiene un número en un número de verdad, para poder hacer cuentas con él.",
    example: 'Escribir ConvertirANumero("42") + 1',
    outcome: "Muestra: 43",
  },
  "convertir-texto": {
    body: "Convierte un número en texto, para unirlo con otros textos.",
    example: 'Escribir ConvertirATexto(42) + "!"',
    outcome: "Muestra: 42!",
  },
};
