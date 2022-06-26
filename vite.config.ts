import { defineConfig } from "vite";
import nodePolyfills from "rollup-plugin-polyfill-node";

interface IConfigOptions {
  name: string;
  entry: string;
  outDir: string;
}

export default function createConfig({ name, entry, outDir }: IConfigOptions) {
  return defineConfig({
    build: {
      lib: {
        name,
        entry,
        formats: ["es", "umd", "cjs"],
        fileName: "index",
      },

      rollupOptions: {
        output: {
          exports: "named",
        },
        plugins: [nodePolyfills({ include: ["events"] })],
      },

      outDir,
    },
  });
}
