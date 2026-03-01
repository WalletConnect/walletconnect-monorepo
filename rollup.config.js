import esbuild from "rollup-plugin-esbuild";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import visualizer from "rollup-plugin-visualizer";

export const input = "./src/index.ts";
const isProduction = process.env.NODE_ENV === "production";

export const plugins = [
  // Resolve import paths
  nodeResolve({
    preferBuiltins: false,
    browser: true,
    extensions: [".ts", ".js", ".native.ts", ".native.js"],
  }),

  //Inline JSON imports
  json(),

  // Convert CJS → ESM
  commonjs({
    transformMixedEsModules: true,
    ignoreDynamicRequires: true,
    include: [/node_modules/],
  }),

  // Transpile TS/JSX
  esbuild({
    minify: true,
    target: "es2020",
    tsconfig: "./tsconfig.json",
    loaders: { ".json": "json" },
    legalComments: "none",
    treeShaking: true,
    drop: isProduction ? ["console", "debugger"] : [],
  }),

  // Visualize bundle for debugging
  !isProduction && visualizer({ open: false }),
].filter(Boolean);

export default function createConfig(
  packageName,
  packageDependencies,
  umd = {},
  cjs = {},
  es = {},
  extraBuilds = [],
) {
  return [
    // ESM build (primary for modern bundlers and React Native)
    {
      input,
      plugins,
      external: packageDependencies, // Keep dependencies external for bundlers
      output: {
        file: "./dist/index.js",
        format: "es",
        exports: "named",
        sourcemap: isProduction ? "hidden" : true,
        compact: isProduction,
        ...es,
      },
    },
    // CJS build (for Node.js and older bundlers)
    {
      input,
      plugins,
      external: packageDependencies,
      output: {
        file: "./dist/index.cjs",
        format: "cjs",
        exports: "named",
        sourcemap: true,
        interop: "auto",
        ...cjs,
      },
    },
    // UMD build (for browsers)
    {
      input,
      plugins,
      external: packageDependencies,
      output: {
        file: "./dist/index.umd.js",
        format: "umd",
        exports: "named",
        name: packageName,
        sourcemap: true,
        ...umd,
      },
    },
    ...extraBuilds,
  ];
}
