import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { engineProfiles } from "@/src/engine";
import { enDictionary } from "@/src/i18n/en";

import Playground from "../components/ide/playground";
import { STORAGE_KEY } from "../components/ide/workspace-state";

jest.mock("next/navigation", () => ({
  usePathname: () => "/es",
}));

function examplesLibraryDesktop() {
  return within(screen.getByTestId("examples-drawer-desktop"));
}

function renderPlayground() {
  return render(<Playground dictionary={enDictionary} />);
}

function offsetToPosition(value: string, offset: number) {
  const lines = value.slice(0, offset).split("\n");
  return {
    lineNumber: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

function positionToOffset(
  value: string,
  position: { column: number; lineNumber: number }
) {
  const lines = value.split("\n");
  let offset = 0;

  for (let index = 0; index < position.lineNumber - 1; index += 1) {
    offset += lines[index]?.length ?? 0;
    offset += 1;
  }

  return offset + position.column - 1;
}

class MockSelection {
  column: number;
  endColumn: number;
  endLineNumber: number;
  lineNumber: number;
  startColumn: number;
  startLineNumber: number;

  constructor(
    startLineNumber: number,
    startColumn: number,
    endLineNumber: number,
    endColumn: number
  ) {
    this.lineNumber = startLineNumber;
    this.column = startColumn;
    this.startLineNumber = startLineNumber;
    this.startColumn = startColumn;
    this.endLineNumber = endLineNumber;
    this.endColumn = endColumn;
  }
}

jest.mock("@monaco-editor/react", () => {
  const MockEditor = ({
    beforeMount,
    onChange,
    onMount,
    value,
  }: {
    beforeMount?: (monaco: unknown) => void;
    onChange?: (value: string) => void;
    onMount?: (editor: unknown, monaco: unknown) => void;
    value?: string;
  }) => {
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

    React.useEffect(() => {
      const getValue = () => textareaRef.current?.value ?? value ?? "";

      const monaco = {
        MarkerSeverity: {
          Warning: 4,
          Error: 8,
        },
        Selection: MockSelection,
        languages: {
          register: () => {},
          setMonarchTokensProvider: () => {},
        },
        editor: {
          defineTheme: () => {},
          setModelMarkers: () => {},
        },
      };

      beforeMount?.(monaco);

      const getSelection = () => {
        const node = textareaRef.current;
        const start = node?.selectionStart ?? 0;
        const end = node?.selectionEnd ?? 0;
        const currentValue = getValue();
        const startPosition = offsetToPosition(currentValue, start);
        const endPosition = offsetToPosition(currentValue, end);

        return {
          startLineNumber: startPosition.lineNumber,
          startColumn: startPosition.column,
          endLineNumber: endPosition.lineNumber,
          endColumn: endPosition.column,
          getStartPosition: () => startPosition,
          getEndPosition: () => endPosition,
        };
      };

      const model = {
        getOffsetAt(position: { column: number; lineNumber: number }) {
          return positionToOffset(getValue(), position);
        },
        getPositionAt(offset: number) {
          return offsetToPosition(getValue(), offset);
        },
        getValueInRange(range: {
          endColumn: number;
          endLineNumber: number;
          startColumn: number;
          startLineNumber: number;
        }) {
          const currentValue = getValue();
          const start = positionToOffset(currentValue, {
            lineNumber: range.startLineNumber,
            column: range.startColumn,
          });
          const end = positionToOffset(currentValue, {
            lineNumber: range.endLineNumber,
            column: range.endColumn,
          });
          return currentValue.slice(start, end);
        },
      };

      const editor = {
        executeEdits: (
          _source: string,
          edits: Array<{ range: ReturnType<typeof getSelection>; text: string }>
        ) => {
          const edit = edits[0];
          const currentValue = getValue();
          const startOffset = positionToOffset(currentValue, {
            lineNumber: edit.range.startLineNumber,
            column: edit.range.startColumn,
          });
          const endOffset = positionToOffset(currentValue, {
            lineNumber: edit.range.endLineNumber,
            column: edit.range.endColumn,
          });
          const nextValue = `${currentValue.slice(0, startOffset)}${
            edit.text
          }${currentValue.slice(endOffset)}`;
          onChange?.(nextValue);
        },
        focus: () => textareaRef.current?.focus(),
        getModel: () => model,
        getSelection,
        revealLineInCenter: () => {},
        setSelection: (selection: {
          endColumn: number;
          endLineNumber: number;
          startColumn: number;
          startLineNumber: number;
        }) => {
          const node = textareaRef.current;
          if (!node) {
            return;
          }

          const currentValue = getValue();
          const start = positionToOffset(currentValue, {
            lineNumber: selection.startLineNumber,
            column: selection.startColumn,
          });
          const end = positionToOffset(currentValue, {
            lineNumber: selection.endLineNumber,
            column: selection.endColumn,
          });
          node.selectionStart = start;
          node.selectionEnd = end;
        },
      };

      onMount?.(editor, monaco);
    }, [beforeMount, onChange, onMount, value]);

    return (
      <textarea
        aria-label="Codoritmo editor"
        data-testid="mock-monaco-editor"
        onChange={(event) => onChange?.(event.target.value)}
        ref={textareaRef}
        value={value ?? ""}
      />
    );
  };

  return {
    __esModule: true,
    default: MockEditor,
  };
});

describe("Playground", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("opens examples in new tabs without overwriting existing work", async () => {
    const user = userEvent.setup();
    renderPlayground();

    fireEvent.change(screen.getByLabelText("Codoritmo editor"), {
      target: {
        value: `Proceso Actual
  Escribir "A"
FinProceso`,
      },
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Actual/i })
      ).toBeInTheDocument();
    });

    await user.click(screen.getAllByRole("button", { name: "Examples" })[0]);
    await user.click(examplesLibraryDesktop().getByRole("button", { name: /^Bucles/ }));
    await user.click(
      examplesLibraryDesktop().getByRole("button", { name: /Open in New Tab: Bucles/i })
    );

    await waitFor(() => {
      expect(
        screen.getAllByRole("button", { name: /Bucles/i }).length
      ).toBeGreaterThan(0);
      expect(screen.getByTestId("mock-monaco-editor"))
        .toHaveValue(`Proceso Bucles
  Para i <- 1 Hasta 3 Hacer
    Escribir "Paso ", i
  FinPara

  Repetir
    Escribir "Sin bajar", " ", i Sin Bajar
    i <- i - 1
  Mientras Que i > 0
FinProceso`);
    });

    await user.click(screen.getByRole("button", { name: /Actual/i }));

    await waitFor(() => {
      expect(screen.getByTestId("mock-monaco-editor"))
        .toHaveValue(`Proceso Actual
  Escribir "A"
FinProceso`);
    });
  });

  it("autosaves sessions to localStorage and restores them on reload", async () => {
    const user = userEvent.setup();
    const { unmount } = renderPlayground();

    fireEvent.change(screen.getByLabelText("Codoritmo editor"), {
      target: {
        value: `Proceso Persistido
  Escribir "Guardado"
FinProceso`,
      },
    });

    await user.click(screen.getByRole("button", { name: "New" }));

    await waitFor(() => {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      expect(saved).not.toBeNull();
      expect(JSON.parse(saved ?? "{}").sessions).toHaveLength(2);
    });

    unmount();
    renderPlayground();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Persistido/i })
      ).toBeInTheDocument();
    });
  });

  it("can collapse and expand the navigation rail", async () => {
    const user = userEvent.setup();
    renderPlayground();

    expect(screen.getByTestId("app-rail")).toHaveStyle({ width: "224px" });

    await user.click(
      screen.getByRole("button", { name: "Collapse navigation" })
    );
    expect(
      screen.getByRole("button", { name: "Expand navigation" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("app-rail")).toHaveStyle({ width: "76px" });

    await user.click(screen.getByRole("button", { name: "Expand navigation" }));
    expect(
      screen.getByRole("button", { name: "Collapse navigation" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("app-rail")).toHaveStyle({ width: "224px" });
  });

  it("allows renaming tabs without losing the custom title on source changes or restore", async () => {
    const user = userEvent.setup();
    const { unmount } = renderPlayground();

    await user.click(screen.getByRole("button", { name: "Rename tab" }));
    await user.clear(screen.getByLabelText("Rename tab"));
    await user.type(screen.getByLabelText("Rename tab"), "Exercise 1{enter}");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Exercise 1/i })
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Codoritmo editor"), {
      target: {
        value: `Proceso Renombrado
  Escribir "Hola"
FinProceso`,
      },
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Exercise 1/i })
      ).toBeInTheDocument();
    });

    await waitFor(() => {
      const saved = JSON.parse(
        window.localStorage.getItem(STORAGE_KEY) ?? "{}"
      );
      expect(saved.sessions[0].title).toBe("Exercise 1");
      expect(saved.sessions[0].isTitleCustom).toBe(true);
    });

    unmount();
    renderPlayground();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Exercise 1/i })
      ).toBeInTheDocument();
    });
  });

  it("restores a saved active session from localStorage on mount", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 2,
        activeSessionId: "saved-session",
        shellPanel: "none",
        untitledCounter: 3,
        sessions: [
          {
            id: "saved-session",
            source: `Proceso Recuperado
  Escribir "Desde storage"
FinProceso`,
            inputText: "",
            profileId: engineProfiles[0].id,
            settings: engineProfiles[0].settings,
            exampleId: null,
            workspaceTab: "source",
            bottomTab: "output",
            generationTarget: "browser",
            untitledNumber: null,
            updatedAt: Date.now(),
          },
        ],
      })
    );

    renderPlayground();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Recuperado/i })
      ).toBeInTheDocument();
      expect(screen.getByTestId("mock-monaco-editor"))
        .toHaveValue(`Proceso Recuperado
  Escribir "Desde storage"
FinProceso`);
    });
  });

  it("auto-generates JavaScript in the export tab for the active session", async () => {
    const user = userEvent.setup();
    renderPlayground();

    await user.click(screen.getAllByRole("button", { name: "Examples" })[0]);
    await user.click(examplesLibraryDesktop().getByRole("button", { name: /^Hola Mundo/ }));
    await user.click(
      examplesLibraryDesktop().getByRole("button", { name: /Open in New Tab: Hola Mundo/i })
    );
    await user.click(screen.getByRole("button", { name: "Export" }));

    await waitFor(() => {
      expect(screen.getByTestId("generated-code")).toHaveTextContent(
        "function createBrowserRuntime()"
      );
      expect(screen.getByTestId("generated-code")).toHaveTextContent(
        "async function holaMundo()"
      );
    });

    expect(screen.getByLabelText("Export Language")).toBeInTheDocument();
    expect(screen.getByLabelText("Export Target")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Export Target"), "node");

    await waitFor(() => {
      expect(screen.getByTestId("generated-code")).toHaveTextContent(
        "const readline = require('node:readline/promises');"
      );
    });

    expect(screen.getByLabelText("Export Language")).toBeInTheDocument();
    expect(screen.getByLabelText("Export Target")).toBeInTheDocument();
  });

  it("renders the diagram tab and switches routines for programs with subroutines", async () => {
    const user = userEvent.setup();
    renderPlayground();

    await user.click(screen.getAllByRole("button", { name: "Examples" })[0]);
    await user.click(examplesLibraryDesktop().getByRole("button", { name: /^Por Referencia/ }));
    await user.click(
      examplesLibraryDesktop().getByRole("button", { name: /Open in New Tab: Por Referencia/i })
    );
    await user.click(screen.getByRole("button", { name: "Diagram" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Diagram Routine")).toBeInTheDocument();
      expect(
        screen.getAllByRole("option", { name: "Proceso Referencias" })[0]
      ).toBeInTheDocument();
    });

    await user.selectOptions(
      screen.getByLabelText("Diagram Routine"),
      screen.getAllByRole("option", { name: /SubProceso AsignaPrimerValor/i })[0]
    );

    await waitFor(() => {
      expect(
        screen.getAllByRole("option", { name: "SubProceso AsignaPrimerValor" })[0]
          .selected
      ).toBe(true);
      expect(screen.getByText("v[1] <- 5")).toBeInTheDocument();
    });
  });

  it("can maximize the diagram view and restore the sidebar and bottom dock", async () => {
    const user = userEvent.setup();
    renderPlayground();

    await user.click(screen.getAllByRole("button", { name: "Examples" })[0]);
    await user.click(examplesLibraryDesktop().getByRole("button", { name: /^Por Referencia/ }));
    await user.click(
      examplesLibraryDesktop().getByRole("button", { name: /Open in New Tab: Por Referencia/i })
    );
    await user.click(screen.getByRole("button", { name: "Diagram" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Diagram Routine")).toBeInTheDocument();
      expect(screen.getByText("Insert code")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Collapse output" })
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Maximize Diagram" }));

    await waitFor(() => {
      expect(screen.queryByText("Insert code")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Collapse output" })
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Restore Diagram" })
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Restore Diagram" }));

    await waitFor(() => {
      expect(screen.getByText("Insert code")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Collapse output" })
      ).toBeInTheDocument();
    });
  });

  it("shows a diagram empty state for parse errors and can jump back to source from a node click", async () => {
    const user = userEvent.setup();
    renderPlayground();

    fireEvent.change(screen.getByLabelText("Codoritmo editor"), {
      target: {
        value: `Proceso Roto
  Escribir "Hola"`,
      },
    });

    await user.click(screen.getByRole("button", { name: "Diagram" }));

    await waitFor(() => {
      expect(screen.getByText("Diagram unavailable")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Source" }));

    fireEvent.change(screen.getByLabelText("Codoritmo editor"), {
      target: {
        value: `Proceso HolaMundo
  Escribir "Hola Mundo!"
FinProceso`,
      },
    });

    await user.click(screen.getByRole("button", { name: "Diagram" }));

    await waitFor(() => {
      expect(
        screen.getAllByRole("option", { name: "Proceso HolaMundo" })[0].selected
      ).toBe(true);
      expect(screen.getByText('Escribir "Hola Mundo!"')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Escribir "Hola Mundo!"'));

    await waitFor(() => {
      expect(
        screen
          .getAllByRole("button", { name: "Source" })
          .some((button) => button.getAttribute("data-active") === "true")
      ).toBe(true);
    });
  });

  it("runs output in the bottom dock and routes parse failures to problems", async () => {
    const user = userEvent.setup();
    renderPlayground();

    await user.click(screen.getAllByRole("button", { name: "Examples" })[0]);
    await user.click(examplesLibraryDesktop().getByRole("button", { name: /^Hola Mundo/ }));
    await user.click(
      examplesLibraryDesktop().getByRole("button", { name: /Open in New Tab: Hola Mundo/i })
    );
    await user.click(screen.getByRole("button", { name: "Run" }));

    await waitFor(() => {
      expect(screen.getByTestId("output-console")).toHaveTextContent(
        "Hola Mundo!"
      );
    });

    fireEvent.change(screen.getByLabelText("Codoritmo editor"), {
      target: {
        value: `Proceso Roto
  Escribir "Hola"`,
      },
    });

    await user.click(screen.getByRole("button", { name: "Run" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Problems" })).toHaveAttribute(
        "data-active",
        "true"
      );
      expect(screen.getByTestId("problems-list")).toBeInTheDocument();
    });
  });

  it("can collapse and expand the bottom dock", async () => {
    const user = userEvent.setup();
    renderPlayground();

    expect(screen.getByTestId("output-console")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Collapse output" }));

    await waitFor(() => {
      expect(screen.getByTestId("bottom-dock")).toHaveAttribute(
        "data-collapsed",
        "true"
      );
      expect(
        screen.getByRole("button", { name: "Expand output" })
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Expand output" }));

    await waitFor(() => {
      expect(screen.getByTestId("output-console")).toBeInTheDocument();
    });
  });

  it("waits for interactive input in the output dock and resumes after submission", async () => {
    const user = userEvent.setup();
    renderPlayground();

    fireEvent.change(screen.getByLabelText("Codoritmo editor"), {
      target: {
        value: `Proceso Lectura
  Leer valor
  Escribir valor
FinProceso`,
      },
    });

    await user.click(screen.getByRole("button", { name: "Run" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Program input")).toBeEnabled();
    });

    await user.type(screen.getByLabelText("Program input"), "55");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByTestId("output-console")).toHaveTextContent("55");
    });
  });

  it.skip("applies a profile only to the active tab", async () => {
    // TODO: Update this test to work with SearchableSelect component
    const user = userEvent.setup();
    renderPlayground();

    await user.click(screen.getByRole("button", { name: "New" }));

    // Click the profile button to open the dropdown
    await user.click(screen.getByLabelText("Profile"));

    // Wait for and click the "Estricto" option
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Estricto" })
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Estricto" }));

    // Verify the profile button now shows "Estricto"
    expect(screen.getByLabelText("Profile")).toHaveTextContent("Estricto");

    await user.click(screen.getByRole("button", { name: /Untitled 1/i }));

    // Verify the profile button shows "Desktop Default"
    expect(screen.getByLabelText("Profile")).toHaveTextContent(
      "Desktop Default"
    );
  });

  it("shows snippet details on hover and inserts into the active editor", async () => {
    const user = userEvent.setup();
    renderPlayground();

    expect(screen.getByRole("button", { name: "Definir" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Dimension" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Limpiar Pantalla" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Esperar Tecla" })
    ).toBeInTheDocument();

    await user.hover(screen.getByRole("button", { name: "Si" }));

    await waitFor(() => {
      expect(screen.getByTestId("quick-help-title")).toHaveTextContent("Si");
    });

    expect(screen.getByTestId("quick-help-preview")).toHaveAttribute(
      "data-kind",
      "decision"
    );
    expect(screen.getByText(/conditional block/i)).toBeInTheDocument();

    await user.hover(screen.getByRole("button", { name: "Escribir" }));

    await waitFor(() => {
      expect(screen.getByTestId("quick-help-preview")).toHaveAttribute(
        "data-kind",
        "io"
      );
    });

    expect(
      screen
        .getByTestId("quick-help-preview")
        .querySelector('[data-shape="io"]')
    ).not.toBeNull();

    await user.hover(screen.getByRole("button", { name: "Repetir" }));

    await waitFor(() => {
      expect(screen.getByTestId("quick-help-preview")).toHaveAttribute(
        "data-kind",
        "repeat-loop"
      );
    });

    expect(
      screen
        .getByTestId("quick-help-preview")
        .querySelector('[data-shape="repeat-loop"]')
    ).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Si" }));

    await waitFor(() => {
      expect(screen.getByTestId("mock-monaco-editor"))
        .toHaveValue(`Si <condicion> Entonces
  <acciones>
FinSiProceso NuevoAlgoritmo
FinProceso`);
    });
  });
});
