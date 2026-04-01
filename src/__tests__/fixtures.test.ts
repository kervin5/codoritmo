import fs from "node:fs";
import path from "node:path";

import manifest from "../../fixtures/test-manifest.json";
import {
  createBrowserRuntime,
  defaultEngineSettings,
  getEngineProfile,
  Interpreter,
  parseFixtureArguments,
} from "../engine";
import type { FixtureManifestEntry } from "../engine";

const rootDirectory = process.cwd();

function readFixture(file: string): string {
  return fs
    .readFileSync(path.join(rootDirectory, file), "utf8")
    .replace(/\r\n/g, "\n");
}

function readOptionalFixture(file: string): string | null {
  const absolutePath = path.join(rootDirectory, file);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  return fs.readFileSync(absolutePath, "utf8").replace(/\r\n/g, "\n");
}

function readOutputFor(file: string): string {
  return readFixture(file.replace(/\.psc$/, ".out"));
}

function normalizeFixtureOutput(output: string): string {
  return output
    .split("\n")
    .map((line) => (line.startsWith("> ") ? line.slice(2) : line))
    .join("\n")
    .trimEnd();
}

describe("fixture manifest", () => {
  const entries = manifest as FixtureManifestEntry[];

  it.each(entries)("matches fixture $id", async (entry) => {
    const source = readFixture(entry.file);
    const rawArgs = readOptionalFixture(entry.file.replace(/\.psc$/, ".arg"));
    const parsedArgs = rawArgs
      ? parseFixtureArguments(rawArgs)
      : {
          input: [],
          settings: {},
          unsupported: [],
        };
    const profileSettings = entry.profileId
      ? getEngineProfile(entry.profileId)?.settings ?? defaultEngineSettings
      : defaultEngineSettings;
    const interpreter = new Interpreter({
      settings: {
        ...profileSettings,
        ...parsedArgs.settings,
        ...entry.settings,
      },
    });
    const controller = createBrowserRuntime({
      input: entry.input ?? parsedArgs.input,
    });

    expect(parsedArgs.unsupported).toEqual([]);

    const result = await interpreter.run(source, controller.runtime);

    if (entry.expectation === "success") {
      expect(result.state).toBe("ok");
      expect(normalizeFixtureOutput(result.output.join("\n"))).toBe(
        normalizeFixtureOutput(readOutputFor(entry.file))
      );
      return;
    }

    if (entry.expectation === "parse_error") {
      expect(result.state).toBe("parse_error");
      expect(result.diagnostics[0]?.severity).toBe("error");
      return;
    }

    expect(result.state).toBe("runtime_error");
    expect(result.diagnostics[0]?.severity).toBe("error");
  });
});
