import { expect, it } from "vitest";
import { JavaScriptExecutionProvider } from "../src/services/javascriptExecution.js";

const provider = new JavaScriptExecutionProvider();
const run = (source: string, stdin = "") => provider.execute({ language: "javascript", source, stdin });

it("limits guest capabilities and isolates each hidden case", async () => {
  const source = `
    if (globalThis.previous || typeof process !== "undefined" || typeof fetch !== "undefined") throw Error("unexpected global");
    globalThis.previous = true;
    for (const name of ["node:fs/promises", "node:child_process", "node:net"]) {
      let blocked = false;
      try { require(name); } catch { blocked = true; }
      if (!blocked) throw Error("unexpected module");
    }
    let denied = false;
    try { require("fs").readFileSync("/etc/passwd", "utf8"); } catch { denied = true; }
    if (!denied) throw Error("unexpected file access");
    console.log(require("node:fs").readFileSync(0, "utf8"));
  `;
  const result = await provider.executeBatch({ language: "javascript", source }, ['"; throw Error("injected"); //', "second"]);
  expect(result.map(({ verdict, stdout }) => [verdict, stdout])).toEqual([
    ["Accepted", '"; throw Error("injected"); //\n'],
    ["Accepted", "second\n"],
  ]);
});

it("stops infinite loops and excessive output without blocking other requests", async () => {
  const spinning = run("while (true) {}");
  await expect(run("console.log(1)")).rejects.toMatchObject({ code: "EXECUTION_BUSY" });
  expect(await spinning).toMatchObject({ verdict: "Time Limit Exceeded" });
  expect(await run("console.log('x'.repeat(20000))")).toMatchObject({ verdict: "Runtime Error", outputTruncated: true });
  expect(await run("const a = new ArrayBuffer(80 * 1024 * 1024)")).toMatchObject({ verdict: "Runtime Error" });
  expect(await run("console.log(6 * 7)")).toMatchObject({ verdict: "Accepted", stdout: "42\n" });
});
