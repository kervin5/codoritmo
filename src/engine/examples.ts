import { ExampleProgram } from "./types";

export const examplePrograms: ExampleProgram[] = [
  {
    id: "hello-world",
    label: "Hola Mundo",
    description: "A minimal pseudocode program that writes one line.",
    source: `Proceso HolaMundo
  Escribir "Hola Mundo!"
FinProceso`,
  },
  {
    id: "loops-and-output",
    label: "Bucles",
    description:
      "While, repeat, and for loops using the canonical browser dialect.",
    source: `Proceso Bucles
  Para i <- 1 Hasta 3 Hacer
    Escribir "Paso ", i
  FinPara

  Repetir
    Escribir "Sin bajar", " ", i Sin Bajar
    i <- i - 1
  Mientras Que i > 0
FinProceso`,
  },
  {
    id: "references",
    label: "Por Referencia",
    description: "SubProceso with by-reference parameters and arrays.",
    source: `SubProceso AsignaPrimerValor(v Por Referencia)
  v[1] <- 5
FinSubProceso

Proceso Referencias
  Dimension datos[3]
  AsignaPrimerValor(datos)
  Escribir datos[1]
FinProceso`,
  },
  {
    id: "runtime-controls",
    label: "Esperar y Limpiar",
    description: "Runtime controls that map cleanly to the browser playground.",
    source: `Proceso Runtime
  Escribir "Linea inicial"
  Esperar 1 Segundo
  Limpiar Pantalla
  Escribir "Listo"
FinProceso`,
  },
  {
    id: "array-average",
    label: "Promedio de Notas",
    description:
      "Array declaration, filling, iteration, and finding maximum value.",
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
  
  // Calcular promedio
  promedio <- suma / 5
  
  Escribir "Promedio: ", promedio
  Escribir "Nota más alta: ", maximo
FinProceso`,
  },
];
