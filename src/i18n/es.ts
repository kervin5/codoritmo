import type { Dictionary } from "./types";

export const esDictionary: Dictionary = {
  metadata: {
    title: "Codoritmo",
    siteName: "Codoritmo",
    description:
      "Codoritmo es un espacio de trabajo de pseudocódigo independiente en el navegador, inspirado por PSeInt, con diagnósticos de ejecución, diagramas y exportación a JavaScript.",
    keywords: [
      "Codoritmo",
      "editor de pseudocódigo",
      "diagrama de flujo",
      "espacio de pseudocódigo en navegador",
      "alternativa a PSeInt",
      "PSeInt online",
    ],
    home: {
      title: "Alternativa online a PSeInt",
      description:
        "Codoritmo es un espacio de trabajo de pseudocódigo independiente en el navegador, inspirado por PSeInt, con edición tipo Monaco, diagnósticos, diagramas de flujo y exportación de JavaScript para navegador o Node.js.",
      keywords: [
        "PSeInt online",
        "PSeInt en navegador",
        "alternativa a PSeInt",
        "pseudocódigo compatible con PSeInt",
        "diagrama de flujo online",
        "exportar pseudocódigo a JavaScript",
      ],
    },
    about: {
      title: "Acerca de",
      description:
        "Codoritmo toma inspiración directa de PSeInt. Mismo dialecto, mismo espíritu, construido para el navegador con su propia hoja de ruta.",
      keywords: [
        "acerca de Codoritmo",
        "inspirado en PSeInt",
        "IDE de pseudocódigo en navegador",
        "compatibilidad PSeInt",
        "enseñar pseudocódigo online",
      ],
    },
  },
  appShell: {
    about: "Acerca de",
    collapseNavigation: "Contraer navegación",
    examples: "Ejemplos",
    expandNavigation: "Expandir navegación",
    tagline: "Espacio de pseudocódigo",
    workspace: "Espacio",
  },
  aboutPage: {
    eyebrow: "Codoritmo",
    title: "Pseudocódigo, diagramas y exportación en el navegador",
    storyTitle: "Nuestra historia",
    storyBody:
      "PSeInt es donde el pseudocódigo se convirtió en estándar en las aulas de América Latina. Codoritmo es un descendiente directo: misma sintaxis, mismo espíritu de enseñanza, nativo del navegador. Lo construimos como reconocimiento a PSeInt y a los docentes que lo usan. Lo familiar es familiar a propósito. Lo que cambia es el entorno: diagnósticos en vivo, diagramas de flujo y exportación a JavaScript sin salir del navegador.",
    compatibilityTitle: "Dialecto PSeInt, implementación web",
    compatibilityBody:
      "Sintaxis, perfiles y semántica central siguen de cerca a PSeInt para que ejercicios y hábitos funcionen de entrada. Codoritmo es su propio proyecto: algunas cosas están pensadas para el navegador y para exportar JavaScript, y puede divergir donde la web lo necesite. La aplicación oficial de escritorio y la documentación completa están en el sitio de PSeInt.",
    officialLinkLabel: "Visitar el proyecto oficial de PSeInt",
  },
  bottomDock: {
    collapse: "Minimizar salida",
    continueKeyWait: "Continuar espera de tecla",
    expand: "Expandir salida",
    inputPlaceholder: "Escribe un valor y presiona Enter",
    issueCount: {
      one: "{count} problema",
      other: "{count} problemas",
    },
    noOutputYet: "Todavía no hay salida.",
    noProblems: "Sin problemas.",
    output: "Salida",
    outputReady: "Salida lista",
    problems: "Problemas",
    programInput: "Entrada del programa",
    ready: "Listo",
    running: "Ejecutando",
    severities: {
      error: "error",
      warning: "advertencia",
    },
    submitInput: "Enviar",
    waitingForInput: "Esperando entrada",
    waitingForKey: "Esperando tecla",
  },
  diagram: {
    buildInProgress: "Construyendo diagrama…",
    classicFlow: "Flujo clásico",
    download: "Descargar PNG",
    fitView: "Ajustar vista",
    fixErrorsHint:
      "Corrige los errores de análisis para renderizar el diagrama de flujo.",
    invalidProgramBody:
      "La pestaña de diagrama necesita un Proceso o Algoritmo válido antes de poder construir el flujo.",
    invalidProgramTitle: "Diagrama no disponible",
    maximize: "Expandir diagrama",
    resetLayout: "Restablecer diseño",
    restore: "Restaurar diagrama",
    routine: "Rutina",
    routineSelect: "Rutina del diagrama",
    tab: "Diagrama",
    visualOnlyHint:
      "Diseño solo visual. Arrastrar bloques no cambia el código.",
  },
  editor: {
    loading: "Cargando el editor Monaco…",
  },
  examples: {
    "hello-world": {
      label: "Hola Mundo",
      description: "Un programa mínimo de pseudocódigo que escribe una línea.",
    },
    "loops-and-output": {
      label: "Bucles",
      description:
        "Bucles Mientras, Repetir y Para usando el dialecto canónico del navegador.",
    },
    references: {
      label: "Por Referencia",
      description: "SubProceso con parámetros por referencia y arreglos.",
    },
    "runtime-controls": {
      label: "Esperar y Limpiar",
      description:
        "Controles de ejecución que encajan bien con el entorno del navegador.",
    },
  },
  library: {
    chooseExample: "Elegir ejemplo",
    close: "Cerrar",
    lineCount: {
      one: "{count} línea",
      other: "{count} líneas",
    },
    noExampleSelected: "No hay ningún ejemplo seleccionado",
    noExampleSelectedBody:
      "Limpia la búsqueda actual o elige un elemento de la lista para abrirlo en una pestaña nueva.",
    noExamplesMatch: "Ningún ejemplo coincide con esta búsqueda.",
    openInNewTab: "Abrir en una pestaña nueva",
    searchExamples: "Buscar ejemplos",
    sectionLabel: "Ejemplos",
    selected: "Seleccionado",
  },
  profileDrawer: {
    activePreset: "Preajuste activo",
    changesDescription:
      "Los cambios se aplican inmediatamente al análisis, la ejecución y la vista previa de JavaScript.",
    close: "Cerrar",
    closeProfileDrawer: "Cerrar panel de perfil",
    closeSettingsOverlay: "Cerrar superposición de ajustes",
    groups: {
      arrays: "Arreglos y bucles",
      functions: "Rutinas y texto",
      syntax: "Sintaxis y operadores",
      typing: "Tipado y seguridad",
    },
    preset: "Preajuste",
    profiles: {
      "desktop-default": {
        label: "Predeterminado de escritorio",
        description:
          "Ajustes ejecutables alineados con los valores predeterminados de PSeInt.",
      },
      estricto: {
        label: "Estricto",
        description:
          "Subconjunto estricto del perfil original que afecta de forma material el análisis y la ejecución en el navegador.",
      },
      uan: {
        label: "UAN",
        description:
          "Perfil escolar representativo con tipado explícito y asignación con = habilitada.",
      },
    },
    sectionLabel: "Ajustes del perfil",
    settings: {
      force_define_vars: {
        label: "Exigir Definir",
        description:
          "Rechaza lecturas, escrituras y contadores de bucle que no hayan sido tipados con Definir.",
      },
      force_init_vars: {
        label: "Exigir inicialización",
        description:
          "Genera errores de ejecución cuando se usan variables o elementos de arreglos sin inicializar.",
      },
      base_zero_arrays: {
        label: "Arreglos base 0",
        description:
          "Cambia la indexación de arreglos entre base 1 y base 0 tanto en el intérprete como en el JavaScript generado.",
      },
      allow_concatenation: {
        label: "Permitir texto con +",
        description:
          "Controla la concatenación de cadenas mediante el operador +.",
      },
      allow_dinamyc_dimensions: {
        label: "Dimensiones dinámicas",
        description:
          "Cuando se desactiva, Dimension se restringe a expresiones numéricas constantes.",
      },
      overload_equal: {
        label: "Permitir asignación con =",
        description:
          "Habilita la asignación con = en sentencias y cabeceras de Para.",
      },
      coloquial_conditions: {
        label: "Condiciones coloquiales",
        description:
          "Habilita formas como ES PAR, ES MAYOR QUE y NO ES DIVISIBLE POR.",
      },
      lazy_syntax: {
        label: "Sintaxis flexible",
        description:
          "Incluye soporte para formas partidas de Fin ..., Hacer/Entonces opcionales, Mientras Que y variaciones Desde/Con Paso. Otros atajos de escritorio aún faltan.",
      },
      word_operators: {
        label: "Operadores con palabras",
        description:
          "Controla Y, O, NO y MOD como palabras clave de operadores.",
      },
      enable_user_functions: {
        label: "Rutinas de usuario",
        description:
          "Permite o bloquea declaraciones SubProceso, SubAlgoritmo y Funcion.",
      },
      enable_string_functions: {
        label: "Funciones integradas de texto",
        description:
          "Controla Longitud, SubCadena, Mayusculas, Minusculas y Concatenar.",
      },
      integer_only_switch: {
        label: "Segun solo entero",
        description:
          "Rechaza casos obviamente no numéricos en Segun y valida los valores de control en tiempo de ejecución.",
      },
      deduce_negative_for_step: {
        label: "Inferir Paso negativo",
        description:
          "Hace que el paso predeterminado de Para sea -1 cuando el inicio es mayor que el fin.",
      },
      allow_accents: {
        label: "Identificadores acentuados",
        description:
          "Controla las letras acentuadas en identificadores y sigue permitiendo palabras clave acentuadas.",
      },
      allow_repeat_while: {
        label: "Permitir Repetir ... Mientras",
        description:
          "Controla la forma alternativa de cierre para repeat-while.",
      },
      allow_for_each: {
        label: "Permitir Para Cada",
        description: "Controla el bucle de estilo foreach con Para Cada.",
      },
      protect_for_counter: {
        label: "Proteger contador de Para",
        description:
          "Bloquea las escrituras sobre el contador activo de Para y lo deja sin inicializar después del bucle.",
      },
    },
    status: {
      implemented: "implementado",
      missing: "pendiente",
      not_applicable: "no aplica",
      partial: "parcial",
    },
  },
  sidebar: {
    collapsePanel: "Ocultar panel de comandos",
    collapsedRailLead: "Comandos",
    collapsedRailTrail: "Panel",
    description: "Pasa el cursor para inspeccionar y haz clic para insertar.",
    details: "Detalles",
    expandPanel: "Mostrar panel de comandos",
    moreVariations: "Más variaciones para {label}",
    sectionLabel: "Comandos",
    title: "Insertar código",
  },
  snippets: {
    defaultHelpBody:
      "Selecciona una estructura u operador en la barra lateral derecha para insertarlo en el cursor. La salida y los problemas permanecen debajo del editor.",
    defaultHelpTitle: "Inserta código más rápido",
    diagnosticTitle: "Problema en {line}:{column}",
    groups: {
      algebraic: "Algebraicos",
      constants: "Constantes",
      logical: "Lógicos",
      math: "Funciones matemáticas",
      relational: "Relacionales",
      strings: "Funciones de texto",
      structures: "Estructuras",
    },
    items: {
      abs: {
        title: "Abs",
        body: "Devuelve el valor absoluto de un número.",
      },
      and: {
        title: "Y lógico",
        body: "Requiere que ambas condiciones sean verdaderas.",
      },
      asignar: {
        label: "Asignar",
        title: "Asignar",
        body: "Escribe un valor en una variable o en un elemento de arreglo.",
      },
      azar: {
        title: "Azar",
        body: "Devuelve un entero aleatorio entre 0 y el límite indicado menos uno.",
      },
      concatenar: {
        title: "Concatenar",
        body: "Combina dos expresiones de texto en un solo valor.",
      },
      "convertir-numero": {
        title: "ConvertirANumero",
        body: "Convierte texto en un valor numérico.",
      },
      "convertir-texto": {
        title: "ConvertirATexto",
        body: "Convierte un valor en su representación textual.",
      },
      divide: {
        title: "División",
        body: "Divide la expresión de la izquierda entre la de la derecha.",
      },
      definir: {
        label: "Definir",
        title: "Definir",
        body: "Declara una o más variables y les asigna un tipo de dato con Como.",
      },
      dimension: {
        label: "Dimension",
        title: "Dimension",
        body: "Establece el tamaño de uno o más arreglos después de declararlos.",
      },
      euler: {
        title: "Euler",
        body: "La constante de Euler.",
      },
      eq: {
        title: "Igual",
        body: "Comprueba si ambos valores son iguales.",
      },
      escribir: {
        label: "Escribir",
        title: "Escribir",
        body: "Escribe uno o más valores en la consola de salida y avanza a la siguiente línea.",
        variants: {
          "escribir-linea": {
            label: "Con salto",
            title: "Escribir",
            body: "Escribe uno o más valores y termina la línea.",
          },
          "escribir-sin-bajar": {
            label: "Sin Bajar",
            title: "Escribir Sin Bajar",
            body: "Escribe sin agregar un salto de línea; es útil para avisos y salidas progresivas.",
          },
        },
      },
      funcion: {
        label: "Funcion",
        title: "Funcion",
        body: "Crea una rutina de función que puede devolver un resultado con nombre.",
      },
      geq: {
        title: "Mayor o igual",
        body: "Comprueba si el valor de la izquierda es mayor o igual que el de la derecha.",
      },
      gt: {
        title: "Mayor que",
        body: "Comprueba si el valor de la izquierda es mayor que el de la derecha.",
      },
      leq: {
        title: "Menor o igual",
        body: "Comprueba si el valor de la izquierda es menor o igual que el de la derecha.",
      },
      leer: {
        label: "Leer",
        title: "Leer",
        body: "Pausa la ejecución hasta que se envía el siguiente valor y luego lo guarda en la variable de destino.",
      },
      longitud: {
        title: "Longitud",
        body: "Devuelve la cantidad de caracteres de una cadena.",
      },
      lt: {
        title: "Menor que",
        body: "Comprueba si el valor de la izquierda es menor que el de la derecha.",
      },
      minus: {
        title: "Resta",
        body: "Resta la expresión de la derecha a la de la izquierda.",
      },
      mod: {
        title: "Módulo",
        body: "Devuelve el residuo de una división entera.",
      },
      multiply: {
        title: "Multiplicación",
        body: "Multiplica dos expresiones numéricas.",
      },
      mientras: {
        label: "Mientras",
        title: "Mientras",
        body: "Repite el bloque mientras la condición siga siendo verdadera.",
      },
      limpiar: {
        label: "Limpiar Pantalla",
        title: "Limpiar Pantalla",
        body: "Limpia la consola de salida antes de mostrar nuevas escrituras.",
      },
      neq: {
        title: "Distinto",
        body: "Comprueba si los dos valores son diferentes.",
      },
      not: {
        title: "NO lógico",
        body: "Niega la condición siguiente.",
      },
      or: {
        title: "O lógico",
        body: "Requiere que al menos una condición sea verdadera.",
      },
      para: {
        label: "Para",
        title: "Para",
        body: "Agrega un bucle contado con valores de inicio y fin.",
        variants: {
          "para-cada": {
            label: "Para Cada",
            title: "Para Cada",
            body: "Itera sobre cada elemento de una colección cuando esa opción del perfil está habilitada.",
          },
        },
      },
      pi: {
        title: "PI",
        body: "La constante de Arquímedes.",
      },
      plus: {
        title: "Suma",
        body: "Suma dos expresiones numéricas o concatena texto cuando esa opción está habilitada.",
      },
      power: {
        title: "Potencia",
        body: "Eleva la expresión de la izquierda al exponente de la derecha.",
      },
      raiz: {
        title: "Raiz",
        body: "Calcula la raíz cuadrada de un valor no negativo.",
      },
      redon: {
        title: "Redon",
        body: "Redondea un número al entero más cercano.",
      },
      esperar: {
        label: "Esperar",
        title: "Esperar",
        body: "Pausa la ejecución durante un tiempo expresado en segundos o milisegundos.",
      },
      "esperar-tecla": {
        label: "Esperar Tecla",
        title: "Esperar Tecla",
        body: "Pausa la ejecución hasta que el usuario continúe con una tecla.",
      },
      repetir: {
        label: "Repetir",
        title: "Repetir Hasta Que",
        body: "Repite hasta que la condición se vuelve verdadera.",
        variants: {
          "repetir-hasta": {
            label: "Hasta Que",
            title: "Repetir Hasta Que",
            body: "Repite hasta que la condición se vuelve verdadera.",
          },
          "repetir-mientras": {
            label: "Mientras Que",
            title: "Repetir Mientras Que",
            body: "Repite mientras la condición de cierre siga siendo verdadera.",
          },
        },
      },
      rutina: {
        label: "SubProceso",
        title: "SubProceso",
        body: "Crea una rutina reutilizable con parámetros opcionales por referencia.",
        disabledLabel: "Rutinas desactivadas",
        disabledTitle: "Rutinas desactivadas",
        disabledBody:
          "Activa las rutinas de usuario en los ajustes del perfil para insertar bloques SubProceso, SubAlgoritmo o Funcion.",
      },
      segun: {
        label: "Segun",
        title: "Segun",
        body: "Agrega un bloque de selección con múltiples ramas, un caso y una ruta predeterminada.",
      },
      si: {
        label: "Si",
        title: "Si",
        body: "Agrega un bloque condicional con una rama verdadera explícita.",
        variants: {
          "si-sino": {
            label: "Con Sino",
            title: "Si / Sino",
            body: "Agrega ramas verdadera y falsa dentro del mismo bloque condicional.",
          },
        },
      },
      subalgoritmo: {
        label: "SubAlgoritmo",
        title: "SubAlgoritmo",
        body: "Crea una cabecera alternativa de rutina con el mismo soporte del motor del navegador que SubProceso.",
      },
      subcadena: {
        title: "SubCadena",
        body: "Extrae una subcadena usando la base de indexación actual de arreglos o cadenas.",
      },
      subproceso: {
        label: "SubProceso",
        title: "SubProceso",
        body: "Crea una rutina reutilizable con parámetros opcionales por referencia.",
      },
      retornar: {
        label: "Retornar",
        title: "Retornar",
        body: "Devuelve un valor desde la función o la rutina actual.",
      },
      trunc: {
        title: "Trunc",
        body: "Devuelve la parte entera de un número.",
      },
    },
  },
  workspace: {
    closeTab: "Cerrar pestaña",
    customProfile: "Personalizado",
    defaultHelpBody:
      "Usa la barra lateral derecha para insertar comandos, operadores y funciones integradas en la pestaña activa del editor.",
    defaultHelpTitle: "Insertar estructuras",
    downloadExport: "Descargar JavaScript",
    downloadSource: "Descargar fuente",
    editProfile: "Editar perfil",
    browser: "Navegador",
    executionPaused: "Ejecución en pausa",
    export: "Exportar",
    exportEmpty: "Abre Exportar para generar JavaScript para esta sesión.",
    exportLanguage: "Lenguaje de exportación",
    exportTarget: "Destino de exportación",
    language: "Lenguaje",
    languageJavaScript: "JavaScript",
    newTab: "Nueva",
    node: "Node.js",
    profile: "Perfil",
    renameTab: "Cambiar nombre de la pestaña",
    renameTabTitle: "Cambiar nombre de {title}",
    run: "Ejecutar",
    running: "Ejecutando…",
    searchProfiles: "Buscar perfiles...",
    diagram: "Diagrama",
    source: "Fuente",
    target: "Destino",
    untitled: "Sin título",
    untitledNumber: "Sin título {n}",
  },
};
