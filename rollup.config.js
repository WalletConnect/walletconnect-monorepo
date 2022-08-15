import esbuild from "rollup-plugin-esbuild";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";

const input = "./src/index.ts";
const plugins = [
  nodeResolve({ preferBuiltins: false, browser: true }),
  commonjs(),
  esbuild({
    minify: true,
    tsconfig: "./tsconfig.json",
    loaders: {
      ".json": "json",
    },
  }),
];

export default function createConfig(packageName, packageDependencies) {
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
        },
        {
          file: "./dist/index.es.js",
          format: "es",
          exports: "named",
          name: packageName,
          sourcemap: true,
        },
      ],
    },
  ];
}
