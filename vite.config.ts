import { defineConfig } from "vite";

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
      },

      outDir,
    },
  });
}
