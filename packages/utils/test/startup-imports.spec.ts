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
// Prefix for the line carrying the module list, so other stdout output (warnings) can't break parsing.
const MARKER = "LOADED_MODULES:";

function runNode(args: string[]): string[] {
  const output = execFileSync(process.execPath, args, { encoding: "utf8", timeout: 30_000 });
  const line = output.split("\n").find((l) => l.startsWith(MARKER));
  if (!line) throw new Error(`no ${MARKER} line in child output:\n${output}`);
  return JSON.parse(line.slice(MARKER.length));
}

function loadedModulesCjs(): string[] {
  const script = `
    require(${JSON.stringify(CJS_ENTRY)});
    console.log(${JSON.stringify(MARKER)} + JSON.stringify(Object.keys(require.cache)));
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
    // Messages on one port arrive in order, so once the sentinel's URL arrives, every URL
    // resolved during the real import has arrived too.
    const sentinel = "data:text/javascript,export default 'startup-imports-sentinel'";
    const drained = new Promise((resolve) => {
      port1.on("message", (url) => (url === sentinel ? resolve() : urls.push(url)));
    });
    register("data:text/javascript," + encodeURIComponent(${JSON.stringify(hooks)}), {
      data: { port: port2 },
      transferList: [port2],
    });
    await import(${JSON.stringify(pathToFileURL(ESM_ENTRY).href)});
    await import(sentinel);
    await drained;
    port1.close();
    console.log(${JSON.stringify(MARKER)} + JSON.stringify(urls));
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
