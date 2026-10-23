/**
 * @jest-environment node
 */
import { Parser } from "../engine";
import { generateExport } from "../engine/generators";
import { describeExportLanguage, hasCommand } from "./helpers/export-languages";

describeExportLanguage({
  language: "pascal",
  upstream: "pas",
  ignoreCase: true,
  shared: {
    "01-tipos": ["a: Integer;", "b: Real;", "c: Boolean;", "e: String;", "c := True;", "e := 'Hola';"],
    "02-entrada-salida": ["ReadLn(a);", "ReadLn(b);", "Write('Esta linea no lleva enter al final');"],
    "03-estructuras": ["While c <= 10 Do Begin", "Repeat", "Until c = 10;", "If c = 10 Then Begin"],
    // Static arrays keep the pseudocode's indices.
    "04-arreglos": ["a: Array[1..10] Of", "b: Array[1..20, 1..30] Of", "a[10] := a[1];", "WriteLn(b[10, 10]);"],
    "05-para": ["For i := 1 To 10 Do", "a[i] := i * 10;", "For i := 3 DownTo 1 Do"],
    "06-segun": ["Case c Of", "3, 5, 9:", "Else"],
    "07-subprocesos": ["Procedure porreferencia(Var b: Real);", "Function funciondoble(b: Real): Real;", "porreferencia(c);"],
    "08-operadores": ["Power(a, b)", "Not (c And d)", "e + ' ' + f", "e < f"],
    "09-funciones": ["Sqrt(x)", "Arcsin(x)", "Random(15)", "Length(s)", "Copy(s, 2,"],
    "10-otros": ["ClrScr;", "ReadKey;", "Delay(100);"],
  },
  own: {
    // objfpc mode: 32-bit Integer, unbounded strings, Result and Exit(value).
    "01-tipos": ["{$mode objfpc}{$H+}"],
    // Arrays shared with subprocesses are dynamic and passed as var.
    "07-subprocesos": ["TArregloTexto = array of String;", "procedure recibevector(var v: TArregloTexto);", "SetLength(a, 10);", "Result := a;"],
    // An array sized at run time is dynamic instead of upstream's ARREGLO_MAX.
    "04-arreglos": ["SetLength(e, n);"],
    // A step of 2 is a while loop; Para Cada walks the indices with Low/High.
    "05-para": ["while j <= 5 do", "j := j + 2;", "for b_i := Low(b) to High(b) do"],
    // Reals are written with up to 10 decimals, Round's banker's rounding avoided.
    "09-funciones": ["Copy(s, 2, 2)", "Texto(Sqrt(x))", "Redondear(x)", "UpperCase(s)"],
    "08-operadores": ["(c and d)", "Resto(a, b)"],
  },
  runtime: {
    available: () => hasCommand("fpc", ["-iV"]),
    file: () => "programa.pas",
    steps: (file) => [
      ["fpc", ["-v0", "-oprograma", file]],
      ["./programa", []],
    ],
  },
});

describe("pascal export details", () => {
  const translate = (source: string) => generateExport(new Parser(source).parse().program!, "pascal").code!;

  it("declares auxiliary variables and copies var arguments of another type", () => {
    const code = translate(`SubProceso Doblar(x Por Referencia)
  x <- x * 2.5
FinSubProceso
Algoritmo a
  Definir n Como Entero
  n <- 2
  Doblar(n)
  Para i <- 1 Hasta n Hacer
    Escribir i
  FinPara
  Escribir i
FinAlgoritmo`);
    expect(code).toMatch(/ref: Real;/);
    expect(code).toContain("ref := n;");
    expect(code).toContain("doblar(ref);");
    expect(code).toContain("n := Trunc(ref);");
    // i is read after the loop: a for loop would leave it undefined.
    expect(code).toContain("while ((paso > 0) and (i <= n)) or ((paso < 0) and (i >= n)) do");
  });

  it("writes strings with control characters and quotes", () => {
    const code = translate(`Algoritmo a
  Escribir "it's"
FinAlgoritmo`);
    expect(code).toContain("WriteLn('it''s');");
  });
});
