import { resolve } from "path";
import { defineConfig } from "vite";
import { name } from "./package.json";

export default defineConfig({
  build: {
    lib: {
      name,
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es", "umd", "cjs"],
      fileName: "index",
    },
    rollupOptions: {
      output: {
        exports: "named",
      },
    },

    outDir: resolve(__dirname, "dist"),
  },
});
