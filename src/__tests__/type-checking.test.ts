import { Interpreter, createBrowserRuntime } from "../engine";

describe("Type checking", () => {
  it("should raise error when assigning string to integer variable", async () => {
    const source = `Proceso TestTipo
  Definir a Como Entero
  a <- "Hola"
FinProceso`;

    const controller = createBrowserRuntime();
    const result = await new Interpreter().run(source, controller.runtime);

    expect(result.state).toBe("runtime_error");
  });

  it("should raise error when assigning string to integer array", async () => {
    const source = `Proceso TestTipo
  Definir mezcla Como Entero
  Dimension mezcla[3]
  mezcla[1] <- 100
  mezcla[2] <- 200
  mezcla[3] <- "texto"
FinProceso`;

    const controller = createBrowserRuntime();
    const result = await new Interpreter().run(source, controller.runtime);

    expect(result.state).toBe("runtime_error");
  });

  it("should allow assigning integer to integer variable", async () => {
    const source = `Proceso TestTipo
  Definir a Como Entero
  a <- 5
  Escribir a
FinProceso`;

    const controller = createBrowserRuntime();
    const result = await new Interpreter().run(source, controller.runtime);

    expect(result.state).toBe("ok");
    expect(result.output).toContain("5");
  });

  it("should raise error when assigning real to integer variable (PSeInt error 314)", async () => {
    const source = `Proceso TestTipo
  Definir x Como Entero
  x <- 2.5
  Escribir x
FinProceso`;

    const controller = createBrowserRuntime();
    const result = await new Interpreter().run(source, controller.runtime);

    // PSeInt raises error 314 for this case
    expect(result.state).toBe("runtime_error");
  });
});
