/* eslint-disable @typescript-eslint/no-require-imports -- plain CommonJS so it can run as a worker without a build step */
// Worker thread that runs upstream PSeInt test cases through the TypeScript
// engine. Runs off the jest thread so a case that never yields (an infinite
// loop) can be killed with worker.terminate() without stalling the suite.
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { parentPort, workerData } = require("node:worker_threads");
const ts = require("typescript");

const compiled = new Map();
const previousTs = Module._extensions[".ts"];
Module._extensions[".ts"] = function compileTs(module, filename) {
  if (!filename.startsWith(workerData.engineDirectory)) {
    return previousTs(module, filename);
  }
  let output = compiled.get(filename);
  if (!output) {
    output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        resolveJsonModule: true,
      },
      fileName: filename,
    }).outputText;
    compiled.set(filename, output);
  }
  module._compile(output, filename);
};

// Load the modules directly rather than index.ts: index re-exports the browser
// worker factory, whose import.meta makes Node treat it as an ES module.
const engine = {
  ...require(path.join(workerData.engineDirectory, "interpreter.ts")),
  ...require(path.join(workerData.engineDirectory, "settings.ts")),
};

class InputExhaustedError extends Error {}

async function runCase(testCase) {
  const parsedArgs = engine.parseFixtureArguments(testCase.args);
  const interpreter = new engine.Interpreter({
    settings: parsedArgs.settings,
    random: () => 0,
  });
  const queue = [...(parsedArgs.input.length > 0 ? parsedArgs.input : testCase.fileInput)];
  // Transcript of what the program sent to the terminal, with the markers
  // that pseint --fortest prints in place of real waits.
  const lines = [];
  let pending = "";
  const emitLine = (text) => {
    lines.push(pending + text);
    pending = "";
  };
  const runtime = {
    write(value, newline = true) {
      if (newline) emitLine(value);
      else pending += value;
    },
    read() {
      if (queue.length === 0) {
        throw new InputExhaustedError("No more input available.");
      }
      return queue.shift();
    },
    clear() {
      emitLine("***LimpiarPantalla***");
    },
    async sleep(ms) {
      emitLine(`***Esperar${ms}***`);
    },
    async waitForKey() {
      emitLine("***EsperarTecla***");
    },
  };
  const transcript = () => (pending ? [...lines, pending] : [...lines]);

  try {
    const result = await interpreter.run(testCase.source, runtime);
    return {
      state: result.state,
      output: transcript(),
      diagnostics: result.diagnostics,
      unsupported: parsedArgs.unsupported,
    };
  } catch (error) {
    return {
      state: error instanceof InputExhaustedError ? "input_exhausted" : "crash",
      output: transcript(),
      diagnostics: [{ message: String(error && error.stack ? error.stack : error), line: 0 }],
      unsupported: parsedArgs.unsupported,
    };
  }
}

parentPort.on("message", async (testCase) => {
  const result = await runCase(testCase);
  parentPort.postMessage({ name: testCase.name, result });
});
