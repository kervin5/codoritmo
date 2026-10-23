/**
 * @jest-environment node
 */
import { Parser } from "../engine";
import { generateExport } from "../engine/generators";
import { describeExportLanguage, hasCommand } from "./helpers/export-languages";

describeExportLanguage({
  language: "vb",
  upstream: "vb",
  ignoreCase: true,
  shared: {
    "01-tipos": ["Sub Main()", "Dim a As Integer", "Dim b As Double", "Dim c As Boolean", "c = True", "Console.WriteLine(p)"],
    "02-entrada-salida": ["Integer.Parse(Console.ReadLine())", "c = Console.ReadLine()", 'Console.Write("Esta linea no lleva enter al final")'],
    "03-estructuras": ["Loop Until c = 10", "Loop While c < 10", "If c = 10 Then", "Else", "End If"],
    // Arrays sized so the pseudocode's indices are used as they are.
    "04-arreglos": ["Dim a(10) As String", "Dim b(20, 30) As String", "a(10) = a(1)", "Console.WriteLine(b(10, 10))", "Dim e(n) As String"],
    "05-para": ["For i = 1 To 10", "a(i) = i * 10", "For i = 3 To 1 Step -1", "For j = 1 To 5 Step 2"],
    "06-segun": ["Case 3, 5, 9", "Case Else", "End Select"],
    "07-subprocesos": ["Sub porreferencia(ByRef b As Double)", "Return a", "End Function", "m(1, 1) = Console.ReadLine()"],
    "08-operadores": ["a Mod b", "a ^ b", "Not (c And", 'e & " " & f'],
    "09-funciones": ["Math.Sqrt(x)", "Math.Atan(x)", "Console.WriteLine(s & \" Mundo\")"],
    "10-otros": ["Console.Clear()", "Console.ReadKey(", "Thread.Sleep(100)", "Math.PI"],
  },
  own: {
    // Short-circuit operators and PSeInt's way of writing values.
    "08-operadores": ["c AndAlso d", "c OrElse d", "Texto(a / b)", "e < f"],
    // Upstream's For Each assigns a copy; the element is written through its indices.
    "05-para": ["For b_i As Integer = 1 To UBound(b, 1)", "b(b_i, b_j) = c"],
    "07-subprocesos": ["Function funciondoble(b As Double) As Double", "Sub recibevector(v() As String)"],
    "09-funciones": ["Mid(s, 2, 2)", "Len(s)", "UCase(s)", "Val(\"15.5\")"],
  },
  runtime: {
    available: () => hasCommand("vbnc", ["/help"]) && hasCommand("mono", ["--version"]),
    file: () => "Programa.vb",
    steps: (file) => [
      ["vbnc", ["/nologo", "/out:programa.exe", file]],
      ["mono", ["programa.exe"]],
    ],
  },
});

describe("vb export details", () => {
  const translate = (source: string) => generateExport(new Parser(source).parse().program!, "vb").code!;

  it("declares arrays dimensioned in a block up front and resizes with ReDim Preserve", () => {
    const code = translate(`Algoritmo a
  Leer n
  Si n > 0 Entonces
    Dimension v[n]
  FinSi
  Redimensionar v[n + 2]
  Dimension m[2, 2]
  Redimensionar m[3, 3]
FinAlgoritmo`);
    expect(code).toContain("Dim v() As String");
    expect(code).toContain("ReDim v(n)");
    expect(code).toContain("ReDim Preserve v(n + 2)");
    expect(code).toContain("m = Redimensionar(m, 3, 3)");
  });

  it("follows the zero-based profile", () => {
    const parsed = new Parser(`Algoritmo a
  Dimension v[3]
  v[0] <- 1
FinAlgoritmo`, { settings: { baseZeroArrays: true } }).parse();
    const code = generateExport(parsed.program!, "vb", { settings: { baseZeroArrays: true } }).code!;
    expect(code).toContain("Dim v(2) As Double");
    expect(code).toContain("v(0) = 1");
  });
});
