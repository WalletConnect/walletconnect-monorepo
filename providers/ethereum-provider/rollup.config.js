import { name, dependencies, peerDependencies } from "./package.json";
import createConfig, { input, plugins } from "../../rollup.config";
import alias from "@rollup/plugin-alias";
import path from "path";

// `ethereum-provider` has dynamic imports, so we need to enable inlineDynamicImports
const options = { inlineDynamicImports: true };

// keep `@reown/appkit/core` in the external dependencies, else the builds will balloon in size
const externalDependencies = Object.keys({ ...dependencies, ...peerDependencies }).concat(
  "@reown/appkit/core",
);
export default createConfig(name, externalDependencies, options, options, options, [
  {
    input,
    plugins: [
      alias({
        entries: [
          {
            // this config allows separate files to be used for the browser and native builds
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
      name,
      sourcemap: true,
      ...options,
    },
  },
]);
