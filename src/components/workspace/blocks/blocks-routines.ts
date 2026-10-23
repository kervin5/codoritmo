// SubProcesos and Funciones as Scratch "My Blocks": a definition block per
// routine, and call blocks (a statement, and a reporter for use in
// expressions) with one socket per parameter. Calls follow their definition:
// renaming it or changing its parameters updates every call, the way
// Blockly's own procedure blocks keep their callers in sync.

import * as Blockly from "blockly/core";

import { COLORS, identifier, mutate, plusMinus } from "./blocks-defs";

export type RoutineKind = "SubProceso" | "SubAlgoritmo" | "Funcion";
export type ParamMode = "" | "REF" | "VAL";

const CLOSERS: Record<RoutineKind, string> = {
  SubProceso: "FinSubProceso",
  SubAlgoritmo: "FinSubAlgoritmo",
  Funcion: "FinFuncion",
};

export interface RoutineBlock extends Blockly.Block {
  params: number;
  /** Written with () even without parameters. */
  parens: boolean;
  /** Has a result variable: `Funcion r <- Nombre(...)`. */
  result: boolean;
  rebuild(): void;
}

export interface CallBlock extends Blockly.Block {
  routine: string;
  args: string[];
  parens: boolean;
  updateShape(): void;
}

export const sameName = (a: string, b: string) =>
  a.localeCompare(b, "es", { sensitivity: "base" }) === 0;

const isCall = (block: Blockly.Block): block is CallBlock =>
  block.type === "ps_llamada" || block.type === "ps_llamada_valor";

/** Parameter names of a definition. */
export function paramNames(def: Blockly.Block): string[] {
  const names: string[] = [];
  for (let i = 0; i < (def as RoutineBlock).params; i++) names.push(String(def.getFieldValue(`PARAM${i}`) ?? ""));
  return names;
}

export function routineDefinitions(workspace: Blockly.Workspace): RoutineBlock[] {
  return workspace.getBlocksByType("ps_subproceso", false) as RoutineBlock[];
}

function callersOf(workspace: Blockly.Workspace, name: string): CallBlock[] {
  return workspace.getAllBlocks(false).filter((block): block is CallBlock => isCall(block) && sameName(block.routine, name));
}

/** Brings every call of `def` (found by `name`) in line with it: its name and parameters. */
function syncCallers(def: RoutineBlock, name: string = def.getFieldValue("NAME")): void {
  const workspace = def.workspace;
  if (!workspace || def.isInFlyout || !name) return;
  const routine = String(def.getFieldValue("NAME") ?? name);
  const args = paramNames(def);
  for (const call of callersOf(workspace, name)) {
    if (call.routine === routine && call.args.length === args.length && call.args.every((a, i) => a === args[i])) continue;
    mutate(call, () => {
      call.routine = routine;
      call.args = args;
      if (args.length) call.parens = true;
      call.updateShape();
    });
  }
}

/** A routine name no other definition uses (case-insensitive), like Blockly's findLegalName. */
function legalName(name: string, def: Blockly.Block): string {
  const taken = (candidate: string) =>
    routineDefinitions(def.workspace).some((other) => other !== def && sameName(other.getFieldValue("NAME") ?? "", candidate));
  if (!taken(name)) return name;
  const base = name.replace(/\d+$/, "");
  let n = 2;
  while (taken(`${base}${n}`)) n++;
  return `${base}${n}`;
}

/* ------------------------------------------------------------------ */
/* Definition                                                          */
/* ------------------------------------------------------------------ */

const PARAM_MODES: [string, ParamMode][] = [
  ["", ""],
  ["Por Referencia", "REF"],
  ["Por Valor", "VAL"],
];

const ROUTINE = {
  init(this: RoutineBlock) {
    this.params = 0;
    this.parens = true;
    this.result = false;
    this.appendStatementInput("BODY");
    this.appendDummyInput("END").appendField(new Blockly.FieldLabel(CLOSERS.SubProceso), "CLOSER");
    this.setColour(COLORS.routines);
    this.setTooltip(
      "Un SubProceso (o Funcion): instrucciones con nombre que puedes usar desde el algoritmo. + agrega un parámetro."
    );
    this.rebuild();
  },
  saveExtraState(this: RoutineBlock) {
    return {
      params: this.params,
      ...(this.parens ? {} : { parens: false }),
      ...(this.result ? { result: true } : {}),
    };
  },
  loadExtraState(this: RoutineBlock, state: { params?: number; parens?: boolean; result?: boolean }) {
    this.params = Math.max(0, state.params ?? 0);
    this.parens = state.parens !== false;
    this.result = !!state.result;
    this.rebuild();
  },
  /** Rebuilds the header row (kind, result, name, parameters), keeping what is already typed. */
  rebuild(this: RoutineBlock) {
    const old = this.getInput("HEADER");
    const value = (name: string, fallback: string) => {
      const field = this.getField(name);
      return field ? String(field.getValue() ?? fallback) : fallback;
    };
    const kind = value("KIND", "SubProceso") as RoutineKind;
    const name = value("NAME", "");
    const result = value("RESULT", "resultado");
    const params = Array.from({ length: this.params }, (_, i) => ({
      name: value(`PARAM${i}`, i === 0 ? "x" : `p${i + 1}`),
      mode: value(`MODE${i}`, "") as ParamMode,
    }));
    if (old) this.removeInput("HEADER");

    const header = this.appendDummyInput("HEADER");
    // Values are set before a field joins the block, so rebuilding fires no change events.
    const dropdown = (options: [string, string][], selected: string, validator?: Blockly.FieldDropdownValidator) => {
      const field = new Blockly.FieldDropdown(options, validator);
      field.setValue(selected);
      return field;
    };
    header.appendField(
      dropdown(
        [
          ["SubProceso", "SubProceso"],
          ["Funcion", "Funcion"],
          ["SubAlgoritmo", "SubAlgoritmo"],
        ],
        kind,
        (kind) => {
          this.getField("CLOSER")?.setValue(CLOSERS[kind as RoutineKind] ?? CLOSERS.SubProceso);
          return kind;
        }
      ),
      "KIND"
    );
    this.getField("CLOSER")?.setValue(CLOSERS[kind] ?? CLOSERS.SubProceso);
    if (this.result) {
      header.appendField(new Blockly.FieldTextInput(result, (text) => identifier(text)), "RESULT").appendField("<-");
    }
    header.appendField(new Blockly.FieldTextInput(name, renameRoutine), "NAME");
    if (this.params || this.parens) header.appendField("(");
    params.forEach((param, i) => {
      if (i > 0) header.appendField(",");
      header.appendField(new Blockly.FieldTextInput(param.name, renameParam), `PARAM${i}`);
      header.appendField(dropdown(PARAM_MODES, param.mode), `MODE${i}`);
    });
    if (this.params || this.parens) header.appendField(")");
    plusMinus(
      header,
      (block) => {
        const def = block as RoutineBlock;
        def.params++;
        def.parens = true;
        def.rebuild();
        syncCallers(def);
      },
      this.params
        ? (block) => {
            const def = block as RoutineBlock;
            def.params--;
            def.rebuild();
            syncCallers(def);
          }
        : null,
      { plus: "Agregar un parámetro", minus: "Quitar el último parámetro" }
    );
    this.moveInputBefore("HEADER", "BODY");
  },
  customContextMenu(this: RoutineBlock, items: (Blockly.ContextMenuRegistry.ContextMenuOption | Blockly.ContextMenuRegistry.LegacyContextMenuOption)[]) {
    if (this.isInFlyout) return;
    items.push({
      text: this.result ? "No devuelve un valor" : "Devuelve un valor (resultado <- …)",
      enabled: this.isEditable(),
      callback: () =>
        mutate(this, () => {
          this.result = !this.result;
          this.rebuild();
        }),
    } satisfies Blockly.ContextMenuRegistry.LegacyContextMenuOption);
  },
};

/** Validator of a definition's name: a legal, unused name, and every call follows it. */
function renameRoutine(this: Blockly.FieldTextInput, text: string): string | null {
  const def = this.getSourceBlock() as RoutineBlock | null;
  const name = identifier(text);
  if (!name) return null;
  if (!def || def.isInFlyout || !def.workspace) return name;
  const legal = legalName(name, def);
  const old = String(this.getValue() ?? "");
  // An empty old name is a definition still being built (loading, or its header being rebuilt).
  if (old && old !== legal) {
    for (const call of callersOf(def.workspace, old)) {
      mutate(call, () => {
        call.routine = legal;
        call.updateShape();
      });
    }
  }
  return legal;
}

/** Validator of a parameter name (calls read the names from their definition). */
function renameParam(this: Blockly.FieldTextInput, text: string): string | null {
  return identifier(text);
}

/* ------------------------------------------------------------------ */
/* Calls                                                               */
/* ------------------------------------------------------------------ */

function callBlock(output: boolean) {
  return {
    init(this: CallBlock) {
      this.routine = "";
      this.args = [];
      this.parens = true;
      this.appendDummyInput("HEAD").appendField(new Blockly.FieldLabel(""), "LABEL");
      if (output) this.setOutput(true);
      else {
        this.setPreviousStatement(true);
        this.setNextStatement(true);
      }
      this.setInputsInline(true);
      this.setColour(COLORS.routines);
      this.setTooltip(() => {
        const def = this.workspace && routineDefinitions(this.workspace).find((d) => sameName(d.getFieldValue("NAME") ?? "", this.routine));
        const signature = `${this.routine}(${(def ? paramNames(def) : this.args).join(", ")})`;
        return output ? `Usa el valor que devuelve ${signature}.` : `Ejecuta ${signature}.`;
      });
      this.updateShape();
    },
    saveExtraState(this: CallBlock) {
      return { name: this.routine, args: this.args, ...(this.parens ? {} : { parens: false }) };
    },
    loadExtraState(this: CallBlock, state: { name?: string; args?: string[]; parens?: boolean }) {
      this.routine = state.name ?? "";
      this.args = state.args ?? [];
      this.parens = state.parens !== false || this.args.length > 0;
      this.updateShape();
    },
    /** One socket per parameter; sockets that stay keep their blocks. */
    updateShape(this: CallBlock) {
      this.getField("LABEL")!.setValue(this.parens ? `${this.routine} (` : this.routine);
      let existing = 0;
      while (this.getInput(`ARG${existing}`)) existing++;
      for (let i = existing - 1; i >= this.args.length; i--) this.removeInput(`ARG${i}`);
      for (let i = existing; i < this.args.length; i++) {
        const input = this.appendValueInput(`ARG${i}`);
        if (i > 0) input.appendField(",");
      }
      // An empty socket shows its parameter's name (a shadow: drop a block on it, or type over it).
      this.args.forEach((arg, i) => {
        const connection = this.getInput(`ARG${i}`)!.connection!;
        const shadow = connection.getShadowState();
        if (!shadow || (shadow.fields as Record<string, string> | undefined)?.NAME !== arg) {
          connection.setShadowState({ type: "ps_variable", fields: { NAME: arg || "x" } });
        }
      });
      if (this.getInput("TAIL")) this.removeInput("TAIL");
      if (this.parens) this.appendDummyInput("TAIL").appendField(")");
    },
  };
}

/* ------------------------------------------------------------------ */
/* Registration and palette                                            */
/* ------------------------------------------------------------------ */

export function defineRoutineBlocks(): void {
  Blockly.Blocks["ps_subproceso"] = ROUTINE;
  Blockly.Blocks["ps_llamada"] = callBlock(false);
  Blockly.Blocks["ps_llamada_valor"] = callBlock(true);
  Blockly.common.defineBlocksWithJsonArray([
    {
      type: "ps_retornar",
      message0: "Retornar %1",
      args0: [{ type: "input_value", name: "VALUE" }],
      previousStatement: null,
      nextStatement: null,
      colour: COLORS.routines,
      tooltip: "Termina la Funcion devolviendo un valor.",
    },
  ]);
}

/** The "Mis subprocesos" palette: new definitions, Retornar, and a call for each routine there is. */
export function routinesFlyout(workspace: Blockly.WorkspaceSvg): Blockly.utils.toolbox.FlyoutItemInfoArray {
  const items: Blockly.utils.toolbox.FlyoutItemInfoArray = [
    {
      kind: "block",
      type: "ps_subproceso",
      extraState: { params: 0 },
      fields: { KIND: "SubProceso", NAME: "MiSubProceso" },
    },
    {
      kind: "block",
      type: "ps_subproceso",
      extraState: { params: 1, result: true },
      fields: { KIND: "Funcion", RESULT: "resultado", NAME: "MiFuncion", PARAM0: "x", MODE0: "" },
    },
    { kind: "block", type: "ps_retornar" },
  ];
  const defs = routineDefinitions(workspace)
    .filter((def) => def.getFieldValue("NAME"))
    .sort((a, b) => String(a.getFieldValue("NAME")).localeCompare(String(b.getFieldValue("NAME")), "es"));
  if (defs.length) items.push({ kind: "sep", gap: "24" });
  for (const def of defs) {
    const state = { name: def.getFieldValue("NAME"), args: paramNames(def), ...(def.parens ? {} : { parens: false }) };
    items.push({ kind: "block", type: "ps_llamada", extraState: state });
    if (def.result) items.push({ kind: "block", type: "ps_llamada_valor", extraState: state });
  }
  return items;
}
