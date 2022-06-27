import esbuild from 'rollup-plugin-esbuild'
import { name } from "./package.json";

export default {
  input: "./src/index.ts",
  output: [
    { file: "./dist/index.cjs.js", format: "cjs", name },
    { file: "./dist/index.es.js", format: "es", name },
    { file: "./dist/index.umd.js", format: "umd", name },
  ],
  plugins: [esbuild({
    tsconfig: './tsconfig.json'
  })],
};
