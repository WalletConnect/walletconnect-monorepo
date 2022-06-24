import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "@walletconnect/utils",
      formats: ["es", "umd"],
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
