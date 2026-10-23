import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { enDictionary } from "@/src/i18n/en";
import { esDictionary } from "@/src/i18n/es";
import { examplePath } from "@/src/lib/example-urls";

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

/** Transport buttons carry aria-labels; menu titles are plain text with aria-haspopup. */
function transport(label: string) {
  return screen.getByLabelText(label, { selector: "button" });
}

function menu(label: string) {
  return screen.getAllByRole("button", { name: label }).find((b) => b.getAttribute("aria-haspopup") === "menu")!;
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

beforeEach(() => {
  window.localStorage.clear();
  window.location.hash = "";
  window.history.replaceState(null, "", "/");
});

/** Installs (or removes, with undefined) a navigator property for one test. */
function stubNavigator<K extends "share" | "clipboard">(key: K, value: unknown) {
  Object.defineProperty(window.navigator, key, { configurable: true, value });
}

afterEach(() => {
  stubNavigator("share", undefined);
  stubNavigator("clipboard", undefined);
});

describe("Workspace", () => {
  it("runs the program and shows its output in the console", async () => {
    renderWorkspace();
    setProgram('Algoritmo Hola\n\tEscribir "Hola Mundo!"\nFinAlgoritmo');
    useInstantSpeed();
    fireEvent.click(transport(t.run.run));
    await waitFor(() => expect(consoleText()).toContain("Hola Mundo!"));
    await waitFor(() => expect(consoleText()).toContain(t.endOfProgram));
  });

  it("asks for input inline and resumes after the answer", async () => {
    renderWorkspace();
    setProgram("Algoritmo Doble\n\tLeer x\n\tEscribir x * 2\nFinAlgoritmo");
    useInstantSpeed();
    fireEvent.click(transport(t.run.run));
    const input = await screen.findByLabelText(t.inputPlaceholder);
    expect(screen.getByText(t.askingInput)).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "21" } });
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(consoleText()).toContain("42"));
  });

  it("stops an infinite loop", async () => {
    renderWorkspace();
    setProgram("Algoritmo Siempre\n\tx <- 0\n\tMientras Verdadero Hacer\n\t\tx <- x + 1\n\tFinMientras\nFinAlgoritmo");
    useInstantSpeed();
    fireEvent.click(transport(t.run.run));
    const stop = transport(t.run.stop);
    await waitFor(() => expect(stop).toBeEnabled());
    fireEvent.click(stop);
    await waitFor(() => expect(consoleText()).toContain(t.stoppedLine));
    expect(transport(t.run.run)).toBeInTheDocument();
  });

  it("steps forward, fills the desk check, and rewinds", async () => {
    renderWorkspace();
    setProgram("Algoritmo Pasos\n\ta <- 1\n\ta <- a + 1\n\ta <- a * 10\nFinAlgoritmo");
    const next = transport(t.run.stepNext);
    for (let i = 0; i < 3; i += 1) {
      await act(async () => {
        fireEvent.click(next);
        await new Promise((r) => setTimeout(r, 30));
      });
    }
    fireEvent.click(screen.getByRole("tab", { name: t.view.deskCheck }));
    const table = await screen.findByRole("table");
    await waitFor(() => expect(within(table).getAllByRole("row").length).toBeGreaterThan(2));
    // After "a <- a + 1" runs, the next row shows a = 2 highlighted as changed.
    expect(within(table).getAllByText("2").some((cell) => cell.className.includes("font-semibold"))).toBe(true);

    fireEvent.click(transport(t.run.stepBack));
    await waitFor(() => expect(screen.getByText(t.status.rewound.replace("{n}", "2"))).toBeInTheDocument());
  });

  it("lists parse problems with a count", async () => {
    renderWorkspace();
    setProgram("Algoritmo Roto\n\tSi x > 1 Entonces\n\t\tEscribir x\nFinAlgoritmo");
    fireEvent.click(await screen.findByRole("tab", { name: new RegExp(t.view.problems) }));
    await waitFor(() => expect(screen.queryByText(t.problemsEmpty)).not.toBeInTheDocument());
    expect(screen.getAllByText(/1 error/).length).toBeGreaterThan(0);
  });

  it("opens native-style menus and saves with a download", async () => {
    const createObjectURL = jest.fn(() => "blob:test");
    Object.assign(URL, { createObjectURL, revokeObjectURL: jest.fn() });
    const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    renderWorkspace();
    setProgram("Algoritmo Guardar\n\tEscribir 1\nFinAlgoritmo");
    expect(screen.getByText(new RegExp(t.edited))).toBeInTheDocument();

    fireEvent.mouseDown(menu(t.menus.file));
    const fileMenu = screen.getByRole("menu");
    expect(within(fileMenu).getByText(t.file.exportAs)).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(within(fileMenu).getByText(t.file.save));
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });

    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(screen.queryByText(new RegExp(t.edited))).not.toBeInTheDocument();
    click.mockRestore();
  });

  it("persists documents locally and restores them", async () => {
    const { unmount } = renderWorkspace();
    setProgram("Algoritmo Persistente\nFinAlgoritmo");
    await waitFor(() => expect(window.localStorage.getItem("codoritmo.workspace.v3")).toContain("Persistente"));
    unmount();
    renderWorkspace();
    await waitFor(() => expect((screen.getByLabelText("editor") as HTMLTextAreaElement).value).toContain("Persistente"));
  });

  it("imports tabs from the previous workspace storage", async () => {
    window.localStorage.setItem(
      "algo-brain.workspace.v1",
      JSON.stringify({ activeSessionId: "a", sessions: [{ id: "a", title: "Viejo", source: "Proceso Viejo\nFinProceso", profileId: "estricto" }] })
    );
    renderWorkspace();
    await waitFor(() => expect((screen.getByLabelText("editor") as HTMLTextAreaElement).value).toContain("Proceso Viejo"));
    expect(screen.getByRole("tab", { name: /Viejo\.psc/ })).toBeInTheDocument();
  });

  it("picks a school profile from the profile dialog", async () => {
    renderWorkspace();
    fireEvent.mouseDown(menu(t.menus.run));
    fireEvent.mouseEnter(screen.getByText(t.run.profile));
    await act(async () => {
      fireEvent.click(screen.getByText(t.run.moreProfiles));
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });
    const dialog = screen.getByRole("dialog", { name: t.profiles.title });
    fireEvent.change(within(dialog).getByPlaceholderText(t.profiles.search), { target: { value: "111Mil" } });
    fireEvent.click(within(dialog).getByText("111Mil"));
    fireEvent.click(within(dialog).getByRole("button", { name: t.profiles.done }));
    expect(screen.getByRole("button", { name: "111Mil" })).toBeInTheDocument();
  });

  it("translates the program to C in the side panel", async () => {
    renderWorkspace();
    setProgram('Algoritmo Hola\n\tEscribir "Hola"\nFinAlgoritmo');
    fireEvent.click(screen.getByRole("button", { name: t.activity.code.replace("{lang}", "C") }));
    await waitFor(() => expect(document.body.textContent).toContain("#include"));
  });

  it("opens the example library on a first visit and opens an example with its guide", async () => {
    renderWorkspace();
    const browser = await screen.findByRole("dialog", { name: t.examples.title });
    fireEvent.change(within(browser).getByLabelText(t.examples.search), { target: { value: "ahorcado" } });
    const options = within(browser).getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent(enDictionary.examples["hangman"].label);
    fireEvent.click(within(browser).getByRole("button", { name: new RegExp(`^${t.examples.open}`) }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: t.examples.title })).not.toBeInTheDocument());
    expect(screen.getByRole("tab", { name: /Ahorcado\.psc/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { expanded: false, name: new RegExp(t.examples.guide) }));
    expect(screen.getByText(enDictionary.examples["hangman"].challenge, { exact: false })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.examples.showHint }));
    expect(screen.getByText(enDictionary.examples["hangman"].hint)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.examples.dismiss }));
    expect(screen.queryByText(enDictionary.examples["hangman"].hint)).not.toBeInTheDocument();
  });

  it("filters examples by topic and level", async () => {
    renderWorkspace();
    const browser = await screen.findByRole("dialog", { name: t.examples.title });
    fireEvent.click(within(browser).getAllByRole("button", { name: new RegExp(t.examples.topics.projects) })[0]);
    fireEvent.click(within(browser).getByRole("radio", { name: t.examples.levels["3"] }));
    const options = within(browser).getAllByRole("option");
    expect(options.length).toBeGreaterThanOrEqual(4);
    expect(within(browser).getByText(t.examples.results.other.replace("{count}", String(options.length)))).toBeInTheDocument();
  });

  it("copies the example's localized public URL when there is no share sheet", async () => {
    const writeText = jest.fn(() => Promise.resolve());
    stubNavigator("clipboard", { writeText });
    const es = esDictionary.studio.examples;
    render(<Workspace dictionary={esDictionary} locale="es" />);
    const browser = await screen.findByRole("dialog", { name: es.title });
    fireEvent.change(within(browser).getByLabelText(es.search), { target: { value: "ahorcado" } });
    await act(async () => {
      fireEvent.click(within(browser).getByRole("button", { name: es.share }));
    });

    const url = `${window.location.origin}${examplePath("es", "hangman")}`;
    expect(url).toMatch(/^http:\/\/localhost\/es\/ejemplos\/[a-z-]+$/);
    expect(writeText).toHaveBeenCalledWith(url);
    expect(await within(browser).findByText(es.linkCopied)).toBeInTheDocument();
    // Sharing doesn't open the example.
    expect(screen.getByRole("dialog", { name: es.title })).toBeInTheDocument();
    expect(within(browser).getByRole("link", { name: es.viewPageHint })).toHaveAttribute("href", examplePath("es", "hangman"));
  });

  it("shows the link to copy by hand when the clipboard is blocked", async () => {
    stubNavigator("clipboard", { writeText: () => Promise.reject(new DOMException("denied", "NotAllowedError")) });
    renderWorkspace();
    const browser = await screen.findByRole("dialog", { name: t.examples.title });
    fireEvent.change(within(browser).getByLabelText(t.examples.search), { target: { value: "ahorcado" } });
    await act(async () => {
      fireEvent.click(within(browser).getByRole("button", { name: t.examples.share }));
    });
    const field = await within(browser).findByLabelText(t.examples.copyFailed);
    expect(field).toHaveValue(`${window.location.origin}${examplePath("en", "hangman")}`);
  });

  it("uses the native share sheet when there is one", async () => {
    const share = jest.fn(() => Promise.resolve());
    const writeText = jest.fn(() => Promise.resolve());
    stubNavigator("share", share);
    stubNavigator("clipboard", { writeText });
    renderWorkspace();
    const browser = await screen.findByRole("dialog", { name: t.examples.title });
    fireEvent.change(within(browser).getByLabelText(t.examples.search), { target: { value: "ahorcado" } });
    await act(async () => {
      fireEvent.click(within(browser).getByRole("button", { name: t.examples.share }));
    });
    expect(share).toHaveBeenCalledWith({
      title: enDictionary.examples["hangman"].label,
      text: enDictionary.examples["hangman"].description,
      url: `${window.location.origin}${examplePath("en", "hangman")}`,
    });
    expect(writeText).not.toHaveBeenCalled();
  });

  it("opens the example from ?ejemplo= with its guide instead of the browser", async () => {
    window.history.replaceState(null, "", "/en?ejemplo=quicksort");
    renderWorkspace();
    expect(await screen.findByRole("tab", { name: /Quicksort\.psc/ })).toBeInTheDocument();
    // The guide shows collapsed, with the example's summary.
    expect(screen.getByText(enDictionary.examples["quicksort"].description)).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: t.examples.title })).not.toBeInTheDocument();
    expect(window.location.search).toBe("");
    expect(window.location.pathname).toBe("/en");
  });

  it("ignores an unknown ?ejemplo=", async () => {
    window.history.replaceState(null, "", "/en?ejemplo=does-not-exist");
    renderWorkspace();
    // A first visit as usual: the browser opens and no example tab is added.
    expect(await screen.findByRole("dialog", { name: t.examples.title })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Quicksort\.psc/ })).not.toBeInTheDocument();
    expect(window.location.search).toBe("");
  });
});
