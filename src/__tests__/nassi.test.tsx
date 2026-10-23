import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import NassiDiagram, { DiagramKindToggle } from "@/src/components/workspace/nassi-diagram";
import { defaultPrefs } from "@/src/components/workspace/documents";
import { normalizeEngineSettings } from "@/src/engine";
import { esDictionary } from "@/src/i18n/es";

const SOURCE = `Algoritmo Vista
  Leer x
  Si x > 0 Entonces
    Escribir "pos"
  FinSi
FinAlgoritmo`;

const settings = normalizeEngineSettings({});

describe("NassiDiagram view", () => {
  test("draws one box per statement and jumps to a box's line on click", () => {
    const onPickLine = jest.fn();
    render(
      <NassiDiagram activeLine={null} onPickLine={onPickLine} routineName={null} settings={settings} source={SOURCE} visitedLines={new Set()} />,
    );
    const svg = screen.getByRole("img", { name: "Algoritmo Vista" });
    expect(svg.textContent).toContain("Leer");
    expect(svg.textContent).toContain("Sí");
    const leer = [...svg.querySelectorAll("text")].find((t) => t.textContent === "Leer x")!;
    fireEvent.click(leer.closest("g")!);
    expect(onPickLine).toHaveBeenCalledWith(2);
  });

  test("outlines the running box in mint", () => {
    const { container } = render(
      <NassiDiagram activeLine={3} routineName={null} settings={settings} source={SOURCE} visitedLines={new Set([2, 3])} />,
    );
    const mint = [...container.querySelectorAll("path")].filter((p) => p.getAttribute("stroke") === "#86F0C4");
    expect(mint.length).toBeGreaterThan(0);
  });
});

describe("DiagramKindToggle", () => {
  const labels = esDictionary.studio.diagramKind;

  test("switches diagram type and shows the alternative-shapes option only for the flowchart", () => {
    const onChange = jest.fn();
    const onAlt = jest.fn();
    const { rerender } = render(<DiagramKindToggle altShapes={false} labels={labels} onAltShapesChange={onAlt} onChange={onChange} value="flowchart" />);
    expect(screen.getByRole("radio", { name: "Diagrama de flujo" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: "Nassi-Shneiderman" }));
    expect(onChange).toHaveBeenCalledWith("nassi");
    fireEvent.click(screen.getByRole("button", { name: labels.altShapesHint }));
    expect(onAlt).toHaveBeenCalledWith(true);
    rerender(<DiagramKindToggle altShapes={false} labels={labels} onAltShapesChange={onAlt} onChange={onChange} value="nassi" />);
    expect(screen.queryByRole("button", { name: labels.altShapesHint })).toBeNull();
  });

  test("the workspace remembers the flowchart with classic shapes by default", () => {
    expect(defaultPrefs.diagramKind).toBe("flowchart");
    expect(defaultPrefs.ioShapes).toBe("classic");
  });
});
