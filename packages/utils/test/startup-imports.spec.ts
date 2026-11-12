import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

// Importing `ox` from its root index eagerly loads `core/Bls`, which pulls in
// @noble/curves/bls12-381. That module runs an expensive precomputation at import time
// (~hundreds of ms on Hermes), blocking React Native startup. These tests load the built
// package in a fresh Node process and assert that no BLS module ends up in the graph.
// They run against `dist`, so the package must be built first (`npm run build`).

const DIST = resolve(__dirname, "../dist");
const CJS_ENTRY = resolve(DIST, "index.cjs");
const ESM_ENTRY = resolve(DIST, "index.js");
const BLS_MODULE = /bls12-381|\/ox\/_(cjs|esm)\/core\/Bls(Point)?\.js/;

function runNode(args: string[]): string[] {
  const output = execFileSync(process.execPath, args, { encoding: "utf8" });
  return JSON.parse(output.trim().split("\n").pop()!);
}

function loadedModulesCjs(): string[] {
  const script = `
    require(${JSON.stringify(CJS_ENTRY)});
    console.log(JSON.stringify(Object.keys(require.cache)));
  `;
  return runNode(["-e", script]);
}

function loadedModulesEsm(): string[] {
  // Record every URL resolved while importing the ESM entry, via a module resolve hook.
  const hooks = `
    let port;
    export function initialize(data) { port = data.port; }
    export async function resolve(specifier, context, next) {
      const result = await next(specifier, context);
      port.postMessage(result.url);
      return result;
    }
  `;
  const script = `
    import { register } from "node:module";
    const urls = [];
    const { port1, port2 } = new MessageChannel();
    port1.on("message", (url) => urls.push(url));
    port1.unref();
    register("data:text/javascript," + encodeURIComponent(${JSON.stringify(hooks)}), {
      data: { port: port2 },
      transferList: [port2],
    });
    await import(${JSON.stringify(pathToFileURL(ESM_ENTRY).href)});
    await new Promise((resolve) => setTimeout(resolve, 100));
    console.log(JSON.stringify(urls));
  `;
  return runNode(["--input-type=module", "-e", script]);
}

describe("startup imports", () => {
  it("dist is built", () => {
    expect(existsSync(CJS_ENTRY), `missing ${CJS_ENTRY}, run "npm run build" first`).toBe(true);
    expect(existsSync(ESM_ENTRY), `missing ${ESM_ENTRY}, run "npm run build" first`).toBe(true);
  });

  it("does not load BLS modules when requiring the CJS build", () => {
    const modules = loadedModulesCjs();
    // sanity check: the graph was actually captured and includes ox
    expect(modules.some((m) => m.includes("/ox/_cjs/core/Secp256k1.js"))).toBe(true);
    expect(modules.filter((m) => BLS_MODULE.test(m))).toEqual([]);
  });

  it("does not load BLS modules when importing the ESM build", () => {
    const modules = loadedModulesEsm();
    expect(modules.some((m) => m.includes("/ox/_esm/core/Secp256k1.js"))).toBe(true);
    expect(modules.filter((m) => BLS_MODULE.test(m))).toEqual([]);
  });
});
