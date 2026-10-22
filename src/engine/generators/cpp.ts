import type { AssignableExpressionNode, ExpressionNode } from "../types";
import {
  CFamilyGenerator,
  PREC,
  Rendered,
  substringLength,
  toIdentifier,
  wrap,
} from "./c-family";
import { LETTER_CASES } from "./c";
import { InferredType, resolveType, VariableInfo } from "./type-inference";

/**
 * Exports pseudocode to C++ (C++11), following the layout of upstream PSeInt's
 * CppExporter: iostream for input/output, std::string for text, references
 * for by-reference parameters.
 */
export class CppGenerator extends CFamilyGenerator {
  protected comment(text: string): string {
    return `// ${text}`;
  }

  protected declaration(info: VariableInfo, asParameter: boolean): string {
    const typeName = this.baseTypeName(this.variableType(info));
    const name = toIdentifier(info.name);
    if (asParameter && info.param?.byReference && !info.array) {
      return `${typeName} &${name}`;
    }
    return `${typeName} ${name}${this.arraySuffix(info, asParameter)}`;
  }

  protected initializer(info: VariableInfo): string {
    if (info.array) return " = {}";
    const type = this.variableType(info);
    if (type === "string" || type === "unknown") return "";
    return type === "bool" ? " = false" : " = 0";
  }

  protected zeroValue(type: InferredType): string {
    if (type === "string" || type === "unknown") return '""';
    return type === "bool" ? "false" : "0";
  }

  protected returnTypeName(type: InferredType): string {
    return this.baseTypeName(type);
  }

  protected returnStatement(_info: VariableInfo, value: string): string {
    return `return ${value};`;
  }

  /** Wraps a string literal so `+` and comparisons work on std::string. */
  private stringOperand(expression: ExpressionNode): Rendered {
    const rendered = this.expression(expression);
    if (this.isStringLiteral(expression)) {
      this.uses.add("string");
      return { code: `string(${rendered.code})`, prec: PREC.primary };
    }
    return rendered;
  }

  protected write(args: ExpressionNode[], newline: boolean): string[] {
    let line = "cout";
    for (const arg of args) {
      const rendered = this.expression(arg);
      const type = resolveType(this.typeOf(arg));
      if (type === "bool") {
        line += ` << (${wrap(rendered, PREC.or)} ? "VERDADERO" : "FALSO")`;
      } else if (type !== "unknown" && this.printsAsReal(arg)) {
        // Reals print rounded to 10 decimals, like PSeInt.
        this.uses.add("convertiratexto");
        line += ` << convertiratexto(${rendered.code})`;
      } else {
        line += ` << ${wrap(rendered, PREC.shift + 1)}`;
      }
    }
    if (newline) line += " << endl";
    return line === "cout" ? [] : [`${line};`];
  }

  protected read(targets: AssignableExpressionNode[]): string[] {
    if (targets.some((target) => resolveType(this.typeOf(target)) === "string")) {
      this.uses.add("read_strings");
    }
    return [
      `cin${targets.map((target) => ` >> ${this.expression(target).code}`).join("")};`,
    ];
  }

  protected assign(target: AssignableExpressionNode, value: ExpressionNode): string {
    return `${this.expression(target).code} = ${this.expression(value).code};`;
  }

  protected forEachLoop(
    alias: VariableInfo,
    collection: VariableInfo,
    dims: string[],
    aliasRead: boolean
  ) {
    const name = toIdentifier(collection.name);
    const pointer = `aux_ptr_${this.forEachDepth}`;
    const first = `${name}${dims.map(() => "[0]").join("")}`;
    const last = `${name}${dims
      .map((dim) => `[${/^\d+$/.test(dim) ? Number(dim) - 1 : `${dim}-1`}]`)
      .join("")}`;
    const aliasName = toIdentifier(alias.name);
    return {
      open: [
        `for (auto ${pointer}=&(${first}); ${pointer}<=&(${last}); ++${pointer}) {`,
        `\tauto &${aliasName} = *${pointer};`,
        ...(aliasRead ? [] : [`\t(void)${aliasName};`]),
      ],
      aliasExpression: aliasName,
    };
  }

  protected clearScreen(): string {
    return `cout << "\\033[2J\\033[H";${
      this.comments ? " // secuencia ANSI: C++ estándar no puede borrar la pantalla" : ""
    }`;
  }

  protected waitKey(): string {
    return `cin.get();${this.comments ? " // espera un Enter, no cualquier tecla" : ""}`;
  }

  protected referenceParameter(name: string): string {
    return name;
  }

  protected referenceArgument(arg: Rendered): string {
    return arg.code;
  }

  protected castToInt(rendered: Rendered): Rendered {
    return { code: `int(${rendered.code})`, prec: PREC.primary };
  }

  protected castToDouble(rendered: Rendered): Rendered {
    return { code: `double(${rendered.code})`, prec: PREC.primary };
  }

  protected stringBinary(
    operator: string,
    left: ExpressionNode,
    right: ExpressionNode
  ): Rendered {
    this.uses.add("string");
    const prec =
      operator === "+"
        ? PREC.additive
        : operator === "=" || operator === "<>"
        ? PREC.equality
        : PREC.relational;
    const op = { "=": "==", "<>": "!=" }[operator] ?? operator;
    return {
      code: `${wrap(this.stringOperand(left), prec)}${op}${wrap(this.expression(right), prec + 1)}`,
      prec,
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
        return { code: `int(${this.stringOperand(args[0]).code}.size())`, prec: PREC.primary };
      case "MAYUSCULAS":
      case "MINUSCULAS":
        this.uses.add(name.toLowerCase());
        return { code: `${name.toLowerCase()}(${arg(0)})`, prec: PREC.primary };
      case "SUBCADENA": {
        const base = this.settings.baseZeroArrays ? 0 : -1;
        return {
          code: `${wrap(this.stringOperand(args[0]), PREC.primary)}.substr(${this.integer(args[1], base).code}, ${substringLength(this, args[1], args[2])})`,
          prec: PREC.primary,
        };
      }
      case "CONCATENAR":
        this.uses.add("string");
        return {
          code: `(${this.stringOperand(args[0]).code}+${wrap(this.expression(args[1]), PREC.additive + 1)})`,
          prec: PREC.primary,
        };
      case "CONVERTIRANUMERO": {
        this.uses.add("stdlib");
        const value = this.expression(args[0]);
        return {
          code: this.isStringLiteral(args[0])
            ? `atof(${value.code})`
            : `atof(${wrap(value, PREC.primary)}.c_str())`,
          prec: PREC.primary,
        };
      }
      case "CONVERTIRATEXTO":
        this.uses.add("convertiratexto");
        return { code: `convertiratexto(${arg(0)})`, prec: PREC.primary };
      default:
        return null;
    }
  }

  protected header(): string[] {
    const uses = this.uses;
    if (uses.has("mayusculas") || uses.has("minusculas")) uses.add("ctype");
    if (uses.has("convertiratexto") || uses.has("sin_tipo")) uses.add("string");
    if (uses.has("convertiratexto")) uses.add("math");

    const lines: string[] = [];
    if (this.comments) {
      lines.push(
        "// Este código fue generado por Codoritmo a partir del pseudocódigo.",
        "// Puede que no sea completamente correcto: revíselo antes de usarlo.",
        ""
      );
    }
    lines.push("#include<iostream>");
    if (uses.has("math")) lines.push("#include<cmath>");
    if (uses.has("stdlib")) lines.push("#include<cstdlib>");
    if (uses.has("esperar") || uses.has("time")) lines.push("#include<ctime>");
    if (uses.has("ctype")) lines.push("#include<cctype>");
    if (uses.has("convertiratexto")) lines.push("#include<cstdio>", "#include<cstring>");
    if (uses.has("string")) lines.push("#include<string>");
    lines.push("using namespace std;");
    if (this.comments) lines.push("");

    lines.push(...this.constantDefinitions());
    if (uses.has("arreglo_max")) {
      if (this.comments) {
        lines.push(
          "// C++ no permite dimensionar arreglos estáticos con un tamaño variable:",
          "// se usa un tamaño máximo ARREGLO_MAX."
        );
      }
      lines.push("#define ARREGLO_MAX 100");
    }
    if (uses.has("sin_tipo")) {
      if (this.comments) {
        lines.push(
          "// No se pudo determinar el tipo de algunas variables: se declaran como",
          "// SIN_TIPO. Reemplácelo por el tipo adecuado (int, double, string o bool)."
        );
      }
      lines.push("#define SIN_TIPO string");
    }
    if (uses.has("read_strings") && this.comments) {
      lines.push(
        "// cin >> x lee una sola palabra. Para leer una línea completa use getline(cin, x)."
      );
    }

    const prototypes: string[] = this.sharedPrototypes();
    if (uses.has("esperar")) prototypes.push("void esperar(double milisegundos);");
    if (uses.has("convertiratexto")) prototypes.push("string convertiratexto(double valor);");
    if (uses.has("mayusculas")) prototypes.push("string mayusculas(string s);");
    if (uses.has("minusculas")) prototypes.push("string minusculas(string s);");
    if (prototypes.length > 0) {
      if (this.comments) lines.push("// Funciones auxiliares, definidas al final");
      lines.push(...prototypes);
    }
    if (this.comments && lines[lines.length - 1] !== "") lines.push("");
    return lines;
  }

  protected footer(): string[] {
    const uses = this.uses;
    const blocks: string[][] = [];
    if (uses.has("esperar")) {
      blocks.push([
        "void esperar(double milisegundos) {",
        "\tclock_t inicio = clock();",
        "\twhile (1000.0*(clock()-inicio)/CLOCKS_PER_SEC<milisegundos) {",
        "\t}",
        "}",
      ]);
    }
    if (uses.has("convertiratexto")) {
      blocks.push([
        ...(this.comments
          ? [
              "// Escribe un número como PSeInt: redondeado a 10 decimales, sin ceros",
              "// finales y sin notación exponencial.",
            ]
          : []),
        "string convertiratexto(double valor) {",
        "\tchar buffer[400];",
        "\tif (valor==floor(valor)) {",
        "\t\tsnprintf(buffer, sizeof buffer, \"%.0f\", valor);",
        "\t} else {",
        "\t\tsnprintf(buffer, sizeof buffer, \"%.10f\", valor);",
        "\t\tsize_t largo = strlen(buffer);",
        "\t\twhile (buffer[largo-1]=='0') buffer[--largo] = '\\0';",
        "\t\tif (buffer[largo-1]=='.') buffer[--largo] = '\\0';",
        "\t}",
        "\tif (strcmp(buffer, \"-0\")==0) return \"0\";",
        "\treturn buffer;",
        "}",
      ]);
    }
    for (const [name, fn, accent] of LETTER_CASES) {
      if (!uses.has(name)) continue;
      blocks.push([
        ...(this.comments && name === "mayusculas"
          ? ["// Las letras acentuadas y la ñ (UTF-8) también cambian."]
          : []),
        `string ${name}(string s) {`,
        "\tfor (size_t i=0; i<s.size(); ++i) {",
        `\t\ts[i] = char(${fn}((unsigned char)s[i]));`,
        "\t\tif ((unsigned char)s[i]==0xC3 && i+1<s.size()) {",
        "\t\t\tunsigned char c = (unsigned char)s[++i];",
        `\t\t\t${accent}`,
        "\t\t\ts[i] = char(c);",
        "\t\t}",
        "\t}",
        "\treturn s;",
        "}",
      ]);
    }
    blocks.push(...this.sharedHelpers());
    return blocks.flatMap((block, index) =>
      index > 0 && this.comments ? ["", ...block] : block
    );
  }
}
