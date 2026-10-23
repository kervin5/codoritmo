/**
 * @jest-environment node
 */
import { Parser } from "../engine";
import { generateExport } from "../engine/generators";
import { describeExportLanguage, hasCommand } from "./helpers/export-languages";

describeExportLanguage({
  language: "matlab",
  upstream: "m",
  shared: {
    "00-programa": ["function sin_titulo()"],
    "01-tipos": ["a = 1;", "b = 2.5;", "c = true;", "e = 'Hola';"],
    "02-entrada-salida": ["a = input('');", "c = input('', 's');"],
    "03-estructuras": ["while c <= 10", "if c == 10", "else"],
    "04-arreglos": ["n = input('');"],
    "05-para": ["for i = 1:10", "a(i) = i * 10;", "for i = 3:-1:1", "for j = 1:2:5"],
    "06-segun": ["switch c", "case {3, 5, 9}", "otherwise"],
    "07-subprocesos": ["function a = funciondoble(b)", "function noretornanada(a, b)"],
    "08-operadores": ["a ^ b", "a ~= b", "c && d", "~(c && d)", "strcmp(e, f)"],
    "09-funciones": ["sqrt(x)", "asin(x)", "round(x)", "length(s)", "lower(s)", "upper(s)", "s(2:3)"],
    "10-otros": ["clc;", "pause;", "pause(100 / 1000);", "pi"],
  },
  own: {
    // MatLab passes everything by value: by-reference parameters and the
    // arrays a function changes come back as outputs.
    "07-subprocesos": ["function b = porreferencia(b)", "c = porreferencia(c);", "function v = recibevector(v)", "a = recibevector(a);"],
    // Arrays of texts are cells.
    "04-arreglos": ["a = repmat({''}, 1, 10);", "b = repmat({''}, 20, 30);", "e = repmat({''}, 1, n);", "a{10} = a{1};"],
    "05-para": ["a = zeros(1, 10);", "b(b_i, b_j) = c;"],
    // Repetir becomes a loop that breaks at its condition.
    "03-estructuras": ["while true", "if c == 10", "break;"],
    // rem keeps the dividend's sign like PSeInt's %; values printed like PSeInt.
    "08-operadores": ["comparar_texto(e, f) < 0", "rem(a, b)", "fprintf('%s\\n', texto(a / b));"],
    "09-funciones": ["randi(15) - 1", "str2double('15.5')"],
  },
  runtime: {
    available: () => hasCommand("octave-cli", ["--version"]),
    // A function file is named after its main function.
    file: (code) => `${/^function (\w+)\(\)/m.exec(code)![1]}.m`,
    steps: (file) => [["octave-cli", ["--no-gui", "--quiet", "--eval", file.replace(/\.m$/, "")]]],
  },
});

describe("matlab export details", () => {
  const translate = (source: string) => generateExport(new Parser(source).parse().program!, "matlab").code!;

  it("returns by-reference parameters and assigns them back, also inside expressions", () => {
    const code = translate(`Funcion r <- SiguientePar(n Por Referencia)
  n <- n + 1
  r <- n * 10
FinFuncion
Algoritmo a
  x <- 1
  Escribir SiguientePar(x) + 1
  SiguientePar(x)
FinAlgoritmo`);
    expect(code).toContain("function [r, n] = siguientepar(n)");
    expect(code).toContain("[resultado, x] = siguientepar(x);");
    expect(code).toContain("[~, x] = siguientepar(x);");
  });

  it("puts literal texts in the format and escapes it", () => {
    const code = translate(`Algoritmo a
  Escribir "100% it's", 5
FinAlgoritmo`);
    expect(code).toContain("fprintf('100%% it''s%d\\n', 5);");
  });
});
