import { Worker } from "node:worker_threads";
import { codeInput, type CodeInput } from "../features/coding/validation.js";
import { AppError } from "../utils/AppError.js";
import { executionLimits, type ExecutionProvider, type ExecutionResult } from "./codeExecution.js";

export const javascriptLimits = {
  caseMs: 500,
  memoryBytes: 16 * 1024 * 1024,
  stackBytes: 256 * 1024,
  outputBytes: executionLimits.outputBytes,
} as const;

let active = false;

export class JavaScriptExecutionProvider implements ExecutionProvider {
  name = "Disha360 JavaScript runner";
  supportedLanguages = ["javascript"] as const;

  async execute(input: CodeInput) {
    return (await this.executeBatch(input, [input.stdin]))[0];
  }

  async executeBatch(input: Omit<CodeInput, "stdin">, inputs: string[]): Promise<ExecutionResult[]> {
    if (input.language !== "javascript")
      throw new AppError(400, "UNSUPPORTED_LANGUAGE", "Choose JavaScript for this runner.");
    if (!inputs.length || inputs.length > 10) throw new Error("Invalid test batch");
    for (const stdin of inputs) codeInput.parse({ ...input, stdin });
    if (active) throw new AppError(503, "EXECUTION_BUSY", "The runner is busy. Please try again shortly.");
    active = true;
    try {
      return await new Promise<ExecutionResult[]>((resolve, reject) => {
        const worker = new Worker(new URL("./javascriptExecutionWorker.mjs", import.meta.url), {
          workerData: { source: input.source, inputs, limits: javascriptLimits },
          env: {},
          execArgv: [],
          stdout: true,
          stderr: true,
          resourceLimits: { maxOldGenerationSizeMb: 32, maxYoungGenerationSizeMb: 8, stackSizeMb: 2 },
        });
        worker.stdout.resume();
        worker.stderr.resume();
        let settled = false;
        const finish = (results?: ExecutionResult[]) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          void worker.terminate().then(() => {
            if (results) resolve(results);
            else reject(new AppError(503, "EXECUTION_UNAVAILABLE", "The runner stopped unexpectedly. Please try again."));
          }, () => reject(new AppError(503, "EXECUTION_UNAVAILABLE", "The runner stopped unexpectedly. Please try again.")));
        };
        const timer = setTimeout(() => finish(), 3000 + javascriptLimits.caseMs * inputs.length);
        worker.once("error", () => finish());
        worker.once("exit", () => finish());
        worker.once("message", (results: ExecutionResult[]) => finish(results));
      });
    } finally {
      active = false;
    }
  }
}
