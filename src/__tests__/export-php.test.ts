/**
 * @jest-environment node
 */
import { Parser } from "../engine";
import { generateExport } from "../engine/generators";
import { describeExportLanguage, hasCommand } from "./helpers/export-languages";

describeExportLanguage({
  language: "php",
  upstream: "php",
  shared: {
    "01-tipos": ["<?php", "$a = 1;", "$b = 2.5;", "$c = true;", "$e = 'Hola';"],
    "02-entrada-salida": ["rtrim(fgets(", "echo 'Esta linea no lleva enter al final';"],
    "03-estructuras": ["while ($c <= 10) {", "} while ($c != 10);", "if ($c == 10) {", "} else {"],
    "04-arreglos": ["$a[10] = $a[1];", "$b[10][10]"],
    "05-para": ["for ($i = 1; $i <= 10; $i++) {", "foreach ($a as $elemento) {", "for ($j = 1; $j <= 5; $j += 2) {"],
    "06-segun": ["switch ($c) {", "case 3:", "default:"],
    "07-subprocesos": ["function porreferencia(&$b)", "porreferencia($c);", "return $a;"],
    "08-operadores": ["$c && $d", "!($c && $d)", "$e . ' ' . $f"],
    "09-funciones": ["sqrt($x)", "asin($x)", "round($x)"],
    "10-otros": ["usleep(", "M_PI"],
  },
  own: {
    // PHP copies arrays: they are passed by reference to share them like PSeInt.
    "07-subprocesos": ["function recibevector(&$v)", "function recibematriz(&$m)"],
    // Arrays are created with their size, from the pseudocode's base.
    "04-arreglos": ["$a = array_fill(1, 10, '');", "$b = array_fill(1, 20, array_fill(1, 30, ''));"],
    // Strict comparison for texts, strcmp to order them, multibyte functions.
    "08-operadores": ["fmod($a, $b)", "$e === $f", "strcmp($e, $f) < 0", "texto($a / $b)"],
    "09-funciones": ["mb_strtoupper($s)", "mb_substr($s, 1, 2)", "rand(0, 14)", "(int) round($x)"],
    // Para Cada writes through references.
    "05-para": ["foreach ($b_fila as &$x) {", "unset($x, $b_fila);"],
  },
  runtime: {
    available: () => hasCommand("php", ["--version"]),
    file: () => "programa.php",
    steps: (file) => [["php", [file]]],
  },
});

describe("php export details", () => {
  const translate = (source: string) => generateExport(new Parser(source).parse().program!, "php").code!;

  it("passes variables and array elements to by-reference parameters", () => {
    const code = translate(`SubProceso Sumar(t Por Referencia, v)
  t <- t + v
FinSubProceso
Algoritmo a
  x <- 1
  Sumar(x, 2.5)
  Dimension w[2]
  Sumar(w[2], 1)
FinAlgoritmo`);
    expect(code).toContain("function sumar(&$t, $v)");
    expect(code).toContain("sumar($x, 2.5);");
    expect(code).toContain("sumar($w[2], 1);");
  });

  it("keeps decimals in % and starts variables read before being assigned", () => {
    const code = translate(`Algoritmo a
  Si falso Entonces
    t <- 1
  FinSi
  Escribir t, 7.5 % 2
FinAlgoritmo`);
    expect(code).toMatch(/^\$t = 0\.0;/m);
    expect(code).toContain("fmod(7.5, 2)");
  });
});
