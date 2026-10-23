// A tiny flowchart "scene" for each reference entry: the shape the instruction
// becomes in the diagram, drawn with the same geometry, palette and syntax
// colours as the live flowchart, plus just enough context (branches, a loop
// back-edge) to show how it behaves. Operators and functions don't have a
// shape of their own, so they're shown inside the block they usually live in.
//
// Produces standalone SVG markup: the reference panel shows it as an image,
// and the editor hover embeds it as a data URI.

import {
  DARK_EDGE_COLORS,
  DARK_TOKEN_COLORS,
  darkPaletteForFlowNodeKind,
  ioMarkerPath,
  SHAPE_FOR_KIND,
  shapeGeometry,
  tokenColor,
  tokenizeLabel,
  type FlowNodeKind,
} from "@/src/diagram";
import { EXPORT_LABEL_FONT_FAMILY } from "@/src/diagram/label";
import { DEFAULT_CASE_LABEL, FALSE_LABEL, TRUE_LABEL } from "@/src/diagram/model";

type Scene =
  | "single" // in → block → out
  | "branches" // decision with Sí / No
  | "while" // decision, body, back-edge to the top
  | "repeat" // body, decision, back-edge from the bottom
  | "for" // hexagon, body, back-edge
  | "cases"; // switch with several exits

export interface ShapeSpec {
  kind: FlowNodeKind;
  label: string;
  scene: Scene;
  /** For operators and functions: the block shown is where it's used, not its own shape. */
  context?: "condition" | "process";
  /** Repetir: which answer leaves the loop (Hasta Que exits on Sí, Mientras Que on No). */
  exitsOn?: "yes" | "no";
}

const S = (kind: FlowNodeKind, label: string, scene: Scene = "single"): ShapeSpec => ({ kind, label, scene });
const inCondition = (label: string): ShapeSpec => ({ kind: "decision", label, scene: "branches", context: "condition" });
const inProcess = (label: string): ShapeSpec => ({ kind: "process", label, scene: "single", context: "process" });

/** Keyed by snippet id. {and} {or} {not} {mod} are filled from the profile. */
const SPECS: Record<string, ShapeSpec> = {
  definir: S("process", "Definir edad Como Entero"),
  dimension: S("process", "Dimension notas[5]"),
  asignar: S("process", "puntos ← puntos + 5"),
  limpiar: S("process", "Limpiar Pantalla"),
  esperar: S("process", "Esperar 1 Segundo"),
  "esperar-tecla": S("process", "Esperar Tecla"),
  retornar: S("process", "Retornar b"),
  escribir: S("output", 'Escribir "Hola, ", nombre'),
  "escribir-linea": S("output", 'Escribir "Total: ", 3 + 4'),
  "escribir-sin-bajar": S("output", 'Escribir "Hola " Sin Saltar'),
  leer: S("input", "Leer edad"),
  si: S("decision", "edad >= 18", "branches"),
  "si-sino": S("decision", "nota >= minimo", "branches"),
  segun: S("switch", "opcion", "cases"),
  mientras: S("decision", "contador <= 3", "while"),
  repetir: { ...S("decision", "n > 0", "repeat"), exitsOn: "yes" },
  "repetir-hasta": { ...S("decision", 'clave = "1234"', "repeat"), exitsOn: "yes" },
  "repetir-mientras": { ...S("decision", "n < 0", "repeat"), exitsOn: "no" },
  para: S("loop", "Para i ← 1 Hasta 5", "for"),
  "para-cada": S("loop", "Para Cada nota De notas", "for"),
  rutina: S("call", 'Saludar("Ana")'),
  subproceso: S("call", 'Saludar("Ana")'),
  subalgoritmo: S("call", "Linea()"),
  funcion: S("process", "x ← Doble(21)"),
  plus: inProcess("total ← precio + envio"),
  minus: inProcess("vuelto ← pago - total"),
  multiply: inProcess("area ← base * altura"),
  divide: inProcess("promedio ← suma / n"),
  power: inProcess("area ← lado ^ 2"),
  mod: inCondition("n {mod} 2 = 0"),
  and: inCondition("edad >= 13 {and} edad <= 19"),
  or: inCondition('dia = "sab" {or} dia = "dom"'),
  not: inCondition("{not} encontrado"),
  eq: inCondition('clave = "1234"'),
  neq: inCondition("respuesta <> 0"),
  lt: inCondition("temperatura < 0"),
  leq: inCondition("intentos <= 3"),
  gt: inCondition("nota > 15"),
  geq: inCondition("edad >= 18"),
  abs: inProcess("distancia ← Abs(a - b)"),
  trunc: inProcess("enteros ← Trunc(x)"),
  redon: inProcess("nota ← Redon(promedio)"),
  raiz: inProcess("lado ← Raiz(area)"),
  azar: inProcess("dado ← Azar(6) + 1"),
  pi: inProcess("area ← PI * r ^ 2"),
  euler: inProcess("y ← Euler ^ x"),
  longitud: inProcess("n ← Longitud(nombre)"),
  subcadena: inProcess("ini ← SubCadena(s, 1, 3)"),
  concatenar: inProcess("saludo ← Concatenar(a, b)"),
  "convertir-numero": inProcess('n ← ConvertirANumero("42")'),
  "convertir-texto": inProcess("t ← ConvertirATexto(n)"),
};

export function shapeSpecFor(snippetId: string): ShapeSpec | null {
  return SPECS[snippetId] ?? null;
}

const CHAR = 7.4;
const FONT = 12.5;
const NODE_H = 40;
const DECISION_H = 58;
const PAD_X = 22;
const EDGE = DARK_EDGE_COLORS.default;
const BRANCH = DARK_EDGE_COLORS.branch;
const LOOP = DARK_EDGE_COLORS.loop;

const esc = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function labelMarkup(kind: FlowNodeKind, label: string, cx: number, cy: number): string {
  const palette = darkPaletteForFlowNodeKind(kind);
  const spans = tokenizeLabel(label)
    .map((token) => {
      const fill = tokenColor(token.type, palette, DARK_TOKEN_COLORS);
      const weight = token.type === "keyword" ? ' font-weight="600"' : "";
      return `<tspan fill="${fill}"${weight}>${esc(token.text)}</tspan>`;
    })
    .join("");
  return `<text x="${cx}" y="${cy}" dominant-baseline="central" text-anchor="middle" xml:space="preserve" font-size="${FONT}">${spans}</text>`;
}

function node(kind: FlowNodeKind, label: string, cx: number, top: number): { markup: string; width: number; height: number } {
  const decision = kind === "decision" || kind === "switch";
  const textWidth = [...label].length * CHAR;
  const width = Math.round(decision ? textWidth + 70 : textWidth + PAD_X * 2 + (kind === "input" || kind === "output" ? 24 : 0));
  const height = decision ? DECISION_H : NODE_H;
  const x = cx - width / 2;
  const palette = darkPaletteForFlowNodeKind(kind);
  const geometry = shapeGeometry(SHAPE_FOR_KIND[kind], width, height, x, top);
  let markup = `<path d="${geometry.outline}" fill="${palette.fill}" stroke="${palette.stroke}" stroke-width="1.4"/>`;
  if (geometry.details) markup += `<path d="${geometry.details}" fill="none" stroke="${palette.stroke}" stroke-width="1.3"/>`;
  if (kind === "input" || kind === "output") {
    markup += `<path d="${ioMarkerPath(kind, width, height, x, top)}" fill="none" stroke="${palette.stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  markup += labelMarkup(kind, label, cx, top + height / 2);
  return { markup, width, height };
}

const line = (d: string, color = EDGE, dashed = false, arrow = true) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.5"${dashed ? ' stroke-dasharray="4 4"' : ""}${arrow ? ` marker-end="url(#a-${color.slice(1)})"` : ""}/>`;

const edgeLabel = (text: string, x: number, y: number) =>
  `<g><rect x="${x - 13}" y="${y - 9}" width="26" height="18" rx="9" fill="#161B1E" stroke="${BRANCH}" stroke-opacity="0.5"/><text x="${x}" y="${y}" dominant-baseline="central" text-anchor="middle" font-size="10.5" font-weight="600" fill="#C3CCC8" font-family="-apple-system, system-ui, sans-serif">${esc(text)}</text></g>`;

/** Placeholder for "the instructions inside" a structure. */
const body = (cx: number, top: number) => node("process", "…", cx, top);

// The live diagram labels branches in PSeInt's own words in every locale.
const labels = { yes: TRUE_LABEL, no: FALSE_LABEL, otherwise: DEFAULT_CASE_LABEL };

/** Standalone SVG markup for an entry's scene. */
export function shapeSceneSvg(spec: ShapeSpec): string {
  const parts: string[] = [];
  let width = 0;
  let height = 0;
  // Centre the main block, leaving room for exits and loop edges on both sides.
  const cx = Math.max(130, node(spec.kind, spec.label, 0, 0).width / 2 + 60);

  switch (spec.scene) {
    case "single": {
      const top = 22;
      const n = node(spec.kind, spec.label, cx, top);
      parts.push(line(`M ${cx},0 L ${cx},${top - 2}`), n.markup, line(`M ${cx},${top + n.height} L ${cx},${top + n.height + 22}`, EDGE, false, true));
      width = cx * 2;
      height = top + n.height + 24;
      break;
    }
    case "branches": {
      const top = 18;
      const n = node(spec.kind, spec.label, cx, top);
      const bottom = top + n.height;
      const right = cx + n.width / 2;
      parts.push(
        line(`M ${cx},0 L ${cx},${top - 2}`),
        n.markup,
        line(`M ${cx},${bottom} L ${cx},${bottom + 34}`, BRANCH),
        edgeLabel(labels.yes, cx, bottom + 15),
        line(`M ${right},${top + n.height / 2} L ${right + 34},${top + n.height / 2} L ${right + 34},${bottom + 34}`, BRANCH),
        edgeLabel(labels.no, right + 34, top + n.height / 2),
      );
      width = Math.max(cx * 2, right + 50);
      height = bottom + 36;
      break;
    }
    case "while": {
      const top = 18;
      const n = node(spec.kind, spec.label, cx, top);
      const bottom = top + n.height;
      const b = body(cx, bottom + 30);
      const bodyBottom = bottom + 30 + b.height;
      const left = cx - n.width / 2 - 26;
      const right = cx + n.width / 2;
      parts.push(
        line(`M ${cx},0 L ${cx},${top - 2}`),
        n.markup,
        line(`M ${cx},${bottom} L ${cx},${bottom + 28}`, BRANCH),
        edgeLabel(labels.yes, cx, bottom + 13),
        b.markup,
        line(`M ${cx},${bodyBottom} L ${cx},${bodyBottom + 14} L ${left},${bodyBottom + 14} L ${left},${top - 8} L ${cx - 4},${top - 8}`, LOOP, true),
        line(`M ${right},${top + n.height / 2} L ${right + 30},${top + n.height / 2} L ${right + 30},${bodyBottom + 30}`, BRANCH),
        edgeLabel(labels.no, right + 30, top + n.height / 2),
      );
      width = Math.max(cx * 2, right + 46);
      height = bodyBottom + 32;
      break;
    }
    case "repeat": {
      const b = body(cx, 22);
      const top = 22 + b.height + 26;
      const n = node(spec.kind, spec.label, cx, top);
      const bottom = top + n.height;
      const left = cx - n.width / 2;
      parts.push(
        line(`M ${cx},0 L ${cx},20`),
        b.markup,
        line(`M ${cx},${22 + b.height} L ${cx},${top - 2}`),
        n.markup,
        line(`M ${left},${top + n.height / 2} L ${left - 26},${top + n.height / 2} L ${left - 26},11 L ${cx - 4},11`, LOOP, true),
        edgeLabel(spec.exitsOn === "no" ? labels.yes : labels.no, left - 26, top + n.height / 2),
        line(`M ${cx},${bottom} L ${cx},${bottom + 30}`, BRANCH),
        edgeLabel(spec.exitsOn === "no" ? labels.no : labels.yes, cx, bottom + 14),
      );
      width = cx * 2;
      height = bottom + 32;
      break;
    }
    case "for": {
      const top = 18;
      const n = node(spec.kind, spec.label, cx, top);
      const bottom = top + n.height;
      const b = body(cx, bottom + 24);
      const bodyBottom = bottom + 24 + b.height;
      const left = cx - n.width / 2 - 22;
      const right = cx + n.width / 2;
      parts.push(
        line(`M ${cx},0 L ${cx},${top - 2}`),
        n.markup,
        line(`M ${cx},${bottom} L ${cx},${bottom + 22}`),
        b.markup,
        line(`M ${cx},${bodyBottom} L ${cx},${bodyBottom + 14} L ${left},${bodyBottom + 14} L ${left},${top + n.height / 2} L ${cx - n.width / 2 - 2},${top + n.height / 2}`, LOOP, true),
        line(`M ${right},${top + n.height / 2} L ${right + 26},${top + n.height / 2} L ${right + 26},${bodyBottom + 30}`, BRANCH),
      );
      width = Math.max(cx * 2, right + 40);
      height = bodyBottom + 32;
      break;
    }
    case "cases": {
      const top = 18;
      const n = node(spec.kind, spec.label, cx, top);
      const bottom = top + n.height;
      const spread = 70;
      parts.push(line(`M ${cx},0 L ${cx},${top - 2}`), n.markup);
      [-spread, 0, spread].forEach((dx, index) => {
        const x = cx + dx;
        parts.push(line(`M ${cx},${bottom} L ${cx},${bottom + 12} L ${x},${bottom + 12} L ${x},${bottom + 40}`, BRANCH));
        parts.push(index === 2 ? `<text x="${x}" y="${bottom + 26}" dx="6" dominant-baseline="central" font-size="10.5" font-weight="600" fill="#C3CCC8" font-family="-apple-system, system-ui, sans-serif">${esc(labels.otherwise)}</text>` : edgeLabel(String(index + 1), x, bottom + 26));
      });
      width = Math.max(cx * 2, cx + spread + 12 + [...labels.otherwise].length * 6.8);
      height = bottom + 42;
      break;
    }
  }

  const markers = [EDGE, BRANCH, LOOP]
    .map((c) => `<marker id="a-${c.slice(1)}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(width)}" height="${Math.ceil(height)}" viewBox="0 0 ${Math.ceil(width)} ${Math.ceil(height)}" font-family='${EXPORT_LABEL_FONT_FAMILY}'><defs>${markers}</defs>${parts.join("")}</svg>`;
}

export function svgDataUri(svg: string): string {
  let binary = "";
  for (const byte of new TextEncoder().encode(svg)) binary += String.fromCharCode(byte);
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}
