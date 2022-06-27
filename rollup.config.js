import esbuild from "rollup-plugin-esbuild";
import nodePolyfills from "rollup-plugin-polyfill-node";

export default function createConfig(name, dependencies) {
  return {
    input: "./src/index.ts",
    output: [
      { file: "./dist/index.cjs.js", format: "cjs", exports: "named", name },
      { file: "./dist/index.es.js", format: "es", exports: "named", name },
      { file: "./dist/index.umd.js", format: "umd", exports: "named", name },
    ],
    plugins: [
      nodePolyfills({
        include: ["events"],
      }),
      esbuild({
        minify: true,
        tsconfig: "./tsconfig.json",
      }),
    ],
  };
}
