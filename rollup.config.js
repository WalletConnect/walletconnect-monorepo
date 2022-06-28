import esbuild from "rollup-plugin-esbuild";
import nodePolyfills from "rollup-plugin-polyfill-node";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";

const coreConfig = {
  input: "./src/index.ts",
  plugins: [
    nodePolyfills(),
    esbuild({
      target: "es2020",
      minify: true,
      tsconfig: "./tsconfig.json",
    }),
  ],
};

export default function createConfig(packageName, packageDependencies) {
  return [
    {
      ...coreConfig,
      plugins: [nodeResolve({ preferBuiltins: false }), commonjs(), json(), ...coreConfig.plugins],
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
