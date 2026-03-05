import pkg from "./package.json" with { type: "json" };
import createConfig, { input, plugins } from "../../rollup.config.js";
import alias from "@rollup/plugin-alias";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const options = { inlineDynamicImports: true };

const externalDependencies = Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies }).concat(
  "@reown/appkit/core",
);
export default createConfig(pkg.name, externalDependencies, options, options, options, [
  {
    input,
    plugins: [
      alias({
        entries: [
          {
            find: "./utils/appkit",
            replacement: path.resolve(__dirname, `src/utils/appkit.native.ts`),
          },
        ],
      }),
      ...plugins,
    ],
    external: externalDependencies,
    output: {
      file: "./dist/index.native.js",
      format: "cjs",
      exports: "named",
      name: pkg.name,
      sourcemap: true,
      ...options,
    },
  },
]);
