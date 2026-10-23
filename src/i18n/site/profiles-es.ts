// Textos de las páginas públicas de perfiles (/es/perfiles y /es/perfiles/<slug>).
// Las descripciones de cada perfil vienen tal cual de PSeInt (bin/perfiles);
// aquí solo está lo que explica las reglas y arma las páginas.
// En los textos de reglas, lo que va entre `comillas invertidas` se muestra como código.

import type { EngineSettings } from "@/src/engine/types";

export type ProfileRuleKey = keyof EngineSettings;
export type ProfileRuleGroupId = "variables" | "writing" | "operators" | "arrays" | "loops" | "routines";

export interface ProfileRuleCopy {
  /** Nombre corto de la regla. */
  name: string;
  /** Qué significa cuando la regla está activada / desactivada. */
  on: string;
  off: string;
  /** Una línea para el resumen de diferencias. */
  shortOn: string;
  shortOff: string;
  /** Comentario que acompaña al ejemplo cuando la regla cambia respecto al predeterminado. */
  commentOn?: string;
  commentOff?: string;
}

export interface ProfilesCopy {
  section: string;
  breadcrumbLabel: string;
  credit: { before: string; link: string; after: string };
  independent: string;
  index: {
    title: string;
    description: string;
    h1: string;
    intro: string;
    whatTitle: string;
    whatBody: string[];
    whyTitle: string;
    whyBody: string[];
    howTitle: string;
    howSteps: string[];
    howDefault: string;
    generalTitle: string;
    generalIntro: string;
    schoolsTitle: string;
    schoolsIntro: string;
    jumpLabel: string;
    filterLabel: string;
    filterPlaceholder: string;
    filterEmpty: string;
    filterCount: { one: string; other: string };
    letterCount: { one: string; other: string };
    numbers: string;
  };
  page: {
    title: string;
    titleShort: string;
    description: string;
    h1: string;
    lead: string;
    sentBy: string;
    sentByNote: string;
    open: string;
    openHint: string;
    summaryTitle: string;
    summaryIntro: string;
    summaryNone: string;
    rulesTitle: string;
    rulesIntro: string;
    differs: string;
    differsLabel: string;
    exampleTitle: string;
    exampleIntro: string;
    exampleOutput: string;
    exampleOutputIntro: string;
    sameTitle: string;
    sameIntro: { one: string; other: string };
    similarTitle: string;
    similarIntro: string;
    similarItem: string;
    nextTitle: string;
    nextIntro: string;
    allProfiles: string;
    allProfilesHint: string;
    examples: string;
    examplesHint: string;
    reference: string;
    referenceHint: string;
    practice: string;
    practiceIntro: string;
    generalBadge: string;
  };
  groups: Record<ProfileRuleGroupId, { title: string; intro: string }>;
  rules: Record<ProfileRuleKey, ProfileRuleCopy>;
  example: {
    header: string;
    noRoutines: string;
    noStringFunctions: string;
    noResize: string;
    noForEach: string;
    noRepeatWhile: string;
    greeting: string;
    average: string;
    passed: string;
    failed: string;
    evenSum: string;
    oddSum: string;
    countdown: string;
    excellent: string;
    veryGood: string;
    keepGoing: string;
  };
}

export const esProfiles: ProfilesCopy = {
  section: "Perfiles",
  breadcrumbLabel: "Ruta de navegación",
  credit: {
    before: "Los perfiles y sus descripciones vienen de la carpeta bin/perfiles de ",
    link: "PSeInt",
    after: ", donde cada docente o institución envió el suyo. Codoritmo los incluye tal cual para que puedas practicar con las mismas reglas.",
  },
  independent:
    "Codoritmo es un proyecto independiente inspirado en PSeInt y compatible con su sintaxis; no es PSeInt ni está afiliado a sus autores.",
  index: {
    title: "Perfiles de PSeInt por escuela y universidad",
    description:
      "Encuentra el perfil de PSeInt de tu escuela entre más de 450 instituciones, entiende sus reglas en palabras simples y practica con él en Codoritmo.",
    h1: "Perfiles de PSeInt por escuela",
    intro:
      "Cada escuela, colegio o universidad puede pedir que el pseudocódigo se escriba de una forma distinta. Busca la tuya, mira qué reglas usa y ábrela en Codoritmo para practicar con exactamente esas reglas.",
    whatTitle: "Qué es un perfil",
    whatBody: [
      "Un perfil es un conjunto de reglas que decide cómo se escribe el pseudocódigo: si tienes que declarar cada variable con Definir, si las instrucciones terminan en punto y coma, si los arreglos empiezan en 0 o en 1, si puedes asignar con = o solo con <-, entre otras.",
      "PSeInt trae un perfil por cada institución que envió el suyo. Codoritmo lee los mismos perfiles, así que un programa que funciona aquí con tu perfil sigue las mismas reglas que te pide tu docente.",
    ],
    whyTitle: "Por qué importa el de tu escuela",
    whyBody: [
      "Si practicas con un perfil más permisivo, un programa que te funciona en casa puede marcar errores en el examen: por ejemplo, porque olvidaste un Definir o un punto y coma.",
      "Al revés también pasa: con un perfil más estricto que el de tu curso te vas a pelear con reglas que tu docente no pide. Usar el mismo perfil te ahorra esas sorpresas.",
    ],
    howTitle: "Cómo usar un perfil en Codoritmo",
    howSteps: [
      "Busca tu escuela en la lista de abajo y entra a su página.",
      "Pulsa «Abrir en Codoritmo con este perfil»: se abre el editor con un ejemplo y el perfil ya activado.",
      "Si ya tienes Codoritmo abierto, haz clic en el nombre del perfil en la barra inferior (o ve a Ejecutar › Perfil del lenguaje › Todos los perfiles…) y busca tu institución.",
    ],
    howDefault:
      "Si tu curso no tiene un perfil propio, empieza con Flexible, o con Estricto si tu docente pide declarar todo y cerrar cada instrucción con punto y coma.",
    generalTitle: "Perfiles generales",
    generalIntro: "No pertenecen a ninguna escuela: son los dos extremos que trae PSeInt para empezar.",
    schoolsTitle: "Perfiles de escuelas y universidades",
    schoolsIntro:
      "{count} perfiles ordenados por su nombre corto, que suele ser la sigla de la institución. Debajo de cada uno verás cómo se describe la institución que lo envió.",
    jumpLabel: "Ir a la letra",
    filterLabel: "Buscar tu escuela",
    filterPlaceholder: "Escribe la sigla, la ciudad o la materia…",
    filterEmpty: "Ningún perfil coincide con esa búsqueda. Prueba con la sigla de tu institución.",
    filterCount: { one: "{count} perfil coincide", other: "{count} perfiles coinciden" },
    letterCount: { one: "{count} perfil", other: "{count} perfiles" },
    numbers: "0–9",
  },
  page: {
    title: "Perfil PSeInt {name}: reglas y ejemplo",
    titleShort: "Perfil PSeInt {name}",
    description: "Perfil {name} de PSeInt{summary}: sus reglas explicadas en simple y un ejemplo para abrir en Codoritmo.",
    h1: "Perfil {name} de PSeInt",
    lead: "Estas son las reglas que usa el perfil {name}, explicadas en simple, con un ejemplo que las cumple y que puedes abrir en Codoritmo con un clic.",
    sentBy: "Cómo lo describe quien lo envió",
    sentByNote: "Texto original del perfil, tal como se distribuye con PSeInt.",
    open: "Abrir en Codoritmo con este perfil",
    openHint: "Se abre el ejemplo de esta página con el perfil {name} ya activado.",
    summaryTitle: "En resumen",
    summaryIntro: "Lo que cambia respecto al perfil predeterminado de Codoritmo:",
    summaryNone: "Este perfil usa las mismas reglas que el perfil predeterminado de Codoritmo.",
    rulesTitle: "Todas sus reglas",
    rulesIntro: "Las reglas marcadas son distintas a las del perfil predeterminado de Codoritmo; el resto se comporta igual.",
    differs: "Distinto al predeterminado",
    differsLabel: "Esta regla es distinta en el perfil predeterminado",
    exampleTitle: "Un ejemplo que cumple estas reglas",
    exampleIntro:
      "Calcula el promedio de tres notas. Está escrito para este perfil, y los comentarios señalan lo que cambia respecto al predeterminado. Lo comprobamos con el intérprete de Codoritmo usando estas mismas reglas.",
    exampleOutput: "Lo que muestra al ejecutarlo",
    exampleOutputIntro: "Esta es la salida real del ejemplo, ejecutado con el perfil {name}.",
    sameTitle: "Perfiles con las mismas reglas",
    sameIntro: {
      one: "Otro perfil usa exactamente estas reglas; lo que practiques aquí vale también para él.",
      other: "{count} perfiles usan exactamente estas reglas; lo que practiques aquí vale también para ellos.",
    },
    similarTitle: "Perfiles parecidos",
    similarIntro: "Estos perfiles se diferencian del tuyo en una sola regla.",
    similarItem: "Allí: {rule}",
    nextTitle: "Sigue practicando",
    nextIntro: "Ejemplos resueltos y la referencia de cada instrucción, para cuando quieras ir más allá de este ejemplo.",
    allProfiles: "Todos los perfiles",
    allProfilesHint: "Busca otra escuela o compara reglas.",
    examples: "Ejemplos resueltos",
    examplesHint: "Programas completos con diagrama de flujo y salida.",
    reference: "Referencia del lenguaje",
    referenceHint: "Qué hace cada instrucción, con ejemplos.",
    practice: "Ejemplos que tocan estas reglas",
    practiceIntro: "Se abren con el perfil predeterminado; cámbialo al tuyo desde la barra inferior del editor.",
    generalBadge: "Perfil general",
  },
  groups: {
    variables: { title: "Variables", intro: "Cómo se declaran y cuándo pueden usarse." },
    writing: { title: "Forma de escribir", intro: "Puntuación, palabras de cierre y cómo se asigna un valor." },
    operators: { title: "Operadores y condiciones", intro: "Cómo se escriben las comparaciones y se arma un texto." },
    arrays: { title: "Arreglos", intro: "Dónde empiezan los índices y cómo se fija el tamaño." },
    loops: { title: "Ciclos y Según", intro: "Qué formas de repetir y de elegir entre casos acepta." },
    routines: { title: "Subprocesos y funciones de texto", intro: "Qué herramientas extra tienes para organizar el programa." },
  },
  rules: {
    forceDefineVars: {
      name: "Declarar variables con Definir",
      on: "Obligatorio. Antes de usar una variable tienes que declararla con su tipo, por ejemplo `Definir edad Como Entero`. Esto incluye el contador de cada `Para`.",
      off: "Opcional. Puedes usar una variable sin declararla: su tipo se deduce del primer valor que guardas en ella.",
      shortOn: "Exige declarar cada variable con Definir",
      shortOff: "No exige declarar las variables",
      commentOn: "Este perfil exige declarar cada variable con Definir",
    },
    forceInitVars: {
      name: "Dar un valor antes de usar",
      on: "Obligatorio. Leer una variable, o una casilla de un arreglo, que todavía no tiene valor detiene el programa con un error. Por eso los acumuladores empiezan con algo como `suma <- 0`.",
      off: "No se revisa. Igual conviene darle valor a cada variable antes de usarla.",
      shortOn: "Exige dar un valor a cada variable antes de usarla",
      shortOff: "No revisa que las variables tengan valor",
      commentOn: "Toda variable necesita un valor antes de usarse",
    },
    protectForCounter: {
      name: "Contador del Para protegido",
      on: "Dentro de un `Para` no puedes cambiar el contador, y cuando el ciclo termina el contador queda sin valor, así que no lo uses después.",
      off: "Puedes cambiar el contador dentro del `Para` y seguir usándolo cuando el ciclo termina.",
      shortOn: "Protege el contador del Para",
      shortOff: "Deja modificar el contador del Para",
      commentOn: "Dentro del Para no puedes cambiar i",
    },
    allowAccents: {
      name: "Tildes y ñ en los nombres",
      on: "Permitidas: una variable puede llamarse `año` o `posición`.",
      off: "No se permiten en nombres de variables ni de subprocesos: escribe `anio` o `posicion`. Las palabras clave con tilde, como `Según`, siguen funcionando.",
      shortOn: "Permite tildes y ñ en los nombres",
      shortOff: "No permite tildes ni ñ en los nombres de variables",
      commentOff: "Los nombres de variables van sin tildes ni ñ",
    },
    forceSemicolon: {
      name: "Punto y coma al final",
      on: "Obligatorio. Cada instrucción termina en `;`, como en `Escribir \"Hola\";`. Las líneas que abren o cierran estructuras (`Si`, `FinSi`, `FinPara`) no lo llevan.",
      off: "Opcional. Puedes terminar las instrucciones con `;` o sin él.",
      shortOn: "Exige punto y coma al final de cada instrucción",
      shortOff: "No exige punto y coma",
      commentOn: "Cada instrucción termina en punto y coma",
    },
    lazySyntax: {
      name: "Sintaxis flexible",
      on: "Acepta variantes cómodas: `Fin Si` separado, `Entonces` y `Hacer` opcionales, `Mientras Que` y `Desde` en los ciclos, y valores en `Escribir` separados por espacios.",
      off: "Estricta: escribe cada estructura completa, con `Entonces`, `Hacer` y cierres de una sola palabra como `FinSi` y `FinMientras`.",
      shortOn: "Acepta formas abreviadas como Fin Si u omitir Entonces",
      shortOff: "Exige escribir Entonces, Hacer y cierres como FinSi completos",
      commentOff: "Sintaxis estricta: Entonces, Hacer y FinSi siempre completos",
    },
    overloadEqual: {
      name: "Asignar con =",
      on: "Permitido: además de `x <- 5` puedes escribir `x = 5`. Dentro de una condición, `=` sigue siendo una comparación.",
      off: "No permitido: para asignar se usa solo `<-`; el `=` sirve únicamente para comparar.",
      shortOn: "Permite asignar con = además de <-",
      shortOff: "Solo se asigna con <-",
      commentOn: "En este perfil también puedes asignar con =",
    },
    wordOperators: {
      name: "Operadores con palabras",
      on: "Puedes escribir `Y`, `O`, `NO` y `MOD`, además de sus símbolos `&`, `|`, `~` y `%`.",
      off: "Solo símbolos: `&` en lugar de Y, `|` en lugar de O, `~` en lugar de NO y `%` en lugar de MOD.",
      shortOn: "Acepta Y, O, NO y MOD como operadores",
      shortOff: "Usa solo los símbolos & | ~ % como operadores",
      commentOff: "Sin operadores con palabras: & en lugar de Y, % en lugar de MOD",
    },
    colloquialConditions: {
      name: "Condiciones en lenguaje natural",
      on: "Acepta condiciones como `x Es Par`, `x Es Mayor Que 5` o `x Es Divisible Por 3`.",
      off: "No las acepta: escribe la comparación con operadores, como `x MOD 2 = 0` o `x > 5`.",
      shortOn: "Acepta condiciones como Es Par o Es Mayor Que",
      shortOff: "No acepta condiciones como Es Par: se escriben con operadores",
      commentOff: "No acepta «Es Par»: la condición se escribe con operadores",
    },
    allowConcatenation: {
      name: "Unir textos con +",
      on: "Permitido: `\"Hola, \" + nombre` forma un solo texto.",
      off: "No permitido: para mostrar varios valores juntos, sepáralos con comas en `Escribir`.",
      shortOn: "Permite unir textos con +",
      shortOff: "No permite unir textos con +",
      commentOff: "+ no une textos: en Escribir se separan con comas",
    },
    enableStringFunctions: {
      name: "Funciones de texto",
      on: "Disponibles: `Longitud`, `Subcadena`, `Mayusculas`, `Minusculas` y `Concatenar`.",
      off: "No disponibles: este perfil no incluye `Longitud`, `Subcadena`, `Mayusculas`, `Minusculas` ni `Concatenar`.",
      shortOn: "Incluye las funciones de texto como Longitud",
      shortOff: "No incluye funciones de texto como Longitud o Subcadena",
    },
    enableUserFunctions: {
      name: "Subprocesos y funciones propias",
      on: "Puedes crear tus propios `SubProceso` o `Funcion` para dividir el programa en partes.",
      off: "No permitidos: todo el programa va dentro de `Algoritmo … FinAlgoritmo`.",
      shortOn: "Permite crear SubProceso y Funcion",
      shortOff: "No permite crear SubProceso ni Funcion",
    },
    baseZeroArrays: {
      name: "Primer índice de los arreglos",
      on: "Empiezan en 0: después de `Dimension notas[3]` las casillas son `notas[0]`, `notas[1]` y `notas[2]`.",
      off: "Empiezan en 1: después de `Dimension notas[3]` las casillas son `notas[1]`, `notas[2]` y `notas[3]`.",
      shortOn: "Los arreglos empiezan en 0",
      shortOff: "Los arreglos empiezan en 1",
      commentOn: "Los arreglos empiezan en 0: las casillas son 0, 1 y 2",
      commentOff: "Los arreglos empiezan en 1: las casillas son 1, 2 y 3",
    },
    allowDynamicDimensions: {
      name: "Tamaño del arreglo con variables",
      on: "Permitido: puedes leer `n` y después escribir `Dimension datos[n]`.",
      off: "No permitido: el tamaño en `Dimension` tiene que ser un número fijo, como `Dimension datos[10]`.",
      shortOn: "Permite dimensionar arreglos con variables",
      shortOff: "El tamaño de los arreglos tiene que ser un número fijo",
      commentOff: "El tamaño del arreglo tiene que ser un número fijo",
    },
    allowResizeArrays: {
      name: "Redimensionar arreglos",
      on: "Puedes cambiar el tamaño de un arreglo que ya existe con `Redimensionar`.",
      off: "Un arreglo conserva el tamaño con el que lo creaste: `Redimensionar` no está disponible.",
      shortOn: "Permite Redimensionar arreglos",
      shortOff: "No permite Redimensionar arreglos",
    },
    allowForEach: {
      name: "Ciclo Para Cada",
      on: "Disponible: `Para Cada nota de notas Hacer` recorre todas las casillas de un arreglo.",
      off: "No disponible: recorre los arreglos con un `Para` y un índice.",
      shortOn: "Incluye el ciclo Para Cada",
      shortOff: "No incluye el ciclo Para Cada",
    },
    allowRepeatWhile: {
      name: "Repetir … Mientras Que",
      on: "Un `Repetir` puede cerrar con `Hasta Que condición` o con `Mientras Que condición`.",
      off: "Un `Repetir` solo puede cerrar con `Hasta Que condición`.",
      shortOn: "Repetir puede cerrar con Mientras Que",
      shortOff: "Repetir solo cierra con Hasta Que",
    },
    deduceNegativeForStep: {
      name: "Para que cuenta hacia atrás",
      on: "Si el inicio es mayor que el final, el `Para` baja de uno en uno aunque no escribas `Con Paso -1`.",
      off: "Para contar hacia atrás tienes que escribir `Con Paso -1`; sin eso, un `Para i <- 3 Hasta 1` no da ninguna vuelta.",
      shortOn: "El Para cuenta hacia atrás solo",
      shortOff: "Para contar hacia atrás hay que escribir Con Paso -1",
      commentOff: "Para contar hacia atrás hace falta Con Paso -1",
    },
    integerOnlySwitch: {
      name: "Según con números enteros",
      on: "El valor que revisa un `Segun` y sus opciones tienen que ser números enteros.",
      off: "El valor que revisa un `Segun` también puede ser un texto, con opciones como `\"a\"`.",
      shortOn: "Según solo trabaja con números enteros",
      shortOff: "Según también acepta textos",
      commentOn: "Segun solo acepta números enteros",
    },
  },
  example: {
    header: "Ejemplo escrito con las reglas del perfil {name}",
    noRoutines: "Este perfil no permite SubProceso ni Funcion: todo va dentro del Algoritmo",
    noStringFunctions: "Longitud, Mayusculas y las demás funciones de texto no están disponibles",
    noResize: "Este arreglo no se puede Redimensionar",
    noForEach: "Sin Para Cada: el arreglo se recorre con un índice",
    noRepeatWhile: "Repetir solo puede cerrar con Hasta Que",
    greeting: "Hola, ",
    average: "Promedio: ",
    passed: "Aprobado",
    failed: "Reprobado",
    evenSum: "La suma es par: ",
    oddSum: "La suma es impar: ",
    countdown: "Cuenta regresiva:",
    excellent: "La primera nota es excelente",
    veryGood: "La primera nota es muy buena",
    keepGoing: "La primera nota puede mejorar",
  },
};
