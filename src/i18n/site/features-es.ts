// Spanish copy for the feature landing pages. {profiles} and {examples} are
// filled with the real counts when the page renders.

import type { FeaturesCopy } from "./features-types";

export const featuresEs: FeaturesCopy = {
  home: "Codoritmo",
  stepsCta: "Abrir en Codoritmo",
  differencesTitle: "Codoritmo y PSeInt de escritorio",
  codoritmoColumn: "Lo que suma Codoritmo",
  desktopColumn: "Lo que PSeInt de escritorio hace y Codoritmo todavía no",
  officialNote:
    "Codoritmo es un proyecto independiente, inspirado en PSeInt y compatible con su sintaxis y sus perfiles de instituciones. No es PSeInt ni está afiliado a él.",
  officialLinkLabel: "Sitio oficial de PSeInt",
  faqTitle: "Preguntas frecuentes",
  relatedFeaturesTitle: "Otras herramientas de Codoritmo",
  relatedExamplesTitle: "Ejemplos para probar",
  relatedExamplesIntro: "Programas resueltos, cada uno con su código, su diagrama y una ejecución de muestra.",
  keepLearningTitle: "Sigue aprendiendo",
  links: {
    examples: { title: "Biblioteca de ejemplos", body: "{examples} algoritmos resueltos, del «Hola mundo» a los ordenamientos." },
    reference: { title: "Referencia del lenguaje", body: "Cada instrucción y función de PSeInt explicada con un ejemplo." },
    profiles: { title: "Perfiles de instituciones", body: "Los {profiles} perfiles de PSeInt y qué reglas cambia cada uno." },
    about: { title: "Acerca de Codoritmo", body: "Qué es el proyecto, quién lo hace y cómo se relaciona con PSeInt." },
  },
  conceptLink: "Ejemplos de {concept}",
  conceptsTitle: "Por concepto",
  sourceTitle: "Pseudocódigo",
  generatedTitle: "{lang} generado por Codoritmo",
  generatedNote:
    "El código es exactamente el que genera Codoritmo para este programa, incluido el comentario del inicio, que siempre sale en español.",
  openExample: "Abrir en Codoritmo",
  examplePage: "Ver la página del ejemplo",
  mapping: {
    title: "Cómo se traduce cada instrucción",
    intro:
      "Cada fila es una instrucción de PSeInt traducida por Codoritmo dentro de un programa con n y i enteros, x real, nombre de texto y un arreglo datos[5]. El resultado se genera al construir esta página.",
    instruction: "Instrucción",
    pseint: "PSeInt",
    labels: {
      write: "Escribir",
      writeNoNewline: "Escribir sin salto de línea",
      readInteger: "Leer un entero",
      readReal: "Leer un real",
      assignRandom: "Número al azar",
      ifElse: "Si … SiNo",
      switch: "Segun",
      while: "Mientras",
      repeat: "Repetir … Hasta Que",
      for: "Para",
      arrayItem: "Elemento de un arreglo",
    },
  },
  trace: {
    caption: "Prueba de escritorio de «{name}»",
    step: "Paso",
    line: "Línea",
    instruction: "Instrucción",
    input: "Respuestas escritas",
    output: "Lo que muestra la consola",
    rowsShown: "{count} filas, una por cada paso con variables.",
  },
  flowchart: {
    label: "Diagrama de flujo de {name}",
    legendTitle: "Qué significa cada símbolo",
    legendIntro: "Son los mismos dibujos que usa el diagrama en vivo y la referencia del lenguaje.",
    shapes: [
      { id: "escribir", name: "Escribir", body: "Paralelogramo con una flecha hacia afuera: el programa muestra algo." },
      { id: "leer", name: "Leer", body: "Paralelogramo con una flecha hacia adentro: el programa espera un dato." },
      { id: "asignar", name: "Asignación y cálculo", body: "Rectángulo: guarda un valor en una variable." },
      { id: "si-sino", name: "Si … SiNo", body: "Rombo con dos salidas, Sí y No." },
      { id: "mientras", name: "Mientras", body: "Rombo con una línea punteada que vuelve a la condición mientras se cumpla." },
      { id: "para", name: "Para", body: "Hexágono: repite el cuerpo una cantidad conocida de veces." },
    ],
    galleryTitle: "Más diagramas generados",
    galleryIntro: "Diagramas de otros ejemplos de la biblioteca, generados igual que el de arriba.",
  },
  blocks: {
    codeTitle: "El pseudocódigo que escriben esos bloques",
  },
  features: {
    "pseint-online": {
      title: "Pseudocódigo PSeInt online, sin instalar nada",
      description:
        "Escribe y ejecuta pseudocódigo con la sintaxis de PSeInt en el navegador: paso a paso, diagrama de flujo y prueba de escritorio. Gratis y sin registro.",
      keywords: ["PSeInt online", "pseint en linea", "pseudocódigo online", "ejecutar pseudocódigo", "PSeInt sin instalar", "compilador de pseudocódigo"],
      name: "PSeInt online",
      summary: "Escribe y ejecuta pseudocódigo con la sintaxis de PSeInt desde el navegador.",
      h1: "Pseudocódigo PSeInt online, en tu navegador",
      lead:
        "Codoritmo es un editor de pseudocódigo gratuito que funciona en el navegador y entiende la sintaxis de PSeInt: Algoritmo, Definir, Leer, Escribir, Si, Mientras, Para y el resto. Abres la página, escribes tu algoritmo y lo ejecutas, sin instalar nada y sin crear una cuenta.",
      showcase: {
        title: "Así se ve un programa en ejecución",
        intro:
          "Captura real de Codoritmo con el ejemplo «Sumar hasta cero», en pausa en la línea 12 mientras espera el siguiente número. Ya se respondió 12, 7.5 y 30: el código marca la línea actual, el diagrama de flujo ilumina el mismo bloque y las variables muestran suma = 49.5.",
        alt:
          "Codoritmo ejecutando el algoritmo SumaHastaCero paso a paso: la línea 12 resaltada en el código, el bloque Leer numero iluminado en el diagrama de flujo, la consola con las respuestas 12, 7.5 y 30, y las variables cantidad 3, suma 49.5 y numero 30.",
      },
      stepsTitle: "Cómo ejecutar tu pseudocódigo en Codoritmo",
      steps: [
        { title: "Abre el espacio de trabajo", body: "Funciona en cualquier navegador moderno. La primera vez se abre con un ejemplo; con el botón + creas una pestaña en blanco." },
        {
          title: "Elige el perfil de tu curso",
          body: "En la barra inferior, el perfil del lenguaje te deja elegir entre {profiles} perfiles de instituciones que vienen de PSeInt. El perfil decide reglas como si los arreglos empiezan en 0 o en 1, o si es obligatorio definir las variables.",
        },
        { title: "Escribe o pega tu algoritmo", body: "El editor colorea la sintaxis, sugiere palabras clave y marca los errores mientras escribes, con la línea y una explicación." },
        {
          title: "Ejecuta o avanza paso a paso",
          body: "Pulsa Ejecutar, o usa Paso siguiente y Paso anterior para recorrerlo línea por línea. Cuando el programa pide un dato con Leer, lo escribes en la consola.",
        },
        {
          title: "Guarda o comparte",
          body: "Tus pestañas quedan guardadas en este navegador. Guardar descarga un archivo .psc, y «Copiar enlace para compartir» crea un enlace que abre tu algoritmo tal cual.",
        },
      ],
      cta: "Abrir este ejemplo en Codoritmo",
      ctaHint: "Se abre el mismo programa de la captura, listo para ejecutar.",
      notes: [
        {
          title: "Qué trae además del editor",
          paragraphs: [
            "Codoritmo dibuja el diagrama de flujo de tu algoritmo y lo anima mientras corre, llena la prueba de escritorio con el valor de cada variable en cada paso, muestra tus arreglos como casillas que cambian, mide la complejidad de tu algoritmo y traduce el pseudocódigo a C, C++, Java, Python o JavaScript.",
            "Incluye {examples} ejemplos resueltos, desde «Hola mundo» hasta ordenamientos y juegos, y una referencia del lenguaje con cada instrucción explicada.",
          ],
        },
      ],
      differences: {
        intro: "PSeInt es la herramienta original y sigue siendo la referencia. Esto es lo que cambia si usas Codoritmo.",
        codoritmo: [
          "Funciona en el navegador, sin instalar nada: sirve en la computadora del laboratorio, en una Chromebook o donde no te dejan instalar programas.",
          "Puedes retroceder paso a paso, no solo avanzar, y saltar a cualquier momento de la ejecución desde la línea de tiempo.",
          "La prueba de escritorio se llena sola con todas las variables.",
          "Compartes un algoritmo con un enlace.",
          "Modo de bloques, visualizador de arreglos y medición de complejidad.",
          "Como en PSeInt, puedes armar y editar el programa desde el diagrama de flujo, ver diagramas de Nassi-Shneiderman, evaluar expresiones en pausa, usar listas de respuestas predefinidas y exportar a C#, PHP, Pascal, Visual Basic, QBasic, MatLab y HTML.",
        ],
        desktop: [
          "Funciona sin internet, como programa instalado en Windows, macOS y Linux.",
          "Es la herramienta oficial: si tu curso corrige con PSeInt, prueba allí tu entrega final. Codoritmo sigue su sintaxis de cerca, pero no es idéntico en todos los casos.",
        ],
      },
      faq: [
        {
          q: "¿Codoritmo es PSeInt?",
          a: "No. Codoritmo es un proyecto independiente, inspirado en PSeInt y compatible con su sintaxis y sus perfiles de instituciones. No está afiliado a PSeInt. El programa oficial se descarga desde el sitio de PSeInt.",
        },
        {
          q: "¿Es gratis? ¿Necesito una cuenta?",
          a: "Es gratis y de código abierto (licencia GPL v2 o posterior), y no necesitas cuenta. Tus pestañas se guardan en el navegador que usas; si cambias de computadora, descarga tu archivo .psc o comparte el enlace.",
        },
        {
          q: "¿Puedo abrir mis archivos .psc?",
          a: "Sí. Con Archivo › Abrir… cargas un archivo .psc o .txt de tu computadora, y con Guardar lo descargas otra vez como .psc.",
        },
        {
          q: "¿Mi programa de PSeInt va a funcionar igual?",
          a: "En los ejercicios de clase, normalmente sí: Codoritmo entiende la misma sintaxis y respeta el perfil que elijas. Puede haber diferencias en casos poco comunes; si encuentras una, puedes reportarla en el repositorio del proyecto.",
        },
      ],
    },

    alternative: {
      title: "Alternativa a PSeInt en el navegador, gratis",
      description:
        "Codoritmo es una alternativa gratuita y de código abierto a PSeInt: usa su sintaxis y sus perfiles, y corre en el navegador. Compara qué hace cada uno.",
      keywords: ["alternativa a PSeInt", "PSeInt para Chromebook", "programa como PSeInt", "PSeInt vs", "editor de pseudocódigo gratis"],
      name: "Alternativa a PSeInt",
      summary: "Una comparación honesta entre Codoritmo y PSeInt de escritorio.",
      h1: "Una alternativa a PSeInt que corre en el navegador",
      lead:
        "Si usas PSeInt pero necesitas trabajar donde no puedes instalar programas, o quieres más herramientas para entender tu algoritmo, Codoritmo es una opción. Es independiente, gratuito, de código abierto y entiende el mismo pseudocódigo. Esta página compara los dos, incluido lo que PSeInt todavía hace y Codoritmo no.",
      showcase: {
        title: "Codoritmo y PSeInt de escritorio, punto por punto",
        intro: "Comparación según lo que hace hoy el código de Codoritmo y lo que ofrece la versión de escritorio de PSeInt.",
        alt:
          "Codoritmo ejecutando el algoritmo SumaHastaCero paso a paso, con la línea 12 resaltada, el diagrama de flujo iluminado en el mismo bloque y las variables cantidad, suma y numero.",
      },
      stepsTitle: "Cómo pasar de PSeInt a Codoritmo",
      steps: [
        { title: "Abre Codoritmo", body: "No hay nada que instalar. Tus pestañas quedan guardadas en el navegador." },
        { title: "Elige el mismo perfil", body: "En el perfil del lenguaje, busca tu institución entre los {profiles} perfiles que vienen de PSeInt, o usa el predeterminado." },
        { title: "Abre tu archivo", body: "Con Archivo › Abrir… cargas tu .psc tal como lo guardó PSeInt, o pegas el código en una pestaña nueva." },
        { title: "Ejecuta y compara", body: "Ejecútalo paso a paso y revisa la consola. Si algo se comporta distinto que en PSeInt, el panel Problemas indica la línea." },
      ],
      cta: "Probar Codoritmo con un ejemplo",
      ctaHint: "Abre un programa de ejemplo listo para ejecutar paso a paso.",
      notes: [
        {
          title: "Cuándo conviene cada uno",
          paragraphs: [
            "Usa PSeInt si tu docente lo pide para entregar o si necesitas trabajar sin internet.",
            "Usa Codoritmo si estás en una computadora donde no puedes instalar programas, si quieres ver tu algoritmo correr hacia adelante y hacia atrás, o si vas a pasar del pseudocódigo a Python, C o Java.",
            "También puedes usar los dos: un archivo .psc se abre en ambos.",
          ],
        },
      ],
      comparison: {
        feature: "Función",
        rows: [
          { feature: "Instalación", codoritmo: "Ninguna: se abre en el navegador", desktop: "Programa para Windows, macOS y Linux" },
          { feature: "Sin internet", codoritmo: "No: se abre desde la web", desktop: "Sí" },
          { feature: "Sintaxis", codoritmo: "La de PSeInt", desktop: "La original" },
          { feature: "Perfiles de instituciones", codoritmo: "Los {profiles} de PSeInt, con reglas ajustables", desktop: "Los suyos, con reglas ajustables" },
          { feature: "Paso a paso", codoritmo: "Hacia adelante y hacia atrás, con línea de tiempo", desktop: "Hacia adelante" },
          { feature: "Prueba de escritorio", codoritmo: "Automática, con todas las variables", desktop: "Eliges qué variables o expresiones seguir" },
          { feature: "Evaluar una expresión en pausa", codoritmo: "Sí, en cualquier paso, también al retroceder", desktop: "Sí" },
          { feature: "Diagrama de flujo", codoritmo: "Se genera del código, se anima al ejecutar y también se edita: puedes armar el programa desde el diagrama", desktop: "Se genera y también se edita: puedes armar el programa desde el diagrama" },
          { feature: "Diagrama de Nassi-Shneiderman (Chapin) y formas alternativas de entrada y salida", codoritmo: "Sí", desktop: "Sí" },
          { feature: "Listas de entradas predefinidas", codoritmo: "Sí, se guardan y se cargan desde un archivo .txt", desktop: "Sí, se guardan y se cargan desde un archivo" },
          { feature: "Exportar el diagrama", codoritmo: "PNG y SVG", desktop: "Imagen, y SVG en las versiones recientes" },
          { feature: "Bloques tipo Scratch", codoritmo: "Sí, conectados al código en los dos sentidos", desktop: "No" },
          { feature: "Traducir a otros lenguajes", codoritmo: "C, C++, Java, Python, JavaScript, C#, PHP, Pascal, Visual Basic, QBasic, MatLab y HTML", desktop: "Los mismos lenguajes" },
          { feature: "Arreglos y complejidad", codoritmo: "Visualizador de arreglos y medición de O grande", desktop: "No incluido" },
          { feature: "Compartir", codoritmo: "Un enlace que abre tu algoritmo", desktop: "El archivo .psc" },
          { feature: "Licencia", codoritmo: "Código abierto, GPL v2 o posterior", desktop: "Código abierto, GPL v2" },
        ],
      },
      faq: [
        {
          q: "¿Codoritmo reemplaza a PSeInt?",
          a: "No pretende reemplazarlo. PSeInt es la herramienta original y Codoritmo se inspira en ella. Codoritmo es otra forma de escribir el mismo pseudocódigo, pensada para el navegador.",
        },
        {
          q: "¿Puedo abrir en Codoritmo los archivos de PSeInt?",
          a: "Sí. Los archivos .psc son texto: los abres con Archivo › Abrir… y los guardas otra vez como .psc para seguir en PSeInt si quieres.",
        },
        {
          q: "¿Tiene los mismos perfiles que PSeInt?",
          a: "Incluye los {profiles} perfiles de instituciones que trae PSeInt, con su nombre y sus reglas, además de perfiles generales como Flexible y Estricto. También puedes ajustar cada regla a mano.",
        },
        {
          q: "¿Quién hace Codoritmo?",
          a: "Es un proyecto independiente de código abierto, sin relación con el equipo de PSeInt. El código está publicado en GitHub y cualquiera puede revisarlo o proponer cambios.",
        },
      ],
    },

    flowchart: {
      title: "Diagrama de flujo online desde tu pseudocódigo",
      description:
        "Escribe pseudocódigo PSeInt y obtén su diagrama de flujo al instante, con los símbolos de siempre. Míralo animarse al ejecutar y descárgalo en PNG o SVG.",
      keywords: ["diagrama de flujo online", "hacer diagrama de flujo", "pseudocódigo a diagrama de flujo", "diagrama de flujo PSeInt", "diagramas de flujo gratis"],
      name: "Diagrama de flujo online",
      summary: "El diagrama de flujo de tu algoritmo, generado del código y animado al ejecutar.",
      h1: "Diagramas de flujo online a partir de pseudocódigo",
      lead:
        "En Codoritmo no dibujas el diagrama a mano: escribes el algoritmo y el diagrama de flujo se genera solo, con los símbolos que se usan en clase. Si cambias el código, el diagrama cambia con él. Al ejecutar, una luz recorre los bloques para que veas por dónde va tu programa.",
      showcase: {
        title: "Un algoritmo y su diagrama",
        intro:
          "Este es el ejemplo «Sumar hasta cero» y el diagrama que Codoritmo genera para él, igual al que descargas en SVG. El ciclo Mientras vuelve a la condición por la línea punteada; la decisión Si se abre en dos ramas, Sí y No.",
      },
      stepsTitle: "Cómo hacer un diagrama de flujo en Codoritmo",
      steps: [
        { title: "Escribe o abre un algoritmo", body: "Escríbelo en el editor, pégalo o abre uno de los ejemplos." },
        {
          title: "Abre la pestaña Diagrama",
          body: "En el panel lateral, Diagrama muestra el diagrama de flujo. Si tu programa tiene subprocesos o funciones, eliges cuál ver.",
        },
        { title: "Ejecútalo y míralo moverse", body: "Con Ejecutar o Paso siguiente, el bloque que se está ejecutando se ilumina en el diagrama y en el código a la vez." },
        { title: "Descárgalo", body: "Archivo › Exportar como › Diagrama como imagen (.png) o Diagrama como vector (.svg), para tu informe o tu presentación." },
      ],
      cta: "Ver este diagrama en Codoritmo",
      ctaHint: "Abre el programa con el diagrama en el panel lateral.",
      notes: [
        {
          title: "Si el diagrama no aparece",
          paragraphs: [
            "El diagrama se construye a partir del código, así que necesita un algoritmo sin errores de sintaxis. Si falta un FinSi o un FinMientras, el panel Problemas te dice en qué línea está el error; al corregirlo, el diagrama vuelve a aparecer.",
          ],
        },
      ],
      differences: {
        intro: "PSeInt también genera diagramas de flujo. Estas son las diferencias.",
        codoritmo: [
          "El diagrama se genera solo y siempre coincide con el código.",
          "Se anima durante la ejecución, paso a paso, hacia adelante y hacia atrás.",
          "Se descarga en PNG o en SVG, que se ve nítido a cualquier tamaño.",
          "Como en PSeInt, puedes editarlo para escribir el código, cambiar a Nassi-Shneiderman y usar las formas alternativas de entrada y salida.",
        ],
        desktop: [
          "Funciona sin internet, como programa instalado.",
          "Es la herramienta oficial: si tu curso corrige con PSeInt, prueba allí tu entrega final.",
        ],
      },
      faq: [
        {
          q: "¿Puedo hacer un diagrama de flujo sin escribir código?",
          a: "Sí. Toca el + sobre cualquier flecha del diagrama para agregar una instrucción, haz doble clic en un bloque para cambiar su texto, y Codoritmo escribe el pseudocódigo por ti. También puedes usar el modo Bloques, arrastrando piezas como en Scratch.",
        },
        {
          q: "¿Qué símbolos usa?",
          a: "Los de siempre: óvalo para el inicio y el fin, rectángulo para asignaciones, paralelogramo para Leer y Escribir, rombo para las decisiones y hexágono para el ciclo Para.",
        },
        {
          q: "¿Cómo lo paso a Word o a una presentación?",
          a: "Descárgalo como PNG para pegarlo directamente, o como SVG si quieres que se vea nítido a cualquier tamaño.",
        },
        {
          q: "¿Funciona con subprocesos y funciones?",
          a: "Sí. Cada SubProceso o Funcion tiene su propio diagrama y eliges cuál ver en el panel.",
        },
      ],
    },

    "desk-check": {
      title: "Prueba de escritorio online, paso a paso",
      description:
        "Haz la prueba de escritorio de tu pseudocódigo PSeInt sin papel: Codoritmo anota el valor de cada variable en cada paso y te deja retroceder. Gratis.",
      keywords: ["prueba de escritorio", "prueba de escritorio online", "prueba de escritorio PSeInt", "tabla de seguimiento de variables", "rastreo de algoritmo"],
      name: "Prueba de escritorio",
      summary: "La tabla con el valor de cada variable en cada paso, llenada mientras el programa corre.",
      h1: "Prueba de escritorio online para tu pseudocódigo",
      lead:
        "La prueba de escritorio es la tabla donde sigues un algoritmo a mano: una fila por paso y una columna por variable. Codoritmo la llena mientras tu programa corre, para que compruebes tu tabla hecha en papel o encuentres el paso exacto donde una variable toma un valor que no esperabas.",
      showcase: {
        title: "Una prueba de escritorio real",
        intro:
          "Esta tabla sale de ejecutar el ejemplo «Sumar hasta cero» con las respuestas 12, 7.5, 30 y 0. Cada fila muestra las variables justo antes de ejecutar esa línea; las celdas resaltadas son las que cambiaron respecto de la fila anterior.",
      },
      stepsTitle: "Cómo hacer la prueba de escritorio en Codoritmo",
      steps: [
        { title: "Abre tu algoritmo", body: "Escríbelo, pégalo o abre un ejemplo." },
        { title: "Abre la prueba de escritorio", body: "En el panel inferior, elige la pestaña Prueba de escritorio." },
        { title: "Avanza paso a paso", body: "Usa Paso siguiente: cada paso agrega una fila. Si el programa pide datos, respóndelos en la consola." },
        {
          title: "Vuelve a cualquier paso",
          body: "Haz clic en una fila para volver a ese momento de la ejecución: el código y el diagrama se ubican en esa línea.",
        },
      ],
      cta: "Hacer esta prueba en Codoritmo",
      ctaHint: "Abre el mismo programa; responde 12, 7.5, 30 y 0 para obtener esta tabla.",
      notes: [
        {
          title: "Cómo leer la tabla",
          paragraphs: [
            "La columna Paso cuenta las instrucciones ejecutadas y Línea dice cuál fue. Una celda vacía significa que en ese paso la variable todavía no existe.",
            "Fíjate en que la línea 8, el Mientras, aparece una sola vez: al terminar cada vuelta la condición numero <> 0 se vuelve a revisar sin agregar una fila, y la ejecución sigue en la línea 9. Cuando numero vale 0, el ciclo termina y la ejecución salta al Si de la línea 14.",
          ],
        },
        {
          title: "Para qué sirve",
          paragraphs: [
            "Los docentes piden la prueba de escritorio para que entiendas qué hace cada instrucción. Hazla primero en papel y después compárala con la de Codoritmo: si no coinciden, la primera fila distinta te dice dónde está la diferencia.",
          ],
        },
      ],
      differences: {
        intro: "PSeInt también tiene prueba de escritorio dentro de su ejecución paso a paso. Así se comparan.",
        codoritmo: [
          "La tabla se llena sola con todas las variables, sin configurar nada.",
          "Puedes retroceder y hacer clic en cualquier fila para volver a ese paso.",
          "Los arreglos se ven como casillas en la pestaña Arreglos.",
          "Como en PSeInt, puedes evaluar una expresión en cualquier paso y agregarla como columna para seguirla, por ejemplo suma / cantidad.",
        ],
        desktop: [
          "Funciona sin internet, como programa instalado.",
        ],
      },
      faq: [
        {
          q: "¿Qué es una prueba de escritorio?",
          a: "Es seguir un algoritmo a mano, anotando en una tabla el valor de cada variable después de cada instrucción. Sirve para entender qué hace el programa y para encontrar errores sin ejecutarlo.",
        },
        {
          q: "¿La tabla de Codoritmo sirve para entregar?",
          a: "Sirve para comprobar la tuya. Si tu docente pide la prueba de escritorio hecha a mano, hazla tú primero y usa Codoritmo para verificarla.",
        },
        {
          q: "¿Por qué algunas filas no aparecen?",
          a: "La tabla muestra solo los pasos en los que ya existe alguna variable, y guarda hasta los últimos 400. A velocidad instantánea solo se anotan algunos pasos; para verlos todos, avanza con Paso siguiente o a velocidad lenta o normal.",
        },
      ],
    },

    "to-python": {
      title: "Pseudocódigo a Python: convierte tu algoritmo",
      description:
        "Convierte pseudocódigo PSeInt a Python y compáralo línea por línea. Codoritmo también traduce a C, C++, Java y JavaScript. Gratis, en el navegador.",
      keywords: ["pseudocódigo a Python", "convertir pseudocódigo a Python", "PSeInt a Python", "traductor de pseudocódigo", "pasar de PSeInt a Python"],
      name: "Pseudocódigo a Python",
      summary: "Tu algoritmo traducido a un programa de Python que puedes ejecutar.",
      h1: "Convierte pseudocódigo a Python",
      lead:
        "Codoritmo traduce tu algoritmo escrito en pseudocódigo, con la sintaxis de PSeInt, a un programa de Python que puedes ejecutar. Es la forma más directa de ver que lo que aprendiste con Escribir, Leer, Si y Mientras ya es programación.",
      showcase: {
        title: "El mismo algoritmo en pseudocódigo y en Python",
        intro: "El ejemplo «Adivina el número» y el Python que genera Codoritmo para él, sin retoques.",
      },
      stepsTitle: "Cómo traducir tu pseudocódigo a Python",
      steps: [
        { title: "Escribe o abre tu algoritmo", body: "Tiene que estar sin errores de sintaxis; el panel Problemas te muestra cuáles hay." },
        { title: "Elige Python", body: "En Ver › Traducir a, elige Python. La pestaña de código del panel lateral muestra la traducción." },
        { title: "Compara y copia", body: "La traducción cambia mientras escribes. Cópiala o descárgala como .py con Archivo › Exportar como." },
        { title: "Ejecútala", body: "Con Python 3 instalado, ejecuta python3 archivo.py en una terminal." },
      ],
      cta: "Abrir este ejemplo y ver su Python",
      ctaHint: "Abre el programa en Codoritmo; elige Python en Ver › Traducir a.",
      notes: [
        {
          title: "Qué tiene en cuenta la traducción",
          paragraphs: [
            "Los arreglos de PSeInt empiezan en 1 y las listas de Python en 0, así que datos[i] se traduce como datos[i - 1]. Si tu perfil usa arreglos desde 0, el índice queda igual.",
            "Un Para con límites fijos se convierte en for … in range(…). Si los límites dependen de variables, se usa un while que funciona tanto si cuenta hacia arriba como hacia abajo.",
            "Cuando un resultado tiene que coincidir con PSeInt, el código incluye pequeñas funciones de ayuda: por ejemplo, MOD usa math.fmod para dar el mismo signo que PSeInt, y los reales se escriben redondeados a 10 decimales.",
            "PSeInt no distingue mayúsculas de minúsculas en los nombres, así que el código usa todos los nombres en minúsculas para que cada uso apunte a la misma variable.",
          ],
        },
      ],
      differences: {
        intro: "PSeInt de escritorio también exporta a otros lenguajes. Estas son las diferencias.",
        codoritmo: [
          "Ves la traducción al lado del pseudocódigo y cambia mientras escribes.", "Exporta también a C#, PHP, Pascal, Visual Basic, QBasic, MatLab y HTML, como PSeInt.",
          "La traducción respeta el perfil elegido, por ejemplo arreglos desde 0 o desde 1.",
        ],
        desktop: [
          "Su exportación tiene muchos años de uso en aulas; la de Codoritmo es más reciente, así que revisa el código antes de entregarlo.",
        ],
      },
      faq: [
        {
          q: "¿El Python generado funciona tal cual?",
          a: "En los programas de clase, sí: se ejecuta con Python 3 sin cambios. Aun así conviene revisarlo, como dice el comentario del inicio. Si una instrucción no se puede traducir, Codoritmo lo avisa con un comentario en el código.",
        },
        {
          q: "¿Qué versión de Python necesito?",
          a: "Python 3.6 o posterior. El código usa anotaciones de tipo como n: int, que no existen en Python 2.",
        },
        {
          q: "¿Puedo convertir de Python a pseudocódigo?",
          a: "No. La traducción va en un solo sentido, de pseudocódigo a Python.",
        },
      ],
    },

    "to-c": {
      title: "Pseudocódigo a C: convierte tu algoritmo PSeInt",
      description:
        "Traduce pseudocódigo PSeInt a C o C++ con printf, scanf y tipos deducidos, y compáralo línea por línea. Gratis, en el navegador, sin instalar nada.",
      keywords: ["pseudocódigo a C", "convertir pseudocódigo a C", "PSeInt a C", "pseudocódigo a C++", "traductor de pseudocódigo a lenguaje C"],
      name: "Pseudocódigo a C",
      summary: "Tu algoritmo traducido a un programa en C (o C++) listo para compilar.",
      h1: "Convierte pseudocódigo a C",
      lead:
        "Codoritmo traduce tu algoritmo a un programa en C listo para compilar: deduce si cada variable es int, double, bool o texto, convierte Escribir en printf y Leer en scanf, y declara tus funciones antes de main. También puede generar C++, con cout y cin.",
      showcase: {
        title: "El mismo algoritmo en pseudocódigo y en C",
        intro: "El ejemplo «MCD y MCM», con una función que usa Mientras y MOD, y el C que genera Codoritmo para él, sin retoques.",
      },
      stepsTitle: "Cómo traducir tu pseudocódigo a C",
      steps: [
        { title: "Escribe o abre tu algoritmo", body: "Tiene que estar sin errores de sintaxis; el panel Problemas te muestra cuáles hay." },
        { title: "Elige C o C++", body: "En Ver › Traducir a, elige C o C++. La pestaña de código del panel lateral muestra la traducción." },
        { title: "Compara y copia", body: "La traducción cambia mientras escribes. Cópiala o descárgala como .c o .cpp con Archivo › Exportar como." },
        { title: "Compílala", body: "Con gcc: gcc programa.c -o programa -lm y después ./programa. El -lm hace falta cuando el código usa math.h." },
      ],
      cta: "Abrir este ejemplo y ver su C",
      ctaHint: "Abre el programa en Codoritmo; elige C en Ver › Traducir a.",
      notes: [
        {
          title: "Lo que cambia al pasar a C",
          paragraphs: [
            "C no tiene arreglos que se dimensionen con un tamaño que se conoce al ejecutar, como Dimension datos[n]. En ese caso el código usa un tamaño máximo fijo, ARREGLO_MAX (100), y lo explica en un comentario.",
            "Los textos son arreglos de char de 256 caracteres (MAX_STRLEN), incluido el carácter final.",
            "Los arreglos de C empiezan en 0: datos[i] se traduce como datos[i-1] cuando tu perfil usa arreglos desde 1.",
            "Aleatorio usa rand(). Si quieres números distintos en cada ejecución, agrega srand(time(NULL)); al inicio de main e incluye time.h.",
          ],
        },
      ],
      differences: {
        intro: "PSeInt de escritorio también exporta a C. Estas son las diferencias.",
        codoritmo: ["Ves la traducción al lado del pseudocódigo y cambia mientras escribes.", "Exporta también a C#, PHP, Pascal, Visual Basic, QBasic, MatLab y HTML, como PSeInt.", "Genera C y también C++."],
        desktop: [
          "Su exportación tiene muchos años de uso en aulas; la de Codoritmo es más reciente, así que revisa el código antes de entregarlo.",
        ],
      },
      faq: [
        {
          q: "¿Qué compilador uso?",
          a: "Cualquiera de C estándar: gcc, clang o el que trae Dev-C++ o Code::Blocks.",
        },
        {
          q: "¿C o C++?",
          a: "Elige el que pida tu curso. La versión en C usa printf y scanf; la de C++ usa cout, cin y string.",
        },
        {
          q: "¿Se traducen los subprocesos y las funciones?",
          a: "Sí. Cada SubProceso o Funcion se convierte en una función de C, declarada antes de main para que se pueda usar en cualquier orden.",
        },
        {
          q: "¿Por qué aparece ARREGLO_MAX?",
          a: "Porque tu algoritmo dimensiona un arreglo con una variable. C necesita conocer el tamaño al compilar, así que se reserva un máximo de 100 elementos. Si necesitas más, cambia el número en el #define.",
        },
      ],
    },

    "to-java": {
      title: "Pseudocódigo a Java: convierte tu algoritmo PSeInt",
      description:
        "Traduce pseudocódigo PSeInt a Java: una clase con main, tipos deducidos y lectura de datos incluida. Compáralo línea por línea. Gratis y en el navegador.",
      keywords: ["pseudocódigo a Java", "convertir pseudocódigo a Java", "PSeInt a Java", "traductor de pseudocódigo a Java", "pasar de PSeInt a Java"],
      name: "Pseudocódigo a Java",
      summary: "Tu algoritmo traducido a una clase de Java con su método main.",
      h1: "Convierte pseudocódigo a Java",
      lead:
        "Codoritmo traduce tu algoritmo a una clase de Java con su método main: deduce los tipos (int, double, boolean, String), convierte tus funciones en métodos static y agrega lo necesario para leer datos del teclado.",
      showcase: {
        title: "El mismo algoritmo en pseudocódigo y en Java",
        intro: "El ejemplo «Promedio de notas», con un arreglo y un ciclo Para, y el Java que genera Codoritmo para él, sin retoques.",
      },
      stepsTitle: "Cómo traducir tu pseudocódigo a Java",
      steps: [
        { title: "Escribe o abre tu algoritmo", body: "Tiene que estar sin errores de sintaxis; el panel Problemas te muestra cuáles hay." },
        { title: "Elige Java", body: "En Ver › Traducir a, elige Java. La pestaña de código del panel lateral muestra la traducción." },
        { title: "Compara y copia", body: "La traducción cambia mientras escribes. Cópiala o descárgala como .java con Archivo › Exportar como." },
        { title: "Ejecútala", body: "Guárdala con el nombre de la clase, por ejemplo Promedionotas.java, y ejecútala con java Promedionotas.java (Java 11 o posterior)." },
      ],
      cta: "Abrir este ejemplo y ver su Java",
      ctaHint: "Abre el programa en Codoritmo; elige Java en Ver › Traducir a.",
      notes: [
        {
          title: "Lo que cambia al pasar a Java",
          paragraphs: [
            "La clase toma el nombre de tu algoritmo: Algoritmo PromedioNotas se convierte en class Promedionotas.",
            "Para leer datos, el código agrega métodos pequeños (leerEntero, leerReal…) que leen una línea del teclado y la convierten al tipo de la variable.",
            "Los arreglos se crean con new y su tamaño puede ser una variable, así que Dimension datos[n] se traduce directo. Como en C, los índices empiezan en 0 y datos[i] pasa a ser datos[i - 1] cuando tu perfil usa arreglos desde 1.",
            "Los reales se escriben como en PSeInt, redondeados a 10 decimales, con un método de ayuda llamado texto.",
          ],
        },
      ],
      differences: {
        intro: "PSeInt de escritorio también exporta a Java. Estas son las diferencias.",
        codoritmo: [
          "Ves la traducción al lado del pseudocódigo y cambia mientras escribes.", "Exporta también a C#, PHP, Pascal, Visual Basic, QBasic, MatLab y HTML, como PSeInt.",
          "La traducción respeta el perfil elegido, por ejemplo arreglos desde 0 o desde 1.",
        ],
        desktop: [
          "Su exportación tiene muchos años de uso en aulas; la de Codoritmo es más reciente, así que revisa el código antes de entregarlo.",
        ],
      },
      faq: [
        {
          q: "¿Qué versión de Java necesito?",
          a: "El código compila con Java 8 o posterior. Para ejecutarlo directamente con java Archivo.java, sin compilar antes, necesitas Java 11 o posterior.",
        },
        {
          q: "¿Por qué no usa Scanner?",
          a: "Usa BufferedReader, que lee una línea completa cada vez, como Leer en PSeInt. Así cada respuesta que escribes corresponde a un Leer.",
        },
        {
          q: "¿El código sigue el estilo de Java?",
          a: "Está escrito para parecerse a tu pseudocódigo, no para seguir todas las convenciones de Java: por ejemplo, declara todas las variables al principio de main. Es un buen punto de partida para reescribirlo a tu manera.",
        },
      ],
    },

    blocks: {
      title: "Programar con bloques en pseudocódigo, como Scratch",
      description:
        "Arma tu algoritmo con bloques como en Scratch y Codoritmo escribe el pseudocódigo PSeInt por ti. Cambia entre bloques y código cuando quieras. Gratis.",
      keywords: ["programar con bloques", "programación por bloques", "pseudocódigo con bloques", "como Scratch", "bloques PSeInt"],
      name: "Programar con bloques",
      summary: "Arma tu algoritmo con bloques, como en Scratch, y mira el pseudocódigo que escriben.",
      h1: "Programar con bloques y ver el pseudocódigo",
      lead:
        "En el modo Bloques armas tu algoritmo arrastrando piezas de colores, como en Scratch, pero cada bloque dice la instrucción de PSeInt que escribe: Escribir, Leer, Si, Para. Aprendes la lógica sin pelearte con la sintaxis y, cuando vuelves al código, ya está escrito.",
      showcase: {
        title: "Un algoritmo en bloques",
        intro: "Captura real del ejemplo «Tabla de multiplicar» en el modo Bloques. A la derecha, el diagrama de flujo del mismo programa; debajo, el pseudocódigo que esos bloques producen.",
        alt:
          "Modo Bloques de Codoritmo con el algoritmo TablaMultiplicar armado en bloques de colores: Definir n, i Como Entero, Escribir, Leer n y un ciclo Para con un Escribir dentro; al lado, su diagrama de flujo.",
      },
      stepsTitle: "Cómo programar con bloques en Codoritmo",
      steps: [
        { title: "Cambia a Bloques", body: "Arriba del editor, el selector Código / Bloques cambia de vista. Si ya tenías código, se convierte en bloques." },
        {
          title: "Arrastra desde las categorías",
          body: "Entrada y salida, Variables, Control, Operadores, Texto y funciones, Arreglos, y Pantalla y más. Encaja cada bloque debajo del anterior.",
        },
        {
          title: "Mueve uno o varios",
          body: "Al arrastrar un bloque se llevan los que están debajo, como en Scratch. Para mover solo uno, mantén presionada Ctrl (⌘ en Mac) mientras lo arrastras.",
        },
        { title: "Ejecuta y mira el código", body: "Ejecutar funciona igual que en la vista de código. Vuelve a Código para ver o editar el pseudocódigo." },
      ],
      cta: "Abrir este ejemplo y pasar a Bloques",
      ctaHint: "Abre el programa en Codoritmo; pulsa Bloques arriba del editor.",
      notes: [
        {
          title: "Bloques y código, en los dos sentidos",
          paragraphs: [
            "Puedes empezar en bloques y terminar en código, o al revés. Lo que no tiene un bloque propio se conserva como un bloque de código con el texto exacto, así que al convertir no se pierde nada salvo los comentarios.",
            "Si el código tiene errores de sintaxis no se puede convertir en bloques: corrígelos en la vista de código y vuelve a intentarlo.",
          ],
        },
      ],
      differences: {
        intro: "PSeInt no tiene un modo de bloques, pero ofrece otras ayudas para escribir.",
        codoritmo: ["Modo de bloques tipo Scratch, conectado al código en los dos sentidos.", "El diagrama de flujo se actualiza mientras armas los bloques."],
        desktop: [
          "Su panel de comandos inserta en el código una plantilla de cada instrucción.",
          "Funciona sin internet, como programa instalado.",
        ],
      },
      faq: [
        {
          q: "¿Es lo mismo que Scratch?",
          a: "Se usa igual, arrastrando y encajando, pero los bloques son instrucciones de pseudocódigo y no de animaciones. La idea es pasar de los bloques al pseudocódigo que te piden en clase.",
        },
        {
          q: "¿Pierdo mi código si cambio a bloques?",
          a: "No se pierde ninguna instrucción: lo que no tiene bloque propio queda como un bloque de código. Lo único que se pierde son los comentarios (//).",
        },
        {
          q: "¿Los bloques están en español?",
          a: "Las instrucciones de los bloques usan las palabras clave de PSeInt en español en todos los idiomas, para que coincidan con el código. Los nombres de las categorías siguen el idioma de la página.",
        },
      ],
    },
  },
};
