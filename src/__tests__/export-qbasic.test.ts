/**
 * @jest-environment node
 */
import { Parser } from "../engine";
import { generateExport } from "../engine/generators";
import { describeExportLanguage, hasCommand } from "./helpers/export-languages";

describeExportLanguage({
  language: "qbasic",
  upstream: "qb",
  shared: {
    "01-tipos": ["DIM a AS LONG", "DIM b AS DOUBLE", "DIM c AS INTEGER", "DIM e AS STRING", "LINE INPUT p", 'e = "Hola"'],
    "02-entrada-salida": ["LINE INPUT c", 'PRINT "Esta linea no lleva enter al final";'],
    "03-estructuras": ["LOOP UNTIL c = 10", "LOOP WHILE c < 10", "IF c = 10 THEN", "ELSE"],
    "04-arreglos": ["DIM a(1 TO 10) AS STRING", "DIM b(1 TO 20, 1 TO 30) AS STRING", "DIM e(1 TO n) AS STRING", "a(10) = a(1)"],
    "05-para": ["FOR i = 1 TO 10", "a(i) = i * 10", "NEXT i", "FOR i = 3 TO 1 STEP -1", "FOR j = 1 TO 5 STEP 2"],
    "06-segun": ["SELECT CASE c", "CASE 3, 5, 9", "CASE ELSE", "END SELECT"],
    "07-subprocesos": ["CALL noretornanada(3, 9)", "CALL porreferencia(c)", "CALL recibevector(a())", "SUB recibematriz (m(,) AS STRING)", "END FUNCTION"],
    "08-operadores": ["a ^ b", "NOT (c AND d)", 'e + " " + f', "e < f"],
    "09-funciones": ["RANDOMIZE TIMER", "SQR(x)", "ATN(x)", "INT(RND * 15)", "LCASE$(s)", "UCASE$(s)", 'VAL("15.5")'],
    "10-otros": ["CLS"],
  },
  own: {
    // FUNCTION names carry their type; DECLAREs let QBasic itself load the file.
    "07-subprocesos": ["DECLARE FUNCTION funciondoble# (b AS DOUBLE)", "FUNCTION funciondoble# (b AS DOUBLE)", "funciondoble# = a"],
    // INPUT without its question mark; numbers written without PRINT's spaces.
    "02-entrada-salida": ['INPUT "", a', "LTRIM$(STR$(a))", "d = LeerLogico%"],
    // Para Cada walks the indices with LBOUND/UBOUND.
    "05-para": ["FOR b_i = LBOUND(b, 1) TO UBOUND(b, 1)", "b(b_i, b_j) = c"],
    // Logical values are -1 and 0 so that NOT works.
    "01-tipos": ["CONST VERDADERO = -1, FALSO = 0", "c = VERDADERO"],
    // Literals with decimals marked DOUBLE; MID$ and redon like PSeInt.
    "09-funciones": ["x = 1.5#", 'MID$(s, 2, 2)', "Redondear&(x)", "ArcSen#(x)"],
    "08-operadores": ["Resto#(a, b)"],
  },
  runtime: {
    // FreeBASIC's QBasic dialect compiles from the command line.
    available: () => hasCommand("fbc", ["-version"]),
    file: () => "programa.bas",
    steps: (file) => [
      ["fbc", ["-lang", "qb", "-x", "programa", file]],
      ["./programa", []],
    ],
  },
});

describe("qbasic export details", () => {
  const translate = (source: string) => generateExport(new Parser(source).parse().program!, "qbasic").code!;

  it("passes variables to by-value parameters as copies", () => {
    const code = translate(`SubProceso Cambiar(k)
  k <- 0
FinSubProceso
Funcion r <- Doble(x)
  r <- x * 2
FinFuncion
Algoritmo a
  n <- 5
  Cambiar(n)
  Doble(n)
FinAlgoritmo`);
    expect(code).toContain("CALL cambiar((n))");
    // A FUNCTION cannot be a statement on its own.
    expect(code).toContain("resultado = doble#((n))");
  });
});
