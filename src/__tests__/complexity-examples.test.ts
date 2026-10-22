/**
 * @jest-environment node
 */
import { examplePrograms, measureComplexity } from "../engine";

// Measuring the sorting examples should agree with what the textbook says
// about their average case (the analyser feeds random data).
const expected: Record<string, string[]> = {
  "bubble-sort": ["O(n²)"],
  "selection-sort": ["O(n²)"],
  "insertion-sort": ["O(n²)"],
  "shell-sort": ["O(n log n)", "O(n²)"], // O(n^1.5) sits between the two
  "merge-sort": ["O(n log n)"],
  quicksort: ["O(n log n)"],
  "heap-sort": ["O(n log n)"],
  "counting-sort": ["O(n)"],
};

describe("complexity of the sorting examples", () => {
  it.each(Object.entries(expected))("%s measures as %s", async (id, classes) => {
    const example = examplePrograms.find((e) => e.id === id);
    expect(example).toBeDefined();
    const report = await measureComplexity({ source: example!.source, settings: example!.settings });
    expect([report.issue, report.errorMessage]).toEqual([undefined, undefined]);
    expect(classes).toContain(report.time.best);
  }, 60_000);
});
