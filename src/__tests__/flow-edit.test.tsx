import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { FlowEditConfirmDelete, FlowEditEditor } from "@/src/components/workspace/flow-edit-editor";
import { FlowEditPalette } from "@/src/components/workspace/flow-edit-palette";
import { enDictionary } from "@/src/i18n/en";
import { esDictionary } from "@/src/i18n/es";

const copy = esDictionary.flowEdit;

describe("FlowEditEditor", () => {
  const fields = [
    { key: "variable" as const, value: "i" },
    { key: "start" as const, value: "1" },
    { key: "end" as const, value: "10" },
    { key: "step" as const, value: "", optional: true },
  ];

  it("labels each piece and commits the values with Enter", () => {
    const onCommit = jest.fn();
    render(<FlowEditEditor copy={copy} error={null} fields={fields} onCancel={jest.fn()} onCommit={onCommit} />);
    const end = screen.getByLabelText("Hasta");
    fireEvent.change(end, { target: { value: "n" } });
    fireEvent.keyDown(end, { key: "Enter" });
    expect(onCommit).toHaveBeenCalledWith({ variable: "i", start: "1", end: "n", step: "" });
    expect(screen.getByText(/opcional/)).toBeTruthy();
  });

  it("cancels with Escape and shows a refused edit under its field", () => {
    const onCancel = jest.fn();
    render(
      <FlowEditEditor copy={copy} error="Así no funcionaría" errorField="end" fields={fields} onCancel={onCancel} onCommit={jest.fn()} />
    );
    expect(screen.getByRole("alert").textContent).toBe("Así no funcionaría");
    expect(screen.getByLabelText("Hasta").getAttribute("aria-invalid")).toBe("true");
    fireEvent.keyDown(screen.getByLabelText("Desde"), { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });
});

describe("FlowEditPalette", () => {
  it("lists every statement and picks one", () => {
    const onPick = jest.fn();
    render(<FlowEditPalette copy={enDictionary.flowEdit} onClose={jest.fn()} onPick={onPick} />);
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Write", "Read", "Assign", "If", "If / else", "Switch", "While", "Repeat", "For", "Define", "Subprocess",
    ]);
    fireEvent.click(screen.getByRole("menuitem", { name: "While" }));
    expect(onPick).toHaveBeenCalledWith("while");
  });

  it("closes with Escape", () => {
    const onClose = jest.fn();
    render(<FlowEditPalette copy={copy} onClose={onClose} onPick={jest.fn()} />);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});

describe("FlowEditConfirmDelete", () => {
  it("offers deleting everything or keeping what is inside", () => {
    const onDelete = jest.fn();
    render(<FlowEditConfirmDelete copy={copy} nested={3} onCancel={jest.fn()} onDelete={onDelete} />);
    expect(screen.getByText("Tiene 3 bloques dentro.")).toBeTruthy();
    fireEvent.click(screen.getByText("Conservar lo de dentro"));
    expect(onDelete).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByText("Borrar todo"));
    expect(onDelete).toHaveBeenLastCalledWith(false);
  });
});
