import pkg from "./package.json" with { type: "json" };
import createConfig, { isExternal, plugins } from "../../rollup.config.js";

const dependencies = Object.keys(pkg.dependencies);

// The v3 engine and its embedded WASM, at @walletconnect/sign-client/v3. Kept out of the main
// entry, so v2 bundles don't grow.
const v3 = {
  input: "./src/v3/index.ts",
  plugins,
  external: isExternal(dependencies),
  output: [
    {
      file: "./dist/v3/index.cjs",
      format: "cjs",
      exports: "named",
      interop: "auto",
      sourcemap: true,
    },
    { file: "./dist/v3/index.js", format: "es", exports: "named", sourcemap: true },
  ],
};

export default createConfig(pkg.name, dependencies, {}, {}, {}, [v3]);
