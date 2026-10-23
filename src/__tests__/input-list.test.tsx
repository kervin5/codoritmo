import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { enDictionary } from "@/src/i18n/en";

import { inputListFileName, parseInputList, serializeInputList } from "../components/workspace/inputs-list";
import Workspace from "../components/workspace/workspace";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

/** Monaco stand-in: a textarea plus the editor/monaco surface the workspace touches. */
jest.mock("@monaco-editor/react", () => {
  const noop = () => {};
  const disposable = { dispose: noop };
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
    const ref = React.useRef<HTMLTextAreaElement | null>(null);
    const latest = React.useRef({ onChange, value });
    latest.current = { onChange, value };
    React.useEffect(() => {
      const monaco = {
        MarkerSeverity: { Warning: 4, Error: 8 },
        CompletionItemKind: { Function: 1, Snippet: 2, Operator: 3, Constant: 4, Keyword: 5, Variable: 6 },
        CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
        languages: {
          register: noop,
          setMonarchTokensProvider: noop,
          setLanguageConfiguration: noop,
          registerCompletionItemProvider: () => disposable,
          registerHoverProvider: () => disposable,
        },
        editor: { defineTheme: noop, setModelMarkers: noop },
      };
      beforeMount?.(monaco);
      const editor = {
        getModel: () => ({ getLineCount: () => 1, getLineMaxColumn: () => 1, getWordAtPosition: () => null }),
        getSelection: () => ({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 }),
        executeEdits: (_source: string, edits: { text: string }[]) =>
          latest.current.onChange?.(`${edits[0].text}${latest.current.value ?? ""}`),
        onDidChangeCursorPosition: () => disposable,
        createDecorationsCollection: () => ({ set: noop }),
        revealLineInCenterIfOutsideViewport: noop,
        revealLineInCenter: noop,
        setPosition: noop,
        focus: () => ref.current?.focus(),
        trigger: noop,
      };
      onMount?.(editor, monaco);
      // Mount once, like the real editor.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <textarea aria-label="editor" onChange={(e) => onChange?.(e.target.value)} ref={ref} value={value ?? ""} />;
  };
  return { __esModule: true, default: MockEditor };
});

const t = enDictionary.studio;

function renderWorkspace() {
  return render(<Workspace dictionary={enDictionary} locale="en" />);
}

function transport(label: string) {
  return screen.getByLabelText(label, { selector: "button" });
}

function setProgram(source: string) {
  fireEvent.change(screen.getByLabelText("editor"), { target: { value: source } });
}

function useInstantSpeed() {
  fireEvent.click(screen.getByRole("button", { name: t.run.speeds.instant }));
}

function consoleText() {
  return document.querySelector(".font-mono.text-\\[14px\\]")?.textContent ?? "";
}

async function step(times: number) {
  for (let i = 0; i < times; i += 1) {
    await act(async () => {
      fireEvent.click(transport(t.run.stepNext));
      await new Promise((r) => setTimeout(r, 30));
    });
  }
}

function openAnswers() {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`${t.inputList.button}|${t.inputList.count.other.replace("{count}", "\\d+")}|${t.inputList.count.one.replace("{count}", "\\d+")}`) }));
  return screen.getByRole("textbox", { name: t.inputList.title });
}

beforeEach(() => {
  window.localStorage.clear();
  window.location.hash = "";
  window.history.replaceState(null, "", "/");
});

describe("answer list helpers", () => {
  it("reads one answer per line and ignores the file's final newline", () => {
    expect(parseInputList("5\r\nAna\n")).toEqual(["5", "Ana"]);
    expect(parseInputList("a\n\nb")).toEqual(["a", "", "b"]);
    expect(parseInputList("   ")).toEqual([]);
    expect(parseInputList(undefined)).toEqual([]);
  });

  it("saves one answer per line and names the file after the program", () => {
    expect(serializeInputList("1\n2")).toBe("1\n2\n");
    expect(serializeInputList("")).toBe("");
    expect(inputListFileName("Promedio.psc", "respuestas")).toBe("Promedio-respuestas.txt");
  });
});

describe("Predefined answers for Leer", () => {
  const program = "Algoritmo Suma\n\tLeer a\n\tLeer b\n\tEscribir a + b\nFinAlgoritmo";

  it("answers every Leer from the list without asking", async () => {
    renderWorkspace();
    setProgram(program);
    fireEvent.change(openAnswers(), { target: { value: "4\n5\n" } });
    expect(screen.getAllByText(t.inputList.count.other.replace("{count}", "2")).length).toBeGreaterThan(0);
    useInstantSpeed();
    fireEvent.click(transport(t.run.run));
    await waitFor(() => expect(consoleText()).toContain(t.finishedTitle));
    expect(consoleText()).toContain("9");
    expect(screen.getAllByText(t.inputList.fromList)).toHaveLength(2);
    expect(screen.queryByLabelText(t.inputPlaceholder)).not.toBeInTheDocument();
  });

  it("falls back to asking in the console when the list runs out", async () => {
    renderWorkspace();
    setProgram(program);
    fireEvent.change(openAnswers(), { target: { value: "4" } });
    useInstantSpeed();
    fireEvent.click(transport(t.run.run));
    const input = await screen.findByLabelText(t.inputPlaceholder);
    expect(screen.getByText(t.inputList.used.replace("{used}", "1").replace("{total}", "1"))).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "10" } });
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(consoleText()).toContain("14"));
  });

  it("keeps the list with the document", async () => {
    renderWorkspace();
    setProgram(program);
    fireEvent.change(openAnswers(), { target: { value: "7\n8" } });
    await waitFor(() => expect(window.localStorage.getItem("codoritmo.workspace.v3") ?? "").toContain('"inputList":"7\\n8"'));
  });

  it("loads answers from a .txt file and saves them as one", async () => {
    const created: Blob[] = [];
    URL.createObjectURL = jest.fn((blob: Blob) => {
      created.push(blob);
      return "blob:answers";
    });
    URL.revokeObjectURL = jest.fn();
    const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderWorkspace();
    setProgram(program);
    const box = openAnswers();
    const file = new File(["3\r\n6\r\n"], "datos.txt", { type: "text/plain" });
    Object.defineProperty(file, "arrayBuffer", { value: async () => new TextEncoder().encode("3\r\n6\r\n").buffer });
    await act(async () => {
      fireEvent.change(screen.getByTestId("input-list-file"), { target: { files: [file] } });
    });
    await waitFor(() => expect(box).toHaveValue("3\n6\n"));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(t.inputList.save) }));
    expect(click).toHaveBeenCalled();
    expect(created).toHaveLength(1);
    click.mockRestore();
  });
});

describe("Evaluar and watch expressions", () => {
  const program = "Algoritmo Pasos\n\ta <- 1\n\tnombre <- \"Ana\"\n\ta <- a + 1\n\ta <- a * 10\nFinAlgoritmo";

  it("evaluates an expression at the step on screen and follows the steps", async () => {
    renderWorkspace();
    setProgram(program);
    await step(4);
    fireEvent.click(screen.getByRole("tab", { name: t.view.deskCheck }));
    const field = screen.getByLabelText(t.evaluate.label);
    fireEvent.change(field, { target: { value: "a * 2 + Longitud(nombre)" } });
    fireEvent.submit(field.closest("form")!);
    // Before "a <- a * 10": a = 2, so 2 * 2 + 3.
    await waitFor(() => expect(screen.getByTestId("eval-result")).toHaveTextContent("7"));
    fireEvent.click(transport(t.run.stepBack));
    // One step earlier a is still 1.
    await waitFor(() => expect(screen.getByTestId("eval-result")).toHaveTextContent("5"));
  });

  it("explains errors in the student's language", async () => {
    renderWorkspace();
    setProgram(program);
    await step(2);
    fireEvent.click(screen.getByRole("tab", { name: t.view.deskCheck }));
    const field = screen.getByLabelText(t.evaluate.label);
    fireEvent.change(field, { target: { value: "total + 1" } });
    fireEvent.submit(field.closest("form")!);
    await waitFor(() =>
      expect(screen.getByTestId("eval-result")).toHaveTextContent('There is no variable "total" at this step.')
    );
  });

  it("adds a watch column evaluated at every row, kept with the document", async () => {
    renderWorkspace();
    setProgram(program);
    await step(4);
    fireEvent.click(screen.getByRole("tab", { name: t.view.deskCheck }));
    fireEvent.change(screen.getByLabelText(t.evaluate.label), { target: { value: "a > 1" } });
    fireEvent.click(screen.getByRole("button", { name: new RegExp(t.evaluate.addWatch) }));
    const table = screen.getByRole("table");
    expect(within(table).getByText("a > 1")).toBeInTheDocument();
    await waitFor(() => {
      const cells = within(table).getAllByTestId("watch-cell").map((cell) => cell.textContent);
      expect(cells).toContain("FALSO");
      expect(cells).toContain("VERDADERO");
    });
    await waitFor(() => expect(window.localStorage.getItem("codoritmo.workspace.v3") ?? "").toContain('"watches":["a > 1"]'));
    fireEvent.click(screen.getByRole("button", { name: t.evaluate.removeWatch.replace("{expr}", "a > 1") }));
    expect(within(table).queryByText("a > 1")).not.toBeInTheDocument();
  });

  it("offers Evaluar in the console while paused", async () => {
    renderWorkspace();
    setProgram(program);
    expect(screen.queryByLabelText(t.evaluate.label)).not.toBeInTheDocument();
    await step(3);
    const field = await screen.findByLabelText(t.evaluate.label);
    fireEvent.change(field, { target: { value: "a + 0.5" } });
    fireEvent.submit(field.closest("form")!);
    await waitFor(() => expect(screen.getByTestId("eval-result")).toHaveTextContent("1.5"));
  });
});
