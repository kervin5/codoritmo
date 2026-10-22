/**
 * @jest-environment node
 */
import { __testing } from "../components/workspace/array-view";

const { evaluateIndex, accessesOnLine } = __testing;

const scalars = new Map<string, number>([
  ["i", 3],
  ["j", 5],
  ["izq", 1],
  ["der", 8],
  ["n", 10],
]);

describe("array visualiser index evaluation", () => {
  it("evaluates the index expressions students write", () => {
    expect(evaluateIndex("j", scalars)).toBe(5);
    expect(evaluateIndex("j + 1", scalars)).toBe(6);
    expect(evaluateIndex("n - i", scalars)).toBe(7);
    expect(evaluateIndex("(izq + der) / 2", scalars)).toBe(4);
    expect(evaluateIndex("Trunc((izq + der) / 2)", scalars)).toBe(4);
    expect(evaluateIndex("2 * i - 1", scalars)).toBe(5);
    expect(evaluateIndex("-1 + j", scalars)).toBe(4);
  });

  it("gives up on unknown names or functions instead of guessing", () => {
    expect(evaluateIndex("k", scalars)).toBeNull();
    expect(evaluateIndex("Azar(3)", scalars)).toBeNull();
    expect(evaluateIndex("j +", scalars)).toBeNull();
  });

  it("finds the cells a line touches, base 1 and base 0", () => {
    const line = "\t\t\tSi datos[j] > datos[j + 1] Entonces";
    const base1 = accessesOnLine(line, "datos", [8], scalars, 1);
    expect([...base1.cells.entries()]).toEqual([
      [4, "j"],
      [5, "j + 1"],
    ]);
    const base0 = accessesOnLine(line, "datos", [8], scalars, 0);
    expect([...base0.cells.keys()]).toEqual([5, 6]);
  });

  it("maps matrix accesses to row-major cells and ignores other arrays, strings and comments", () => {
    const line = 'ventas[i, j] <- otro[i] + 1 // ventas[1, 1] "ventas[2,2]"';
    const result = accessesOnLine(line, "ventas", [5, 6], scalars, 1);
    expect([...result.cells.entries()]).toEqual([[2 * 6 + 4, "i,j"]]);
  });

  it("skips out-of-range indices", () => {
    expect(accessesOnLine("v[n + 5] <- 1", "v", [10], scalars, 1).cells.size).toBe(0);
  });
});
