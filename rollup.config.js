import esbuild from "rollup-plugin-esbuild";
import nodePolyfills from "rollup-plugin-polyfill-node";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";

const coreConfig = {
  input: "./src/index.ts",
  plugins: [
    nodePolyfills(),
    esbuild({
      minify: true,
      tsconfig: "./tsconfig.json",
      loaders: {
        ".json": "json",
      },
    }),
  ],
};

export default function createConfig(packageName, packageDependencies) {
  return [
    {
      ...coreConfig,
      plugins: [
        nodeResolve({ preferBuiltins: false, browser: true }),
        commonjs(),
        ...coreConfig.plugins,
      ],
      output: { file: "./dist/index.umd.js", format: "umd", exports: "named", name: packageName },
    },
    {
      ...coreConfig,
      external: packageDependencies,
      output: [
        { file: "./dist/index.cjs.js", format: "cjs", exports: "named", name: packageName },
        { file: "./dist/index.es.js", format: "es", exports: "named", name: packageName },
      ],
    },
  ];
}
