/**
 * @jest-environment node
 */
import fs from "node:fs";
import path from "node:path";

import {
  CaseResult,
  compareOutcome,
  loadUpstreamCases,
  runCasesInWorker,
} from "./helpers/upstream-cases";

// Upstream PSeInt's own interpreter tests (test/interp on the pseint2 branch),
// vendored in fixtures/upstream/interp. We track the pass rate instead of
// requiring 100%: cases listed in known-failures.json may fail, any other
// failure is a regression. Run with UPDATE_UPSTREAM_KNOWN_FAILURES=1 to
// rewrite the list after fixing cases.
const root = process.cwd();
const casesDirectory = path.join(root, "fixtures/upstream/interp");
const knownFailuresFile = path.join(root, "fixtures/upstream/known-failures.json");
const engineDirectory = path.join(root, "src/engine");
const caseTimeoutMs = 4000;

describe("upstream PSeInt interpreter tests", () => {
  const cases = loadUpstreamCases(casesDirectory);
  let results = new Map<string, CaseResult>();

  beforeAll(async () => {
    results = await runCasesInWorker(cases, engineDirectory, caseTimeoutMs);
  }, cases.length * caseTimeoutMs + 30000);

  it("has no failures outside the known-failures allowlist", () => {
    const knownFailures = new Set<string>(
      JSON.parse(fs.readFileSync(knownFailuresFile, "utf8"))
    );
    const failures = new Map<string, string>();
    for (const testCase of cases) {
      const reason = compareOutcome(testCase.expected, results.get(testCase.name)!);
      if (reason) {
        failures.set(testCase.name, reason);
      }
    }

    const passed = cases.length - failures.size;
    const regressions = [...failures].filter(([name]) => !knownFailures.has(name));
    const fixed = [...knownFailures].filter((name) => !failures.has(name));
    console.log(
      `Upstream interp pass rate: ${passed}/${cases.length} (${((passed / cases.length) * 100).toFixed(1)}%)` +
        (fixed.length > 0 ? `\nNow passing, remove from known-failures.json: ${fixed.join(", ")}` : "")
    );

    if (process.env.UPDATE_UPSTREAM_KNOWN_FAILURES === "1") {
      fs.writeFileSync(knownFailuresFile, `${JSON.stringify([...failures.keys()].sort(), null, 2)}\n`);
      if (process.env.UPSTREAM_REPORT) {
        fs.writeFileSync(
          process.env.UPSTREAM_REPORT,
          [...failures].map(([name, reason]) => `## ${name}\n${reason}\n`).join("\n")
        );
      }
      return;
    }

    expect(regressions.map(([name, reason]) => `${name}: ${reason}`)).toEqual([]);
  });
});
