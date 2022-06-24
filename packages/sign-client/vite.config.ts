import { resolve } from "path";
import { defineConfig } from "vite";
import analyze from "rollup-plugin-analyzer";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "@walletconnect/sign-client",
      formats: ["cjs", "es", "umd"],
      fileName: "index",
    },
    rollupOptions: {
      plugins: [analyze()],
    },
    outDir: resolve(__dirname, "dist"),
  },
});
