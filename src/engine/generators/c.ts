import type { AssignableExpressionNode, ExpressionNode } from "../types";
import {
  CFamilyGenerator,
  escapeCString,
  PREC,
  Rendered,
  substringLength,
  toIdentifier,
  wrap,
} from "./c-family";
import {
  InferredType,
  resolveType,
  VariableInfo,
} from "./type-inference";

/**
 * Exports pseudocode to standard C (C99), following the layout of upstream
 * PSeInt's CExporter. Strings become fixed-size `char` arrays and string
 * expressions use rotating auxiliary buffers, as upstream does. The output
 * only depends on the C standard library so it can be compiled anywhere,
 * including by a C toolchain running in the browser.
 */
export class CGenerator extends CFamilyGenerator {
  protected comment(text: string): string {
    return `/* ${text} */`;
  }

  private typeName(type: InferredType): string {
    return type === "string" ? "char" : this.baseTypeName(type);
  }

  protected declaration(info: VariableInfo, asParameter: boolean): string {
    const type = this.variableType(info);
    const name = toIdentifier(info.name);
    const typeName = this.typeName(type);
    const dims = this.arraySuffix(info, asParameter);
    if (type === "string") {
      this.uses.add("string");
      if (asParameter && !info.array) return `char *${name}`;
      return `char ${name}${dims}[MAX_STRLEN]`;
    }
    if (asParameter && info.param?.byReference && !info.array) {
      return `${typeName} *${name}`;
    }
    return `${typeName} ${name}${dims}`;
  }

  protected passesByPointer(info: VariableInfo): boolean {
    return resolveType(info.type) === "string";
  }

  protected returnTypeName(type: InferredType): string {
    return type === "string" ? "char *" : this.typeName(type);
  }

  protected returnStatement(info: VariableInfo, value: string): string {
    if (resolveType(info.type) === "string") {
      // A local array cannot outlive the function: copy it to a buffer.
      this.uses.add("aux_buffer");
      return `return strcpy(get_aux_buffer(), ${value});`;
    }
    return `return ${value};`;
  }

  protected write(args: ExpressionNode[], newline: boolean): string[] {
    let format = "";
    const values: string[] = [];
    for (const arg of args) {
      if (arg.kind === "literal" && arg.valueType === "string") {
        format += escapeCString(String(arg.value)).slice(1, -1).replace(/%/g, "%%");
        continue;
      }
      const type = resolveType(this.typeOf(arg));
      const rendered = this.expression(arg);
      if (type === "string") {
        format += "%s";
        values.push(rendered.code);
      } else if (type === "bool") {
        format += "%s";
        values.push(`${wrap(rendered, PREC.or)} ? "VERDADERO" : "FALSO"`);
      } else if (this.isCInt(arg)) {
        format += "%i";
        values.push(rendered.code);
      } else {
        format += "%g";
        values.push(rendered.code);
      }
    }
    if (newline) format += "\\n";
    if (!format) return [];
    return [`printf("${format}"${values.map((value) => `, ${value}`).join("")});`];
  }

  protected read(targets: AssignableExpressionNode[]): string[] {
    return targets.map((target) => {
      const type = resolveType(this.typeOf(target));
      const rendered = this.expression(target);
      switch (type) {
        case "string":
          this.uses.add("read_strings");
          return `scanf("%s", ${rendered.code});`;
        case "bool":
          this.uses.add("leer_logico");
          return `${rendered.code} = leer_logico();`;
        case "int":
          return `scanf("%d", &${wrap(rendered, PREC.unary)});`;
        default:
          return `scanf("%lf", &${wrap(rendered, PREC.unary)});`;
      }
    });
  }

  protected assign(target: AssignableExpressionNode, value: ExpressionNode): string {
    const left = this.expression(target).code;
    const right = this.expression(value).code;
    if (resolveType(this.typeOf(target)) === "string") {
      return `strcpy(${left}, ${right});`;
    }
    return `${left} = ${right};`;
  }

  protected forEachLoop(alias: VariableInfo, collection: VariableInfo, dims: string[]) {
    const name = toIdentifier(collection.name);
    const pointer = toIdentifier(alias.name);
    const first = `${name}${dims.map(() => "[0]").join("")}`;
    const last = `${name}${dims.map((dim) => `[${lastIndex(dim)}]`).join("")}`;
    const type = this.variableType(collection);
    const declaration =
      type === "string"
        ? `char (*${pointer})[MAX_STRLEN]`
        : `${this.typeName(type)} *${pointer}`;
    return {
      open: [`for (${declaration}=&(${first}); ${pointer}<=&(${last}); ++${pointer}) {`],
      aliasExpression: `(*${pointer})`,
    };
  }

  protected clearScreen(): string {
    return `printf("\\033[2J\\033[H");${
      this.comments ? " /* secuencia ANSI: C estándar no puede borrar la pantalla */" : ""
    }`;
  }

  protected waitKey(): string {
    return `getchar();${
      this.comments ? " /* espera un Enter, no cualquier tecla */" : ""
    }`;
  }

  protected referenceParameter(name: string): string {
    return `(*${name})`;
  }

  protected referenceArgument(arg: Rendered): string {
    // A by-reference parameter passed on is already a pointer.
    const pointer = /^\(\*(\w+)\)$/.exec(arg.code);
    return pointer ? pointer[1] : `&${wrap(arg, PREC.unary)}`;
  }

  protected emptyParameterList(): string {
    return "void";
  }

  protected castToInt(rendered: Rendered): Rendered {
    return { code: `(int)${wrap(rendered, PREC.unary)}`, prec: PREC.unary };
  }

  protected castToDouble(rendered: Rendered): Rendered {
    return { code: `(double)${wrap(rendered, PREC.unary)}`, prec: PREC.unary };
  }

  protected stringBinary(
    operator: string,
    left: ExpressionNode,
    right: ExpressionNode
  ): Rendered {
    const l = this.expression(left).code;
    const r = this.expression(right).code;
    this.uses.add("string");
    if (operator === "+") return this.concat(l, r);
    const op = { "=": "==", "<>": "!=" }[operator] ?? operator;
    return {
      code: `strcmp(${l}, ${r})${op}0`,
      prec: op === "==" || op === "!=" ? PREC.equality : PREC.relational,
    };
  }

  private concat(left: string, right: string): Rendered {
    this.uses.add("aux_buffer");
    return {
      code: `strcat(strcpy(get_aux_buffer(), ${left}), ${right})`,
      prec: PREC.primary,
    };
  }

  protected builtin(name: string, args: ExpressionNode[]): Rendered | null {
    const arg = (index: number) => this.expression(args[index]).code;
    const call = (fn: string, header = "math"): Rendered => {
      this.uses.add(header);
      return { code: `${fn}(${args.map((_, i) => arg(i)).join(", ")})`, prec: PREC.primary };
    };
    switch (name) {
      case "RC":
      case "RAIZ":
        return call("sqrt");
      case "ABS":
        return call("fabs");
      case "LN":
        return call("log");
      case "EXP":
        return call("exp");
      case "SEN":
      case "SIN":
        return call("sin");
      case "COS":
        return call("cos");
      case "TAN":
        return call("tan");
      case "ASEN":
      case "ASIN":
        return call("asin");
      case "ACOS":
        return call("acos");
      case "ATAN":
        return call("atan");
      case "REDON":
        this.uses.add("math");
        return { code: `(int)floor(${arg(0)}+0.5)`, prec: PREC.unary };
      case "TRUNC":
        return this.castToInt(this.expression(args[0]));
      case "AZAR":
        this.uses.add("stdlib");
        return { code: `(rand()%${wrap(this.integer(args[0]), PREC.unary)})`, prec: PREC.primary };
      case "ALEATORIO": {
        this.uses.add("stdlib");
        const low = wrap(this.integer(args[0]), PREC.additive);
        const high = wrap(this.integer(args[1]), PREC.additive);
        return { code: `(${low}+rand()%(${high}-${low}+1))`, prec: PREC.primary };
      }
      case "LONGITUD":
        this.uses.add("string");
        return { code: `(int)strlen(${arg(0)})`, prec: PREC.unary };
      case "MAYUSCULAS":
      case "MINUSCULAS":
        this.uses.add(name.toLowerCase());
        return { code: `${name.toLowerCase()}(${arg(0)})`, prec: PREC.primary };
      case "SUBCADENA": {
        this.uses.add("subcadena");
        const base = this.settings.baseZeroArrays ? 0 : -1;
        return {
          code: `subcadena(${arg(0)}, ${this.integer(args[1], base).code}, ${substringLength(this, args[1], args[2])})`,
          prec: PREC.primary,
        };
      }
      case "CONCATENAR":
        this.uses.add("string");
        return this.concat(arg(0), arg(1));
      case "CONVERTIRANUMERO":
        return call("atof", "stdlib");
      case "CONVERTIRATEXTO":
        this.uses.add("convertiratexto");
        return { code: `convertiratexto(${arg(0)})`, prec: PREC.primary };
      default:
        return null;
    }
  }

  private resolveUses(): void {
    const uses = this.uses;
    if (uses.has("mayusculas") || uses.has("minusculas")) uses.add("ctype");
    if (
      uses.has("mayusculas") ||
      uses.has("minusculas") ||
      uses.has("subcadena") ||
      uses.has("convertiratexto")
    ) {
      uses.add("aux_buffer");
    }
    if (uses.has("aux_buffer") || uses.has("leer_logico")) uses.add("string");
    if (uses.has("leer_logico")) uses.add("bool");
    if (uses.has("esperar")) uses.add("time");
  }

  protected header(): string[] {
    const uses = this.uses;
    const lines: string[] = [];
    if (this.comments) {
      lines.push(
        "/* Este código fue generado por Codoritmo a partir del pseudocódigo.",
        "   Puede que no sea completamente correcto: revíselo antes de usarlo. */",
        ""
      );
    }
    lines.push("#include<stdio.h>");
    if (uses.has("math")) lines.push("#include<math.h>");
    if (uses.has("stdlib")) lines.push("#include<stdlib.h>");
    if (uses.has("time")) lines.push("#include<time.h>");
    if (uses.has("bool")) lines.push("#include<stdbool.h>");
    if (uses.has("ctype")) lines.push("#include<ctype.h>");
    if (uses.has("string")) lines.push("#include<string.h>");
    if (this.comments) lines.push("");

    if (uses.has("pi")) {
      lines.push("#ifndef M_PI", "#define M_PI 3.14159265358979323846", "#endif");
    }
    if (uses.has("arreglo_max")) {
      if (this.comments) {
        lines.push(
          "/* C no permite dimensionar arreglos estáticos con un tamaño variable:",
          "   se usa un tamaño máximo ARREGLO_MAX. */"
        );
      }
      lines.push("#define ARREGLO_MAX 100");
    }
    if (uses.has("string")) {
      if (this.comments) {
        lines.push(
          "/* Las cadenas son arreglos de char de tamaño MAX_STRLEN (incluido el",
          "   caracter de terminación). */"
        );
      }
      lines.push("#define MAX_STRLEN 256");
    }
    if (uses.has("aux_buffer")) lines.push("#define MAX_BUFFERS 10");
    if (uses.has("sin_tipo")) {
      if (this.comments) {
        lines.push(
          "/* No se pudo determinar el tipo de algunas variables: se declaran como",
          "   SIN_TIPO. Reemplácelo por el tipo adecuado (int, double, bool o char[]). */"
        );
      }
      lines.push("#define SIN_TIPO double");
    }
    if (uses.has("read_strings") && this.comments) {
      lines.push(
        "/* scanf(\"%s\", x) lee una sola palabra. Para leer una línea completa use",
        "   fgets(x, MAX_STRLEN, stdin). */"
      );
    }

    const prototypes: string[] = [];
    if (uses.has("esperar")) prototypes.push("void esperar(double milisegundos);");
    if (uses.has("leer_logico")) prototypes.push("bool leer_logico(void);");
    if (uses.has("convertiratexto")) prototypes.push("char *convertiratexto(double valor);");
    if (uses.has("mayusculas")) prototypes.push("char *mayusculas(const char *s);");
    if (uses.has("minusculas")) prototypes.push("char *minusculas(const char *s);");
    if (uses.has("subcadena")) {
      prototypes.push("char *subcadena(const char *s, int desde, int cuantos);");
    }
    if (uses.has("aux_buffer")) prototypes.push("char *get_aux_buffer(void);");
    if (prototypes.length > 0) {
      if (this.comments) lines.push("/* Funciones auxiliares, definidas al final */");
      lines.push(...prototypes);
    }
    if (this.comments && lines[lines.length - 1] !== "") lines.push("");
    return lines;
  }

  protected footer(): string[] {
    this.resolveUses();
    const uses = this.uses;
    const blocks: string[][] = [];
    if (uses.has("aux_buffer")) {
      blocks.push([
        ...(this.comments
          ? [
              "/* Devuelve uno de varios buffers estáticos, rotando, para guardar",
              "   cadenas temporales (concatenaciones, resultados de funciones). */",
            ]
          : []),
        "char *get_aux_buffer(void) {",
        "\tstatic char buffers[MAX_BUFFERS][MAX_STRLEN];",
        "\tstatic int actual = 0;",
        "\tactual = (actual+1)%MAX_BUFFERS;",
        "\tbuffers[actual][0] = '\\0';",
        "\treturn buffers[actual];",
        "}",
      ]);
    }
    if (uses.has("esperar")) {
      blocks.push([
        "void esperar(double milisegundos) {",
        "\tclock_t inicio = clock();",
        "\twhile (1000.0*(clock()-inicio)/CLOCKS_PER_SEC<milisegundos) {",
        "\t}",
        "}",
      ]);
    }
    if (uses.has("leer_logico")) {
      blocks.push([
        "bool leer_logico(void) {",
        "\tchar palabra[MAX_STRLEN];",
        "\tif (scanf(\"%255s\", palabra)!=1) return false;",
        "\treturn palabra[0]=='v' || palabra[0]=='V' || palabra[0]=='1';",
        "}",
      ]);
    }
    if (uses.has("convertiratexto")) {
      blocks.push([
        "char *convertiratexto(double valor) {",
        "\tchar *buffer = get_aux_buffer();",
        "\tsprintf(buffer, \"%g\", valor);",
        "\treturn buffer;",
        "}",
      ]);
    }
    for (const [name, fn] of [
      ["mayusculas", "toupper"],
      ["minusculas", "tolower"],
    ]) {
      if (!uses.has(name)) continue;
      blocks.push([
        `char *${name}(const char *s) {`,
        "\tchar *buffer = get_aux_buffer();",
        "\tint i;",
        "\tfor (i=0; s[i]!='\\0' && i<MAX_STRLEN-1; ++i) {",
        `\t\tbuffer[i] = (char)${fn}((unsigned char)s[i]);`,
        "\t}",
        "\tbuffer[i] = '\\0';",
        "\treturn buffer;",
        "}",
      ]);
    }
    if (uses.has("subcadena")) {
      blocks.push([
        "char *subcadena(const char *s, int desde, int cuantos) {",
        "\tchar *buffer = get_aux_buffer();",
        "\tint largo = (int)strlen(s);",
        "\tif (desde<0) desde = 0;",
        "\tif (desde>largo) desde = largo;",
        "\tif (cuantos>largo-desde) cuantos = largo-desde;",
        "\tif (cuantos<0) cuantos = 0;",
        "\tstrncpy(buffer, s+desde, cuantos);",
        "\tbuffer[cuantos] = '\\0';",
        "\treturn buffer;",
        "}",
      ]);
    }
    return blocks.flatMap((block, index) =>
      index > 0 && this.comments ? ["", ...block] : block
    );
  }
}

function lastIndex(dim: string): string {
  return /^\d+$/.test(dim) ? String(Number(dim) - 1) : `${dim}-1`;
}

