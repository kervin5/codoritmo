import { fireEvent, render, screen } from "@testing-library/react";

import { DiagramExportMenu } from "../components/workspace/diagram-export-menu";
import { esDictionary } from "../i18n/es";

const labels = esDictionary.studio.diagramExport;

describe("diagram quick export", () => {
  it("offers copy, PNG and SVG, and closes after choosing", () => {
    const onCopy = jest.fn();
    const onDownload = jest.fn();
    render(<DiagramExportMenu labels={labels} onCopy={onCopy} onDownload={onDownload} />);

    fireEvent.click(screen.getByRole("button", { name: labels.button }));
    expect(screen.getAllByRole("menuitem")).toHaveLength(3);

    fireEvent.click(screen.getByRole("menuitem", { name: new RegExp(labels.svg) }));
    expect(onDownload).toHaveBeenCalledWith("svg");

    fireEvent.click(screen.getByRole("button", { name: labels.button }));
    fireEvent.click(screen.getByRole("menuitem", { name: new RegExp(labels.copy) }));
    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", async () => {
    render(<DiagramExportMenu labels={labels} onCopy={jest.fn()} onDownload={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: labels.button }));
    fireEvent.keyDown(window, { key: "Escape" });
    await screen.findByRole("button", { name: labels.button });
    expect(screen.getByRole("button", { name: labels.button })).toHaveAttribute("aria-expanded", "false");
  });
});
