import type { ReferenceSiteCopy } from "./reference-types";

// Páginas públicas de la referencia del lenguaje (/es/referencia/<slug>).
// Los títulos usan las palabras con que se busca («Mientras en PSeInt»);
// las explicaciones vienen de la guía compartida (src/i18n/reference-guide/es.ts).
export const esReferenceSite: ReferenceSiteCopy = {
  section: "Referencia",
  index: {
    title: "Referencia de PSeInt: instrucciones y operadores",
    description:
      "Todas las instrucciones, operadores y funciones del pseudocódigo estilo PSeInt explicadas desde cero, con un ejemplo que funciona y su diagrama de flujo.",
    h1: "Referencia del pseudocódigo PSeInt",
    intro: [
      "Cada palabra del lenguaje tiene su propia página: qué hace, un ejemplo completo con el resultado que muestra, el error más común y cómo se ve en el diagrama de flujo.",
      "Los ejemplos están escritos con la sintaxis de PSeInt y se comprobaron ejecutándolos en Codoritmo, un editor gratuito que funciona en el navegador. Puedes abrir cualquiera con un clic y cambiarlo.",
    ],
    groupIntros: {
      structures: "Las instrucciones con que se arma un algoritmo: leer y mostrar datos, decidir, repetir y dividir el programa en partes.",
      algebraic: "Las cuentas: suma, resta, multiplicación, división, potencia y el resto de una división.",
      logical: "Para combinar condiciones o darlas vuelta.",
      relational: "Para comparar dos valores. Siempre responden Verdadero o Falso.",
      math: "Funciones que ya vienen hechas para valores absolutos, redondeos, raíces y números al azar.",
      strings: "Funciones para medir, recortar, unir y convertir textos.",
      constants: "Valores que el lenguaje ya conoce.",
    },
    contents: "Contenido",
  },
  page: {
    whatItDoes: "Qué hace",
    example: "Ejemplo resuelto",
    exampleIntro: "Un algoritmo completo, listo para copiar y ejecutar.",
    result: "Resultado",
    resultIntro: "Esto es lo que muestra la consola al ejecutar el ejemplo.",
    resultWithInput: "Esto es lo que muestra la consola al ejecutar el ejemplo. Lo que escribe el usuario aparece resaltado.",
    noOutput: "Este ejemplo no muestra nada en la consola.",
    anotherExample: "Otro ejemplo",
    mistake: "Error común",
    note: "Para tener en cuenta",
    flowchart: "En el diagrama de flujo",
    flowchartIntro: "Así aparece en un diagrama de flujo, con las mismas formas que dibuja Codoritmo.",
    flowchartLink: "Dibuja el diagrama de flujo de tu propio algoritmo",
    template: "Plantilla",
    templateIntro: "La forma general. Reemplaza lo que está entre < > por tus propios datos.",
    usedIn: "Ejemplos que lo usan",
    usedInIntro: "Programas de la biblioteca de ejemplos donde aparece, de los más simples a los más completos.",
    seeAllConcept: "Ver todos los ejemplos de {concept}",
    siblings: "Más de {group}",
    open: "Ábrelo en Codoritmo",
    openHint: "Se abre en el editor con este ejemplo cargado. Ejecútalo paso a paso y mira el diagrama.",
    openLabel: "Abrir el ejemplo de {name} en Codoritmo",
    independent:
      "Codoritmo es un proyecto independiente y de código abierto, inspirado en PSeInt y compatible con su sintaxis. No está afiliado al proyecto PSeInt.",
    officialSite: "Sitio oficial de PSeInt",
    profilesLink: "perfiles de lenguaje",
    profilesHint: "Algunos detalles cambian según el perfil de tu escuela. Revisa los {link}.",
    backToIndex: "Toda la referencia",
    previous: "Anterior",
    next: "Siguiente",
    group: "Grupo",
  },
  shapes: {
    process: "rectángulo de proceso",
    input: "paralelogramo de entrada",
    output: "paralelogramo de salida",
    decision: "rombo de decisión",
    switch: "rombo de selección múltiple",
    loop: "hexágono de ciclo Para",
    call: "rectángulo de llamada a subproceso",
  },
  scenes: {
    single: "Diagrama de flujo: un {shape} con el texto «{label}», con una flecha que entra y otra que sale.",
    branches: "Diagrama de flujo: un {shape} con la condición «{label}»; la salida Sí sigue hacia abajo y la salida No se desvía a la derecha.",
    while:
      "Diagrama de flujo: un {shape} con la condición «{label}»; por Sí entra al bloque de instrucciones y vuelve a la condición, por No sale del ciclo.",
    "repeat-until":
      "Diagrama de flujo: primero el bloque de instrucciones y debajo un {shape} con la condición «{label}»; por No vuelve a repetir, por Sí sale.",
    "repeat-while":
      "Diagrama de flujo: primero el bloque de instrucciones y debajo un {shape} con la condición «{label}»; por Sí vuelve a repetir, por No sale.",
    for: "Diagrama de flujo: un {shape} con «{label}», el bloque de instrucciones debajo y una flecha que vuelve al hexágono en cada vuelta.",
    cases: "Diagrama de flujo: un {shape} con «{label}» y tres salidas: 1, 2 y De Otro Modo.",
  },
  sceneContext: {
    condition: "No tiene forma propia; se usa dentro de una condición.",
    process: "No tiene forma propia; se usa dentro de un cálculo.",
  },
  entries: {
    definir: {
      slug: "definir-variables",
      name: "Definir",
      h1: "Definir en PSeInt: cómo declarar variables",
      title: "Definir variables en PSeInt: tipos y ejemplo",
      description:
        "Cómo usar Definir en PSeInt para declarar variables Entero, Real, Caracter o Logico, con un ejemplo y el error más común al empezar.",
    },
    dimension: {
      slug: "dimension-arreglos",
      name: "Dimension",
      h1: "Dimension en PSeInt: cómo crear un arreglo",
      title: "Dimension en PSeInt: crear arreglos y ejemplo",
      description:
        "Qué hace Dimension en PSeInt, cómo crear un arreglo, guardar valores en sus casillas y desde qué número empiezan según el perfil.",
    },
    escribir: {
      slug: "escribir",
      name: "Escribir",
      h1: "Escribir en PSeInt: mostrar mensajes y valores",
      title: "Escribir en PSeInt: mostrar datos en pantalla",
      description:
        "Cómo usar Escribir en PSeInt para mostrar texto y variables en la consola, cómo mezclarlos con comas y el error de las comillas.",
    },
    "escribir-sin-bajar": {
      slug: "escribir-sin-saltar",
      name: "Escribir Sin Saltar",
      h1: "Escribir Sin Saltar en PSeInt: seguir en la misma línea",
      title: "Escribir Sin Saltar (Sin Bajar) en PSeInt",
      description:
        "Para qué sirve Escribir Sin Saltar (o Sin Bajar) en PSeInt: mostrar algo sin pasar a la línea siguiente, con un ejemplo y su salida.",
      note: "Sin Saltar y Sin Bajar significan lo mismo; puedes usar cualquiera de las dos.",
    },
    leer: {
      slug: "leer",
      name: "Leer",
      h1: "Leer en PSeInt: pedir datos al usuario",
      title: "Leer en PSeInt: cómo pedir datos al usuario",
      description:
        "Cómo funciona Leer en PSeInt para guardar lo que escribe el usuario en una variable, con un ejemplo completo y un consejo para la pregunta.",
    },
    asignar: {
      slug: "asignacion",
      name: "Asignación (<-)",
      h1: "Asignación en PSeInt: qué significa la flecha <-",
      title: "Asignación <- en PSeInt: guardar valores",
      description:
        "Qué significa la flecha <- en PSeInt, cómo guardar y actualizar el valor de una variable y por qué no es una igualdad matemática.",
      note: "Además de <- se acepta :=. Algunos perfiles también dejan asignar con =, pero <- evita confundirlo con una comparación.",
    },
    si: {
      slug: "si-entonces",
      name: "Si Entonces",
      h1: "Si Entonces en PSeInt: cómo tomar una decisión",
      title: "Si Entonces en PSeInt: condicional con ejemplo",
      description:
        "Cómo escribir una condición Si…Entonces…FinSi en PSeInt, qué pasa cuando es falsa y cómo se dibuja el rombo en el diagrama de flujo.",
    },
    "si-sino": {
      slug: "si-sino",
      name: "Si / SiNo",
      h1: "Si SiNo en PSeInt: una decisión con dos caminos",
      title: "SiNo en PSeInt: condicional doble con ejemplo",
      description:
        "Cómo usar Si…SiNo…FinSi en PSeInt para elegir entre dos caminos, con un ejemplo de aprobado o desaprobado y su diagrama de flujo.",
    },
    segun: {
      slug: "segun",
      name: "Segun",
      h1: "Segun en PSeInt: elegir entre varias opciones",
      title: "Segun en PSeInt: menú de opciones con ejemplo",
      description:
        "Cómo funciona Segun…Hacer en PSeInt para armar un menú, qué hace De Otro Modo y cuándo conviene más que varios Si seguidos.",
    },
    mientras: {
      slug: "mientras",
      name: "Mientras",
      h1: "Mientras en PSeInt: qué hace y ejemplo",
      title: "Mientras en PSeInt: ciclo while con ejemplo",
      description:
        "Cómo funciona el ciclo Mientras…Hacer en PSeInt, cuándo se detiene, un ejemplo con su resultado y cómo evitar un ciclo infinito.",
    },
    repetir: {
      slug: "repetir-hasta-que",
      name: "Repetir Hasta Que",
      h1: "Repetir Hasta Que en PSeInt: qué hace y ejemplo",
      title: "Repetir Hasta Que en PSeInt: ejemplo y diagrama",
      description:
        "Cómo funciona Repetir…Hasta Que en PSeInt, por qué se ejecuta al menos una vez y cómo usarlo para validar un dato hasta que sea correcto.",
    },
    "repetir-mientras": {
      slug: "repetir-mientras-que",
      name: "Repetir Mientras Que",
      h1: "Repetir Mientras Que en PSeInt: la otra forma de Repetir",
      title: "Repetir Mientras Que en PSeInt, con ejemplo",
      description:
        "Diferencia entre Repetir…Mientras Que y Repetir…Hasta Que en PSeInt, con un ejemplo que pide un número hasta que no sea negativo.",
    },
    para: {
      slug: "para",
      name: "Para",
      h1: "Para en PSeInt: el ciclo con contador",
      title: "Ciclo Para en PSeInt: ejemplo y Con Paso",
      description:
        "Cómo usar el ciclo Para…Hasta…Hacer en PSeInt, qué hace Con Paso, un ejemplo con su resultado y cuándo usar Para en vez de Mientras.",
    },
    "para-cada": {
      slug: "para-cada",
      name: "Para Cada",
      h1: "Para Cada en PSeInt: recorrer un arreglo",
      title: "Para Cada en PSeInt: recorrer arreglos",
      description:
        "Cómo usar Para Cada…De…Hacer en PSeInt para recorrer todas las casillas de un arreglo sin manejar posiciones, con un ejemplo y su salida.",
    },
    limpiar: {
      slug: "limpiar-pantalla",
      name: "Limpiar Pantalla",
      h1: "Limpiar Pantalla en PSeInt: borrar la consola",
      title: "Limpiar Pantalla en PSeInt: borrar la consola",
      description: "Qué hace Limpiar Pantalla en PSeInt, cuándo usarlo en menús y juegos, y un ejemplo para empezar a mostrar desde cero.",
    },
    esperar: {
      slug: "esperar",
      name: "Esperar",
      h1: "Esperar en PSeInt: hacer una pausa de segundos",
      title: "Esperar en PSeInt: pausas en segundos",
      description:
        "Cómo usar Esperar 1 Segundo (o milisegundos) en PSeInt para hacer una pausa antes de seguir, con un ejemplo de cuenta regresiva.",
      note: "También puedes indicar la pausa en milisegundos: Esperar 500 Milisegundos.",
    },
    "esperar-tecla": {
      slug: "esperar-tecla",
      name: "Esperar Tecla",
      h1: "Esperar Tecla en PSeInt: pausar hasta presionar una tecla",
      title: "Esperar Tecla en PSeInt: pausa hasta una tecla",
      description:
        "Qué hace Esperar Tecla en PSeInt: detener el programa hasta que la persona presione una tecla, con un ejemplo para pasar de pantalla.",
    },
    subproceso: {
      slug: "subproceso",
      name: "SubProceso",
      h1: "SubProceso en PSeInt: cómo crear y llamar uno",
      title: "SubProceso en PSeInt: cómo crearlo y llamarlo",
      description:
        "Cómo crear un SubProceso en PSeInt, pasarle parámetros y llamarlo desde el algoritmo principal, con un ejemplo y el paso Por Referencia.",
    },
    subalgoritmo: {
      slug: "subalgoritmo",
      name: "SubAlgoritmo",
      h1: "SubAlgoritmo en PSeInt: otro nombre para SubProceso",
      title: "SubAlgoritmo en PSeInt: qué es y ejemplo",
      description: "SubAlgoritmo en PSeInt funciona igual que SubProceso: agrupa instrucciones bajo un nombre. Ejemplo completo con la llamada.",
    },
    funcion: {
      slug: "funcion",
      name: "Funcion",
      h1: "Funcion en PSeInt: cómo devolver un resultado",
      title: "Funciones en PSeInt: cómo devolver un valor",
      description:
        "Cómo escribir una Funcion en PSeInt que calcula y devuelve un resultado, cómo llamarla dentro de una expresión y un ejemplo completo.",
    },
    retornar: {
      slug: "retornar",
      name: "Retornar",
      h1: "Retornar en PSeInt: terminar una función con un valor",
      title: "Retornar en PSeInt: devolver un valor",
      description: "Qué hace Retornar dentro de una Funcion en PSeInt: termina la función y devuelve el valor indicado. Ejemplo con el mayor de dos números.",
    },
    plus: {
      slug: "operador-suma",
      name: "Suma (+)",
      h1: "Suma en PSeInt: el operador +",
      title: "Operador + en PSeInt: sumar números y textos",
      description: "Cómo sumar con el operador + en PSeInt, cómo se usa para acumular un total y cuándo sirve también para unir textos.",
    },
    minus: {
      slug: "operador-resta",
      name: "Resta (-)",
      h1: "Resta en PSeInt: el operador -",
      title: "Operador - en PSeInt: resta y números negativos",
      description: "Cómo restar con el operador - en PSeInt, en qué orden se resuelven varias restas seguidas y cómo escribir un número negativo.",
    },
    multiply: {
      slug: "operador-multiplicacion",
      name: "Multiplicación (*)",
      h1: "Multiplicación en PSeInt: el operador *",
      title: "Operador * en PSeInt: multiplicar y prioridad",
      description: "Cómo multiplicar con * en PSeInt, por qué se resuelve antes que la suma y cómo usar paréntesis para cambiar el orden.",
    },
    divide: {
      slug: "operador-division",
      name: "División (/)",
      h1: "División en PSeInt: el operador /",
      title: "Operador / en PSeInt: división con decimales",
      description:
        "Cómo dividir con / en PSeInt, por qué el resultado puede tener decimales, cómo quedarte con la parte entera y qué pasa al dividir entre 0.",
    },
    power: {
      slug: "operador-potencia",
      name: "Potencia (^)",
      h1: "Potencia en PSeInt: el operador ^",
      title: "Potencia en PSeInt: elevar con el operador ^",
      description: "Cómo elevar un número a una potencia con ^ en PSeInt, con un ejemplo y su uso para calcular áreas y cuadrados.",
    },
    mod: {
      slug: "operador-mod",
      name: "MOD (%)",
      h1: "MOD en PSeInt: el resto de una división",
      title: "MOD en PSeInt: resto, pares y múltiplos",
      description:
        "Qué hace MOD (o %) en PSeInt: da el resto de una división. Úsalo para saber si un número es par o múltiplo de otro. Ejemplo con resultado.",
      note: "En lugar de MOD puedes escribir %. El símbolo funciona en todos los perfiles; la palabra MOD, en los que permiten operadores con palabras, como el perfil por defecto.",
    },
    and: {
      slug: "operador-y",
      name: "Y (&&)",
      h1: "Operador Y en PSeInt: cuando se deben cumplir dos condiciones",
      title: "Operador Y (&&) en PSeInt: unir condiciones",
      description:
        "Cómo usar el operador lógico Y (o &&) en PSeInt para exigir que dos condiciones se cumplan a la vez, con un ejemplo y su resultado.",
      note: "En lugar de Y puedes escribir &&. El símbolo funciona en todos los perfiles; la palabra Y, en los que permiten operadores con palabras, como el perfil por defecto.",
    },
    or: {
      slug: "operador-o",
      name: "O (||)",
      h1: "Operador O en PSeInt: cuando basta con una condición",
      title: "Operador O (||) en PSeInt: con ejemplo",
      description:
        "Cómo usar el operador lógico O (o ||) en PSeInt para que alcance con que una de las condiciones se cumpla, con un ejemplo y su resultado.",
      note: "En lugar de O puedes escribir ||. El símbolo funciona en todos los perfiles; la palabra O, en los que permiten operadores con palabras, como el perfil por defecto.",
    },
    not: {
      slug: "operador-no",
      name: "NO (~)",
      h1: "Operador NO en PSeInt: invertir una condición",
      title: "Operador NO (~) en PSeInt: negar condiciones",
      description: "Cómo usar el operador lógico NO (o ~) en PSeInt para invertir una condición, con un ejemplo y su resultado en la consola.",
      note: "En lugar de NO puedes escribir ~ o !. Los símbolos funcionan en todos los perfiles; la palabra NO, en los que permiten operadores con palabras.",
    },
    eq: {
      slug: "operador-igual",
      name: "Igual (=)",
      h1: "Comparar si dos valores son iguales en PSeInt (=)",
      title: "Operador = en PSeInt: comparar valores",
      description:
        "Cómo comparar con = en PSeInt, por qué no es lo mismo que la asignación <- y por qué \"Ana\" y \"ana\" no son iguales. Ejemplo con resultado.",
      note: "También se puede escribir == para comparar.",
    },
    neq: {
      slug: "operador-distinto",
      name: "Distinto (<>)",
      h1: "Distinto en PSeInt: los operadores <> y !=",
      title: "Distinto en PSeInt: operadores <> y !=",
      description: "Cómo preguntar si dos valores son distintos en PSeInt con <> o !=, con un ejemplo y cómo usarlo en una condición.",
      note: "<> y != significan lo mismo; usa el que te enseñaron en clase.",
    },
    lt: {
      slug: "operador-menor-que",
      name: "Menor que (<)",
      h1: "Menor que en PSeInt: el operador <",
      title: "Operador < en PSeInt: menor que, con ejemplo",
      description: "Cómo usar el operador < (menor que) en PSeInt para comparar dos valores dentro de una condición, con un ejemplo y su resultado.",
    },
    leq: {
      slug: "operador-menor-o-igual",
      name: "Menor o igual (<=)",
      h1: "Menor o igual en PSeInt: el operador <=",
      title: "Operador <= en PSeInt: menor o igual",
      description: "Cómo usar <= (menor o igual) en PSeInt, en qué se diferencia de < y un ejemplo para contar hasta un límite incluido.",
    },
    gt: {
      slug: "operador-mayor-que",
      name: "Mayor que (>)",
      h1: "Mayor que en PSeInt: el operador >",
      title: "Operador > en PSeInt: mayor que, con ejemplo",
      description: "Cómo usar el operador > (mayor que) en PSeInt para comparar dos valores dentro de una condición, con un ejemplo y su resultado.",
    },
    geq: {
      slug: "operador-mayor-o-igual",
      name: "Mayor o igual (>=)",
      h1: "Mayor o igual en PSeInt: el operador >=",
      title: "Operador >= en PSeInt: mayor o igual",
      description: "Cómo usar >= (mayor o igual) en PSeInt, en qué se diferencia de > y un ejemplo para saber si alguien es mayor de edad.",
    },
    abs: {
      slug: "funcion-abs",
      name: "Abs",
      h1: "Abs en PSeInt: el valor absoluto",
      title: "Abs en PSeInt: valor absoluto con ejemplo",
      description: "Qué hace la función Abs en PSeInt: devuelve el número sin signo. Ejemplo y uso para medir la diferencia entre dos valores.",
    },
    trunc: {
      slug: "funcion-trunc",
      name: "Trunc",
      h1: "Trunc en PSeInt: quedarte con la parte entera",
      title: "Trunc en PSeInt: parte entera sin redondear",
      description: "Qué hace Trunc en PSeInt: corta los decimales sin redondear. Ejemplo y diferencia con Redon para obtener un número entero.",
    },
    redon: {
      slug: "funcion-redon",
      name: "Redon",
      h1: "Redon en PSeInt: redondear al entero más cercano",
      title: "Redon en PSeInt: redondear números",
      description: "Cómo redondear con Redon en PSeInt, qué pasa con los números que terminan en .5 y en qué se diferencia de Trunc.",
    },
    raiz: {
      slug: "funcion-raiz",
      name: "Raiz",
      h1: "Raiz en PSeInt: calcular la raíz cuadrada",
      title: "Raíz cuadrada en PSeInt: la función Raiz",
      description: "Cómo calcular una raíz cuadrada en PSeInt con Raiz (o RC), con un ejemplo, su resultado y qué pasa con los números negativos.",
      note: "RC es otro nombre de la misma función: RC(81) también da 9.",
    },
    azar: {
      slug: "funcion-azar",
      name: "Azar",
      h1: "Azar en PSeInt: números aleatorios",
      title: "Azar en PSeInt: números aleatorios y dados",
      description:
        "Cómo generar números al azar en PSeInt con Azar, qué rango devuelve y cómo simular un dado del 1 al 6, con un ejemplo que funciona.",
    },
    longitud: {
      slug: "funcion-longitud",
      name: "Longitud",
      h1: "Longitud en PSeInt: cuántos caracteres tiene un texto",
      title: "Longitud en PSeInt: largo de un texto",
      description: "Qué hace Longitud en PSeInt: cuenta los caracteres de un texto, espacios incluidos. Ejemplo y uso para validar contraseñas.",
    },
    subcadena: {
      slug: "funcion-subcadena",
      name: "SubCadena",
      h1: "SubCadena en PSeInt: sacar una parte de un texto",
      title: "SubCadena en PSeInt: recortar textos",
      description: "Cómo usar SubCadena en PSeInt para sacar una parte de un texto entre dos posiciones, con un ejemplo y desde dónde se cuenta.",
    },
    concatenar: {
      slug: "funcion-concatenar",
      name: "Concatenar",
      h1: "Concatenar en PSeInt: unir dos textos",
      title: "Concatenar en PSeInt: unir textos",
      description: "Cómo unir dos textos con Concatenar en PSeInt, con un ejemplo y el detalle de los espacios que no se agregan solos.",
    },
    "convertir-numero": {
      slug: "funcion-convertiranumero",
      name: "ConvertirANumero",
      h1: "ConvertirANumero en PSeInt: de texto a número",
      title: "ConvertirANumero en PSeInt: texto a número",
      description: "Cómo convertir un texto en número con ConvertirANumero en PSeInt para poder hacer cuentas con él, con un ejemplo y su resultado.",
    },
    "convertir-texto": {
      slug: "funcion-convertiratexto",
      name: "ConvertirATexto",
      h1: "ConvertirATexto en PSeInt: de número a texto",
      title: "ConvertirATexto en PSeInt: número a texto",
      description: "Cómo convertir un número en texto con ConvertirATexto en PSeInt para unirlo con otros textos, con un ejemplo y su resultado.",
    },
    pi: {
      slug: "constante-pi",
      name: "PI",
      h1: "PI en PSeInt: el número π",
      title: "PI en PSeInt: calcular áreas de círculos",
      description: "Cómo usar la constante PI en PSeInt para calcular el área o el perímetro de un círculo, con un ejemplo completo y su resultado.",
    },
    euler: {
      slug: "constante-euler",
      name: "Euler",
      h1: "Euler en PSeInt: el número e",
      title: "Euler en PSeInt: la constante e",
      description: "Qué es la constante Euler (el número e ≈ 2.718) en PSeInt, para qué se usa y un ejemplo que muestra su valor.",
    },
  },
};
