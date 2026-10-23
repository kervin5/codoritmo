# PSeInt Parity Review (2026-10-20)

> **Status update (2026-10-23).** Most of this review has been addressed since it was written:
> - The interpreter now passes 192/192 of upstream's `test/interp` cases (`src/__tests__/upstream-interp.test.ts`).
> - Done: step-by-step execution, desk check (prueba de escritorio) with watched expressions, evaluating expressions while paused, Stop, opening `.psc` files, predefined input lists (load/save `.txt`), all 463 school profiles, autocomplete and hover help, SVG export, Nassi-Shneiderman diagrams and alternative I/O shapes, building and editing the program from the flowchart, and export to C, C++, Java, Python, JavaScript, C#, PHP, Pascal, Visual Basic, QBasic, MatLab/Octave and HTML.
> - Remaining differences: Codoritmo needs a browser (no offline desktop app), and rare edge cases may still differ.
> The original findings below are kept for history.

## 1. Where upstream actually is

- `tmp/pseint` is a **stale GitHub mirror** (miguelinux/pseint), frozen at **20210609**. All our profiles and assumptions came from it.
- Official source: `https://git.code.sf.net/p/pseint/code`. Active work is on the **`pseint2` branch**. The latest tag is **`pseint-20250218`**. No release after that could be found (Oct 2026).
- Releases since our snapshot: 20230517, 20240122, 20250218.

### New upstream features we're missing
| Feature | Release | Status here |
|---|---|---|
| `Redimensionar` primitive + `allow_resize_arrays` profile flag (also allows a dim of 0) | 2023/2025 | missing |
| `Dimensionar` as synonym of `Dimension` | 2023 | missing |
| `FechaActual()` (AAAAMMDD), `HoraActual()` (HHMMSS) | 2023 | missing |
| Warning 329: numeric constant / input with too many digits | 2023 | missing |
| Better `Leer` arg checking with arrays | 2023 | partial |
| SVG export of flowchart | 2025 | PNG only |
| Load/save predefined inputs from a text file | 2025 | missing |
| Fullscreen code (F11), "zoom to fit selection" | 2023 | missing |
| Keyboard pan/zoom in diagram | 2025 | check |
| ~79 new school profiles (464 upstream vs 385 here) | all | missing |

Older keywords that were never ported (from upstream `Keywords.cpp`):
- `Imprimir` and `Informar`. Right now these are **silently ignored**, with no output and no error.
- `Sin Saltar`, `SinSaltar`, `SinBajar`
- `Borrar Pantalla`, `LimpiarPantalla`, `BorrarPantalla`
- `Por Valor`, `Por Copia`
- `SubAlgoritmo` as an opener and `Fin SubAlgoritmo` as a closer
- Type synonyms: `Enteros`, `Entera`, `Reales`, `Numero`, `Numérica`, `Texto`, `Cadena(s)`, `Carácter`, `Caracteres`, `Lógica`, and others
- `Para Cada x **En** a`, which takes `En` as well as `De`
- `Si Es` as a Segun option label; `Segun x` without `Hacer` under lazy syntax
- `EULER`, `Aleatorio(a,b)`

## 2. Upstream test suite results (192 cases from `test/interp`)

The harness runs each upstream `.psc/.arg/.in/.out` through our `Interpreter`, one case per process with a timeout.
- **86 / 192 exact pass.** Another 19 get the right error kind on the wrong line.
- Our own jest suite passes 60/61, so **it does not catch any of the issues below**.
- **Only 7 of upstream's 25 bundled example programs (`bin/ejemplos`) parse.**
  The main causes are `Como Enteros` (15 examples) and the `&` and `%` operators (4).

Recommendation: vendor upstream `test/interp` into `fixtures/upstream/` and make it a CI gate.
Track the pass rate rather than requiring 100% at first.

## 3. Bugs, by severity

### Critical (breaks common student programs)
1. **Infinite loop freezes the browser tab.** The interpreter runs on the main thread with no step budget, no yield and no Stop button.
   I confirmed this in the dev server: after Run on `Mientras Verdadero`, the page couldn't even run `Date.now()`.
   Fix: run it in a Web Worker, add a Stop button, and add an optional step limit.
2. **A comma after a numeric literal is lexed as a decimal separator** (`lexer.ts` readNumber).
   - `Escribir 1, 2` fails.
   - `Dimension m[3,4]` fails.
   - `Subcadena("hola",2,3)` is parsed as `2.3`.
3. **Operators `&`, `|`, `%` and `~` are not supported.** Only `{&&}`-style forms are recognised, and braces are otherwise treated as comments, which PSeInt doesn't do.
4. **Lowercase `y` and `o` are not treated as AND/OR** (`lexer.ts:280`, the `lexeme !== 'y'` check). `Si x>1 y x<5` is a parse error.
5. **`Leer` into an untyped variable stores a string.** `Leer x` followed by `x+1` with input 7 gives `"71"`.
   PSeInt infers the type from the input. Typed reads aren't validated either: `Entero` accepts `3.7`, and `Numerica` accepts `hola`.
6. **Arrays passed to subprocesses aren't shared**, and **`Para Cada` doesn't write back to the array.**
   PSeInt passes arrays by reference and `Para Cada` aliases the elements (`subproceso-12`, `paracada-01`).
7. **Non-boolean conditions are accepted.** `Mientras 3 Hacer` loops forever instead of raising SynError 92/104/95, and combined with #1 that freezes the tab.

### High (silent divergence)
- **Number formatting.** PSeInt rounds output to 10 decimals: `0.1+0.2` prints `0.3`, but we print `0.30000000000000004`.
  `1/3` prints `0.3333333333`. `ConvertirATexto` should use the same rounding.
- `trunc(100*0.57)` gives 56 but should be 57; upstream applies a 1e-11 epsilon.
  `redon(-2.5)` gives -2 but should be -3 (half away from zero).
- **Division by zero prints `Infinity`.** PSeInt raises a runtime error.
- **`asen`/`acos` out of [-1,1], `rc` of a negative number, `ln` of 0 or less, and `azar` of 0 or less** all return NaN instead of erroring (codes 312, 147, 148, 306).
- **Precedence of `NO`.** `no 1=2` should be `no (1=2)` = VERDADERO, but we return FALSO.
- **Identifier case-insensitivity is incomplete.** Calling `A` when the routine is defined as `a` fails. Routines can't be called without parentheses, and `a(1)` doesn't work as array indexing.
- **Implicit concatenation is not supported** (`Escribir "a" 2` should print `a2`).
- Unary `+` (`Escribir +4`) fails.
- `Segun` case labels as expressions (`1^5`, `0*5+2`) fail.
- Reading an uninitialised variable or array element prints empty instead of erroring.
- Missing static checks: a variable with the same name as a function (SynError 86), logical operators on numbers (289), and calling a function without using its return value (278/265).
- `force_semicolon` is not implemented. 24 upstream profiles require it.

### Medium
- Backslash escapes are processed in strings (`"C:\nuevo"` gets a newline). PSeInt has no escapes.
- `scripts/parse-pseint-profiles.js`:
  - It maps `allow_word_operators` instead of `word_operators`, so that flag is dropped.
  - Real `desc=` descriptions are lost; every profile gets "Profile for X".
  - It ignores `prefer_*` and `force_semicolon`.
- `formatRuntimeValue` uses `String(value)`, so large or small numbers come out as JS exponent notation.

## 4. Code export (C and other languages)

- Ours: **JavaScript only** (browser and node).
- Upstream `psexport` (`pseint2` branch) supports **C, C++, C#, Java, JavaScript, Python, PHP, Pascal, VB, QBasic, MatLab and HTML**.
- Upstream's reference outputs are in `test/export/{c,cpp,py2,...}` with 10 sample programs each, so we can test against them directly.
- Suggested order: C → C++ → Python → Java. Build a shared typed-AST pass first, because C needs type inference to choose `int`, `float` or `char*`.

## 5. UI: features PSeInt has that we lack

- **Step-by-step execution** with line highlighting. This is PSeInt's core teaching feature.
- **Variable inspector / watch panel**, including during a run.
- **"Prueba de escritorio"** (desktop-test table that traces variable values per step). There's no browser competitor with it, so it could differentiate Codoritmo.
- Evaluating an expression while paused.
- A Stop button, which depends on the Web Worker fix.
- Opening `.psc` files from disk (download exists, upload doesn't).
- Predefined input list with load/save, which upstream just added.
- Flowchart → code editing. PSeInt's diagram is an editor; ours is view-only.
- Nassi-Shneiderman diagram mode and the alternative I/O shapes setting.
- SVG diagram export.
- Monaco autocomplete and hover help for keywords and builtins.
- Only 4 examples here versus 25 upstream. The upstream examples could be ported once the parser fixes land.

### UI improvement ideas (beyond parity)
- Show the parity / profile mode in the status bar (e.g. "Perfil: UTN · base 0").
- Problems panel: link each error to a short explanation and a "fix" quick action.
- Share links already exist; add an "embed" mode so teachers can put it in an LMS.
- Side-by-side pseudocode ↔ generated C/Python view to help students moving to real languages.
