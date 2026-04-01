import { Parser, Interpreter, createBrowserRuntime } from "../engine";
import { examplePrograms } from "../engine/examples";

describe("Array manipulation example", () => {
  const arrayExample = examplePrograms.find((ex) => ex.id === "array-average");

  it("should exist in the examples array", () => {
    expect(arrayExample).toBeDefined();
    expect(arrayExample?.label).toBe("Promedio de Notas");
    expect(arrayExample?.input).toBeDefined();
  });

  it("should parse without syntax errors", () => {
    expect(arrayExample).toBeDefined();
    const result = new Parser(arrayExample!.source).parse();

    expect(result.diagnostics).toHaveLength(0);
    expect(result.program).toBeDefined();
    expect(result.program?.entry.name).toBe("PromedioNotas");
  });

  it("should execute without runtime errors", async () => {
    expect(arrayExample).toBeDefined();

    const controller = createBrowserRuntime();

    // Provide the pre-filled input
    const inputLines = arrayExample!.input!.split("\n");

    // Start the interpreter
    const pending = new Interpreter().run(
      arrayExample!.source,
      controller.runtime
    );

    // Wait a bit for the interpreter to start
    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });

    // Submit all inputs
    for (const input of inputLines) {
      if (controller.isAwaitingInput()) {
        controller.submitInput(input);
        // Wait a bit between inputs
        await new Promise((resolve) => {
          setTimeout(resolve, 10);
        });
      }
    }

    const result = await pending;

    // Verify the program executed successfully
    expect(result.state).toBe("ok");

    // Verify the program produced output
    expect(result.output).toBeDefined();
    expect(result.output!.length).toBeGreaterThan(0);

    // Verify it calculated the average (sum of 8.5, 9.0, 7.5, 8.0, 9.5 = 42.5 / 5 = 8.5)
    const outputText = result.output!.join("");
    expect(outputText).toContain("Promedio");
    expect(outputText).toContain("8.5");

    // Verify it found the maximum (9.5)
    expect(outputText).toContain("Nota más alta");
    expect(outputText).toContain("9.5");
  });

  it("should demonstrate array concepts", () => {
    expect(arrayExample).toBeDefined();
    const source = arrayExample!.source;

    // Verify it uses Dimension for array declaration
    expect(source).toContain("Dimension");
    expect(source).toContain("notas[5]");

    // Verify it uses Para loops for iteration
    expect(source).toContain("Para");
    expect(source).toContain("Hasta");

    // Verify it uses array indexing
    expect(source).toMatch(/notas\[i\]/);

    // Verify it demonstrates finding maximum
    expect(source).toContain("maximo");
    expect(source).toContain("Si notas[i] > maximo");
  });
});
