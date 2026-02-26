import esbuild from "rollup-plugin-esbuild";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import visualizer from "rollup-plugin-visualizer";

export const input = "./src/index.ts";
export const plugins = [
  nodeResolve({ preferBuiltins: false, browser: true }),
  json(),
  commonjs(),
  esbuild({
    minify: true,
    tsconfig: "./tsconfig.json",
    loaders: {
      ".json": "json",
    },
  }),
  visualizer(),
];

export default function createConfig(
  packageName,
  packageDependencies,
  umd = {},
  cjs = {},
  es = {},
  extraBuilds = [],
) {
  return [
    {
      input,
      plugins,
      output: {
        file: "./dist/index.umd.js",
        format: "umd",
        exports: "named",
        name: packageName,
        sourcemap: true,
        ...umd,
      },
    },
    {
      input,
      plugins,
      external: packageDependencies,
      output: [
        {
          file: "./dist/index.cjs",
          format: "cjs",
          exports: "named",
          name: packageName,
          sourcemap: true,
          ...cjs,
        },
        {
          file: "./dist/index.js",
          format: "es",
          exports: "named",
          name: packageName,
          sourcemap: true,
          ...es,
        },
      ],
    },
    ...extraBuilds,
  ];
}
