import { parentPort, workerData } from "node:worker_threads";
import { getQuickJS } from "quickjs-emscripten";

// The guest receives only its own source and input. No host callbacks, module
// loader, filesystem, network, or backend environment are wired into QuickJS.
const wasm = await getQuickJS();
const { source, inputs, limits } = workerData;

function run(stdin) {
  const runtime = wasm.newRuntime();
  runtime.setMemoryLimit(limits.memoryBytes);
  runtime.setMaxStackSize(limits.stackBytes);
  const start = performance.now();
  let timedOut = false;
  runtime.setInterruptHandler(() => (timedOut = performance.now() - start >= limits.caseMs));
  const vm = runtime.newContext();
  try {
    const setup = vm.evalCode(`(() => {
      const input = ${JSON.stringify(stdin)};
      const maximum = ${limits.outputBytes};
      const convert = String;
      const slice = Function.call.bind(String.prototype.slice);
      let output = "";
      let truncated = false;
      const fs = Object.freeze({
        readFileSync(fd, encoding) {
          if (fd !== 0 || encoding !== "utf8") throw new Error("Only reading standard input as utf8 is supported.");
          return input;
        }
      });
      delete globalThis.Atomics;
      delete globalThis.SharedArrayBuffer;
      globalThis.require = name => {
        if (name === "fs" || name === "node:fs") return fs;
        throw new Error("Modules are unavailable in this runner.");
      };
      globalThis.console = Object.freeze({ log(...args) {
        for (let i = 0; i < args.length && !truncated; i++) {
          append((i ? " " : "") + convert(args[i]));
        }
        append("\\n");
      }});
      function append(text) {
        const remaining = maximum - output.length;
        if (text.length > remaining) truncated = true;
        if (remaining > 0) output += slice(text, 0, remaining);
      }
      return passFlag => passFlag ? truncated : output;
    })()`, "runner.js", { type: "global" });
    const read = vm.unwrapResult(setup);
    try {
      const result = vm.evalCode(source, "solution.js", { type: "global" });
      const failed = Boolean(result.error);
      result.dispose();
      // A timeout can leave the interpreter interrupted. Do not call back in.
      let stdout = "";
      let outputTruncated = false;
      if (!timedOut) {
        const output = vm.unwrapResult(vm.callFunction(read, vm.undefined, vm.false));
        const flag = vm.unwrapResult(vm.callFunction(read, vm.undefined, vm.true));
        try {
          const bytes = Buffer.from(vm.getString(output));
          outputTruncated = vm.eq(flag, vm.true) || bytes.length > limits.outputBytes;
          stdout = bytes.subarray(0, limits.outputBytes).toString("utf8");
        } finally {
          flag.dispose();
          output.dispose();
        }
      }
      return {
        verdict: timedOut ? "Time Limit Exceeded" : failed || outputTruncated ? "Runtime Error" : "Accepted",
        stdout,
        stderr: failed && !timedOut ? "JavaScript stopped with an error. Check the syntax, operations, and memory use." : "",
        compileOutput: "",
        timeSeconds: Math.round(performance.now() - start) / 1000,
        memoryKb: null,
        outputTruncated,
        exitCode: timedOut ? null : failed || outputTruncated ? 1 : 0,
      };
    } finally {
      read.dispose();
    }
  } finally {
    vm.dispose();
    runtime.dispose();
  }
}

parentPort.postMessage(inputs.map(run));
