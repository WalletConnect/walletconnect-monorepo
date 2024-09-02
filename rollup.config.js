import esbuild from "rollup-plugin-esbuild";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";

const input = "./src/index.ts";
const plugins = [
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
];

export default function createConfig(
  packageName,
  packageDependencies,
  umd = {},
  cjs = {},
  es = {},
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
          file: "./dist/index.cjs.js",
          format: "cjs",
          exports: "named",
          name: packageName,
          sourcemap: true,
          ...cjs,
        },
        {
          file: "./dist/index.es.js",
          format: "es",
          exports: "named",
          name: packageName,
          sourcemap: true,
          ...es,
        },
      ],
    },
  ];
}
