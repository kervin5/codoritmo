/**
 * @jest-environment node
 */
import { Parser } from "../engine";
import { generateExport } from "../engine/generators";
import { describeExportLanguage, hasCommand } from "./helpers/export-languages";

describeExportLanguage({
  language: "csharp",
  upstream: "cs",
  shared: {
    "01-tipos": ["static void Main(", 'e = "Hola";', "c = true;", "Console.WriteLine(p);"],
    "02-entrada-salida": ["int.Parse(Console.ReadLine())", "c = Console.ReadLine();", 'Console.Write("Esta linea no lleva enter al final");'],
    "03-estructuras": ["while (c <= 10)", "} while (c != 10);", "} while (c < 10);", "if (c == 10)"],
    "04-arreglos": ["new string[10];", "new string[20, 30];", "a[9] = a[0];", "b[9, 9]"],
    "05-para": ["for (i = 1; i <= 10; i++)", "a[i - 1] = i * 10;", "foreach (int elemento in a)", "for (i = 3; i >= 1; i--)", "for (j = 1; j <= 5; j += 2)"],
    "06-segun": ["switch (c)", "case 3: case 5: case 9:", "default:"],
    "07-subprocesos": ["porreferencia(ref c);", "static void porreferencia(ref double b)", "static double funciondoble(double b)", "static void recibematriz(string[,] m)"],
    "08-operadores": ["c && d", "!(c && d)", 'e + " " + f'],
    "09-funciones": ["Math.Sqrt(x)", "Math.Asin(x)", "s.ToUpper()", "s.Substring(1,"],
    "10-otros": ["Console.Clear();", "Console.ReadKey(", "Thread.Sleep(100);", "Math.PI"],
  },
  own: {
    // Doubles and logical values are written as PSeInt writes them.
    "08-operadores": ["Texto(a / b)", "string.CompareOrdinal(e, f) < 0", 'valor ? "VERDADERO" : "FALSO"'],
    // Upstream passes several values to WriteLine as format arguments.
    "02-entrada-salida": ["Console.WriteLine(a + Texto(b) + c + Texto(d));", "CultureInfo.InvariantCulture"],
    // The element is written through its indices; foreach can't assign it.
    "05-para": ["b[b_i, b_j] = c;"],
    // Locals start with a value: C# rejects reading unassigned ones.
    "09-funciones": ["s.Substring(1, 2)", "(int) Math.Round(x, MidpointRounding.AwayFromZero)"],
    "01-tipos": ["int a = 0;", 'string p = "";'],
  },
  runtime: {
    // Mono's compiler (dotnet needs a project file).
    available: () => hasCommand("mcs", ["--version"]) && hasCommand("mono", ["--version"]),
    file: () => "Programa.cs",
    steps: (file) => [
      ["mcs", ["-out:programa.exe", file]],
      ["mono", ["programa.exe"]],
    ],
  },
});

describe("csharp export details", () => {
  const translate = (source: string) => generateExport(new Parser(source).parse().program!, "csharp").code!;

  it("copies arguments of another type in and out of ref parameters", () => {
    const code = translate(`SubProceso Doblar(x Por Referencia)
  x <- x * 2.5
FinSubProceso
Algoritmo a
  Definir n Como Entero
  n <- 2
  Doblar(n)
  Definir r Como Real
  Doblar(r)
FinAlgoritmo`);
    expect(code).toContain("double ref = n;");
    expect(code).toContain("doblar(ref ref);");
    expect(code).toContain("n = (int) ref;");
    expect(code).toContain("doblar(ref r);");
  });

  it("resizes arrays with a generic helper", () => {
    const code = translate(`Funcion r <- Primero(v)
  r <- v[1]
FinFuncion
Algoritmo a
  Dimension v[3]
  Redimensionar v[5]
  v[5] <- 2.5
  Escribir Primero(v)
FinAlgoritmo`);
    expect(code).toContain("v = Redimensionar(v, 5, 0.0);");
    expect(code).toContain("static T[] Redimensionar<T>(T[] viejo, int n, T valorInicial)");
    expect(code).toContain("static double primero(double[] v)");
  });
});
